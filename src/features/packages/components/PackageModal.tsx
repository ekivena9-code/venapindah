import React, { useState } from 'react';
import Modal from '../../../shared/ui/Modal';
import RupiahInput from '../../../shared/form/RupiahInput';
import { REGIONS, PhysicalItem } from '../../../types';
import { 
    Info, 
    Clock, 
    CheckSquare, 
    Image as ImageIcon, 
    Plus, 
    Trash2, 
    ChevronDown, 
    Users, 
    MapPin, 
    Upload, 
    X, 
    Sparkles,
    Package as PackageIcon,
    Tag,
    DollarSign,
    Box
} from 'lucide-react';
import { customizeUiText, useUiTextOverrides } from '../../../utils/uiTextCustomization';

interface PackageModalProps {
    isOpen: boolean;
    onClose: () => void;
    formData: any;
    setFormData: React.Dispatch<React.SetStateAction<any>>;
    editMode: string | null;
    packageCategories: string[];
    unionRegions: { value: string; label: string }[];
    existingRegions: string[];
    isSubmitting: boolean;
    onSubmit: (e: React.FormEvent) => Promise<void>;
    onCoverImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export const PackageModal: React.FC<PackageModalProps> = ({
    isOpen,
    onClose,
    formData,
    setFormData,
    editMode,
    packageCategories,
    unionRegions,
    existingRegions,
    isSubmitting,
    onSubmit,
    onCoverImageUpload,
}) => {
    const uiTextOverrides = useUiTextOverrides();
    const text = (key: string, fallback: string) => customizeUiText(`packages.form.${key}`, fallback, uiTextOverrides);
    const [activeTab, setActiveTab] = useState<'basic' | 'duration' | 'deliverables' | 'cover'>('basic');
    const [expandedDurationIdx, setExpandedDurationIdx] = useState<number | null>(null);

    // Duration handlers
    const handleDurationChange = (index: number, field: string, value: any) => {
        const list = [...formData.durationOptions];
        if (field === 'default') {
            list.forEach((opt: any, i: number) => { opt.default = i === index ? Boolean(value) : false; });
        } else {
            (list[index] as any)[field] = value;
        }
        setFormData((prev: any) => ({ ...prev, durationOptions: list }));
    };

    const addDurationOption = () => {
        setFormData((prev: any) => ({
            ...prev,
            durationOptions: [
                ...(prev.durationOptions || []),
                { label: '', price: '', default: prev.durationOptions?.length === 0 }
            ]
        }));
    };

    const removeDurationOption = (index: number) => {
        const list = [...formData.durationOptions];
        list.splice(index, 1);
        const final = list.length > 0 ? list : [{ label: '', price: '', default: true }];
        if (!final.some((o: any) => o.default)) final[0].default = true;
        setFormData((prev: any) => ({ ...prev, durationOptions: final }));
        if (expandedDurationIdx === index) setExpandedDurationIdx(null);
    };

    // Digital Items
    const handleDigitalItemChange = (index: number, val: string) => {
        const list = [...formData.digitalItems];
        list[index] = val;
        setFormData((prev: any) => ({ ...prev, digitalItems: list }));
    };

    const addDigitalItem = (focusIndex?: number) => {
        setFormData((prev: any) => {
            const newList = [...prev.digitalItems, ''];
            // focus new item after state update
            setTimeout(() => {
                const inputs = document.querySelectorAll<HTMLInputElement>('.digital-item-input');
                const targetIdx = focusIndex !== undefined ? focusIndex + 1 : newList.length - 1;
                inputs[targetIdx]?.focus();
            }, 50);
            return { ...prev, digitalItems: newList };
        });
    };

    const handleDigitalItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // If last item, add new; otherwise focus next
            if (idx === formData.digitalItems.length - 1) {
                addDigitalItem(idx);
            } else {
                const inputs = document.querySelectorAll<HTMLInputElement>('.digital-item-input');
                inputs[idx + 1]?.focus();
            }
        }
        if (e.key === 'Backspace' && formData.digitalItems[idx] === '' && formData.digitalItems.length > 1) {
            e.preventDefault();
            removeDigitalItem(idx);
            setTimeout(() => {
                const inputs = document.querySelectorAll<HTMLInputElement>('.digital-item-input');
                inputs[Math.max(0, idx - 1)]?.focus();
            }, 50);
        }
    };

    const removeDigitalItem = (index: number) => {
        const list = [...formData.digitalItems];
        list.splice(index, 1);
        setFormData((prev: any) => ({ ...prev, digitalItems: list.length > 0 ? list : [''] }));
    };

    // Physical Items
    const handlePhysicalItemChange = (index: number, field: string, val: any) => {
        const list = [...formData.physicalItems];
        list[index] = { ...list[index], [field]: val };
        setFormData((prev: any) => ({ ...prev, physicalItems: list }));
    };

    const addPhysicalItem = () => {
        setFormData((prev: any) => ({ ...prev, physicalItems: [...prev.physicalItems, { name: '', price: '' }] }));
    };

    const removePhysicalItem = (index: number) => {
        const list = [...formData.physicalItems];
        list.splice(index, 1);
        setFormData((prev: any) => ({ ...prev, physicalItems: list.length > 0 ? list : [{ name: '', price: '' }] }));
    };

    const hasDurationOptions = Array.isArray(formData.durationOptions) && 
        formData.durationOptions.some((o: any) => String(o.label || '').trim() !== '' && String(o.price || '') !== '');

    const defaultDurationOption = hasDurationOptions 
        ? formData.durationOptions.find((o: any) => o.default) || formData.durationOptions[0]
        : null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editMode === 'new' ? text('title.create', 'Tambah Paket Baru') : text('title.edit', 'Edit Paket Layanan')}
            size="3xl"
        >
            <form onSubmit={onSubmit} className="space-y-4 sm:space-y-6">
                {/* ── Tabs Navigation ── */}
                <div className="flex border-b border-[#EAEFF4] gap-1 sm:gap-2 overflow-x-auto pb-1 scrollbar-none -mx-2 px-2 sm:mx-0 sm:px-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('basic')}
                        className={`min-h-[44px] flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap touch-manipulation cursor-pointer ${
                            activeTab === 'basic'
                                ? 'bg-[#5D87FF] text-white shadow-xs'
                                : 'text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9]'
                        }`}
                    >
                        <Info className="w-4 h-4" />
                        <span>{text('tab.basic', 'Informasi & Harga')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('duration')}
                        className={`min-h-[44px] flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap touch-manipulation cursor-pointer ${
                            activeTab === 'duration'
                                ? 'bg-[#5D87FF] text-white shadow-xs'
                                : 'text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9]'
                        }`}
                    >
                        <Clock className="w-4 h-4" />
                        <span>{text('tab.duration', 'Opsi Durasi')}</span>
                        {formData.durationOptions?.filter((o: any) => o.label?.trim()).length > 0 && (
                            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                                activeTab === 'duration' ? 'bg-white text-[#5D87FF]' : 'bg-[#5D87FF] text-white'
                            }`}>
                                {formData.durationOptions.filter((o: any) => o.label?.trim()).length}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('deliverables')}
                        className={`min-h-[44px] flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap touch-manipulation cursor-pointer ${
                            activeTab === 'deliverables'
                                ? 'bg-[#5D87FF] text-white shadow-xs'
                                : 'text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9]'
                        }`}
                    >
                        <CheckSquare className="w-4 h-4" />
                        <span>{text('tab.deliverables', 'Deliverables & Item')}</span>
                        {formData.digitalItems?.filter((d: string) => d.trim()).length > 0 && (
                            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                                activeTab === 'deliverables' ? 'bg-white text-[#13DEB9]' : 'bg-[#13DEB9] text-white'
                            }`}>
                                {formData.digitalItems.filter((d: string) => d.trim()).length}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('cover')}
                        className={`min-h-[44px] flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap touch-manipulation cursor-pointer ${
                            activeTab === 'cover'
                                ? 'bg-[#5D87FF] text-white shadow-xs'
                                : 'text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9]'
                        }`}
                    >
                        <ImageIcon className="w-4 h-4" />
                        <span>{text('tab.cover', 'Foto Sampul')}</span>
                        {formData.coverImage && (
                            <span className="w-2 h-2 rounded-full bg-[#13DEB9]" />
                        )}
                    </button>
                </div>

                {/* ── TAB 1: INFORMASI DASAR ── */}
                {activeTab === 'basic' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Package Name */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-[#2A3547] mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                                    <PackageIcon className="w-3.5 h-3.5 text-[#5D87FF]" />
                                    <span>{text('field.name', 'Nama Paket')}</span> <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData((p: any) => ({ ...p, name: e.target.value }))}
                                    placeholder="Contoh: Premium Wedding Documentation, Prewedding Gold..."
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] text-sm text-[#2A3547] outline-none transition-all placeholder:text-[#5A6A85]/50"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-xs font-bold text-[#2A3547] mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5 text-[#5D87FF]" />
                                    <span>{text('field.category', 'Kategori Layanan')}</span> <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    required
                                    value={formData.category}
                                    onChange={e => setFormData((p: any) => ({ ...p, category: e.target.value }))}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] text-sm text-[#2A3547] outline-none cursor-pointer transition-all"
                                >
                                    <option value="">Pilih Kategori...</option>
                                    {(packageCategories || []).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Base Price */}
                            <div>
                                <label className="block text-xs font-bold text-[#2A3547] mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                                    <DollarSign className="w-3.5 h-3.5 text-[#5D87FF]" />
                                    <span>{text('field.price', 'Harga Paket (IDR)')}</span> {!hasDurationOptions && <span className="text-rose-500">*</span>}
                                </label>
                                {hasDurationOptions ? (
                                    <div className="px-3.5 py-2.5 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] text-xs text-[#5A6A85] flex items-center justify-between">
                                        <span>Mengikuti Opsi Default:</span>
                                        <strong className="text-[#5D87FF] text-sm">
                                            {defaultDurationOption ? `${defaultDurationOption.label} (${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(defaultDurationOption.price || 0))})` : '—'}
                                        </strong>
                                    </div>
                                ) : (
                                    <RupiahInput
                                        value={formData.price.toString()}
                                        onChange={raw => setFormData((p: any) => ({ ...p, price: raw }))}
                                        placeholder="Contoh: 12.500.000"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] text-sm text-[#2A3547] outline-none font-semibold transition-all placeholder:text-[#5A6A85]/50"
                                    />
                                )}
                            </div>

                            {/* Team Composition */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-[#2A3547] mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-[#5D87FF]" />
                                    {text('field.team', 'Tim Dokumentasi')}
                                </label>
                                <input
                                    type="text"
                                    value={formData.photographers}
                                    onChange={e => setFormData((p: any) => ({ ...p, photographers: e.target.value }))}
                                    placeholder="Contoh: 2 Fotografer & 1 Videografer"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] text-sm text-[#2A3547] outline-none transition-all placeholder:text-[#5A6A85]/50"
                                />
                            </div>

                            {/* Region */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-[#2A3547] mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-[#5D87FF]" />
                                    {text('field.region', 'Wilayah Operasional (Opsional)')}
                                </label>
                                <input
                                    type="text"
                                    list="pkg-region-suggestions"
                                    value={formData.region}
                                    onChange={e => setFormData((p: any) => ({ ...p, region: e.target.value }))}
                                    placeholder="Kosongkan jika berlaku untuk semua wilayah"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] text-sm text-[#2A3547] outline-none transition-all placeholder:text-[#5A6A85]/50"
                                />
                                <datalist id="pkg-region-suggestions">
                                    {REGIONS.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </datalist>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {[...REGIONS.map(r => r.value), ...existingRegions.filter(er => !REGIONS.some(r => r.value === er))].map(val => (
                                        <button
                                            type="button"
                                            key={val}
                                            onClick={() => setFormData((p: any) => ({ ...p, region: val }))}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                                formData.region.toLowerCase() === val.toLowerCase()
                                                    ? 'bg-[#5D87FF] text-white border-[#5D87FF] shadow-sm'
                                                    : 'bg-white border-[#EAEFF4] text-[#5A6A85] hover:border-[#5D87FF]/50'
                                            }`}
                                        >
                                            {val.replace(/\b\w/g, c => c.toUpperCase())}
                                        </button>
                                    ))}
                                    {formData.region && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData((p: any) => ({ ...p, region: '' }))}
                                            className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-rose-50 border-rose-200 text-rose-600"
                                        >
                                            Kosongkan
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: OPSI DURASI ── */}
                {activeTab === 'duration' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-[#5D87FF]/5 border border-[#5D87FF]/20 rounded-xl p-3 text-xs text-[#2A3547] flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-[#5D87FF] flex-shrink-0 mt-0.5" />
                            <div>
                                <strong className="text-[#5D87FF]">Fleksibilitas Durasi Acara:</strong>
                                <p className="text-[#5A6A85] mt-0.5">
                                    Tambahkan opsi seperti 4 Jam, 8 Jam, Full Day dengan harga dan rincian berbeda. Opsi default akan menjadi harga acuan paket.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                            {formData.durationOptions?.map((opt: any, index: number) => (
                                <div key={index} className="border border-[#EAEFF4] bg-[#F4F6F9]/40 rounded-xl p-3.5 space-y-3 shadow-sm hover:border-[#5D87FF]/30 transition-all">
                                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-center">
                                        <div className="sm:col-span-2">
                                            <input
                                                type="text"
                                                value={opt.label}
                                                onChange={e => handleDurationChange(index, 'label', e.target.value)}
                                                placeholder="Label (cth: 4 Jam / Akad Only)"
                                                className="w-full px-3 py-2 rounded-xl border border-[#EAEFF4] bg-white text-xs sm:text-sm text-[#2A3547] font-semibold outline-none focus:border-[#5D87FF]"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <RupiahInput
                                                value={opt.price?.toString() || ''}
                                                onChange={raw => handleDurationChange(index, 'price', raw)}
                                                placeholder="Harga (IDR)"
                                                className="w-full px-3 py-2 rounded-xl border border-[#EAEFF4] bg-white text-xs sm:text-sm text-[#2A3547] font-semibold outline-none focus:border-[#5D87FF]"
                                            />
                                        </div>
                                        <div className="flex items-center justify-end gap-2">
                                            <label className="inline-flex items-center gap-1.5 text-xs text-[#5A6A85] font-semibold cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="pkgDurationDefault"
                                                    checked={!!opt.default}
                                                    onChange={() => handleDurationChange(index, 'default', true)}
                                                    className="text-[#5D87FF] focus:ring-0 cursor-pointer"
                                                />
                                                <span>{text('duration.default', 'Default')}</span>
                                            </label>

                                            <button
                                                type="button"
                                                onClick={() => setExpandedDurationIdx(expandedDurationIdx === index ? null : index)}
                                                className="p-1.5 rounded-lg bg-white border border-[#EAEFF4] text-[#5D87FF] hover:bg-[#5D87FF]/10 transition-colors"
                                                title="Detail Opsi"
                                            >
                                                <ChevronDown className={`w-4 h-4 transition-transform ${expandedDurationIdx === index ? 'rotate-180' : ''}`} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => removeDurationOption(index)}
                                                className="p-1.5 rounded-lg bg-white border border-[#EAEFF4] text-rose-500 hover:bg-rose-50 transition-colors"
                                                title="Hapus Opsi"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Detail per Duration */}
                                    {expandedDurationIdx === index && (
                                        <div className="p-3 bg-white rounded-xl border border-[#EAEFF4] space-y-3 animate-fade-in text-xs">
                                            <p className="font-bold text-[#5D87FF]">Detail Khusus Opsi "{opt.label || `Opsi ${index + 1}`}"</p>
                                            
                                            <div>
                                                <label className="block font-semibold text-[#5A6A85] mb-1">Jumlah Tim Khusus (Opsional)</label>
                                                <input
                                                    type="text"
                                                    value={opt.photographers || ''}
                                                    onChange={e => handleDurationChange(index, 'photographers', e.target.value)}
                                                    placeholder="Contoh: 1 Fotografer saja"
                                                    className="w-full px-3 py-2 rounded-lg border border-[#EAEFF4] bg-[#F4F6F9] outline-none focus:bg-white focus:border-[#5D87FF]"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={addDurationOption}
                            className="w-full py-2.5 border-2 border-dashed border-[#5D87FF]/30 hover:border-[#5D87FF] rounded-xl text-[#5D87FF] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            <span>{text('duration.add', 'Tambah Opsi Durasi Baru')}</span>
                        </button>
                    </div>
                )}

                {/* ── TAB 3: DELIVERABLES & VENDOR ── */}
                {activeTab === 'deliverables' && (
                    <div className="space-y-6 animate-fade-in max-h-[50vh] overflow-y-auto pr-1">
                        {/* Digital Deliverables */}
                        <div className="space-y-3">
                            <div>
                                    <h4 className="font-bold text-sm text-[#2A3547]">{text('deliverables.title', 'Deliverables & Layanan Digital')}</h4>
                                <p className="text-xs text-[#5A6A85] mt-0.5">
                                    Daftar file atau hasil akhir yang akan diterima pengantin.{' '}
                                    <span className="text-[#13DEB9] font-medium">Satu baris = satu item.</span>
                                </p>
                            </div>
                            <textarea
                                rows={6}
                                value={(formData.digitalItems || []).join('\n')}
                                onChange={e => {
                                    const lines = e.target.value.split('\n');
                                    setFormData((prev: any) => ({ ...prev, digitalItems: lines }));
                                }}
                                placeholder={`Semua file foto edit warna\nVideo Teaser 1 Menit\nVideo Full Highlight\nFlashdisk 64GB`}
                                className="w-full px-4 py-3 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#13DEB9] focus:shadow-[0_0_0_3px_rgba(19,222,185,0.12)] text-xs sm:text-sm text-[#2A3547] outline-none transition-all resize-none leading-relaxed"
                            />
                        </div>

                        {/* Physical / Vendor Items */}
                        <div className="pt-4 border-t border-[#EAEFF4] space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-sm text-[#2A3547]">{text('physical.title', 'Vendor / Allpackage & Fisik')}</h4>
                                    <p className="text-xs text-[#5A6A85]">Item cetak fisik, album, atau vendor rekanan jika paket all-in.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addPhysicalItem}
                                    className="py-1 px-3 rounded-lg bg-[#5D87FF]/10 text-[#5D87FF] hover:bg-[#5D87FF]/20 font-semibold text-xs flex items-center gap-1 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Tambah Vendor</span>
                                </button>
                            </div>

                            <div className="space-y-2">
                                {formData.physicalItems?.map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-[#5D87FF]/10 text-[#5D87FF] flex items-center justify-center flex-shrink-0">
                                            <Box className="w-3.5 h-3.5" />
                                        </div>
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={e => handlePhysicalItemChange(idx, 'name', e.target.value)}
                                            placeholder="Contoh: Album Magazine 20x30, Cetak Canvas 40x60, Vendor MUA..."
                                            className="flex-1 px-3.5 py-2 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] text-xs sm:text-sm text-[#2A3547] outline-none transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removePhysicalItem(idx)}
                                            className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"
                                            title="Hapus"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 4: COVER IMAGE ── */}
                {activeTab === 'cover' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="border-2 border-dashed border-[#EAEFF4] rounded-2xl p-6 text-center bg-[#F4F6F9]/50 hover:bg-[#F4F6F9] transition-all relative">
                            {formData.coverImage ? (
                                <div className="space-y-3">
                                    <img
                                        src={formData.coverImage}
                                        alt="Cover preview"
                                        className="h-48 w-full max-w-md mx-auto object-cover rounded-xl shadow-md border border-white"
                                    />
                                    <div className="flex justify-center gap-2">
                                        <label className="cursor-pointer py-2 px-4 rounded-xl bg-[#5D87FF] text-white font-semibold text-xs hover:bg-[#4871e3] transition-colors shadow-sm inline-flex items-center gap-1.5">
                                            <Upload className="w-4 h-4" />
                                            <span>Ganti Foto Sampul</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={onCoverImageUpload}
                                                className="hidden"
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setFormData((p: any) => ({ ...p, coverImage: '' }))}
                                            className="py-2 px-4 rounded-xl border border-[#EAEFF4] bg-white text-rose-600 font-semibold text-xs hover:bg-rose-50 transition-colors inline-flex items-center gap-1.5"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span>Hapus Foto</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3 py-6">
                                    <div className="w-16 h-16 rounded-2xl bg-white border border-[#EAEFF4] shadow-sm flex items-center justify-center mx-auto text-[#5D87FF]">
                                        <ImageIcon className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-[#2A3547]">{text('cover.upload', 'Unggah Foto Sampul Paket')}</p>
                                        <p className="text-xs text-[#5A6A85] mt-1">
                                            Pilih gambar portrait/landscape menarik berukuran maksimal 2MB.
                                        </p>
                                    </div>
                                    <label className="cursor-pointer inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-[#5D87FF] hover:bg-[#4871e3] text-white font-semibold text-xs transition-all shadow-[0_4px_12px_rgba(93,135,255,0.25)]">
                                        <Upload className="w-4 h-4" />
                                        <span>Pilih File Gambar</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={onCoverImageUpload}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Modal Footer ── */}
                <div className="grid grid-cols-2 gap-2.5 pt-3 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:pt-4 border-t border-[#EAEFF4]">
                    <div className="contents sm:flex sm:items-center sm:gap-2">
                        {activeTab !== 'basic' && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeTab === 'cover') setActiveTab('deliverables');
                                    else if (activeTab === 'deliverables') setActiveTab('duration');
                                    else if (activeTab === 'duration') setActiveTab('basic');
                                }}
                                className={`${activeTab === 'cover' ? 'col-span-2' : 'col-span-1'} min-h-[38px] sm:min-h-[44px] flex-1 sm:flex-initial py-1.5 px-2 sm:px-3 rounded-xl border border-[#EAEFF4] text-xs font-semibold text-[#5A6A85] hover:bg-[#F4F6F9] touch-manipulation cursor-pointer text-center`}
                            >
                                Kembali
                            </button>
                        )}
                        {activeTab !== 'cover' && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeTab === 'basic') setActiveTab('duration');
                                    else if (activeTab === 'duration') setActiveTab('deliverables');
                                    else if (activeTab === 'deliverables') setActiveTab('cover');
                                }}
                                className={`${activeTab === 'basic' ? 'col-span-2' : 'col-span-1'} min-h-[38px] sm:min-h-[44px] flex-1 sm:flex-initial py-1.5 px-2 sm:px-3 rounded-xl bg-[#F4F6F9] text-xs font-semibold text-[#2A3547] hover:bg-[#EAEFF4] touch-manipulation cursor-pointer text-center`}
                            >
                                Selanjutnya
                            </button>
                        )}
                    </div>

                    <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-[38px] sm:min-h-[44px] flex-1 sm:flex-initial py-2 px-3 sm:px-4 rounded-xl border border-[#EAEFF4] bg-white hover:bg-[#F4F6F9] text-[#5A6A85] font-semibold text-xs transition-colors touch-manipulation cursor-pointer text-center"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="min-h-[38px] sm:min-h-[44px] flex-1 sm:flex-initial py-2 px-3 sm:px-5 rounded-xl bg-[#5D87FF] hover:bg-[#4871e3] text-white font-semibold text-xs transition-all shadow-[0_4px_12px_rgba(93,135,255,0.25)] touch-manipulation cursor-pointer text-center disabled:opacity-60"
                        >
                            {isSubmitting ? 'Menyimpan...' : editMode === 'new' ? 'Simpan Paket' : 'Perbarui Paket'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};
