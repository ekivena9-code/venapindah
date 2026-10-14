import React, { useState } from 'react';
import { Package, DurationOption } from '../../../types';
import { 
    Users, 
    Pencil, 
    Copy, 
    Trash2, 
    Camera, 
    Check, 
    Clock, 
    Box, 
    Share2, 
    MapPin, 
    Tag,
    ChevronUp,
    ChevronDown
} from 'lucide-react';
import { MobileExpandableExtra } from '../../../components/ui/MobileProgressiveDisclosure';
import { customizeUiText, useUiTextOverrides } from '../../../utils/uiTextCustomization';

interface PackageCardProps {
    pkg: Package;
    onEdit: (pkg: Package) => void;
    onDuplicate: (pkg: Package) => void;
    onDelete: (pkgId: string) => void;
    onShare?: (pkg: Package) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    orderIndex?: number;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
    }).format(amount);
};

export const PackageCard: React.FC<PackageCardProps> = ({
    pkg,
    onEdit,
    onDuplicate,
    onDelete,
    onShare,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
    orderIndex,
}) => {
    const uiTextOverrides = useUiTextOverrides();
    const text = (key: string, fallback: string) => customizeUiText(`packages.card.${key}`, fallback, uiTextOverrides);
    // Interactive selected duration option (if duration options exist)
    const [selectedDurationIdx, setSelectedDurationIdx] = useState<number>(() => {
        if (pkg.durationOptions && pkg.durationOptions.length > 0) {
            const defIdx = pkg.durationOptions.findIndex(o => o.default);
            return defIdx !== -1 ? defIdx : 0;
        }
        return -1;
    });

    const activeOption: DurationOption | null = 
        pkg.durationOptions && pkg.durationOptions.length > 0 && selectedDurationIdx >= 0
            ? pkg.durationOptions[selectedDurationIdx] || pkg.durationOptions[0]
            : null;

    const currentPrice = activeOption ? activeOption.price : pkg.price;
    const currentTeam = activeOption?.photographers || pkg.photographers;
    const currentDigitalItems = (activeOption?.digitalItems && activeOption.digitalItems.length > 0)
        ? activeOption.digitalItems
        : pkg.digitalItems || [];
    const currentPhysicalItems = (activeOption?.physicalItems && activeOption.physicalItems.length > 0)
        ? activeOption.physicalItems
        : pkg.physicalItems || [];

    return (
        <div className="h-full bg-white rounded-xl sm:rounded-2xl border border-[#EAEFF4] shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)] hover:border-[#5D87FF]/30 transition-all duration-300 flex flex-col overflow-hidden group">
            {/* ── Cover Image Header ── */}
            <div className="relative h-24 sm:h-36 lg:h-48 w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                {pkg.coverImage ? (
                    <img 
                        src={pkg.coverImage} 
                        alt={pkg.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                        loading="lazy" 
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 bg-[#F4F6F9]">
                        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-white/90 border border-[#EAEFF4] flex items-center justify-center shadow-sm text-[#5A6A85]">
                            <Camera className="w-4 h-4 sm:w-6 sm:h-6 opacity-50" />
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-medium text-[#5A6A85]/70">{text('coverEmpty', 'Tanpa Foto Sampul')}</span>
                    </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/30" />

                {/* Badges on Cover */}
                <div className="absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-3 flex flex-wrap items-start justify-between gap-1.5">
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-[8px] sm:text-[10px] font-semibold px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 shadow-sm">
                        <Tag className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#49BEFF] flex-shrink-0" />
                        <span className="min-w-0 truncate max-w-[90px] sm:max-w-[120px]">{pkg.category || 'Umum'}</span>
                    </span>

                    <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5">
                        {pkg.region && (
                            <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-[7px] sm:text-[9px] font-semibold px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white/95 text-[#2A3547] backdrop-blur-md shadow-sm uppercase tracking-wider">
                                <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#5D87FF] flex-shrink-0" />
                                <span className="min-w-0 max-w-[90px] truncate">{pkg.region}</span>
                            </span>
                        )}
                        {(onMoveUp || onMoveDown) && (
                            <div className="inline-flex items-center gap-0.5 bg-white/95 backdrop-blur-md px-1.5 py-0.5 rounded-full shadow-sm border border-white/40">
                                {orderIndex !== undefined && (
                                    <span className="text-[9px] font-bold text-[#5A6A85] px-0.5">#{orderIndex + 1}</span>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
                                    disabled={!canMoveUp}
                                    className="w-5 h-5 rounded-full bg-[#F4F6F9] hover:bg-[#5D87FF] text-[#5A6A85] hover:text-white flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                                    title="Pindah ke Atas"
                                    aria-label="Pindah ke Atas"
                                >
                                    <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
                                    disabled={!canMoveDown}
                                    className="w-5 h-5 rounded-full bg-[#F4F6F9] hover:bg-[#5D87FF] text-[#5A6A85] hover:text-white flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                                    title="Pindah ke Bawah"
                                    aria-label="Pindah ke Bawah"
                                >
                                    <ChevronDown className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Price display pinned on bottom-left of cover */}
                <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[8px] sm:text-[10px] uppercase font-semibold tracking-wider text-white/80">{text('investment', 'Investasi')}</p>
                        <p className="text-xs sm:text-lg lg:text-xl font-bold text-white drop-shadow-sm leading-tight truncate">
                            {formatCurrency(currentPrice)}
                        </p>
                    </div>
                    {pkg.durationOptions && pkg.durationOptions.length > 1 && (
                        <span className="text-[7px] sm:text-[10px] font-medium bg-black/40 text-white/90 px-1.5 py-0.5 sm:px-2 rounded-md backdrop-blur-sm border border-white/10 flex items-center gap-1 flex-shrink-0">
                            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white/80" />
                            <span>{pkg.durationOptions.length} durasi</span>
                        </span>
                    )}
                </div>
            </div>

            {/* ── Card Content ── */}
            <div className="p-2 sm:p-3.5 lg:p-5 flex-1 flex flex-col gap-1.5 sm:gap-2.5 lg:gap-3.5">
                {/* Package Name & Team Info */}
                <div>
                    <h3 className="font-bold text-xs sm:text-sm lg:text-base text-[#2A3547] leading-snug group-hover:text-[#5D87FF] transition-colors line-clamp-2">
                        {pkg.name}
                    </h3>
                    {currentTeam && (
                        <p className="text-[10px] sm:text-xs text-[#5A6A85] mt-1 sm:mt-1.5 flex items-center gap-1 font-medium">
                            <Users className="w-3 h-3 sm:w-4 sm:h-4 text-[#5D87FF] flex-shrink-0" />
                            <span className="truncate">{currentTeam}</span>
                        </p>
                    )}
                </div>

                {/* Desktop / Tablet: Duration Options, Deliverables & Physical Items */}
                <div className="hidden sm:flex flex-col gap-2.5 lg:gap-3.5 flex-1">
                    {pkg.durationOptions && pkg.durationOptions.length > 0 && (
                        <div className="bg-[#F4F6F9]/80 rounded-lg sm:rounded-xl p-1.25 sm:p-2.5 border border-[#EAEFF4]">
                            <div className="flex items-center justify-between mb-1.25">
                                <span className="text-[8px] sm:text-[10px] uppercase font-bold tracking-wider text-[#5A6A85] flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-[#5D87FF] flex-shrink-0" />
                                    <span>{text('durationOptions', 'Pilihan Durasi')}</span>
                                </span>
                                {activeOption && (
                                    <span className="text-[10px] sm:text-[11px] font-bold text-[#5D87FF]">
                                        {formatCurrency(activeOption.price)}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1 sm:gap-1.5">
                                {pkg.durationOptions.map((opt, idx) => {
                                    const isSelected = idx === selectedDurationIdx;
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setSelectedDurationIdx(idx)}
                                            className={`px-1.5 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1 min-h-[36px] sm:min-h-[40px] touch-manipulation cursor-pointer ${
                                                isSelected
                                                    ? 'bg-[#5D87FF] text-white shadow-xs'
                                                    : 'bg-white text-[#5A6A85] hover:text-[#2A3547] border border-[#EAEFF4]'
                                            }`}
                                        >
                                            <span>{opt.label || `Opsi ${idx + 1}`}</span>
                                            {opt.default && !isSelected && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#13DEB9]" title="Default" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Deliverables / Digital Items */}
                    {currentDigitalItems.length > 0 && (
                        <div className="space-y-1 sm:space-y-1.5">
                            <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-[#5A6A85]">
                                {text('deliverables', 'Yang Didapatkan')}
                            </p>
                            <ul className="space-y-1">
                                {currentDigitalItems.map((item, idx) => (
                                    <li key={idx} className="text-xs text-[#2A3547] flex items-start gap-1.5 sm:gap-2">
                                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#13DEB9] mt-0.5 flex-shrink-0 stroke-[2.5]" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Physical / Vendor Items */}
                    {currentPhysicalItems.length > 0 && (
                        <div className="pt-0.5">
                            <div className="flex flex-wrap gap-1.5">
                                {currentPhysicalItems.map((item, idx) => (
                                    <span 
                                        key={idx} 
                                        className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-[#F4F6F9] border border-[#EAEFF4] text-[#5A6A85]"
                                    >
                                        <Box className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#5D87FF] flex-shrink-0" />
                                        <span>{typeof item === 'string' ? item : item.name}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Mobile Progressive Disclosure: Rincian & Aksi */}
                <div className="sm:hidden mt-auto">
                    <MobileExpandableExtra
                        labelOpen={text('detailsOpen', 'Rincian & Aksi')}
                        labelClose={text('detailsClose', 'Tutup')}
                        headerRight={
                            <button
                                type="button"
                                onClick={() => onEdit(pkg)}
                                className="mobile-touch-target-icon flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-lg bg-[#ECF2FF] text-[#5D87FF]"
                                title={text('edit', 'Edit Paket')}
                                aria-label={text('edit', 'Edit Paket')}
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        }
                    >
                        <div className="space-y-2">
                            {pkg.durationOptions && pkg.durationOptions.length > 0 && (
                                <div className="bg-[#F4F6F9]/80 rounded-lg p-1.5 border border-[#EAEFF4]">
                                    <span className="text-[9px] uppercase font-bold tracking-wider text-[#5A6A85] block mb-1">
                                        {text('durationOptions', 'Pilihan Durasi')}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                        {pkg.durationOptions.map((opt, idx) => {
                                            const isSelected = idx === selectedDurationIdx;
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setSelectedDurationIdx(idx)}
                                                    className={`px-1.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                                                        isSelected
                                                            ? 'bg-[#5D87FF] text-white'
                                                            : 'bg-white text-[#5A6A85] border border-[#EAEFF4]'
                                                    }`}
                                                >
                                                    {opt.label || `Opsi ${idx + 1}`}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {currentDigitalItems.length > 0 && (
                                <ul className="space-y-0.5">
                                    {currentDigitalItems.map((item, idx) => (
                                        <li key={idx} className="text-[10px] text-[#2A3547] flex items-start gap-1">
                                            <Check className="w-3 h-3 text-[#13DEB9] mt-0.5 flex-shrink-0" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <div className="flex items-center gap-1.5 pt-1 border-t border-[#EAEFF4]">
                                <button
                                    type="button"
                                    onClick={() => onDuplicate(pkg)}
                                    className="flex-1 py-1.5 rounded-lg bg-[#F4F6F9] text-[#5A6A85] border border-[#EAEFF4] text-[10px] font-semibold flex items-center justify-center gap-1"
                                    title={text('duplicate', 'Salin')}
                                >
                                    <Copy className="w-3 h-3" /> {text('duplicate', 'Salin')}
                                </button>
                                {onShare && (
                                    <button
                                        type="button"
                                        onClick={() => onShare(pkg)}
                                        className="flex-1 py-1.5 rounded-lg bg-[#F4F6F9] text-[#5A6A85] border border-[#EAEFF4] text-[10px] font-semibold flex items-center justify-center gap-1"
                                        title={text('share', 'Bagikan')}
                                    >
                                        <Share2 className="w-3 h-3" /> {text('share', 'Bagikan')}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onDelete(pkg.id)}
                                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center"
                                    title="Hapus"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </MobileExpandableExtra>
                </div>

                {/* ── Desktop Action Buttons Footer ── */}
                <div className="hidden sm:flex pt-3 border-t border-[#EAEFF4] mt-auto items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onEdit(pkg)}
                        className="flex-1 min-h-[40px] py-1.5 px-3 rounded-xl bg-[#ECF2FF] hover:bg-[#5D87FF] text-[#5D87FF] hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 group/btn cursor-pointer shadow-xs touch-manipulation"
                        title={text('edit', 'Edit Paket')}
                        aria-label={text('edit', 'Edit Paket')}
                    >
                        <Pencil className="w-4 h-4 transition-transform group-hover/btn:scale-110 flex-shrink-0" />
                        <span className="inline">{text('edit', 'Edit Paket')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onDuplicate(pkg)}
                        className="w-10 h-10 rounded-xl bg-[#F4F6F9] hover:bg-[#ECF2FF] text-[#5A6A85] hover:text-[#5D87FF] border border-[#EAEFF4] transition-all cursor-pointer flex items-center justify-center flex-shrink-0 touch-manipulation"
                        title="Duplikasi ke Wilayah Lain"
                        aria-label="Duplikasi ke Wilayah Lain"
                    >
                        <Copy className="w-4 h-4" />
                    </button>

                    {onShare && (
                        <button
                            type="button"
                            onClick={() => onShare(pkg)}
                            className="w-10 h-10 rounded-xl bg-[#F4F6F9] hover:bg-[#ECF2FF] text-[#5A6A85] hover:text-[#5D87FF] border border-[#EAEFF4] transition-all cursor-pointer flex items-center justify-center flex-shrink-0 touch-manipulation"
                            title="Bagikan Tautan Paket"
                            aria-label="Bagikan Tautan Paket"
                        >
                            <Share2 className="w-4 h-4" />
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => onDelete(pkg.id)}
                        className="w-10 h-10 rounded-xl bg-[#F4F6F9] hover:bg-rose-50 text-[#5A6A85] hover:text-rose-600 border border-[#EAEFF4] hover:border-rose-200 transition-all cursor-pointer flex items-center justify-center flex-shrink-0 touch-manipulation"
                        title="Hapus Paket"
                        aria-label="Hapus Paket"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
