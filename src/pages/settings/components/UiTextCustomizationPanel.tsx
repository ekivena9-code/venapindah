import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, RotateCcw, Save, Search, X } from 'lucide-react';
import { isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
    saveUiTextOverrides,
    UI_TEXT_OPTIONS,
    UiTextOverrides,
    useUiTextOverrides,
} from '../../../utils/uiTextCustomization';
import {
    applyMobileUiScale,
    MOBILE_UI_SCALE_DEFAULT,
    MOBILE_UI_SCALE_MAX,
    MOBILE_UI_SCALE_MIN,
    normalizeMobileUiScale,
    readMobileUiScale,
    saveMobileUiScale,
} from '../../../utils/mobileUiScale';
import {
    loadRemoteMobileUiScale,
    MOBILE_UI_SCALE_SYNC_EVENT,
    saveRemoteMobileUiScale,
} from '../../../services/mobileUiScale';

const GROUPS = [
    'Menu',
    'Dashboard',
    'Detail Pengantin',
    'Detail Acara',
    'Detail Tim',
    'Rincian Tim/Vendor',
    'Detail Keuangan',
    'Katalog Paket',
    'Detail Paket',
    'Syarat Paket',
    'Status Pembayaran',
];

const normalizeOverrides = (overrides: UiTextOverrides): UiTextOverrides => Object.fromEntries(
    Object.entries(overrides).map(([key, value]) => [key, (value || '').trim()]).filter(([, value]) => value),
);

const UiTextCustomizationPanel: React.FC = () => {
    const savedOverrides = useUiTextOverrides();
    const [savedMobileUiScale, setSavedMobileUiScale] = useState(readMobileUiScale);
    const [mobileUiScale, setMobileUiScale] = useState(savedMobileUiScale);
    const [savingMobileScale, setSavingMobileScale] = useState(false);
    const [mobileScaleError, setMobileScaleError] = useState<string | null>(null);
    const [mobileScaleLoadError, setMobileScaleLoadError] = useState<string | null>(null);
    const [mobileScaleMessage, setMobileScaleMessage] = useState<string | null>(null);
    const [draft, setDraft] = useState<UiTextOverrides>(savedOverrides);
    const [lastSavedGroup, setLastSavedGroup] = useState<string | null>(null);
    const [savingGroup, setSavingGroup] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(['Menu']));
    const previousSavedRef = useRef(savedOverrides);
    const mobileScaleEditedRef = useRef(false);

    useEffect(() => {
        let isMounted = true;
        const handleRemoteScaleSync = (event: Event) => {
            if (mobileScaleEditedRef.current) return;
            const scale = (event as CustomEvent<number>).detail;
            setMobileUiScale(scale);
            setSavedMobileUiScale(scale);
        };
        window.addEventListener(MOBILE_UI_SCALE_SYNC_EVENT, handleRemoteScaleSync);

        if (isSupabaseConfigured && typeof loadRemoteMobileUiScale === 'function') {
            loadRemoteMobileUiScale().then(remoteScale => {
                if (!isMounted || mobileScaleEditedRef.current) return;
                if (remoteScale !== undefined) {
                    setSavedMobileUiScale(remoteScale);
                    setMobileUiScale(remoteScale);
                    saveMobileUiScale(remoteScale);
                }
            }).catch(error => {
                if (isMounted) setMobileScaleLoadError(error instanceof Error ? error.message : 'Preferensi gagal dimuat dari Supabase.');
            });
        }

        return () => {
            isMounted = false;
            window.removeEventListener(MOBILE_UI_SCALE_SYNC_EVENT, handleRemoteScaleSync);
        };
    }, []);

    useEffect(() => {
        const previousSaved = normalizeOverrides(previousSavedRef.current);
        const nextSaved = normalizeOverrides(savedOverrides);
        setDraft(current => {
            const next = { ...current };
            const keys = new Set([...Object.keys(previousSaved), ...Object.keys(nextSaved)]);
            keys.forEach(key => {
                if (normalizeOverrides({ [key]: current[key] })[key] !== previousSaved[key]) return;
                if (nextSaved[key]) next[key] = nextSaved[key];
                else delete next[key];
            });
            return next;
        });
        previousSavedRef.current = savedOverrides;
    }, [savedOverrides]);

    const normalizedSaved = normalizeOverrides(savedOverrides);
    const normalizedDraft = normalizeOverrides(draft);
    const changedKeys = [...new Set([...Object.keys(normalizedSaved), ...Object.keys(normalizedDraft)])]
        .filter(key => normalizedSaved[key] !== normalizedDraft[key]);
    const changedKeySet = new Set(changedKeys);
    const normalizedSearch = search.trim().toLocaleLowerCase('id-ID');

    const hasUnsavedMobileScale = Math.abs(mobileUiScale - savedMobileUiScale) > 0.0001;

    const updateMobileUiScale = (value: number) => {
        mobileScaleEditedRef.current = true;
        setMobileScaleError(null);
        setMobileScaleMessage(null);
        setMobileUiScale(value);
        applyMobileUiScale(value);
    };

    const saveMobileScale = async () => {
        const nextScale = normalizeMobileUiScale(mobileUiScale);
        setSavingMobileScale(true);
        setMobileScaleError(null);
        setMobileScaleLoadError(null);
        setMobileScaleMessage(null);
        try {
            if (isSupabaseConfigured) {
                const savedScale = await saveRemoteMobileUiScale(nextScale);
                if (savedScale === undefined) {
                    throw new Error('Supabase tidak mengembalikan hasil penyimpanan.');
                }
                saveMobileUiScale(savedScale);
                setSavedMobileUiScale(savedScale);
                setMobileUiScale(savedScale);
                setMobileScaleMessage('Preferensi disimpan ke akun Supabase ini.');
            } else {
                saveMobileUiScale(nextScale);
                setSavedMobileUiScale(nextScale);
                setMobileScaleMessage('Preferensi disimpan di browser ini saja.');
            }
            mobileScaleEditedRef.current = false;
        } catch (error) {
            setMobileScaleError(error instanceof Error ? error.message : 'Preferensi gagal disimpan ke Supabase.');
        } finally {
            setSavingMobileScale(false);
        }
    };

    const saveGroup = async (group: string) => {
        const groupOptions = UI_TEXT_OPTIONS.filter(option => option.group === group);
        if (!groupOptions.some(option => changedKeySet.has(option.key))) return;

        const nextOverrides = { ...normalizedSaved };
        groupOptions.forEach(option => {
            delete nextOverrides[option.key];
            if (normalizedDraft[option.key]) nextOverrides[option.key] = normalizedDraft[option.key];
        });
        setSavingGroup(group);
        setSaveError(null);
        try {
            await saveUiTextOverrides(nextOverrides);
            setLastSavedGroup(group);
            window.setTimeout(() => setLastSavedGroup(current => current === group ? null : current), 2500);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Perubahan gagal disimpan.');
        } finally {
            setSavingGroup(null);
        }
    };

    const resetField = (key: string) => {
        setDraft(current => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        setLastSavedGroup(null);
    };

    const resetGroup = (group: string) => {
        const groupKeys = UI_TEXT_OPTIONS.filter(option => option.group === group).map(option => option.key);
        setDraft(current => {
            const next = { ...current };
            groupKeys.forEach(key => delete next[key]);
            return next;
        });
        setLastSavedGroup(null);
    };

    const discardGroup = (group: string) => {
        const groupKeys = UI_TEXT_OPTIONS.filter(option => option.group === group).map(option => option.key);
        setDraft(current => {
            const next = { ...current };
            groupKeys.forEach(key => {
                if (normalizedSaved[key]) next[key] = normalizedSaved[key];
                else delete next[key];
            });
            return next;
        });
        setLastSavedGroup(null);
    };

    return (
        <section className="space-y-5">
            <div>
                <h3 className="text-base font-semibold text-brand-text-primary">Kustomisasi Teks</h3>
                <p className="mt-1 text-sm text-brand-text-secondary">
                    Cari teks, ubah, lalu simpan per bagian.{' '}
                    {isSupabaseConfigured
                        ? 'Perubahan disimpan ke akun Supabase ini.'
                        : 'Supabase belum dikonfigurasi; perubahan hanya disimpan di browser ini.'}
                </p>
            </div>

            <div className="rounded-md border border-brand-border bg-brand-surface p-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h4 className="text-sm font-semibold text-brand-text-primary">Ukuran teks dan tampilan mobile</h4>
                        <p className="mt-1 text-xs text-brand-text-secondary">
                            Mengatur teks, harga, ikon, dan tombol pada semua halaman mobile.{' '}
                            {isSupabaseConfigured
                                ? 'Preferensi disimpan ke akun Supabase ini dan digunakan di perangkat lain.'
                                : 'Preferensi disimpan di browser ini saja karena Supabase belum dikonfigurasi.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => updateMobileUiScale(MOBILE_UI_SCALE_DEFAULT)}
                        disabled={savingMobileScale || mobileUiScale === MOBILE_UI_SCALE_DEFAULT}
                        className="inline-flex shrink-0 items-center gap-1 rounded border border-brand-border px-2 py-1 text-xs font-medium text-brand-text-secondary hover:bg-brand-bg disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset 100%
                    </button>
                </div>
                <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs text-brand-text-secondary">Kecil</span>
                    <input
                        type="range"
                        aria-label="Ukuran teks dan tampilan mobile"
                        min={MOBILE_UI_SCALE_MIN}
                        max={MOBILE_UI_SCALE_MAX}
                        step={0.05}
                        value={mobileUiScale}
                        disabled={savingMobileScale}
                        onChange={event => updateMobileUiScale(Number(event.target.value))}
                        className="min-w-0 flex-1 accent-[#5D87FF]"
                    />
                    <output className="min-w-12 text-right text-sm font-bold tabular-nums text-brand-text-primary">
                        {Math.round(mobileUiScale * 100)}%
                    </output>
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-brand-text-secondary">
                    <span>{Math.round(MOBILE_UI_SCALE_MIN * 100)}%</span>
                    <span>Normal</span>
                    <span>{Math.round(MOBILE_UI_SCALE_MAX * 100)}%</span>
                </div>
                <div className="mt-3 flex justify-end">
                    <button
                        type="button"
                        onClick={saveMobileScale}
                        disabled={!hasUnsavedMobileScale || savingMobileScale}
                        aria-label="Simpan skala mobile"
                        className="button-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Save className="h-3.5 w-3.5" />
                        {savingMobileScale ? 'Menyimpan...' : 'Simpan'}
                    </button>
                </div>
                {mobileScaleError && <p role="alert" className="mt-2 text-xs font-medium text-red-600">Gagal menyimpan ke Supabase: {mobileScaleError}</p>}
                {mobileScaleLoadError && <p role="alert" className="mt-2 text-xs font-medium text-red-600">Gagal memuat preferensi dari Supabase: {mobileScaleLoadError}</p>}
                {mobileScaleMessage && <p role="status" className="mt-2 text-xs font-medium text-emerald-700">{mobileScaleMessage}</p>}
            </div>

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-secondary" />
                <input
                    aria-label="Cari label atau teks asli"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Cari label atau teks asli..."
                    className="input-field pl-9 pr-10"
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => setSearch('')}
                        aria-label="Hapus pencarian"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-brand-text-secondary hover:bg-brand-bg"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {GROUPS.map(group => {
                const groupOptions = UI_TEXT_OPTIONS.filter(option => option.group === group);
                const visibleOptions = groupOptions.filter(option => !normalizedSearch ||
                    `${group} ${option.label} ${option.defaultText}`.toLocaleLowerCase('id-ID').includes(normalizedSearch));
                if (visibleOptions.length === 0) return null;

                const groupChangeCount = groupOptions.filter(option => changedKeySet.has(option.key)).length;
                const groupHasOverrides = groupOptions.some(option => normalizedDraft[option.key] || normalizedSaved[option.key]);
                const groupHasChanges = groupChangeCount > 0;
                const isGroupOpen = Boolean(normalizedSearch) || openGroups.has(group);

                return (
                    <details key={group} open={isGroupOpen} className="group space-y-3 rounded-md border border-brand-border px-3 py-2.5">
                        <summary
                            onClick={event => {
                                event.preventDefault();
                                setOpenGroups(current => {
                                    const next = new Set(current);
                                    if (next.has(group)) next.delete(group);
                                    else next.add(group);
                                    return next;
                                });
                            }}
                            className="flex cursor-pointer list-none items-center justify-between border-b border-brand-border pb-2 text-sm font-semibold text-brand-text-primary marker:hidden"
                        >
                            <span className="flex items-center gap-2">
                                {group}
                                {groupChangeCount > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{groupChangeCount} perubahan</span>}
                            </span>
                            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        </summary>
                        {isGroupOpen && (
                            <>
                                <div className="mb-1 flex flex-col gap-2 border-b border-brand-border pb-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs font-medium text-brand-text-secondary">
                                        {groupHasChanges
                                            ? `${groupChangeCount} perubahan belum disimpan di bagian ini`
                                            : lastSavedGroup === group ? 'Perubahan bagian ini tersimpan' : 'Tidak ada perubahan di bagian ini'}
                                    </p>
                                    <div className="flex flex-wrap items-center justify-end gap-1">
                                        <button
                                            type="button"
                                            onClick={() => discardGroup(group)}
                                            disabled={!groupHasChanges}
                                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-brand-text-secondary hover:bg-brand-bg disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Batalkan
                                        </button>
                                    <button
                                        type="button"
                                        onClick={() => resetGroup(group)}
                                        disabled={!groupHasOverrides}
                                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-brand-text-secondary hover:bg-brand-bg disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" /> Reset grup
                                    </button>
                                        <button
                                            type="button"
                                            onClick={() => saveGroup(group)}
                                            disabled={!groupHasChanges || savingGroup !== null}
                                            className="button-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <Save className="h-3.5 w-3.5" />
                                            {savingGroup === group
                                                ? 'Menyimpan...'
                                                : lastSavedGroup === group ? 'Tersimpan' : `Simpan${groupHasChanges ? ` ${groupChangeCount} perubahan` : ''}`}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
                                    {visibleOptions.map(option => (
                                    <div key={option.key} className="space-y-2 rounded-md border border-brand-border bg-brand-bg/40 p-3 text-sm text-brand-text-secondary">
                                    <div className="flex items-center justify-between gap-2">
                                            <label htmlFor={`ui-text-${option.key}`} className="block font-medium text-brand-text-primary">{option.label}</label>
                                            <button
                                                type="button"
                                                onClick={() => resetField(option.key)}
                                                disabled={!normalizedDraft[option.key] && !normalizedSaved[option.key]}
                                                aria-label={`Reset ${option.label}`}
                                                title="Reset label ini"
                                                className="rounded p-1 text-brand-text-secondary hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                <RotateCcw className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                        <input
                                            id={`ui-text-${option.key}`}
                                            value={draft[option.key] ?? ''}
                                            onChange={event => {
                                                setDraft(current => ({ ...current, [option.key]: event.target.value }));
                                                setLastSavedGroup(null);
                                                setSaveError(null);
                                            }}
                                            placeholder="Kosongkan untuk memakai teks asli"
                                            className="input-field"
                                        />
                                        <div className="space-y-1.5 rounded border border-brand-border bg-white p-2">
                                            <p className="break-words text-xs leading-5">
                                                <span className="font-semibold text-brand-text-primary">Teks asli:</span> {option.defaultText}
                                            </p>
                                            <p aria-live="polite" className="break-words rounded-r border-l-2 border-brand-accent bg-brand-accent/5 py-1 pl-2 text-xs leading-5 text-brand-text-primary">
                                                <span className="font-semibold">Akan tampil menjadi:</span>{' '}
                                                {normalizedDraft[option.key] || option.defaultText}
                                            </p>
                                        </div>
                                </div>
                            ))}
                                </div>
                                {group === 'Dashboard' && (
                                    <p className="text-xs text-brand-text-secondary">Gunakan {'{companyName}'} pada judul untuk menampilkan nama usaha.</p>
                                )}
                            </>
                        )}
                    </details>
                );
            })}

            {normalizedSearch && !UI_TEXT_OPTIONS.some(option =>
                `${option.group} ${option.label} ${option.defaultText}`.toLocaleLowerCase('id-ID').includes(normalizedSearch),
            ) && (
                <p className="rounded-md border border-brand-border p-4 text-center text-sm text-brand-text-secondary">
                    Tidak ada label yang cocok dengan “{search}”.
                </p>
            )}

            <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 border-t border-brand-border bg-brand-surface/95 px-2 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <p role="status" className="text-xs font-medium text-brand-text-secondary">
                    {saveError || (changedKeys.length
                        ? `${changedKeys.length} perubahan belum disimpan. Simpan setiap bagian secara terpisah.`
                        : 'Tidak ada perubahan belum disimpan.')}
                </p>
            </div>
        </section>
    );
};

export default UiTextCustomizationPanel;