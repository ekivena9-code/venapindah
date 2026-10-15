import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import {
    MOBILE_UI_SCALE_DEFAULT,
    normalizeMobileUiScale,
    saveMobileUiScale,
} from '../utils/mobileUiScale';

export const MOBILE_UI_SCALE_SYNC_EVENT = 'venapindah-mobile-ui-scale-sync';

/** Load the scale stored in the `profiles` table for the current user. */
export async function loadRemoteMobileUiScale(): Promise<number | undefined> {
    if (!isSupabaseConfigured) return undefined;

    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData?.session) return undefined;

        const { data, error } = await supabase
            .from('profiles')
            .select('mobile_ui_scale')
            .eq('admin_user_id', sessionData.session.user.id)
            .maybeSingle();
        if (error) {
            if (error.code === 'PGRST116') return MOBILE_UI_SCALE_DEFAULT;
            throw error;
        }
        if (!data) return MOBILE_UI_SCALE_DEFAULT;

        const value = data.mobile_ui_scale;
        if (value === null || value === undefined) return MOBILE_UI_SCALE_DEFAULT;

        const scale = Number(value);
        if (!Number.isFinite(scale)) return MOBILE_UI_SCALE_DEFAULT;
        return normalizeMobileUiScale(scale);
    } catch (err: any) {
        if (err?.name === 'AuthSessionMissingError' || err?.message?.includes('Auth session missing')) {
            return undefined;
        }
        throw err;
    }
}

/** Persist the scale to the `profiles` table for the current user. */
export async function saveRemoteMobileUiScale(value: number): Promise<number | undefined> {
    const scale = normalizeMobileUiScale(value);
    if (!isSupabaseConfigured) return undefined;

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session) throw new Error('Sesi akun Supabase tidak ditemukan.');

    const userId = sessionData.session.user.id;

    // Use update — the profile row is always created at account setup.
    // RLS ensures we can only update the current user's own row.
    const { data, error } = await supabase
        .from('profiles')
        .update({ mobile_ui_scale: scale })
        .eq('admin_user_id', userId)
        .select('mobile_ui_scale')
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Profil akun tidak ditemukan; preferensi tidak disimpan.');

    const savedScale = data.mobile_ui_scale;
    return savedScale !== null && savedScale !== undefined
        ? normalizeMobileUiScale(Number(savedScale))
        : MOBILE_UI_SCALE_DEFAULT;
}

/** Fetch remote scale, apply it, and sync to localStorage. */
export async function syncRemoteMobileUiScale(): Promise<number | null> {
    const remoteScale = await loadRemoteMobileUiScale();
    if (remoteScale === undefined) return null;
    const appliedScale = saveMobileUiScale(remoteScale);
    window.dispatchEvent(new CustomEvent(MOBILE_UI_SCALE_SYNC_EVENT, { detail: appliedScale }));
    return appliedScale;
}
