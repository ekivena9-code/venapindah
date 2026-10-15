import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Package as PackageIcon } from 'lucide-react';
import { REGIONS } from '../../../types';
import { Client, Project, Package, AddOn, Transaction, Profile, Card, FinancialPocket, ClientStatus, PaymentStatus, TransactionType, PromoCode, Lead, LeadStatus, ContactChannel, ClientType, PublicBookingFormProps, BookingStatus, ViewType } from '../../../types';
import Modal from '../../../shared/ui/Modal';
import { MessageSquareIcon } from '../../../constants';
import { createClient } from '../../../services/clients';
import { createProject } from '../../../services/projects';
import { createLead as createLeadRow, updateLead as updateLeadRow } from '../../../services/leads';
import { uploadDpProof } from '../../../services/storage';
import { createTransaction } from '../../../services/transactions';
import RupiahInput from '../../../shared/form/RupiahInput';
import { buildPublicShareUrl, getPublicBookingRegionOptions, normalizePublicBookingRegion, resolvePackageShareIdentifier, toPublicNameSlug } from '../../../utils/publicRouting';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}
const titleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

const initialFormState = {
    clientName: '',
    email: '',
    phone: '',
    instagram: '',
    projectType: '',
    location: '',
    date: '',
    packageId: '',
    selectedAdditionalPackageIds: [] as string[],
    selectedAddOnIds: [] as string[],
    promoCode: '',
    dp: '',
    transportCost: '',
    durationSelection: '' as string,
    unitPrice: undefined as number | undefined,
    address: '',
};

const UploadIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});


const PublicBookingForm: React.FC<PublicBookingFormProps> = ({
    setClients, setProjects, packages: rawPackages = [], addOns, setTransactions, userProfile, cards, setCards, pockets, setPockets, promoCodes, setPromoCodes, showNotification, leads, setLeads, addNotification
}) => {
    const packages = rawPackages;
    const [formData, setFormData] = useState({ ...initialFormState, projectType: userProfile.projectTypes[0] || '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submittedData, setSubmittedData] = useState<any>(null); // Store submitted data for WhatsApp template
    const [promoFeedback, setPromoFeedback] = useState({ type: '', message: '' });
    const [paymentProof, setPaymentProof] = useState<File | null>(null);
    const [paymentProofPreviewUrl, setPaymentProofPreviewUrl] = useState<string | null>(null);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const formRef = useRef<HTMLDivElement>(null);
    const [leadId, setLeadId] = useState<string | null>(null);
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [isLeadDataLoaded, setIsLeadDataLoaded] = useState(false);
    const [isPackagesLoading, setIsPackagesLoading] = useState(true);
    const [isPackagePickerOpen, setIsPackagePickerOpen] = useState(false);
    const [isAdditionalPackagesOpen, setIsAdditionalPackagesOpen] = useState(false);
    const packagePickerRef = useRef<HTMLDivElement>(null);
    const packagePickerTriggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!paymentProof || !paymentProof.type.startsWith('image/')) {
            setPaymentProofPreviewUrl(null);
            return;
        }

        const previewUrl = URL.createObjectURL(paymentProof);
        setPaymentProofPreviewUrl(previewUrl);
        return () => URL.revokeObjectURL(previewUrl);
    }, [paymentProof]);

    useEffect(() => {
        if (!isPackagePickerOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && !packagePickerRef.current?.contains(event.target)) {
                setIsPackagePickerOpen(false);
            }
        };

        window.addEventListener('pointerdown', handlePointerDown);
        return () => window.removeEventListener('pointerdown', handlePointerDown);
    }, [isPackagePickerOpen]);

    const updatePromoFeedback = (type: string, message: string) => {
        setPromoFeedback(prev =>
            prev.type === type && prev.message === message
                ? prev
                : { type, message }
        );
    };

    // CSRF Protection: Honeypot field (invisible to humans, visible to bots)
    const [honeypot, setHoneypot] = useState('');

    // Rate limiting: Prevent rapid submissions
    const [lastSubmitTime, setLastSubmitTime] = useState(0);
    const SUBMIT_COOLDOWN = 5000; // 5 seconds

    // Regions discovery for landing gate (must be outside conditional to respect hooks rules)
    const existingRegions = useMemo(() => {
        const pks = (packages || []);
        const set = new Set<string>();
        for (const p of pks) {
            if (p.region && String(p.region).trim() !== '') set.add(String(p.region));
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [packages]);
    const unionRegions = useMemo(() => {
        const baseVals = REGIONS.map(r => r.value.toLowerCase());
        const extra = existingRegions.filter(er => !baseVals.includes(er.toLowerCase()));
        return [
            ...REGIONS.map(r => ({ value: r.value, label: r.label })),
            ...extra.map(er => ({ value: er, label: titleCase(er) })),
        ];
    }, [existingRegions]);

    const regionOptions = useMemo(() => getPublicBookingRegionOptions(unionRegions), [unionRegions]);

    // Filter Packages by selectedRegion (strict)
    // Filter and sort Packages by selectedRegion and userProfile packageOrder
    const filteredPackages = useMemo(() => {
        const pks = (packages || []);
        const normalizedRegion = normalizePublicBookingRegion(selectedRegion);
        const filtered = normalizedRegion && normalizedRegion !== 'all'
            ? pks.filter(p => {
                const pkgRegion = p.region ? String(p.region).toLowerCase() : '';
                return pkgRegion === normalizedRegion;
            })
            : [...pks];
        const order = userProfile?.publicPageConfig?.packageOrder;
        if (order && order.length > 0) {
            const orderMap = new Map(order.map((id, idx) => [id, idx]));
            return [...filtered].sort((a, b) => {
                const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
                const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
                return idxA - idxB;
            });
        }
        return filtered;
    }, [packages, selectedRegion, userProfile?.publicPageConfig?.packageOrder]);

    const visiblePackageGroups = useMemo(() => {
        const groups = new Map<string, Package[]>();
        filteredPackages.forEach(pkg => {
            const category = pkg.category?.trim() || 'Lainnya';
            groups.set(category, [...(groups.get(category) || []), pkg]);
        });
        return Array.from(groups.entries());
    }, [filteredPackages]);

    // When filteredPackages changes (data loads after region set), reset packageId if current
    // selection is no longer valid, and mark loading as done once packages arrive
    useEffect(() => {
        if (selectedRegion) {
            setIsPackagesLoading(false);
            setFormData(prev => {
                if (prev.packageId && !filteredPackages.find(p => p.id === prev.packageId)) {
                    return { ...prev, packageId: '', durationSelection: '', unitPrice: undefined };
                }
                return prev;
            });
        }
    }, [filteredPackages, selectedRegion]);

    useEffect(() => {
        if (filteredPackages.length === 0) return;

        const hash = window.location.hash;
        if (!hash.includes('?')) return;
        const packageIdentifier = new URLSearchParams(hash.substring(hash.indexOf('?'))).get('package');
        if (!packageIdentifier) return;

        const matchedPackage = resolvePackageShareIdentifier(packageIdentifier, filteredPackages);
        if (!matchedPackage) return;

        setFormData(prev => prev.packageId === matchedPackage.id
            ? prev
            : { ...prev, packageId: matchedPackage.id, durationSelection: '', unitPrice: undefined }
        );
    }, [filteredPackages]);

    // Filter and sort Add-Ons by selectedRegion and userProfile addOnOrder
    const filteredAddOns = useMemo(() => {
        const normalizedRegion = normalizePublicBookingRegion(selectedRegion);
        const filtered = normalizedRegion && normalizedRegion !== 'all'
            ? (addOns || []).filter(a => {
                const addonRegion = a.region ? String(a.region).toLowerCase() : '';
                return addonRegion === normalizedRegion;
            })
            : [...(addOns || [])];
        const order = userProfile?.publicPageConfig?.addOnOrder;
        if (order && order.length > 0) {
            const orderMap = new Map(order.map((id, idx) => [id, idx]));
            return [...filtered].sort((a, b) => {
                const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
                const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
                return idxA - idxB;
            });
        }
        return filtered;
    }, [addOns, selectedRegion, userProfile?.publicPageConfig?.addOnOrder]);

    // Parse region from URL only once on mount
    useEffect(() => {
        const hash = window.location.hash;
        if (hash.includes('?')) {
            const urlParams = new URLSearchParams(hash.substring(hash.indexOf('?')));
            const regionParam = urlParams.get('region');
            const normalizedRegion = normalizePublicBookingRegion(regionParam);
            if (normalizedRegion) {
                setSelectedRegion(normalizedRegion);
            }
        }
    }, []);

    // Extract leadId from URL immediately on mount so conversion is always accurate
    useEffect(() => {
        try {
            const hash = window.location.hash;
            const hashQuery = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : '';
            const urlParams = new URLSearchParams(hashQuery || window.location.search);
            // lid = short ID (8 char prefix of UUID), leadName = name slug fallback, leadId = legacy full UUID
            const id = urlParams.get('lid') || urlParams.get('leadId') || urlParams.get('leadName');
            if (id) {
                setLeadId(id);
            }
        } catch (e) {
            console.warn('Failed to parse leadId from URL:', e);
        }
    }, []);

    // Handle lead data autofill when leads data is available
    useEffect(() => {
        if (isLeadDataLoaded || !leadId || (leads?.length || 0) === 0) return;

        // Match by: short ID prefix (lid), full UUID (leadId legacy), or name slug (leadName legacy)
        const lead = leads.find(l =>
            l.id.startsWith(leadId) ||
            l.id === leadId ||
            toPublicNameSlug(l.name) === leadId
        );
        if (lead) {
            setFormData(prev => ({
                ...prev,
                clientName: lead.name || prev.clientName,
                phone: lead.whatsapp || prev.phone,
                location: lead.location || prev.location,
            }));
            setIsLeadDataLoaded(true);
        }
    }, [leads, leadId, isLeadDataLoaded]);

    const template = userProfile.publicPageConfig?.template || 'classic';

    const formattedTerms = useMemo(() => {
        if (!userProfile.termsAndConditions) return null;
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


    useEffect(() => {
        const enteredPromoCode = formData.promoCode.toUpperCase().trim();
        if (enteredPromoCode) {
            const promoCode = promoCodes.find(p => p.code === enteredPromoCode && p.isActive);
            if (promoCode) {
                const isExpired = promoCode.expiryDate && new Date(promoCode.expiryDate) < new Date();
                const isMaxedOut = promoCode.maxUsage != null && promoCode.usageCount >= promoCode.maxUsage;

                if (!isExpired && !isMaxedOut) {
                    const additionalPackagesPrice = filteredPackages.filter(p => formData.selectedAdditionalPackageIds?.includes(p.id)).reduce((sum, pkg) => sum + pkg.price, 0);
                    const totalBeforeDiscount = (filteredPackages.find(p => p.id === formData.packageId)?.price || 0) + filteredAddOns.filter(addon => formData.selectedAddOnIds.includes(addon.id)).reduce((sum, addon) => sum + addon.price, 0) + additionalPackagesPrice;
                    const discountAmount = promoCode.discountType === 'percentage' ? (totalBeforeDiscount * promoCode.discountValue) / 100 : promoCode.discountValue;
                    const discountText = promoCode.discountType === 'percentage' ? `${promoCode.discountValue}%` : formatCurrency(promoCode.discountValue);
                    updatePromoFeedback('success', `Kode promo diterapkan! Diskon ${discountText}.`);
                } else {
                    updatePromoFeedback('error', 'Kode promo tidak valid atau sudah habis.');
                }
            } else {
                updatePromoFeedback('error', 'Kode promo tidak ditemukan.');
            }
        } else {
            updatePromoFeedback('', '');
        }
    }, [formData.promoCode, formData.packageId, formData.selectedAddOnIds, filteredPackages, filteredAddOns, promoCodes]);

    const { totalBeforeDiscount, discountAmount, totalProject, discountText } = useMemo(() => {
        const selectedPackage = filteredPackages.find(p => p.id === formData.packageId);
        let packagePrice = selectedPackage?.price || 0;
        const opts = selectedPackage?.durationOptions;
        if (opts && opts.length > 0) {
            const selected = opts.find(o => o.label === formData.durationSelection) || opts.find(o => o.default) || opts[0];
            packagePrice = selected?.price ?? (selectedPackage?.price || 0);
        }
        const addOnsPrice = filteredAddOns
            .filter(addon => formData.selectedAddOnIds.includes(addon.id))
            .reduce((sum, addon) => sum + addon.price, 0);

        const additionalPackagesPrice = filteredPackages
            .filter(pkg => formData.selectedAdditionalPackageIds?.includes(pkg.id))
            .reduce((sum, pkg) => sum + pkg.price, 0);

        const transportFee = Number(formData.transportCost) || 0;
        const totalBeforeDiscount = packagePrice + addOnsPrice + additionalPackagesPrice;
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
                }
            }
        }

        const totalProject = totalBeforeDiscount - discountAmount + transportFee;
        return { totalBeforeDiscount, discountAmount, totalProject, discountText };
    }, [formData.packageId, formData.selectedAddOnIds, formData.promoCode, formData.transportCost, formData.durationSelection, filteredPackages, filteredAddOns, promoCodes]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { id, checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, selectedAddOnIds: checked ? [...prev.selectedAddOnIds, id] : prev.selectedAddOnIds.filter(addOnId => addOnId !== id) }));
        } else {
            // If packageId changed, set unitPrice from package price or first duration option
            if (name === 'packageId') {
                const pkg = filteredPackages.find(p => p.id === value);
                if (pkg) {
                    const opts = pkg.durationOptions;
                    if (opts && opts.length > 0) {
                        const defaultOpt = opts.find(o => o.default) || opts[0];
                        setFormData(prev => ({
                            ...prev,
                            packageId: value,
                            durationSelection: defaultOpt.label,
                            unitPrice: Number(defaultOpt.price)
                        }));
                        return;
                    } else {
                        setFormData(prev => ({
                            ...prev,
                            packageId: value,
                            unitPrice: Number(pkg.price)
                        }));
                        return;
                    }
                }
            }
            // If durationSelection changed, compute unitPrice from selected package's durationOptions
            if (name === 'durationSelection') {
                const pkg = filteredPackages.find(p => p.id === formData.packageId);
                const opts = pkg?.durationOptions;
                if (opts && opts.length > 0) {
                    const opt = opts.find(o => o.label === value) || opts.find(o => o.default) || opts[0];
                    if (opt) {
                        setFormData(prev => ({ ...prev, durationSelection: value, unitPrice: Number(opt.price) }));
                        return;
                    }
                }
            }
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handlePackageSelection = (packageId: string) => {
        const pkg = filteredPackages.find(p => p.id === packageId);
        const defaultOpt = pkg?.durationOptions?.length
            ? pkg.durationOptions.find(o => o.default) || pkg.durationOptions[0]
            : undefined;
        setFormData(prev => ({
            ...prev,
            packageId,
            durationSelection: defaultOpt?.label || '',
            unitPrice: defaultOpt ? Number(defaultOpt.price) : pkg ? pkg.price : undefined,
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                showNotification('Ukuran file tidak boleh melebihi 10MB.');
                e.target.value = ''; // Reset file input
                return;
            }
            setPaymentProof(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // CSRF Protection: Check honeypot
        if (honeypot !== '') {
            console.warn('[Security] Bot detected - honeypot triggered');
            return; // Silent fail for bots
        }

        // Rate limiting: Check cooldown
        const now = Date.now();
        if (now - lastSubmitTime < SUBMIT_COOLDOWN) {
            showNotification('Mohon tunggu beberapa detik sebelum mengirim lagi');
            return;
        }

        setLastSubmitTime(now);
        setIsSubmitting(true);
        try {

            const dpAmount = Number(formData.dp) || 0;
            const selectedPackage = filteredPackages.find(p => p.id === formData.packageId);
            if (!selectedPackage) {
                alert('Silakan pilih Package.');
                setIsSubmitting(false);
                return;
            }

            const destinationCard = cards.find(c => c.id !== 'CARD_CASH') || cards[0];
            if (!destinationCard) {
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
                    // Upload ke Supabase Storage dan pakai URL-nya
                    dpProofUrl = await uploadDpProof(paymentProof);
                } catch (error) {
                    console.error("Error uploading DP proof:", error);
                    showNotification("Gagal mengunggah bukti transfer. Silakan coba lagi.");
                    setIsSubmitting(false);
                    return;
                }
            }

            const selectedAdditionalPackages = filteredPackages.filter(p => formData.selectedAdditionalPackageIds?.includes(p.id));
            const additionalPackageRecords = selectedAdditionalPackages.map(pkg => ({ id: pkg.id, name: pkg.name, price: pkg.price }));
            const selectedAddOns = (addOns || []).filter(addon => formData.selectedAddOnIds.includes(addon.id));
            const remainingPayment = totalProject - dpAmount;
            const transportFee = Number(formData.transportCost) || 0;

            // Create client in Supabase
            const createdClient = await createClient({
                name: formData.clientName,
                email: formData.email || '',
                phone: formData.phone,
                instagram: formData.instagram || undefined,
                since: new Date().toISOString().split('T')[0],
                status: ClientStatus.ACTIVE,
                clientType: ClientType.DIRECT,
                lastContact: new Date().toISOString(),
                portalAccessId: crypto.randomUUID(),
                address: formData.address || undefined,
            });

            // Create project in Supabase
            const createdProject = await createProject({
                projectName: `${formData.clientName} (${selectedPackage.name})`,
                clientName: createdClient.name,
                clientId: createdClient.id,
                projectType: formData.projectType,
                packageName: selectedPackage.name,
                date: formData.date,
                location: formData.location,
                status: 'Dikonfirmasi',
                bookingStatus: BookingStatus.BARU,
                totalCost: totalProject,
                amountPaid: dpAmount,
                paymentStatus: dpAmount > 0 ? (remainingPayment <= 0 ? PaymentStatus.LUNAS : PaymentStatus.DP_TERBAYAR) : PaymentStatus.BELUM_BAYAR,
                notes: formData.durationSelection ? `Durasi dipilih: ${formData.durationSelection}` : '',
                durationSelection: formData.durationSelection || undefined,
                unitPrice: formData.unitPrice !== undefined ? Number(formData.unitPrice) : undefined,
                promoCodeId: promoCodeAppliedId,
                discountAmount: discountAmount > 0 ? discountAmount : undefined,
                transportCost: transportFee > 0 ? transportFee : undefined,
                completedDigitalItems: [],
                dpProofUrl: dpProofUrl || undefined,
                address: formData.address || undefined,
                addOns: selectedAddOns.map(addon => ({ id: addon.id, name: addon.name, price: addon.price })),
                additionalPackages: additionalPackageRecords,
            });

            if (leadId) {
                try {
                    const leadNote = `Dikonversi dari formulir booking. Pengantin ID: ${createdClient.id}`;
                    const lead = leads.find(l =>
                        l.id.startsWith(leadId) ||
                        l.id === leadId ||
                        toPublicNameSlug(l.name) === leadId
                    );
                    if (lead) {
                        const updatedLead = await updateLeadRow(lead.id, { status: LeadStatus.CONVERTED, notes: leadNote });
                        setLeads(prev => prev.map(l => l.id === lead.id ? updatedLead : l));
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
                        notes: `Dikonversi otomatis dari booking publik. Acara Pernikahan: ${createdProject.projectName}. Pengantin ID: ${createdClient.id}`,
                        whatsapp: createdClient.phone,
                    } as any);
                    setLeads(prev => [createdLead, ...prev]);
                } catch (error) {
                    console.error('[Lead] Failed to create lead:', error);
                }
            }

            setClients(prev => [createdClient, ...prev]);
            // Tandai sebagai booking baru agar muncul di halaman Booking
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
                    // Tetap update lokal agar UI tidak macet
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

            setIsSubmitting(false);
            setIsSubmitted(true);
            
            // Store submitted data for WhatsApp template
            setSubmittedData({
                formData: { ...formData },
                selectedPackage,
                selectedAddOns,
                totalProject,
                userProfile
            });

            addNotification({
                title: 'Booking Baru Diterima!',
                message: `Booking dari ${createdClient.name} untuk Acara Pernikahan "${createdProjectWithBooking.projectName}" menunggu konfirmasi Anda.`,
                icon: 'lead',
                link: { view: ViewType.BOOKING }
            });
        } catch (err: any) {
            console.error('Error submitting public booking form:', err);
            showNotification && showNotification(typeof err === 'string' ? err : (err?.message || 'Terjadi kesalahan saat mengirim formulir. Silakan coba lagi.'));
            setIsSubmitting(false);
        }
    };

    if (isSubmitted && submittedData) {
        // Generate WhatsApp message template using stored data
        const { formData: submittedFormData, selectedPackage, selectedAddOns, totalProject, userProfile: submittedProfile } = submittedData;
        const selectedAddOnsText = selectedAddOns
            .map((addon: any) => `• ${addon.name} (+${formatCurrency(addon.price)})`)
            .join('\n');
        
        const whatsappMessage = `Halo ${submittedProfile.companyName}! 👋

Saya baru saja mengirim formulir booking melalui website Anda dengan detail berikut:

📋 *INFORMASI BOOKING*
• Nama: ${submittedFormData.clientName}
• Telepon: ${submittedFormData.phone}
• Email: ${submittedFormData.email || 'Tidak diisi'}
• Lokasi: ${submittedFormData.location}
• Tanggal: ${submittedFormData.date}
• Package: ${selectedPackage?.name || 'Tidak dipilih'}
${submittedFormData.durationSelection ? `• Durasi: ${submittedFormData.durationSelection}` : ''}
${selectedAddOnsText ? `• Add-On:\n${selectedAddOnsText}` : ''}
${submittedFormData.promoCode ? `• Kode Promo: ${submittedFormData.promoCode}` : ''}

💰 *TOTAL BIAYA*
• Total Package: ${formatCurrency(totalProject)}
• DP yang akan dibayar: ${formatCurrency(Number(submittedFormData.dp) || 0)}
${submittedFormData.transportCost ? `• Biaya Transport: ${formatCurrency(Number(submittedFormData.transportCost))}` : ''}

Mohon konfirmasi untuk langkah selanjutnya. Terima kasih! 🙏`;

        const whatsappUrl = `https://wa.me/${submittedProfile.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(whatsappMessage)}`;

        return (
            <div className="flex items-center justify-center min-h-screen p-4">
                <div className="w-full max-w-xl p-6 md:p-8 text-center bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="mb-6">
                        <div className="w-14 h-14 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-7 h-7 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-950">Terima Kasih!</h1>
                        <p className="max-w-md mx-auto mt-3 text-sm md:text-base leading-relaxed text-gray-600">
                            Formulir pemesanan Anda telah berhasil kami terima. Tim kami akan segera menghubungi Anda untuk konfirmasi lebih lanjut.
                        </p>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="p-4 md:p-5 bg-white rounded-lg border border-gray-200">
                            <p className="text-sm leading-relaxed text-gray-600 mb-4">
                                Untuk konfirmasi yang lebih cepat, Anda dapat langsung menghubungi admin kami via WhatsApp:
                            </p>
                            <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-full min-h-12 px-5 py-3 bg-gray-950 hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors duration-200"
                            >
                                <MessageSquareIcon className="w-5 h-5 mr-2" />
                                Chat Konfirmasi Booking via WhatsApp
                            </a>
                        </div>
                        
                        <p className="text-xs leading-relaxed text-gray-500">
                            Pesan sudah disiapkan dengan detail booking Anda. Tinggal klik kirim! 📱
                        </p>
                    </div>
                </div>
            </div>
        );
    }
    
    // Fallback for submitted state without data (shouldn't happen but safety net)
    if (isSubmitted) {
        const basicWhatsappUrl = `https://wa.me/${userProfile.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent('Halo! Saya baru saja mengirim formulir booking melalui website Anda. Mohon konfirmasi untuk langkah selanjutnya. Terima kasih!')}`;
        
        return (
            <div className="flex items-center justify-center min-h-screen p-4">
                <div className="w-full max-w-xl p-6 md:p-8 text-center bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="mb-6">
                        <div className="w-14 h-14 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-7 h-7 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-950">Terima Kasih!</h1>
                        <p className="max-w-md mx-auto mt-3 text-sm md:text-base leading-relaxed text-gray-600">
                            Formulir pemesanan Anda telah berhasil kami terima. Tim kami akan segera menghubungi Anda untuk konfirmasi lebih lanjut.
                        </p>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="p-4 md:p-5 bg-white rounded-lg border border-gray-200">
                            <p className="text-sm leading-relaxed text-gray-600 mb-4">
                                Hubungi admin kami via WhatsApp untuk konfirmasi:
                            </p>
                            <a
                                href={basicWhatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-full min-h-12 px-5 py-3 bg-gray-950 hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors duration-200"
                            >
                                <MessageSquareIcon className="w-5 h-5 mr-2" />
                                Chat via WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    // Region gate: do not show all regions. Ask user to choose a region link first.
    if (selectedRegion === null) {
        return (
            <div className="flex items-center justify-center min-h-screen p-3 md:p-4">
                <div className="w-full max-w-lg p-6 md:p-8 text-center bg-public-surface rounded-2xl shadow-lg border border-public-border">
                    <h4 className="text-xl font-bold text-gradient mb-6">Informasi Pengantin & Acara Pernikahan</h4>
                    <p className="mt-3 text-public-text-secondary text-xs md:text-sm">Untuk meminimalisir kesalahan, silakan pilih wilayah terlebih dahulu.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                        {regionOptions.map(r => (
                            <a key={r.value} className="button-primary text-center" href={buildPublicShareUrl('booking', undefined, { query: { region: r.value } })}>{r.label}</a>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const suggestedDp = totalProject * 0.3;
    const selectedPackage = filteredPackages.find(pkg => pkg.id === formData.packageId);

    return (
        <div className={`public-page-body template-wrapper template-${template} min-h-screen p-3 md:p-4 sm:p-6 lg:p-8 flex items-center justify-center`}>
            <style>{`
                .template-wrapper { background-color: var(--public-bg); color: var(--public-text-primary); --public-accent: #000; --public-accent-hover: #262626; --public-accent-hsl: 0 0% 0%; }
                .template-wrapper .text-gradient { background: none; color: #000 !important; -webkit-text-fill-color: #000; }
                .template-classic .form-container { max-width: 64rem; width: 100%; margin: auto; }
                .template-modern .form-container { max-width: 72rem; width: 100%; margin: auto; display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; align-items: start; }
                .template-gallery .form-container { max-width: 56rem; width: 100%; margin: auto; }
                .public-booking-form label { font-size: 12px !important; line-height: 1.4 !important; }
                .public-booking-form p { font-size: 12px !important; line-height: 1.45 !important; }
                main:nth-of-type(1) > div#root:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > form:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) {
                    display: flex;
                    flex-direction: column;
                    gap: 16px !important;
                    padding: 16px;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    background-color: #f9fafb;
                }
                main:nth-of-type(1) > div#root:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > form:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(3) { display: none !important; }
                .public-booking-form input:not([type="file"]), .public-booking-form select:not(.package-select) { font-size: 14px !important; height: 34px !important; min-height: 34px !important; padding: 0 12px !important; border-radius: 8px !important; }
                .public-booking-form #promoCode,
                .public-booking-form #dp {
                    border: 1px solid #111 !important;
                    font-weight: 600 !important;
                }
                .public-booking-form #promoCode:focus,
                .public-booking-form #dp:focus {
                    border-color: #000 !important;
                }
                .public-booking-form textarea { font-size: 14px !important; }
                .public-booking-form input::placeholder, .public-booking-form textarea::placeholder { font-size: 13px !important; }
                .public-booking-form h4 { font-size: 16px !important; line-height: 1.35 !important; }
                main:nth-of-type(1) > div#root:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > form:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) { padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; }
                main:nth-of-type(1) > div#root:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > form:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(3) > p:nth-of-type(2) { margin-bottom: 8px; font-weight: 500; }
                main:nth-of-type(1) > div#root:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > form:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1) { margin-bottom: 8px; }
                main:nth-of-type(1) > div#root:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > form:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(3) > div:nth-of-type(3) { display: flex; flex-direction: column; gap: 8px; }
                @media (max-width: 640px) {
                    #root .public-page-body .public-booking-form button#packageId,
                    #root .public-page-body .public-booking-form button.package-option-button {
                        box-sizing: border-box;
                        width: 100%;
                        min-width: 0 !important;
                        min-height: 56px !important;
                        max-height: none !important;
                        height: auto !important;
                        padding: 8px !important;
                        font-size: 14px !important;
                        line-height: 1.3 !important;
                        gap: 8px !important;
                        border-radius: 12px !important;
                    }
                    #root .public-page-body .public-booking-form button.package-option-button {
                        column-gap: 8px !important;
                        row-gap: 2px !important;
                    }
                    #root .public-page-body .public-booking-form .package-option-button svg {
                        width: 20px !important;
                        height: 20px !important;
                        max-width: 20px !important;
                        max-height: 20px !important;
                    }
                    #root .public-page-body .public-booking-form .package-picker-heading {
                        font-size: 14px !important;
                        line-height: 1.3 !important;
                    }
                    #root .public-page-body .public-booking-form .package-picker-title {
                        font-size: 13px !important;
                        line-height: 1.3 !important;
                        display: -webkit-box;
                        -webkit-box-orient: vertical;
                        -webkit-line-clamp: 2;
                        overflow: hidden;
                        overflow-wrap: anywhere;
                    }
                    #root .public-page-body .public-booking-form .package-picker-subtitle {
                        font-size: 12px !important;
                        line-height: 1.35 !important;
                    }
                    #root .public-page-body .public-booking-form .package-picker-price {
                        font-size: 12px !important;
                        line-height: 1.25 !important;
                    }
                    #root .public-page-body .public-booking-form .duration-option-label,
                    #root .public-page-body .public-booking-form .duration-option-price {
                        font-size: 13px !important;
                        line-height: 1.3 !important;
                    }
                    #root .public-page-body .public-booking-form .package-required-badge,
                    #root .public-page-body .public-booking-form .package-price-caption {
                        font-size: 11px !important;
                        line-height: 1.3 !important;
                    }
                    #root .public-page-body .public-booking-form .total-cost-label,
                    #root .public-page-body .public-booking-form .total-cost-value {
                        font-size: 12px !important;
                        line-height: 1.3 !important;
                    }
                }
                .public-booking-form .booking-upload-box { box-sizing: border-box; width: 100%; min-width: 0; padding: 12px; }
                .public-booking-form .booking-upload-icon { width: 40px !important; height: 40px !important; }
                .public-booking-form .booking-upload-instruction { font-size: 14px !important; }
                .public-booking-form .booking-upload-hint { font-size: 12px !important; }
                .public-booking-form .booking-upload-selected { font-size: 13px !important; line-height: 1.4 !important; }
                .public-booking-form .booking-upload-box button,
                .public-booking-form .booking-upload-box label {
                    max-width: 100%;
                    white-space: normal;
                }
                @media (max-width: 640px) {
                    .public-page-body .public-booking-form input:not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="range"]),
                    .public-page-body .public-booking-form select:not(.package-select) {
                        box-sizing: border-box;
                        width: 100%;
                        max-width: 100%;
                        min-width: 0;
                        height: 40px !important;
                        min-height: 40px !important;
                        padding: 0 10px !important;
                        font-size: 13px !important;
                        line-height: 1.25 !important;
                        border-radius: 8px !important;
                    }
                    .public-page-body .public-booking-form textarea {
                        box-sizing: border-box;
                        width: 100%;
                        max-width: 100%;
                        min-width: 0;
                        min-height: 66px !important;
                        height: auto;
                        padding: 7px 10px !important;
                        font-size: 13px !important;
                        line-height: 1.3 !important;
                        border-radius: 8px !important;
                    }
                    .public-page-body .public-booking-form label {
                        font-size: 12px !important;
                        line-height: 1.3 !important;
                    }
                    .public-page-body .public-booking-form.space-y-5 > * + *,
                    .public-page-body .public-booking-form .space-y-5 > * + * {
                        margin-top: 7px !important;
                    }
                    .public-page-body .public-booking-form input[type="checkbox"],
                    .public-page-body .public-booking-form input[type="radio"] {
                        width: 18px;
                        height: 18px;
                        flex-shrink: 0;
                    }
                    .public-page-body .public-booking-form > div:last-child {
                        padding-top: 8px !important;
                    }
                    #root .public-page-body .public-booking-form button[type="submit"] {
                        box-sizing: border-box;
                        width: 100%;
                        min-height: 56px !important;
                        max-height: none !important;
                        height: auto !important;
                        padding: 16px 24px !important;
                        font-size: 16px !important;
                        line-height: 1.4 !important;
                        border-radius: 12px !important;
                    }
                    .public-booking-form .booking-upload-box {
                        width: 100%;
                        margin: 8px 0 0;
                        padding: 10px;
                    }
                    /* Prevent mobile browser scroll-jump to sr-only file input */
                    .public-booking-form input[type="file"].sr-only {
                        position: fixed !important;
                        top: -9999px !important;
                        left: -9999px !important;
                        width: 1px !important;
                        height: 1px !important;
                        overflow: hidden !important;
                        opacity: 0 !important;
                    }
                }
                @media (max-width: 768px) { .template-modern .form-container { grid-template-columns: 1fr; } }
            `}</style>
            <div ref={formRef} className="form-container">
                {template === 'modern' && (
                    <div className="p-4 sm:p-6 md:p-8 bg-public-surface rounded-2xl border border-public-border hidden md:block">
                        {userProfile.logoBase64 ? <img src={userProfile.logoBase64} alt="logo" className="h-12 mb-4" /> : <h2 className="text-2xl font-bold text-gradient">{userProfile.companyName}</h2>}
                        <p className="text-public-text-secondary text-sm mt-4">{userProfile.bio}</p>
                    </div>
                )}
                <div className="bg-public-surface p-3 md:p-4 sm:p-6 md:p-8 rounded-2xl shadow-lg border border-public-border">
                    {/* Hero Image */}
                    <div className="w-full h-32 sm:h-48 md:h-64 mb-6 rounded-xl overflow-hidden shadow-md">
                        <img src={userProfile.publicPageConfig?.backgroundImages?.bookingForm || userProfile.publicPageConfig?.backgroundImages?.eventDetail || "/assets/images/backgrounds/detail-acara-pernikahan.jpg"} alt="Hero" className="w-full h-full object-cover" />
                    </div>
                    <div className="text-center mb-6 md:mb-8">
                        <h1 className="text-2xl md:text-3xl font-bold text-gradient">{userProfile.companyName}</h1>
                    </div>



                    <form className="public-booking-form space-y-5" onSubmit={handleSubmit}>
                        {/* Honeypot field - invisible to humans, visible to bots */}
                        <input
                            type="text"
                            name="website"
                            value={honeypot}
                            onChange={(e) => setHoneypot(e.target.value)}
                            style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
                            tabIndex={-1}
                            autoComplete="off"
                            aria-hidden="true"
                        />

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 md:gap-x-8 gap-y-2">
                            <div className="space-y-5">
                                <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-black pb-2">Informasi Pengantin & Acara Pernikahan</h4>
                                 <div className="space-y-2">
                                    <label htmlFor="clientName" className="block text-xs text-black">Nama Pengantin</label>
                                    <input type="text" id="clientName" name="clientName" value={formData.clientName} onChange={handleFormChange} className="w-full px-4 py-3 rounded-xl border border-public-border bg-white text-black focus:outline-none focus:border-black transition-all" placeholder="Masukkan Nama Pengantin" required />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="phone" className="block text-xs text-black">Nomor Telepon (WhatsApp)</label>
                                    <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleFormChange} className="w-full px-4 py-3 rounded-xl border border-public-border bg-white text-black focus:outline-none focus:border-black transition-all" placeholder="08123456789" required />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="email" className="block text-xs text-black">Email (Opsional)</label>
                                    <input type="email" id="email" name="email" value={formData.email} onChange={handleFormChange} className="w-full px-4 py-3 rounded-xl border border-public-border bg-white text-black focus:outline-none focus:border-black transition-all" placeholder="email@example.com (opsional - bisa dikosongkan)" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="instagram" className="block text-xs text-black">Instagram (Opsional)</label>
                                    <input type="text" id="instagram" name="instagram" value={formData.instagram} onChange={handleFormChange} className="w-full px-4 py-3 rounded-xl border border-public-border bg-white text-black focus:outline-none focus:border-black transition-all" placeholder="@username (opsional - bisa dikosongkan)" />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="projectType" className="block text-xs text-black">Jenis Acara Pernikahan</label>
                                        <select id="projectType" name="projectType" value={formData.projectType} onChange={handleFormChange} className="w-full px-4 py-3 rounded-xl border border-public-border bg-white text-black focus:outline-none focus:border-black transition-all" required>
                                            <option value="" disabled>Pilih Jenis...</option>
                                            {userProfile.projectTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="date" className="block text-xs text-black">Tanggal Acara Pernikahan (Opsional)</label>
                                        <input type="date" id="date" name="date" value={formData.date} onChange={handleFormChange} className="w-full px-4 py-3 rounded-xl border border-public-border bg-white text-black focus:outline-none focus:border-black transition-all" />
                                        <p className="text-[10px] text-public-text-secondary">Kosongkan jika tanggal acara belum ditentukan.</p>
                                        {formData.date && (
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, date: '' }))} className="text-xs font-semibold text-black hover:underline">
                                                Kosongkan tanggal
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="location" className="block text-xs text-black">Lokasi (Kota)</label>
                                    <input type="text" id="location" name="location" value={formData.location} onChange={handleFormChange} className="w-full px-4 py-3 rounded-xl border border-public-border bg-white text-black focus:outline-none focus:border-black transition-all" placeholder="Contoh: Jakarta" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="address" className="block text-xs text-black">Alamat Lengkap / Gedung</label>
                                    <textarea id="address" name="address" value={(formData as any).address || ''} onChange={handleFormChange} className="w-full px-4 py-3 rounded-xl border border-public-border bg-white text-black focus:outline-none focus:border-black transition-all" placeholder="Contoh: Gedung Mulia, Jl. Gatot Subroto No. 1" rows={3}></textarea>
                                </div>
                            </div>

                            <div className="space-y-5 rounded-2xl border border-neutral-300 bg-white p-3 sm:p-4">
                                <h4 className="text-sm md:text-base font-semibold text-gradient border-b border-black pb-2">Detail Package & Pembayaran</h4>
                                <fieldset className="min-w-0 space-y-3 border-0 bg-transparent p-0 shadow-none">
                                    <legend className="sr-only">Pilih package layanan</legend>
                                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                        <div className="min-w-0">
                                            <h5 className="package-picker-heading text-sm font-extrabold leading-snug text-slate-900">Pilih Package Anda</h5>
                                        </div>
                                        <span className="package-required-badge self-start rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-950 sm:shrink-0">
                                            Wajib dipilih
                                        </span>
                                    </div>

                                    {isPackagesLoading ? (
                                        <p className="rounded-xl border border-neutral-200 bg-white px-3 py-4 text-center text-sm font-medium text-slate-600">
                                            Memuat package...
                                        </p>
                                    ) : filteredPackages.length === 0 ? (
                                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-4 text-center text-sm font-medium text-amber-800">
                                            Tidak ada package tersedia untuk wilayah ini.
                                        </p>
                                    ) : (
                                        <div className="space-y-2" ref={packagePickerRef} onKeyDown={event => {
                                            if (event.key === 'Escape') {
                                                setIsPackagePickerOpen(false);
                                                packagePickerTriggerRef.current?.focus();
                                            }
                                        }}>
                                            <label htmlFor="packageId" className="block text-xs font-bold text-neutral-950">
                                                Package layanan
                                            </label>
                                            <button
                                                id="packageId"
                                                ref={packagePickerTriggerRef}
                                                type="button"
                                                aria-required="true"
                                                aria-expanded={isPackagePickerOpen}
                                                aria-controls="public-package-options"
                                                onClick={() => setIsPackagePickerOpen(open => !open)}
                                                className="flex w-full items-center gap-3 rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-left shadow-none outline-none transition hover:bg-neutral-100 focus:border-black focus:ring-2 focus:ring-neutral-300"
                                            >
                                                {selectedPackage?.coverImage ? (
                                                    <img src={selectedPackage.coverImage} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                                                ) : (
                                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-black">
                                                        <PackageIcon className="h-5 w-5" aria-hidden="true" />
                                                    </span>
                                                )}
                                                <span className="min-w-0 flex-1">
                                                    <span className="package-picker-title block truncate text-sm font-bold text-slate-900">
                                                        {selectedPackage?.name || 'Pilih package yang Anda inginkan'}
                                                    </span>
                                                    <span className="package-picker-subtitle block truncate text-xs font-medium text-slate-500">
                                                        {selectedPackage?.category || 'Lihat pilihan package tersedia'}
                                                    </span>
                                                </span>
                                                {selectedPackage && (
                                                    <span className="hidden shrink-0 text-right sm:block">
                                                        <span className="block text-[10px] font-semibold text-slate-500">
                                                            {selectedPackage.durationOptions?.length ? 'Mulai dari' : 'Harga'}
                                                        </span>
                                                        <span className="package-picker-price block text-xs font-extrabold text-neutral-950">
                                                            {formatCurrency(selectedPackage.durationOptions?.length
                                                                ? Math.min(...selectedPackage.durationOptions.map(option => Number(option.price)))
                                                                : Number(selectedPackage.price))}
                                                        </span>
                                                    </span>
                                                )}
                                                <ChevronDown className={`h-5 w-5 shrink-0 text-black transition-transform ${isPackagePickerOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                                            </button>
                                            {isPackagePickerOpen && (
                                                <div
                                                    id="public-package-options"
                                                    role="group"
                                                    aria-label="Pilihan package"
                                                    className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/70 p-1.5 sm:p-2"
                                                >
                                                    {visiblePackageGroups.map(([category, categoryPackages], groupIndex) => (
                                                        <div key={category}>
                                                            {groupIndex > 0 && <div className="my-2.5 border-t border-neutral-300" aria-hidden="true" />}
                                                            <p className="px-1 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wide text-neutral-950">{category}</p>
                                                            <div className="grid grid-cols-1 gap-2">
                                                            {categoryPackages.map(pkg => {
                                                        const hasDurationOptions = !!pkg.durationOptions?.length;
                                                        const startingPrice = hasDurationOptions
                                                            ? Math.min(...pkg.durationOptions!.map(option => Number(option.price)))
                                                            : Number(pkg.price);
                                                    return (
                                                        <button
                                                            key={pkg.id}
                                                            type="button"
                                                            aria-pressed={formData.packageId === pkg.id}
                                                            onClick={() => {
                                                                handlePackageSelection(pkg.id);
                                                                setIsPackagePickerOpen(false);
                                                            }}
                                                            className={`package-option-button grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 rounded-lg border bg-white p-2 text-left shadow-sm transition hover:border-neutral-500 hover:bg-neutral-50 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300 sm:flex sm:gap-3 sm:rounded-xl sm:p-2.5 ${
                                                                formData.packageId === pkg.id ? 'border-neutral-900 ring-1 ring-neutral-300' : 'border-neutral-200'
                                                            }`}
                                                        >
                                                            {pkg.coverImage ? (
                                                                <img src={pkg.coverImage} alt="" className="row-span-2 h-10 w-10 shrink-0 rounded-lg object-cover sm:row-span-1 sm:h-12 sm:w-12" />
                                                            ) : (
                                                                <span className="row-span-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-black sm:row-span-1 sm:h-12 sm:w-12">
                                                                    <PackageIcon className="h-5 w-5" aria-hidden="true" />
                                                                </span>
                                                            )}
                                                            <span className="min-w-0 flex-1">
                                                                <span className="package-picker-title block text-sm font-bold text-slate-900">{pkg.name}</span>
                                                            </span>
                                                            <span className="package-picker-price-wrap col-start-2 flex w-full items-center justify-between gap-2 text-left sm:col-auto sm:block sm:w-auto sm:max-w-[7rem] sm:shrink-0 sm:whitespace-nowrap sm:text-right">
                                                                {hasDurationOptions && <span className="package-price-caption block text-[10px] font-semibold text-slate-500">Mulai dari</span>}
                                                                <span className="package-picker-price block text-[11px] font-extrabold text-neutral-950 sm:text-xs">{formatCurrency(startingPrice)}</span>
                                                            </span>
                                                        </button>
                                                    );
                                                            })}
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                            )}
                                        </div>
                                    )}
                                    <p className="mt-2 text-[11px] font-medium text-slate-600" aria-live="polite">
                                        {formData.packageId
                                            ? 'bisa memilih durasi.'
                                            : 'Pilih salah satu package untuk melanjutkan booking.'}
                                    </p>
                                </fieldset>
                                {(() => {
                                    const pkg = filteredPackages.find(p => p.id === formData.packageId);
                                    if (!pkg) return null;
                                    const hasDurationOpts = pkg.durationOptions && pkg.durationOptions.length > 0;
                                    const selectedOpt = hasDurationOpts
                                        ? (pkg.durationOptions!.find(o => o.label === formData.durationSelection) || pkg.durationOptions!.find(o => o.default) || pkg.durationOptions![0])
                                        : null;
                                    const photographers = selectedOpt?.photographers || pkg.photographers;
                                    const videographers = selectedOpt?.videographers || pkg.videographers;
                                    const processingTime = selectedOpt?.processingTime || pkg.processingTime;
                                    const digitalItems = (selectedOpt?.digitalItems?.filter(Boolean).length ? selectedOpt.digitalItems : pkg.digitalItems)?.filter(Boolean) || [];
                                    const physicalItems = (selectedOpt?.physicalItems?.filter(p => p?.name).length ? selectedOpt.physicalItems : pkg.physicalItems)?.filter(p => p?.name) || [];
                                    const hasAnyDetail = photographers || videographers || processingTime || digitalItems.length > 0 || physicalItems.length > 0;
                                    return (
                                        <div className="mt-3 space-y-2">
                                            <p className="text-xs font-semibold text-black">
                                                Detail Package: {pkg.name}
                                                {selectedOpt && hasDurationOpts && <span className="font-normal text-neutral-700"> — {selectedOpt.label}</span>}
                                            </p>
                                            {hasAnyDetail ? (
                                                <ul className="text-xs text-public-text-secondary space-y-1">
                                                    {photographers && <li>• {photographers}</li>}
                                                    {videographers && <li>• {videographers}</li>}
                                                    {processingTime && <li>• Waktu pengerjaan: {processingTime}</li>}
                                                    {digitalItems.map((item, i) => <li key={i}>• {item}</li>)}
                                                    {physicalItems.map((item, i) => <li key={i}>• {item.name}</li>)}
                                                </ul>
                                            ) : (
                                                <p className="text-xs text-public-text-secondary italic">Klik opsi Jam Kerja di bawah untuk melihat detail.</p>
                                            )}
                                        </div>
                                    );
                                })()}
                                {(() => {
                                    const pkg = filteredPackages.find(p => p.id === formData.packageId); if (!pkg?.durationOptions || pkg.durationOptions.length === 0) return null; return (
                                        <div className="mt-2">
                                            <label className="text-xs font-semibold text-black">Jam Kerja</label>
                                            <p className="text-xs text-public-text-secondary mt-1 mb-2">Pilih durasi jam kerja </p>
                                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {pkg.durationOptions.map(opt => (
                                                    <label key={opt.label} className={`min-h-11 flex items-center justify-between border-b border-neutral-200 px-2 py-2.5 last:border-b-0 cursor-pointer transition-colors ${formData.durationSelection === opt.label
                                                        ? 'border-l-2 border-l-black bg-neutral-200'
                                                        : 'hover:bg-neutral-50'
                                                        }`}>
                                                        <span className="duration-option-label text-sm font-medium">{opt.label}</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="duration-option-price text-sm font-semibold text-black">{formatCurrency(opt.price)}</span>
                                                            <input type="radio" name="durationSelection" value={opt.label} checked={formData.durationSelection === opt.label} onChange={handleFormChange} className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-black focus:ring-neutral-900 flex-shrink-0" />
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {filteredPackages.length > 1 && formData.packageId && (
                                    <div className="mt-4 space-y-2">
                                        <label className="block text-xs font-semibold text-black">Package Tambahan (Opsional)</label>
                                        {!isAdditionalPackagesOpen ? (
                                            <button 
                                                type="button" 
                                                onClick={() => setIsAdditionalPackagesOpen(true)}
                                                className="w-full px-4 py-3 rounded-xl bg-black text-white font-semibold hover:bg-neutral-800 transition-all text-sm flex justify-center items-center gap-2"
                                            >
                                                Tampilkan Daftar Package Tambahan
                                            </button>
                                        ) : (
                                            <div className="space-y-2">
                                                {filteredPackages.filter(p => p.id !== formData.packageId).map(pkg => (
                                                    <label key={pkg.id} className={`grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-lg border bg-white p-2 text-left shadow-sm transition hover:border-neutral-500 hover:bg-neutral-50 cursor-pointer sm:gap-3 sm:rounded-xl sm:p-2.5 ${formData.selectedAdditionalPackageIds?.includes(pkg.id) ? 'border-neutral-900 ring-1 ring-neutral-300' : 'border-neutral-200'
                                                        }`}>
                                                        {pkg.coverImage ? (
                                                            <img src={pkg.coverImage} alt="" className="row-span-2 h-10 w-10 shrink-0 rounded-lg object-cover sm:row-span-1 sm:h-12 sm:w-12" />
                                                        ) : (
                                                            <span className="row-span-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-black sm:row-span-1 sm:h-12 sm:w-12">
                                                                <PackageIcon className="h-5 w-5" aria-hidden="true" />
                                                            </span>
                                                        )}
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-sm font-bold text-slate-900">{pkg.name}</span>
                                                            <span className="block text-[11px] font-extrabold text-neutral-950 sm:text-xs">{formatCurrency(pkg.price)}</span>
                                                        </span>
                                                        <div className="col-start-3 row-span-2 flex items-center justify-end px-1">
                                                            <input 
                                                                type="checkbox" 
                                                                name="additionalPackages" 
                                                                checked={formData.selectedAdditionalPackageIds?.includes(pkg.id)} 
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        selectedAdditionalPackageIds: checked
                                                                            ? [...(prev.selectedAdditionalPackageIds || []), pkg.id]
                                                                            : (prev.selectedAdditionalPackageIds || []).filter(id => id !== pkg.id)
                                                                    }));
                                                                }} 
                                                                className="h-4 w-4 text-black rounded focus:ring-neutral-900 flex-shrink-0 cursor-pointer pointer-events-none" 
                                                            />
                                                        </div>
                                                    </label>
                                                ))}
                                                <div className="flex justify-center mt-2">
                                                    <button type="button" onClick={() => setIsAdditionalPackagesOpen(false)} className="text-xs font-semibold text-public-text-secondary hover:underline">Tutup Daftar</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="space-y-2 mt-4">
                                    <label className="block text-xs font-semibold text-black">Add-On Lainnya (Opsional)</label>
                                    <div className="space-y-1">{filteredAddOns.length > 0 ? filteredAddOns.map(addon => (<label key={addon.id} className={`flex items-center justify-between border-b border-neutral-200 px-2 py-2 last:border-b-0 cursor-pointer transition-colors ${formData.selectedAddOnIds.includes(addon.id)
                                        ? 'bg-neutral-200'
                                        : 'hover:bg-neutral-50'
                                        }`}><span className="text-sm text-public-text-primary font-medium">{addon.name}</span><div className="flex items-center gap-2"><span className="text-sm font-semibold text-black">{formatCurrency(addon.price)}</span><input type="checkbox" id={addon.id} name="addOns" checked={formData.selectedAddOnIds.includes(addon.id)} onChange={handleFormChange} className="h-4 w-4 text-black rounded focus:ring-neutral-900 flex-shrink-0" /></div></label>)) : <p className="text-xs text-public-text-secondary">Tidak ada add-on untuk wilayah ini.</p>}</div></div>

                                <div className="space-y-2">
                                    <label htmlFor="promoCode" className="block text-xs font-semibold text-black">Kode Promo (Opsional)</label>
                                    <input type="text" id="promoCode" name="promoCode" value={formData.promoCode} onChange={handleFormChange} className="w-full px-4 py-3 rounded-xl border border-black bg-white font-semibold text-public-text-primary focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-black transition-all" placeholder="Masukkan kode promo" />
                                    {!promoFeedback.message && <p className="text-xs text-public-text-secondary">Masukkan kode promo jika Anda memilikinya</p>}
                                    {promoFeedback.message && <p className={`text-xs ${promoFeedback.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{promoFeedback.message}</p>}
                                </div>

                                <div className="space-y-2 md:space-y-3">
                                    {discountAmount > 0 && (
                                        <>
                                            <div className="flex justify-between items-center text-sm"><span className="text-public-text-secondary">Subtotal</span><span className="text-public-text-primary">{formatCurrency(totalBeforeDiscount)}</span></div>
                                            <div className="flex justify-between items-center text-sm"><span className="text-public-text-secondary">Diskon ({discountText})</span><span className="text-green-500">-{formatCurrency(discountAmount)}</span></div>
                                        </>
                                    )}
                                    <div className="flex justify-between items-center font-bold text-lg"><span className="total-cost-label text-public-text-secondary">Total Biaya</span><span className="total-cost-value text-public-text-primary">{formatCurrency(totalProject)}</span></div>
                                    <hr className="border-public-border" />
                                    <p className="text-sm text-public-text-secondary">Silakan transfer Uang Muka (DP) ke rekening berikut:</p>
                                    <p className="font-semibold text-public-text-primary text-center py-2 bg-public-surface rounded-md border border-public-border">{userProfile.bankAccount}</p>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-2">
                                            <label htmlFor="dp" className="block text-xs font-semibold text-black">Jumlah DP Ditransfer</label>
                                            <RupiahInput
                                                id="dp"
                                                name="dp"
                                                value={String(formData.dp ?? '')}
                                                onChange={(raw) => setFormData(prev => ({ ...prev, dp: raw }))}
                                                className="w-full px-4 py-3 rounded-xl border border-black bg-white font-semibold text-public-text-primary focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-black transition-all text-right"
                                                placeholder="0"
                                            />
                                            <p className="text-xs text-public-text-secondary text-right">Saran DP (30%): {formatCurrency(suggestedDp)}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 !mt-4">
                                        <label htmlFor="dpPaymentProof" className="block text-xs font-semibold text-black">Bukti Transfer DP (Opsional)</label>
                                        <div className="booking-upload-box mt-2 flex justify-center rounded-2xl border-2 border-dashed border-black bg-gradient-to-br from-neutral-50 to-white transition-colors hover:border-neutral-900">
                                            {paymentProof ? (
                                                <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                                                    {paymentProofPreviewUrl ? (
                                                        <img
                                                            src={paymentProofPreviewUrl}
                                                            alt={`Pratinjau bukti transfer ${paymentProof.name}`}
                                                            className="h-36 w-full rounded-xl border border-neutral-200 object-contain bg-white sm:h-28 sm:w-36"
                                                        />
                                                    ) : (
                                                        <div className="flex h-24 w-full items-center justify-center rounded-xl border border-neutral-200 bg-white text-sm font-bold text-black sm:h-20 sm:w-28">
                                                            PDF
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1 text-center sm:text-left">
                                                        <p className="text-sm font-bold text-neutral-950">Bukti transfer siap</p>
                                                        <p className="mt-1 break-all text-xs text-neutral-700">{paymentProof.name}</p>
                                                        <p className="mt-1 text-xs text-neutral-600">{(paymentProof.size / (1024 * 1024)).toFixed(2)} MB</p>
                                                        <label htmlFor="dpPaymentProof" className="mt-2 inline-flex cursor-pointer items-center rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800">
                                                            Ganti file
                                                        </label>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-black">
                                                        <UploadIcon className="booking-upload-icon h-6 w-6" />
                                                    </span>
                                                    <p className="mt-2 text-sm font-bold text-public-text-primary">Unggah bukti transfer</p>
                                                    <p className="booking-upload-instruction mt-1 text-xs text-public-text-secondary">Pilih gambar atau dokumen bukti pembayaran</p>
                                                    <label htmlFor="dpPaymentProof" className="mt-2 inline-flex cursor-pointer items-center rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800">
                                                        Pilih file
                                                    </label>
                                                    <p className="booking-upload-hint mt-1 text-[11px] text-neutral-600">PNG, JPG, PDF · Maksimal 10 MB</p>
                                                </div>
                                            )}
                                            <input id="dpPaymentProof" name="dpPaymentProof" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/jpg, application/pdf" />
                                        </div>
                                        {paymentProof && (
                                            <div className="booking-upload-selected mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                                <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold">✓</span>
                                                <span>File berhasil dipilih dan siap dikirim.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6">
                            <button type="submit" disabled={isSubmitting} className="w-full px-6 py-4 rounded-xl bg-black text-white font-semibold text-base sm:text-lg hover:bg-neutral-800 active:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl">{isSubmitting ? 'Mengirim...' : 'Kirim Formulir Pemesanan'}</button>
                        </div>
                    </form>
                    <div className="mt-6 flex justify-center items-center gap-4">
                        <button type="button" onClick={() => setIsTermsModalOpen(true)} className="text-xs font-semibold text-public-accent hover:underline">
                            Lihat Syarat & Ketentuan Umum
                        </button>
                    </div>
                </div>
            </div>
            <Modal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} title="Syarat & Ketentuan Umum">
                <div className="max-h-[70vh] overflow-y-auto pr-4">
                    {userProfile.publicPageConfig?.packageTerms && userProfile.publicPageConfig.packageTerms.length > 0 ? (
                        <div className="space-y-4">
                            {userProfile.publicPageConfig.packageTerms.map((section, sIdx) => (
                                <div key={section.id || sIdx} className="border border-brand-border/80 bg-brand-bg/40 rounded-xl p-3.5 space-y-2">
                                    <h4 className="font-semibold text-brand-text-light text-sm flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-md bg-brand-accent/20 text-brand-accent flex items-center justify-center text-xs font-bold">
                                            {sIdx + 1}
                                        </span>
                                        <span>{section.title}</span>
                                    </h4>
                                    <ul className="space-y-1.5 pl-7 text-xs sm:text-sm text-brand-text-secondary">
                                        {section.items.map((item, itemIdx) => (
                                            <li key={itemIdx} className="flex items-start gap-2">
                                                <span className="text-emerald-500 font-bold shrink-0">✓</span>
                                                <span className="leading-snug">{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ) : formattedTerms ? (
                        <div>{formattedTerms}</div>
                    ) : (
                        <p className="text-brand-text-secondary text-center py-8">Syarat dan ketentuan belum diatur oleh vendor.</p>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default PublicBookingForm;