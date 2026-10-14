import React, { useState, useEffect, useMemo } from 'react';
import {
    Package,
    AddOn,
    Project,
    Profile,
    NavigationAction,
    REGIONS,
    Region,
    PhysicalItem,
    DurationOption,
    WorkflowItem,
    PackageTermItem,
    RegionPricelistPdf,
} from '../../types';
import {
    createPackage,
    updatePackage,
    deletePackage,
} from '../../services/packages';
import {
    createAddOn,
    updateAddOn,
    deleteAddOn,
} from '../../services/addOns';
import { upsertProfile } from '../../services/profile';

import { PackageCard } from './components/PackageCard';
import { PackageModal } from './components/PackageModal';
import { DuplicatePackageModal } from './components/DuplicatePackageModal';
import { DuplicateAddOnModal } from './components/DuplicateAddOnModal';
import { SharePackageModal } from './components/SharePackageModal';
import { PackageGuideModal } from './components/PackageGuideModal';
import { WorkflowModal } from './components/WorkflowModal';
import { PackageTermsModal } from './components/PackageTermsModal';
import { RegionPricelistModal } from './components/RegionPricelistModal';
import { buildPublicShareUrl, getPackageShareIdentifier } from '../../utils/publicRouting';

import {
    Package as PackageIcon,
    Plus,
    Share2,
    HelpCircle,
    Search,
    LayoutGrid,
    List,
    Sparkles,
    Tag,
    DollarSign,
    Pencil,
    Copy,
    Trash2,
    MapPin,
    X,
    FileText,
    Download,
    Upload,
    Link as LinkIcon,
    ExternalLink,
    ChevronUp,
    ChevronDown,
    GripVertical
} from 'lucide-react';
import RupiahInput from '../../shared/form/RupiahInput';
import { customizeUiText, useUiTextOverrides } from '../../utils/uiTextCustomization';

export interface PackagesProps {
    packages: Package[];
    setPackages: React.Dispatch<React.SetStateAction<Package[]>>;
    addOns: AddOn[];
    setAddOns: React.Dispatch<React.SetStateAction<AddOn[]>>;
    projects: Project[];
    profile: Profile;
    setProfile: React.Dispatch<React.SetStateAction<Profile>>;
    showNotification: (message: string) => void;
    initialAction: NavigationAction | null;
    setInitialAction: (action: NavigationAction | null) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
    }).format(amount);
};

const emptyPackageForm = {
    name: '',
    price: '',
    category: '',
    region: '' as '' | Region,
    processingTime: '',
    photographers: '',
    videographers: '',
    physicalItems: [{ name: '', price: '' }],
    digitalItems: [''],
    coverImage: '',
    durationOptions: [
        { label: '4 Jam', price: '', default: true },
        { label: '8 Jam', price: '', default: false },
        { label: 'Full Day', price: '', default: false }
    ],
};

const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

const titleCase = (s: string) =>
    s ? s.replace(/\b\w/g, c => c.toUpperCase()) : '';

interface AddOnEditorModalProps {
    isOpen: boolean;
    addOn: AddOn | null;
    regionFilter: string;
    unionRegions: { value: string; label: string }[];
    onClose: () => void;
    onSave: (data: { id?: string; name: string; price: number; region?: string }) => Promise<void>;
}

const AddOnEditorModal: React.FC<AddOnEditorModalProps> = ({ isOpen, addOn, regionFilter, unionRegions, onClose, onSave }) => {
    const [formData, setFormData] = useState({ name: '', price: '', region: '' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setFormData(addOn
            ? { name: addOn.name, price: addOn.price.toString(), region: addOn.region || '' }
            : { name: '', price: '', region: regionFilter || '' });
    }, [isOpen, addOn, regionFilter]);

    if (!isOpen) return null;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!formData.name.trim() || !formData.price) {
            alert('Nama Add-On dan Harga wajib diisi.');
            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                id: addOn?.id,
                name: formData.name.trim(),
                price: Number(formData.price),
                region: formData.region.trim() ? formData.region.trim().toLowerCase() : undefined,
            });
            onClose();
        } catch (error) {
            console.error('Error saving add-on:', error);
            alert('Gagal menyimpan Add-On. Silakan coba lagi.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl border border-[#EAEFF4] shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 sm:space-y-5 animate-scale-up my-auto max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-[#EAEFF4]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#5D87FF]/10 flex items-center justify-center text-[#5D87FF]">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <h3 className="font-bold text-sm sm:text-base text-[#2A3547]">
                            {addOn ? 'Edit Layanan Add-On' : 'Tambah Add-On Baru'}
                        </h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#5A6A85] hover:text-[#2A3547] hover:bg-[#F4F6F9]">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 overflow-y-auto flex-1 pr-1">
                    <div>
                        <label className="block text-xs font-bold text-[#2A3547] mb-1.5 uppercase tracking-wider">Nama Layanan Add-On</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={event => setFormData(prev => ({ ...prev, name: event.target.value }))}
                            placeholder="Contoh: Drone Pilot, Extra Jam, Live Streaming..."
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] text-sm text-[#2A3547] outline-none transition-all placeholder:text-[#5A6A85]/50"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#2A3547] mb-1.5 uppercase tracking-wider">Harga (IDR)</label>
                        <RupiahInput
                            value={formData.price}
                            onChange={raw => setFormData(prev => ({ ...prev, price: raw }))}
                            placeholder="Contoh: 1.500.000"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] text-sm text-[#2A3547] outline-none transition-all placeholder:text-[#5A6A85]/50 font-semibold"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#2A3547] mb-1.5 uppercase tracking-wider">Wilayah (Opsional)</label>
                        <input
                            type="text"
                            list="catalog-addon-regions"
                            value={formData.region}
                            onChange={event => setFormData(prev => ({ ...prev, region: event.target.value }))}
                            placeholder="Kosongkan jika berlaku untuk semua wilayah"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] text-sm text-[#2A3547] outline-none transition-all placeholder:text-[#5A6A85]/50"
                        />
                        <datalist id="catalog-addon-regions">
                            {unionRegions.map(region => <option key={region.value} value={region.value}>{region.label}</option>)}
                        </datalist>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {unionRegions.map(region => (
                                <button
                                    key={region.value}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, region: region.value }))}
                                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-colors ${formData.region.toLowerCase() === region.value.toLowerCase() ? 'bg-[#5D87FF] text-white border-[#5D87FF]' : 'bg-white border-[#EAEFF4] text-[#5A6A85] hover:border-[#5D87FF]/50'}`}
                                >
                                    {region.label}
                                </button>
                            ))}
                            {formData.region && (
                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, region: '' }))} className="px-2 py-0.5 rounded-lg text-[11px] font-medium border bg-rose-50 border-rose-200 text-rose-600">
                                    Hapus Wilayah
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2.5 pt-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 rounded-xl border border-[#EAEFF4] bg-white hover:bg-[#F4F6F9] text-[#5A6A85] font-semibold text-xs transition-colors">Batal</button>
                        <button type="submit" disabled={isSaving} className="flex-1 py-2.5 px-4 rounded-xl bg-[#5D87FF] hover:bg-[#4871e3] text-white font-semibold text-xs transition-all shadow-[0_4px_12px_rgba(93,135,255,0.25)] disabled:opacity-50">
                            {isSaving ? 'Menyimpan...' : addOn ? 'Simpan Perubahan' : 'Tambahkan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface CatalogItemCardProps {
    addOn: AddOn;
    onEdit: (addOn: AddOn) => void;
    onDuplicate: (addOn: AddOn) => void;
    onDelete: (id: string) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    orderIndex?: number;
}

const CatalogItemCard: React.FC<CatalogItemCardProps> = ({
    addOn,
    onEdit,
    onDuplicate,
    onDelete,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
    orderIndex
}) => (
    <article className="h-full min-h-[150px] bg-white rounded-xl sm:rounded-2xl border border-[#EAEFF4] shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:border-[#5D87FF]/30 p-3.5 sm:p-4 flex flex-col justify-between gap-3 transition-all">
        <div>
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                    <span className="w-8 h-8 rounded-xl bg-[#49BEFF]/10 text-[#49BEFF] flex items-center justify-center flex-shrink-0"><Sparkles className="w-4 h-4" /></span>
                    {(onMoveUp || onMoveDown) && (
                        <div className="inline-flex items-center gap-0.5 bg-[#F4F6F9] px-1 py-0.5 rounded-lg border border-[#EAEFF4]">
                            {orderIndex !== undefined && (
                                <span className="text-[9px] font-bold text-[#5A6A85] px-1">#{orderIndex + 1}</span>
                            )}
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
                                disabled={!canMoveUp}
                                className="w-5 h-5 rounded-md bg-white hover:bg-[#49BEFF] text-[#5A6A85] hover:text-white flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed transition-colors shadow-2xs"
                                title="Pindah ke Atas"
                                aria-label="Pindah ke Atas"
                            >
                                <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
                                disabled={!canMoveDown}
                                className="w-5 h-5 rounded-md bg-white hover:bg-[#49BEFF] text-[#5A6A85] hover:text-white flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed transition-colors shadow-2xs"
                                title="Pindah ke Bawah"
                                aria-label="Pindah ke Bawah"
                            >
                                <ChevronDown className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
                <span className="text-[10px] font-medium text-[#5A6A85] bg-[#F4F6F9] px-2 py-0.5 rounded-md">{addOn.region || 'Semua Wilayah'}</span>
            </div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#49BEFF]">Add-On</p>
            <h3 className="font-bold text-sm text-[#2A3547] leading-snug">{addOn.name}</h3>
        </div>
        <div className="pt-2 border-t border-[#EAEFF4] flex items-center justify-between gap-2">
            <p className="font-bold text-sm text-[#5D87FF] truncate">{formatCurrency(addOn.price)}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
                <button type="button" onClick={() => onEdit(addOn)} className="w-8 h-8 rounded-lg text-[#5A6A85] hover:text-[#5D87FF] hover:bg-[#5D87FF]/10 flex items-center justify-center" title="Edit Add-On"><Pencil className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => onDuplicate(addOn)} className="w-8 h-8 rounded-lg text-[#5A6A85] hover:text-[#5D87FF] hover:bg-[#5D87FF]/10 flex items-center justify-center" title="Duplikat Add-On"><Copy className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => onDelete(addOn.id)} className="w-8 h-8 rounded-lg text-[#5A6A85] hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center" title="Hapus Add-On"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
        </div>
    </article>
);

export const Packages: React.FC<PackagesProps> = ({
    packages,
    setPackages,
    addOns,
    setAddOns,
    projects,
    profile,
    setProfile,
    showNotification,
    initialAction,
    setInitialAction,
}) => {
    const uiTextOverrides = useUiTextOverrides();
    const text = (key: string, fallback: string) => customizeUiText(`packages.catalog.${key}`, fallback, uiTextOverrides);
    // ── Main UI States ──
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
    const [searchTerm, setSearchTerm] = useState('');
    const [regionFilter, setRegionFilter] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [packageOrder, setPackageOrder] = useState<string[]>(() => profile.publicPageConfig?.packageOrder || []);
    const [addOnOrder, setAddOnOrder] = useState<string[]>(() => profile.publicPageConfig?.addOnOrder || []);
    const packageOrderRef = React.useRef(packageOrder);
    const addOnOrderRef = React.useRef(addOnOrder);
    const packageOrderDirty = React.useRef(false);
    const addOnOrderDirty = React.useRef(false);
    const profileRef = React.useRef(profile);
    profileRef.current = profile;
    const catalogOrderSaveState = React.useRef({ isSaving: false, pending: false });

    const persistCatalogOrder = () => {
        catalogOrderSaveState.current.pending = true;
        if (catalogOrderSaveState.current.isSaving) return;

        catalogOrderSaveState.current.isSaving = true;
        void (async () => {
            let didSave = false;
            try {
                while (catalogOrderSaveState.current.pending) {
                    catalogOrderSaveState.current.pending = false;
                    const packageOrderToSave = [...packageOrderRef.current];
                    const addOnOrderToSave = [...addOnOrderRef.current];
                    const currentProfile = profileRef.current;

                    await upsertProfile({
                        id: currentProfile.id,
                        publicPageConfig: {
                            ...currentProfile.publicPageConfig,
                            packageOrder: packageOrderToSave,
                            addOnOrder: addOnOrderToSave,
                        },
                    });
                    didSave = true;

                    if (
                        packageOrderToSave.join('\0') !== packageOrderRef.current.join('\0') ||
                        addOnOrderToSave.join('\0') !== addOnOrderRef.current.join('\0')
                    ) {
                        catalogOrderSaveState.current.pending = true;
                    }
                }
                if (didSave) showNotification('Urutan katalog berhasil diperbarui.');
            } catch (error) {
                console.error('[Packages.order] Failed to save catalog order:', error);
                catalogOrderSaveState.current.pending = false;
                showNotification('Gagal menyimpan urutan. Posisi tetap tampil, tetapi belum tersimpan ke server.');
            } finally {
                catalogOrderSaveState.current.isSaving = false;
            }
        })();
    };

    // ── Modal States ──
    const [packageEditMode, setPackageEditMode] = useState<string | null>(null);
    const [packageFormData, setPackageFormData] = useState<any>(emptyPackageForm);
    const [isSavingPackage, setIsSavingPackage] = useState(false);
    const isSavingPackageRef = React.useRef(false);
    const [copySourcePkg, setCopySourcePkg] = useState<Package | null>(null);
    const [copySourceAddOn, setCopySourceAddOn] = useState<AddOn | null>(null);
    const [isAddOnFormOpen, setIsAddOnFormOpen] = useState(false);
    const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isBookingLinksModalOpen, setIsBookingLinksModalOpen] = useState(false);
    const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [isPricelistModalOpen, setIsPricelistModalOpen] = useState(false);
    const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

    // Initial action handler (e.g. redirected from dashboard with "add" action)
    useEffect(() => {
        if (initialAction?.type === 'add') {
            setPackageEditMode('new');
            setPackageFormData(emptyPackageForm);
            setInitialAction(null);
        }
    }, [initialAction, setInitialAction]);

    // Available Regions calculation
    const existingRegions = useMemo(() => {
        const set = new Set<string>();
        for (const p of packages) {
            if (p.region && String(p.region).trim() !== '') set.add(String(p.region));
        }
        for (const addOn of addOns) {
            if (addOn.region && String(addOn.region).trim() !== '') set.add(String(addOn.region));
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [packages, addOns]);

    const unionRegions = useMemo(() => {
        const baseValues = REGIONS.map(r => r.value.toLowerCase());
        const extra = existingRegions.filter(er => !baseValues.includes(er.toLowerCase()));
        return [
            ...REGIONS.map(r => ({ value: r.value, label: r.label })),
            ...extra.map(er => ({ value: er, label: titleCase(er) })),
        ];
    }, [existingRegions]);

    // Categories list
    const availableCategories = useMemo(() => {
        const cats = new Set<string>(profile.packageCategories || []);
        packages.forEach(p => {
            if (p.category) cats.add(p.category);
        });
        return Array.from(cats).filter(Boolean).sort();
    }, [packages, profile.packageCategories]);

    useEffect(() => {
        const savedPackageOrder = profile.publicPageConfig?.packageOrder || [];
        if (savedPackageOrder.join('\0') === packageOrderRef.current.join('\0')) {
            return;
        }
        if (packageOrderDirty.current || catalogOrderSaveState.current.isSaving || catalogOrderSaveState.current.pending) return;
        packageOrderRef.current = savedPackageOrder;
        setPackageOrder(savedPackageOrder);
    }, [profile.publicPageConfig?.packageOrder]);

    useEffect(() => {
        const savedAddOnOrder = profile.publicPageConfig?.addOnOrder || [];
        if (savedAddOnOrder.join('\0') === addOnOrderRef.current.join('\0')) {
            return;
        }
        if (addOnOrderDirty.current || catalogOrderSaveState.current.isSaving || catalogOrderSaveState.current.pending) return;
        addOnOrderRef.current = savedAddOnOrder;
        setAddOnOrder(savedAddOnOrder);
    }, [profile.publicPageConfig?.addOnOrder]);

    const appendToOrder = (kind: 'package' | 'addOn', id: string) => {
        const orderRef = kind === 'package' ? packageOrderRef : addOnOrderRef;
        const items = kind === 'package' ? packages : addOns;
        const nextOrder = [...orderRef.current];
        items.forEach(item => {
            if (!nextOrder.includes(item.id)) nextOrder.push(item.id);
        });
        if (!nextOrder.includes(id)) nextOrder.push(id);
        orderRef.current = nextOrder;
        if (kind === 'package') {
            packageOrderDirty.current = true;
            setPackageOrder(nextOrder);
        } else {
            addOnOrderDirty.current = true;
            setAddOnOrder(nextOrder);
        }
        setProfile(prev => ({
            ...prev,
            publicPageConfig: {
                ...prev.publicPageConfig,
                packageOrder: kind === 'package' ? nextOrder : packageOrderRef.current,
                addOnOrder: kind === 'addOn' ? nextOrder : addOnOrderRef.current,
            },
        }));
        persistCatalogOrder();
    };

    const removeFromOrder = (kind: 'package' | 'addOn', id: string) => {
        const orderRef = kind === 'package' ? packageOrderRef : addOnOrderRef;
        const nextOrder = orderRef.current.filter(itemId => itemId !== id);
        orderRef.current = nextOrder;
        if (kind === 'package') {
            packageOrderDirty.current = true;
            setPackageOrder(nextOrder);
        } else {
            addOnOrderDirty.current = true;
            setAddOnOrder(nextOrder);
        }
        setProfile(prev => ({
            ...prev,
            publicPageConfig: {
                ...prev.publicPageConfig,
                packageOrder: kind === 'package' ? nextOrder : packageOrderRef.current,
                addOnOrder: kind === 'addOn' ? nextOrder : addOnOrderRef.current,
            },
        }));
        persistCatalogOrder();
    };

    // Helper: sort items by saved order array
    const sortByOrder = <T extends { id: string; name?: string }>(items: T[], order: string[]): T[] => {
        if (!order || order.length === 0) return items;
        const orderMap = new Map(order.map((id, idx) => [id, idx]));
        return [...items].sort((a, b) => {
            const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
            const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
            if (idxA === Infinity && idxB === Infinity) {
                return (a.name || a.id).localeCompare(b.name || b.id);
            }
            return idxA - idxB;
        });
    };

    // Filtered Packages
    const filteredPackages = useMemo(() => {
        const filtered = packages.filter(pkg => {
            const matchesSearch = 
                pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (pkg.category && pkg.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (pkg.photographers && pkg.photographers.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (pkg.digitalItems && pkg.digitalItems.some(d => d.toLowerCase().includes(searchTerm.toLowerCase())));

            const matchesRegion = !regionFilter || (pkg.region && pkg.region.toLowerCase() === regionFilter.toLowerCase());
            const matchesCategory = !categoryFilter || pkg.category === categoryFilter;

            return matchesSearch && matchesRegion && matchesCategory;
        });
        return sortByOrder(filtered, packageOrder);
    }, [packages, searchTerm, regionFilter, categoryFilter, packageOrder]);

    const filteredAddOns = useMemo(() => {
        const filtered = addOns.filter(addOn => {
            const matchesSearch = addOn.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRegion = !regionFilter || (addOn.region && addOn.region.toLowerCase() === regionFilter.toLowerCase());
            return matchesSearch && matchesRegion && !categoryFilter;
        });
        return sortByOrder(filtered, addOnOrder);
    }, [addOns, searchTerm, regionFilter, categoryFilter, addOnOrder]);

    type CatalogEntry = { kind: 'package'; pkg: Package } | { kind: 'addon'; addOn: AddOn };
    const catalogEntries = useMemo<CatalogEntry[]>(() => [
        ...filteredPackages.map(pkg => ({ kind: 'package' as const, pkg })),
        ...filteredAddOns.map(addOn => ({ kind: 'addon' as const, addOn })),
    ], [filteredPackages, filteredAddOns]);

    const packageGroups = useMemo(() => {
        const groups = new Map<string, Package[]>();
        filteredPackages.forEach(pkg => {
            const key = (pkg.region || '').trim().toLowerCase();
            groups.set(key, [...(groups.get(key) || []), pkg]);
        });

        return Array.from(groups.entries())
            .map(([regionKey, items]) => ({
                regionKey,
                label: regionKey
                    ? unionRegions.find(region => region.value.toLowerCase() === regionKey)?.label || titleCase(regionKey)
                    : 'Semua Wilayah',
                items,
            }))
            .sort((a, b) => {
                if (!a.regionKey) return 1;
                if (!b.regionKey) return -1;
                return a.label.localeCompare(b.label);
            });
    }, [filteredPackages, unionRegions]);

    const addOnGroups = useMemo(() => {
        const groups = new Map<string, AddOn[]>();
        filteredAddOns.forEach(addOn => {
            const key = (addOn.region || '').trim().toLowerCase();
            groups.set(key, [...(groups.get(key) || []), addOn]);
        });

        return Array.from(groups.entries())
            .map(([regionKey, items]) => ({
                regionKey,
                label: regionKey
                    ? unionRegions.find(region => region.value.toLowerCase() === regionKey)?.label || titleCase(regionKey)
                    : 'Semua Wilayah',
                items,
            }))
            .sort((a, b) => {
                if (!a.regionKey) return 1;
                if (!b.regionKey) return -1;
                return a.label.localeCompare(b.label);
            });
    }, [filteredAddOns, unionRegions]);

    // Grouping by Category for Cards view
    const packagesByCategory = useMemo(() => {
        const grouped: Record<string, Package[]> = {};
        filteredPackages.forEach(pkg => {
            const cat = pkg.category || 'Tanpa Kategori';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(pkg);
        });
        return grouped;
    }, [filteredPackages]);

    // Stat / KPI Calculations
    const stats = useMemo(() => {
        const allPrices = filteredPackages.flatMap(p => 
            p.durationOptions && p.durationOptions.length > 0 
                ? p.durationOptions.map(o => o.price) 
                : [p.price]
        ).filter(price => price > 0);

        const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
        const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;

        return {
            totalPackages: filteredPackages.length,
            totalAddOns: addOns.length,
            totalCategories: Object.keys(packagesByCategory).length,
            minPrice,
            maxPrice,
        };
    }, [filteredPackages, addOns, packagesByCategory]);

    // ── Package CRUD Handlers ──
    const handleOpenCreatePackage = () => {
        setPackageEditMode('new');
        setPackageFormData({
            ...emptyPackageForm,
            category: availableCategories[0] || '',
            region: regionFilter || '',
        });
    };

    const handleOpenEditPackage = (pkg: Package) => {
        setPackageEditMode(pkg.id);
        setPackageFormData({
            name: pkg.name,
            price: pkg.price.toString(),
            category: pkg.category,
            region: (pkg.region || '') as any,
            processingTime: '',
            photographers: pkg.photographers && pkg.videographers
                ? `${pkg.photographers} & ${pkg.videographers}`
                : (pkg.photographers || pkg.videographers || ''),
            videographers: '',
            physicalItems: pkg.physicalItems && pkg.physicalItems.length > 0 
                ? pkg.physicalItems.map(item => ({ ...item, price: item.price.toString() })) 
                : [{ name: '', price: '' }],
            digitalItems: pkg.digitalItems && pkg.digitalItems.length > 0 ? pkg.digitalItems : [''],
            coverImage: pkg.coverImage || '',
            durationOptions: pkg.durationOptions && pkg.durationOptions.length > 0
                ? pkg.durationOptions.map(o => ({
                    label: o.label,
                    price: o.price.toString(),
                    default: o.default,
                    photographers: o.photographers || '',
                    digitalItems: o.digitalItems && o.digitalItems.length > 0 ? o.digitalItems : [''],
                    physicalItems: o.physicalItems && o.physicalItems.length > 0 
                        ? o.physicalItems.map((p: PhysicalItem) => ({ ...p, price: p.price })) 
                        : [{ name: '', price: 0 }],
                }))
                : [
                    { label: '4 Jam', price: '', default: true },
                    { label: '8 Jam', price: '', default: false },
                    { label: 'Full Day', price: '', default: false }
                ],
        });
    };

    const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) {
                alert('Ukuran file foto tidak boleh melebihi 2MB.');
                e.target.value = '';
                return;
            }
            if (!file.type.match('image.*')) {
                alert('Hanya format file gambar yang diperbolehkan.');
                e.target.value = '';
                return;
            }
            try {
                const base64 = await toBase64(file);
                setPackageFormData((prev: any) => ({ ...prev, coverImage: base64 }));
            } catch (err) {
                console.error(err);
                alert('Gagal mengunggah gambar. Silakan coba lagi.');
            }
        }
    };

    const handleSubmitPackage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingPackageRef.current) return;
        const hasValidDurationOptions = Array.isArray(packageFormData.durationOptions) && 
            packageFormData.durationOptions.some((o: any) => String(o.label || '').trim() !== '' && String(o.price || '') !== '');

        if (!packageFormData.name.trim()) {
            alert('Nama Paket wajib diisi.');
            return;
        }

        if (!hasValidDurationOptions && !packageFormData.price) {
            alert('Silakan isi Harga Paket atau tambahkan Opsi Durasi & Harga.');
            return;
        }

        const defaultOption = hasValidDurationOptions 
            ? (packageFormData.durationOptions.find((o: any) => o.default) || packageFormData.durationOptions[0]) 
            : null;
        const computedBasePrice = defaultOption ? Number(defaultOption.price || 0) : Number(packageFormData.price || 0);

        const packageData: Omit<Package, 'id'> = {
            name: packageFormData.name.trim(),
            price: computedBasePrice,
            category: packageFormData.category,
            region: packageFormData.region ? String(packageFormData.region).trim().toLowerCase() : undefined,
            processingTime: '',
            photographers: packageFormData.photographers?.trim() || undefined,
            videographers: '',
            physicalItems: packageFormData.physicalItems
                .filter((item: any) => typeof item.name === 'string' && item.name.trim() !== '')
                .map((item: any) => ({ name: item.name.trim(), price: Number(item.price || 0) })),
            digitalItems: packageFormData.digitalItems.filter((item: string) => typeof item === 'string' && item.trim() !== ''),
            coverImage: packageFormData.coverImage || undefined,
            durationOptions: hasValidDurationOptions
                ? packageFormData.durationOptions
                    .filter((opt: any) => String(opt.label || '').trim() !== '' && Number(opt.price) >= 0)
                    .map((opt: any): DurationOption => ({
                        label: String(opt.label).trim(),
                        price: Number(opt.price),
                        default: !!opt.default,
                        photographers: opt.photographers?.trim() || undefined,
                    }))
                : undefined,
        };

        isSavingPackageRef.current = true;
        setIsSavingPackage(true);
        try {
            if (packageEditMode !== 'new' && packageEditMode) {
                const updated = await updatePackage(packageEditMode, packageData);
                setPackages(prev => prev.map(p => p.id === packageEditMode ? updated : p));
                showNotification('Paket layanan berhasil diperbarui.');
            } else {
                const created = await createPackage(packageData as any);
                setPackages(prev => [...prev, created]);
                appendToOrder('package', created.id);
                showNotification('Paket layanan baru berhasil ditambahkan.');
            }
            setPackageEditMode(null);
            setPackageFormData(emptyPackageForm);
        } catch (err: any) {
            console.error('[Packages.save] error:', err);
            alert(`Gagal menyimpan paket ke database. ${err?.message || 'Silakan coba lagi.'}`);
        } finally {
            isSavingPackageRef.current = false;
            setIsSavingPackage(false);
        }
    };

    const handleDeletePackage = async (pkgId: string) => {
        const isPackageInUse = projects.some(p => p.packageId === pkgId);
        if (isPackageInUse) {
            alert('Paket ini tidak dapat dihapus karena masih digunakan pada satu atau lebih data Acara Pernikahan.');
            return;
        }

        if (!window.confirm('Apakah Anda yakin ingin menghapus paket layanan ini?')) return;

        try {
            await deletePackage(pkgId);
            setPackages(prev => prev.filter(p => p.id !== pkgId));
            removeFromOrder('package', pkgId);
            showNotification('Paket layanan berhasil dihapus.');
        } catch (err) {
            console.error(err);
            alert('Gagal menghapus paket di database. Silakan coba lagi.');
        }
    };

    const handleDuplicatePackage = async (targetRegion: string) => {
        if (!copySourcePkg) return;
        const { id, ...rest } = copySourcePkg;
        const newPkg: Omit<Package, 'id'> = {
            ...rest,
            name: `${copySourcePkg.name} (${titleCase(targetRegion)})`,
            region: targetRegion as any,
        };
        const created = await createPackage(newPkg as any);
        setPackages(prev => [...prev, created]);
        appendToOrder('package', created.id);
        showNotification(`Paket berhasil diduplikasi ke wilayah ${titleCase(targetRegion)}.`);
    };

    const handleDuplicateAddOn = async (targetRegion: string) => {
        if (!copySourceAddOn) return;
        const created = await createAddOn({
            name: `${copySourceAddOn.name} (${titleCase(targetRegion)})`,
            price: copySourceAddOn.price,
            region: targetRegion,
        } as any);
        setAddOns(prev => [...prev, created]);
        appendToOrder('addOn', created.id);
        showNotification(`Add-On berhasil diduplikasi ke wilayah ${titleCase(targetRegion)}.`);
    };

    const handleShareSinglePackage = async (pkg: Package) => {
        const shareUrl = buildPublicShareUrl('booking', undefined, {
            query: {
                ...(pkg.region ? { region: pkg.region } : {}),
                package: getPackageShareIdentifier(pkg, packages),
            },
        });

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${pkg.name} - ${profile?.companyName || 'Vena Pictures'}`,
                    text: `Lihat paket ${pkg.name} dari ${profile?.companyName || 'Vena Pictures'}`,
                    url: shareUrl,
                });
                showNotification(`Paket "${pkg.name}" berhasil dibagikan!`);
                return;
            } catch (err: any) {
                if (err?.name === 'AbortError') return;
            }
        }

        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(shareUrl);
                showNotification(`Tautan paket "${pkg.name}" berhasil disalin ke clipboard!`);
                return;
            } catch {
                // fallback to modal
            }
        }

        setIsShareModalOpen(true);
    };

    // ── Add-On CRUD Handlers ──
    const handleSaveAddOn = async (addOnData: { id?: string; name: string; price: number; region?: string }) => {
        if (addOnData.id) {
            const updated = await updateAddOn(addOnData.id, {
                name: addOnData.name,
                price: addOnData.price,
                region: addOnData.region,
            });
            setAddOns(prev => prev.map(a => a.id === addOnData.id ? updated : a));
            showNotification('Add-on berhasil diperbarui.');
        } else {
            const created = await createAddOn({
                name: addOnData.name,
                price: addOnData.price,
                region: addOnData.region,
            } as any);
            setAddOns(prev => [...prev, created]);
            appendToOrder('addOn', created.id);
            showNotification('Add-on baru berhasil ditambahkan.');
        }
    };

    const handleDeleteAddOn = async (addOnId: string) => {
        const isAddOnInUse = projects.some(p => p.addOns && p.addOns.some(a => a.id === addOnId));
        if (isAddOnInUse) {
            alert('Add-on ini tidak dapat dihapus karena sedang dipilih pada salah satu Acara Pernikahan.');
            return;
        }

        if (!window.confirm('Hapus layanan add-on ini?')) return;

        try {
            await deleteAddOn(addOnId);
            setAddOns(prev => prev.filter(p => p.id !== addOnId));
            removeFromOrder('addOn', addOnId);
            showNotification('Add-on berhasil dihapus.');
        } catch (err) {
            console.error(err);
            alert('Gagal menghapus add-on di database.');
        }
    };

    const handleOpenCreateAddOn = () => {
        setEditingAddOn(null);
        setIsAddOnFormOpen(true);
    };

    const handleOpenEditAddOn = (addOn: AddOn) => {
        setEditingAddOn(addOn);
        setIsAddOnFormOpen(true);
    };

    const handleCloseAddOnForm = () => {
        setIsAddOnFormOpen(false);
        setEditingAddOn(null);
    };

    // ── Reorder Handlers ──
    const handleMovePackage = (pkgId: string, direction: 'up' | 'down', groupItems?: Package[]) => {
        // Build current order: use saved order as base, ensure all current package IDs are present
        const currentIds = packages.map(p => p.id);
        let order = [...packageOrderRef.current];
        // Add any missing IDs at the end
        currentIds.forEach(id => { if (!order.includes(id)) order.push(id); });
        // Remove IDs no longer in packages
        order = order.filter(id => currentIds.includes(id));

        const items = groupItems && groupItems.length > 0 ? groupItems : packages;
        const itemsInOrder = [...items].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        const currentItemIdx = itemsInOrder.findIndex(p => p.id === pkgId);
        if (currentItemIdx === -1) return;

        const targetItemIdx = direction === 'up' ? currentItemIdx - 1 : currentItemIdx + 1;
        if (targetItemIdx < 0 || targetItemIdx >= itemsInOrder.length) return;

        const targetPkg = itemsInOrder[targetItemIdx];
        const idxA = order.indexOf(pkgId);
        const idxB = order.indexOf(targetPkg.id);
        if (idxA === -1 || idxB === -1) return;

        [order[idxA], order[idxB]] = [order[idxB], order[idxA]];
        packageOrderRef.current = order;
        packageOrderDirty.current = true;
        setPackageOrder(order);
        setProfile(prev => ({
            ...prev,
            publicPageConfig: {
                ...prev.publicPageConfig,
                packageOrder: order,
                addOnOrder: addOnOrderRef.current,
            },
        }));
        persistCatalogOrder();
    };

    const handleMoveAddOn = (addOnId: string, direction: 'up' | 'down', groupItems?: AddOn[]) => {
        const currentIds = addOns.map(a => a.id);
        let order = [...addOnOrderRef.current];
        currentIds.forEach(id => { if (!order.includes(id)) order.push(id); });
        order = order.filter(id => currentIds.includes(id));

        const items = groupItems && groupItems.length > 0 ? groupItems : addOns;
        const itemsInOrder = [...items].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        const currentItemIdx = itemsInOrder.findIndex(a => a.id === addOnId);
        if (currentItemIdx === -1) return;

        const targetItemIdx = direction === 'up' ? currentItemIdx - 1 : currentItemIdx + 1;
        if (targetItemIdx < 0 || targetItemIdx >= itemsInOrder.length) return;

        const targetAddOn = itemsInOrder[targetItemIdx];
        const idxA = order.indexOf(addOnId);
        const idxB = order.indexOf(targetAddOn.id);
        if (idxA === -1 || idxB === -1) return;

        [order[idxA], order[idxB]] = [order[idxB], order[idxA]];
        addOnOrderRef.current = order;
        addOnOrderDirty.current = true;
        setAddOnOrder(order);
        setProfile(prev => ({
            ...prev,
            publicPageConfig: {
                ...prev.publicPageConfig,
                packageOrder: packageOrderRef.current,
                addOnOrder: order,
            },
        }));
        persistCatalogOrder();
    };

    // ── Package Terms & Conditions Handler (for Public Catalog) ──
    const handleSavePackageTerms = async (updatedTerms: PackageTermItem[]) => {
        try {
            const updated = await upsertProfile({
                id: profile.id,
                publicPageConfig: {
                    ...profile.publicPageConfig,
                    packageTerms: updatedTerms,
                },
            });
            setProfile(updated);
            showNotification('Syarat & ketentuan paket berhasil disimpan.');
        } catch (err) {
            console.error('Error saving package terms:', err);
            throw err;
        }
    };

    // ── Workflows Handler (for Public Catalog) ──
    const handleSaveWorkflows = async (updatedWorkflows: WorkflowItem[]) => {
        try {
            const weddingWf = updatedWorkflows[0] || { title: 'Wedding Timeline', timeline: [] as string[] };
            const smallEventWf = updatedWorkflows[1] || { title: 'Event Timeline', timeline: [] as string[] };

            const updated = await upsertProfile({
                id: profile.id,
                publicPageConfig: {
                    ...profile.publicPageConfig,
                    workflows: updatedWorkflows,
                    weddingWorkflow: {
                        title: weddingWf.title,
                        timeline: weddingWf.timeline,
                    },
                    smallEventWorkflow: {
                        title: smallEventWf.title,
                        timeline: smallEventWf.timeline,
                    },
                },
            });
            setProfile(updated);
            showNotification('Workflow berhasil disimpan.');
        } catch (err) {
            console.error('Error saving workflows:', err);
            throw err;
        }
    };

    // ── Regional Pricelist PDF Handler ──
    const handleSaveRegionPricelists = async (updatedList: RegionPricelistPdf[]) => {
        try {
            const sanitizedList = updatedList.map(item => ({
                ...item,
                // Truncate base64 if it's excessively large (e.g., > 1MB) to prevent DB timeout
                pdfUrl: item.pdfUrl.length > 1024 * 1024 * 1 ? item.pdfUrl.substring(0, 1024 * 1024 * 1) + '...' : item.pdfUrl
            }));

            const updated = await upsertProfile({
                id: profile.id,
                publicPageConfig: {
                    ...profile.publicPageConfig,
                    regionPricelists: sanitizedList,
                    pricelistPdfUrl: sanitizedList.length > 0 ? sanitizedList[0].pdfUrl : undefined,
                },
            });
            setProfile(updated);
        } catch (err) {
            console.error('Error saving region pricelists:', err);
            throw err;
        }
    };


    return (
        <div className="space-y-4 sm:space-y-6 animate-fade-in pb-12">
            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row w-full items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#2A3547] tracking-tight flex items-center gap-2">
                        <PackageIcon className="w-5 h-5 text-[#5D87FF] flex-shrink-0" />
                        <span>{text('title', 'Katalog Paket & Layanan')}</span>
                    </h2>
                    <p className="text-[11px] sm:text-xs text-[#5A6A85] mt-0.5 line-clamp-2 sm:line-clamp-none">
                        {text('subtitle', 'Kelola paket dokumentasi, opsi durasi dinamis, add-on, dan portofolio penawaran harga pengantin')}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:max-w-full sm:justify-end">
                    <button
                        type="button"
                        onClick={() => setIsBookingLinksModalOpen(true)}
                        title="Kelola tautan booking publik"
                        className="min-h-[44px] shrink-0 whitespace-nowrap px-3 py-2 rounded-xl bg-[#5D87FF]/10 text-[#5D87FF] text-xs font-semibold hover:bg-[#5D87FF]/20 transition-all flex items-center justify-center gap-1.5"
                    >
                        <LinkIcon className="w-3.5 h-3.5" />
                        Tautan Booking Publik
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsGuideModalOpen(true)}
                        className="shrink-0 whitespace-nowrap py-2 px-3 rounded-xl border border-[#EAEFF4] bg-white hover:bg-[#F4F6F9] text-[#5A6A85] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation cursor-pointer"
                        title="Lihat Panduan Pengelolaan Paket"
                    >
                        <HelpCircle className="w-4 h-4 text-[#5A6A85]" />
                        <span className="hidden xs:inline sm:inline">Panduan</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsTermsModalOpen(true)}
                        className="shrink-0 whitespace-nowrap py-2 px-3 rounded-xl border border-[#EAEFF4] bg-white hover:bg-[#F4F6F9] text-[#5A6A85] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation cursor-pointer"
                        title="Kelola Syarat & Ketentuan Paket (Katalog Publik)"
                    >
                        <FileText className="w-4 h-4 text-[#5A6A85]" />
                        <span className="hidden xs:inline sm:inline">Syarat & Ketentuan</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsPricelistModalOpen(true)}
                        className="shrink-0 whitespace-nowrap py-2 px-3 rounded-xl border border-[#EAEFF4] bg-white hover:bg-[#F4F6F9] text-[#5A6A85] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation cursor-pointer"
                        title="Kelola Pricelist PDF"
                    >
                        <Upload className="w-4 h-4 text-[#5A6A85]" />
                        <span className="hidden xs:inline sm:inline">Pricelist</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsWorkflowModalOpen(true)}
                        className="shrink-0 whitespace-nowrap py-2 px-3 rounded-xl border border-[#EAEFF4] bg-white hover:bg-[#F4F6F9] text-[#5A6A85] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation cursor-pointer"
                        title="Kelola Workflow & Timeline (Katalog Publik)"
                    >
                        <List className="w-4 h-4 text-[#5A6A85]" />
                        <span className="hidden xs:inline sm:inline">Workflow</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsShareModalOpen(true)}
                        className="shrink-0 whitespace-nowrap py-2 px-3 rounded-xl border border-[#EAEFF4] bg-white hover:bg-[#F4F6F9] text-[#5A6A85] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation cursor-pointer"
                        title="Bagikan Tautan Booking & Katalog"
                    >
                        <Share2 className="w-4 h-4 text-[#5D87FF]" />
                        <span>Bagikan</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenCreatePackage}
                        className="flex-1 sm:flex-initial min-w-[140px] shrink-0 whitespace-nowrap bg-[#5D87FF] hover:bg-[#4871e3] text-white font-bold px-3.5 sm:px-4 py-2 rounded-xl shadow-[0_4px_12px_rgba(93,135,255,0.25)] inline-flex items-center justify-center gap-1.5 sm:gap-2 text-xs transition-all min-h-[44px] touch-manipulation cursor-pointer"
                    >
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span>Tambah Paket</span>
                    </button>
                </div>
            </div>

            {/* ── KPI Stat Highlights ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                {/* Total Packages */}
                <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-[#EAEFF4] flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#5D87FF]/10 text-[#5D87FF] flex items-center justify-center flex-shrink-0">
                        <PackageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-semibold text-[#5A6A85] truncate">{text('activeCount', 'Paket Aktif')}</p>
                        <p className="text-base sm:text-2xl font-bold text-[#2A3547] mt-0.5 leading-none">
                            {stats.totalPackages}
                        </p>
                    </div>
                </div>

                {/* Total Add-Ons */}
                <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-[#EAEFF4] flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#13DEB9]/10 text-[#13DEB9] flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-semibold text-[#5A6A85] truncate">{text('addOnsCount', 'Layanan Add-On')}</p>
                        <p className="text-base sm:text-2xl font-bold text-[#2A3547] mt-0.5 leading-none">
                            {stats.totalAddOns}
                        </p>
                    </div>
                </div>

                {/* Active Categories */}
                <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-[#EAEFF4] flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#FFAE1F]/10 text-[#FFAE1F] flex items-center justify-center flex-shrink-0">
                        <Tag className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-semibold text-[#5A6A85] truncate">{text('categoryCount', 'Kategori Layanan')}</p>
                        <p className="text-base sm:text-2xl font-bold text-[#2A3547] mt-0.5 leading-none">
                            {stats.totalCategories}
                        </p>
                    </div>
                </div>

                {/* Price Range */}
                <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-[#EAEFF4] flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#FA896B]/10 text-[#FA896B] flex items-center justify-center flex-shrink-0">
                        <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] sm:text-xs font-semibold text-[#5A6A85] truncate">Rentang Harga</p>
                        <p className="text-[10px] sm:text-sm font-bold text-[#2A3547] mt-1 truncate" title={stats.minPrice > 0 ? `${formatCurrency(stats.minPrice)} – ${formatCurrency(stats.maxPrice)}` : '—'}>
                            {stats.minPrice > 0
                                ? `${new Intl.NumberFormat('id-ID', { notation: 'compact', style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(stats.minPrice)} – ${new Intl.NumberFormat('id-ID', { notation: 'compact', style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(stats.maxPrice)}`
                                : '—'}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Unified Package & Add-On Catalog ── */}
            <section className="bg-white p-3 sm:p-4 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-[#EAEFF4] space-y-3">
                <div className="flex flex-col xl:flex-row xl:items-center gap-2.5">
                    <div className="relative min-w-0 flex-1">
                        <Search className="w-4 h-4 text-[#5A6A85] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={event => setSearchTerm(event.target.value)}
                            placeholder={text('search', 'Cari paket atau Add-On...')}
                            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] text-xs sm:text-sm text-[#2A3547] placeholder-[#5A6A85] outline-none transition-all"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={categoryFilter}
                            onChange={event => setCategoryFilter(event.target.value)}
                            className="min-w-0 flex-1 sm:flex-none sm:min-w-[180px] py-2.5 px-3 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] text-xs font-semibold text-[#2A3547] outline-none cursor-pointer"
                            aria-label="Filter kategori paket"
                        >
                            <option value="">Semua Kategori Paket</option>
                            {availableCategories.map(category => <option key={category} value={category}>{category}</option>)}
                        </select>

                        <div className="flex items-center gap-1 bg-[#F4F6F9] p-1 rounded-xl border border-[#EAEFF4]">
                            <button type="button" onClick={() => setViewMode('cards')} className={`min-h-9 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${viewMode === 'cards' ? 'bg-white text-[#5D87FF] shadow-xs' : 'text-[#5A6A85]'}`} title="Tampilan Kartu">
                                <LayoutGrid className="w-4 h-4" /><span>Kartu</span>
                            </button>
                            <button type="button" onClick={() => setViewMode('table')} className={`min-h-9 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-white text-[#5D87FF] shadow-xs' : 'text-[#5A6A85]'}`} title="Tampilan Tabel">
                                <List className="w-4 h-4" /><span>Tabel</span>
                            </button>
                        </div>

                        <div className="flex w-full sm:w-auto gap-2">
                            <button type="button" onClick={handleOpenCreatePackage} className="min-h-10 flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 rounded-xl bg-[#5D87FF] text-white text-xs font-semibold hover:bg-[#4871e3]">
                                <Plus className="w-4 h-4" /><span>Tambah Paket</span>
                            </button>
                            <button type="button" onClick={handleOpenCreateAddOn} className="min-h-10 flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 rounded-xl bg-[#49BEFF] text-white text-xs font-semibold hover:bg-sky-500">
                                <Sparkles className="w-4 h-4" /><span>Tambah Add-On</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="border-t border-[#EAEFF4] pt-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] sm:text-xs font-semibold text-[#5A6A85]">Filter wilayah · Paket dan Add-On</p>
                        {regionFilter && <span className="text-[10px] sm:text-xs text-[#5A6A85]">{catalogEntries.length} item</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button type="button" onClick={() => setRegionFilter('')} aria-pressed={regionFilter === ''} className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold border whitespace-nowrap ${regionFilter === '' ? 'bg-[#5D87FF] text-white border-[#5D87FF]' : 'bg-white border-[#EAEFF4] text-[#5A6A85] hover:bg-[#F4F6F9]'}`}>
                            Semua Wilayah
                        </button>
                        {unionRegions.map(region => (
                            <button key={region.value} type="button" onClick={() => setRegionFilter(region.value)} aria-pressed={regionFilter === region.value} className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold border whitespace-nowrap ${regionFilter === region.value ? 'bg-[#5D87FF] text-white border-[#5D87FF]' : 'bg-white border-[#EAEFF4] text-[#5A6A85] hover:bg-[#F4F6F9]'}`}>
                                {region.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {catalogEntries.length === 0 ? (
                <div className="py-12 sm:py-16 text-center bg-white rounded-2xl border border-[#EAEFF4] p-6 sm:p-8">
                    <div className="w-12 h-12 rounded-2xl bg-[#5D87FF]/10 text-[#5D87FF] flex items-center justify-center mx-auto mb-3"><PackageIcon className="w-6 h-6" /></div>
                    <h3 className="font-bold text-base text-[#2A3547]">Tidak ada item ditemukan</h3>
                    <p className="text-xs text-[#5A6A85] mt-1 max-w-sm mx-auto">Coba ubah pencarian, kategori paket, atau wilayah yang dipilih.</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <button type="button" onClick={handleOpenCreatePackage} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5D87FF] text-white text-xs font-semibold"><Plus className="w-3.5 h-3.5" />Tambah Paket</button>
                        <button type="button" onClick={handleOpenCreateAddOn} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#49BEFF] text-white text-xs font-semibold"><Sparkles className="w-3.5 h-3.5" />Tambah Add-On</button>
                    </div>
                </div>
            ) : viewMode === 'cards' ? (
                <div className="space-y-6">
                    {packageGroups.length > 0 && (
                        <section className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAEFF4] pb-2">
                                <div className="flex items-center gap-2">
                                    <PackageIcon className="w-4 h-4 text-[#5D87FF]" />
                                    <h3 className="font-bold text-sm sm:text-base text-[#2A3547]">Paket</h3>
                                    <span className="rounded-full bg-[#F4F6F9] border border-[#EAEFF4] px-2 py-0.5 text-[10px] font-semibold text-[#5A6A85]">{filteredPackages.length} item</span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {packageGroups.map(group => (
                                    <div key={group.regionKey || 'unassigned'} className="space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-[#5D87FF]" />
                                                <h4 className="font-semibold text-xs sm:text-sm text-[#2A3547]">{group.label}</h4>
                                            </div>
                                            <span className="text-[10px] sm:text-xs text-[#5A6A85]">{group.items.length} paket</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 items-stretch">
                                            {group.items.map((pkg, idx) => (
                                                <PackageCard
                                                    key={`package-${pkg.id}`}
                                                    pkg={pkg}
                                                    onEdit={handleOpenEditPackage}
                                                    onDuplicate={setCopySourcePkg}
                                                    onShare={handleShareSinglePackage}
                                                    onDelete={handleDeletePackage}
                                                    onMoveUp={() => handleMovePackage(pkg.id, 'up', group.items)}
                                                    onMoveDown={() => handleMovePackage(pkg.id, 'down', group.items)}
                                                    canMoveUp={idx > 0}
                                                    canMoveDown={idx < group.items.length - 1}
                                                    orderIndex={idx}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {addOnGroups.length > 0 && (
                        <section className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAEFF4] pb-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-[#49BEFF]" />
                                    <h3 className="font-bold text-sm sm:text-base text-[#2A3547]">Add-On</h3>
                                    <span className="rounded-full bg-[#F4F6F9] border border-[#EAEFF4] px-2 py-0.5 text-[10px] font-semibold text-[#5A6A85]">{filteredAddOns.length} item</span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {addOnGroups.map(group => (
                                    <div key={group.regionKey || 'unassigned'} className="space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-[#49BEFF]" />
                                                <h4 className="font-semibold text-xs sm:text-sm text-[#2A3547]">{group.label}</h4>
                                            </div>
                                            <span className="text-[10px] sm:text-xs text-[#5A6A85]">{group.items.length} add-on</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 items-stretch">
                                            {group.items.map((addOn, idx) => (
                                                <CatalogItemCard
                                                    key={`addon-${addOn.id}`}
                                                    addOn={addOn}
                                                    onEdit={handleOpenEditAddOn}
                                                    onDuplicate={setCopySourceAddOn}
                                                    onDelete={handleDeleteAddOn}
                                                    onMoveUp={() => handleMoveAddOn(addOn.id, 'up', group.items)}
                                                    onMoveDown={() => handleMoveAddOn(addOn.id, 'down', group.items)}
                                                    canMoveUp={idx > 0}
                                                    canMoveDown={idx < group.items.length - 1}
                                                    orderIndex={idx}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#EAEFF4] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
                    <table className="w-full min-w-[760px] text-left text-xs">
                        <thead className="bg-[#F4F6F9] text-[10px] uppercase tracking-wider text-[#5A6A85]">
                            <tr>
                                <th className="px-3 py-3 w-28 text-center">Urutan</th>
                                <th className="px-4 py-3">Nama</th>
                                <th className="px-4 py-3">Jenis</th>
                                <th className="px-4 py-3">Kategori</th>
                                <th className="px-4 py-3">Wilayah</th>
                                <th className="px-4 py-3 text-right">Harga</th>
                                <th className="px-4 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAEFF4]">
                            {catalogEntries.map(item => {
                                const isPackage = item.kind === 'package';
                                const name = isPackage ? item.pkg.name : item.addOn.name;
                                const region = isPackage ? item.pkg.region : item.addOn.region;
                                const price = isPackage ? item.pkg.price : item.addOn.price;
                                return (
                                    <tr key={`${item.kind}-${isPackage ? item.pkg.id : item.addOn.id}`} className="hover:bg-[#F8FAFC]">
                                        <td className="px-3 py-3 text-center">
                                            <div className="inline-flex items-center gap-1 bg-[#F4F6F9] px-2 py-1 rounded-lg border border-[#EAEFF4]">
                                                {isPackage ? (
                                                    (() => {
                                                        const pkgIdx = filteredPackages.findIndex(p => p.id === item.pkg.id);
                                                        return (
                                                            <>
                                                                <span className="text-[10px] font-bold text-[#5A6A85] w-5 text-center">#{pkgIdx + 1}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMovePackage(item.pkg.id, 'up', filteredPackages)}
                                                                    disabled={pkgIdx <= 0}
                                                                    className="p-1 rounded text-[#5A6A85] hover:text-[#5D87FF] disabled:opacity-25 disabled:cursor-not-allowed"
                                                                    title="Pindah ke Atas"
                                                                >
                                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMovePackage(item.pkg.id, 'down', filteredPackages)}
                                                                    disabled={pkgIdx === -1 || pkgIdx >= filteredPackages.length - 1}
                                                                    className="p-1 rounded text-[#5A6A85] hover:text-[#5D87FF] disabled:opacity-25 disabled:cursor-not-allowed"
                                                                    title="Pindah ke Bawah"
                                                                >
                                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        );
                                                    })()
                                                ) : (
                                                    (() => {
                                                        const addOnIdx = filteredAddOns.findIndex(a => a.id === item.addOn.id);
                                                        return (
                                                            <>
                                                                <span className="text-[10px] font-bold text-[#5A6A85] w-5 text-center">#{addOnIdx + 1}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMoveAddOn(item.addOn.id, 'up', filteredAddOns)}
                                                                    disabled={addOnIdx <= 0}
                                                                    className="p-1 rounded text-[#5A6A85] hover:text-[#49BEFF] disabled:opacity-25 disabled:cursor-not-allowed"
                                                                    title="Pindah ke Atas"
                                                                >
                                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMoveAddOn(item.addOn.id, 'down', filteredAddOns)}
                                                                    disabled={addOnIdx === -1 || addOnIdx >= filteredAddOns.length - 1}
                                                                    className="p-1 rounded text-[#5A6A85] hover:text-[#49BEFF] disabled:opacity-25 disabled:cursor-not-allowed"
                                                                    title="Pindah ke Bawah"
                                                                >
                                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        );
                                                    })()
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-[#2A3547]">{name}</td>
                                        <td className="px-4 py-3 text-[#5A6A85]">{isPackage ? 'Paket' : 'Add-On'}</td>
                                        <td className="px-4 py-3 text-[#5A6A85]">{isPackage ? item.pkg.category || 'Umum' : '—'}</td>
                                        <td className="px-4 py-3 text-[#5A6A85]">{region ? unionRegions.find(option => option.value.toLowerCase() === region.toLowerCase())?.label || titleCase(region) : 'Semua Wilayah'}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-[#2A3547]">{formatCurrency(price)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                {isPackage ? (
                                                    <>
                                                        <button type="button" onClick={() => handleOpenEditPackage(item.pkg)} className="p-2 rounded-lg text-[#5A6A85] hover:bg-[#5D87FF]/10 hover:text-[#5D87FF]" title="Edit Paket"><Pencil className="w-4 h-4" /></button>
                                                        <button type="button" onClick={() => setCopySourcePkg(item.pkg)} className="p-2 rounded-lg text-[#5A6A85] hover:bg-[#5D87FF]/10 hover:text-[#5D87FF]" title="Duplikat Paket"><Copy className="w-4 h-4" /></button>
                                                        <button type="button" onClick={() => handleShareSinglePackage(item.pkg)} className="p-2 rounded-lg text-[#5A6A85] hover:bg-[#5D87FF]/10 hover:text-[#5D87FF]" title="Bagikan Paket"><Share2 className="w-4 h-4" /></button>
                                                        <button type="button" onClick={() => handleDeletePackage(item.pkg.id)} className="p-2 rounded-lg text-[#5A6A85] hover:bg-rose-50 hover:text-rose-600" title="Hapus Paket"><Trash2 className="w-4 h-4" /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button type="button" onClick={() => handleOpenEditAddOn(item.addOn)} className="p-2 rounded-lg text-[#5A6A85] hover:bg-[#5D87FF]/10 hover:text-[#5D87FF]" title="Edit Add-On"><Pencil className="w-4 h-4" /></button>
                                                        <button type="button" onClick={() => setCopySourceAddOn(item.addOn)} className="p-2 rounded-lg text-[#5A6A85] hover:bg-[#5D87FF]/10 hover:text-[#5D87FF]" title="Duplikat Add-On"><Copy className="w-4 h-4" /></button>
                                                        <button type="button" onClick={() => handleDeleteAddOn(item.addOn.id)} className="p-2 rounded-lg text-[#5A6A85] hover:bg-rose-50 hover:text-rose-600" title="Hapus Add-On"><Trash2 className="w-4 h-4" /></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <AddOnEditorModal
                isOpen={isAddOnFormOpen}
                addOn={editingAddOn}
                regionFilter={regionFilter}
                unionRegions={unionRegions}
                onClose={handleCloseAddOnForm}
                onSave={handleSaveAddOn}
            />

            {/* ── Package Edit/Add Modal ── */}
            {packageEditMode && (
                <PackageModal
                    isOpen={true}
                    onClose={() => {
                        setPackageEditMode(null);
                        setPackageFormData(emptyPackageForm);
                    }}
                    formData={packageFormData}
                    setFormData={setPackageFormData}
                    editMode={packageEditMode}
                    packageCategories={availableCategories}
                    unionRegions={unionRegions}
                    existingRegions={existingRegions}
                    isSubmitting={isSavingPackage}
                    onSubmit={handleSubmitPackage}
                    onCoverImageUpload={handleCoverImageUpload}
                />
            )}

            {/* ── Duplicate Modal ── */}
            {copySourcePkg && (
                <DuplicatePackageModal
                    packageToCopy={copySourcePkg}
                    onClose={() => setCopySourcePkg(null)}
                    unionRegions={unionRegions}
                    onDuplicate={handleDuplicatePackage}
                />
            )}

            {copySourceAddOn && (
                <DuplicateAddOnModal
                    addOn={copySourceAddOn}
                    onClose={() => setCopySourceAddOn(null)}
                    regions={unionRegions}
                    onDuplicate={handleDuplicateAddOn}
                />
            )}

            {/* ── Share Modal ── */}
            <SharePackageModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                unionRegions={unionRegions}
            />

            {/* ── Guide Modal ── */}
            <PackageGuideModal
                isOpen={isGuideModalOpen}
                onClose={() => setIsGuideModalOpen(false)}
            />

            {/* ── Package Terms & Conditions Modal (CRUD) ── */}
            <PackageTermsModal
                isOpen={isTermsModalOpen}
                onClose={() => setIsTermsModalOpen(false)}
                profile={profile}
                onSaveTerms={handleSavePackageTerms}
                showNotification={showNotification}
            />

            {/* ── Region Pricelist PDF Modal (CRUD) ── */}
            <RegionPricelistModal
                isOpen={isPricelistModalOpen}
                onClose={() => setIsPricelistModalOpen(false)}
                profile={profile}
                onSaveRegionPricelists={handleSaveRegionPricelists}
                showNotification={showNotification}
                availableRegions={unionRegions}
            />

            {/* ── Workflow Modal (CRUD) ── */}
            <WorkflowModal
                isOpen={isWorkflowModalOpen}
                onClose={() => setIsWorkflowModalOpen(false)}
                profile={profile}
                onSaveWorkflows={handleSaveWorkflows}
                showNotification={showNotification}
            />
            
            {/* ── Booking Links Modal ── */}
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

export default Packages;
