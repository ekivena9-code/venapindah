import React, { useState, useMemo, useEffect } from 'react';
import { Kanban, Table, SlidersHorizontal, ChevronDown, ChevronUp, X, Copy, ExternalLink, Check, Package as PackageIconLucide, MapPin } from 'lucide-react';
import { MobileCollapsibleSection } from '../../components/ui/MobileProgressiveDisclosure';

// Helper function to escape special regex characters
const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};
import { Lead, LeadStatus, Client, ClientStatus, Project, Package, AddOn, Transaction, TransactionType, PaymentStatus, Profile, Card, FinancialPocket, ContactChannel, PromoCode, ClientType, ViewType, NavigationAction, Gallery, REGIONS } from '../../types';

import Modal from '../../shared/ui/Modal';
import RupiahInput from '../../shared/form/RupiahInput';
import { PlusIcon, PencilIcon, Trash2Icon, Share2Icon, DownloadIcon, SendIcon, UsersIcon, TargetIcon, TrendingUpIcon, CalendarIcon, MapPinIcon, QrCodeIcon, MessageSquareIcon, CameraIcon, FileTextIcon, PhoneIncomingIcon, LightbulbIcon, ChevronRightIcon, CheckCircleIcon, EyeIcon, LinkIcon, WhatsappIcon } from '../../constants';
import { ModernStatCard } from '../../components/modernize/ModernStatCard';
import { cleanPhoneNumber } from '../../constants';
import { listLeads as _listLeads, createLead as createLeadRow, updateLead as updateLeadRow, deleteLead as deleteLeadRow } from '../../services/leads';
import { createClient as createClientRow } from '../../services/clients';
import { createProject as createProjectRow } from '../../services/projects';
import { createTransaction as createTransactionRow, updateCardBalance } from '../../services/transactions';
import { findCardIdByMeta } from '../../services/cards';
import { upsertProfile } from '../../services/profile';
import { listGalleries } from '../../services/galleries';
import { buildPublicShareUrl, getGalleryPublicRouteId, toPublicNameSlug } from '../../utils/publicRouting';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

const getContactChannelIcon = (channel: ContactChannel) => {
    const iconProps = { className: "w-4 h-4" };
    switch (channel) {
        case ContactChannel.WHATSAPP: return <WhatsappIcon {...iconProps} />;
        case ContactChannel.INSTAGRAM: return <CameraIcon {...iconProps} />;
        case ContactChannel.WEBSITE: return <FileTextIcon {...iconProps} />;
        case ContactChannel.PHONE: return <PhoneIncomingIcon {...iconProps} />;
        case ContactChannel.REFERRAL: return <Share2Icon {...iconProps} />;
        case ContactChannel.SUGGESTION_FORM: return <WhatsappIcon {...iconProps} />;
        default: return <LightbulbIcon {...iconProps} />;
    }
};

const getDaysSince = (dateString: string) => {
    const leadDate = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - leadDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Hari ini';
    if (diffDays === 2) return 'Kemarin';
    return `${diffDays} hari lalu`;
};

const sourceColors: { [key in ContactChannel]?: string } = {
    [ContactChannel.INSTAGRAM]: '#c13584', [ContactChannel.WHATSAPP]: '#25D366',
    [ContactChannel.WEBSITE]: '#3b82f6', [ContactChannel.REFERRAL]: '#f59e0b',
    [ContactChannel.PHONE]: '#8b5cf6', [ContactChannel.SUGGESTION_FORM]: '#14b8a6',
    [ContactChannel.OTHER]: '#64748b'
};

const statusConfig: Record<LeadStatus, { color: string, softBg: string, badgeClass: string, title: string, surface: string, border: string }> = {
    [LeadStatus.DISCUSSION]: {
        color: '#3563E9',
        softBg: '#ECF2FF',
        badgeClass: 'bg-[#ECF2FF] text-[#2348C7] border border-[#CFE0FF]',
        title: 'Diskusi',
        surface: '#F7FAFF',
        border: '#D9E5FF',
    },
    [LeadStatus.FOLLOW_UP]: {
        color: '#8B5CF6',
        softBg: '#F3E8FF',
        badgeClass: 'bg-[#F3E8FF] text-[#6F38D9] border border-[#E2D0FF]',
        title: 'Follow Up',
        surface: '#FAF7FF',
        border: '#E7D8FF',
    },
    [LeadStatus.CONVERTED]: {
        color: '#14A76C',
        softBg: '#EAFBF2',
        badgeClass: 'bg-[#EAFBF2] text-[#0F8C5A] border border-[#CDEEDC]',
        title: 'Dikonversi',
        surface: '#F5FFF9',
        border: '#D2F0E0',
    },
    [LeadStatus.REJECTED]: {
        color: '#EA5A47',
        softBg: '#FCECEC',
        badgeClass: 'bg-[#FCECEC] text-[#C63F31] border border-[#F7C8C8]',
        title: 'Ditolak',
        surface: '#FFF9F8',
        border: '#F7D0CC',
    },
};

// --- Form Components ---

interface LeadFormProps {
    formData: any;
    handleFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    handleSubmit: (e: React.FormEvent) => void;
    handleCloseModal: () => void;
    modalMode: 'add' | 'edit';
    isSubmitting?: boolean;
}

const LeadForm: React.FC<LeadFormProps> = ({ formData, handleFormChange, handleSubmit, handleCloseModal, modalMode, isSubmitting = false }) => {
    return (
        <form onSubmit={handleSubmit} className="space-y-4 form-compact form-compact--ios-scale">
            <div className="hidden sm:block bg-blue-100 border border-blue-600 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <LightbulbIcon className="w-4 h-4" />
                    Informasi Calon Pengantin
                </h4>
                <p className="text-xs text-brand-text-secondary">
                    Catat informasi Calon Pengantin baru yang menghubungi Anda. Data ini akan membantu Anda melacak dan mengelola calon pengantin.
                </p>
            </div>

            <div>
                <h5 className="text-sm font-semibold text-brand-text-light mb-3">Data Calon Pengantin</h5>
                <div className="input-group">
                    <input type="text" id="name" name="name" value={formData.name} onChange={handleFormChange} className="input-field" placeholder=" " required />
                    <label htmlFor="name" className="input-label">Nama Calon Pengantin</label>
                    <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Nama lengkap pasangan calon pengantin</p>
                </div>
            </div>

            <div>
                <h5 className="text-sm font-semibold text-brand-text-light mb-3">Sumber &amp; Lokasi</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="input-group">
                        <select id="contactChannel" name="contactChannel" value={formData.contactChannel} onChange={handleFormChange} className="input-field">
                            {Object.values(ContactChannel).map(channel => <option key={channel} value={channel}>{channel}</option>)}
                        </select>
                        <label htmlFor="contactChannel" className="input-label">Sumber Calon Pengantin</label>
                        <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Dari mana Calon Pengantin menghubungi?</p>
                    </div>
                    <div className="input-group">
                        <input type="text" id="location" name="location" value={formData.location} onChange={handleFormChange} className="input-field" placeholder=" " />
                        <label htmlFor="location" className="input-label">Lokasi (Kota)</label>
                        <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Kota domisili Calon Pengantin</p>
                    </div>
                </div>
            </div>

            <div>
                <h5 className="text-sm font-semibold text-brand-text-light mb-3">Alamat Lengkap</h5>
                <div className="input-group">
                    <textarea id="address" name="address" value={formData.address} onChange={handleFormChange} className="input-field" placeholder=" " rows={3}></textarea>
                    <label htmlFor="address" className="input-label">Alamat Lengkap / Gedung</label>
                    <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Alamat spesifik untuk Acara Pernikahan</p>
                </div>
            </div>

            <div>
                <h5 className="text-sm font-semibold text-brand-text-light mb-3">Kontak</h5>
                <div className="input-group">
                    <input type="tel" id="whatsapp" name="whatsapp" value={formData.whatsapp} onChange={handleFormChange} className="input-field" placeholder=" " />
                    <label htmlFor="whatsapp" className="input-label">No. WhatsApp</label>
                    <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Nomor WhatsApp aktif untuk komunikasi</p>
                </div>
            </div>

            <div>
                <h5 className="text-sm font-semibold text-brand-text-light mb-3">Tanggal Acara <span className="text-brand-text-secondary font-normal">(Opsional)</span></h5>
                <div className="input-group">
                    <input type="date" id="eventDate" name="eventDate" value={formData.eventDate || ''} onChange={handleFormChange} className="input-field" placeholder=" " aria-label="Tanggal acara (opsional)" />
                    <label htmlFor="eventDate" className="input-label">Tanggal Acara Pernikahan</label>
                    <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Bisa dikosongkan jika belum ada tanggal pasti dari client.</p>
                </div>
            </div>

            <div>
                <h5 className="text-sm font-semibold text-brand-text-light mb-3">Catatan Tambahan</h5>
                <div className="input-group">
                    <textarea id="notes" name="notes" value={formData.notes} onChange={handleFormChange} className="input-field" placeholder=" " rows={4}></textarea>
                    <label htmlFor="notes" className="input-label">Catatan</label>
                    <p className="text-xs text-brand-text-secondary mt-1">Catat kebutuhan, preferensi, atau informasi penting lainnya dan tanggal acaranya</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-brand-border sticky bottom-0 bg-brand-surface">
                <button type="button" onClick={handleCloseModal} className="button-secondary w-full sm:w-auto">Batal</button>
                <button type="submit" disabled={isSubmitting} className="button-primary w-full sm:w-auto">{isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan Calon Pengantin' : 'Update Calon Pengantin')}</button>
            </div>
        </form>
    );
};

interface ConvertLeadFormProps {
    formData: any;
    setFormData: React.Dispatch<React.SetStateAction<any>>;
    handleFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    handleSubmit: (e: React.FormEvent) => void;
    handleCloseModal: () => void;
    packages: Package[];
    addOns: AddOn[];
    userProfile: Profile;
    cards: Card[];
    promoCodes: PromoCode[];
    isSubmitting?: boolean;
}

const ConvertLeadForm: React.FC<ConvertLeadFormProps> = ({ formData, setFormData, handleFormChange, handleSubmit, handleCloseModal, packages, addOns, userProfile, cards, promoCodes, isSubmitting = false }) => {
    const priceCalculations = useMemo(() => {
        const selectedPackage = packages.find(p => p.id === formData.packageId);
        const packagePrice = selectedPackage?.price || 0;

        const addOnsPrice = addOns
            .filter(addon => formData.selectedAddOnIds.includes(addon.id))
            .reduce((sum, addon) => sum + addon.price, 0);

        let totalProjectBeforeDiscount = packagePrice + addOnsPrice;
        let discountAmount = 0;
        let discountApplied = 'N/A';
        const promoCode = promoCodes.find(p => p.id === formData.promoCodeId);

        if (promoCode) {
            if (promoCode.discountType === 'percentage') {
                discountAmount = (totalProjectBeforeDiscount * promoCode.discountValue) / 100;
                discountApplied = `${promoCode.discountValue}%`;
            } else { // fixed
                discountAmount = promoCode.discountValue;
                discountApplied = formatCurrency(promoCode.discountValue);
            }
        }

        const totalProject = totalProjectBeforeDiscount - discountAmount;
        const remainingPayment = totalProject - Number(formData.dp);

        return { packagePrice, addOnsPrice, totalProject, remainingPayment, discountAmount, discountApplied };
    }, [formData.packageId, formData.selectedAddOnIds, formData.dp, formData.promoCodeId, packages, addOns, promoCodes]);

    return (
        <form onSubmit={handleSubmit} className="form-compact form-compact--ios-scale">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2">
                {/* Left Column: Client & Project Info */}
                <div className="space-y-4">
                    <h4 className="text-base font-semibold text-gradient border-b border-brand-border pb-2">Informasi Pengantin</h4>
                    <div className="input-group"><input type="text" id="clientName" name="clientName" value={formData.clientName} onChange={handleFormChange} className="input-field" placeholder=" " required /><label htmlFor="clientName" className="input-label">Nama Pengantin</label></div>
                    <div className="input-group">
                        <select id="clientType" name="clientType" value={formData.clientType} onChange={handleFormChange} className="input-field" required>
                            {Object.values(ClientType).map(ct => <option key={ct} value={ct}>{ct}</option>)}
                        </select>
                        <label htmlFor="clientType" className="input-label">Jenis Pengantin</label>
                    </div>
                    <div className="input-group"><input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleFormChange} className="input-field" placeholder=" " required /><label htmlFor="phone" className="input-label">Nomor Telepon</label></div>
                    <div className="input-group"><input type="tel" id="whatsapp" name="whatsapp" value={formData.whatsapp || ''} onChange={handleFormChange} className="input-field" placeholder=" " /><label htmlFor="whatsapp" className="input-label">No. WhatsApp</label></div>
                    <div className="input-group"><input type="email" id="email" name="email" value={formData.email} onChange={handleFormChange} className="input-field" placeholder=" " required /><label htmlFor="email" className="input-label">Email</label></div>
                    <div className="input-group"><input type="text" id="instagram" name="instagram" value={formData.instagram} onChange={handleFormChange} className="input-field" placeholder=" " /><label htmlFor="instagram" className="input-label">Instagram (@username)</label></div>

                    <h4 className="text-base font-semibold text-gradient border-b border-brand-border pb-2 pt-4">Informasi Acara Pernikahan</h4>
                    <div className="input-group"><input type="text" id="projectName" name="projectName" value={formData.projectName} onChange={handleFormChange} className="input-field" placeholder=" " required /><label htmlFor="projectName" className="input-label">Nama Acara Pernikahan</label></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="input-group"><select id="projectType" name="projectType" value={formData.projectType} onChange={handleFormChange} className="input-field" required><option value="" disabled>Pilih Jenis...</option>{userProfile.projectTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}</select><label htmlFor="projectType" className="input-label">Jenis Acara Pernikahan</label></div>
                        <div className="input-group"><input type="date" id="date" name="date" value={formData.date} onChange={handleFormChange} className="input-field" placeholder=" " /><label htmlFor="date" className="input-label">Tanggal Acara Pernikahan</label></div>
                    </div>
                    <div className="input-group"><input type="text" id="location" name="location" value={formData.location} onChange={handleFormChange} className="input-field" placeholder=" " /><label htmlFor="location" className="input-label">Lokasi (Kota)</label></div>
                    <div className="input-group"><textarea id="address" name="address" value={formData.address} onChange={handleFormChange} className="input-field" placeholder=" " rows={2}></textarea><label htmlFor="address" className="input-label">Alamat Lengkap</label></div>
                </div>

                {/* Right Column: Financial & Other Info */}
                <div className="space-y-4">
                    <h4 className="text-base font-semibold text-gradient border-b border-brand-border pb-2">Detail Package & Pembayaran</h4>
                    <div className="input-group">
                        <select id="packageId" name="packageId" value={formData.packageId} onChange={handleFormChange} className="input-field" required>
                            <option value="">Pilih Package...</option>
                            {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <label htmlFor="packageId" className="input-label">Package</label>
                        <p className="text-right text-xs text-brand-text-secondary mt-1">Harga Package: {formatCurrency(priceCalculations.packagePrice)}</p>
                    </div>

                    <div className="input-group">
                        <label className="input-label !static !-top-4 !text-brand-accent">Add-On</label>
                        <div className="p-3 border border-brand-border bg-brand-bg rounded-lg max-h-32 overflow-y-auto space-y-2 mt-2">
                            {addOns.map(addon => (
                                <label key={addon.id} className="flex items-center justify-between p-2 rounded-md hover:bg-brand-input cursor-pointer">
                                    <span className="text-sm text-brand-text-primary">{addon.name}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-brand-text-secondary">{formatCurrency(addon.price)}</span>
                                        <input type="checkbox" id={addon.id} name="addOns" checked={formData.selectedAddOnIds.includes(addon.id)} onChange={handleFormChange} className="h-4 w-4 rounded flex-shrink-0 text-blue-600 focus:ring-blue-600 transition-colors" />
                                    </div>
                                </label>
                            ))}
                        </div>
                        <p className="text-right text-xs text-brand-text-secondary mt-1">Total Harga Add-On: {formatCurrency(priceCalculations.addOnsPrice)}</p>
                    </div>

                    <div className="input-group">
                        <select id="promoCodeId" name="promoCodeId" value={formData.promoCodeId} onChange={handleFormChange} className="input-field">
                            <option value="">Tanpa Kode Promo</option>
                            {promoCodes.filter(p => p.isActive).map(p => (
                                <option key={p.id} value={p.id}>{p.code} - ({p.discountType === 'percentage' ? `${p.discountValue}%` : formatCurrency(p.discountValue)})</option>
                            ))}
                        </select>
                        <label htmlFor="promoCodeId" className="input-label">Kode Promo</label>
                        {formData.promoCodeId && <p className="text-right text-xs text-brand-success mt-1">Diskon Diterapkan: {priceCalculations.discountApplied}</p>}
                    </div>

                    <div className="p-4 bg-brand-bg rounded-lg space-y-3">
                        <div className="flex justify-between items-center font-bold text-lg"><span className="text-brand-text-secondary">Total Acara Pernikahan</span><span className="text-brand-text-light">{formatCurrency(priceCalculations.totalProject)}</span></div>
                        <div className="input-group !mt-2">
                            <RupiahInput
                                id="dp"
                                name="dp"
                                value={String(formData.dp ?? '')}
                                onChange={(raw) => setFormData((prev: any) => ({ ...prev, dp: raw }))}
                                className="input-field text-right"
                                placeholder=" "
                            />
                            <label htmlFor="dp" className="input-label">Uang DP</label>
                        </div>
                        {Number(formData.dp) > 0 && (
                            <div className="input-group !mt-2">
                                <select name="dpDestinationCardId" value={formData.dpDestinationCardId} onChange={handleFormChange} className="input-field" required>
                                    <option value="">Setor DP ke...</option>
                                    {cards.map(c => <option key={c.id} value={c.id}>{c.bankName} {c.lastFourDigits !== 'CASH' ? `**** ${c.lastFourDigits}` : '(Tunai)'}</option>)}
                                </select>
                                <label htmlFor="dpDestinationCardId" className="input-label">Kartu Tujuan</label>
                            </div>
                        )}
                        <hr className="border-brand-border" />
                        <div className="flex justify-between items-center font-bold text-lg"><span className="text-brand-text-secondary">Sisa Pembayaran</span><span className="text-blue-800">{formatCurrency(priceCalculations.remainingPayment)}</span></div>
                    </div>

                    <h4 className="text-base font-semibold text-gradient border-b border-brand-border pb-2 pt-4">Lainnya (Opsional)</h4>
                    <div className="input-group"><textarea id="notes" name="notes" value={formData.notes} onChange={handleFormChange} className="input-field" placeholder=" "></textarea><label htmlFor="notes" className="input-label">Catatan Tambahan</label></div>
                </div>
            </div>

            <div className="flex justify-end items-center gap-3 pt-8 mt-8 border-t border-brand-border sticky bottom-0 bg-brand-surface">
                <button type="button" onClick={handleCloseModal} className="button-secondary">Batal</button>
                <button type="submit" disabled={isSubmitting} className="button-primary">{isSubmitting ? 'Menyimpan...' : 'Konversi Calon Pengantin'}</button>
            </div>
        </form>
    );
};


// --- SUB-COMPONENTS ---

const LeadCard: React.FC<{
    lead: Lead;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, leadId: string) => void;
    onClick: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onNextStatus: () => void;
    onMoveStatus: (newStatus: LeadStatus) => void;
    onShare: (type: 'package' | 'booking') => void;
}> = ({ lead, onDragStart, onEdit, onDelete, onNextStatus, onMoveStatus, onShare }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

    const formattedInputDate = useMemo(() => {
        try {
            if (!lead.date) return 'Baru';
            return new Date(lead.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return lead.date || 'Baru';
        }
    }, [lead.date]);

    const daysSince = useMemo(() => {
        try {
            return getDaysSince(lead.date);
        } catch {
            return '';
        }
    }, [lead.date]);

    const renderActions = () => {
        if (lead.status === LeadStatus.DISCUSSION) {
            return (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onShare('package'); }}
                        className="btn-box-wa text-xs px-2.5 py-1.5 inline-flex items-center gap-1.5 cursor-pointer"
                        title="Bagikan Package via WA"
                    >
                        <WhatsappIcon className="w-3.5 h-3.5 flex-shrink-0 text-white" />
                        <span>Package WA</span>
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onMoveStatus(LeadStatus.FOLLOW_UP); }}
                        className="btn-box-read text-xs px-3 py-1.5 inline-flex items-center gap-1 font-semibold cursor-pointer"
                        title="Pindah ke Follow Up"
                    >
                        <span>Follow Up</span>
                        <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0 text-white" />
                    </button>
                </div>
            );
        }
        if (lead.status === LeadStatus.FOLLOW_UP) {
            return (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onShare('booking'); }}
                        className="btn-box-wa text-xs px-2.5 py-1.5 inline-flex items-center gap-1.5 cursor-pointer"
                        title="Kirim Form Booking via WA"
                    >
                        <WhatsappIcon className="w-3.5 h-3.5 flex-shrink-0 text-white" />
                        <span>Form WA</span>
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onMoveStatus(LeadStatus.CONVERTED); }}
                        className="btn-box-add text-xs px-3 py-1.5 inline-flex items-center gap-1 font-semibold cursor-pointer"
                        title="Konversi ke Pengantin"
                    >
                        <span>Konversi</span>
                        <CheckCircleIcon className="w-3.5 h-3.5 flex-shrink-0 text-white" />
                    </button>
                </div>
            );
        }
        return null;
    };

    return (
        <div
            draggable
            onDragStart={e => onDragStart(e, lead.id)}
            className="group rounded-xl border border-brand-border bg-white shadow-sm transition-all hover:shadow-md leads-card select-none overflow-hidden"
        >
            {/* --- COMPACT ROW (Hanya Foto, Nama, Waktu Input, dan Tombol Detail) --- */}
            <div className="p-2 sm:p-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Foto / Avatar Inisial */}
                    <div
                        className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-lg text-[11px] font-bold shrink-0 shadow-2xs border text-white"
                        style={{ backgroundColor: statusConfig[lead.status].color, borderColor: statusConfig[lead.status].border }}
                    >
                        {getInitials(lead.name)}
                    </div>

                    {/* Nama dan Waktu Input */}
                    <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs sm:text-[13px] text-[#2A3547] truncate leading-snug">{lead.name}</p>
                        <div className="flex items-center gap-1 text-[10px] text-[#5A6A85] mt-0.5 min-w-0">
                            <CalendarIcon className="w-3 h-3 text-[#5D87FF] shrink-0" />
                            <span className="truncate">{formattedInputDate} {daysSince ? `(${daysSince})` : ''}</span>
                        </div>
                    </div>
                </div>

                {/* Tombol Detail */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                        isExpanded
                            ? 'bg-[#3563E9] text-white shadow-xs'
                            : 'bg-[#EEF2F6] text-[#3563E9] hover:bg-[#3563E9] hover:text-white'
                    }`}
                    title={isExpanded ? 'Tutup Detail' : 'Lihat Detail'}
                >
                    <span>{isExpanded ? 'Tutup' : 'Detail'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* --- DETAIL CARD (Muncul saat tombol Detail diklik) --- */}
            {isExpanded && (
                <div className="px-4 pb-4 pt-3 border-t border-brand-border space-y-3 animate-fadeIn bg-slate-50/50">
                    {/* Header Action: Status Badge, Edit, dan Hapus */}
                    <div className="flex items-center justify-between pt-0.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${statusConfig[lead.status].badgeClass}`}>
                            {statusConfig[lead.status].title}
                        </span>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#D8E1F0] bg-white text-xs font-medium text-[#42526B] shadow-2xs hover:border-[#BFD1F9] hover:text-[#2348C7] transition-colors cursor-pointer"
                                title="Edit Detail"
                            >
                                <PencilIcon className="w-3.5 h-3.5" />
                                <span>Edit</span>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="inline-flex items-center justify-center h-6.5 w-6.5 rounded-md bg-[#EA5A47] text-white shadow-2xs hover:bg-[#D94F3C] transition-colors cursor-pointer"
                                title="Hapus Calon Pengantin"
                            >
                                <Trash2Icon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* PEMINDAHAN ANTAR CARD / STATUS (RESPONSIF MOBILE & DESKTOP) */}
                    <div className="p-2 rounded-xl bg-white border border-[#EAEFF4] space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-[10px] font-bold text-[#5A6A85] uppercase tracking-wider">
                            <span>Pindahkan Status:</span>
                            <span className="text-[#3563E9] font-semibold lowercase">klik untuk pindah</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {Object.values(LeadStatus).map((st) => {
                                const conf = statusConfig[st];
                                const isCurrent = lead.status === st;
                                return (
                                    <button
                                        key={st}
                                        type="button"
                                        disabled={isCurrent}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMoveStatus(st);
                                        }}
                                        className={`px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                                            isCurrent
                                                ? 'ring-2 ring-offset-1 opacity-90 cursor-default'
                                                : 'cursor-pointer hover:shadow-xs active:scale-95'
                                        }`}
                                        style={{
                                            backgroundColor: isCurrent ? conf.color : conf.softBg,
                                            color: isCurrent ? '#ffffff' : conf.color,
                                            borderColor: conf.border,
                                            borderWidth: 1,
                                            ringColor: conf.color,
                                        }}
                                        title={isCurrent ? `Status saat ini: ${conf.title}` : `Pindahkan ke ${conf.title}`}
                                    >
                                        {isCurrent ? (
                                            <CheckCircleIcon className="w-3.5 h-3.5 text-white shrink-0" />
                                        ) : null}
                                        <span>{conf.title}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Informasi Lengkap Calon Pengantin */}
                    <div className="space-y-3 text-xs text-[#42526B] bg-white rounded-xl p-3 border border-[#EAEFF4] shadow-sm">
                        <h5 className="font-bold text-[#111827] border-b border-slate-100 pb-1.5 mb-2">Informasi Pengantin</h5>
                        {lead.location && (
                            <div className="flex items-start gap-2">
                                <MapPinIcon className="w-3.5 h-3.5 text-[#6B7280] shrink-0 mt-0.5" />
                                <span className="font-medium text-[#2A3547]">{lead.location}</span>
                            </div>
                        )}

                        {lead.eventDate && (
                            <div className="flex items-start gap-2">
                                <CalendarIcon className="w-3.5 h-3.5 text-[#5D87FF] shrink-0 mt-0.5" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-semibold text-[#6B7280] uppercase">Tanggal Acara</span>
                                    <span className="font-semibold text-[#2A3547]">{new Date(lead.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                </div>
                            </div>
                        )}

                        {lead.whatsapp && (
                            <div className="flex items-center justify-between gap-1.5 pt-0.5">
                                <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-green-600 shrink-0">
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.884 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                    </span>
                                    <span className="truncate">{lead.whatsapp}</span>
                                </div>
                                <a
                                    href={`https://wa.me/${cleanPhoneNumber(lead.whatsapp)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="btn-box-wa px-2 py-0.5 text-[10px] rounded-md font-semibold inline-flex items-center gap-1 shrink-0"
                                    title="Chat Langsung via WA"
                                >
                                    <span>Chat</span>
                                </a>
                            </div>
                        )}

                        {lead.address && (
                            <div className="pt-1.5 border-t border-slate-100 text-[11px] text-[#5A6A85]">
                                <span className="font-semibold text-[#2A3547]">Alamat: </span>
                                <span>{lead.address}</span>
                            </div>
                        )}

                        {lead.notes && (
                            <div className="pt-1.5 border-t border-slate-100 text-[11px] leading-relaxed text-[#41506B] italic">
                                "{lead.notes}"
                            </div>
                        )}

                        <div className="flex items-center gap-1.5 pt-1 text-[10px] text-[#5A6A85] border-t border-slate-100">
                            {getContactChannelIcon(lead.contactChannel)}
                            <span>Sumber: {lead.contactChannel}</span>
                        </div>
                    </div>

                    {/* Tombol Aksi Status (Package WA, Follow Up, Form WA, Konversi) */}
                    {renderActions() && (
                        <div className="pt-1 border-t border-[#EEF2F7] flex justify-end">
                            {renderActions()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Main Component ---

interface LeadsProps {
    leads: Lead[];
    setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    packages: Package[];
    addOns: AddOn[];
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    userProfile: Profile;
    setProfile: React.Dispatch<React.SetStateAction<Profile>>;
    showNotification: (message: string) => void;
    handleNavigation: (view: ViewType, action?: NavigationAction) => void;
    cards: Card[];
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    pockets: FinancialPocket[];
    setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
    promoCodes: PromoCode[];
    setPromoCodes: React.Dispatch<React.SetStateAction<PromoCode[]>>;
    totals: {
        projects: number;
        activeProjects: number;
        clients: number;
        activeClients: number;
        leads: number;
        discussionLeads: number;
        followUpLeads: number;
        teamMembers: number;
        transactions: number;
        revenue: number;
        expense: number;
    };
}

export const Leads: React.FC<LeadsProps> = ({
    leads, setLeads, clients, setClients, projects, setProjects, packages, addOns, transactions, setTransactions, userProfile, setProfile, showNotification, handleNavigation, cards, setCards, pockets, setPockets, promoCodes, setPromoCodes, totals
}) => {
    const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit' | 'convert'>('add');
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [formData, setFormData] = useState<any>({});
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isBookingLinksModalOpen, setIsBookingLinksModalOpen] = useState(false);
    const [activeStatModal, setActiveStatModal] = useState<string | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [hiddenColumns, setHiddenColumns] = useState<Set<LeadStatus>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceFilter, setSourceFilter] = useState<ContactChannel | 'all'>('all');
    const [cityFilter, setCityFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [statCardView, setStatCardView] = useState<'insights' | 'pipeline'>('insights');
    const [activeCardFilter, setActiveCardFilter] = useState<{
        type: 'city' | 'event_month' | 'source' | 'active' | 'converted';
        label: string;
        value?: string;
    } | null>(null);
    const [shareModalState, setShareModalState] = useState<{ type: 'package' | 'booking', lead: Lead } | null>(null);
    const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [mobileStatusTab, setMobileStatusTab] = useState<'all' | LeadStatus>('all');
    const activeLeadFilterCount = (sourceFilter !== 'all' ? 1 : 0) + (cityFilter !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (activeCardFilter ? 1 : 0);

    const publicLeadFormUrl = useMemo(() => buildPublicShareUrl('lead'), []);
    const publicBookingFormUrl = useMemo(() => buildPublicShareUrl('booking'), []);
    const publicPackagesUrl = useMemo(() => buildPublicShareUrl('packages'), []);

    const uniqueCities = useMemo(() => {
        const set = new Set<string>();
        leads.forEach(l => {
            const c = (l.location || '').trim();
            if (c) set.add(c);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
    }, [leads]);

    useEffect(() => {
        if (isShareModalOpen && typeof (window as any).QRCode !== 'undefined') {
            const qrCodeContainer = document.getElementById('lead-form-qrcode');
            if (qrCodeContainer) {
                qrCodeContainer.innerHTML = '';
                new (window as any).QRCode(qrCodeContainer, {
                    text: publicLeadFormUrl, width: 200, height: 200, colorDark: "#020617", colorLight: "#ffffff", correctLevel: 2
                });
            }
        }
    }, [isShareModalOpen, publicLeadFormUrl]);

    const handleStatCardClick = (stat: string) => setActiveStatModal(stat);
    const toggleHiddenColumns = () => {
        setHiddenColumns(prev => {
            const newHidden = new Set(prev);
            const completedStatuses: LeadStatus[] = [LeadStatus.CONVERTED, LeadStatus.REJECTED];
            if (newHidden.has(LeadStatus.CONVERTED)) {
                completedStatuses.forEach(s => newHidden.delete(s));
            } else {
                completedStatuses.forEach(s => newHidden.add(s));
            }
            return newHidden;
        });
    };

    const filteredLeads = useMemo(() => leads.filter(lead => {
        const searchMatch = searchTerm === '' ||
            lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (lead.notes && lead.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (lead.location && lead.location.toLowerCase().includes(searchTerm.toLowerCase()));

        const sourceMatch = sourceFilter === 'all' || lead.contactChannel === sourceFilter;
        const cityMatch = cityFilter === 'all' || (lead.location && lead.location.trim().toLowerCase() === cityFilter.toLowerCase());

        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo) : null;
        if (from) from.setHours(0, 0, 0, 0);
        if (to) to.setHours(23, 59, 59, 999);
        const leadDate = new Date(lead.date);
        const dateMatch = (!from || leadDate >= from) && (!to || leadDate <= to);

        if (!searchMatch || !sourceMatch || !cityMatch || !dateMatch) return false;

        if (activeCardFilter) {
            if (activeCardFilter.type === 'city' && activeCardFilter.value) {
                const loc = (lead.location || '').trim().toLowerCase();
                if (loc !== activeCardFilter.value.toLowerCase()) return false;
            } else if (activeCardFilter.type === 'event_month' && activeCardFilter.value) {
                if (!lead.eventDate) return false;
                const d = new Date(lead.eventDate);
                if (isNaN(d.getTime())) return false;
                const m = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
                if (m.toLowerCase() !== activeCardFilter.value.toLowerCase()) return false;
            } else if (activeCardFilter.type === 'source' && activeCardFilter.value) {
                if (lead.contactChannel !== activeCardFilter.value) return false;
            } else if (activeCardFilter.type === 'active') {
                if (lead.status !== LeadStatus.DISCUSSION && lead.status !== LeadStatus.FOLLOW_UP) return false;
            } else if (activeCardFilter.type === 'converted') {
                if (lead.status !== LeadStatus.CONVERTED) return false;
            }
        }

        return true;
    }), [leads, searchTerm, sourceFilter, cityFilter, dateFrom, dateTo, activeCardFilter]);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, leadId: string) => {
        e.dataTransfer.setData("leadId", leadId);
        setDraggedLeadId(leadId);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

    const handleMoveStatus = (leadId: string, newStatus: LeadStatus) => {
        const leadToUpdate = leads.find(l => l.id === leadId);
        if (!leadToUpdate) return;
        if (leadToUpdate.status === newStatus) return;

        if (newStatus === LeadStatus.CONVERTED) {
            handleOpenModal('convert', leadToUpdate);
            return;
        }

        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus, date: new Date().toISOString() } : l));
        void updateLeadRow(leadId, { status: newStatus, date: new Date().toISOString().split('T')[0] }).catch(err => {
            console.warn('[Supabase] update lead status failed', err);
            showNotification('Gagal memperbarui status Calon Pengantin di database.');
        });
        showNotification(`Calon Pengantin "${leadToUpdate.name}" berhasil dipindahkan ke "${statusConfig[newStatus]?.title || newStatus}".`);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: LeadStatus) => {
        e.preventDefault();
        const leadId = e.dataTransfer.getData("leadId");
        if (leadId) {
            handleMoveStatus(leadId, newStatus);
        }
        setDraggedLeadId(null);
    };

    const handleNextStatus = (leadId: string, currentStatus: LeadStatus) => {
        let newStatus: LeadStatus | null = null;
        if (currentStatus === LeadStatus.DISCUSSION) newStatus = LeadStatus.FOLLOW_UP;
        if (currentStatus === LeadStatus.FOLLOW_UP) newStatus = LeadStatus.CONVERTED;
        if (newStatus) {
            handleMoveStatus(leadId, newStatus);
        }
    };

    const handleOpenModal = (mode: 'add' | 'edit' | 'convert', lead?: Lead) => {
        setModalMode(mode);
        setSelectedLead(lead || null);
        if (mode === 'edit' && lead) {
            setFormData(lead);
        } else if (mode === 'convert' && lead) {
            setFormData({
                clientName: lead.name, email: '', phone: '', whatsapp: lead.whatsapp || '', instagram: '', clientType: ClientType.DIRECT,
                projectName: `${lead.name}`, projectType: userProfile.projectTypes[0] || '',
                location: lead.location, address: lead.address || '', date: lead.eventDate || new Date().toISOString().split('T')[0], packageId: '', selectedAddOnIds: [], dp: '', dpDestinationCardId: '', notes: lead.notes || '', promoCodeId: ''
            });
        } else {
            setFormData({ name: '', contactChannel: ContactChannel.OTHER, location: '', address: '', whatsapp: '', notes: '', eventDate: '', date: new Date().toISOString(), status: LeadStatus.DISCUSSION });
        }
        setIsModalOpen(true);
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleCloseModal = () => setIsModalOpen(false);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { id, checked } = e.target as HTMLInputElement;
            setFormData((prev: any) => ({ ...prev, selectedAddOnIds: checked ? [...prev.selectedAddOnIds, id] : prev.selectedAddOnIds.filter((addOnId: string) => addOnId !== id) }));
        } else {
            setFormData((prev: any) => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await handleSubmitInner(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitInner = async (e: React.FormEvent) => {
        if (modalMode === 'add' || modalMode === 'edit') {
            try {
                if (modalMode === 'add') {
                    const created = await createLeadRow({
                        name: formData.name,
                        contactChannel: formData.contactChannel,
                        location: formData.location || '',
                        status: formData.status || LeadStatus.DISCUSSION,
                        date: new Date().toISOString().split('T')[0],
                        notes: formData.notes || undefined,
                        whatsapp: formData.whatsapp || undefined,
                        address: formData.address || undefined,
                        eventDate: formData.eventDate || undefined,
                    } as Omit<Lead, 'id'>);
                    setLeads(prev => [created, ...prev]);
                    showNotification('Calon Pengantin baru berhasil ditambahkan.');
                } else if (selectedLead) {
                    const updated = await updateLeadRow(selectedLead.id, {
                        name: formData.name,
                        contactChannel: formData.contactChannel,
                        location: formData.location || '',
                        status: formData.status,
                        notes: formData.notes || undefined,
                        whatsapp: formData.whatsapp || undefined,
                        address: formData.address || undefined,
                        eventDate: formData.eventDate || undefined,
                    });
                    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l));
                    showNotification('Calon Pengantin berhasil diperbarui.');
                }
            } catch (err) {
                alert('Gagal menyimpan Calon Pengantin ke database. Coba lagi.');
                return;
            }
        } else if (modalMode === 'convert' && selectedLead) {
            const selectedPackage = packages.find(p => p.id === formData.packageId);
            if (!selectedPackage) { alert('Harap pilih Package.'); return; }
            const selectedAddOns = addOns.filter(addon => formData.selectedAddOnIds.includes(addon.id));
            // Prefer explicit unitPrice chosen in the form (duration-based), fallback to package.default price
            const packagePrice = formData.unitPrice !== undefined && !isNaN(Number(formData.unitPrice)) ? Number(formData.unitPrice) : (selectedPackage.price || 0);
            const totalBeforeDiscount = packagePrice + selectedAddOns.reduce((sum, addon) => sum + addon.price, 0);
            let finalDiscountAmount = 0;
            const promoCode = promoCodes.find(p => p.id === formData.promoCodeId);
            if (promoCode) {
                if (promoCode.discountType === 'percentage') { finalDiscountAmount = (totalBeforeDiscount * promoCode.discountValue) / 100; }
                else { finalDiscountAmount = promoCode.discountValue; }
            }
            const totalProject = totalBeforeDiscount - finalDiscountAmount;
            const dpAmount = Number(formData.dp) || 0;
            try {
                // Step 1: Update the lead's status to CONVERTED
                await updateLeadRow(selectedLead.id, { status: LeadStatus.CONVERTED });

                // Step 2: Create the new client, project, and transaction records
                const createdClient = await createClientRow({
                    name: formData.clientName,
                    email: formData.email,
                    phone: formData.phone,
                    whatsapp: formData.whatsapp || undefined,
                    instagram: '',
                    clientType: ClientType.DIRECT,
                    since: new Date().toISOString().split('T')[0],
                    status: ClientStatus.ACTIVE,
                    lastContact: new Date().toISOString(),
                    portalAccessId: crypto.randomUUID(),
                    address: formData.address || undefined,
                } as Omit<Client, 'id'>);
                setClients(prev => [createdClient, ...prev]);

                // Create project in Supabase
                const createdProject = await createProjectRow({
                    projectName: `${formData.clientName}`,
                    clientName: formData.clientName,
                    clientId: createdClient.id,
                    projectType: formData.projectType,
                    packageName: selectedPackage.name,
                    date: formData.date,
                    location: formData.location,
                    address: formData.address,
                    status: 'Dikonfirmasi',
                    totalCost: totalProject,
                    amountPaid: dpAmount,
                    paymentStatus: dpAmount >= totalProject ? PaymentStatus.LUNAS : (dpAmount > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR),
                    durationSelection: formData.durationSelection || undefined,
                    unitPrice: formData.unitPrice !== undefined ? Number(formData.unitPrice) : undefined,
                    notes: formData.notes || undefined,
                    promoCodeId: formData.promoCodeId || undefined,
                    discountAmount: finalDiscountAmount > 0 ? finalDiscountAmount : undefined,
                    addOns: selectedAddOns.map(a => ({ id: a.id, name: a.name, price: a.price })),
                    accommodation: undefined,
                    driveLink: undefined,
                    printingCost: undefined,
                    transportCost: undefined,
                    completedDigitalItems: [],
                });
                const mergedProject: Project = { ...createdProject, addOns: selectedAddOns };
                setProjects(prev => [mergedProject, ...prev]);

                // DP transaction persist
                if (dpAmount > 0) {
                    const selectedCard = cards.find(c => c.id === formData.dpDestinationCardId);
                    const supaCardId = selectedCard ? await findCardIdByMeta(selectedCard.bankName, selectedCard.lastFourDigits) : null;
                    try {
                        const createdTx = await createTransactionRow({
                            date: new Date().toISOString().split('T')[0],
                            description: `DP Acara Pernikahan ${mergedProject.projectName}`,
                            amount: dpAmount,
                            type: TransactionType.INCOME,
                            projectId: mergedProject.id,
                            category: 'DP Acara Pernikahan',
                            method: 'Transfer Bank',
                            cardId: supaCardId || undefined,
                        } as Omit<Transaction, 'id' | 'vendorSignature'>);
                        setTransactions(prev => {
                            const exists = prev.some(t => t.id === createdTx.id);
                            const list = exists ? prev.map(t => t.id === createdTx.id ? createdTx : t) : [createdTx, ...prev];
                            return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        });
                        if (supaCardId) {
                            setCards(prev => prev.map(c => c.id === formData.dpDestinationCardId ? { ...c, balance: c.balance + dpAmount } : c));
                        }
                    } catch (err) {
                        console.warn('[Supabase] DP convert lead transaction failed, fallback local.', err);
                        const fallbackTx: Transaction = {
                            id: `TRN-DP-${mergedProject.id}`,
                            date: new Date().toISOString().split('T')[0],
                            description: `DP Acara Pernikahan ${mergedProject.projectName}`,
                            amount: dpAmount,
                            type: TransactionType.INCOME,
                            projectId: mergedProject.id,
                            category: 'DP Acara Pernikahan',
                            method: 'Transfer Bank',
                            cardId: formData.dpDestinationCardId,
                        };
                        setTransactions(prev => {
                            const exists = prev.some(t => t.id === fallbackTx.id);
                            const list = exists ? prev.map(t => t.id === fallbackTx.id ? fallbackTx : t) : [fallbackTx, ...prev];
                            return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        });
                        setCards(prev => prev.map(c => c.id === formData.dpDestinationCardId ? { ...c, balance: c.balance + dpAmount } : c));
                    }
                }
                if (promoCode) { setPromoCodes(prev => prev.map(p => p.id === promoCode.id ? { ...p, usageCount: p.usageCount + 1 } : p)); }
                setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, status: LeadStatus.CONVERTED, notes: `Dikonversi menjadi Pengantin ID: ${createdClient.id}` } : l));
                showNotification(`Calon Pengantin ${selectedLead.name} berhasil dikonversi menjadi pengantin!`);
            } catch (err) {
                alert('Gagal mengkonversi Calon Pengantin. Coba lagi.');
                return;
            }
        }
        handleCloseModal();
    };

    const handleDeleteLead = async (leadId: string) => {
        if (!window.confirm('Hapus Calon Pengantin ini?')) return;
        try {
            await deleteLeadRow(leadId);
            setLeads(prev => prev.filter(l => l.id !== leadId));
            showNotification('Calon Pengantin berhasil dihapus.');
        } catch (err) {
            alert('Gagal menghapus Calon Pengantin di database. Coba lagi.');
        }
    };

    const leadColumns = useMemo(() => {
        const columns: Record<LeadStatus, Lead[]> = {
            [LeadStatus.DISCUSSION]: [], [LeadStatus.FOLLOW_UP]: [], [LeadStatus.CONVERTED]: [], [LeadStatus.REJECTED]: [],
        };
        filteredLeads.forEach(lead => { columns[lead.status]?.push(lead); });
        return columns;
    }, [filteredLeads]);

    const visibleLeadColumns = useMemo(() => Object.entries(leadColumns).filter(([status]) => !hiddenColumns.has(status as LeadStatus)), [leadColumns, hiddenColumns]);

    const mobileColumnsToRender = useMemo(() => {
        if (mobileStatusTab === 'all') return visibleLeadColumns;
        return visibleLeadColumns.filter(([status]) => status === mobileStatusTab);
    }, [visibleLeadColumns, mobileStatusTab]);

    // ── Stat computations ─────────────────────────────────────────────────────
    const totalLeads = leads.length;
    const activeLeads = leads.filter(l => l.status === LeadStatus.DISCUSSION || l.status === LeadStatus.FOLLOW_UP).length;
    const discussionLeads = leads.filter(l => l.status === LeadStatus.DISCUSSION).length;
    const followUpLeads = leads.filter(l => l.status === LeadStatus.FOLLOW_UP).length;
    const convertedLeads = leads.filter(l => l.status === LeadStatus.CONVERTED).length;
    const rejectedLeads = leads.filter(l => l.status === LeadStatus.REJECTED).length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = leads.filter(l => new Date(l.date) >= startOfMonth).length;

    // Advanced Business Intelligence Computations: Kota Terbanyak, Bulan Acara Terbanyak, Sumber Utama
    const cityStats = useMemo(() => {
        const map = new Map<string, number>();
        leads.forEach(l => {
            const c = (l.location || '').trim();
            if (c) map.set(c, (map.get(c) || 0) + 1);
        });
        const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
        const top = sorted[0];
        return {
            topCity: top ? top[0] : (leads.length > 0 ? 'Belum Diisi' : '-'),
            topCount: top ? top[1] : 0,
            hasData: Boolean(top),
            ranking: sorted,
        };
    }, [leads]);

    const eventMonthStats = useMemo(() => {
        const map = new Map<string, number>();
        let withDateCount = 0;
        leads.forEach(l => {
            if (l.eventDate) {
                withDateCount++;
                const d = new Date(l.eventDate);
                if (!isNaN(d.getTime())) {
                    const key = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
                    map.set(key, (map.get(key) || 0) + 1);
                }
            }
        });
        const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
        const top = sorted[0];
        return {
            topMonth: top ? top[0] : (withDateCount > 0 ? 'Ada Jadwal' : '-'),
            topCount: top ? top[1] : 0,
            withDateCount,
            hasData: Boolean(top),
            ranking: sorted,
        };
    }, [leads]);

    const sourceStats = useMemo(() => {
        const map = new Map<ContactChannel, number>();
        leads.forEach(l => {
            const ch = l.contactChannel || ContactChannel.OTHER;
            map.set(ch, (map.get(ch) || 0) + 1);
        });
        const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
        const top = sorted[0];
        return {
            topSource: top ? top[0] : (leads.length > 0 ? 'Lainnya' : '-'),
            topCount: top ? top[1] : 0,
            hasData: Boolean(top),
            ranking: sorted,
        };
    }, [leads]);

    const modalData = useMemo<{ title: string; items: Lead[]; groupedItems: Record<string, Lead[]> | null }>(() => {
        if (!activeStatModal) return { title: '', items: [], groupedItems: null };
        switch (activeStatModal) {
            case 'all': return { title: `Semua Calon Pengantin (${leads.length})`, items: leads, groupedItems: null };
            case 'active': return { title: `Calon Pengantin Perlu Tindakan (${activeLeads})`, items: leads.filter(l => l.status === LeadStatus.DISCUSSION || l.status === LeadStatus.FOLLOW_UP), groupedItems: null };
            case 'discussion': return { title: `Sedang Diskusi (${discussionLeads})`, items: leads.filter(l => l.status === LeadStatus.DISCUSSION), groupedItems: null };
            case 'followup': return { title: `Menunggu Follow Up (${followUpLeads})`, items: leads.filter(l => l.status === LeadStatus.FOLLOW_UP), groupedItems: null };
            case 'converted': return { title: `Dikonversi Menjadi Pengantin (${convertedLeads})`, items: leads.filter(l => l.status === LeadStatus.CONVERTED), groupedItems: null };
            case 'rejected': return { title: `Ditolak / Tidak Berlanjut (${rejectedLeads})`, items: leads.filter(l => l.status === LeadStatus.REJECTED), groupedItems: null };
            case 'new': { const n = new Date(); const som = new Date(n.getFullYear(), n.getMonth(), 1); return { title: 'Calon Pengantin Baru Bulan Ini', items: leads.filter(l => new Date(l.date) >= som), groupedItems: null }; }
            case 'city': {
                const targetCity = cityStats.topCity;
                const matched = leads.filter(l => (l.location || '').trim().toLowerCase() === targetCity.toLowerCase());
                return {
                    title: `Calon Pengantin di Kota "${targetCity}" (${matched.length})`,
                    items: matched,
                    groupedItems: null
                };
            }
            case 'location': {
                const leadsByLocation = leads.reduce((acc, lead) => {
                    const location = lead.location.trim() || 'Tidak Diketahui';
                    if (!acc[location]) acc[location] = [];
                    acc[location].push(lead);
                    return acc;
                }, {} as Record<string, Lead[]>);
                return { title: 'Peringkat Calon Pengantin Berdasarkan Wilayah / Kota', items: [], groupedItems: leadsByLocation };
            }
            case 'event_month': {
                const targetMonth = eventMonthStats.topMonth;
                const matched = leads.filter(l => {
                    if (!l.eventDate) return false;
                    const d = new Date(l.eventDate);
                    return !isNaN(d.getTime()) && d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) === targetMonth;
                });
                return {
                    title: `Calon Pengantin Acara Bulan "${targetMonth}" (${matched.length})`,
                    items: matched,
                    groupedItems: null
                };
            }
            case 'month': {
                const leadsByMonth = leads.reduce((acc, lead) => {
                    let key = 'Belum Ada Tanggal Acara';
                    if (lead.eventDate) {
                        const d = new Date(lead.eventDate);
                        if (!isNaN(d.getTime())) {
                            key = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                        }
                    }
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(lead);
                    return acc;
                }, {} as Record<string, Lead[]>);
                return { title: 'Jadwal Acara Calon Pengantin Berdasarkan Bulan', items: [], groupedItems: leadsByMonth };
            }
            case 'source': {
                const targetSource = sourceStats.topSource;
                const matched = leads.filter(l => (l.contactChannel || ContactChannel.OTHER) === targetSource);
                return {
                    title: `Calon Pengantin dari Sumber "${targetSource}" (${matched.length})`,
                    items: matched,
                    groupedItems: null
                };
            }
            case 'all_source': {
                const leadsBySource = leads.reduce((acc, lead) => {
                    const source = lead.contactChannel || ContactChannel.OTHER;
                    if (!acc[source]) acc[source] = [];
                    acc[source].push(lead);
                    return acc;
                }, {} as Record<string, Lead[]>);
                return { title: 'Calon Pengantin Berdasarkan Sumber Kontak', items: [], groupedItems: leadsBySource };
            }
            default: return { title: '', items: [], groupedItems: null };
        }
    }, [activeStatModal, leads, cityStats, eventMonthStats, sourceStats, activeLeads, discussionLeads, followUpLeads, convertedLeads, rejectedLeads]);

    const handleCardClickAndShowData = (type: 'city' | 'event_month' | 'source' | 'active' | 'converted' | 'all' | 'discussion' | 'followup' | 'rejected') => {
        if (type === 'city') {
            setActiveStatModal('location');
        } else if (type === 'event_month') {
            setActiveStatModal('month');
        } else if (type === 'source') {
            setActiveStatModal('all_source');
        } else if (type === 'active') {
            setActiveCardFilter({ type: 'active', label: 'Perlu Tindakan (Diskusi & Follow Up)' });
            setActiveStatModal('active');
        } else if (type === 'converted') {
            setActiveCardFilter({ type: 'converted', label: 'Prospek Dikonversi' });
            setActiveStatModal('converted');
        } else if (type === 'discussion') {
            setActiveStatModal('discussion');
        } else if (type === 'followup') {
            setActiveStatModal('followup');
        } else if (type === 'rejected') {
            setActiveStatModal('rejected');
        } else if (type === 'all') {
            setActiveCardFilter(null);
            setActiveStatModal('all');
        }
    };

    const isEmpty = leads.length === 0;

    return (
        <div className="space-y-4 sm:space-y-5">
            {/* ── Stat Cards Header & Mode Switcher ────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#2A3547] flex items-center gap-1.5">
                        <TrendingUpIcon className="w-4 h-4 text-[#5D87FF]" />
                        <span>Statistik Calon Pengantin</span>
                        {activeCardFilter && (
                            <span className="text-[10px] font-semibold bg-[#5D87FF]/10 text-[#5D87FF] px-2 py-0.5 rounded-full border border-[#5D87FF]/30">
                                1 Filter Aktif
                            </span>
                        )}
                    </h3>
                    <p className="text-xs text-[#5A6A85]">
                        {statCardView === 'insights'
                            ? 'Klik kartu untuk memfilter data langsung berdasarkan kota, acara, sumber, atau tindakan'
                            : 'Pantau pergerakan prospek di tiap tahapan pipeline (Diskusi, Follow Up, Deal)'}
                    </p>
                </div>

                <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <button
                        type="button"
                        onClick={() => setIsBookingLinksModalOpen(true)}
                        className="self-start px-3 py-1.5 rounded-lg bg-[#5D87FF]/10 text-[#5D87FF] text-xs font-semibold hover:bg-[#5D87FF]/20 transition-all flex items-center gap-1.5 sm:self-auto"
                    >
                        <LinkIcon className="w-3.5 h-3.5" />
                        Tautan Booking Publik
                    </button>
                    <div className="flex max-w-full items-center gap-1 overflow-x-auto bg-[#EEF2F7] p-1 rounded-xl self-start sm:self-auto border border-[#E0E6ED]">
                        <button
                            type="button"
                            onClick={() => setStatCardView('insights')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                statCardView === 'insights'
                                    ? 'bg-white text-[#3563E9] shadow-xs'
                                    : 'text-[#5A6A85] hover:text-[#2A3547]'
                            }`}
                        >
                            Wawasan Wilayah &amp; Acara
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatCardView('pipeline')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                statCardView === 'pipeline'
                                    ? 'bg-white text-[#3563E9] shadow-xs'
                                    : 'text-[#5A6A85] hover:text-[#2A3547]'
                            }`}
                        >
                            Tahapan Pipeline
                        </button>
                        <button
                            type="button"
                            onClick={() => handleStatCardClick('location')}
                            className="px-2 py-1.5 text-xs font-semibold text-[#5A6A85] hover:text-[#3563E9] hover:bg-white/60 rounded-lg transition-all cursor-pointer"
                            title="Lihat Peringkat Kota Lengkap"
                        >
                            Rincian
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Stat Cards Row ──────────────────────────────────────────────── */}
            {statCardView === 'insights' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <ModernStatCard
                        icon={<MapPinIcon className="w-5 h-5" />}
                        title="Kota Terbanyak"
                        value={cityStats.topCity}
                        subtitle={cityStats.hasData ? `${cityStats.topCount} prospek (${Math.round((cityStats.topCount / (totalLeads || 1)) * 100)}%) • Klik lihat data` : 'Belum ada data'}
                        iconColorVariant="primary"
                        badge={activeCardFilter?.type === 'city' ? { text: 'Filter Aktif', variant: 'primary' } : (cityStats.ranking.length > 1 ? { text: `${cityStats.ranking.length} Kota`, variant: 'info' } : undefined)}
                        className={activeCardFilter?.type === 'city' ? 'ring-2 ring-[#5D87FF] border-[#5D87FF] bg-[#5D87FF]/5' : ''}
                        onClick={() => handleCardClickAndShowData('city')}
                    />
                    <ModernStatCard
                        icon={<CalendarIcon className="w-5 h-5" />}
                        title="Acara Terbanyak"
                        value={eventMonthStats.topMonth}
                        subtitle={eventMonthStats.hasData ? `${eventMonthStats.topCount} acara di bulan ini • ${eventMonthStats.withDateCount} ada jadwal` : `${eventMonthStats.withDateCount} prospek ada tanggal`}
                        iconColorVariant="secondary"
                        badge={activeCardFilter?.type === 'event_month' ? { text: 'Filter Aktif', variant: 'secondary' } : (eventMonthStats.withDateCount > 0 ? { text: `${eventMonthStats.withDateCount} Acara`, variant: 'secondary' } : undefined)}
                        className={activeCardFilter?.type === 'event_month' ? 'ring-2 ring-[#49BEFF] border-[#49BEFF] bg-[#49BEFF]/5' : ''}
                        onClick={() => handleCardClickAndShowData('event_month')}
                    />
                    <ModernStatCard
                        icon={<TargetIcon className="w-5 h-5" />}
                        title="Sumber Utama"
                        value={sourceStats.topSource}
                        subtitle={sourceStats.hasData ? `${sourceStats.topCount} prospek (${Math.round((sourceStats.topCount / (totalLeads || 1)) * 100)}%) • Klik lihat data` : 'Belum ada data'}
                        iconColorVariant="warning"
                        badge={activeCardFilter?.type === 'source' ? { text: 'Filter Aktif', variant: 'warning' } : undefined}
                        className={activeCardFilter?.type === 'source' ? 'ring-2 ring-[#FFAE1F] border-[#FFAE1F] bg-[#FFAE1F]/5' : ''}
                        onClick={() => handleCardClickAndShowData('source')}
                    />
                    <ModernStatCard
                        icon={<MessageSquareIcon className="w-5 h-5" />}
                        title="Perlu Tindakan"
                        value={String(activeLeads)}
                        subtitle={`${discussionLeads} diskusi • ${followUpLeads} follow up`}
                        iconColorVariant="error"
                        badge={activeCardFilter?.type === 'active' ? { text: 'Filter Aktif', variant: 'error' } : (activeLeads > 0 ? { text: 'Follow Up', variant: 'error' } : undefined)}
                        className={activeCardFilter?.type === 'active' ? 'ring-2 ring-[#FA896B] border-[#FA896B] bg-[#FDEDE8]' : ''}
                        onClick={() => handleCardClickAndShowData('active')}
                    />
                    <ModernStatCard
                        icon={<CheckCircleIcon className="w-5 h-5" />}
                        title="Dikonversi"
                        value={`${conversionRate}%`}
                        subtitle={`${convertedLeads} dari ${totalLeads} prospek deal`}
                        iconColorVariant="success"
                        change={convertedLeads > 0 ? `${convertedLeads} deal` : undefined}
                        changeType="increase"
                        badge={activeCardFilter?.type === 'converted' ? { text: 'Filter Aktif', variant: 'success' } : undefined}
                        className={activeCardFilter?.type === 'converted' ? 'ring-2 ring-[#13DEB9] border-[#13DEB9] bg-[#E6FFFA]' : ''}
                        onClick={() => handleCardClickAndShowData('converted')}
                    />
                    <ModernStatCard
                        icon={<UsersIcon className="w-5 h-5" />}
                        title="Total Prospek"
                        value={String(totalLeads)}
                        subtitle={activeCardFilter ? 'Klik untuk reset filter' : `+${newThisMonth} bulan ini • Lihat semua`}
                        iconColorVariant="primary"
                        badge={activeCardFilter ? { text: 'Reset', variant: 'secondary' } : undefined}
                        onClick={() => handleCardClickAndShowData('all')}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <ModernStatCard
                        icon={<UsersIcon className="w-5 h-5" />}
                        title="Total Prospek"
                        value={String(totalLeads)}
                        subtitle={activeCardFilter ? 'Klik untuk reset filter' : `+${newThisMonth} bulan ini • Lihat semua`}
                        iconColorVariant="primary"
                        onClick={() => handleCardClickAndShowData('all')}
                    />
                    <ModernStatCard
                        icon={<TargetIcon className="w-5 h-5" />}
                        title="Aktif"
                        value={String(activeLeads)}
                        subtitle="Diskusi + Follow Up"
                        iconColorVariant="primary"
                        badge={activeCardFilter?.type === 'active' ? { text: 'Filter Aktif', variant: 'primary' } : undefined}
                        className={activeCardFilter?.type === 'active' ? 'ring-2 ring-[#5D87FF] border-[#5D87FF] bg-[#5D87FF]/5' : ''}
                        onClick={() => handleCardClickAndShowData('active')}
                    />
                    <ModernStatCard
                        icon={<MessageSquareIcon className="w-5 h-5" />}
                        title="Sedang Diskusi"
                        value={String(discussionLeads)}
                        subtitle="Perlu tindakan • Lihat data"
                        iconColorVariant="warning"
                        onClick={() => handleCardClickAndShowData('discussion')}
                    />
                    <ModernStatCard
                        icon={<ChevronRightIcon className="w-5 h-5" />}
                        title="Follow Up"
                        value={String(followUpLeads)}
                        subtitle="Menunggu respons • Lihat data"
                        iconColorVariant="error"
                        onClick={() => handleCardClickAndShowData('followup')}
                    />
                    <ModernStatCard
                        icon={<CheckCircleIcon className="w-5 h-5" />}
                        title="Dikonversi"
                        value={String(convertedLeads)}
                        subtitle={`${conversionRate}% konversi`}
                        iconColorVariant="success"
                        changeType="increase"
                        change={`${conversionRate}%`}
                        badge={activeCardFilter?.type === 'converted' ? { text: 'Filter Aktif', variant: 'success' } : undefined}
                        className={activeCardFilter?.type === 'converted' ? 'ring-2 ring-[#13DEB9] border-[#13DEB9] bg-[#E6FFFA]' : ''}
                        onClick={() => handleCardClickAndShowData('converted')}
                    />
                    <ModernStatCard
                        icon={<Share2Icon className="w-5 h-5" />}
                        title="Ditolak"
                        value={String(rejectedLeads)}
                        subtitle="Tidak berlanjut • Lihat data"
                        iconColorVariant="error"
                        onClick={() => handleCardClickAndShowData('rejected')}
                    />
                </div>
            )}

            {isEmpty ? (
                <div className="text-center py-20">
                    <LightbulbIcon className="mx-auto h-16 w-16 text-brand-accent" />
                    <h2 className="mt-4 text-2xl font-bold text-brand-text-light">Selamat Datang di Halaman Calon Pengantin!</h2>
                    <p className="mt-2 text-brand-text-secondary max-w-lg mx-auto">Halaman ini adalah tempat Anda mengelola semua calon pengantin (Calon Pengantin) sebelum mereka resmi menjadi Acara Pernikahan.</p>
                    <button onClick={() => handleOpenModal('add')} className="mt-8 button-primary inline-flex items-center gap-2"><PlusIcon className="w-5 h-5" />Tambah Calon Pengantin Pertama Anda</button>
                </div>
            ) : (
                <>
                    {/* Active Quick Card Filter Banner */}
                    {activeCardFilter && (
                        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[#5D87FF]/10 border border-[#5D87FF]/30 rounded-xl text-xs text-[#2348C7] shadow-xs">
                            <div className="flex items-center gap-2 truncate">
                                <span className="w-2 h-2 rounded-full bg-[#5D87FF] animate-pulse shrink-0" />
                                <span className="font-bold truncate">Filter Aktif dari Kartu: {activeCardFilter.label}</span>
                                <span className="text-[#5A6A85] text-[11px] shrink-0 font-medium">({filteredLeads.length} Calon Pengantin ditampilkan)</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveCardFilter(null)}
                                className="text-xs font-bold text-[#2348C7] hover:underline shrink-0 px-2.5 py-1 rounded-lg hover:bg-white/70 transition-colors cursor-pointer"
                            >
                                Hapus Filter &times;
                            </button>
                        </div>
                    )}

                    {/* ── Filter Bar ──────────────────────────────────────────────── */}
                    <div className="bg-brand-surface p-3 md:p-4 rounded-xl shadow-lg border border-brand-border flex flex-col gap-3 md:gap-4 leads-filter-section">
                        {/* Mobile Top Row: Search + Filter Toggle + Add Button */}
                        <div className="flex sm:hidden items-center gap-2 w-full">
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="input-field !rounded-xl !border !bg-brand-bg px-3 py-2 text-xs flex-1 min-w-0"
                                placeholder="Cari Calon Pengantin / Kota..."
                            />
                            <button
                                type="button"
                                onClick={() => setMobileFiltersOpen(prev => !prev)}
                                className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-colors flex-shrink-0 ${
                                    mobileFiltersOpen || activeLeadFilterCount > 0
                                        ? 'bg-[#5D87FF]/10 border-[#5D87FF]/30 text-[#5D87FF]'
                                        : 'bg-brand-bg border-brand-border text-brand-text-primary'
                                }`}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Filter</span>
                                {activeLeadFilterCount > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-[#5D87FF] text-white text-[10px] font-bold">
                                        {activeLeadFilterCount}
                                    </span>
                                )}
                                {mobileFiltersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            <button
                                onClick={() => handleOpenModal('add')}
                                className="button-primary px-3 py-2 inline-flex items-center justify-center gap-1 text-xs font-semibold flex-shrink-0 !rounded-xl"
                                title="Tambah Calon Pengantin Manual"
                            >
                                <PlusIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>Tambah</span>
                            </button>
                        </div>

                        {/* Desktop Search + City + Source row (or mobile expanded) */}
                        <div className={`${mobileFiltersOpen ? 'flex' : 'hidden sm:flex'} flex-col sm:flex-row gap-3 w-full`}>
                            <div className="hidden sm:block input-group flex-grow !mt-0 w-full">
                                <input type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-field !rounded-lg !border !bg-brand-bg p-3 text-sm" placeholder=" " />
                                <label className="input-label text-sm">Cari Calon Pengantin / Kota / Catatan...</label>
                            </div>
                            <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="input-field !rounded-lg !border !bg-brand-bg p-2.5 sm:p-3 text-xs sm:text-sm w-full sm:w-44">
                                <option value="all">Semua Kota ({uniqueCities.length})</option>
                                {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as any)} className="input-field !rounded-lg !border !bg-brand-bg p-2.5 sm:p-3 text-xs sm:text-sm w-full sm:w-44 leads-source-filter">
                                <option value="all">Semua Sumber</option>
                                {Object.values(ContactChannel).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        
                        <div className={`${mobileFiltersOpen ? 'flex' : 'hidden sm:flex'} flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full leads-filter-row`}>
                            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field !rounded-lg !border !bg-brand-bg p-2.5 sm:p-3 text-xs sm:text-sm w-full" title="Dari tanggal" />
                                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field !rounded-lg !border !bg-brand-bg p-2.5 sm:p-3 text-xs sm:text-sm w-full" title="Sampai tanggal" />
                            </div>
                            <div className="flex items-center justify-end gap-2 w-full sm:w-auto leads-filter-buttons">
                                {/* View toggle */}
                                <div className="flex rounded-lg border border-brand-border overflow-hidden flex-shrink-0">
                                    <button
                                        onClick={() => setViewMode('kanban')}
                                        className={`px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1 ${viewMode === 'kanban' ? 'bg-brand-accent text-white' : 'bg-brand-bg text-brand-text-secondary hover:bg-brand-border'}`}
                                        title="Tampilan Kanban"
                                    >
                                        <Kanban className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Kanban</span>
                                    </button>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1 ${viewMode === 'table' ? 'bg-brand-accent text-white' : 'bg-brand-bg text-brand-text-secondary hover:bg-brand-border'}`}
                                        title="Tampilan Tabel"
                                    >
                                        <Table className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Tabel</span>
                                    </button>
                                </div>
                                {viewMode === 'kanban' && (
                                    <button onClick={toggleHiddenColumns} className="button-secondary min-h-[35px] sm:min-h-[40px] px-2.5 sm:px-3 py-1.5 sm:py-2 inline-flex items-center justify-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm font-semibold" title={hiddenColumns.has(LeadStatus.CONVERTED) ? 'Tampilkan Kolom Selesai' : 'Sembunyikan Kolom Selesai'}>
                                        <EyeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                        <span className="inline sm:hidden lg:inline">{hiddenColumns.has(LeadStatus.CONVERTED) ? 'Tampil' : 'Kolom'}</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsBookingLinksModalOpen(true)}
                                    className="button-secondary min-h-[35px] sm:min-h-[40px] px-2.5 sm:px-3 py-1.5 sm:py-2 inline-flex items-center justify-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm font-semibold text-[#5D87FF] bg-[#5D87FF]/10 hover:bg-[#5D87FF]/20 border border-[#5D87FF]/30 cursor-pointer"
                                    title="Tautan Booking & Paket per Wilayah"
                                >
                                    <LinkIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                    <span className="hidden md:inline">Tautan Booking & Paket</span>
                                    <span className="inline md:hidden">Paket</span>
                                </button>
                                <button onClick={() => setIsShareModalOpen(true)} className="button-secondary min-h-[35px] sm:min-h-[40px] px-2.5 sm:px-3 py-1.5 sm:py-2 inline-flex items-center justify-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm font-semibold" title="Bagikan Form Calon Pengantin">
                                    <Share2Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                    <span className="inline sm:hidden">Share</span>
                                </button>
                                <button onClick={() => handleOpenModal('add')} className="hidden sm:inline-flex button-primary min-h-[40px] px-3 py-2 items-center justify-center gap-1.5 text-sm font-semibold" title="Tambah Calon Pengantin Manual">
                                    <PlusIcon className="w-4 h-4 flex-shrink-0" />
                                    <span>Tambah</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Kanban View ─────────────────────────────────────────────── */}
                    {viewMode === 'kanban' && (
                        <>
                            {/* Mobile column tabs for responsive stage switching */}
                            <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none">
                                <button
                                    type="button"
                                    onClick={() => setMobileStatusTab('all')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                                        mobileStatusTab === 'all'
                                            ? 'bg-[#3563E9] text-white shadow-xs'
                                            : 'bg-white border border-[#EAEFF4] text-[#5A6A85] hover:bg-slate-50'
                                    }`}
                                >
                                    Semua ({filteredLeads.length})
                                </button>
                                {Object.values(LeadStatus).map(st => {
                                    const conf = statusConfig[st];
                                    const count = leadColumns[st]?.length || 0;
                                    const isActive = mobileStatusTab === st;
                                    return (
                                        <button
                                            key={st}
                                            type="button"
                                            onClick={() => setMobileStatusTab(st)}
                                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer"
                                            style={{
                                                backgroundColor: isActive ? conf.color : conf.softBg,
                                                color: isActive ? '#ffffff' : conf.color,
                                                border: `1px solid ${conf.border}`,
                                            }}
                                        >
                                            <span>{conf.title}</span>
                                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${isActive ? 'bg-white/25 text-white' : 'bg-white text-[#2A3547]'}`}>
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Mobile grouped list */}
                            <div className="md:hidden space-y-3 -mx-2.5 px-2.5">
                                {mobileColumnsToRender.map(([status, leadItems]) => {
                                    const statusInfo = statusConfig[status as LeadStatus];
                                    return (
                                        <div key={status} className="bg-brand-bg rounded-2xl border border-brand-border overflow-hidden">
                                            <div className="p-3 text-sm font-semibold text-brand-text-light border-b flex justify-between items-center" style={{ borderColor: statusInfo.color, borderBottomWidth: 2 }}>
                                                <span className="truncate">{statusInfo.title}</span>
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white ml-2 flex-shrink-0" style={{ backgroundColor: statusInfo.color }}>{leadItems.length}</span>
                                            </div>
                                            <div className="p-2 space-y-2">
                                                {leadItems.map(lead => (
                                                    <LeadCard
                                                        key={lead.id}
                                                        lead={lead}
                                                        onDragStart={() => { }}
                                                        onClick={() => handleOpenModal('edit', lead)}
                                                        onEdit={() => handleOpenModal('edit', lead)}
                                                        onDelete={() => handleDeleteLead(lead.id)}
                                                        onNextStatus={() => handleNextStatus(lead.id, lead.status)}
                                                        onMoveStatus={(st) => handleMoveStatus(lead.id, st)}
                                                        onShare={(type) => setShareModalState({ type, lead })}
                                                    />
                                                ))}
                                                {leadItems.length === 0 && (
                                                    <p className="text-center py-6 text-xs text-brand-text-secondary">Tidak ada Calon Pengantin.</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Desktop kanban columns */}
                            <div className="hidden md:flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
                                {visibleLeadColumns.map(([status, leadItems]) => {
                                    const statusInfo = statusConfig[status as LeadStatus];
                                    return (
                                        <div key={status} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status as LeadStatus)} className="w-80 flex-shrink-0 rounded-2xl border border-[#EAEFF4] bg-[#F7F9FC] flex flex-col shadow-sm leads-column-container">
                                            <div className="px-4 py-3 font-semibold text-[#2A3547] border-b flex justify-between items-center sticky top-0 rounded-t-2xl z-10 leads-column-header" style={{ borderColor: statusInfo.border, backgroundColor: statusInfo.softBg }}>
                                                <span>{statusInfo.title}</span>
                                                <span className="inline-flex min-w-7 justify-center rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: statusInfo.color }}>{leadItems.length}</span>
                                            </div>
                                            <div className="p-3 space-y-3 h-auto pr-1">
                                                {leadItems.map(lead => (
                                                    <LeadCard
                                                        key={lead.id}
                                                        lead={lead}
                                                        onDragStart={handleDragStart}
                                                        onClick={() => handleOpenModal('edit', lead)}
                                                        onEdit={() => handleOpenModal('edit', lead)}
                                                        onDelete={() => handleDeleteLead(lead.id)}
                                                        onNextStatus={() => handleNextStatus(lead.id, lead.status)}
                                                        onMoveStatus={(st) => handleMoveStatus(lead.id, st)}
                                                        onShare={(type) => setShareModalState({ type, lead })}
                                                    />
                                                ))}
                                                {leadItems.length === 0 && <p className="text-center py-8 text-sm text-brand-text-secondary">Tidak ada Calon Pengantin.</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* ── Table View ──────────────────────────────────────────────── */}
                    {viewMode === 'table' && (
                        <div className="bg-brand-surface rounded-2xl border border-brand-border shadow-lg overflow-hidden">
                            {/* Table summary bar */}
                            <div className="px-4 py-3 border-b border-brand-border flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-brand-text-light">
                                    {filteredLeads.length} Calon Pengantin
                                    {filteredLeads.length !== leads.length && <span className="text-brand-text-secondary font-normal"> dari {leads.length} total</span>}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {Object.values(LeadStatus).map(s => {
                                        const sc = statusConfig[s];
                                        if (!sc) return null;
                                        const count = filteredLeads.filter(l => l.status === s).length;
                                        return count > 0 ? (
                                            <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: sc.color }}>
                                                {sc.title}: {count}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm !border-0">
                                    <thead>
                                        <tr className="bg-brand-bg text-left">
                                            <th className="px-4 py-3 text-xs font-bold text-brand-text-secondary uppercase tracking-wider !border-0 border-b border-brand-border w-10">#</th>
                                            <th className="px-4 py-3 text-xs font-bold text-brand-text-secondary uppercase tracking-wider !border-0 border-b border-brand-border">Nama</th>
                                            <th className="px-4 py-3 text-xs font-bold text-brand-text-secondary uppercase tracking-wider !border-0 border-b border-brand-border hidden sm:table-cell">WA / Kontak</th>
                                            <th className="px-4 py-3 text-xs font-bold text-brand-text-secondary uppercase tracking-wider !border-0 border-b border-brand-border hidden md:table-cell">Lokasi</th>
                                            <th className="px-4 py-3 text-xs font-bold text-brand-text-secondary uppercase tracking-wider !border-0 border-b border-brand-border hidden lg:table-cell">Sumber</th>
                                            <th className="px-4 py-3 text-xs font-bold text-brand-text-secondary uppercase tracking-wider !border-0 border-b border-brand-border hidden lg:table-cell">Tgl Kontak</th>
                                            <th className="px-4 py-3 text-xs font-bold text-brand-text-secondary uppercase tracking-wider !border-0 border-b border-brand-border hidden xl:table-cell">Tgl Acara</th>
                                            <th className="px-4 py-3 text-xs font-bold text-brand-text-secondary uppercase tracking-wider !border-0 border-b border-brand-border">Status</th>
                                            <th className="px-4 py-3 text-xs font-bold text-brand-text-secondary uppercase tracking-wider !border-0 border-b border-brand-border text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLeads.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="px-4 py-12 text-center text-brand-text-secondary !border-0">
                                                    <LightbulbIcon className="mx-auto w-8 h-8 mb-2 opacity-40" />
                                                    <p>Tidak ada Calon Pengantin yang cocok dengan filter.</p>
                                                </td>
                                            </tr>
                                        ) : filteredLeads.map((lead, idx) => {
                                            const sc = statusConfig[lead.status] ?? { color: '#64748b', title: lead.status };
                                            const isHot = new Date(lead.date) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                                            return (
                                                <tr
                                                    key={lead.id}
                                                    className="border-t border-brand-border/50 hover:bg-brand-bg/60 transition-colors cursor-pointer group"
                                                    onClick={() => handleOpenModal('edit', lead)}
                                                >
                                                    {/* # */}
                                                    <td className="px-4 py-3 text-brand-text-secondary text-xs !border-0">{idx + 1}</td>
                                                    {/* Nama */}
                                                    <td className="px-4 py-3 !border-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: sc.color }}>
                                                                {lead.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-brand-text-light text-sm truncate max-w-[160px] flex items-center gap-1.5">
                                                                    <span className="truncate">{lead.name}</span>
                                                                    {isHot && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-orange-100 text-orange-700 shrink-0" title="Baru 24 jam">Baru</span>}
                                                                </p>
                                                                {lead.notes && <p className="text-xs text-brand-text-secondary truncate max-w-[160px]">{lead.notes}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {/* WA */}
                                                    <td className="px-4 py-3 hidden sm:table-cell !border-0">
                                                        {lead.whatsapp ? (
                                                            <a
                                                                href={`https://wa.me/${cleanPhoneNumber(lead.whatsapp)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={e => e.stopPropagation()}
                                                                className="btn-box-wa px-2 py-1 text-xs inline-flex items-center gap-1"
                                                            >
                                                                <WhatsappIcon className="w-3 h-3" />
                                                                {lead.whatsapp}
                                                            </a>
                                                        ) : (
                                                            <span className="text-brand-text-secondary text-xs">—</span>
                                                        )}
                                                    </td>
                                                    {/* Lokasi */}
                                                    <td className="px-4 py-3 hidden md:table-cell !border-0">
                                                        {lead.location ? (
                                                            <span className="flex items-center gap-1 text-xs text-brand-text-primary">
                                                                <MapPinIcon className="w-3 h-3 text-brand-accent flex-shrink-0" />
                                                                {lead.location}
                                                            </span>
                                                        ) : <span className="text-brand-text-secondary text-xs">—</span>}
                                                    </td>
                                                    {/* Sumber */}
                                                    <td className="px-4 py-3 hidden lg:table-cell !border-0">
                                                        <span className="flex items-center gap-1.5 text-xs text-brand-text-primary">
                                                            <span style={{ color: sourceColors[lead.contactChannel] }}>
                                                                {getContactChannelIcon(lead.contactChannel)}
                                                            </span>
                                                            {lead.contactChannel}
                                                        </span>
                                                    </td>
                                                    {/* Tgl Kontak */}
                                                    <td className="px-4 py-3 hidden lg:table-cell !border-0">
                                                        <span className="text-xs text-brand-text-primary">{new Date(lead.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                    </td>
                                                    {/* Tgl Acara */}
                                                    <td className="px-4 py-3 hidden xl:table-cell !border-0">
                                                        {lead.eventDate ? (
                                                            <span className="flex items-center gap-1 text-xs text-brand-text-primary">
                                                                <CalendarIcon className="w-3 h-3 text-brand-accent flex-shrink-0" />
                                                                {new Date(lead.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        ) : <span className="text-brand-text-secondary text-xs">—</span>}
                                                    </td>
                                                    {/* Status */}
                                                    <td className="px-4 py-3 !border-0">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white whitespace-nowrap" style={{ backgroundColor: sc.color }}>
                                                            {sc.title}
                                                        </span>
                                                    </td>
                                                    {/* Aksi */}
                                                    <td className="px-4 py-3 !border-0" onClick={e => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {lead.status === LeadStatus.DISCUSSION && (
                                                                <>
                                                                    <button
                                                                        onClick={() => setShareModalState({ type: 'package', lead })}
                                                                        className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#1EBF5A]"
                                                                        title="Kirim Package WA"
                                                                    >
                                                                        <WhatsappIcon className="w-3 h-3" />
                                                                        <span>Pkg</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleNextStatus(lead.id, lead.status)}
                                                                        className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-[#5D87FF] px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#4570EA]"
                                                                        title="Pindah ke Follow Up"
                                                                    >
                                                                        <span>FU</span>
                                                                        <ChevronRightIcon className="w-3 h-3" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {lead.status === LeadStatus.FOLLOW_UP && (
                                                                <>
                                                                    <button
                                                                        onClick={() => setShareModalState({ type: 'booking', lead })}
                                                                        className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#1EBF5A]"
                                                                        title="Kirim Form Booking WA"
                                                                    >
                                                                        <WhatsappIcon className="w-3 h-3" />
                                                                        <span>Booking</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleOpenModal('convert', lead)}
                                                                        className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-[#14A76C] px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#118E5C]"
                                                                        title="Konversi"
                                                                    >
                                                                        <CheckCircleIcon className="w-3 h-3" />
                                                                        <span>Konversi</span>
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button
                                                                onClick={() => handleOpenModal('edit', lead)}
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#D8E1F0] bg-white text-[#42526B] shadow-sm transition hover:border-[#BFD1F9] hover:text-[#2348C7]"
                                                                title="Edit"
                                                            >
                                                                <PencilIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteLead(lead.id)}
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#EA5A47] text-white shadow-sm transition hover:bg-[#D94F3C]"
                                                                title="Hapus"
                                                            >
                                                                <Trash2Icon className="w-3.5 h-3.5 text-white" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {/* Table footer */}
                            {filteredLeads.length > 0 && (
                                <div className="px-4 py-3 border-t border-brand-border bg-brand-bg/50 text-xs text-brand-text-secondary text-right">
                                    Menampilkan {filteredLeads.length} dari {leads.length} calon pengantin
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'add' ? 'Tambah Calon Pengantin Baru' : modalMode === 'edit' ? 'Edit Calon Pengantin' : 'Konversi Calon Pengantin Menjadi Pengantin'} size={modalMode === 'convert' ? '4xl' : 'lg'}>
                {modalMode === 'convert' ? (
                    <ConvertLeadForm
                        formData={formData}
                        setFormData={setFormData}
                        handleFormChange={handleFormChange}
                        handleSubmit={handleSubmit}
                        handleCloseModal={handleCloseModal}
                        packages={packages}
                        addOns={addOns}
                        userProfile={userProfile}
                        cards={cards}
                        promoCodes={promoCodes}
                        isSubmitting={isSubmitting}
                    />
                ) : (
                    <LeadForm
                        formData={formData}
                        handleFormChange={handleFormChange}
                        handleSubmit={handleSubmit}
                        handleCloseModal={handleCloseModal}
                        modalMode={modalMode}
                        isSubmitting={isSubmitting}
                    />
                )}
            </Modal>

            <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Bagikan Formulir Calon Pengantin Publik" size="sm">
                <div className="text-center p-4">
                    <div id="lead-form-qrcode" className="p-4 bg-white rounded-lg inline-block mx-auto"></div>
                    <p className="text-xs text-brand-text-secondary mt-4 break-all">{publicLeadFormUrl}</p>
                    <div className="flex items-center gap-2 mt-6">
                        <button onClick={() => { navigator.clipboard.writeText(publicLeadFormUrl); showNotification('Tautan berhasil disalin!'); }} className="button-secondary w-full">Salin Tautan</button>
                        <a href={`https://wa.me/?text=Silakan%20isi%20formulir%20berikut%20untuk%20memulai%3A%20${encodeURIComponent(publicLeadFormUrl)}`} target="_blank" rel="noopener noreferrer" className="btn-box-wa w-full py-2.5 text-xs sm:text-sm">Bagikan ke WA</a>
                    </div>
                </div>
            </Modal>

            {shareModalState && <ShareMessageModal type={shareModalState.type} lead={shareModalState.lead} userProfile={userProfile} publicBookingFormUrl={publicBookingFormUrl} publicPackagesUrl={publicPackagesUrl} onClose={() => setShareModalState(null)} showNotification={showNotification} setProfile={setProfile} />}

            <Modal isOpen={!!activeStatModal} onClose={() => setActiveStatModal(null)} title={modalData.title} size="2xl">
                <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-3">
                    {modalData.items.length > 0 ? (
                        <div className="space-y-2.5">
                            {modalData.items.map(lead => {
                                const st = statusConfig[lead.status] || {
                                    title: lead.status,
                                    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
                                };
                                return (
                                    <div
                                        key={lead.id}
                                        onClick={() => {
                                            setActiveStatModal(null);
                                            handleOpenModal('edit', lead);
                                        }}
                                        className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all cursor-pointer shadow-2xs hover:border-[#5D87FF]/50"
                                    >
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-full bg-[#ECF2FF] text-[#5D87FF] font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                                                {lead.name ? lead.name.substring(0, 2) : 'CP'}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-bold text-sm text-[#2A3547] hover:text-[#3563E9] truncate">
                                                        {lead.name}
                                                    </p>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.badgeClass}`}>
                                                        {st.title}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-[#5A6A85] mt-1 flex-wrap">
                                                    {lead.location && (
                                                        <span className="inline-flex items-center gap-1">
                                                            <MapPinIcon className="w-3.5 h-3.5 text-slate-400" />
                                                            {lead.location}
                                                        </span>
                                                    )}
                                                    {lead.eventDate && (
                                                        <span className="inline-flex items-center gap-1 text-[#3563E9] font-medium">
                                                            <CalendarIcon className="w-3.5 h-3.5" />
                                                            {new Date(lead.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    )}
                                                    <span className="inline-flex items-center gap-1">
                                                        {getContactChannelIcon(lead.contactChannel)}
                                                        {lead.contactChannel}
                                                    </span>
                                                    <span className="text-slate-400 text-[11px]">
                                                        {new Date(lead.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0" onClick={e => e.stopPropagation()}>
                                            {lead.whatsapp && (
                                                <a
                                                    href={`https://wa.me/${cleanPhoneNumber(lead.whatsapp)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn-box-wa px-2.5 py-1 text-xs rounded-lg font-semibold inline-flex items-center gap-1"
                                                    title="Chat WhatsApp"
                                                >
                                                    <WhatsappIcon className="w-3.5 h-3.5" />
                                                    <span>WA</span>
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveStatModal(null);
                                                    handleOpenModal('edit', lead);
                                                }}
                                                className="button-secondary text-xs px-2.5 py-1"
                                            >
                                                Detail
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : modalData.groupedItems ? (
                        <div className="space-y-4">
                            {Object.entries(modalData.groupedItems).map(([group, items]) => (
                                <div key={group} className="bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                                    <h4 className="font-bold text-sm text-[#2A3547] border-b border-slate-200 pb-2 mb-2 flex items-center justify-between">
                                        <span>{group}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs bg-[#5D87FF]/10 text-[#5D87FF] px-2 py-0.5 rounded-full font-bold">
                                                {(items as Lead[]).length} prospek
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveStatModal(null);
                                                    if (activeStatModal === 'location') {
                                                        setActiveCardFilter({ type: 'city', label: `Kota "${group}"`, value: group });
                                                    } else if (activeStatModal === 'all_source') {
                                                        setActiveCardFilter({ type: 'source', label: `Sumber "${group}"`, value: group });
                                                    }
                                                }}
                                                className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded-full font-bold transition-colors"
                                            >
                                                Filter
                                            </button>
                                        </div>
                                    </h4>
                                    <div className="space-y-1.5">
                                        {(items as Lead[]).map(lead => {
                                            const st = statusConfig[lead.status] || {
                                                title: lead.status,
                                                badgeClass: 'bg-slate-100 text-slate-700',
                                            };
                                            return (
                                                <div
                                                    key={lead.id}
                                                    onClick={() => {
                                                        setActiveStatModal(null);
                                                        handleOpenModal('edit', lead);
                                                    }}
                                                    className="p-2.5 bg-white hover:bg-blue-50/40 rounded-lg border border-slate-200 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-xs text-[#2A3547] truncate">{lead.name}</p>
                                                        <p className="text-[11px] text-[#5A6A85] flex items-center gap-2 mt-0.5">
                                                            <span>{lead.location || 'Lokasi -'}</span>
                                                            {lead.eventDate && <span>• {new Date(lead.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>}
                                                            <span>• {lead.contactChannel}</span>
                                                        </p>
                                                    </div>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${st.badgeClass}`}>
                                                        {st.title}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-[#5A6A85] py-8 text-sm">Tidak ada data untuk ditampilkan.</p>
                    )}
                </div>
            </Modal>

            {/* ── Booking & Paket per Wilayah Modal ── */}
            {isBookingLinksModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
                    <div className="bg-white rounded-2xl border border-[#EAEFF4] shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 sm:space-y-5 animate-scale-up my-auto max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between pb-3 border-b border-[#EAEFF4]">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-[#5D87FF]/10 flex items-center justify-center text-[#5D87FF]">
                                    <LinkIcon className="w-4 h-4" />
                                </div>
                                <h3 className="font-bold text-sm sm:text-base text-[#2A3547]">
                                    Tautan Booking & Paket per Wilayah
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsBookingLinksModalOpen(false)}
                                className="p-1.5 rounded-lg text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9] cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-sm text-[#5A6A85]">
                            <p className="text-xs sm:text-sm text-[#5A6A85] leading-relaxed">
                                Bagikan tautan booking publik khusus ke calon pengantin. Setiap tautan akan menyaring paket & add-on sesuai dengan wilayah yang dipilih.
                            </p>

                            <div className="space-y-3">
                                {/* Semua Wilayah */}
                                <div className="border border-[#EAEFF4] rounded-xl p-3.5 bg-[#F9FBFC] hover:border-[#5D87FF]/40 transition-all space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-xs sm:text-sm text-[#2A3547]">
                                            Semua Wilayah (Katalog Lengkap)
                                        </p>
                                        <span className="text-[10px] font-semibold bg-[#5D87FF]/10 text-[#5D87FF] px-2 py-0.5 rounded-md">
                                            Lengkap
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-[#5A6A85] font-mono break-all bg-white px-2 py-1 rounded border border-[#EAEFF4]">
                                        {typeof window !== 'undefined' ? `${window.location.origin}/#/public-packages` : '/#/public-packages'}
                                    </p>
                                    <div className="flex items-center gap-2 pt-1">
                                        <a
                                            href="/#/public-packages"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#5D87FF] hover:bg-[#4570EA] text-white text-xs font-bold transition-colors cursor-pointer"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            <span>Buka Halaman</span>
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const url = `${window.location.origin}/#/public-packages`;
                                                navigator.clipboard.writeText(url);
                                                showNotification('Tautan berhasil disalin!');
                                            }}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#EAEFF4] bg-white hover:bg-[#F4F6F9] text-[#2A3547] text-xs font-semibold transition-colors cursor-pointer"
                                        >
                                            <Copy className="w-3.5 h-3.5 text-[#5A6A85]" />
                                            <span>Salin Tautan</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Per Region */}
                                {REGIONS.map((r) => {
                                    const regionUrl = typeof window !== 'undefined'
                                        ? `${window.location.origin}/#/public-packages?region=${r.value}`
                                        : `/#/public-packages?region=${r.value}`;
                                    return (
                                        <div
                                            key={r.value}
                                            className="border border-[#EAEFF4] rounded-xl p-3.5 bg-[#F9FBFC] hover:border-[#5D87FF]/40 transition-all space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold text-xs sm:text-sm text-[#2A3547]">
                                                    Khusus Wilayah: {r.label}
                                                </p>
                                                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                                                    Wilayah {r.label}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-[#5A6A85] font-mono break-all bg-white px-2 py-1 rounded border border-[#EAEFF4]">
                                                {regionUrl}
                                            </p>
                                            <div className="flex items-center gap-2 pt-1">
                                                <a
                                                    href={`/#/public-packages?region=${r.value}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#5D87FF] hover:bg-[#4570EA] text-white text-xs font-bold transition-colors cursor-pointer"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                    <span>Buka Halaman</span>
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(regionUrl);
                                                        showNotification(`Tautan ${r.label} berhasil disalin!`);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#EAEFF4] bg-white hover:bg-[#F4F6F9] text-[#2A3547] text-xs font-semibold transition-colors cursor-pointer"
                                                >
                                                    <Copy className="w-3.5 h-3.5 text-[#5A6A85]" />
                                                    <span>Salin Tautan</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-[#EAEFF4]">
                            <button
                                type="button"
                                onClick={() => setIsBookingLinksModalOpen(false)}
                                className="w-full py-2.5 px-4 rounded-xl bg-[#5D87FF] hover:bg-[#4570EA] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Share Modal Component (Internal to Leads) ---
interface ShareMessageModalProps {
    type: 'package' | 'booking';
    lead: Lead;
    userProfile: Profile;
    publicPackagesUrl: string;
    publicBookingFormUrl: string;
    onClose: () => void;
    showNotification: (message: string) => void;
    setProfile: React.Dispatch<React.SetStateAction<Profile>>;
}

const ShareMessageModal: React.FC<ShareMessageModalProps> = ({ type, lead, userProfile, publicPackagesUrl, publicBookingFormUrl, onClose, showNotification, setProfile }) => {
    const [message, setMessage] = useState('');
    const [galleries, setGalleries] = useState<Gallery[]>([]);
    const [selectedGalleryId, setSelectedGalleryId] = useState<string>('');
    const [packageSource, setPackageSource] = useState<'public-packages' | 'gallery'>('public-packages');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const [selectedRegion, setSelectedRegion] = useState<string>(() => {
        const loc = (lead.location || '').toLowerCase().trim();
        if (!loc) return '';
        const found = REGIONS.find(r => r.value.toLowerCase() === loc || r.label.toLowerCase() === loc || loc.includes(r.value.toLowerCase()));
        return found ? found.value : '';
    });

    const handleCopy = (url: string, key: string, label: string) => {
        navigator.clipboard.writeText(url);
        setCopiedKey(key);
        showNotification(`Tautan ${label} berhasil disalin!`);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Load galleries from Pricelist Upload (ViewType.GALLERY)
    useEffect(() => {
        (async () => {
            try {
                const all = await listGalleries();
                const availableGalleries = (all || []).filter(g => g.is_public !== false);
                const listToUse = availableGalleries.length > 0 ? availableGalleries : (all || []);
                setGalleries(listToUse);

                if (listToUse.length > 0) {
                    // Coba cocokkan dengan lokasi lead jika ada
                    const leadLoc = (lead.location || '').toLowerCase().trim();
                    const matched = leadLoc
                        ? listToUse.find(g =>
                            (g.region && g.region.toLowerCase().includes(leadLoc)) ||
                            (g.region && leadLoc.includes(g.region.toLowerCase())) ||
                            g.title.toLowerCase().includes(leadLoc)
                        )
                        : null;
                    setSelectedGalleryId(matched ? matched.id : listToUse[0].id);
                }
            } catch (e) {
                console.warn('Failed to load galleries for share modal', e);
            }
        })();
    }, [lead.location]);

    const selectedGallery = useMemo(() => galleries.find(g => g.id === selectedGalleryId) || null, [galleries, selectedGalleryId]);

    // Build URL for public packages per region with lead tracking params
    const buildPublicPackageLinkForRegion = (regValue?: string) => {
        const slug = toPublicNameSlug(lead.name);
        const shortId = lead.id.slice(0, 8);
        const params = new URLSearchParams();
        if (regValue) {
            params.set('region', regValue);
        }
        params.set('lid', shortId);
        params.set('leadName', slug);
        return `${publicPackagesUrl}?${params.toString()}`;
    };

    const selectedPublicPackageLink = useMemo(() => {
        return buildPublicPackageLinkForRegion(selectedRegion);
    }, [publicPackagesUrl, selectedRegion, lead.id, lead.name]);

    // Tautan Pricelist langsung dari Pricelist Upload — pakai short ID (8 char) untuk identifikasi akurat
    const selectedGalleryLink = useMemo(() => {
        const slug = toPublicNameSlug(lead.name);
        const shortId = lead.id.slice(0, 8);
        if (!selectedGallery) {
            return `${publicPackagesUrl}?lid=${encodeURIComponent(shortId)}&leadName=${encodeURIComponent(slug)}`;
        }
        const routeId = getGalleryPublicRouteId(selectedGallery, galleries);
        return buildPublicShareUrl('gallery', routeId, { query: { lid: shortId, leadName: slug } });
    }, [selectedGallery, galleries, lead.id, lead.name, publicPackagesUrl]);

    const activePackageLink = packageSource === 'public-packages' ? selectedPublicPackageLink : selectedGalleryLink;

    const bookingUrlWithName = useMemo(() => {
        const shortId = lead.id.slice(0, 8);
        return `${publicBookingFormUrl}?lid=${encodeURIComponent(shortId)}&leadName=${encodeURIComponent(toPublicNameSlug(lead.name))}`;
    }, [publicBookingFormUrl, lead.id, lead.name]);

    useEffect(() => {
        let template = '';
        if (type === 'package') {
            const raw = userProfile.packageShareTemplate || 'Halo {leadName},\n\nTerima kasih telah menghubungi {companyName}. Berikut tautan Pricelist & Paket lengkap kami yang dapat Anda lihat:\n\n{packageLink}\n\nSilakan pilih paket yang sesuai dan lakukan booking langsung melalui tautan di atas ya!\n\nSalam,\n{companyName}';
            template = raw
                .replace('{leadName}', lead.name)
                .replace('{companyName}', userProfile.companyName)
                .replace('{packageLink}', activePackageLink);
        } else {
            const raw = userProfile.bookingFormTemplate || 'Halo {leadName},\n\nTerima kasih atas ketertarikan Anda menggunakan layanan {companyName}.\n\nBerikut tautan formulir booking resmi kami untuk melengkapi data Acara Pernikahan Anda:\n\n{bookingFormLink}\n\nMohon lengkapi formulir tersebut agar jadwal Anda dapat segera kami kunci.\n\nSalam,\n{companyName}';
            template = raw
                .replace('{leadName}', lead.name)
                .replace('{companyName}', userProfile.companyName)
                .replace('{bookingFormLink}', bookingUrlWithName);
        }
        setMessage(template);
    }, [type, lead.name, userProfile.packageShareTemplate, userProfile.bookingFormTemplate, userProfile.companyName, activePackageLink, bookingUrlWithName]);

    const handleSwitchSource = (newSource: 'public-packages' | 'gallery') => {
        const oldLink = activePackageLink;
        const newLink = newSource === 'public-packages' ? selectedPublicPackageLink : selectedGalleryLink;
        setPackageSource(newSource);
        if (oldLink && newLink && oldLink !== newLink) {
            if (message.includes(oldLink)) {
                setMessage(prev => prev.replace(oldLink, newLink));
            } else if (message.includes('{packageLink}')) {
                setMessage(prev => prev.replace('{packageLink}', newLink));
            }
        }
    };

    const handleSelectRegion = (regValue: string) => {
        const oldLink = selectedPublicPackageLink;
        setSelectedRegion(regValue);
        const newLink = buildPublicPackageLinkForRegion(regValue);
        if (packageSource === 'public-packages') {
            if (oldLink && message.includes(oldLink)) {
                setMessage(prev => prev.replace(oldLink, newLink));
            } else if (message.includes('{packageLink}')) {
                setMessage(prev => prev.replace('{packageLink}', newLink));
            }
        }
    };

    const handleApplyLinkToMessage = (linkToApply: string, label: string) => {
        if (message.includes(linkToApply)) {
            showNotification(`Tautan ${label} sudah ada di dalam pesan.`);
            return;
        }
        const currentLinkInMsg = activePackageLink;
        if (currentLinkInMsg && message.includes(currentLinkInMsg)) {
            setMessage(prev => prev.replace(currentLinkInMsg, linkToApply));
        } else if (message.includes('{packageLink}')) {
            setMessage(prev => prev.replace('{packageLink}', linkToApply));
        } else {
            setMessage(prev => (prev ? `${prev}\n\nLink Paket: ${linkToApply}` : linkToApply));
        }
        showNotification(`Tautan ${label} berhasil dimasukkan ke pesan.`);
    };

    const handleGalleryChange = (newGalleryId: string) => {
        const previousLink = selectedGalleryLink;
        setSelectedGalleryId(newGalleryId);
        const newGallery = galleries.find(g => g.id === newGalleryId);
        if (newGallery) {
            const newRouteId = getGalleryPublicRouteId(newGallery, galleries);
            const newLink = buildPublicShareUrl('gallery', newRouteId, { query: { lid: lead.id.slice(0, 8), leadName: toPublicNameSlug(lead.name) } });
            if (previousLink && message.includes(previousLink)) {
                setMessage(prev => prev.replace(previousLink, newLink));
            } else if (message.includes('{packageLink}')) {
                setMessage(prev => prev.replace('{packageLink}', newLink));
            } else {
                setMessage(prev => (prev ? `${prev}\n\n${newLink}` : newLink));
            }
        }
    };

    const handleInsertPricelistLink = () => {
        if (!selectedGalleryLink) return;
        handleApplyLinkToMessage(selectedGalleryLink, 'Pricelist');
    };

    const handleCopyPricelistLink = () => {
        if (selectedGalleryLink) {
            handleCopy(selectedGalleryLink, 'pricelist', 'Pricelist');
        }
    };

    const handleShareToWhatsApp = () => {
        if (!lead.whatsapp) { showNotification('Nomor WhatsApp untuk Calon Pengantin ini tidak tersedia.'); return; }
        const whatsappUrl = `https://wa.me/${cleanPhoneNumber(lead.whatsapp)}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleSaveTemplate = async () => {
        let rawTemplate = message;
        try {
            if (type === 'package') {
                rawTemplate = message
                    .replace(new RegExp(escapeRegExp(lead.name), 'g'), '{leadName}')
                    .replace(new RegExp(escapeRegExp(userProfile.companyName), 'g'), '{companyName}');
                if (activePackageLink) {
                    rawTemplate = rawTemplate.replace(new RegExp(escapeRegExp(activePackageLink), 'g'), '{packageLink}');
                }
                setProfile(prev => ({ ...prev, packageShareTemplate: rawTemplate }));
                await upsertProfile({ id: userProfile.id, packageShareTemplate: rawTemplate });
            } else {
                rawTemplate = message
                    .replace(new RegExp(escapeRegExp(lead.name), 'g'), '{leadName}')
                    .replace(new RegExp(escapeRegExp(userProfile.companyName), 'g'), '{companyName}')
                    .replace(new RegExp(escapeRegExp(bookingUrlWithName), 'g'), '{bookingFormLink}');
                setProfile(prev => ({ ...prev, bookingFormTemplate: rawTemplate }));
                await upsertProfile({ id: userProfile.id, bookingFormTemplate: rawTemplate });
            }
            showNotification('Template berhasil disimpan!');
        } catch (err) {
            console.warn('[Supabase] upsert profile template failed', err);
            showNotification('Gagal menyimpan template. Coba lagi.');
        }
    };

    const title = type === 'package' ? `Bagikan Package ke ${lead.name}` : `Kirim Form Booking ke ${lead.name}`;

    return (
        <Modal isOpen={true} onClose={onClose} title={title} size="lg">
            <div className="space-y-4">
                {type === 'package' && (
                    <div className="space-y-3">
                        {/* Selector Tab: Tautan Paket Publik per Wilayah VS Pricelist Upload */}
                        <div className="flex items-center gap-1.5 p-1 bg-[#F4F6F9] rounded-xl border border-[#EAEFF4]">
                            <button
                                type="button"
                                onClick={() => handleSwitchSource('public-packages')}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                    packageSource === 'public-packages'
                                        ? 'bg-white text-[#5D87FF] shadow-xs'
                                        : 'text-[#5A6A85] hover:text-[#2A3547]'
                                }`}
                            >
                                <PackageIconLucide className="w-3.5 h-3.5" />
                                <span>Katalog Paket Publik (per Wilayah)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSwitchSource('gallery')}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                    packageSource === 'gallery'
                                        ? 'bg-white text-[#5D87FF] shadow-xs'
                                        : 'text-[#5A6A85] hover:text-[#2A3547]'
                                }`}
                            >
                                <LinkIcon className="w-3.5 h-3.5" />
                                <span>Pricelist Upload</span>
                            </button>
                        </div>

                        {/* Mode 1: Katalog Paket Publik per Wilayah */}
                        {packageSource === 'public-packages' && (
                            <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80 space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span className="text-xs sm:text-sm font-bold text-[#1E3A8A] inline-flex items-center gap-1.5">
                                        <PackageIconLucide className="w-4 h-4 text-[#3563E9]" />
                                        Tautan Paket Publik (/#/public-packages)
                                    </span>
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                        Tersambung ke Lead ID
                                    </span>
                                </div>

                                {/* Region Selector Tabs */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-bold text-[#5A6A85] uppercase tracking-wider">
                                            Pilih Wilayah:
                                        </label>
                                        <a
                                            href={selectedPublicPackageLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[11px] font-semibold text-[#5D87FF] hover:underline inline-flex items-center gap-1"
                                        >
                                            <span>Buka Halaman</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectRegion('')}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center truncate ${
                                                selectedRegion === ''
                                                    ? 'bg-[#5D87FF] text-white shadow-xs'
                                                    : 'bg-white text-[#5A6A85] hover:bg-slate-100 border border-[#EAEFF4]'
                                            }`}
                                        >
                                            Semua Wilayah
                                        </button>
                                        {REGIONS.map((r) => (
                                            <button
                                                key={r.value}
                                                type="button"
                                                onClick={() => handleSelectRegion(r.value)}
                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center truncate ${
                                                    selectedRegion === r.value
                                                        ? 'bg-[#5D87FF] text-white shadow-xs'
                                                        : 'bg-white text-[#5A6A85] hover:bg-slate-100 border border-[#EAEFF4]'
                                                }`}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Active URL box & Quick Actions */}
                                <div className="space-y-2 bg-white p-2.5 rounded-xl border border-blue-100">
                                    <p className="text-[11px] text-[#475569] font-mono break-all bg-[#F9FBFC] p-2 rounded-lg border border-[#EAEFF4] select-all">
                                        {selectedPublicPackageLink}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(selectedPublicPackageLink, 'active-pkg', selectedRegion ? `Wilayah ${selectedRegion}` : 'Semua Wilayah')}
                                            className={`button-secondary flex-1 text-xs py-1.5 flex items-center justify-center gap-1 cursor-pointer ${
                                                copiedKey === 'active-pkg' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : ''
                                            }`}
                                        >
                                            {copiedKey === 'active-pkg' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                            <span>{copiedKey === 'active-pkg' ? 'Tersalin' : 'Salin Link'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleApplyLinkToMessage(selectedPublicPackageLink, selectedRegion ? `Wilayah ${selectedRegion}` : 'Semua Wilayah')}
                                            className="button-primary flex-1 text-xs py-1.5 cursor-pointer"
                                        >
                                            Terapkan ke Pesan
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Mode 2: Pricelist Upload */}
                        {packageSource === 'gallery' && (
                            <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80 space-y-2.5">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span className="text-xs sm:text-sm font-bold text-[#1E3A8A] inline-flex items-center gap-1.5">
                                        <LinkIcon className="w-4 h-4 text-[#3563E9]" />
                                        Pricelist dari Menu Pricelist Upload
                                    </span>
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                        Tersambung ke Lead ID
                                    </span>
                                </div>

                                {galleries.length > 0 ? (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                                            <select
                                                value={selectedGalleryId}
                                                onChange={(e) => handleGalleryChange(e.target.value)}
                                                className="input-field sm:col-span-2 text-xs sm:text-sm bg-white"
                                            >
                                                {galleries.map(g => (
                                                    <option key={g.id} value={g.id}>
                                                        {g.title} {g.region ? `• ${g.region}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="flex gap-1.5 w-full">
                                                <button
                                                    type="button"
                                                    onClick={handleCopyPricelistLink}
                                                    className="button-secondary flex-1 text-xs py-2 cursor-pointer"
                                                    title="Salin tautan Pricelist"
                                                >
                                                    Salin Link
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleInsertPricelistLink}
                                                    className="button-primary flex-1 text-xs py-2 cursor-pointer"
                                                    title="Masukkan tautan ke dalam pesan"
                                                >
                                                    Terapkan
                                                </button>
                                            </div>
                                        </div>
                                        {selectedGalleryLink && (
                                            <p className="text-[11px] text-[#475569] font-mono break-all bg-white p-2 rounded-lg border border-blue-100 select-all">
                                                {selectedGalleryLink}
                                            </p>
                                        )}
                                        <p className="text-[11px] text-[#334155] leading-relaxed">
                                            💡 Tautan di atas diambil dari menu <strong>Pricelist Upload</strong> dan menyertakan ID calon pengantin (<strong>{lead.name}</strong>). Saat calon pengantin membuka & menekan tombol booking di Pricelist ini, status calon pengantin akan otomatis terkonversi akurat.
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                                        <p className="font-semibold">Belum ada Pricelist di menu Pricelist Upload (/#/Pricelist%20Upload).</p>
                                        <p className="mt-0.5 text-[11px] text-amber-700">
                                            Silakan gunakan tab <strong>Katalog Paket Publik</strong> di atas untuk membagikan tautan paket per wilayah (Vendor, Jabodetabek, Banten).
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Form Booking mode preview */}
                {type === 'booking' && (
                    <div className="p-3 bg-brand-bg rounded-lg border border-brand-border space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-medium text-brand-text-light inline-flex items-center gap-1.5">
                                <LinkIcon className="w-4 h-4 text-[#3563E9]" />
                                Link Formulir Booking Calon Pengantin
                            </span>
                            <button
                                type="button"
                                onClick={() => { navigator.clipboard.writeText(bookingUrlWithName); showNotification('Link Booking disalin'); }}
                                className="button-secondary text-xs py-1 px-2.5 cursor-pointer"
                            >
                                Salin Link
                            </button>
                        </div>
                        <p className="text-[11px] text-brand-text-secondary font-mono break-all bg-white/70 p-1.5 rounded-lg border border-slate-100">
                            {bookingUrlWithName}
                        </p>
                    </div>
                )}

                <div className="input-group">
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={9}
                        className="input-field w-full text-xs sm:text-sm"
                        placeholder=" "
                    ></textarea>
                    <label className="input-label">Pesan WhatsApp</label>
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-3 border-t border-brand-border sticky bottom-0 bg-brand-surface">
                    <button onClick={handleSaveTemplate} className="button-secondary w-full sm:w-auto text-xs sm:text-sm cursor-pointer">
                        Simpan Template Ini
                    </button>
                    <button onClick={handleShareToWhatsApp} className="btn-box-wa share-wa-labeled-button inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer">
                        <WhatsappIcon className="w-4 h-4 flex-shrink-0 text-white" />
                        Bagikan ke WhatsApp
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default Leads;
