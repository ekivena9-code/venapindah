import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import {
    applyMobileUiScale,
    MOBILE_UI_SCALE_DEFAULT,
    normalizeMobileUiScale,
    readMobileUiScale,
    saveMobileUiScale,
} from '../utils/mobileUiScale';

export const MOBILE_UI_SCALE_SYNC_EVENT = 'venapindah-mobile-ui-scale-sync';

/** Load the scale stored in the `profiles` table for the current user. */
export async function loadRemoteMobileUiScale(): Promise<number | null | undefined> {
    if (!isSupabaseConfigured) return undefined;

    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData?.session) return undefined;

        const { data, error } = await supabase
            .from('profiles')
            .select('mobile_ui_scale')
            .limit(1)
            .maybeSingle();
        if (error) {
            if (error.code === 'PGRST116') return undefined; // no profile row yet
            throw error;
        }
        if (!data) return undefined; // profile not yet created

        const value = data.mobile_ui_scale;
        if (value === null || value === undefined) return null;

        const scale = Number(value);
        if (!Number.isFinite(scale)) return null;
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
    if (!sessionData?.session) return undefined;

    const userId = sessionData.session.user.id;

    // Use update — the profile row is always created at account setup.
    // RLS ensures we can only update the current user's own row.
    const { data, error } = await supabase
        .from('profiles')
        .update({ mobile_ui_scale: scale === MOBILE_UI_SCALE_DEFAULT ? null : scale })
        .eq('admin_user_id', userId)
        .select('mobile_ui_scale')
        .maybeSingle();
    if (error) throw error;
    // No matching row — profile may not exist yet; warn and return undefined without throwing.
    if (!data) {
        console.warn('[MobileUiScale] No profile row found for current user; scale preference not saved.');
        return undefined;
    }

    const savedScale = data.mobile_ui_scale;
    return savedScale !== null && savedScale !== undefined
        ? normalizeMobileUiScale(Number(savedScale))
        : MOBILE_UI_SCALE_DEFAULT;
}

/** Fetch remote scale, apply it, and sync to localStorage. */
export async function syncRemoteMobileUiScale(): Promise<number | null> {
    const remoteScale = await loadRemoteMobileUiScale();
    if (remoteScale === undefined) return null;

    if (remoteScale === null) {
        // No remote preference yet — push the local one up if it differs from default.
        const localScale = readMobileUiScale();
        if (localScale !== MOBILE_UI_SCALE_DEFAULT) {
            try {
                await saveRemoteMobileUiScale(localScale);
                return localScale;
            } catch (err) {
                console.warn('[MobileUiScale] Failed to push local scale to remote:', err);
            }
        }
        return null;
    }

    const appliedScale = saveMobileUiScale(applyMobileUiScale(remoteScale));
    window.dispatchEvent(new CustomEvent(MOBILE_UI_SCALE_SYNC_EVENT, { detail: appliedScale }));
    return appliedScale;
}
