import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import {
    applyMobileUiScale,
    MOBILE_UI_SCALE_DEFAULT,
    normalizeMobileUiScale,
    readMobileUiScale,
    saveMobileUiScale,
} from '../utils/mobileUiScale';

const USER_METADATA_KEY = 'mobile_ui_scale';
export const MOBILE_UI_SCALE_SYNC_EVENT = 'venapindah-mobile-ui-scale-sync';

export async function loadRemoteMobileUiScale(): Promise<number | null | undefined> {
    if (!isSupabaseConfigured) return undefined;

    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData?.session) return undefined;

        const { data, error } = await supabase.auth.getUser();
        if (error) {
            if (error.name === 'AuthSessionMissingError' || error.message?.includes('Auth session missing')) {
                return undefined;
            }
            throw error;
        }
        if (!data?.user) return undefined;

        const value = data.user.user_metadata?.[USER_METADATA_KEY];
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

export async function saveRemoteMobileUiScale(value: number): Promise<number | undefined> {
    const scale = normalizeMobileUiScale(value);
    if (!isSupabaseConfigured) return undefined;

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session) return undefined;

    const { data, error } = await supabase.auth.updateUser({
        data: { [USER_METADATA_KEY]: scale },
    });
    if (error) throw error;
    if (!data?.user) throw new Error('Supabase tidak mengembalikan akun pengguna.');

    const savedScale = Number(data.user.user_metadata?.[USER_METADATA_KEY]);
    if (!Number.isFinite(savedScale)) throw new Error('Supabase tidak mengembalikan preferensi skala yang valid.');
    return normalizeMobileUiScale(savedScale);
}

export async function syncRemoteMobileUiScale(): Promise<number | null> {
    const remoteScale = await loadRemoteMobileUiScale();
    if (remoteScale === undefined) return null;

    if (remoteScale === null) {
        const localScale = readMobileUiScale();
        if (localScale !== MOBILE_UI_SCALE_DEFAULT) {
            try {
                await saveRemoteMobileUiScale(localScale);
                return localScale;
            } catch {
                // Ignore sync up error if user cannot write yet
            }
        }
        return null;
    }

    const appliedScale = saveMobileUiScale(applyMobileUiScale(remoteScale));
    window.dispatchEvent(new CustomEvent(MOBILE_UI_SCALE_SYNC_EVENT, { detail: appliedScale }));
    return appliedScale;
}