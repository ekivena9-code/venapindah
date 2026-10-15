export const MOBILE_UI_SCALE_STORAGE_KEY = 'venapindah.mobile-ui-scale.v1';
export const MOBILE_UI_SCALE_DEFAULT = 0.8;
export const MOBILE_UI_SCALE_MIN = 0.4;
export const MOBILE_UI_SCALE_MAX = 1.4;

export const normalizeMobileUiScale = (value: number): number => {
    if (!Number.isFinite(value)) return MOBILE_UI_SCALE_DEFAULT;
    const clamped = Math.min(MOBILE_UI_SCALE_MAX, Math.max(MOBILE_UI_SCALE_MIN, value));
    return Math.round(clamped * 100) / 100;
};

export const readMobileUiScale = (): number => {
    try {
        const savedValue = window.localStorage.getItem(MOBILE_UI_SCALE_STORAGE_KEY);
        if (savedValue === null || typeof savedValue !== 'string' || !savedValue.trim()) {
            return MOBILE_UI_SCALE_DEFAULT;
        }
        const parsed = Number(savedValue);
        if (!Number.isFinite(parsed)) return MOBILE_UI_SCALE_DEFAULT;
        return normalizeMobileUiScale(parsed);
    } catch {
        return MOBILE_UI_SCALE_DEFAULT;
    }
};

export const applyMobileUiScale = (value: number): number => {
    const scale = normalizeMobileUiScale(value);
    if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--mobile-ui-scale', String(scale));
        document.documentElement.style.setProperty('--profile-mobile-ui-scale', String(scale));
    }
    return scale;
};

export const saveMobileUiScale = (value: number): number => {
    const scale = applyMobileUiScale(value);
    try {
        window.localStorage.setItem(MOBILE_UI_SCALE_STORAGE_KEY, String(scale));
    } catch {
        // Keep the current session setting even when browser storage is unavailable.
    }
    return scale;
};