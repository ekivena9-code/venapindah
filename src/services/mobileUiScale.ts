import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import {
    applyMobileUiScale,
    normalizeMobileUiScale,
    saveMobileUiScale,
} from '../utils/mobileUiScale';

const USER_METADATA_KEY = 'mobile_ui_scale';
export const MOBILE_UI_SCALE_SYNC_EVENT = 'venapindah-mobile-ui-scale-sync';

export async function loadRemoteMobileUiScale(): Promise<number | null | undefined> {
    if (!isSupabaseConfigured) return undefined;

    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) return undefined;

    const value = data.user.user_metadata?.[USER_METADATA_KEY];
    if (value === null || value === undefined) return null;

    const scale = Number(value);
    if (!Number.isFinite(scale)) throw new Error('Preferensi skala dari Supabase tidak valid.');
    return normalizeMobileUiScale(scale);
}

export async function saveRemoteMobileUiScale(value: number): Promise<number | undefined> {
    const scale = normalizeMobileUiScale(value);
    if (!isSupabaseConfigured) return undefined;

    const { data, error } = await supabase.auth.updateUser({
        data: { [USER_METADATA_KEY]: scale },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Supabase tidak mengembalikan akun pengguna.');

    const savedScale = Number(data.user.user_metadata?.[USER_METADATA_KEY]);
    if (!Number.isFinite(savedScale)) throw new Error('Supabase tidak mengembalikan preferensi skala yang valid.');
    return normalizeMobileUiScale(savedScale);
}

export async function syncRemoteMobileUiScale(): Promise<number | null> {
    const remoteScale = await loadRemoteMobileUiScale();
    if (remoteScale === undefined || remoteScale === null) return null;

    const appliedScale = saveMobileUiScale(applyMobileUiScale(remoteScale));
    window.dispatchEvent(new CustomEvent(MOBILE_UI_SCALE_SYNC_EVENT, { detail: appliedScale }));
    return appliedScale;
}