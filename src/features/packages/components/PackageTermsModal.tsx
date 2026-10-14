import React, { useState, useEffect, useRef } from 'react';
import { PackageTermItem, Profile } from '../../../types';
import { DEFAULT_PACKAGE_TERMS } from '../packageTerms';
import { customizeUiText, useUiTextOverrides } from '../../../utils/uiTextCustomization';
import {
    FileText,
    X,
    Plus,
    Pencil,
    Trash2,
    Copy,
    Check,
    Sparkles,
    ShieldCheck,
    Info,
    CheckCircle2
} from 'lucide-react';

interface PackageTermsModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: Profile;
    onSaveTerms: (terms: PackageTermItem[]) => Promise<void>;
    showNotification: (message: string) => void;
}

export const PackageTermsModal: React.FC<PackageTermsModalProps> = ({
    isOpen,
    onClose,
    profile,
    onSaveTerms,
    showNotification,
}) => {
    const uiTextOverrides = useUiTextOverrides();
    const text = (key: string, fallback: string) => customizeUiText(`packages.terms.${key}`, fallback, uiTextOverrides);
    const [terms, setTerms] = useState<PackageTermItem[]>([]);
    const [editingTermId, setEditingTermId] = useState<string | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formItemsText, setFormItemsText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const wasOpen = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            wasOpen.current = false;
            return;
        }
        if (wasOpen.current) return;
        wasOpen.current = true;

        if (profile.publicPageConfig?.packageTerms && profile.publicPageConfig.packageTerms.length > 0) {
            setTerms(profile.publicPageConfig.packageTerms);
        } else {
            setTerms(DEFAULT_PACKAGE_TERMS);
        }

        setEditingTermId(null);
        setErrorMsg('');
    }, [isOpen, profile.publicPageConfig]);

    if (!isOpen) return null;

    const handleStartAdd = () => {
        setEditingTermId('new');
        setFormTitle('');
        setFormItemsText('');
        setErrorMsg('');
    };

    const handleStartEdit = (term: PackageTermItem) => {
        setEditingTermId(term.id);
        setFormTitle(term.title);
        setFormItemsText(term.items.join('\n'));
        setErrorMsg('');
    };

    const handleDuplicate = (term: PackageTermItem) => {
        const newTerm: PackageTermItem = {
            id: `pt-${Date.now()}`,
            title: `${term.title} (Salinan)`,
            items: [...term.items]
        };
        setTerms(prev => [...prev, newTerm]);
        showNotification(`Kategori "${newTerm.title}" berhasil diduplikasi.`);
    };

    const handleDelete = (termId: string, title: string) => {
        if (terms.length <= 1) {
            alert('Minimal harus memiliki 1 bagian syarat & ketentuan.');
            return;
        }
        if (window.confirm(`Hapus bagian syarat & ketentuan "${title}"?`)) {
            setTerms(prev => prev.filter(t => t.id !== termId));
            if (editingTermId === termId) {
                setEditingTermId(null);
            }
            showNotification(`Bagian "${title}" berhasil dihapus.`);
        }
    };

    const handleSaveFormItem = () => {
        if (!formTitle.trim()) {
            setErrorMsg('Judul kategori syarat tidak boleh kosong.');
            return;
        }

        const lines = formItemsText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length === 0) {
            setErrorMsg('Minimal masukkan 1 butir syarat & ketentuan.');
            return;
        }

        if (editingTermId === 'new') {
            const newTerm: PackageTermItem = {
                id: `pt-${Date.now()}`,
                title: formTitle.trim(),
                items: lines
            };
            setTerms(prev => [...prev, newTerm]);
            showNotification(`Kategori "${newTerm.title}" berhasil ditambahkan.`);
        } else if (editingTermId) {
            setTerms(prev =>
                prev.map(t =>
                    t.id === editingTermId
                        ? { ...t, title: formTitle.trim(), items: lines }
                        : t
                )
            );
            showNotification(`Kategori "${formTitle.trim()}" berhasil diperbarui.`);
        }

        setEditingTermId(null);
        setErrorMsg('');
    };

    const handleCancelFormItem = () => {
        setEditingTermId(null);
        setErrorMsg('');
    };

    const handleSaveAll = async () => {
        if (terms.length === 0) {
            alert('Minimal harus ada 1 bagian syarat & ketentuan.');
            return;
        }

        setIsSaving(true);
        try {
            await onSaveTerms(terms);
            showNotification('Syarat & ketentuan paket berhasil disimpan.');
            onClose();
        } catch (err) {
            console.error('Error saving package terms:', err);
            alert('Gagal menyimpan syarat & ketentuan. Silakan coba lagi.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl border border-[#EAEFF4] shadow-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 animate-scale-up my-auto max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#EAEFF4]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#5D87FF]/15 flex items-center justify-center text-[#5D87FF]">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-base sm:text-lg text-[#2A3547]">
                                    {text('title', 'Kelola Syarat & Ketentuan Paket')}
                                </h3>
                                <span className="text-[11px] font-bold bg-[#5D87FF]/10 text-[#5D87FF] px-2 py-0.5 rounded-full">
                                    {terms.length} Kategori
                                </span>
                            </div>
                            <p className="text-xs text-[#5A6A85] mt-0.5">
                                {text('subtitle', 'Syarat & ketentuan khusus pemesanan paket pada halaman katalog publik.')}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9] transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Important Notice */}
                <div className="p-3 bg-[#5D87FF]/5 border border-[#5D87FF]/20 rounded-xl flex items-start gap-2.5 text-xs text-[#5A6A85]">
                    <Info className="w-4 h-4 text-[#5D87FF] flex-shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                        <span className="font-bold text-[#2A3547]">Pemisahan Syarat & Ketentuan:</span> Syarat di sini khusus tampil di halaman <span className="font-semibold text-[#5D87FF]">Katalog Paket Publik</span>. Untuk syarat & ketentuan yang tercantum pada lembar <span className="font-semibold text-[#2A3547]">Invoice</span> pembayaran, diatur terpisah pada menu Profil Usaha (Pengaturan).
                    </div>
                </div>

                {/* Content Body */}
                <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                    {/* If editing or adding an item */}
                    {editingTermId !== null ? (
                        <div className="bg-[#FAFBFD] p-4 sm:p-5 rounded-2xl border-2 border-[#5D87FF]/30 space-y-4 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-[#EAEFF4] pb-2.5">
                                <span className="text-xs font-bold text-[#2A3547] uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-[#5D87FF]" />
                                    {editingTermId === 'new' ? 'Tambah Kategori Syarat Baru' : 'Edit Kategori Syarat'}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCancelFormItem}
                                    className="text-xs font-semibold text-[#5A6A85] hover:text-rose-600 transition-colors"
                                >
                                    Batal
                                </button>
                            </div>

                            {errorMsg && (
                                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                                    {errorMsg}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-[#2A3547] mb-1.5 uppercase tracking-wider">
                                    Judul Kategori / Bagian Ketentuan <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    placeholder="Contoh: Ketentuan DP & Booking, Hak Cipta & Dokumentasi, Pembatalan..."
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAEFF4] bg-white focus:border-[#5D87FF] text-sm text-[#2A3547] font-medium outline-none transition-all placeholder:text-[#5A6A85]/50"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-bold text-[#2A3547] uppercase tracking-wider">
                                        Butir-butir Ketentuan (1 baris per poin) <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10px] text-[#5A6A85]">
                                        Pisahkan dengan tombol Enter
                                    </span>
                                </div>
                                <textarea
                                    value={formItemsText}
                                    onChange={(e) => setFormItemsText(e.target.value)}
                                    rows={7}
                                    placeholder={"Booking dinyatakan sah setelah pembayaran DP minimal 30%.\nTanggal acara di-lock setelah verifikasi bukti transfer.\nPelunasan selambat-lambatnya H-7 sebelum hari acara."}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAEFF4] bg-white focus:border-[#5D87FF] text-xs sm:text-sm text-[#2A3547] outline-none transition-all resize-y leading-relaxed"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAEFF4]">
                                <button
                                    type="button"
                                    onClick={handleCancelFormItem}
                                    className="px-4 py-2 rounded-xl border border-[#EAEFF4] bg-white hover:bg-[#F4F6F9] text-[#5A6A85] font-semibold text-xs transition-colors cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveFormItem}
                                    className="px-4 py-2 rounded-xl bg-[#5D87FF] hover:bg-[#4871e3] text-white font-semibold text-xs transition-all shadow-[0_4px_12px_rgba(93,135,255,0.25)] flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{text('apply', 'Terapkan Bagian Ini')}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#5A6A85] uppercase tracking-wider">
                                    {text('list', 'Daftar Kategori Syarat')} ({terms.length})
                                </span>
                                <button
                                    type="button"
                                    onClick={handleStartAdd}
                                    className="px-3 py-1.5 rounded-xl bg-[#5D87FF] hover:bg-[#4871e3] text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-[0_2px_8px_rgba(93,135,255,0.2)] cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>{text('add', 'Tambah Kategori Baru')}</span>
                                </button>
                            </div>

                            {/* Terms List */}
                            <div className="space-y-3">
                                {terms.map((t, idx) => (
                                    <div
                                        key={t.id || idx}
                                        className="bg-white rounded-xl border border-[#EAEFF4] hover:border-[#5D87FF]/40 p-3.5 sm:p-4 transition-all shadow-sm group"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1 min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="w-5 h-5 rounded-md bg-[#5D87FF]/10 text-[#5D87FF] font-bold text-xs flex items-center justify-center flex-shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    <h4 className="font-bold text-sm text-[#2A3547] truncate">
                                                        {t.title}
                                                    </h4>
                                                    <span className="text-[10px] font-semibold bg-[#F4F6F9] text-[#5A6A85] px-2 py-0.5 rounded-full border border-[#EAEFF4]">
                                                        {t.items.length} Butir
                                                    </span>
                                                </div>

                                                {/* Items Preview */}
                                                <div className="pt-2 pl-7 space-y-1">
                                                    {t.items.slice(0, 3).map((item, iIdx) => (
                                                        <div key={iIdx} className="text-xs text-[#5A6A85] flex items-center gap-1.5 truncate">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-[#13DEB9] flex-shrink-0" />
                                                            <span className="truncate">{item}</span>
                                                        </div>
                                                    ))}
                                                    {t.items.length > 3 && (
                                                        <p className="text-[10px] font-medium text-[#5D87FF] pl-5">
                                                            + {t.items.length - 3} butir lainnya
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartEdit(t)}
                                                    className="p-1.5 rounded-lg text-[#5A6A85] hover:text-[#5D87FF] hover:bg-[#5D87FF]/10 transition-colors"
                                                    title="Edit kategori syarat"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDuplicate(t)}
                                                    className="p-1.5 rounded-lg text-[#5A6A85] hover:text-[#13DEB9] hover:bg-[#13DEB9]/10 transition-colors"
                                                    title="Duplikasi kategori"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(t.id, t.title)}
                                                    className="p-1.5 rounded-lg text-[#5A6A85] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                    title="Hapus kategori"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-[#EAEFF4]">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl border border-[#EAEFF4] bg-white hover:bg-[#F4F6F9] text-[#5A6A85] font-semibold text-xs transition-colors cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveAll}
                            disabled={isSaving}
                            className="flex-1 sm:flex-initial py-2.5 px-5 rounded-xl bg-[#5D87FF] hover:bg-[#4871e3] text-white font-semibold text-xs transition-all shadow-[0_4px_12px_rgba(93,135,255,0.25)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {isSaving ? (
                                <span>Menyimpan...</span>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Simpan Semua Perubahan</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
