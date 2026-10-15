import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Package, AddOn, Profile, Client, Project, Transaction, Lead, Notification, Card, ClientStatus, PaymentStatus, TransactionType, LeadStatus, ContactChannel, ClientType, BookingStatus, ViewType, PromoCode, REGIONS } from '../../../types';
import Modal from '../../../shared/ui/Modal';
import { CheckIcon, CameraIcon, WhatsappIcon, cleanPhoneNumber } from '../../../constants';
import { listPackages } from '../../../services/packages';
import { listAddOns } from '../../../services/addOns';
import { createClient } from '../../../services/clients';
import { createProject } from '../../../services/projects';
import { createLead as createLeadRow, updateLead as updateLeadRow } from '../../../services/leads';
import { uploadDpProof } from '../../../services/storage';
import { createTransaction } from '../../../services/transactions';
import RupiahInput from '../../../shared/form/RupiahInput';
import { Download, FileText, MapPin, CheckCircle2, ListOrdered, Sparkles, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { toPublicNameSlug } from '../../../utils/publicRouting';
import { getPackageTerms } from '../../packages/packageTerms';
import { getWorkflows } from '../../packages/workflows';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});

const UploadIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
);

interface PublicPackagesProps {
    userProfile: Profile;
    initialPackages?: Package[];
    initialAddOns?: AddOn[];
    showNotification: (message: string) => void;
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
    cards: Card[];
    projects: Project[];
    promoCodes: PromoCode[];
    setPromoCodes: React.Dispatch<React.SetStateAction<PromoCode[]>>;
    leads?: Lead[];
}


const AddOnItem: React.FC<{ addOn: AddOn }> = ({ addOn }) => {
    return (
        <div className="border-b border-brand-border last:border-b-0 p-4 flex justify-between items-center">
            <p className="font-semibold text-brand-text-light">{addOn.name}</p>
            <p className="text-sm font-bold text-brand-accent">{formatCurrency(addOn.price)}</p>
        </div>
    );
};

const initialForm = {
    clientName: '', email: '', phone: '', instagram: '', date: '', location: '', transportCost: '', selectedAddOnIds: [] as string[], promoCode: '', dp: '', durationSelection: '' as string, unitPrice: undefined as number | undefined
};



const PublicPackages: React.FC<PublicPackagesProps> = ({ userProfile: initialUserProfile, initialPackages, initialAddOns, showNotification, setClients, setProjects, setTransactions, setCards, setLeads, addNotification, cards = [], projects = [], promoCodes = [], setPromoCodes, leads = [] }) => {
    const [packages, setPackages] = useState<Package[]>(initialPackages ?? []);
    const [addOns, setAddOns] = useState<AddOn[]>(initialAddOns ?? []);
    const [userProfile, setUserProfile] = useState<Profile>(initialUserProfile);
    const [isLoading, setIsLoading] = useState(!initialPackages || !initialAddOns);
    const [error, setError] = useState<string | null>(null);
    const [selectedRegion] = useState<string | null>(() => {
        try {
            const hash = window.location.hash;
            const hashQuery = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : '';
            const params = new URLSearchParams(hashQuery || window.location.search);
            const region = params.get('region');
            return region?.trim() ? region.toLowerCase().trim() : null;
        } catch (e) {
            console.warn('Failed to parse region from URL:', e);
            return null;
        }
    });

    const urlLeadId = useMemo(() => {
        try {
            const hash = window.location.hash;
            const hashQuery = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : '';
            const params = new URLSearchParams(hashQuery || window.location.search);
            return params.get('lid') || params.get('leadId') || params.get('leadName') || null;
        } catch {
            return null;
        }
    }, []);

    const { publicPageConfig } = userProfile;

    // Update userProfile when initialUserProfile changes
    useEffect(() => {
        if (initialUserProfile) {
            setUserProfile(initialUserProfile);
        }
    }, [initialUserProfile]);

    // Load data from Supabase
    const loadData = useCallback(async (refresh = false) => {
        try {
            if (!refresh && initialPackages && initialAddOns) {
                setPackages(initialPackages);
                setAddOns(initialAddOns);
                setError(null);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            const [packagesData, addOnsData] = await Promise.all([
                !refresh && initialPackages ? initialPackages : listPackages(),
                !refresh && initialAddOns ? initialAddOns : listAddOns(),
            ]);
            setPackages(packagesData);
            setAddOns(addOnsData);
            setError(null);
        } catch (err) {
            console.error('Error loading data:', err);
            setError('Gagal memuat data. Silakan coba lagi nanti.');
        } finally {
            setIsLoading(false);
        }
    }, [initialPackages, initialAddOns]);

    useEffect(() => {
        loadData();
    }, [loadData]);
    const template = publicPageConfig?.template ?? 'modern';

    // Strict region filtering and ordering for packages
    const visiblePackages = useMemo(() => {
        if (!Array.isArray(packages)) return [];
        let list = packages;
        if (selectedRegion) {
            list = packages.filter(p => {
                const pkgRegion = p.region ? String(p.region).toLowerCase().trim() : '';
                return pkgRegion === selectedRegion.toLowerCase().trim();
            });
        }
        const order = userProfile?.publicPageConfig?.packageOrder;
        if (order && order.length > 0) {
            const orderMap = new Map(order.map((id, idx) => [id, idx]));
            return [...list].sort((a, b) => {
                const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
                const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
                return idxA - idxB;
            });
        }
        return list;
    }, [packages, selectedRegion, userProfile?.publicPageConfig?.packageOrder]);

    // Strict region filtering and ordering for add-ons
    const visibleAddOns = useMemo(() => {
        if (!Array.isArray(addOns)) return [];
        let list = addOns;
        if (selectedRegion) {
            list = addOns.filter(a => {
                const addonRegion = a.region ? String(a.region).toLowerCase().trim() : '';
                return addonRegion === selectedRegion.toLowerCase().trim();
            });
        }
        const order = userProfile?.publicPageConfig?.addOnOrder;
        if (order && order.length > 0) {
            const orderMap = new Map(order.map((id, idx) => [id, idx]));
            return [...list].sort((a, b) => {
                const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
                const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
                return idxA - idxB;
            });
        }
        return list;
    }, [addOns, selectedRegion, userProfile?.publicPageConfig?.addOnOrder]);

    const [bookingModal, setBookingModal] = useState<{ isOpen: boolean; pkg: Package | null }>({ isOpen: false, pkg: null });
    const [optionalPackages, setOptionalPackages] = useState<{ id: string; name: string; price: number; selectedDuration?: string }[]>([]);
    const [formData, setFormData] = useState(initialForm);
    const [paymentProof, setPaymentProof] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [promoFeedback, setPromoFeedback] = useState({ type: '', message: '' });
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);
    const [isTermsOpen, setIsTermsOpen] = useState(false);
    const [openWorkflowId, setOpenWorkflowId] = useState<string | null>(null);

    // Note: We avoid early returns before all hooks to keep hook order stable across renders.

    // Group visiblePackages by category while preserving category order based on visiblePackages
    const packagesByCategory = useMemo(() => {
        const grouped: Record<string, Package[]> = {};

        if (!Array.isArray(visiblePackages)) {
            console.error('visiblePackages is not an array:', visiblePackages);
            return {};
        }

        // Track category appearance order based on sorted visiblePackages
        const categoryOrder: string[] = [];

        for (const pkg of visiblePackages) {
            if (!pkg) continue;

            const category = pkg.category || 'Lainnya';
            if (!grouped[category]) {
                grouped[category] = [];
                categoryOrder.push(category);
            }
            grouped[category].push(pkg);
        }

        const orderedGrouped: Record<string, Package[]> = {};
        categoryOrder.forEach(category => {
            orderedGrouped[category] = grouped[category];
        });

        return orderedGrouped;
    }, [visiblePackages]);

    const mostPopularPackageId = useMemo(() => {
        if (projects.length === 0) return null;
        const packageCounts = projects.reduce((acc, p) => {
            if (p.packageId) {
                acc[p.packageId] = (acc[p.packageId] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        if (Object.keys(packageCounts).length === 0) return null;

        return Object.keys(packageCounts).sort((a, b) => packageCounts[b] - packageCounts[a])[0];
    }, [projects]);


    const categoryDescriptions: Record<string, string> = {
        'Pernikahan': "Layanan profesional untuk mendukung kelancaran hari bahagia Anda. Yuk konsultasikan kebutuhan Anda sekarang.",
        'Lamaran / Engagement': "Momen spesial komitmen Anda akan kami layani dengan sepenuh hati.",
        'Ulang Tahun': "Rayakan pertambahan usia dengan layanan terbaik yang menyenangkan.",
        'Corporate / Event': "Dukungan profesional untuk kesuksesan Acara Pernikahan perusahaan dan gathering Anda.",
        'Wisuda': "Rayakan pencapaian akademik Anda dengan layanan spesial dari kami.",
        'Keluarga': "Menciptakan momen berharga dan layanan terbaik untuk kebahagiaan keluarga Anda."
    };

    const activeWorkflows = useMemo(
        () => getWorkflows(userProfile?.publicPageConfig),
        [userProfile?.publicPageConfig],
    );

    const activePackageTerms = useMemo(
        () => getPackageTerms(userProfile?.publicPageConfig?.packageTerms),
        [userProfile?.publicPageConfig?.packageTerms],
    );

    const formattedTerms = useMemo(() => {
        if (!userProfile.termsAndConditions || userProfile.termsAndConditions.trim() === '') return null;
        return userProfile.termsAndConditions.split('\n').map((line, index) => {
            if (line.trim() === '') return <div key={index} className="h-4"></div>;
            const emojiRegex = /^(📜|📅|💰|📦|⏱|➕)\s/;
            if (emojiRegex.test(line)) {
                return <h3 key={index} className="text-lg font-semibold text-gradient mt-4 mb-2">{line}</h3>;
            }
            if (line.trim().startsWith('- ')) {
                return <p key={index} className="ml-4 text-brand-text-primary">{line.trim().substring(2)}</p>;
            }
            return <p key={index} className="text-brand-text-primary">{line}</p>;
        });
    }, [userProfile.termsAndConditions]);

    const whatsappUrl = useMemo(() => {
        if (!bookingModal.pkg || !isSubmitted) return '';
        const message = `Halo, saya ${formData.clientName}, baru saja melakukan booking untuk Package "${bookingModal.pkg.name}". Mohon untuk diproses. Terima kasih.`;
        return `https://wa.me/${cleanPhoneNumber(userProfile.phone)}?text=${encodeURIComponent(message)}`;
    }, [isSubmitted, formData.clientName, bookingModal.pkg, userProfile.phone]);

    const { totalBeforeDiscount, discountAmount, totalProject, discountText } = useMemo(() => {
        if (!bookingModal.pkg) return { totalBeforeDiscount: 0, discountAmount: 0, totalProject: 0, discountText: '' };
        // Determine package price based on selected duration option (flexible labels)
        let packagePrice = bookingModal.pkg.price;
        const opts = bookingModal.pkg.durationOptions;
        if (opts && opts.length > 0) {
            const selected = opts.find(o => o.label === formData.durationSelection) || opts.find(o => o.default) || opts[0];
            packagePrice = selected?.price ?? bookingModal.pkg.price;
        }
        const addOnsPrice = visibleAddOns
            .filter(addon => formData.selectedAddOnIds.includes(addon.id))
            .reduce((sum, addon) => sum + addon.price, 0);

        const optionalPackagesPrice = optionalPackages.reduce((sum, opt) => {
            return sum + (opt.price || 0);
        }, 0);

        const transportFee = Number(formData.transportCost) || 0;
        const totalBeforeDiscount = packagePrice + addOnsPrice + optionalPackagesPrice;
        let discountAmount = 0;
        let discountText = '';

        const enteredPromoCode = formData.promoCode.toUpperCase().trim();
        if (enteredPromoCode) {
            const promoCode = promoCodes.find(p => p.code === enteredPromoCode && p.isActive);
            if (promoCode) {
                const isExpired = promoCode.expiryDate && new Date(promoCode.expiryDate) < new Date();
                const isMaxedOut = promoCode.maxUsage != null && promoCode.usageCount >= promoCode.maxUsage;

                if (!isExpired && !isMaxedOut) {
                    if (promoCode.discountType === 'percentage') {
                        discountAmount = (totalBeforeDiscount * promoCode.discountValue) / 100;
                        discountText = `${promoCode.discountValue}%`;
                    } else {
                        discountAmount = promoCode.discountValue;
                        discountText = formatCurrency(promoCode.discountValue);
                    }
                    setPromoFeedback({ type: 'success', message: `Kode promo diterapkan! Diskon ${discountText}.` });
                } else {
                    setPromoFeedback({ type: 'error', message: 'Kode promo tidak valid atau sudah habis.' });
                }
            } else {
                setPromoFeedback({ type: 'error', message: 'Kode promo tidak ditemukan.' });
            }
        } else {
            setPromoFeedback({ type: '', message: '' });
        }

        const totalProject = totalBeforeDiscount - discountAmount + transportFee;
        return { totalBeforeDiscount, discountAmount, totalProject, discountText };
    }, [formData.selectedAddOnIds, formData.promoCode, formData.transportCost, formData.durationSelection, bookingModal.pkg, addOns, promoCodes, optionalPackages, packages]);

    const handleOpenBookingModal = (pkg: Package) => {
        setBookingModal({ isOpen: true, pkg });
        setIsSubmitted(false);
        // Set default duration selection if durationOptions exist
        const defaultOpt = (pkg.durationOptions && pkg.durationOptions.length > 0)
            ? (pkg.durationOptions.find(o => o.default) || pkg.durationOptions[0])
            : undefined;
        setFormData({ ...initialForm, durationSelection: defaultOpt?.label || '', unitPrice: defaultOpt ? Number(defaultOpt.price) : pkg.price });
        setPaymentProof(null);
        setPromoFeedback({ type: '', message: '' });
    };

    const handleCloseBookingModal = () => {
        setBookingModal({ isOpen: false, pkg: null });
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { id, checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, selectedAddOnIds: checked ? [...prev.selectedAddOnIds, id] : prev.selectedAddOnIds.filter(addOnId => addOnId !== id) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handlePaymentProofFile = (file?: File) => {
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) {
            alert('Format file harus PNG, JPG, atau PDF.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('Ukuran file tidak boleh melebihi 10MB.');
            return;
        }
        setPaymentProof(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handlePaymentProofFile(e.target.files?.[0]);
        e.target.value = '';
    };

    const handlePaymentProofDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        handlePaymentProofFile(e.dataTransfer.files[0]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bookingModal.pkg) return;
        setIsSubmitting(true);

        const dpAmount = Number(formData.dp) || 0;
        const destinationCard = cards.find(c => c.id !== 'CARD_CASH') || cards[0];
        if (dpAmount > 0 && !destinationCard) {
            alert('Sistem pembayaran tidak dikonfigurasi. Hubungi vendor.');
            setIsSubmitting(false);
            return;
        }

        let promoCodeAppliedId: string | undefined;
        if (discountAmount > 0 && formData.promoCode) {
            const promoCode = promoCodes.find(p => p.code === formData.promoCode.toUpperCase().trim());
            if (promoCode) promoCodeAppliedId = promoCode.id;
        }

        let dpProofUrl = '';
        if (paymentProof) {
            try {
                // Upload ke Supabase Storage, gunakan URL publik
                dpProofUrl = await uploadDpProof(paymentProof);
            } catch (error) {
                console.error('Error uploading DP proof:', error);
                alert('Gagal mengunggah bukti transfer. Silakan coba lagi.');
                setIsSubmitting(false);
                return;
            }
        }

        const selectedAddOns = visibleAddOns.filter(addon => formData.selectedAddOnIds.includes(addon.id));
        const remainingPayment = totalProject - dpAmount;
        const transportFee = Number(formData.transportCost) || 0;

        // Persist to Supabase
        let createdClient: Client;
        let createdProject: Project;
        try {
            createdClient = await createClient({
                name: formData.clientName,
                email: formData.email,
                phone: formData.phone,
                whatsapp: formData.phone || undefined,
                instagram: formData.instagram || undefined,
                since: new Date().toISOString().split('T')[0],
                status: ClientStatus.ACTIVE,
                clientType: ClientType.DIRECT,
                lastContact: new Date().toISOString(),
                portalAccessId: crypto.randomUUID(),
            });

            createdProject = await createProject({
                projectName: `${formData.clientName} (${bookingModal.pkg.name})`,
                clientName: createdClient.name,
                clientId: createdClient.id,
                projectType: bookingModal.pkg.category,
                packageName: bookingModal.pkg.name,
                packageId: bookingModal.pkg.id,
                date: formData.date,
                location: formData.location || 'Akan dikonfirmasi',
                status: 'Dikonfirmasi',
                bookingStatus: BookingStatus.BARU,
                totalCost: totalProject,
                amountPaid: dpAmount,
                paymentStatus: dpAmount >= totalProject ? PaymentStatus.LUNAS : (dpAmount > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR),
                notes: `Booking dari halaman Package.${formData.durationSelection ? ` Durasi dipilih: ${formData.durationSelection}.` : ''}`,
                durationSelection: formData.durationSelection || undefined,
                unitPrice: formData.unitPrice !== undefined ? Number(formData.unitPrice) : undefined,
                promoCodeId: promoCodeAppliedId,
                discountAmount: discountAmount > 0 ? discountAmount : undefined,
                transportCost: transportFee > 0 ? transportFee : undefined,
                completedDigitalItems: [],
                dpProofUrl: dpProofUrl || undefined,
                addOns: selectedAddOns.map(a => ({ id: a.id, name: a.name, price: a.price })),
            });
        } catch (err) {
            console.error('Gagal menyimpan booking ke Supabase:', err);
            alert('Gagal menyimpan booking. Silakan periksa koneksi dan coba lagi.');
            setIsSubmitting(false);
            return;
        }

        // Konversi lead: jika ada lid di URL → update lead existing, jika tidak → buat lead baru
        if (urlLeadId) {
            try {
                const leadNote = `Dikonversi dari halaman Package. Booking: ${createdProject.projectName}. Client ID: ${createdClient.id}`;
                const existingLead = (leads || []).find(l =>
                    l.id.startsWith(urlLeadId) ||
                    l.id === urlLeadId ||
                    toPublicNameSlug(l.name) === urlLeadId
                );
                if (existingLead) {
                    const updatedLead = await updateLeadRow(existingLead.id, { status: LeadStatus.CONVERTED, notes: leadNote });
                    setLeads(prev => prev.map(l => l.id === existingLead.id ? updatedLead : l));
                } else {
                    // Fallback: lead tidak ditemukan, buat baru
                    const newLead = await createLeadRow({
                        name: createdClient.name,
                        contactChannel: ContactChannel.WEBSITE,
                        location: createdProject.location,
                        status: LeadStatus.CONVERTED,
                        date: new Date().toISOString(),
                        notes: leadNote,
                        whatsapp: createdClient.phone,
                    } as any);
                    setLeads(prev => [newLead, ...prev]);
                }
            } catch (error) {
                console.error('[Lead] Failed to update lead status:', error);
            }
        } else {
            try {
                const createdLead = await createLeadRow({
                    name: createdClient.name,
                    contactChannel: ContactChannel.WEBSITE,
                    location: createdProject.location,
                    status: LeadStatus.CONVERTED,
                    date: new Date().toISOString(),
                    notes: `Dikonversi dari halaman Package. Acara Pernikahan: ${createdProject.projectName}. Pengantin ID: ${createdClient.id}`,
                    whatsapp: createdClient.phone,
                } as any);
                setLeads(prev => [createdLead, ...prev]);
            } catch (error) {
                console.error('[Lead] Failed to create lead:', error);
            }
        }

        setClients(prev => [createdClient, ...prev]);
        // Pastikan muncul di halaman Booking
        const createdProjectWithBooking: Project = { ...createdProject, bookingStatus: BookingStatus.BARU } as Project;
        setProjects(prev => [createdProjectWithBooking, ...prev]);

        if (promoCodeAppliedId) {
            setPromoCodes(prev => prev.map(p => p.id === promoCodeAppliedId ? { ...p, usageCount: p.usageCount + 1 } : p));
        }

        if (dpAmount > 0) {
            const today = new Date().toISOString().split('T')[0];
            try {
                const createdTx = await createTransaction({
                    date: today,
                    description: `DP Acara Pernikahan ${createdProject.projectName}`,
                    amount: dpAmount,
                    type: TransactionType.INCOME,
                    projectId: createdProject.id,
                    category: 'DP Acara Pernikahan',
                    method: 'Transfer Bank',
                    cardId: destinationCard.id,
                } as any);
                setTransactions(prev => {
                    const exists = prev.some(t => t.id === createdTx.id);
                    const list = exists ? prev.map(t => t.id === createdTx.id ? createdTx : t) : [createdTx, ...prev];
                    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                });
                setCards(prev => prev.map(c => c.id === destinationCard.id ? { ...c, balance: c.balance + dpAmount } : c));
            } catch (err) {
                console.error('Gagal mencatat transaksi DP ke Supabase:', err);
                // fallback: tetap update lokal
                const localTx: Transaction = {
                    id: `TRN-DP-${createdProject.id}`,
                    date: today,
                    description: `DP Acara Pernikahan ${createdProject.projectName}`,
                    amount: dpAmount,
                    type: TransactionType.INCOME,
                    projectId: createdProject.id,
                    category: 'DP Acara Pernikahan',
                    method: 'Transfer Bank',
                    cardId: destinationCard.id,
                };
                setTransactions(prev => {
                    const exists = prev.some(t => t.id === localTx.id);
                    const list = exists ? prev.map(t => t.id === localTx.id ? localTx : t) : [localTx, ...prev];
                    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                });
                setCards(prev => prev.map(c => c.id === destinationCard.id ? { ...c, balance: c.balance + dpAmount } : c));
            }
        }

        addNotification({
            title: 'Booking Baru Diterima!',
            message: `Booking dari ${createdClient.name} untuk Package "${bookingModal.pkg.name}" menunggu konfirmasi.`,
            icon: 'lead',
            link: { view: ViewType.BOOKING }
        });

        setIsSubmitting(false);
        setIsSubmitted(true);
    };

    const suggestedDp = totalProject * 0.3;

    return (
        isLoading ? (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent mx-auto mb-4"></div>
                    <p className="text-brand-text-secondary">Memuat data Package...</p>
                </div>
            </div>
        ) : error ? (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center p-6 max-w-md mx-auto bg-brand-surface rounded-lg shadow-md">
                    <div className="text-red-500 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-brand-text-light mb-2">Terjadi Kesalahan</h3>
                    <p className="text-brand-text-secondary mb-4">{error}</p>
                    <button
                        onClick={() => loadData(true)}
                        className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent-hover transition-colors cursor-pointer"
                    >
                        Coba Lagi
                    </button>
                </div>
            </div>
        ) : (
            <div className={`template-wrapper template-${template} min-h-screen`}>
                <style>{`
                .template-wrapper { background-color: var(--public-bg); color: var(--public-text-primary); }

                .template-wrapper .package-category-title::after {
                    content: "";
                    display: block;
                    width: 2rem;
                    height: 2px;
                    margin-top: 0.4rem;
                    border-radius: 9999px;
                    background-color: var(--color-accent);
                }

                /* Cover image: rounded top corners matching card */
                .template-wrapper .package-card-cover {
                    border-radius: 1rem 1rem 0 0;
                    overflow: hidden;
                }

                /* Booking button override — must beat app/index.css !important rules */
                .template-wrapper button.package-booking-button.button-primary,
                .template-wrapper .package-booking-button,
                button.package-booking-button {
                    font-size: 1.25rem !important;
                    font-weight: 800 !important;
                    min-height: 54px !important;
                    max-height: none !important;
                    height: auto !important;
                    line-height: 1.35 !important;
                    padding: 0.875rem 1.5rem !important;
                    width: 100% !important;
                    border-radius: 0.875rem !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    text-align: center !important;
                    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12) !important;
                }

                #package-booking-form .input-group {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 5px !important;
                }
                #package-booking-form .input-label {
                    position: static !important;
                    order: -1;
                    display: block !important;
                    inset: auto !important;
                    margin: 0 !important;
                    font-size: 13px !important;
                    line-height: 1.35 !important;
                    transform: none !important;
                    transition: none !important;
                    background-color: transparent !important;
                    color: var(--color-text-primary) !important;
                }
                #package-booking-form .input-field,
                #package-booking-form .input-field:focus,
                #package-booking-form select.input-field:focus {
                    border: 1px solid #111 !important;
                }
                #package-booking-form .input-field::placeholder {
                    color: rgba(42, 53, 71, 0.48) !important;
                    opacity: 1 !important;
                }
                #package-booking-form .payment-summary {
                    background-color: var(--color-accent) !important;
                    border-color: var(--color-accent) !important;
                }
                #package-booking-form .payment-summary,
                #package-booking-form .payment-summary :not(input) {
                    color: #fff !important;
                }
                #package-booking-form .payment-summary .border-brand-border {
                    border-color: rgba(255, 255, 255, 0.35) !important;
                }
                #package-booking-form .payment-summary .payment-bank-account {
                    background-color: rgba(255, 255, 255, 0.12) !important;
                    border-color: rgba(255, 255, 255, 0.35) !important;
                }
                #package-booking-form .payment-summary input.input-field {
                    color: var(--color-text-primary) !important;
                    caret-color: var(--color-text-primary) !important;
                }
                #package-booking-form .payment-summary .input-group {
                    gap: 7px !important;
                }
                #package-booking-form .payment-summary .input-group > p {
                    margin-top: 0 !important;
                    line-height: 1.35 !important;
                }
                @media (max-width: 768px) {
                    #package-booking-form {
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 0 !important;
                    }
                    #package-booking-form .package-addon-option {
                        flex-wrap: nowrap !important;
                        font-size: 0.8rem !important;
                        line-height: 1.35 !important;
                    }
                    #package-booking-form .package-addon-option > span {
                        min-width: 0 !important;
                        flex: 1 1 0% !important;
                    }
                    #package-booking-form .package-addon-option > div {
                        flex-shrink: 0 !important;
                        gap: 0.5rem !important;
                    }
                    #package-booking-form .package-addon-option > div > span {
                        white-space: nowrap !important;
                    }
                    #package-booking-form > .grid {
                        width: 100% !important;
                        gap: 1.5rem !important;
                    }
                    #package-booking-form .booking-form-section {
                        width: 100% !important;
                        min-width: 0 !important;
                        padding: 0 !important;
                        background: transparent !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                    }
                    #package-booking-form .booking-options-addon-section {
                        margin-top: 1rem !important;
                        padding-top: 0.75rem !important;
                        border-top: 1px solid color-mix(in srgb, var(--color-accent) 25%, transparent) !important;
                    }
                    #package-booking-form input.input-field:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]),
                    #package-booking-form select.input-field {
                        box-sizing: border-box;
                        min-height: 44px !important;
                        height: 44px !important;
                        padding: 0.65rem 0.75rem !important;
                        font-size: 16px !important;
                        line-height: 1.25 !important;
                    }
                    #package-booking-form .input-field:focus-visible {
                        outline: 2px solid var(--color-accent) !important;
                        outline-offset: 1px !important;
                    }
                    .template-wrapper .workflow-title {
                        font-size: 1rem !important;
                        line-height: 1.35 !important;
                    }
                    .template-wrapper .workflow-subtitle,
                    .template-wrapper .workflow-meta {
                        font-size: 0.75rem !important;
                        line-height: 1.35 !important;
                    }
                    .template-wrapper .workflow-label {
                        font-size: 0.875rem !important;
                        line-height: 1.35 !important;
                    }
                    .template-wrapper button.workflow-trigger {
                        min-height: 40px !important;
                        height: auto !important;
                        max-height: none !important;
                    }
                    .template-wrapper .workflow-copy {
                        font-size: 0.875rem !important;
                        line-height: 1.5 !important;
                    }
                    .template-wrapper .package-card-cover { height: 160px !important; }
                    .template-wrapper .package-category-title {
                        font-size: 1.5rem !important;
                        line-height: 1.25 !important;
                        overflow-wrap: anywhere;
                    }
                    .template-wrapper .package-category-description {
                        font-size: 0.875rem !important;
                        line-height: 1.5 !important;
                    }
                    .template-wrapper .package-card-title {
                        font-size: 1.35rem !important;
                        font-weight: 800 !important;
                        line-height: 1.25 !important;
                        letter-spacing: -0.01em !important;
                    }
                    .template-wrapper .package-main-price {
                        font-size: 1.75rem !important;
                        font-weight: 900 !important;
                        color: var(--color-accent, #5D87FF) !important;
                        line-height: 1.2 !important;
                        letter-spacing: -0.02em !important;
                    }
                    .template-wrapper .package-desc-text { font-size: 0.82rem !important; line-height: 1.5 !important; }
                    .template-wrapper .package-duration-row {
                        display: grid !important;
                        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                        gap: 0.5rem !important;
                        overflow: visible !important;
                    }
                    .template-wrapper .package-duration-heading { font-size: 0.75rem !important; }
                    .template-wrapper .package-duration-option {
                        min-height: 44px !important;
                        padding: 0.45rem 0.5rem !important;
                        min-width: 0 !important;
                        max-width: 100% !important;
                        width: 100% !important;
                        flex: initial !important;
                        gap: 0.2rem !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                        text-align: center !important;
                    }
                    .template-wrapper .package-duration-label {
                        font-size: 0.8rem !important;
                        font-weight: 600 !important;
                        line-height: 1.15 !important;
                        min-width: 0 !important;
                        max-width: 100% !important;
                        white-space: nowrap !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                        display: block !important;
                        text-align: center !important;
                    }
                    .template-wrapper .package-duration-price {
                        font-size: 1rem !important;
                        font-weight: 800 !important;
                        line-height: 1.15 !important;
                        color: var(--color-accent, #5D87FF) !important;
                        white-space: nowrap !important;
                        flex-shrink: 0 !important;
                        max-width: 100% !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                        display: block !important;
                        text-align: center !important;
                    }

                    /* Mobile booking button — kecil namun tetap nyaman dibaca */
                    .template-wrapper button.package-booking-button.button-primary,
                    .template-wrapper .package-booking-button,
                    button.package-booking-button,
                    .package-booking-button {
                        font-size: 0.9rem !important;
                        font-weight: 700 !important;
                        min-height: 42px !important;
                        max-height: none !important;
                        height: auto !important;
                        line-height: 1.3 !important;
                        padding: 0.7rem 0.9rem !important;
                        width: 100% !important;
                        border-radius: 0.75rem !important;
                        letter-spacing: 0.01em !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        text-align: center !important;
                        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12) !important;
                    }
                }
            `}</style>
                <div className="w-full max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
                    <header className="text-center mb-16 widget-animate">
                        {/* Hero Image */}
                        <div className="w-full h-56 sm:h-72 md:h-96 mb-8 rounded-3xl overflow-hidden shadow-2xl border border-brand-border/60">
                            <img src={userProfile.publicPageConfig?.backgroundImages?.portalPengantin || "/assets/images/backgrounds/portal-pengantin-3.jpg"} alt="Hero" className="w-full h-full object-cover" />
                        </div>
                        {publicPageConfig?.introduction && (
                            <p className="text-base md:text-lg text-brand-text-secondary mt-4 max-w-3xl mx-auto leading-relaxed">{publicPageConfig.introduction}</p>
                        )}
                    </header>

                    {publicPageConfig?.galleryImages && publicPageConfig.galleryImages.length > 0 && (
                        <section className="mb-8 md:mb-10 widget-animate -mx-4" style={{ animationDelay: '100ms' }}>
                            <div className="text-center mb-4">
                                <h3 className="text-2xl font-bold text-brand-text-light">Pricelist</h3>
                                <p className="text-sm text-brand-text-secondary mt-1">Pricelist {userProfile?.companyName || 'Vena Pictures'}</p>
                            </div>
                            <div className="space-y-2 sm:space-y-3">
                                {publicPageConfig?.galleryImages?.map((imgSrc, index) => (
                                    <div key={index} className="group">
                                        <img
                                            src={imgSrc}
                                            alt={`Gallery image ${index + 1}`}
                                            loading="lazy"
                                            className="w-full h-auto object-cover rounded-none shadow-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="mb-12 md:mb-16 grid md:grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 widget-animate" style={{ animationDelay: '200ms' }}>
                        {/* ── Workflow & Timeline Layanan ── */}
                        <div
                            className="bg-brand-surface rounded-2xl shadow-lg border border-brand-border p-3 md:p-4 sm:p-6 cursor-pointer hover:border-brand-accent/50 transition-all"
                            onClick={() => {
                                const nextState = !isWorkflowOpen;
                                setIsWorkflowOpen(nextState);
                                setIsTermsOpen(false);
                                if (nextState && !openWorkflowId && activeWorkflows.length > 0) {
                                    setOpenWorkflowId(activeWorkflows[0].id);
                                }
                            }}
                        >
                            <div className="flex justify-between items-center text-left">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-brand-accent/15 flex items-center justify-center text-brand-accent">
                                        <ListOrdered className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg md:text-xl font-bold text-gradient workflow-title">
                                            Workflow & Timeline Layanan
                                        </h3>
                                        <p className="text-xs text-brand-text-secondary workflow-subtitle">
                                            {activeWorkflows.length} Alur Kerja Tersedia
                                        </p>
                                    </div>
                                </div>
                                <ChevronDownIcon className={`w-6 h-6 transition-transform text-brand-text-secondary ${isWorkflowOpen ? 'rotate-180' : ''}`} />
                            </div>

                            <div className={`transition-all duration-500 ease-in-out grid ${isWorkflowOpen ? 'grid-rows-[1fr] mt-4 opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                <div className="overflow-hidden">
                                    <div className="space-y-3">
                                        {activeWorkflows.map((wf, wfIdx) => {
                                            const isExpanded = openWorkflowId === wf.id || (openWorkflowId === null && wfIdx === 0);
                                            return (
                                                <div key={wf.id || wfIdx} className="border border-brand-border rounded-xl overflow-hidden bg-brand-bg/40">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenWorkflowId(isExpanded ? '' : wf.id);
                                                        }}
                                                        className="w-full flex justify-between items-center text-left p-3 hover:bg-brand-bg/80 transition-colors workflow-trigger"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-5 h-5 rounded-md bg-brand-accent/20 text-brand-accent flex items-center justify-center text-xs font-bold">
                                                                {wfIdx + 1}
                                                            </span>
                                                            <h4 className="font-semibold text-brand-text-light text-sm workflow-label">
                                                                {wf.title}
                                                            </h4>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] bg-brand-surface text-brand-text-secondary px-2 py-0.5 rounded-full border border-brand-border workflow-meta">
                                                                {wf.timeline.length} Tahapan
                                                            </span>
                                                            <ChevronDownIcon className={`w-4 h-4 transition-transform text-brand-text-secondary ${isExpanded ? 'rotate-180' : ''}`} />
                                                        </div>
                                                    </button>
                                                    <div className={`transition-all duration-300 ease-in-out grid ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                                                        <div className="overflow-hidden">
                                                            <div className="p-3 pt-1 space-y-2 border-t border-brand-border/60">
                                                                {wf.timeline.map((item, itemIdx) => (
                                                                    <div key={itemIdx} className="flex items-start gap-2.5 text-sm text-brand-text-secondary workflow-copy">
                                                                        <span className="w-4 h-4 rounded-full bg-brand-accent/15 text-brand-accent flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">
                                                                            {itemIdx + 1}
                                                                        </span>
                                                                        <span className="leading-snug">{item}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Syarat & Ketentuan Paket ── */}
                        <div
                            className="bg-brand-surface rounded-2xl shadow-lg border border-brand-border p-3 md:p-4 sm:p-6 cursor-pointer hover:border-brand-accent/50 transition-all"
                            onClick={() => {
                                setIsTermsOpen(!isTermsOpen);
                                setIsWorkflowOpen(false);
                            }}
                        >
                            <div className="flex justify-between items-center text-left">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-brand-accent/15 flex items-center justify-center text-brand-accent">
                                        <ShieldCheck className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg md:text-xl font-bold text-gradient workflow-title">
                                            Syarat & Ketentuan Paket
                                        </h3>
                                        <p className="text-xs text-brand-text-secondary workflow-subtitle">
                                            {activePackageTerms.length} Bagian Ketentuan Booking
                                        </p>
                                    </div>
                                </div>
                                <ChevronDownIcon className={`w-6 h-6 transition-transform text-brand-text-secondary ${isTermsOpen ? 'rotate-180' : ''}`} />
                            </div>

                            <div className={`transition-all duration-500 ease-in-out grid ${isTermsOpen ? 'grid-rows-[1fr] mt-4 opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                <div className="overflow-hidden">
                                    <div className="max-h-96 overflow-y-auto pr-1 space-y-3">
                                        {activePackageTerms && activePackageTerms.length > 0 ? (
                                            activePackageTerms.map((section, sIdx) => (
                                                <div key={section.id || sIdx} className="border border-brand-border/80 bg-brand-bg/40 rounded-xl p-3.5 space-y-2.5">
                                                    <h4 className="font-semibold text-brand-text-light text-sm flex items-center gap-2 workflow-label">
                                                        <span className="w-5 h-5 rounded-md bg-brand-accent/20 text-brand-accent flex items-center justify-center text-xs font-bold">
                                                            {sIdx + 1}
                                                        </span>
                                                        <span>{section.title}</span>
                                                    </h4>
                                                    <ul className="space-y-1.5 pl-7 text-sm text-brand-text-secondary workflow-copy">
                                                        {section.items.map((item, itemIdx) => (
                                                            <li key={itemIdx} className="flex items-start gap-2">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                                                <span className="leading-snug">{item}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))
                                        ) : formattedTerms ? (
                                            <div>{formattedTerms}</div>
                                        ) : (
                                            <p className="text-brand-text-secondary text-center py-8">
                                                Syarat dan ketentuan paket belum diatur oleh vendor.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>



                    <div className="grid lg:grid-cols-3 gap-8 md:gap-10 items-start">
                        <section className="lg:col-span-2 min-w-0 space-y-16">
                            {Object.keys(packagesByCategory).length === 0 && (
                                <div className="text-center py-20 bg-brand-surface rounded-3xl border border-brand-border p-8 shadow-sm">
                                    <MapPin className="w-12 h-12 mx-auto text-brand-text-secondary mb-3 opacity-40" />
                                    <h4 className="text-lg font-bold text-brand-text-light">Belum Ada Paket untuk Wilayah Ini</h4>
                                    <p className="text-sm text-brand-text-secondary mt-1 max-w-md mx-auto">
                                        Saat ini belum ada paket yang terdaftar khusus untuk wilayah {selectedRegion ? (REGIONS.find(r => r.value.toLowerCase() === selectedRegion.toLowerCase())?.label || selectedRegion) : ''}.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRegion(null)}
                                        className="mt-6 px-5 py-2.5 rounded-xl bg-brand-accent text-white text-xs font-bold shadow-sm cursor-pointer hover:bg-brand-accent-hover transition-colors"
                                    >
                                        Tampilkan Semua Wilayah
                                    </button>
                                </div>
                            )}
                            {Object.entries(packagesByCategory as Record<string, Package[]>).map(([category, pkgs]) => (
                                <div key={category} className="space-y-8">
                                    <div className="rounded-lg border border-brand-border/70 bg-brand-surface p-3 sm:p-4">
                                        <h3 className="package-category-title text-2xl md:text-3xl font-extrabold text-brand-accent">{category}</h3>
                                        <p className="package-category-description text-brand-text-secondary mt-2 max-w-2xl text-sm md:text-base leading-relaxed">
                                            {categoryDescriptions[category] || `Berbagai pilihan Package untuk kebutuhan ${category.toLowerCase()} Anda.`}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                        {pkgs.map((pkg, index) => (
                                            <div key={pkg.id} className="relative bg-brand-surface rounded-3xl shadow-lg border border-brand-border flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl widget-animate" style={{ animationDelay: `${200 + index * 100}ms` }}>
                                                {pkg.id === mostPopularPackageId && (
                                                    <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 text-xs font-bold px-3.5 py-1.5 rounded-full shadow-md z-10">Paling Populer</div>
                                                )}
                                                {pkg.coverImage ? (
                                                    <div className="package-card-cover w-full h-48 sm:h-56 overflow-hidden bg-brand-bg">
                                                        <img
                                                            src={pkg.coverImage}
                                                            alt={pkg.name}
                                                            loading="lazy"
                                                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="package-card-cover w-full h-48 sm:h-56 bg-brand-bg/60 flex items-center justify-center">
                                                        <CameraIcon className="w-12 h-12 text-brand-text-secondary/50" />
                                                    </div>
                                                )}
                                                <div className="p-6 md:p-8 flex flex-col flex-grow space-y-4">
                                                    <h4 className="package-card-title text-lg md:text-xl font-bold text-brand-text-light">{pkg.name}</h4>
                                                    {pkg.durationOptions?.length ? (
                                                        <div className="space-y-2">
                                                            <p className="package-duration-heading text-xs font-semibold text-brand-text-secondary">Pilihan Durasi</p>
                                                            <div className="package-duration-row flex flex-nowrap gap-2 overflow-x-auto pb-1">
                                                                {pkg.durationOptions.map(option => (
                                                                    <div key={option.label} className="package-duration-option flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-bg/50 px-3 py-2 text-xs shrink-0">
                                                                        <span className="package-duration-label font-medium text-brand-text-secondary truncate">{option.label}{option.default ? ' · Default' : ''}</span>
                                                                        <span className="package-duration-price shrink-0 font-bold text-brand-text-light">{formatCurrency(option.price)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="package-main-price text-2xl md:text-3xl font-extrabold text-brand-text-light">{formatCurrency(pkg.price)}</p>
                                                    )}
                                                    <div className="package-desc-text space-y-2 text-xs md:text-sm text-brand-text-secondary flex-grow pt-2">
                                                        {pkg.photographers && (
                                                            <div className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-brand-accent shrink-0" /><span>{pkg.photographers}</span></div>
                                                        )}
                                                        {pkg.videographers && (
                                                            <div className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-brand-accent shrink-0" /><span>{pkg.videographers}</span></div>
                                                        )}
                                                        {pkg.digitalItems.length > 0 && pkg.digitalItems.map((item, i) => (
                                                            <div key={`d-${i}`} className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-brand-accent shrink-0" /><span>{item}</span></div>
                                                        ))}
                                                        {pkg.physicalItems.length > 0 && pkg.physicalItems.map((item, i) => (
                                                            <div key={`p-${i}`} className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-brand-accent shrink-0" /><span>{item.name}</span></div>
                                                        ))}
                                                    </div>
                                                    <div className="pt-4 border-t border-brand-border mt-auto">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenBookingModal(pkg)}
                                                            className="package-booking-button button-primary w-full text-center"
                                                        >
                                                            Booking Package Ini
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </section>

                        {visibleAddOns.length > 0 && (
                            <aside className="lg:col-span-1 min-w-0 lg:sticky lg:top-8 widget-animate" style={{ animationDelay: '500ms' }}>
                                <div className="bg-brand-surface rounded-2xl shadow-lg border border-brand-border">
                                    <h3 className="text-lg md:text-xl font-bold text-brand-text-light p-4 md:p-6">
                                        Tambahan Opsional {selectedRegion ? `(${selectedRegion.toUpperCase()})` : ''}
                                    </h3>
                                    <div className="border-t border-brand-border">
                                        {visibleAddOns.map(addOn => (
                                            <AddOnItem key={addOn.id} addOn={addOn} />
                                        ))}
                                    </div>
                                </div>
                            </aside>
                        )}
                    </div>

                    <section className="py-12 bg-gray-50">
                        <div className="max-w-4xl mx-auto px-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h3 className="text-lg font-bold text-brand-text-light mb-4">Social Media</h3>
                                    {(() => {
                                        const formatSocialUrl = (platform: 'tiktok' | 'instagram' | 'facebook' | 'youtube' | 'whatsapp', input?: string): string => {
                                            if (!input) return '';
                                            const trimmed = input.trim();
                                            if (!trimmed) return '';
                                            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

                                            if (platform === 'tiktok') {
                                                const handle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
                                                return `https://www.tiktok.com/${handle}`;
                                            }
                                            if (platform === 'instagram') {
                                                const handle = trimmed.replace(/^@/, '');
                                                return `https://www.instagram.com/${handle}`;
                                            }
                                            if (platform === 'facebook') {
                                                return `https://www.facebook.com/${trimmed.replace(/^@/, '')}`;
                                            }
                                            if (platform === 'youtube') {
                                                const handle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
                                                return `https://www.youtube.com/${handle}`;
                                            }
                                            if (platform === 'whatsapp') {
                                                const cleaned = trimmed.replace(/\D/g, '');
                                                const normalized = cleaned.startsWith('0') ? `62${cleaned.slice(1)}` : cleaned;
                                                return `https://wa.me/${normalized}`;
                                            }
                                            return trimmed;
                                        };

                                        const tiktokVal = userProfile.tiktok || userProfile.publicPageConfig?.socialMedia?.tiktok;
                                        const instagramVal = userProfile.instagram || userProfile.publicPageConfig?.socialMedia?.instagram;
                                        const facebookVal = userProfile.facebook || userProfile.publicPageConfig?.socialMedia?.facebook;
                                        const youtubeVal = userProfile.youtube || userProfile.publicPageConfig?.socialMedia?.youtube;
                                        const whatsappVal = userProfile.phone || userProfile.publicPageConfig?.socialMedia?.whatsapp;

                                        const links = [
                                            tiktokVal && {
                                                id: 'tiktok',
                                                name: 'TikTok',
                                                url: formatSocialUrl('tiktok', tiktokVal),
                                                icon: (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 00-1-.08A6.34 6.34 0 003 15.66a6.34 6.34 0 0010.86 4.43c.27-.27.5-.57.69-.9V11.8a8.16 8.16 0 005.04 1.75v-3.41c-.001 0-.001-.001 0 0a4.85 4.85 0 01-3.45-1.45 4.8 4.8 0 01-1.04-2v-.002h4.49v.002z" />
                                                    </svg>
                                                )
                                            },
                                            instagramVal && {
                                                id: 'instagram',
                                                name: 'Instagram',
                                                url: formatSocialUrl('instagram', instagramVal),
                                                icon: (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                        <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                                                    </svg>
                                                )
                                            },
                                            facebookVal && {
                                                id: 'facebook',
                                                name: 'Facebook',
                                                url: formatSocialUrl('facebook', facebookVal),
                                                icon: (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                        <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                                                    </svg>
                                                )
                                            },
                                            youtubeVal && {
                                                id: 'youtube',
                                                name: 'YouTube',
                                                url: formatSocialUrl('youtube', youtubeVal),
                                                icon: (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                                    </svg>
                                                )
                                            },
                                            whatsappVal && {
                                                id: 'whatsapp',
                                                name: 'WhatsApp',
                                                url: formatSocialUrl('whatsapp', whatsappVal),
                                                icon: (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                        <path d="M12.031 2C6.516 2 2.031 6.485 2.031 12c0 1.97.575 3.805 1.568 5.352L2.016 22l4.793-1.554A9.957 9.957 0 0012.031 22c5.515 0 10-4.485 10-10s-4.485-10-10-10zm5.823 14.15c-.244.685-1.22 1.309-1.996 1.409-.529.068-1.221.097-3.535-.863-2.955-1.228-4.858-4.225-5.006-4.421-.143-.197-1.189-1.583-1.189-3.02 0-1.437.753-2.146 1.02-2.438.267-.293.585-.366.78-.366.195 0 .39.002.561.01.181.008.423-.069.66.503.245.586.83 2.025.903 2.172.073.147.122.317.024.513-.097.195-.146.317-.292.488-.147.171-.309.382-.44.513-.147.146-.3.307-.129.6.171.293.76 1.254 1.631 2.03 1.121.997 2.066 1.308 2.359 1.454.293.147.464.122.635-.073.171-.195.732-.854.927-1.147.195-.293.39-.244.66-.146.268.097 1.708.805 2.001.951.293.147.488.22.561.342.073.122.073.708-.171 1.393z"/>
                                                    </svg>
                                                )
                                            }
                                        ].filter(Boolean) as { id: string; name: string; url: string; icon: React.ReactNode }[];

                                        if (links.length > 0) {
                                            return (
                                                <div className="flex flex-wrap items-center gap-3 mb-6">
                                                    {links.map((item) => (
                                                        <a
                                                            key={item.id}
                                                            href={item.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title={`${item.name} (${item.url})`}
                                                            aria-label={item.name}
                                                            className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-700 hover:text-brand-accent hover:border-brand-accent/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                                                        >
                                                            {item.icon}
                                                        </a>
                                                    ))}
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="flex space-x-3 mb-6">
                                                <span className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400" title="TikTok dapat diatur di menu Pengaturan > Profil">
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 00-1-.08A6.34 6.34 0 003 15.66a6.34 6.34 0 0010.86 4.43c.27-.27.5-.57.69-.9V11.8a8.16 8.16 0 005.04 1.75v-3.41c-.001 0-.001-.001 0 0a4.85 4.85 0 01-3.45-1.45 4.8 4.8 0 01-1.04-2v-.002h4.49v.002z" /></svg>
                                                </span>
                                                <span className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400" title="Instagram dapat diatur di menu Pengaturan > Profil">
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" /></svg>
                                                </span>
                                                <span className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400" title="Facebook dapat diatur di menu Pengaturan > Profil">
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
                                                </span>
                                            </div>
                                        );
                                    })()}

                                    <div className="space-y-2">
                                        <div className="flex items-start">
                                            <svg className="w-5 h-5 text-gray-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                            <a href={`mailto:${userProfile.email}`} className="text-gray-700 hover:text-brand-accent transition-colors">{userProfile.email}</a>
                                        </div>
                                        <div className="flex items-start">
                                            <svg className="w-5 h-5 text-gray-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            <a href={`tel:${userProfile.phone}`} className="text-gray-700 hover:text-brand-accent transition-colors">{userProfile.phone}</a>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-brand-text-light mb-4">Alamat</h3>
                                    <div className="space-y-4">
                                        <div className="flex">
                                            <svg className="w-5 h-5 text-gray-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <div>
                                                <p className="font-medium text-gray-800">Alamat Utama</p>
                                                <p className="text-gray-700 whitespace-pre-line">{userProfile.address || 'Alamat belum diatur'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <footer className="text-center py-8 border-t border-brand-border">
                        <p className="text-xs text-brand-text-secondary">&copy; {new Date().getFullYear()} {userProfile.companyName}.</p>
                    </footer>

                    {/* Pricelist PDF Download Button */}
                    {(() => {
                        const regionPricelists = userProfile.publicPageConfig?.regionPricelists || [];
                        const targetPricelist = selectedRegion
                            ? regionPricelists.find(p => p.region.toLowerCase() === selectedRegion.toLowerCase())
                            : regionPricelists.find(p => p.region.toLowerCase() === 'semua') || (regionPricelists.length > 0 ? regionPricelists[0] : null);

                        if (!targetPricelist && !userProfile.publicPageConfig?.pricelistPdfUrl) return null;

                        const pdfUrl = targetPricelist?.pdfUrl || userProfile.publicPageConfig?.pricelistPdfUrl;
                        if (!pdfUrl) return null;

                        return (
                            <div className="fixed bottom-6 right-6 z-40">
                                <button
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = pdfUrl;
                                        link.download = targetPricelist?.fileName || 'pricelist.pdf';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }}
                                    className="flex items-center gap-2 px-4 py-3 bg-brand-accent hover:bg-brand-accent-hover text-white rounded-full shadow-lg transition-all duration-300 hover:scale-105"
                                    title={`Download Pricelist ${targetPricelist?.title || ''}`}
                                >
                                    <Download className="w-5 h-5" />
                                    <span className="font-semibold text-sm">{targetPricelist?.buttonLabel || 'Download Pricelist'}</span>
                                </button>
                            </div>
                        );
                    })()}
                </div>

                <Modal isOpen={bookingModal.isOpen} onClose={handleCloseBookingModal} title={`Booking: ${bookingModal.pkg?.name}`} size="5xl">
                    {isSubmitted ? (
                        <div className="p-4 sm:p-8">
                            <div className="mx-auto max-w-md rounded-[28px] border border-brand-border/80 bg-gradient-to-br from-brand-surface via-white to-brand-bg/70 p-5 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.35)] sm:p-7">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner shadow-emerald-200/80">
                                    <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" aria-hidden="true">
                                        <path d="M5 12.5 9.2 16.7 19 6.8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>

                                <div className="mt-5 text-center">
                                    <h3 className="text-2xl font-black tracking-tight text-brand-text-light sm:text-3xl">Terima Kasih!</h3>
                                    <p className="mt-3 text-sm leading-relaxed text-brand-text-secondary sm:text-base">
                                        Formulir booking Anda telah kami terima. Tim kami akan segera menghubungi Anda untuk konfirmasi.
                                    </p>
                                </div>

                                <div className="mt-7 space-y-3">
                                    <a
                                        href={whatsappUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="button-primary w-full justify-center"
                                    >
                                        Konfirmasi via WhatsApp
                                    </a>
                                    <button
                                        type="button"
                                        onClick={handleCloseBookingModal}
                                        className="button-secondary w-full justify-center"
                                    >
                                        Tutup
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                    <form id="package-booking-form" onSubmit={handleSubmit} className="space-y-8 p-2 sm:p-4 form-compact form-compact--ios-scale">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            {/* Column 1: Client Info & Main Package */}
                            <div className="space-y-6 bg-brand-surface/60 p-6 rounded-3xl border border-brand-border/80 shadow-sm booking-form-section">
                                <div className="space-y-1">
                                    <h4 className="text-base font-bold text-brand-text-light flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-brand-accent"></span>
                                        Informasi Anda & Acara Pernikahan
                                    </h4>
                                    <p className="text-xs text-brand-text-secondary">Lengkapi data diri dan detail acara Anda.</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="input-group"><input type="text" id="clientName" name="clientName" value={formData.clientName} onChange={handleFormChange} className="input-field" placeholder="Contoh: Andi & Sinta" required /><label htmlFor="clientName" className="input-label">Nama Pengantin</label></div>
                                    <div className="input-group"><input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleFormChange} className="input-field" placeholder="Contoh: 0812 3456 7890" required /><label htmlFor="phone" className="input-label">Nomor WhatsApp</label></div>
                                    <div className="input-group">
                                        <input type="date" id="date" name="date" value={formData.date} onChange={handleFormChange} className="input-field" placeholder=" " />
                                        <label htmlFor="date" className="input-label">Tanggal Acara Pernikahan (Opsional)</label>
                                        {!formData.date && <p className="text-[10px] text-brand-text-secondary mt-1">Kosongkan jika tanggal acara belum ditentukan.</p>}
                                        {formData.date && (
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, date: '' }))} className="mt-1 text-xs font-semibold text-brand-accent hover:underline">
                                                Kosongkan tanggal
                                            </button>
                                        )}
                                    </div>
                                    <div className="input-group"><input type="text" id="location" name="location" value={formData.location} onChange={handleFormChange} className="input-field" placeholder="Contoh: Kota / nama gedung" /><label htmlFor="location" className="input-label">Alamat Acara Pernikahan</label></div>
                                </div>

                                <div className="pt-4 border-t border-brand-border space-y-4">
                                    <div className="space-y-1">
                                        <h4 className="text-base font-bold text-brand-text-light flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-brand-accent"></span>
                                            Pilihan Package & Durasi
                                        </h4>
                                        <p className="text-xs text-brand-text-secondary">Detail paket utama yang dipilih.</p>
                                    </div>

                                    {bookingModal.pkg && (() => {
                                        const pkg = bookingModal.pkg;
                                        const hasDurationOpts = pkg.durationOptions && pkg.durationOptions.length > 0;
                                        const selectedOpt = hasDurationOpts
                                            ? (pkg.durationOptions!.find(o => o.label === formData.durationSelection) || pkg.durationOptions!.find(o => o.default) || pkg.durationOptions![0])
                                            : null;
                                        const photographers = selectedOpt?.photographers || pkg.photographers;
                                        const videographers = selectedOpt?.videographers || pkg.videographers;
                                        const processingTime = selectedOpt?.processingTime || pkg.processingTime;
                                        const digitalItems = (selectedOpt?.digitalItems?.filter(Boolean).length ? selectedOpt.digitalItems : pkg.digitalItems)?.filter(Boolean) || [];
                                        const physicalItems = (selectedOpt?.physicalItems?.filter((p: { name?: string }) => p?.name).length ? selectedOpt.physicalItems : pkg.physicalItems)?.filter((p: { name?: string }) => p?.name) || [];
                                        const hasAnyDetail = photographers || videographers || processingTime || digitalItems.length > 0 || physicalItems.length > 0;
                                        return (
                                            <div className="p-4 border border-brand-border bg-brand-bg/50 rounded-2xl space-y-2.5">
                                                <p className="text-xs font-bold text-brand-accent flex items-center justify-between">
                                                    <span>{pkg.name}</span>
                                                    {selectedOpt && hasDurationOpts && <span className="font-normal text-brand-text-secondary">({selectedOpt.label})</span>}
                                                </p>
                                                {hasAnyDetail ? (
                                                    <ul className="text-xs text-brand-text-secondary space-y-1.5 pl-2">
                                                        {photographers && <li className="flex items-center gap-2"><CheckIcon className="w-3.5 h-3.5 text-brand-accent shrink-0" /><span>{photographers}</span></li>}
                                                        {videographers && <li className="flex items-center gap-2"><CheckIcon className="w-3.5 h-3.5 text-brand-accent shrink-0" /><span>{videographers}</span></li>}
                                                        {processingTime && <li className="flex items-center gap-2"><CheckIcon className="w-3.5 h-3.5 text-brand-accent shrink-0" /><span>Pengerjaan: {processingTime}</span></li>}
                                                        {digitalItems.map((item: string, i: number) => <li key={i} className="flex items-center gap-2"><CheckIcon className="w-3.5 h-3.5 text-brand-accent shrink-0" /><span>{item}</span></li>)}
                                                        {physicalItems.map((item: { name: string }, i: number) => <li key={i} className="flex items-center gap-2"><CheckIcon className="w-3.5 h-3.5 text-brand-accent shrink-0" /><span>{item.name}</span></li>)}
                                                    </ul>
                                                ) : (
                                                    <p className="text-xs text-brand-text-secondary italic">Pilih opsi Jam Kerja untuk melihat detail.</p>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {bookingModal.pkg?.durationOptions && bookingModal.pkg.durationOptions.length > 0 && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-brand-text-light">Jam Kerja / Durasi</label>
                                            <div className="package-duration-row flex flex-nowrap gap-2 overflow-x-auto pb-2">
                                                {bookingModal.pkg.durationOptions.map(opt => {
                                                    const isSelected = formData.durationSelection === opt.label;
                                                    return (
                                                        <label key={opt.label} className={`package-duration-card flex min-w-[150px] cursor-pointer flex-col justify-between gap-2 rounded-2xl border-2 p-3 transition-all shrink-0 ${isSelected ? 'border-brand-accent bg-brand-accent text-white shadow-sm' : 'border-brand-border bg-brand-surface hover:border-brand-accent/50'}`}>
                                                            <span className={`flex items-center justify-between gap-2 text-xs font-semibold ${isSelected ? 'text-white' : 'text-brand-text-primary'}`}>
                                                                {opt.label}
                                                                {opt.default && <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${isSelected ? 'bg-white/20 text-white' : 'bg-brand-accent/10 text-brand-accent'}`}>Default</span>}
                                                            </span>
                                                            <span className={`flex items-center justify-between gap-2 pt-2 border-t ${isSelected ? 'border-white/40' : 'border-brand-border/60'}`}>
                                                                <span className={`package-duration-price-value text-[10px] font-medium ${isSelected ? 'text-white' : 'text-brand-text-secondary'}`}>{formatCurrency(opt.price)}</span>
                                                                <input type="radio" name="durationSelection" value={opt.label} checked={isSelected} onChange={handleFormChange} className={`h-4 w-4 ${isSelected ? 'accent-white' : 'accent-brand-accent'}`} />
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Column 2: Optional Packages, Add-ons, Promo, Payment */}
                            <div className="space-y-4 md:space-y-6 booking-form-section">
                                {visiblePackages.filter(p => p.id !== bookingModal.pkg?.id).length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="flex items-center gap-2 text-xs font-bold text-brand-text-light">
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent md:hidden" />
                                            Paket Tambahan (Opsional)
                                        </h4>
                                        <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                                            {visiblePackages
                                                .filter(p => p.id !== bookingModal.pkg?.id)
                                                .map(pkg => {
                                                    const isSelected = optionalPackages.some(op => op.id === pkg.id);
                                                    const selectedOptional = optionalPackages.find(op => op.id === pkg.id);
                                                    const hasDurationOpts = pkg.durationOptions && pkg.durationOptions.length > 0;
                                                    const selectedOpt = hasDurationOpts
                                                        ? (pkg.durationOptions!.find(o => o.label === selectedOptional?.selectedDuration) || pkg.durationOptions!.find(o => o.default) || pkg.durationOptions![0])
                                                        : null;
                                                    const photographers = selectedOpt?.photographers || pkg.photographers;
                                                    const videographers = selectedOpt?.videographers || pkg.videographers;
                                                    const processingTime = selectedOpt?.processingTime || pkg.processingTime;
                                                    const digitalItems = (selectedOpt?.digitalItems?.filter(Boolean).length ? selectedOpt.digitalItems : pkg.digitalItems)?.filter(Boolean) || [];
                                                    const physicalItems = (selectedOpt?.physicalItems?.filter((p: { name?: string }) => p?.name).length ? selectedOpt.physicalItems : pkg.physicalItems)?.filter((p: { name?: string }) => p?.name) || [];
                                                    const hasAnyDetail = photographers || videographers || processingTime || digitalItems.length > 0 || physicalItems.length > 0;
                                                    return (
                                                        <div key={pkg.id} className="p-3.5 border border-brand-border bg-brand-bg/40 rounded-2xl space-y-2.5 text-xs">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                const defaultDuration = pkg.durationOptions && pkg.durationOptions.length > 0
                                                                                    ? (pkg.durationOptions.find(o => o.default) || pkg.durationOptions[0])
                                                                                    : undefined;
                                                                                setOptionalPackages([...optionalPackages, { 
                                                                                    id: pkg.id, 
                                                                                    name: pkg.name, 
                                                                                    price: defaultDuration?.price ?? pkg.price,
                                                                                    selectedDuration: defaultDuration?.label
                                                                                }]);
                                                                            } else {
                                                                                setOptionalPackages(optionalPackages.filter(op => op.id !== pkg.id));
                                                                            }
                                                                        }}
                                                                        className="h-4 w-4 rounded accent-brand-accent"
                                                                    />
                                                                    <span className="font-bold text-brand-text-light">{pkg.name}</span>
                                                                </label>
                                                                <span className="font-extrabold text-brand-accent">
                                                                    {formatCurrency(selectedOptional?.price ?? (hasDurationOpts ? (pkg.durationOptions!.find(o => o.default) || pkg.durationOptions![0])!.price : pkg.price))}
                                                                </span>
                                                            </div>
                                                            {isSelected && (
                                                                <div className="pt-3 pl-6 space-y-2.5 border-t border-brand-border/60">
                                                                    {hasAnyDetail ? (
                                                                        <ul className="text-[11px] text-brand-text-secondary space-y-1.5">
                                                                            {photographers && <li className="flex items-center gap-1.5"><CheckIcon className="w-3.5 h-3.5 text-brand-accent shrink-0" /><span>{photographers}</span></li>}
                                                                            {videographers && <li className="flex items-center gap-1.5"><CheckIcon className="w-3.5 h-3.5 text-brand-accent shrink-0" /><span>{videographers}</span></li>}
                                                                            {processingTime && <li className="flex items-center gap-1.5"><CheckIcon className="w-3.5 h-3.5 text-brand-accent shrink-0" /><span>Pengerjaan: {processingTime}</span></li>}
                                                                            {digitalItems.map((item: string, i: number) => <li key={i} className="flex items-center gap-1.5"><CheckIcon className="w-3.5 h-3.5 text-brand-accent shrink-0" /><span>{item}</span></li>)}
                                                                            {physicalItems.map((item: { name: string }, i: number) => <li key={i} className="flex items-center gap-1.5"><CheckIcon className="w-3.5 h-3.5 text-brand-accent shrink-0" /><span>{item.name}</span></li>)}
                                                                        </ul>
                                                                    ) : pkg.processingTime ? (
                                                                        <p className="text-[11px] text-brand-text-secondary whitespace-pre-wrap">Pengerjaan: {pkg.processingTime}</p>
                                                                    ) : null}

                                                                    {hasDurationOpts && (
                                                                        <div className="pt-2">
                                                                            <p className="text-[10px] font-semibold text-brand-text-secondary mb-1.5">Pilih Jam Kerja Tambahan:</p>
                                                                            <div className="package-duration-row flex flex-nowrap gap-2 overflow-x-auto pb-1">
                                                                                {pkg.durationOptions!.map(opt => {
                                                                                    const isOptSelected = selectedOptional?.selectedDuration === opt.label;
                                                                                    return (
                                                                                        <label key={opt.label} className={`package-duration-card flex min-w-[130px] cursor-pointer flex-col justify-between gap-1 rounded-xl border p-2 text-[10px] shrink-0 ${isOptSelected ? 'border-brand-accent bg-brand-accent text-white font-bold' : 'border-brand-border bg-brand-surface'}`}>
                                                                                            <span className="flex items-center justify-between">
                                                                                                <span>{opt.label}</span>
                                                                                                <input 
                                                                                                    type="radio" 
                                                                                                    name={`duration-${pkg.id}`} 
                                                                                                    checked={isOptSelected}
                                                                                                    onChange={() => {
                                                                                                        setOptionalPackages(optionalPackages.map(op => 
                                                                                                            op.id === pkg.id 
                                                                                                            ? { ...op, price: Number(opt.price), selectedDuration: opt.label }
                                                                                                            : op
                                                                                                        ));
                                                                                                    }}
                                                                                                    className={`h-3 w-3 ${isOptSelected ? 'accent-white' : 'accent-brand-accent'}`}
                                                                                                />
                                                                                            </span>
                                                                                            <span className={`font-bold ${isOptSelected ? 'text-white' : 'text-brand-accent'}`}>{formatCurrency(opt.price)}</span>
                                                                                        </label>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}

                                {visibleAddOns.length > 0 && (
                                    <div className="booking-options-addon-section space-y-2 border-t border-brand-accent/25 pt-3 md:border-t-0 md:pt-0">
                                        <h4 className="flex items-center gap-2 text-xs font-bold text-brand-text-light">
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent md:hidden" />
                                            Add-On Lainnya {selectedRegion ? `(Wilayah ${selectedRegion.toUpperCase()})` : ''}
                                        </h4>
                                        <div className="max-h-[600px] overflow-y-auto divide-y divide-brand-border/70">
                                            {visibleAddOns.map(addon => (
                                                <label key={addon.id} className="package-addon-option flex items-center justify-between px-2 py-2 hover:bg-brand-surface cursor-pointer text-xs transition-colors">
                                                    <span className="font-medium text-brand-text-primary">{addon.name}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-semibold text-brand-text-secondary">{formatCurrency(addon.price)}</span>
                                                        <input type="checkbox" id={addon.id} name="addOns" checked={formData.selectedAddOnIds.includes(addon.id)} onChange={handleFormChange} className="h-4 w-4 rounded accent-brand-accent" />
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="input-group">
                                        <input type="text" id="promoCode" name="promoCode" value={formData.promoCode} onChange={handleFormChange} className="input-field" placeholder="Contoh: WEDDING10" />
                                        <label htmlFor="promoCode" className="input-label">Kode Promo (Opsional)</label>
                                        {promoFeedback.message && <p className={`text-xs mt-1 ${promoFeedback.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{promoFeedback.message}</p>}
                                    </div>
                                    <div className="input-group">
                                        <RupiahInput
                                            id="transportCost"
                                            name="transportCost"
                                            value={String(formData.transportCost ?? '')}
                                            onChange={(raw) => setFormData(prev => ({ ...prev, transportCost: raw }))}
                                            className="input-field"
                                            placeholder="Contoh: 250.000"
                                        />
                                        <label htmlFor="transportCost" className="input-label">Fee Transport (Opsional)</label>
                                    </div>
                                </div>

                                {/* Cost Breakdown & DP Payment Box */}
                                <div className="payment-summary p-5 bg-brand-bg/60 border border-brand-border rounded-2xl space-y-4">
                                    <h4 className="text-xs font-bold text-brand-text-light uppercase tracking-wider">Rincian Pembayaran</h4>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between items-center text-brand-text-secondary">
                                            <span>Package Utama</span>
                                            <span className="font-semibold text-brand-text-primary">
                                                {(() => {
                                                    if (!bookingModal.pkg) return formatCurrency(0);
                                                    const opts = bookingModal.pkg.durationOptions;
                                                    if (!opts || opts.length === 0) return formatCurrency(bookingModal.pkg.price);
                                                    const selected = opts.find(o => o.label === formData.durationSelection) || opts.find(o => o.default) || opts[0];
                                                    return formatCurrency(selected?.price ?? bookingModal.pkg.price);
                                                })()}
                                            </span>
                                        </div>
                                        {optionalPackages.map(op => (
                                            <div key={op.id} className="flex justify-between items-center text-brand-text-secondary pl-2">
                                                <span>+ Tambahan: {op.name}</span>
                                                <span className="font-semibold text-brand-text-primary">{formatCurrency(op.price)}</span>
                                            </div>
                                        ))}
                                        {formData.selectedAddOnIds.length > 0 && visibleAddOns.filter(a => formData.selectedAddOnIds.includes(a.id)).map(a => (
                                            <div key={a.id} className="flex justify-between items-center text-brand-text-secondary pl-2">
                                                <span>+ Add-on: {a.name}</span>
                                                <span className="font-semibold text-brand-text-primary">{formatCurrency(a.price)}</span>
                                            </div>
                                        ))}
                                        {Number(formData.transportCost) > 0 && (
                                            <div className="flex justify-between items-center text-brand-text-secondary pl-2">
                                                <span>+ Fee Transport</span>
                                                <span className="font-semibold text-brand-text-primary">{formatCurrency(Number(formData.transportCost) || 0)}</span>
                                            </div>
                                        )}
                                        {discountAmount > 0 && (
                                            <div className="flex justify-between items-center text-green-600 pl-2">
                                                <span>- Diskon ({discountText})</span>
                                                <span className="font-semibold">-{formatCurrency(discountAmount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center font-extrabold text-base pt-3 border-t border-brand-border text-brand-text-light">
                                            <span>Total Biaya</span>
                                            <span className="text-brand-accent text-lg">{formatCurrency(totalProject)}</span>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-brand-border space-y-4">
                                        <div className="text-xs space-y-1">
                                            <p className="text-brand-text-secondary">Silakan transfer Uang Muka (DP) ke rekening:</p>
                                            <p className="payment-bank-account font-bold text-brand-text-light p-2 bg-brand-surface rounded-xl border border-brand-border text-center tracking-wide">{userProfile.bankAccount}</p>
                                        </div>
                                        <div className="input-group !mt-0">
                                            <RupiahInput
                                                id="dp"
                                                name="dp"
                                                value={String(formData.dp ?? '')}
                                                onChange={(raw) => setFormData(prev => ({ ...prev, dp: raw }))}
                                                className="input-field text-right font-bold"
                                                placeholder="Contoh: 1.500.000"
                                            />
                                            <label htmlFor="dp" className="input-label">Jumlah DP</label>
                                            <p className="text-[11px] text-brand-text-secondary mt-1 text-right">Saran DP (30%): <strong className="text-brand-accent">{formatCurrency(suggestedDp)}</strong></p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="dpPaymentProof" className="text-xs font-bold text-brand-text-light block">Unggah Bukti Transfer DP</label>
                                    <div
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={handlePaymentProofDrop}
                                        className="flex min-h-[92px] items-center gap-3 rounded-xl border border-dashed border-white/40 bg-brand-accent px-3 py-3 text-white transition-colors hover:bg-brand-accent/90 sm:px-4"
                                    >
                                        <UploadIcon className="h-7 w-7 shrink-0 text-white" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                                <label htmlFor="dpPaymentProof" className="relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-white bg-white px-2 py-0.5 text-[10px] font-semibold leading-4 text-brand-accent hover:bg-white/90">
                                                    <span>Pilih file</span>
                                                    <input id="dpPaymentProof" name="dpPaymentProof" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/jpg, application/pdf" />
                                                </label>
                                                <span className="min-w-0 truncate text-xs text-white" title={paymentProof?.name || 'No file chosen'}>
                                                    {paymentProof?.name || 'No file chosen'}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-[11px] leading-4 text-white/90">atau seret dan lepas</p>
                                            <p className="text-[11px] leading-4 text-white/90">PNG, JPG, PDF hingga 10MB</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-brand-border">
                            <button type="button" onClick={handleCloseBookingModal} className="button-secondary px-6">Batal</button>
                            <button type="submit" disabled={isSubmitting} className="button-primary px-8">{isSubmitting ? 'Mengirim...' : 'Kirim Booking'}</button>
                        </div>
                    </form>
                    )}
                </Modal>
                <Modal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} title="Syarat & Ketentuan Umum">
                    <div className="max-h-[70vh] overflow-y-auto pr-4">
                        {formattedTerms ? (
                            <div>{formattedTerms}</div>
                        ) : (
                            <p className="text-brand-text-secondary text-center py-8">Syarat dan ketentuan belum diatur oleh vendor.</p>
                        )}
                    </div>
                </Modal>
            </div>
        )
    );
};

export default PublicPackages;
