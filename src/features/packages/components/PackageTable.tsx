import React from 'react';
import { Package } from '../../../types';
import { 
    Camera, 
    Pencil, 
    Copy, 
    Trash2, 
    MapPin, 
    Users, 
    Box, 
    Check, 
    Share2,
    Tag,
    Package as PackageIcon
} from 'lucide-react';
import { customizeUiText, useUiTextOverrides } from '../../../utils/uiTextCustomization';

interface PackageTableProps {
    packages: Package[];
    onEdit: (pkg: Package) => void;
    onDuplicate: (pkg: Package) => void;
    onDelete: (pkgId: string) => void;
    onShare?: (pkg: Package) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
    }).format(amount);
};

export const PackageTable: React.FC<PackageTableProps> = ({
    packages,
    onEdit,
    onDuplicate,
    onDelete,
    onShare,
}) => {
    const uiTextOverrides = useUiTextOverrides();
    const text = (key: string, fallback: string) => customizeUiText(`packages.table.${key}`, fallback, uiTextOverrides);
    return (
        <div className="bg-white rounded-2xl border border-[#EAEFF4] shadow-[0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#F4F6F9] border-b border-[#EAEFF4]">
                            <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-[#5A6A85] w-12 text-center">
                                No
                            </th>
                            <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-[#5A6A85]">
                                {text('name', 'Nama Paket')}
                            </th>
                            <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-[#5A6A85]">
                                {text('category', 'Kategori')}
                            </th>
                            <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-[#5A6A85]">
                                {text('region', 'Wilayah')}
                            </th>
                            <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-[#5A6A85]">
                                {text('price', 'Harga / Variasi')}
                            </th>
                            <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-[#5A6A85]">
                                {text('team', 'Tim Dokumentasi')}
                            </th>
                            <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-[#5A6A85] text-right">
                                {text('actions', 'Aksi')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAEFF4]">
                        {packages.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-14 text-center text-[#5A6A85]">
                                    <div className="w-14 h-14 rounded-2xl bg-[#F4F6F9] border border-[#EAEFF4] flex items-center justify-center mx-auto mb-3 text-[#5A6A85]">
                                        <PackageIcon className="w-7 h-7 opacity-50" />
                                    </div>
                                    <p className="text-sm font-semibold text-[#2A3547]">{customizeUiText('packages.catalog.empty', 'Tidak ada paket yang ditemukan.', uiTextOverrides)}</p>
                                    <p className="text-xs text-[#5A6A85] mt-1">{customizeUiText('packages.catalog.emptyHint', 'Coba sesuaikan kata kunci pencarian atau filter wilayah.', uiTextOverrides)}</p>
                                </td>
                            </tr>
                        ) : (
                            packages.map((pkg, idx) => (
                                <tr 
                                    key={pkg.id} 
                                    className="hover:bg-[#F4F6F9]/60 transition-colors group"
                                >
                                    {/* Number */}
                                    <td className="py-3.5 px-4 text-xs font-semibold text-[#5A6A85] text-center">
                                        {idx + 1}
                                    </td>

                                    {/* Name & Thumb */}
                                    <td className="py-3.5 px-4">
                                        <div className="flex items-center gap-3">
                                            {pkg.coverImage ? (
                                                <img 
                                                    src={pkg.coverImage} 
                                                    alt="" 
                                                    className="w-11 h-11 rounded-xl object-cover border border-[#EAEFF4] flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-11 h-11 rounded-xl bg-[#F4F6F9] border border-[#EAEFF4] flex items-center justify-center text-[#5A6A85] flex-shrink-0">
                                                    <Camera className="w-5 h-5 opacity-40" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-[#2A3547] truncate max-w-xs group-hover:text-[#5D87FF] transition-colors">
                                                    {pkg.name}
                                                </p>
                                                {pkg.digitalItems && pkg.digitalItems.length > 0 && (
                                                    <p className="text-[11px] text-[#5A6A85] truncate max-w-xs mt-0.5 flex items-center gap-1">
                                                        <Check className="w-3 h-3 text-[#13DEB9] flex-shrink-0" />
                                                        <span>{pkg.digitalItems.length} deliverable item</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Category */}
                                    <td className="py-3.5 px-4">
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#5D87FF]/10 text-[#5D87FF]">
                                            <Tag className="w-3 h-3 flex-shrink-0" />
                                            {pkg.category || 'Umum'}
                                        </span>
                                    </td>

                                    {/* Region */}
                                    <td className="py-3.5 px-4">
                                        {pkg.region ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2A3547] bg-[#F4F6F9] border border-[#EAEFF4] px-2.5 py-1 rounded-lg uppercase text-[10px] tracking-wider">
                                                <MapPin className="w-3.5 h-3.5 text-[#5D87FF]" />
                                                {pkg.region}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-[#5A6A85]">—</span>
                                        )}
                                    </td>

                                    {/* Price / Durations */}
                                    <td className="py-3.5 px-4">
                                        {pkg.durationOptions && pkg.durationOptions.length > 0 ? (
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-bold text-[#2A3547]">
                                                    {formatCurrency(
                                                        pkg.durationOptions.find(o => o.default)?.price || 
                                                        pkg.durationOptions[0].price
                                                    )}
                                                </p>
                                                <p className="text-[10px] text-[#5D87FF] font-medium">
                                                    {pkg.durationOptions.length} opsi durasi
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-xs font-bold text-[#2A3547]">
                                                {formatCurrency(pkg.price)}
                                            </p>
                                        )}
                                    </td>

                                    {/* Team */}
                                    <td className="py-3.5 px-4">
                                        {pkg.photographers ? (
                                            <span className="inline-flex items-center gap-1.5 text-xs text-[#5A6A85]">
                                                <Users className="w-4 h-4 text-[#5D87FF] flex-shrink-0" />
                                                <span className="truncate max-w-[140px]">{pkg.photographers}</span>
                                            </span>
                                        ) : (
                                            <span className="text-xs text-[#5A6A85]">—</span>
                                        )}
                                    </td>

                                    {/* Actions */}
                                    <td className="py-3.5 px-4 text-right">
                                        <div className="inline-flex items-center justify-end gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => onEdit(pkg)}
                                                className="p-2 rounded-xl bg-[#F4F6F9] hover:bg-[#ECF2FF] text-[#5A6A85] hover:text-[#5D87FF] border border-transparent hover:border-[#5D87FF]/20 transition-all cursor-pointer"
                                                title="Edit Paket"
                                                aria-label="Edit Paket"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => onDuplicate(pkg)}
                                                className="p-2 rounded-xl bg-[#F4F6F9] hover:bg-[#ECF2FF] text-[#5A6A85] hover:text-[#5D87FF] border border-transparent hover:border-[#5D87FF]/20 transition-all cursor-pointer"
                                                title="Duplikasi ke Wilayah Lain"
                                                aria-label="Duplikasi ke Wilayah Lain"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>

                                            {onShare && (
                                                <button
                                                    type="button"
                                                    onClick={() => onShare(pkg)}
                                                    className="p-2 rounded-xl bg-[#F4F6F9] hover:bg-[#ECF2FF] text-[#5A6A85] hover:text-[#5D87FF] border border-transparent hover:border-[#5D87FF]/20 transition-all cursor-pointer"
                                                    title="Bagikan Tautan"
                                                    aria-label="Bagikan Tautan"
                                                >
                                                    <Share2 className="w-4 h-4" />
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => onDelete(pkg.id)}
                                                className="p-2 rounded-xl bg-[#F4F6F9] hover:bg-rose-50 text-[#5A6A85] hover:text-rose-600 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                                                title="Hapus Paket"
                                                aria-label="Hapus Paket"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
