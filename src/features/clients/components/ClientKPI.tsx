import React, { useMemo, useState } from 'react';
import {
    Client, Lead, Project, ClientStatus, ContactChannel, ClientFeedback,
    SatisfactionLevel, LeadStatus, ViewType, ClientType, TeamMember,
    Package, TeamProjectPayment, TeamPaymentRecord, Transaction, PaymentStatus
} from '../../../types';
import PageHeader from '../../../layouts/PageHeader';
import Modal from '../../../shared/ui/Modal';
import { ModernStatCard } from '../../../components/modernize/ModernStatCard';
import DonutChart from '../../../shared/ui/DonutChart';
import { AnalyticsChartCard } from '../../../shared/ui/AnalyticsChartCard';
import { MobileCollapsibleSection } from '../../../components/ui/MobileProgressiveDisclosure';
import ClientDistributionChart from './ClientDistributionChart';
import {
    UsersIcon, TargetIcon, TrendingUpIcon, DollarSignIcon,
    PlusIcon, Share2Icon, StarIcon, SmileIcon, ThumbsUpIcon,
    MehIcon, FrownIcon, EyeIcon, ChevronRightIcon,
    CheckCircleIcon, Trash2Icon, CalendarIcon, DownloadIcon,
    ArrowUpIcon, ArrowDownIcon,
    BriefcaseIcon, PackageIcon, MapPinIcon, UserCheckIcon
} from '../../../constants';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const INDONESIA_CITIES = [
    'Serang', 'Pandeglang', 'Cilegon', 'Lebak', 'Rangkasbitung', 'Tangerang', 'Tangerang Selatan', 'Tangsel',
    'Jakarta', 'Jakarta Barat', 'Jakarta Pusat', 'Jakarta Selatan', 'Jakarta Timur', 'Jakarta Utara',
    'Bogor', 'Depok', 'Bekasi', 'Karawang', 'Bandung', 'Bandung Barat', 'Cimahi',
    'Sukabumi', 'Cianjur', 'Purwakarta', 'Subang', 'Indramayu', 'Cirebon', 'Kuningan',
    'Majalengka', 'Sumedang', 'Garut', 'Tasikmalaya', 'Ciamis', 'Pangandaran', 'Banjar',
    'Semarang', 'Surakarta', 'Solo', 'Yogyakarta', 'Jogja', 'Surabaya', 'Malang',
    'Denpasar', 'Medan', 'Palembang', 'Bandar Lampung', 'Lampung'
];

// Helper function to extract city name from address
const extractCityFromAddress = (address: string): string => {
    if (!address || !address.trim()) return 'Lainnya';

    const addr = address.trim();

    // Direct check for recognized cities in Indonesia
    for (const city of INDONESIA_CITIES) {
        const regex = new RegExp(`(^|[^a-zA-Z])${city}([^a-zA-Z]|$)`, 'i');
        if (regex.test(addr)) {
            return city;
        }
    }

    // Try to match patterns like "Kota Jakarta", "Kabupaten Bandung", etc.
    const cityPattern = addr.match(/(?:kota|kabupaten|kab\.?)\s+([a-zA-Z\s]+)/i);
    if (cityPattern && cityPattern[1]) {
        return cityPattern[1].trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    // Split by comma and get the most meaningful part
    const parts = addr.split(',').map(p => p.trim()).filter(p => p.length > 0);

    if (parts.length === 0) return 'Lainnya';

    // Common location keywords to filter out
    const locationKeywords = [
        'jalan', 'jl', 'jln', 'no', 'nomor', 'rt', 'rw', 'kecamatan', 'kec',
        'kelurahan', 'kel', 'desa', 'provinsi', 'prov', 'daerah khusus', 'ibukota',
        'khusus', 'dki', 'dk', 'gedung', 'hotel', 'hall'
    ];

    // Filter out keywords and short parts
    const meaningfulParts = parts.filter(p => {
        const lowerP = p.toLowerCase();
        if (locationKeywords.some(kw => lowerP.includes(kw))) return false;
        if (/^\d+$/.test(p)) return false;
        if (p.length < 3) return false;
        if (/^\d+[a-zA-Z]?$/.test(p)) return false;
        return true;
    });

    if (meaningfulParts.length > 0) {
        const city = meaningfulParts[meaningfulParts.length - 1];
        return city.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    const lastPart = parts[parts.length - 1];
    return lastPart.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const StarRatingDisplay: React.FC<{ rating: number; size?: 'sm' | 'md' }> = ({ rating, size = 'md' }) => {
    const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
                <StarIcon key={star} className={`${sz} ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-600'}`} />
            ))}
        </div>
    );
};

const TrendIndicator: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
    const isPositive = value >= 0;
    const Icon = isPositive ? ArrowUpIcon : ArrowDownIcon;
    const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';
    const bgColor = isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10';

    // Cap extreme values for better readability
    const displayValue = Math.abs(value) > 999 ? 999 : Math.abs(value);
    const displayText = displayValue >= 999 ? '999+' : displayValue.toFixed(1);

    return (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${bgColor} ${colorClass} text-xs font-medium`}>
            <Icon className="w-3 h-3" />
            <span>{displayText}%{suffix}</span>
        </div>
    );
};

const emptyFeedbackForm = { clientName: '', rating: 5, feedback: '' };

interface ClientReportsProps {
    clients: Client[];
    leads: Lead[];
    projects: Project[];
    feedback: ClientFeedback[];
    setFeedback: React.Dispatch<React.SetStateAction<ClientFeedback[]>>;
    showNotification: (message: string) => void;
    handleNavigation?: (view: ViewType, action?: any) => void;
    teamMembers?: TeamMember[];
    packages?: Package[];
    teamProjectPayments?: TeamProjectPayment[];
    teamPaymentRecords?: TeamPaymentRecord[];
    transactions?: Transaction[];
}

const SatisfactionBadge: React.FC<{ satisfaction: SatisfactionLevel }> = ({ satisfaction }) => {
    const config: Record<SatisfactionLevel, { cls: string; icon: React.ReactNode }> = {
        [SatisfactionLevel.VERY_SATISFIED]: { cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <SmileIcon className="w-3 h-3" /> },
        [SatisfactionLevel.SATISFIED]: { cls: 'bg-sky-500/20 text-sky-400 border-sky-500/30', icon: <ThumbsUpIcon className="w-3 h-3" /> },
        [SatisfactionLevel.NEUTRAL]: { cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: <MehIcon className="w-3 h-3" /> },
        [SatisfactionLevel.UNSATISFIED]: { cls: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <FrownIcon className="w-3 h-3" /> },
    };
    const { cls, icon } = config[satisfaction] || { cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: null };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${cls}`}>
            {icon} {satisfaction}
        </span>
    );
};

const ClientReports: React.FC<ClientReportsProps> = ({
    clients, leads, projects, feedback, setFeedback, showNotification, handleNavigation,
    teamMembers = [], packages = [], teamProjectPayments = [], teamPaymentRecords = [], transactions = []
}) => {
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [manualFeedbackForm, setManualFeedbackForm] = useState(emptyFeedbackForm);
    const [activeStatModal, setActiveStatModal] = useState<
        'total' | 'active' | 'direct-vendor' | 'top-cities' | 'top-packages' | 'top-team' | 'lead-conversion' |
        'very-satisfied' | 'satisfied' | 'neutral' | 'unsatisfied' | null
    >(null);
    const [activeReportTab, setActiveReportTab] = useState<'ringkasan' | 'tipe' | 'daerah' | 'paket' | 'tim' | 'leads' | 'pengantin'>('ringkasan');
    const [clientTypeFilter, setClientTypeFilter] = useState<'all' | 'direct' | 'vendor'>('all');
    const [cityFilter, setCityFilter] = useState<string>('all');
    const [packageFilter, setPackageFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activePreset, setActivePreset] = useState<'all' | 'this-month' | 'this-quarter' | 'this-year'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'date' | 'value' | 'status'>('date');
    const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');

    const applyDateFilter = <T extends { date?: string; since?: string; createdAt?: string }>(items: T[], dateKey: 'date' | 'since') => {
        if (!dateFrom && !dateTo) return items;
        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo) : null;
        if (from) from.setHours(0, 0, 0, 0);
        if (to) to.setHours(23, 59, 59, 999);
        return items.filter(item => {
            const rawVal = (item as any)[dateKey] || (item as any)['createdAt'] || (item as any)['date'] || (item as any)['since'];
            if (!rawVal) return true;
            const d = new Date(rawVal);
            if (isNaN(d.getTime())) return true;
            return (!from || d >= from) && (!to || d <= to);
        });
    };

    // Reset page when date filter changes
    const handleDateChange = (from: string, to: string) => {
        setDateFrom(from);
        setDateTo(to);
        setCurrentPage(1);
    };

    const handleSetDatePreset = (preset: 'all' | 'this-month' | 'this-quarter' | 'this-year') => {
        setActivePreset(preset);
        const now = new Date();
        if (preset === 'all') {
            handleDateChange('', '');
            return;
        }
        if (preset === 'this-month') {
            const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            handleDateChange(first, last);
            return;
        }
        if (preset === 'this-quarter') {
            const qMonth = Math.floor(now.getMonth() / 3) * 3;
            const first = new Date(now.getFullYear(), qMonth, 1).toISOString().split('T')[0];
            const last = new Date(now.getFullYear(), qMonth + 3, 0).toISOString().split('T')[0];
            handleDateChange(first, last);
            return;
        }
        if (preset === 'this-year') {
            const first = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
            const last = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
            handleDateChange(first, last);
            return;
        }
    };

    const filteredLeads = useMemo(() => applyDateFilter(leads, 'date'), [leads, dateFrom, dateTo]);
    const filteredClients = useMemo(() => applyDateFilter(clients as any[], 'since') as Client[], [clients, dateFrom, dateTo]);
    const filteredProjects = useMemo(() => {
        if (!dateFrom && !dateTo) return projects;
        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo) : null;
        if (from) from.setHours(0, 0, 0, 0);
        if (to) to.setHours(23, 59, 59, 999);

        const clientIdsInPeriod = new Set(filteredClients.map(c => c.id));

        return projects.filter(p => {
            if (clientIdsInPeriod.has(p.clientId)) return true;
            const rawDate = p.date || (p as any).createdAt;
            if (!rawDate) return false;
            const d = new Date(rawDate);
            if (isNaN(d.getTime())) return false;
            return (!from || d >= from) && (!to || d <= to);
        });
    }, [projects, filteredClients, dateFrom, dateTo]);
    const filteredFeedback = useMemo(() => applyDateFilter(feedback, 'date'), [feedback, dateFrom, dateTo]);

    // Search and sort logic
    const searchedAndSortedClients = useMemo(() => {
        let result = [...filteredClients];

        // Apply status filter
        if (statusFilter !== 'all') {
            result = result.filter(client => client.status === statusFilter);
        }

        // Apply client type filter
        if (clientTypeFilter !== 'all') {
            result = result.filter(client => {
                const isDirect = client.clientType === ClientType.DIRECT || client.clientType === 'Langsung' || (!client.clientType);
                return clientTypeFilter === 'direct' ? isDirect : !isDirect;
            });
        }

        // Apply city filter
        if (cityFilter !== 'all') {
            result = result.filter(client => extractCityFromAddress(client.address || '') === cityFilter);
        }

        // Apply package filter
        if (packageFilter !== 'all') {
            const clientIdsWithPackage = new Set(
                filteredProjects.filter(p => (p.packageName || '').toLowerCase().trim() === packageFilter.toLowerCase().trim()).map(p => p.clientId)
            );
            result = result.filter(client => clientIdsWithPackage.has(client.id));
        }

        // Apply search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(client =>
                client.name.toLowerCase().includes(query) ||
                client.email.toLowerCase().includes(query) ||
                (client.address && client.address.toLowerCase().includes(query))
            );
        }

        // Apply sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'date':
                    return new Date(b.since).getTime() - new Date(a.since).getTime();
                case 'value':
                    const aValue = filteredProjects.filter(p => p.clientId === a.id).reduce((sum, p) => sum + p.totalCost, 0);
                    const bValue = filteredProjects.filter(p => p.clientId === b.id).reduce((sum, p) => sum + p.totalCost, 0);
                    return bValue - aValue;
                case 'status':
                    return a.status.localeCompare(b.status);
                default:
                    return 0;
            }
        });

        return result;
    }, [filteredClients, searchQuery, sortBy, statusFilter, clientTypeFilter, cityFilter, packageFilter, filteredProjects]);

    const totalPages = Math.ceil(searchedAndSortedClients.length / itemsPerPage);

    const paginatedClients = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return searchedAndSortedClients.slice(startIndex, startIndex + itemsPerPage);
    }, [searchedAndSortedClients, currentPage, itemsPerPage]);

    const kpiData = useMemo(() => {
        // Use filtered data consistently across all components
        const totalLeads = filteredLeads.length;
        const convertedLeads = filteredLeads.filter(l => l.status === LeadStatus.CONVERTED).length;
        const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

        // Calculate revenue only from projects that belong to filtered clients
        const filteredClientIds = new Set(filteredClients.map(c => c.id));
        const clientProjects = filteredProjects.filter(p => filteredClientIds.has(p.clientId));
        const totalRevenue = clientProjects.reduce((sum, p) => sum + p.totalCost, 0);

        // Calculate average revenue only for clients with projects
        const clientsWithProjects = new Set(clientProjects.map(p => p.clientId));
        const clientsWithRevenueCount = clientsWithProjects.size;
        const avgRevenuePerClient = clientsWithRevenueCount > 0 ? totalRevenue / clientsWithRevenueCount : 0;

        // Calculate trends (compare with previous period)
        const previousMonth = new Date();
        previousMonth.setMonth(previousMonth.getMonth() - 1);

        const previousClients = clients.filter(c => {
            const clientDate = new Date(c.since);
            return clientDate.getMonth() === previousMonth.getMonth() && clientDate.getFullYear() === previousMonth.getFullYear();
        }).length;

        // Calculate total trend with edge case handling
        let totalTrend = 0;
        if (previousClients > 0) {
            totalTrend = ((filteredClients.length - previousClients) / previousClients) * 100;
        } else if (filteredClients.length > 0) {
            // If previous was 0 but current has data, show as positive growth
            totalTrend = 100;
        }

        const previousProjects = projects.filter(p => {
            const projectDate = new Date(p.date);
            return projectDate.getMonth() === previousMonth.getMonth() && projectDate.getFullYear() === previousMonth.getFullYear();
        });

        const previousRevenue = previousProjects.reduce((sum, p) => sum + p.totalCost, 0);

        // Calculate revenue trend with edge case handling
        let revenueTrend = 0;
        if (previousRevenue > 0) {
            revenueTrend = ((totalRevenue - previousRevenue) / previousRevenue) * 100;
        } else if (totalRevenue > 0) {
            // If previous was 0 but current has revenue, show as positive growth
            revenueTrend = 100;
        }

        // Charts use filteredLeads
        const sourceColors: { [key in ContactChannel]?: string } = {
            [ContactChannel.INSTAGRAM]: '#c13584',
            [ContactChannel.WHATSAPP]: '#25D366',
            [ContactChannel.WEBSITE]: '#3b82f6',
            [ContactChannel.REFERRAL]: '#f59e0b',
            [ContactChannel.PHONE]: '#8b5cf6',
            [ContactChannel.SUGGESTION_FORM]: '#14b8a6',
            [ContactChannel.OTHER]: '#64748b',
        };
        const leadSourceDistribution = filteredLeads.reduce((acc, lead) => {
            acc[lead.contactChannel] = (acc[lead.contactChannel] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const leadSourceDonutData = Object.entries(leadSourceDistribution)
            .sort(([, a], [, b]) => Number(b) - Number(a))
            .map(([label, value]) => ({ label, value, color: sourceColors[label as ContactChannel] || '#64748b' }));

        return {
            totalClients: filteredClients.length,
            activeClients: filteredClients.filter(c => c.status === ClientStatus.ACTIVE).length,
            conversionRate: conversionRate.toFixed(1) + '%',
            avgRevenuePerClient: formatCurrency(avgRevenuePerClient),
            leadSourceDonutData,
            totalTrend,
            revenueTrend,
        };
    }, [filteredClients, filteredLeads, filteredProjects, clients, projects]);

    // ── 1. Pengantin Langsung vs Pengantin Vendor ──
    const directClients = useMemo(() => {
        return filteredClients.filter(c => c.clientType === ClientType.DIRECT || c.clientType === 'Langsung' || (!c.clientType));
    }, [filteredClients]);

    const vendorClients = useMemo(() => {
        return filteredClients.filter(c => c.clientType === ClientType.VENDOR || c.clientType === 'Vendor');
    }, [filteredClients]);

    const directClientIds = useMemo(() => new Set(directClients.map(c => c.id)), [directClients]);
    const vendorClientIds = useMemo(() => new Set(vendorClients.map(c => c.id)), [vendorClients]);

    const directProjects = useMemo(() => filteredProjects.filter(p => directClientIds.has(p.clientId)), [filteredProjects, directClientIds]);
    const vendorProjects = useMemo(() => filteredProjects.filter(p => vendorClientIds.has(p.clientId)), [filteredProjects, vendorClientIds]);

    const directRevenue = useMemo(() => directProjects.reduce((sum, p) => sum + p.totalCost, 0), [directProjects]);
    const vendorRevenue = useMemo(() => vendorProjects.reduce((sum, p) => sum + p.totalCost, 0), [vendorProjects]);
    const totalRevenue = useMemo(() => filteredProjects.reduce((sum, p) => sum + p.totalCost, 0), [filteredProjects]);

    const avgDirectRevenue = directClients.length > 0 ? Math.round(directRevenue / directClients.length) : 0;
    const avgVendorRevenue = vendorClients.length > 0 ? Math.round(vendorRevenue / vendorClients.length) : 0;
    const avgRevenuePerClient = filteredClients.length > 0 ? Math.round(totalRevenue / filteredClients.length) : 0;

    const directShare = filteredClients.length > 0 ? ((directClients.length / filteredClients.length) * 100).toFixed(0) : '0';
    const vendorShare = filteredClients.length > 0 ? ((vendorClients.length / filteredClients.length) * 100).toFixed(0) : '0';
    const directRevenueShare = totalRevenue > 0 ? ((directRevenue / totalRevenue) * 100).toFixed(1) : '0';
    const vendorRevenueShare = totalRevenue > 0 ? ((vendorRevenue / totalRevenue) * 100).toFixed(1) : '0';

    // ── 2. Daerah & Kota Pengantin Terbanyak ──
    const cityStats = useMemo(() => {
        const map: Record<string, {
            name: string;
            clientCount: number;
            leadCount: number;
            projectCount: number;
            totalRevenue: number;
            clients: Client[];
            leads: Lead[];
        }> = {};

        filteredClients.forEach(c => {
            const city = extractCityFromAddress(c.address || c.homeAddress || '');
            if (!map[city]) {
                map[city] = { name: city, clientCount: 0, leadCount: 0, projectCount: 0, totalRevenue: 0, clients: [], leads: [] };
            }
            map[city].clientCount += 1;
            map[city].clients.push(c);
        });

        filteredLeads.forEach(l => {
            const city = extractCityFromAddress(l.location || l.address || '');
            if (!map[city]) {
                map[city] = { name: city, clientCount: 0, leadCount: 0, projectCount: 0, totalRevenue: 0, clients: [], leads: [] };
            }
            map[city].leadCount += 1;
            map[city].leads.push(l);
        });

        filteredProjects.forEach(p => {
            const client = filteredClients.find(c => c.id === p.clientId);
            const targetCity = client ? extractCityFromAddress(client.address || client.homeAddress || '') : extractCityFromAddress(p.location || '');
            if (map[targetCity]) {
                map[targetCity].projectCount += 1;
                map[targetCity].totalRevenue += p.totalCost;
            }
        });

        const list = Object.values(map).sort((a, b) => {
            if (b.clientCount !== a.clientCount) return b.clientCount - a.clientCount;
            const aTotal = a.clientCount + a.leadCount;
            const bTotal = b.clientCount + b.leadCount;
            if (bTotal !== aTotal) return bTotal - aTotal;
            return b.totalRevenue - a.totalRevenue;
        });
        const totalCount = filteredClients.length;
        return list.map(item => ({
            ...item,
            percentage: totalCount > 0 ? (item.clientCount / totalCount) * 100 : (item.leadCount > 0 ? 100 : 0)
        }));
    }, [filteredClients, filteredLeads, filteredProjects]);

    const topCity = cityStats.find(c => c.clientCount > 0) || cityStats[0] || { name: 'Semua Kota', clientCount: 0, leadCount: 0, percentage: 0, totalRevenue: 0, clients: [], leads: [] };
    const uniqueCities = useMemo(() => Array.from(new Set(cityStats.map(c => c.name).filter(Boolean))), [cityStats]);

    // ── 3. Paket & Pricelist ──
    const packageStats = useMemo(() => {
        const map: Record<string, {
            name: string;
            category: string;
            pricelistPrice: number;
            orderCount: number;
            totalOmzet: number;
            projects: Project[];
        }> = {};

        (packages || []).forEach(pkg => {
            map[pkg.name] = {
                name: pkg.name,
                category: pkg.category || 'Pernikahan',
                pricelistPrice: pkg.price || 0,
                orderCount: 0,
                totalOmzet: 0,
                projects: []
            };
        });

        filteredProjects.forEach(p => {
            const pName = p.packageName?.trim() || 'Paket Standar';
            if (!map[pName]) {
                map[pName] = {
                    name: pName,
                    category: p.projectType || 'Pernikahan',
                    pricelistPrice: p.unitPrice || p.totalCost || 0,
                    orderCount: 0,
                    totalOmzet: 0,
                    projects: []
                };
            }
            map[pName].orderCount += 1;
            map[pName].totalOmzet += p.totalCost;
            map[pName].projects.push(p);
        });

        const list = Object.values(map)
            .filter(item => item.orderCount > 0 || (packages && packages.some(pkg => pkg.name === item.name)))
            .map(item => ({
                ...item,
                avgRealizedPrice: item.orderCount > 0 ? Math.round(item.totalOmzet / item.orderCount) : item.pricelistPrice,
                revenueContribution: totalRevenue > 0 ? (item.totalOmzet / totalRevenue) * 100 : 0
            }))
            .sort((a, b) => b.orderCount !== a.orderCount ? b.orderCount - a.orderCount : b.totalOmzet - a.totalOmzet);

        return list;
    }, [packages, filteredProjects, totalRevenue]);

    const topPackage = packageStats[0] || {
        name: 'Belum Ada Paket', category: '-', pricelistPrice: 0, orderCount: 0, totalOmzet: 0, avgRealizedPrice: 0, revenueContribution: 0, projects: []
    };
    const uniquePackages = useMemo(() => Array.from(new Set(packageStats.map(p => p.name))), [packageStats]);

    // ── 4. Kinerja Tim: Job Terbanyak & Pembayaran Terbanyak ──
    const teamStats = useMemo(() => {
        const memberMap: Record<string, {
            id: string;
            name: string;
            role: string;
            category: 'Tim' | 'Vendor';
            jobCount: number;
            totalFee: number;
            paidFee: number;
            unpaidFee: number;
            projects: { project: Project; fee: number; role: string }[];
        }> = {};

        (teamMembers || []).forEach(tm => {
            memberMap[tm.name.toLowerCase().trim()] = {
                id: tm.id,
                name: tm.name,
                role: tm.role || 'Crew',
                category: tm.category || 'Tim',
                jobCount: 0,
                totalFee: 0,
                paidFee: 0,
                unpaidFee: 0,
                projects: []
            };
        });

        filteredProjects.forEach(p => {
            if (p.team && Array.isArray(p.team)) {
                p.team.forEach(assigned => {
                    const key = assigned.name.toLowerCase().trim();
                    if (!memberMap[key]) {
                        memberMap[key] = {
                            id: assigned.memberId || crypto.randomUUID(),
                            name: assigned.name,
                            role: assigned.role || 'Crew',
                            category: 'Tim',
                            jobCount: 0,
                            totalFee: 0,
                            paidFee: 0,
                            unpaidFee: 0,
                            projects: []
                        };
                    }
                    const fee = Number(assigned.fee) || 0;
                    memberMap[key].jobCount += 1;
                    memberMap[key].totalFee += fee;

                    const isPaid = p.paymentStatus === PaymentStatus.LUNAS;
                    if (isPaid) {
                        memberMap[key].paidFee += fee;
                    } else {
                        memberMap[key].unpaidFee += fee;
                    }
                    memberMap[key].projects.push({ project: p, fee, role: assigned.role || memberMap[key].role });
                });
            }
        });

        return Object.values(memberMap).filter(item => item.jobCount > 0);
    }, [teamMembers, filteredProjects]);

    const topTeamJob = useMemo(() => {
        return [...teamStats].sort((a, b) => b.jobCount - a.jobCount)[0] || {
            id: '', name: 'Belum Ada', jobCount: 0, totalFee: 0, role: '-', category: 'Tim' as const, paidFee: 0, unpaidFee: 0, projects: []
        };
    }, [teamStats]);

    const topTeamPayment = useMemo(() => {
        return [...teamStats].sort((a, b) => b.totalFee - a.totalFee)[0] || {
            id: '', name: 'Belum Ada', jobCount: 0, totalFee: 0, role: '-', category: 'Tim' as const, paidFee: 0, unpaidFee: 0, projects: []
        };
    }, [teamStats]);

    // ── 5. Leads & Konversi ke Pengantin ──
    const leadConversionStats = useMemo(() => {
        const total = filteredLeads.length;
        const converted = filteredLeads.filter(l => l.status === LeadStatus.CONVERTED).length;
        const discussion = filteredLeads.filter(l => l.status === LeadStatus.DISCUSSION).length;
        const followUp = filteredLeads.filter(l => l.status === LeadStatus.FOLLOW_UP).length;
        const rejected = filteredLeads.filter(l => l.status === LeadStatus.REJECTED).length;
        const rate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0';

        const channelMap: Record<string, { channel: string; total: number; converted: number }> = {};
        filteredLeads.forEach(l => {
            const ch = l.contactChannel || 'Lainnya';
            if (!channelMap[ch]) channelMap[ch] = { channel: ch, total: 0, converted: 0 };
            channelMap[ch].total += 1;
            if (l.status === LeadStatus.CONVERTED) channelMap[ch].converted += 1;
        });

        const channels = Object.values(channelMap).sort((a, b) => b.total - a.total).map(ch => ({
            ...ch,
            rate: ch.total > 0 ? ((ch.converted / ch.total) * 100).toFixed(0) : '0'
        }));

        return { total, converted, discussion, followUp, rejected, rate, channels };
    }, [filteredLeads]);

    const feedbackBySatisfaction = useMemo(() => {
        return feedback.reduce((acc, item) => {
            if (!acc[item.satisfaction]) acc[item.satisfaction] = [];
            acc[item.satisfaction].push(item);
            return acc;
        }, {} as Record<SatisfactionLevel, ClientFeedback[]>);
    }, [feedback]);

    const satisfactionCounts = useMemo(() => ({
        [SatisfactionLevel.VERY_SATISFIED]: (feedbackBySatisfaction[SatisfactionLevel.VERY_SATISFIED] || []).length,
        [SatisfactionLevel.SATISFIED]: (feedbackBySatisfaction[SatisfactionLevel.SATISFIED] || []).length,
        [SatisfactionLevel.NEUTRAL]: (feedbackBySatisfaction[SatisfactionLevel.NEUTRAL] || []).length,
        [SatisfactionLevel.UNSATISFIED]: (feedbackBySatisfaction[SatisfactionLevel.UNSATISFIED] || []).length,
    }), [feedbackBySatisfaction]);

    const totalFeedback = Object.values(satisfactionCounts).reduce((a, b) => a + b, 0);
    const avgRating = useMemo(() => {
        if (filteredFeedback.length === 0) return 0;
        return filteredFeedback.reduce((sum, f) => sum + f.rating, 0) / filteredFeedback.length;
    }, [filteredFeedback]);

    const actionRecommendations = useMemo(() => {
        const recs = [];
        if (satisfactionCounts[SatisfactionLevel.UNSATISFIED] > 0) recs.push({ id: 'follow-up', icon: <FrownIcon className="w-5 h-5 text-red-400" />, bg: 'bg-red-500/10 border-red-500/20', title: 'Tindak Lanjuti Testimoni Negatif', text: `${satisfactionCounts[SatisfactionLevel.UNSATISFIED]} pengantin tidak puas. Segera hubungi mereka.` });
        if (satisfactionCounts[SatisfactionLevel.VERY_SATISFIED] > 2) recs.push({ id: 'testimonials', icon: <SmileIcon className="w-5 h-5 text-emerald-400" />, bg: 'bg-emerald-500/10 border-emerald-500/20', title: 'Manfaatkan Testimoni Positif', text: 'Banyak ulasan sangat puas. Minta izin untuk dipublikasikan di sosial media.' });
        if (satisfactionCounts[SatisfactionLevel.NEUTRAL] > 0) recs.push({ id: 'analyze', icon: <MehIcon className="w-5 h-5 text-amber-400" />, bg: 'bg-amber-500/10 border-amber-500/20', title: 'Analisis Masukan Netral', text: 'Pelajari masukan netral untuk menemukan area yang bisa ditingkatkan.' });
        return recs;
    }, [satisfactionCounts]);

    const regionDonutData = useMemo(() => {
        const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f43f5e', '#a855f7', '#14b8a6'];
        // Use clients instead of leads for region distribution, extract city name
        const distribution = filteredClients.reduce((acc, c) => {
            const city = extractCityFromAddress(c.address || '');
            acc[city] = (acc[city] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(distribution).sort(([, a], [, b]) => Number(b) - Number(a)).map(([label, value], idx) => ({ label, value, color: palette[idx % palette.length] }));
    }, [filteredClients]);

    const regionDistributionData = useMemo(() => {
        const distribution = filteredClients.reduce((acc, c) => {
            const city = extractCityFromAddress(c.address || '');
            acc[city] = (acc[city] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const totalCount = Object.values(distribution).reduce((sum, count) => sum + count, 0);

        return Object.entries(distribution)
            .sort(([, a], [, b]) => Number(b) - Number(a))
            .map(([name, count]) => ({
                name,
                count,
                percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
            }));
    }, [filteredClients]);

    const leadStatusCounts = useMemo(() => ({
        discussion: filteredLeads.filter(l => l.status === LeadStatus.DISCUSSION).length,
        followUp: filteredLeads.filter(l => l.status === LeadStatus.FOLLOW_UP).length,
        converted: filteredLeads.filter(l => l.status === LeadStatus.CONVERTED).length,
        rejected: filteredLeads.filter(l => l.status === LeadStatus.REJECTED).length,
    }), [filteredLeads]);

    const activeClientsList = useMemo(() => clients.filter(c => c.status === ClientStatus.ACTIVE), [clients]);

    // Client growth trend data (last 6 months)
    const clientGrowthData = useMemo(() => {
        const months = [];
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

        // Use all clients (not filtered) for growth trend to show historical data
        const allClientsForGrowth = clients;

        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            const monthName = monthNames[date.getMonth()];
            const year = date.getFullYear();
            const monthIndex = date.getMonth();

            const clientsInMonth = allClientsForGrowth.filter(c => {
                const clientDate = new Date(c.since);
                return clientDate.getMonth() === monthIndex && clientDate.getFullYear() === year;
            }).length;

            months.push({ name: `${monthName} ${year}`, count: clientsInMonth });
        }

        return months;
    }, [clients]);

    // Client status distribution
    const clientStatusDistribution = useMemo(() => {
        const distribution = filteredClients.reduce((acc, c) => {
            acc[c.status] = (acc[c.status] || 0) + 1;
            return acc;
        }, {} as Record<ClientStatus, number>);

        const statusColors: Record<ClientStatus, string> = {
            [ClientStatus.ACTIVE]: '#10b981',
            [ClientStatus.INACTIVE]: '#64748b',
            [ClientStatus.LEAD]: '#3b82f6',
            [ClientStatus.LOST]: '#ef4444',
        };

        return Object.entries(distribution).map(([label, value]) => ({
            label,
            value,
            color: statusColors[label as ClientStatus] || '#9ca3af',
        }));
    }, [filteredClients]);

    // Top 10 clients by total value
    const topClientsByValue = useMemo(() => {
        const clientValues = filteredClients.map(client => ({
            ...client,
            totalValue: filteredProjects.filter(p => p.clientId === client.id).reduce((sum, p) => sum + p.totalCost, 0),
        }));

        return clientValues
            .sort((a, b) => b.totalValue - a.totalValue)
            .slice(0, 10);
    }, [filteredClients, filteredProjects]);

    // Export functionality
    const handleExportToCSV = () => {
        const headers = ['Nama', 'Email', 'Telepon', 'Status', 'Terdaftar', 'Total Nilai'];
        const rows = filteredClients.map(client => {
            const totalValue = filteredProjects.filter(p => p.clientId === client.id).reduce((sum, p) => sum + p.totalCost, 0);
            return [
                client.name,
                client.email,
                client.phone,
                client.status,
                new Date(client.since).toLocaleDateString('id-ID'),
                formatCurrency(totalValue),
            ];
        });

        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `laporan-pengantin-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        showNotification('Laporan berhasil diexport ke CSV');
    };

    const feedbackFormUrl = useMemo(() => `${window.location.origin}${window.location.pathname}#/feedback`, []);
    const copyToClipboard = () => {
        navigator.clipboard.writeText(feedbackFormUrl).then(() => { showNotification('Tautan berhasil disalin!'); setIsShareModalOpen(false); }, () => alert('Gagal menyalin tautan.'));
    };

    const handleManualFeedbackChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setManualFeedbackForm(prev => ({ ...prev, [name]: name === 'rating' ? Number(value) : value }));
    };

    const getSatisfactionFromRating = (rating: number): SatisfactionLevel => {
        if (rating >= 5) return SatisfactionLevel.VERY_SATISFIED;
        if (rating >= 4) return SatisfactionLevel.SATISFIED;
        if (rating >= 3) return SatisfactionLevel.NEUTRAL;
        return SatisfactionLevel.UNSATISFIED;
    };

    const handleManualFeedbackSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newFeedback: ClientFeedback = {
            id: crypto.randomUUID(), date: new Date().toISOString(),
            clientName: manualFeedbackForm.clientName, rating: manualFeedbackForm.rating,
            satisfaction: getSatisfactionFromRating(manualFeedbackForm.rating),
            feedback: manualFeedbackForm.feedback,
        };
        setFeedback(prev => [newFeedback, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setIsFeedbackModalOpen(false);
        setManualFeedbackForm(emptyFeedbackForm);
        showNotification('Masukan berhasil ditambahkan.');
    };

    const modalTitles: Record<string, string> = {
        total: 'Daftar Semua Pengantin',
        active: 'Daftar Pengantin Aktif',
        'direct-vendor': 'Rekap Pengantin Langsung vs Vendor',
        'top-cities': 'Rekap Pengantin Berdasarkan Daerah & Kota',
        'top-packages': 'Rekap Pilihan Paket Layanan & Pricelist',
        'top-team': 'Rekap Kinerja Job & Pembayaran Tim',
        'lead-conversion': 'Rekap Leads & Konversi Menjadi Pengantin',
        'very-satisfied': 'Masukan: Sangat Puas',
        satisfied: 'Masukan: Puas',
        neutral: 'Masukan: Biasa Saja',
        unsatisfied: 'Masukan: Tidak Puas',
    };

    let modalContent: React.ReactNode = null;
    if (activeStatModal) {
        if (activeStatModal === 'total' || activeStatModal === 'active') {
            const list = activeStatModal === 'total' ? filteredClients : activeClientsList;
            modalContent = (
                <div className="space-y-2">
                    {list.length > 0 ? list.map(client => {
                        const totalVal = filteredProjects.filter(p => p.clientId === client.id).reduce((sum, p) => sum + p.totalCost, 0);
                        const isDirect = client.clientType === ClientType.DIRECT || client.clientType === 'Langsung' || (!client.clientType);
                        return (
                            <div key={client.id} className="p-3 bg-brand-bg rounded-xl flex justify-between items-center border border-brand-border/50 hover:border-brand-border transition-colors">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-brand-text-light">{client.name}</p>
                                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${isDirect ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400'}`}>
                                            {isDirect ? 'Langsung' : 'Vendor'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-brand-text-secondary mt-0.5">{client.email} · {extractCityFromAddress(client.address || '')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-brand-accent tabular-nums">{formatCurrency(totalVal)}</p>
                                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${client.status === ClientStatus.ACTIVE ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>{client.status}</span>
                                </div>
                            </div>
                        );
                    }) : <p className="text-center text-brand-text-secondary py-10">Tidak ada pengantin dalam periode ini.</p>}
                </div>
            );
        } else if (activeStatModal === 'direct-vendor') {
            modalContent = (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-emerald-400">Pengantin Langsung (Direct)</span>
                                <span className="text-xs font-bold text-emerald-300 tabular-nums">{directShare}%</span>
                            </div>
                            <p className="text-2xl font-black text-brand-text-light mt-1 tabular-nums">{directClients.length} <span className="text-xs font-normal text-brand-text-secondary">klien</span></p>
                            <p className="text-xs text-brand-text-secondary mt-1">Total Omzet: <span className="font-semibold text-emerald-400 tabular-nums">{formatCurrency(directRevenue)}</span></p>
                            <p className="text-xs text-brand-text-secondary">Rata-rata: <span className="font-semibold text-brand-text-light tabular-nums">{formatCurrency(avgDirectRevenue)}</span></p>
                        </div>
                        <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-sky-400">Pengantin Vendor (Partner)</span>
                                <span className="text-xs font-bold text-sky-300 tabular-nums">{vendorShare}%</span>
                            </div>
                            <p className="text-2xl font-black text-brand-text-light mt-1 tabular-nums">{vendorClients.length} <span className="text-xs font-normal text-brand-text-secondary">klien</span></p>
                            <p className="text-xs text-brand-text-secondary mt-1">Total Omzet: <span className="font-semibold text-sky-400 tabular-nums">{formatCurrency(vendorRevenue)}</span></p>
                            <p className="text-xs text-brand-text-secondary">Rata-rata: <span className="font-semibold text-brand-text-light tabular-nums">{formatCurrency(avgVendorRevenue)}</span></p>
                        </div>
                    </div>
                    <div className="space-y-2 mt-4">
                        <h5 className="text-xs font-bold text-brand-text-light uppercase tracking-wider">Daftar Pengantin Langsung vs Vendor</h5>
                        <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                            {filteredClients.map(client => {
                                const isDirect = client.clientType === ClientType.DIRECT || client.clientType === 'Langsung' || (!client.clientType);
                                const totalVal = filteredProjects.filter(p => p.clientId === client.id).reduce((sum, p) => sum + p.totalCost, 0);
                                return (
                                    <div key={client.id} className="p-3 bg-brand-bg rounded-xl flex items-center justify-between border border-brand-border/40">
                                        <div className="min-w-0 flex-1 pr-3">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-sm text-brand-text-light truncate">{client.name}</p>
                                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${isDirect ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'}`}>
                                                    {isDirect ? 'Langsung' : 'Vendor'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-brand-text-secondary truncate mt-0.5">{client.email} · {extractCityFromAddress(client.address || '')}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-bold text-sm text-brand-accent tabular-nums">{formatCurrency(totalVal)}</p>
                                            <p className="text-[10px] text-brand-text-secondary">{new Date(client.since).toLocaleDateString('id-ID')}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        } else if (activeStatModal === 'top-cities') {
            modalContent = (
                <div className="space-y-3">
                    <p className="text-xs text-brand-text-secondary">Peringkat kota/daerah berdasarkan jumlah pengantin dan kontribusi omzet acara.</p>
                    <div className="overflow-x-auto rounded-xl border border-brand-border/50">
                        <table className="w-full text-sm">
                            <thead className="bg-brand-bg/80 text-xs text-brand-text-secondary">
                                <tr>
                                    <th className="p-3 text-center w-10">#</th>
                                    <th className="p-3 text-left">Nama Daerah / Kota</th>
                                    <th className="p-3 text-center">Jumlah Pengantin</th>
                                    <th className="p-3 text-center">Total Proyek</th>
                                    <th className="p-3 text-right">Total Nilai Acara</th>
                                    <th className="p-3 text-right">Share %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-border/30 text-xs">
                                {cityStats.map((city, idx) => (
                                    <tr key={city.name} className="hover:bg-brand-bg/40">
                                        <td className="p-3 text-center font-bold text-brand-text-secondary">{idx + 1}</td>
                                        <td className="p-3 font-semibold text-brand-text-light">{city.name}</td>
                                        <td className="p-3 text-center font-bold text-brand-text-primary tabular-nums">{city.clientCount}</td>
                                        <td className="p-3 text-center text-brand-text-secondary tabular-nums">{city.projectCount}</td>
                                        <td className="p-3 text-right font-bold text-brand-accent tabular-nums">{formatCurrency(city.totalRevenue)}</td>
                                        <td className="p-3 text-right text-brand-text-secondary tabular-nums">{city.percentage.toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        } else if (activeStatModal === 'top-packages') {
            modalContent = (
                <div className="space-y-3">
                    <p className="text-xs text-brand-text-secondary">Rekap paket layanan yang paling sering dipilih pengantin beserta pricelist dan omzetnya.</p>
                    <div className="overflow-x-auto rounded-xl border border-brand-border/50">
                        <table className="w-full text-sm">
                            <thead className="bg-brand-bg/80 text-xs text-brand-text-secondary">
                                <tr>
                                    <th className="p-3 text-center w-10">#</th>
                                    <th className="p-3 text-left">Nama Paket</th>
                                    <th className="p-3 text-left">Kategori</th>
                                    <th className="p-3 text-right">Pricelist Standar</th>
                                    <th className="p-3 text-center">Pesanan</th>
                                    <th className="p-3 text-right">Total Omzet</th>
                                    <th className="p-3 text-right">Kontribusi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-border/30 text-xs">
                                {packageStats.map((pkg, idx) => (
                                    <tr key={pkg.name} className="hover:bg-brand-bg/40">
                                        <td className="p-3 text-center font-bold text-brand-text-secondary">{idx + 1}</td>
                                        <td className="p-3 font-semibold text-brand-text-light">{pkg.name}</td>
                                        <td className="p-3 text-brand-text-secondary">{pkg.category}</td>
                                        <td className="p-3 text-right text-brand-text-secondary tabular-nums">{formatCurrency(pkg.pricelistPrice)}</td>
                                        <td className="p-3 text-center font-bold text-brand-text-primary tabular-nums">{pkg.orderCount}x</td>
                                        <td className="p-3 text-right font-bold text-brand-accent tabular-nums">{formatCurrency(pkg.totalOmzet)}</td>
                                        <td className="p-3 text-right text-brand-text-secondary tabular-nums">{pkg.revenueContribution.toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        } else if (activeStatModal === 'top-team') {
            modalContent = (
                <div className="space-y-3">
                    <p className="text-xs text-brand-text-secondary">Kinerja anggota tim fotografi, videografi, dan kru dengan jumlah job dan total pembayaran honor terbanyak.</p>
                    <div className="overflow-x-auto rounded-xl border border-brand-border/50">
                        <table className="w-full text-sm">
                            <thead className="bg-brand-bg/80 text-xs text-brand-text-secondary">
                                <tr>
                                    <th className="p-3 text-center w-10">#</th>
                                    <th className="p-3 text-left">Nama Kru / Tim</th>
                                    <th className="p-3 text-left">Role & Kategori</th>
                                    <th className="p-3 text-center">Jumlah Job</th>
                                    <th className="p-3 text-right">Total Honor</th>
                                    <th className="p-3 text-right">Terbayar</th>
                                    <th className="p-3 text-right">Sisa Belum Bayar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-border/30 text-xs">
                                {teamStats.map((member, idx) => (
                                    <tr key={member.name} className="hover:bg-brand-bg/40">
                                        <td className="p-3 text-center font-bold text-brand-text-secondary">{idx + 1}</td>
                                        <td className="p-3 font-semibold text-brand-text-light">{member.name}</td>
                                        <td className="p-3 text-brand-text-secondary">{member.role} ({member.category})</td>
                                        <td className="p-3 text-center font-bold text-brand-text-primary tabular-nums">{member.jobCount} job</td>
                                        <td className="p-3 text-right font-bold text-brand-accent tabular-nums">{formatCurrency(member.totalFee)}</td>
                                        <td className="p-3 text-right text-emerald-400 font-semibold tabular-nums">{formatCurrency(member.paidFee)}</td>
                                        <td className="p-3 text-right text-amber-400 font-semibold tabular-nums">{formatCurrency(member.unpaidFee)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        } else if (activeStatModal === 'lead-conversion') {
            modalContent = (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
                            <p className="text-xs text-blue-400 font-medium">Sedang Diskusi</p>
                            <p className="text-xl font-bold text-brand-text-light tabular-nums mt-1">{leadConversionStats.discussion}</p>
                        </div>
                        <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl text-center">
                            <p className="text-xs text-violet-400 font-medium">Follow Up</p>
                            <p className="text-xl font-bold text-brand-text-light tabular-nums mt-1">{leadConversionStats.followUp}</p>
                        </div>
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                            <p className="text-xs text-emerald-400 font-medium">Dikonversi</p>
                            <p className="text-xl font-bold text-brand-text-light tabular-nums mt-1">{leadConversionStats.converted}</p>
                        </div>
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                            <p className="text-xs text-red-400 font-medium">Ditolak</p>
                            <p className="text-xl font-bold text-brand-text-light tabular-nums mt-1">{leadConversionStats.rejected}</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h5 className="text-xs font-bold text-brand-text-light uppercase tracking-wider">Performa Channel Promosi</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {leadConversionStats.channels.map(ch => (
                                <div key={ch.channel} className="p-3 bg-brand-bg rounded-xl border border-brand-border/40 flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-xs text-brand-text-light">{ch.channel}</p>
                                        <p className="text-[10px] text-brand-text-secondary">{ch.converted} dari {ch.total} leads dikonversi</p>
                                    </div>
                                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-400 tabular-nums">
                                        {ch.rate}% Konversi
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        } else {
            const lvl = activeStatModal === 'very-satisfied' ? SatisfactionLevel.VERY_SATISFIED : activeStatModal === 'satisfied' ? SatisfactionLevel.SATISFIED : activeStatModal === 'neutral' ? SatisfactionLevel.NEUTRAL : SatisfactionLevel.UNSATISFIED;
            const list = feedbackBySatisfaction[lvl] || [];
            modalContent = (
                <div className="space-y-3">
                    {list.length > 0 ? list.map(fb => (
                        <div key={fb.id} className="p-3 bg-brand-bg rounded-xl border border-brand-border/50">
                            <div className="flex justify-between items-center mb-2">
                                <p className="font-semibold text-brand-text-light">{fb.clientName}</p>
                                <StarRatingDisplay rating={fb.rating} size="sm" />
                            </div>
                            <p className="text-sm text-brand-text-primary italic">"{fb.feedback}"</p>
                            <p className="text-right text-xs text-brand-text-secondary mt-2">{new Date(fb.date).toLocaleDateString('id-ID')}</p>
                        </div>
                    )) : <p className="text-center text-brand-text-secondary py-10">Tidak ada masukan dalam kategori ini.</p>}
                </div>
            );
        }
    }

    const satisfactionConfig = [
        { key: 'very-satisfied' as const, level: SatisfactionLevel.VERY_SATISFIED, label: 'Sangat Puas', icon: <SmileIcon className="w-5 h-5" />, colorVariant: 'green' as const, barColor: 'bg-emerald-500', count: satisfactionCounts[SatisfactionLevel.VERY_SATISFIED] },
        { key: 'satisfied' as const, level: SatisfactionLevel.SATISFIED, label: 'Puas', icon: <ThumbsUpIcon className="w-5 h-5" />, colorVariant: 'blue' as const, barColor: 'bg-sky-500', count: satisfactionCounts[SatisfactionLevel.SATISFIED] },
        { key: 'neutral' as const, level: SatisfactionLevel.NEUTRAL, label: 'Biasa Saja', icon: <MehIcon className="w-5 h-5" />, colorVariant: 'orange' as const, barColor: 'bg-amber-500', count: satisfactionCounts[SatisfactionLevel.NEUTRAL] },
        { key: 'unsatisfied' as const, level: SatisfactionLevel.UNSATISFIED, label: 'Tidak Puas', icon: <FrownIcon className="w-5 h-5" />, colorVariant: 'red' as const, barColor: 'bg-red-500', count: satisfactionCounts[SatisfactionLevel.UNSATISFIED] },
    ];

    const leadStatusConfig = [
        { label: 'Sedang Diskusi', count: leadStatusCounts.discussion, color: '#3b82f6', bg: 'bg-blue-500/15', border: 'border-blue-500/25', text: 'text-blue-400', icon: <EyeIcon className="w-4 h-4" /> },
        { label: 'Follow Up', count: leadStatusCounts.followUp, color: '#8b5cf6', bg: 'bg-violet-500/15', border: 'border-violet-500/25', text: 'text-violet-400', icon: <ChevronRightIcon className="w-4 h-4" /> },
        { label: 'Dikonversi', count: leadStatusCounts.converted, color: '#10b981', bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', text: 'text-emerald-400', icon: <CheckCircleIcon className="w-4 h-4" /> },
        { label: 'Ditolak', count: leadStatusCounts.rejected, color: '#ef4444', bg: 'bg-red-500/15', border: 'border-red-500/25', text: 'text-red-400', icon: <Trash2Icon className="w-4 h-4" /> },
    ];

    return (
        <div className="space-y-6 pb-8">
            {/* ── Page Header ── */}
            <PageHeader
                title="Laporan Pengantin"
                subtitle="Analisis terpusat untuk performa akuisisi, konversi, dan kepuasan pengantin Anda."
            />

            {/* ── Date Filter & Presets ── */}
            <MobileCollapsibleSection
                title="Filter Periode Laporan"
                subtitle={dateFrom || dateTo ? `${dateFrom || '...'} s/d ${dateTo || '...'}` : 'Semua periode waktu'}
                badge={dateFrom || dateTo ? 'Aktif' : 'Semua'}
            >
                <div className="bg-brand-surface rounded-2xl border border-brand-border p-4 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-brand-text-secondary shrink-0">
                            <CalendarIcon className="w-4 h-4 text-brand-accent" />
                            Pilih Periode:
                        </div>
                        {/* Preset Quick Buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                onClick={() => handleSetDatePreset('all')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${activePreset === 'all' && !dateFrom && !dateTo ? 'bg-brand-accent text-white' : 'bg-brand-bg text-brand-text-secondary hover:text-brand-text-primary border border-brand-border/60'}`}
                            >
                                Semua Waktu
                            </button>
                            <button
                                onClick={() => handleSetDatePreset('this-month')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${activePreset === 'this-month' ? 'bg-brand-accent text-white' : 'bg-brand-bg text-brand-text-secondary hover:text-brand-text-primary border border-brand-border/60'}`}
                            >
                                Bulan Ini
                            </button>
                            <button
                                onClick={() => handleSetDatePreset('this-quarter')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${activePreset === 'this-quarter' ? 'bg-brand-accent text-white' : 'bg-brand-bg text-brand-text-secondary hover:text-brand-text-primary border border-brand-border/60'}`}
                            >
                                Kuartal Ini
                            </button>
                            <button
                                onClick={() => handleSetDatePreset('this-year')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${activePreset === 'this-year' ? 'bg-brand-accent text-white' : 'bg-brand-bg text-brand-text-secondary hover:text-brand-text-primary border border-brand-border/60'}`}
                            >
                                Tahun Ini
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-brand-border/40">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input type="date" value={dateFrom} onChange={e => { setActivePreset('all'); handleDateChange(e.target.value, dateTo); }} className="input-field !rounded-xl !border !bg-brand-bg p-2 text-xs flex-1 sm:flex-none" />
                            <span className="text-brand-text-secondary text-sm font-medium">–</span>
                            <input type="date" value={dateTo} onChange={e => { setActivePreset('all'); handleDateChange(dateFrom, e.target.value); }} className="input-field !rounded-xl !border !bg-brand-bg p-2 text-xs flex-1 sm:flex-none" />
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            {(dateFrom || dateTo) && (
                                <button onClick={() => { setActivePreset('all'); handleDateChange('', ''); }} className="button-secondary text-xs px-3 py-1.5 shrink-0">
                                    Reset Filter
                                </button>
                            )}
                            <button onClick={handleExportToCSV} className="button-primary text-xs px-3 py-1.5 shrink-0 inline-flex items-center gap-1.5">
                                <DownloadIcon className="w-3.5 h-3.5" /> Export CSV
                            </button>
                        </div>
                    </div>
                </div>
            </MobileCollapsibleSection>

            {/* ── 6 Modern Startcards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {/* 1. Langsung vs Vendor */}
                <div className="cursor-pointer transition-transform hover:-translate-y-0.5" onClick={() => { setActiveReportTab('tipe'); setActiveStatModal('direct-vendor'); }}>
                    <ModernStatCard
                        icon={<UsersIcon className="w-5 h-5" />}
                        title="Tipe Pengantin"
                        value={`${directClients.length} vs ${vendorClients.length}`}
                        iconColorVariant="primary"
                        subtitle={`${directShare}% Langsung · ${vendorShare}% Vendor`}
                    />
                </div>
                {/* 2. Kota Terbanyak */}
                <div className="cursor-pointer transition-transform hover:-translate-y-0.5" onClick={() => { setActiveReportTab('daerah'); setActiveStatModal('top-cities'); }}>
                    <ModernStatCard
                        icon={<MapPinIcon className="w-5 h-5" />}
                        title="Kota Terbanyak"
                        value={topCity.name}
                        iconColorVariant="success"
                        subtitle={`${topCity.clientCount} pengantin (${topCity.percentage.toFixed(0)}%)`}
                    />
                </div>
                {/* 3. Paket Terlaris */}
                <div className="cursor-pointer transition-transform hover:-translate-y-0.5" onClick={() => { setActiveReportTab('paket'); setActiveStatModal('top-packages'); }}>
                    <ModernStatCard
                        icon={<PackageIcon className="w-5 h-5" />}
                        title="Paket Terlaris"
                        value={topPackage.name}
                        iconColorVariant="warning"
                        subtitle={`${topPackage.orderCount}x pesanan · ${formatCurrency(topPackage.pricelistPrice)}`}
                    />
                </div>
                {/* 4. Top Tim */}
                <div className="cursor-pointer transition-transform hover:-translate-y-0.5" onClick={() => { setActiveReportTab('tim'); setActiveStatModal('top-team'); }}>
                    <ModernStatCard
                        icon={<BriefcaseIcon className="w-5 h-5" />}
                        title="Top Tim (Job & Fee)"
                        value={topTeamJob.name}
                        iconColorVariant="secondary"
                        subtitle={`${topTeamJob.jobCount} job · Honor: ${formatCurrency(topTeamPayment.totalFee)}`}
                    />
                </div>
                {/* 5. Leads Konversi */}
                <div className="cursor-pointer transition-transform hover:-translate-y-0.5" onClick={() => { setActiveReportTab('leads'); setActiveStatModal('lead-conversion'); }}>
                    <ModernStatCard
                        icon={<TargetIcon className="w-5 h-5" />}
                        title="Leads → Pengantin"
                        value={`${leadConversionStats.converted} dari ${leadConversionStats.total}`}
                        iconColorVariant="primary"
                        subtitle={`Konversi: ${leadConversionStats.rate}% · ${leadConversionStats.discussion} Diskusi`}
                    />
                </div>
                {/* 6. Total Nilai Acara */}
                <div className="cursor-pointer transition-transform hover:-translate-y-0.5" onClick={() => { setActiveReportTab('ringkasan'); setActiveStatModal('total'); }}>
                    <ModernStatCard
                        icon={<DollarSignIcon className="w-5 h-5" />}
                        title="Total Nilai Acara"
                        value={formatCurrency(totalRevenue)}
                        iconColorVariant="success"
                        subtitle={`Avg ${formatCurrency(avgRevenuePerClient)} / klien`}
                    />
                </div>
            </div>

            {/* ── Segmented Tab Switcher for Business Intelligence Rekap ── */}
            <div className="flex items-center gap-1.5 p-1.5 bg-brand-bg rounded-xl border border-brand-border/60 overflow-x-auto scrollbar-none">
                <button
                    onClick={() => setActiveReportTab('ringkasan')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${activeReportTab === 'ringkasan' ? 'bg-brand-surface text-brand-text-light shadow-sm border border-brand-border/60' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}
                >
                    Semua Rekap
                </button>
                <button
                    onClick={() => setActiveReportTab('tipe')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${activeReportTab === 'tipe' ? 'bg-brand-surface text-brand-text-light shadow-sm border border-brand-border/60' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}
                >
                    Langsungan vs Vendor
                </button>
                <button
                    onClick={() => setActiveReportTab('daerah')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${activeReportTab === 'daerah' ? 'bg-brand-surface text-brand-text-light shadow-sm border border-brand-border/60' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}
                >
                    Daerah & Kota ({cityStats.length})
                </button>
                <button
                    onClick={() => setActiveReportTab('paket')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${activeReportTab === 'paket' ? 'bg-brand-surface text-brand-text-light shadow-sm border border-brand-border/60' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}
                >
                    Paket & Pricelist ({packageStats.length})
                </button>
                <button
                    onClick={() => setActiveReportTab('tim')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${activeReportTab === 'tim' ? 'bg-brand-surface text-brand-text-light shadow-sm border border-brand-border/60' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}
                >
                    Performa Tim ({teamStats.length})
                </button>
                <button
                    onClick={() => setActiveReportTab('leads')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${activeReportTab === 'leads' ? 'bg-brand-surface text-brand-text-light shadow-sm border border-brand-border/60' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}
                >
                    Leads & Konversi
                </button>
                <button
                    onClick={() => setActiveReportTab('pengantin')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${activeReportTab === 'pengantin' ? 'bg-brand-surface text-brand-text-light shadow-sm border border-brand-border/60' : 'text-brand-text-secondary hover:text-brand-text-primary'}`}
                >
                    Daftar Pengantin ({searchedAndSortedClients.length})
                </button>
            </div>

            {/* ── VIEW 1: REKAP TIPE (Langsungan vs Vendor) ── */}
            {activeReportTab === 'tipe' && (
                <div className="space-y-4 widget-animate">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-brand-surface rounded-2xl border border-brand-border">
                        <div>
                            <h3 className="text-base font-bold text-brand-text-light flex items-center gap-2">
                                <UsersIcon className="w-5 h-5 text-brand-accent" />
                                Rekap & Data: Pengantin Langsung vs Vendor
                            </h3>
                            <p className="text-xs text-brand-text-secondary mt-0.5">
                                Analisis perbandingan pengantin langsung (direct) vs rujukan vendor/WO, nilai transaksi, dan rincian data klien.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setClientTypeFilter('all')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${clientTypeFilter === 'all' ? 'bg-brand-accent text-white' : 'bg-brand-bg text-brand-text-secondary border border-brand-border/60'}`}
                            >
                                Semua ({filteredClients.length})
                            </button>
                            <button
                                onClick={() => setClientTypeFilter('direct')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${clientTypeFilter === 'direct' ? 'bg-emerald-600 text-white' : 'bg-brand-bg text-brand-text-secondary border border-brand-border/60'}`}
                            >
                                Langsung ({directClients.length})
                            </button>
                            <button
                                onClick={() => setClientTypeFilter('vendor')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${clientTypeFilter === 'vendor' ? 'bg-sky-600 text-white' : 'bg-brand-bg text-brand-text-secondary border border-brand-border/60'}`}
                            >
                                Vendor ({vendorClients.length})
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                            <div className="flex justify-between items-start">
                                <p className="text-xs font-semibold text-emerald-400">Pengantin Langsung</p>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">{directShare}% Total</span>
                            </div>
                            <p className="text-2xl font-bold text-brand-text-light mt-2">{directClients.length} <span className="text-xs font-normal text-brand-text-secondary">pengantin</span></p>
                            <p className="text-xs text-brand-text-secondary mt-1">Omzet: <span className="font-semibold text-emerald-400">{formatCurrency(directRevenue)}</span> ({directRevenueShare}%)</p>
                            <p className="text-[11px] text-brand-text-secondary mt-0.5">Rata-rata: {formatCurrency(avgDirectRevenue)} / acara</p>
                        </div>

                        <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-2xl">
                            <div className="flex justify-between items-start">
                                <p className="text-xs font-semibold text-sky-400">Pengantin Vendor / WO</p>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold">{vendorShare}% Total</span>
                            </div>
                            <p className="text-2xl font-bold text-brand-text-light mt-2">{vendorClients.length} <span className="text-xs font-normal text-brand-text-secondary">pengantin</span></p>
                            <p className="text-xs text-brand-text-secondary mt-1">Omzet: <span className="font-semibold text-sky-400">{formatCurrency(vendorRevenue)}</span> ({vendorRevenueShare}%)</p>
                            <p className="text-[11px] text-brand-text-secondary mt-0.5">Rata-rata: {formatCurrency(avgVendorRevenue)} / acara</p>
                        </div>

                        <div className="p-4 bg-brand-surface border border-brand-border rounded-2xl">
                            <p className="text-xs font-semibold text-brand-text-secondary">Total Seluruh Acara</p>
                            <p className="text-2xl font-bold text-brand-accent mt-2">{filteredProjects.length} <span className="text-xs font-normal text-brand-text-secondary">proyek</span></p>
                            <p className="text-xs text-brand-text-secondary mt-1">Total Omzet: <span className="font-semibold text-brand-text-light">{formatCurrency(totalRevenue)}</span></p>
                            <p className="text-[11px] text-brand-text-secondary mt-0.5">Rata-rata: {formatCurrency(avgRevenuePerClient)} / klien</p>
                        </div>

                        <div className="p-4 bg-brand-surface border border-brand-border rounded-2xl">
                            <p className="text-xs font-semibold text-brand-text-secondary">Analisis Akuisisi</p>
                            <p className="text-2xl font-bold text-emerald-400 mt-2">{directClients.length >= vendorClients.length ? 'Direct Lebih Banyak' : 'Vendor Lebih Banyak'}</p>
                            <p className="text-xs text-brand-text-secondary mt-1">Direct: Margin optimal tanpa potongan mitra</p>
                            <p className="text-[11px] text-brand-text-secondary mt-0.5">Vendor: Volume kerja sama dengan WO</p>
                        </div>
                    </div>

                    <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
                        <div className="p-4 border-b border-brand-border flex items-center justify-between">
                            <h4 className="text-sm font-bold text-brand-text-light">
                                Rincian Pengantin ({clientTypeFilter === 'all' ? 'Semua Tipe' : clientTypeFilter === 'direct' ? 'Langsung' : 'Vendor'})
                            </h4>
                            <span className="text-xs text-brand-text-secondary">{searchedAndSortedClients.length} data ditemukan</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-brand-bg/70 text-brand-text-secondary border-b border-brand-border/60">
                                    <tr>
                                        <th className="p-3 font-semibold">Pengantin</th>
                                        <th className="p-3 font-semibold">Tipe</th>
                                        <th className="p-3 font-semibold">Kota / Daerah</th>
                                        <th className="p-3 font-semibold">Paket Acara</th>
                                        <th className="p-3 font-semibold text-right">Nilai Total</th>
                                        <th className="p-3 font-semibold">Status Bayar</th>
                                        <th className="p-3 font-semibold">Tanggal Daftar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-border/30">
                                    {searchedAndSortedClients.map(c => {
                                        const isDirect = c.clientType === ClientType.DIRECT || c.clientType === 'Langsung' || (!c.clientType);
                                        const cProjects = filteredProjects.filter(p => p.clientId === c.id);
                                        const totalVal = cProjects.reduce((sum, p) => sum + p.totalCost, 0);
                                        const pkgName = cProjects[0]?.packageName || '-';
                                        const payStatus = cProjects[0]?.paymentStatus || '-';
                                        return (
                                            <tr key={c.id} className="hover:bg-brand-bg/40 transition-colors">
                                                <td className="p-3">
                                                    <p className="font-bold text-brand-text-light">{c.name}</p>
                                                    <p className="text-[11px] text-brand-text-secondary">{c.phone || c.email || '-'}</p>
                                                </td>
                                                <td className="p-3">
                                                    <span className={`inline-block px-2.5 py-0.5 rounded-md font-semibold text-[10px] ${isDirect ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'}`}>
                                                        {isDirect ? 'Langsung' : 'Vendor'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-brand-text-secondary">
                                                    {extractCityFromAddress(c.address || c.homeAddress || '')}
                                                </td>
                                                <td className="p-3 font-medium text-brand-text-light">
                                                    {pkgName}
                                                </td>
                                                <td className="p-3 text-right font-bold text-brand-accent tabular-nums">
                                                    {formatCurrency(totalVal)}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${payStatus === PaymentStatus.LUNAS ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {payStatus}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-brand-text-secondary tabular-nums">
                                                    {c.since ? new Date(c.since).toLocaleDateString('id-ID') : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {searchedAndSortedClients.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-brand-text-secondary">
                                                Tidak ada data pengantin untuk filter ini.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── VIEW 2: REKAP DAERAH & KOTA ── */}
            {activeReportTab === 'daerah' && (
                <div className="space-y-4 widget-animate">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-brand-surface rounded-2xl border border-brand-border">
                        <div>
                            <h3 className="text-base font-bold text-brand-text-light flex items-center gap-2">
                                <MapPinIcon className="w-5 h-5 text-brand-accent" />
                                Rekap & Data: Sebaran Daerah & Kota Pengantin
                            </h3>
                            <p className="text-xs text-brand-text-secondary mt-0.5">
                                Menampilkan perbandingan jumlah pengantin & calon pengantin (leads) di setiap kota, total omzet, dan rincian klien per kota.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-3 py-1.5 bg-brand-bg rounded-lg border border-brand-border/60 text-brand-text-secondary">
                                {cityStats.length} Kota Terdata
                            </span>
                        </div>
                    </div>

                    {/* Quick City Filter Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                        <button
                            onClick={() => setCityFilter('all')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap ${cityFilter === 'all' ? 'bg-brand-accent text-white' : 'bg-brand-surface text-brand-text-secondary hover:text-brand-text-primary border border-brand-border'}`}
                        >
                            Semua Kota ({filteredClients.length} Pengantin)
                        </button>
                        {cityStats.map(c => (
                            <button
                                key={c.name}
                                onClick={() => setCityFilter(c.name)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap flex items-center gap-1.5 ${cityFilter === c.name ? 'bg-brand-accent text-white' : 'bg-brand-surface text-brand-text-secondary hover:text-brand-text-primary border border-brand-border'}`}
                            >
                                <MapPinIcon className="w-3 h-3" />
                                {c.name} ({c.clientCount} Pengantin{c.leadCount > 0 ? `, ${c.leadCount} Calon` : ''})
                            </button>
                        ))}
                    </div>

                    {/* City Table */}
                    <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
                        <div className="p-4 border-b border-brand-border">
                            <h4 className="text-sm font-bold text-brand-text-light">
                                Peringkat Kota / Daerah Pengantin & Calon Pengantin
                            </h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-brand-bg/70 text-brand-text-secondary border-b border-brand-border/60">
                                    <tr>
                                        <th className="p-3 text-center w-12">#</th>
                                        <th className="p-3 font-semibold">Nama Daerah / Kota</th>
                                        <th className="p-3 font-semibold text-center">Pengantin (Client)</th>
                                        <th className="p-3 font-semibold text-center">Calon Pengantin (Leads)</th>
                                        <th className="p-3 font-semibold text-center">Total Acara</th>
                                        <th className="p-3 font-semibold text-right">Total Nilai Acara</th>
                                        <th className="p-3 font-semibold text-right">Share %</th>
                                        <th className="p-3 font-semibold text-center">Filter Kota</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-border/30">
                                    {cityStats.map((city, idx) => (
                                        <tr key={city.name} className={`hover:bg-brand-bg/40 transition-colors ${cityFilter === city.name ? 'bg-brand-accent/5' : ''}`}>
                                            <td className="p-3 text-center font-bold text-brand-text-secondary">{idx + 1}</td>
                                            <td className="p-3 font-bold text-brand-text-light flex items-center gap-2">
                                                <MapPinIcon className="w-3.5 h-3.5 text-brand-accent" />
                                                {city.name}
                                            </td>
                                            <td className="p-3 text-center font-bold text-emerald-400 tabular-nums">
                                                {city.clientCount}
                                            </td>
                                            <td className="p-3 text-center font-bold text-blue-400 tabular-nums">
                                                {city.leadCount}
                                            </td>
                                            <td className="p-3 text-center text-brand-text-secondary tabular-nums">
                                                {city.projectCount}
                                            </td>
                                            <td className="p-3 text-right font-bold text-brand-accent tabular-nums">
                                                {formatCurrency(city.totalRevenue)}
                                            </td>
                                            <td className="p-3 text-right text-brand-text-secondary tabular-nums">
                                                {city.percentage.toFixed(1)}%
                                            </td>
                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={() => setCityFilter(cityFilter === city.name ? 'all' : city.name)}
                                                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${cityFilter === city.name ? 'bg-brand-accent text-white' : 'button-secondary'}`}
                                                >
                                                    {cityFilter === city.name ? 'Aktif' : 'Pilih'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {cityStats.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-brand-text-secondary">
                                                Belum ada data daerah/kota pengantin.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Split cards: Pengantin vs Calon Pengantin in Selected City */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-brand-surface rounded-2xl border border-brand-border p-4">
                            <h4 className="text-sm font-bold text-brand-text-light mb-3 flex items-center justify-between">
                                <span>Pengantin di {cityFilter === 'all' ? 'Semua Kota' : `Kota "${cityFilter}"`}</span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                                    {searchedAndSortedClients.length} pengantin
                                </span>
                            </h4>
                            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                                {searchedAndSortedClients.map(c => {
                                    const cProjects = filteredProjects.filter(p => p.clientId === c.id);
                                    const totalVal = cProjects.reduce((sum, p) => sum + p.totalCost, 0);
                                    return (
                                        <div key={c.id} className="p-3 bg-brand-bg rounded-xl border border-brand-border/40 flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-xs text-brand-text-light">{c.name}</p>
                                                <p className="text-[11px] text-brand-text-secondary">{c.address || c.homeAddress || 'Alamat belum diisi'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-brand-accent">{formatCurrency(totalVal)}</p>
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                                                    {c.clientType || 'Langsung'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {searchedAndSortedClients.length === 0 && (
                                    <p className="text-center text-xs text-brand-text-secondary py-8">Tidak ada pengantin di kota ini.</p>
                                )}
                            </div>
                        </div>

                        <div className="bg-brand-surface rounded-2xl border border-brand-border p-4">
                            <h4 className="text-sm font-bold text-brand-text-light mb-3 flex items-center justify-between">
                                <span>Calon Pengantin (Leads) di {cityFilter === 'all' ? 'Semua Kota' : `Kota "${cityFilter}"`}</span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                                    {filteredLeads.filter(l => cityFilter === 'all' || extractCityFromAddress(l.location || l.address || '') === cityFilter).length} calon
                                </span>
                            </h4>
                            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                                {filteredLeads.filter(l => cityFilter === 'all' || extractCityFromAddress(l.location || l.address || '') === cityFilter).map(l => (
                                    <div key={l.id} className="p-3 bg-brand-bg rounded-xl border border-brand-border/40 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-xs text-brand-text-light">{l.name}</p>
                                            <p className="text-[11px] text-brand-text-secondary">{l.location || l.address || '-'} · Dari {l.contactChannel}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400">
                                                {l.status}
                                            </span>
                                            <p className="text-[10px] text-brand-text-secondary mt-1">{l.whatsapp || '-'}</p>
                                        </div>
                                    </div>
                                ))}
                                {filteredLeads.filter(l => cityFilter === 'all' || extractCityFromAddress(l.location || l.address || '') === cityFilter).length === 0 && (
                                    <p className="text-center text-xs text-brand-text-secondary py-8">Tidak ada calon pengantin di kota ini.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── VIEW 3: REKAP PAKET & PRICELIST ── */}
            {activeReportTab === 'paket' && (
                <div className="space-y-4 widget-animate">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-brand-surface rounded-2xl border border-brand-border">
                        <div>
                            <h3 className="text-base font-bold text-brand-text-light flex items-center gap-2">
                                <PackageIcon className="w-5 h-5 text-brand-accent" />
                                Rekap & Data: Pilihan Paket Layanan & Pricelist
                            </h3>
                            <p className="text-xs text-brand-text-secondary mt-0.5">
                                Analisis penjualan tiap paket wedding, perbandingan harga pricelist resmi dengan omzet riil, dan kontribusi omzet.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-3 py-1.5 bg-brand-bg rounded-lg border border-brand-border/60 text-brand-text-secondary">
                                {packageStats.length} Paket Terdata
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="p-4 bg-brand-surface border border-brand-border rounded-2xl">
                            <p className="text-xs font-semibold text-brand-text-secondary">Paket Terlaris</p>
                            <p className="text-lg font-bold text-brand-text-light mt-1 truncate">{topPackage.name}</p>
                            <p className="text-xs text-emerald-400 font-semibold mt-1">{topPackage.orderCount}x pesanan</p>
                            <p className="text-[11px] text-brand-text-secondary mt-0.5">Omzet: {formatCurrency(topPackage.totalOmzet)}</p>
                        </div>
                        <div className="p-4 bg-brand-surface border border-brand-border rounded-2xl">
                            <p className="text-xs font-semibold text-brand-text-secondary">Total Omzet Paket</p>
                            <p className="text-lg font-bold text-brand-accent mt-1">{formatCurrency(totalRevenue)}</p>
                            <p className="text-xs text-brand-text-secondary mt-1">Dari {filteredProjects.length} total pesanan pengantin</p>
                        </div>
                        <div className="p-4 bg-brand-surface border border-brand-border rounded-2xl">
                            <p className="text-xs font-semibold text-brand-text-secondary">Pricelist Tertinggi</p>
                            <p className="text-lg font-bold text-brand-text-light mt-1">
                                {formatCurrency(Math.max(...packageStats.map(p => p.pricelistPrice), 0))}
                            </p>
                            <p className="text-xs text-brand-text-secondary mt-1">Katalog paket premium</p>
                        </div>
                        <div className="p-4 bg-brand-surface border border-brand-border rounded-2xl">
                            <p className="text-xs font-semibold text-brand-text-secondary">Rata-rata Nilai / Paket</p>
                            <p className="text-lg font-bold text-brand-text-light mt-1">
                                {formatCurrency(filteredProjects.length > 0 ? Math.round(totalRevenue / filteredProjects.length) : 0)}
                            </p>
                            <p className="text-xs text-brand-text-secondary mt-1">Realisasi per transaksi</p>
                        </div>
                    </div>

                    <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
                        <div className="p-4 border-b border-brand-border">
                            <h4 className="text-sm font-bold text-brand-text-light">
                                Tabel Komparasi Paket & Pricelist
                            </h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-brand-bg/70 text-brand-text-secondary border-b border-brand-border/60">
                                    <tr>
                                        <th className="p-3 text-center w-12">#</th>
                                        <th className="p-3 font-semibold">Nama Paket</th>
                                        <th className="p-3 font-semibold">Kategori</th>
                                        <th className="p-3 font-semibold text-right">Pricelist Standar</th>
                                        <th className="p-3 font-semibold text-center">Pesanan</th>
                                        <th className="p-3 font-semibold text-right">Total Omzet</th>
                                        <th className="p-3 font-semibold text-right">Kontribusi Omzet</th>
                                        <th className="p-3 font-semibold text-right">Rata-rata Realisasi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-border/30">
                                    {packageStats.map((pkg, idx) => (
                                        <tr key={pkg.name} className="hover:bg-brand-bg/40 transition-colors">
                                            <td className="p-3 text-center font-bold text-brand-text-secondary">{idx + 1}</td>
                                            <td className="p-3 font-bold text-brand-text-light flex items-center gap-2">
                                                <PackageIcon className="w-3.5 h-3.5 text-brand-accent" />
                                                {pkg.name}
                                            </td>
                                            <td className="p-3 text-brand-text-secondary">{pkg.category}</td>
                                            <td className="p-3 text-right text-brand-text-secondary tabular-nums">{formatCurrency(pkg.pricelistPrice)}</td>
                                            <td className="p-3 text-center font-bold text-brand-text-primary tabular-nums">{pkg.orderCount}x</td>
                                            <td className="p-3 text-right font-bold text-brand-accent tabular-nums">{formatCurrency(pkg.totalOmzet)}</td>
                                            <td className="p-3 text-right text-brand-text-secondary tabular-nums">{pkg.revenueContribution.toFixed(1)}%</td>
                                            <td className="p-3 text-right text-emerald-400 font-semibold tabular-nums">{formatCurrency(pkg.avgRealizedPrice)}</td>
                                        </tr>
                                    ))}
                                    {packageStats.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-brand-text-secondary">
                                                Belum ada data paket dan pricelist.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── VIEW 4: REKAP PERFORMA TIM ── */}
            {activeReportTab === 'tim' && (
                <div className="space-y-4 widget-animate">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-brand-surface rounded-2xl border border-brand-border">
                        <div>
                            <h3 className="text-base font-bold text-brand-text-light flex items-center gap-2">
                                <BriefcaseIcon className="w-5 h-5 text-brand-accent" />
                                Rekap & Data: Kinerja & Pembayaran Honor Tim
                            </h3>
                            <p className="text-xs text-brand-text-secondary mt-0.5">
                                Monitoring beban job kru fotografer/videografer, honor yang telah dibayarkan, dan sisa honor tertunda.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-3 py-1.5 bg-brand-bg rounded-lg border border-brand-border/60 text-brand-text-secondary">
                                {teamStats.length} Anggota Tim Bertugas
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="p-4 bg-brand-surface border border-brand-border rounded-2xl">
                            <p className="text-xs font-semibold text-brand-text-secondary">Job Terbanyak</p>
                            <p className="text-lg font-bold text-brand-text-light mt-1 truncate">{topTeamJob.name}</p>
                            <p className="text-xs text-brand-accent font-semibold mt-1">{topTeamJob.jobCount} job dikerjakan</p>
                            <p className="text-[11px] text-brand-text-secondary mt-0.5">Role: {topTeamJob.role}</p>
                        </div>
                        <div className="p-4 bg-brand-surface border border-brand-border rounded-2xl">
                            <p className="text-xs font-semibold text-brand-text-secondary">Honor Terbanyak</p>
                            <p className="text-lg font-bold text-brand-text-light mt-1 truncate">{topTeamPayment.name}</p>
                            <p className="text-xs text-emerald-400 font-semibold mt-1">Total: {formatCurrency(topTeamPayment.totalFee)}</p>
                            <p className="text-[11px] text-brand-text-secondary mt-0.5">Terbayar: {formatCurrency(topTeamPayment.paidFee)}</p>
                        </div>
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                            <p className="text-xs font-semibold text-emerald-400">Total Honor Terbayar</p>
                            <p className="text-lg font-bold text-brand-text-light mt-1">
                                {formatCurrency(teamStats.reduce((sum, t) => sum + t.paidFee, 0))}
                            </p>
                            <p className="text-xs text-emerald-400 mt-1">Honor lunas</p>
                        </div>
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                            <p className="text-xs font-semibold text-amber-400">Sisa Honor Belum Bayar</p>
                            <p className="text-lg font-bold text-brand-text-light mt-1">
                                {formatCurrency(teamStats.reduce((sum, t) => sum + t.unpaidFee, 0))}
                            </p>
                            <p className="text-xs text-amber-400 mt-1">Menunggu pelunasan acara</p>
                        </div>
                    </div>

                    <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
                        <div className="p-4 border-b border-brand-border">
                            <h4 className="text-sm font-bold text-brand-text-light">
                                Tabel Performa & Pembayaran Honor Kru
                            </h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-brand-bg/70 text-brand-text-secondary border-b border-brand-border/60">
                                    <tr>
                                        <th className="p-3 text-center w-12">#</th>
                                        <th className="p-3 font-semibold">Nama Anggota Tim</th>
                                        <th className="p-3 font-semibold">Peran / Posisi</th>
                                        <th className="p-3 font-semibold text-center">Jumlah Job</th>
                                        <th className="p-3 font-semibold text-right">Total Honor</th>
                                        <th className="p-3 font-semibold text-right">Terbayar</th>
                                        <th className="p-3 font-semibold text-right">Sisa Belum Bayar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-border/30">
                                    {teamStats.map((member, idx) => (
                                        <tr key={member.name} className="hover:bg-brand-bg/40 transition-colors">
                                            <td className="p-3 text-center font-bold text-brand-text-secondary">{idx + 1}</td>
                                            <td className="p-3 font-bold text-brand-text-light flex items-center gap-2">
                                                <BriefcaseIcon className="w-3.5 h-3.5 text-brand-accent" />
                                                {member.name}
                                            </td>
                                            <td className="p-3 text-brand-text-secondary">{member.role} ({member.category})</td>
                                            <td className="p-3 text-center font-bold text-brand-text-primary tabular-nums">{member.jobCount} job</td>
                                            <td className="p-3 text-right font-bold text-brand-accent tabular-nums">{formatCurrency(member.totalFee)}</td>
                                            <td className="p-3 text-right text-emerald-400 font-semibold tabular-nums">{formatCurrency(member.paidFee)}</td>
                                            <td className="p-3 text-right text-amber-400 font-semibold tabular-nums">{formatCurrency(member.unpaidFee)}</td>
                                        </tr>
                                    ))}
                                    {teamStats.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-brand-text-secondary">
                                                Belum ada penugasan tim pada proyek pernikahan dalam periode ini.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── VIEW 5: REKAP LEADS & KONVERSI ── */}
            {activeReportTab === 'leads' && (
                <div className="space-y-4 widget-animate">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-brand-surface rounded-2xl border border-brand-border">
                        <div>
                            <h3 className="text-base font-bold text-brand-text-light flex items-center gap-2">
                                <TargetIcon className="w-5 h-5 text-brand-accent" />
                                Rekap & Data: Calon Pengantin (Leads) & Konversi
                            </h3>
                            <p className="text-xs text-brand-text-secondary mt-0.5">
                                Funnel akuisisi calon pengantin, rasio konversi per channel promosi, dan status tindak lanjut calon klien.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-3 py-1.5 bg-brand-bg rounded-lg border border-brand-border/60 text-brand-text-secondary">
                                {filteredLeads.length} Total Calon Pengantin
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-center">
                            <p className="text-xs font-semibold text-blue-400">Sedang Diskusi</p>
                            <p className="text-2xl font-bold text-brand-text-light mt-1 tabular-nums">{leadConversionStats.discussion}</p>
                            <p className="text-[10px] text-brand-text-secondary mt-1">Konsultasi paket & tanggal</p>
                        </div>
                        <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl text-center">
                            <p className="text-xs font-semibold text-violet-400">Menunggu Follow Up</p>
                            <p className="text-2xl font-bold text-brand-text-light mt-1 tabular-nums">{leadConversionStats.followUp}</p>
                            <p className="text-[10px] text-brand-text-secondary mt-1">Menunggu respon calon</p>
                        </div>
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
                            <p className="text-xs font-semibold text-emerald-400">Berhasil Dikonversi</p>
                            <p className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">{leadConversionStats.converted}</p>
                            <p className="text-[10px] text-brand-text-secondary mt-1">Closing jadi pengantin ({leadConversionStats.rate}%)</p>
                        </div>
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
                            <p className="text-xs font-semibold text-red-400">Ditolak / Batal</p>
                            <p className="text-2xl font-bold text-brand-text-light mt-1 tabular-nums">{leadConversionStats.rejected}</p>
                            <p className="text-[10px] text-brand-text-secondary mt-1">Tidak cocok budget / jadwal</p>
                        </div>
                    </div>

                    <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
                        <div className="p-4 border-b border-brand-border">
                            <h4 className="text-sm font-bold text-brand-text-light">
                                Efektivitas Channel Promosi Calon Pengantin
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                            {leadConversionStats.channels.map(ch => (
                                <div key={ch.channel} className="p-3 bg-brand-bg rounded-xl border border-brand-border/40 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-xs text-brand-text-light">{ch.channel}</p>
                                        <p className="text-[11px] text-brand-text-secondary mt-0.5">{ch.converted} dari {ch.total} calon berhasil closing</p>
                                    </div>
                                    <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/15 text-emerald-400 tabular-nums">
                                        {ch.rate}% Konversi
                                    </span>
                                </div>
                            ))}
                            {leadConversionStats.channels.length === 0 && (
                                <p className="text-center text-xs text-brand-text-secondary col-span-3 py-4">Belum ada channel promosi yang tercatat.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
                        <div className="p-4 border-b border-brand-border">
                            <h4 className="text-sm font-bold text-brand-text-light">
                                Daftar Calon Pengantin (Leads)
                            </h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-brand-bg/70 text-brand-text-secondary border-b border-brand-border/60">
                                    <tr>
                                        <th className="p-3 font-semibold">Nama Calon</th>
                                        <th className="p-3 font-semibold">Status</th>
                                        <th className="p-3 font-semibold">Channel</th>
                                        <th className="p-3 font-semibold">Lokasi / Kota</th>
                                        <th className="p-3 font-semibold">WhatsApp</th>
                                        <th className="p-3 font-semibold">Rencana Acara</th>
                                        <th className="p-3 font-semibold">Tanggal Masuk</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-border/30">
                                    {filteredLeads.map(l => (
                                        <tr key={l.id} className="hover:bg-brand-bg/40 transition-colors">
                                            <td className="p-3 font-bold text-brand-text-light">{l.name}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${l.status === LeadStatus.CONVERTED ? 'bg-emerald-500/20 text-emerald-400' : l.status === LeadStatus.DISCUSSION ? 'bg-blue-500/20 text-blue-400' : 'bg-violet-500/20 text-violet-400'}`}>
                                                    {l.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-brand-text-secondary">{l.contactChannel}</td>
                                            <td className="p-3 text-brand-text-secondary">{l.location || l.address || '-'}</td>
                                            <td className="p-3 text-brand-text-light font-mono text-[11px]">{l.whatsapp || '-'}</td>
                                            <td className="p-3 text-brand-text-secondary">{l.eventDate ? new Date(l.eventDate).toLocaleDateString('id-ID') : '-'}</td>
                                            <td className="p-3 text-brand-text-secondary">{l.date ? new Date(l.date).toLocaleDateString('id-ID') : '-'}</td>
                                        </tr>
                                    ))}
                                    {filteredLeads.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-brand-text-secondary">
                                                Tidak ada data calon pengantin untuk periode ini.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── VIEW 6: SEMUA REKAP (RINGKASAN UTAMA) ── */}
            {activeReportTab === 'ringkasan' && (
                <div className="space-y-6">
                    {/* 5 Rekap Highlight Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div
                            onClick={() => setActiveReportTab('tipe')}
                            className="p-4 bg-brand-surface rounded-2xl border border-brand-border hover:border-brand-accent/50 cursor-pointer transition-all hover:-translate-y-0.5 group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">1. Tipe Klien</span>
                                <UsersIcon className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                            </div>
                            <p className="text-lg font-bold text-brand-text-light">{directClients.length} Direct · {vendorClients.length} Vendor</p>
                            <p className="text-xs text-brand-text-secondary mt-1">{directShare}% Langsung ({formatCurrency(directRevenue)})</p>
                            <span className="text-[10px] font-bold text-brand-accent mt-3 inline-block group-hover:underline">Buka Rekap Tipe →</span>
                        </div>

                        <div
                            onClick={() => setActiveReportTab('daerah')}
                            className="p-4 bg-brand-surface rounded-2xl border border-brand-border hover:border-brand-accent/50 cursor-pointer transition-all hover:-translate-y-0.5 group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">2. Sebaran Daerah</span>
                                <MapPinIcon className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                            </div>
                            <p className="text-lg font-bold text-brand-text-light truncate">{topCity.name}</p>
                            <p className="text-xs text-brand-text-secondary mt-1">{topCity.clientCount} pengantin · {cityStats.length} kota terdata</p>
                            <span className="text-[10px] font-bold text-brand-accent mt-3 inline-block group-hover:underline">Buka Rekap Daerah →</span>
                        </div>

                        <div
                            onClick={() => setActiveReportTab('paket')}
                            className="p-4 bg-brand-surface rounded-2xl border border-brand-border hover:border-brand-accent/50 cursor-pointer transition-all hover:-translate-y-0.5 group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">3. Paket & Pricelist</span>
                                <PackageIcon className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                            </div>
                            <p className="text-lg font-bold text-brand-text-light truncate">{topPackage.name}</p>
                            <p className="text-xs text-brand-text-secondary mt-1">{topPackage.orderCount}x pesanan ({formatCurrency(topPackage.totalOmzet)})</p>
                            <span className="text-[10px] font-bold text-brand-accent mt-3 inline-block group-hover:underline">Buka Rekap Paket →</span>
                        </div>

                        <div
                            onClick={() => setActiveReportTab('tim')}
                            className="p-4 bg-brand-surface rounded-2xl border border-brand-border hover:border-brand-accent/50 cursor-pointer transition-all hover:-translate-y-0.5 group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">4. Performa Tim</span>
                                <BriefcaseIcon className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                            </div>
                            <p className="text-lg font-bold text-brand-text-light truncate">{topTeamJob.name}</p>
                            <p className="text-xs text-brand-text-secondary mt-1">{topTeamJob.jobCount} job · Honor {formatCurrency(topTeamPayment.totalFee)}</p>
                            <span className="text-[10px] font-bold text-brand-accent mt-3 inline-block group-hover:underline">Buka Rekap Tim →</span>
                        </div>

                        <div
                            onClick={() => setActiveReportTab('leads')}
                            className="p-4 bg-brand-surface rounded-2xl border border-brand-border hover:border-brand-accent/50 cursor-pointer transition-all hover:-translate-y-0.5 group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">5. Konversi Leads</span>
                                <TargetIcon className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                            </div>
                            <p className="text-lg font-bold text-brand-text-light">{leadConversionStats.converted} dari {leadConversionStats.total}</p>
                            <p className="text-xs text-brand-text-secondary mt-1">Konversi: {leadConversionStats.rate}% ({leadConversionStats.discussion} diskusi)</p>
                            <span className="text-[10px] font-bold text-brand-accent mt-3 inline-block group-hover:underline">Buka Rekap Leads →</span>
                        </div>
                    </div>

                    {/* ── Client Growth Trend Chart ── */}
                    <MobileCollapsibleSection
                        title="Tren Pertumbuhan Pengantin"
                        subtitle="6 bulan terakhir"
                        badge="Grafik"
                        defaultOpen={true}
                    >
                        <div className="bg-brand-surface rounded-2xl border border-brand-border p-5 widget-animate" style={{ animationDelay: '230ms' }}>
                            <AnalyticsChartCard
                                title="Pertumbuhan Pengantin per Bulan"
                                description="Jumlah pengantin baru tiap bulan"
                                className="bg-transparent border-0 p-0"
                                headerClassName="mb-4"
                                bodyClassName="flex flex-col gap-4"
                            >
                                <div className="h-64 relative">
                                    {/* Y-axis labels */}
                                    {(() => {
                                        const maxVal = Math.max(...clientGrowthData.map(d => d.count), 1);
                                        const ticks = maxVal <= 2 ? [maxVal, 0] : [maxVal, Math.ceil(maxVal * 0.5), 0];
                                        return (
                                            <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-brand-text-secondary pr-2">
                                                {ticks.map((tick, i) => (
                                                    <span key={i}>{tick}</span>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    {/* Chart area */}
                                    <div className="ml-8 h-full min-w-0 flex items-end gap-4 pb-6 border-l border-b border-brand-border/30">
                                        {clientGrowthData.map((data, index) => {
                                            const maxValue = Math.max(...clientGrowthData.map(d => d.count), 1);
                                            const height = data.count > 0 ? Math.max((data.count / maxValue) * 100, 15) : 0;
                                            return (
                                                <div key={index} className="flex-1 min-w-0 flex flex-col items-center gap-2 group h-full justify-end">
                                                    <div className="w-full bg-brand-bg/50 rounded-t-lg relative flex-1 flex items-end">
                                                        {data.count > 0 ? (
                                                            <div
                                                                className="w-full bg-gradient-to-t from-brand-accent to-brand-accent/80 rounded-t-lg transition-all duration-500 group-hover:from-brand-accent/90 group-hover:to-brand-accent/70 shadow-sm"
                                                                style={{ height: `${height}%` }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-1 bg-brand-border/40 rounded-t" />
                                                        )}
                                                        {/* Tooltip */}
                                                        <div className={`absolute -top-8 max-w-[calc(100vw-2rem)] bg-brand-text-light text-brand-bg text-[10px] font-medium px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal text-center z-10 shadow-md ${index === clientGrowthData.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                                                            {data.count} pengantin ({data.name})
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs font-semibold ${data.count > 0 ? 'text-brand-accent' : 'text-brand-text-secondary'}`}>{data.count}</span>
                                                    <span className="text-[10px] text-brand-text-secondary text-center leading-tight truncate w-full">{data.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </AnalyticsChartCard>
                        </div>
                    </MobileCollapsibleSection>

                    {/* ── Charts Row ── */}
                    <MobileCollapsibleSection
                        title="Grafik Distribusi Wilayah & Sumber Leads"
                        subtitle={`${filteredClients.length} pengantin, ${filteredLeads.length} calon pengantin dianalisis`}
                        badge="2 Grafik"
                        defaultOpen={true}
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 widget-animate" style={{ animationDelay: '250ms' }}>
                            <ClientDistributionChart data={regionDistributionData} />

                            <AnalyticsChartCard
                                title="Sumber Calon Pengantin"
                                description="Channel yang membawa leads terbanyak"
                                className="bg-brand-surface rounded-2xl border border-brand-border p-5"
                                headerClassName="mb-4"
                                bodyClassName="flex flex-col gap-4"
                            >
                                {kpiData.leadSourceDonutData.length > 0 ? (
                                    <DonutChart data={kpiData.leadSourceDonutData} />
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8 text-center text-brand-text-secondary text-xs">
                                        <TargetIcon className="w-8 h-8 text-brand-border mb-2" />
                                        Belum ada data sumber calon pengantin
                                    </div>
                                )}
                                <div className="pt-2 border-t border-brand-border">
                                    <div className="flex items-center justify-between text-xs text-brand-text-secondary">
                                        <span>Total Calon Pengantin</span>
                                        <span className="font-semibold text-brand-text-light">{filteredLeads.length}</span>
                                    </div>
                                </div>
                            </AnalyticsChartCard>
                        </div>
                    </MobileCollapsibleSection>

                    {/* ── Lead Status & Client Status Section (Combined) ── */}
                    <MobileCollapsibleSection
                        title="Status: Calon Pengantin & Pengantin"
                        subtitle={`${filteredLeads.length} calon, ${filteredClients.length} pengantin`}
                        badge="Status"
                        defaultOpen={false}
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 widget-animate" style={{ animationDelay: '280ms' }}>
                            {/* Lead Status */}
                            <div className="bg-brand-surface rounded-2xl border border-brand-border p-5">
                                <h4 className="text-sm font-bold text-brand-text-light mb-4">Status Calon Pengantin</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {leadStatusConfig.map(s => (
                                        <div key={s.label} className={`flex flex-col items-center justify-center p-3 rounded-xl border ${s.bg} ${s.border}`}>
                                            <span className={`text-xl font-bold ${s.text} mb-1`}>{s.count}</span>
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${s.text}`}>
                                                {s.icon} {s.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Client Status */}
                            <div className="bg-brand-surface rounded-2xl border border-brand-border p-5">
                                <h4 className="text-sm font-bold text-brand-text-light mb-4">Distribusi Status Pengantin</h4>
                                <AnalyticsChartCard
                                    title=""
                                    description=""
                                    className="bg-transparent border-0 p-0"
                                    headerClassName="mb-0"
                                    bodyClassName="flex flex-col gap-4"
                                >
                                    <DonutChart data={clientStatusDistribution} />
                                </AnalyticsChartCard>
                            </div>
                        </div>
                    </MobileCollapsibleSection>

                    {/* ── Top 10 Clients by Value ── */}
                    <MobileCollapsibleSection
                        title="Top 10 Pengantin dengan Nilai Tertinggi"
                        subtitle="Pengantin dengan total nilai acara terbesar"
                        badge="Ranking"
                        defaultOpen={false}
                    >
                        <div className="bg-brand-surface rounded-2xl border border-brand-border p-5 widget-animate" style={{ animationDelay: '330ms' }}>
                            <div className="space-y-2">
                                {topClientsByValue.map((client, index) => (
                                    <div key={client.id} className="flex items-center justify-between p-3 bg-brand-bg rounded-xl border border-brand-border/40 hover:border-brand-border transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index < 3 ? 'bg-brand-accent text-white' : 'bg-brand-input text-brand-text-secondary'}`}>
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm text-brand-text-light">{client.name}</p>
                                                <p className="text-xs text-brand-text-secondary">{client.email}</p>
                                            </div>
                                        </div>
                                        <span className="font-bold text-brand-accent">{formatCurrency(client.totalValue)}</span>
                                    </div>
                                ))}
                                {topClientsByValue.length === 0 && (
                                    <p className="text-center text-brand-text-secondary py-8">Tidak ada data pengantin dengan nilai acara.</p>
                                )}
                            </div>
                        </div>
                    </MobileCollapsibleSection>
                </div>
            )}

            {/* ── Recent Clients List ── */}
            <div className="bg-brand-surface rounded-2xl border border-brand-border p-5 widget-animate" style={{ animationDelay: '350ms' }}>
                <div className="flex flex-col gap-4 mb-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h4 className="text-base font-bold text-gradient">Daftar Semua Pengantin</h4>
                            <p className="text-xs text-brand-text-secondary mt-0.5">{searchedAndSortedClients.length} pengantin ditampilkan</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-brand-accent/15 text-brand-accent border border-brand-accent/25">
                                {searchedAndSortedClients.length} total
                            </span>
                            {handleNavigation && (
                                <button
                                    onClick={() => handleNavigation(ViewType.CLIENTS)}
                                    className="button-secondary text-xs px-3 py-1.5"
                                >
                                    Lihat Detail
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Controls: Search, Sort, View Toggle */}
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="Cari nama atau email..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className="w-full min-w-[180px] input-field !rounded-xl !border !bg-brand-bg p-2.5 pl-10 text-sm"
                            />
                            <svg className="w-4 h-4 text-brand-text-secondary absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Sort */}
                        <select
                            value={sortBy}
                            onChange={(e) => { setSortBy(e.target.value as any); setCurrentPage(1); }}
                            className="input-field !rounded-xl !border !bg-brand-bg p-2.5 text-sm"
                        >
                            <option value="date">Urut: Terbaru</option>
                            <option value="name">Urut: Nama A-Z</option>
                            <option value="value">Urut: Nilai Tertinggi</option>
                            <option value="status">Urut: Status</option>
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value as ClientStatus | 'all'); setCurrentPage(1); }}
                            aria-label="Filter berdasarkan status"
                            className="input-field !rounded-xl !border !bg-brand-bg p-2.5 text-sm"
                        >
                            <option value="all">Semua Status</option>
                            {Object.values(ClientStatus).map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>

                        {/* View Toggle */}
                        <div className="flex items-center border border-brand-border rounded-xl overflow-hidden bg-brand-bg">
                            <button
                                onClick={() => setViewMode('card')}
                                className={`px-3 py-2 text-xs font-medium transition-colors ${viewMode === 'card' ? 'bg-brand-accent text-white' : 'text-brand-text-secondary hover:bg-brand-input'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 py-2 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-brand-accent text-white' : 'text-brand-text-secondary hover:bg-brand-input'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Card Grid View */}
                {viewMode === 'card' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {paginatedClients.map(client => {
                            const totalValue = filteredProjects.filter(p => p.clientId === client.id).reduce((sum, p) => sum + p.totalCost, 0);
                            const statusColors: Record<ClientStatus, string> = {
                                [ClientStatus.ACTIVE]: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                                [ClientStatus.INACTIVE]: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                                [ClientStatus.LEAD]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                                [ClientStatus.LOST]: 'bg-red-500/20 text-red-400 border-red-500/30',
                            };

                            return (
                                <div key={client.id} className="bg-brand-bg rounded-xl border border-brand-border/40 p-4 hover:border-brand-border transition-all hover:shadow-lg group">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1 min-w-0">
                                            <h5 className="font-semibold text-sm text-brand-text-light truncate group-hover:text-brand-accent transition-colors">
                                                {client.name}
                                            </h5>
                                            <p className="text-xs text-brand-text-secondary truncate mt-0.5">{client.email}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${statusColors[client.status] || 'bg-gray-500/20 text-gray-400'}`}>
                                            {client.status}
                                        </span>
                                    </div>

                                    {/* Stats */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-brand-text-secondary">Terdaftar</span>
                                            <span className="text-brand-text-primary font-medium">{new Date(client.since).toLocaleDateString('id-ID')}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-brand-text-secondary">Total Nilai</span>
                                            <span className="font-bold text-brand-accent">{formatCurrency(totalValue)}</span>
                                        </div>
                                    </div>

                                    {/* Hover Action */}
                                    <div className="mt-3 pt-3 border-t border-brand-border/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="w-full text-xs font-medium text-brand-accent hover:text-brand-accent/80 transition-colors">
                                            Lihat Detail →
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Table View */}
                {viewMode === 'table' && (
                    <div className="overflow-x-auto rounded-xl border border-brand-border/50 max-h-[600px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-brand-surface z-10">
                                <tr className="bg-brand-bg/80">
                                    <th className="p-3 text-center font-semibold text-brand-text-secondary w-12 text-xs">#</th>
                                    <th className="p-3 text-left font-semibold text-brand-text-secondary text-xs">Nama Pengantin</th>
                                    <th className="p-3 text-left font-semibold text-brand-text-secondary text-xs">Email</th>
                                    <th className="p-3 text-left font-semibold text-brand-text-secondary text-xs">Terdaftar</th>
                                    <th className="p-3 text-left font-semibold text-brand-text-secondary text-xs">Status</th>
                                    <th className="p-3 text-right font-semibold text-brand-text-secondary text-xs">Total Nilai</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-border/30">
                                {paginatedClients.map((client, index) => {
                                    const totalValue = filteredProjects.filter(p => p.clientId === client.id).reduce((sum, p) => sum + p.totalCost, 0);
                                    const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                                    const statusColors: Record<ClientStatus, string> = {
                                        [ClientStatus.ACTIVE]: 'bg-emerald-500/20 text-emerald-400',
                                        [ClientStatus.INACTIVE]: 'bg-gray-500/20 text-gray-400',
                                        [ClientStatus.LEAD]: 'bg-blue-500/20 text-blue-400',
                                        [ClientStatus.LOST]: 'bg-red-500/20 text-red-400',
                                    };

                                    return (
                                        <tr key={client.id} className="hover:bg-brand-bg/40 transition-colors">
                                            <td className="p-3 text-center text-brand-text-secondary text-xs font-medium">{globalIndex}</td>
                                            <td className="p-3">
                                                <p className="font-semibold text-brand-text-light">{client.name}</p>
                                            </td>
                                            <td className="p-3 text-brand-text-secondary text-xs">{client.email}</td>
                                            <td className="p-3 text-brand-text-secondary text-sm">{new Date(client.since).toLocaleDateString('id-ID')}</td>
                                            <td className="p-3">
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${statusColors[client.status] || 'bg-gray-500/20 text-gray-400'}`}>{client.status}</span>
                                            </td>
                                            <td className="p-3 text-right font-bold text-brand-text-primary">{formatCurrency(totalValue)}</td>
                                        </tr>
                                    );
                                })}
                                {paginatedClients.length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center text-brand-text-secondary text-sm">Tidak ada pengantin yang cocok dengan filter.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-brand-border">
                        <div className="text-xs text-brand-text-secondary">
                            Menampilkan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, searchedAndSortedClients.length)} dari {searchedAndSortedClients.length} pengantin
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-border bg-brand-bg text-brand-text-secondary hover:bg-brand-input disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                ← Sebelumnya
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                                                currentPage === pageNum
                                                    ? 'bg-brand-accent text-white'
                                                    : 'bg-brand-bg text-brand-text-secondary hover:bg-brand-input border border-brand-border'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-border bg-brand-bg text-brand-text-secondary hover:bg-brand-input disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Selanjutnya →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Satisfaction Section ── */}
            <MobileCollapsibleSection
                title="Analisis Kepuasan & Testimoni"
                subtitle={`Rating rata-rata ${avgRating.toFixed(1)}/5 dari ${totalFeedback} ulasan`}
                badge={`★ ${avgRating.toFixed(1)}`}
                defaultOpen={true}
            >
            <div className="bg-brand-surface rounded-2xl border border-brand-border p-5 widget-animate" style={{ animationDelay: '380ms' }}>
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <div>
                        <h4 className="text-base font-bold text-gradient">Analisis Kepuasan Pengantin</h4>
                        <p className="text-xs text-brand-text-secondary mt-0.5">{totalFeedback} total testimoni dikumpulkan</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setIsShareModalOpen(true)} className="button-secondary inline-flex items-center gap-1.5 text-sm">
                            <Share2Icon className="w-4 h-4" /> Bagikan Form
                        </button>
                        <button onClick={() => setIsFeedbackModalOpen(true)} className="button-primary inline-flex items-center gap-1.5 text-sm">
                            <PlusIcon className="w-4 h-4" /> Tambah Masukan
                        </button>
                    </div>
                </div>

                {/* Rating Summary + Bars */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
                    {/* Big rating display */}
                    <div className="flex flex-col items-center justify-center bg-brand-bg rounded-2xl border border-brand-border/40 p-5">
                        <p className="text-5xl font-black text-brand-text-light mb-1">{avgRating.toFixed(1)}</p>
                        <StarRatingDisplay rating={Math.round(avgRating)} />
                        <p className="text-xs text-brand-text-secondary mt-2">{totalFeedback > 0 ? `Dari ${totalFeedback} testimoni` : 'Belum ada testimoni'}</p>
                    </div>

                    {/* Progress bars */}
                    <div className="lg:col-span-2 flex flex-col justify-center gap-3">
                        {satisfactionConfig.map(s => {
                            const pct = totalFeedback > 0 ? (s.count / totalFeedback) * 100 : 0;
                            return (
                                <button key={s.key} onClick={() => setActiveStatModal(s.key)} className="group text-left focus:outline-none">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 w-32 shrink-0">
                                            <span className="text-brand-text-secondary">{s.icon}</span>
                                            <span className="text-xs font-medium text-brand-text-secondary truncate">{s.label}</span>
                                        </div>
                                        <div className="flex-1 h-2.5 bg-brand-bg rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${s.barColor} group-hover:opacity-80`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-bold text-brand-text-light w-8 text-right shrink-0">{s.count}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Stat cards row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    {satisfactionConfig.map(s => {
                        const variantMap: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
                            'green': 'success',
                            'blue': 'primary',
                            'orange': 'warning',
                            'red': 'error'
                        };
                        return (
                            <div key={s.key} className="cursor-pointer" onClick={() => setActiveStatModal(s.key)}>
                                <ModernStatCard icon={s.icon} title={s.label} value={s.count.toString()} iconColorVariant={variantMap[s.colorVariant] || 'primary'} subtitle="Klik untuk detail" />
                            </div>
                        );
                    })}
                </div>

                {/* Bottom: recommendations + feed */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 pt-5 border-t border-brand-border">
                    {/* Recommendations */}
                    <div className="lg:col-span-2">
                        <h5 className="text-sm font-bold text-brand-text-light mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-4 rounded-full bg-brand-accent inline-block" />
                            Rekomendasi Aksi
                        </h5>
                        <div className="space-y-2">
                            {actionRecommendations.length > 0 ? actionRecommendations.map(rec => (
                                <div key={rec.id} className={`p-3 rounded-xl border ${rec.bg} flex items-start gap-3`}>
                                    <div className="shrink-0 mt-0.5">{rec.icon}</div>
                                    <div>
                                        <p className="text-xs font-semibold text-brand-text-light">{rec.title}</p>
                                        <p className="text-[11px] text-brand-text-secondary mt-0.5 leading-relaxed">{rec.text}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <CheckCircleIcon className="w-8 h-8 text-emerald-400 mb-2" />
                                    <p className="text-sm font-medium text-brand-text-light">Semua baik-baik saja!</p>
                                    <p className="text-xs text-brand-text-secondary mt-1">Tidak ada rekomendasi khusus saat ini.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Feedback feed */}
                    <div className="lg:col-span-3">
                        <h5 className="text-sm font-bold text-brand-text-light mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-4 rounded-full bg-brand-accent inline-block" />
                            Masukan Terbaru
                        </h5>
                        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                            {filteredFeedback.slice(0, 10).map(item => (
                                <div key={item.id} className="bg-brand-bg rounded-xl border border-brand-border/40 p-3 hover:border-brand-border transition-colors">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm text-brand-text-light truncate">{item.clientName}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <SatisfactionBadge satisfaction={item.satisfaction} />
                                                <StarRatingDisplay rating={item.rating} size="sm" />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-brand-text-secondary shrink-0 mt-0.5">
                                            {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <p className="text-xs text-brand-text-secondary leading-relaxed border-t border-brand-border/40 pt-2 mt-1 italic">
                                        "{item.feedback}"
                                    </p>
                                </div>
                            ))}
                            {filteredFeedback.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <StarIcon className="w-8 h-8 text-brand-text-secondary mb-2" />
                                    <p className="text-sm font-medium text-brand-text-light">Belum ada masukan</p>
                                    <p className="text-xs text-brand-text-secondary mt-1">Bagikan form ke pengantin untuk mulai mengumpulkan testimoni.</p>
                                </div>
                            )}
                            {filteredFeedback.length > 10 && (
                                <p className="text-center text-xs text-brand-text-secondary mt-2">Menampilkan 10 dari {filteredFeedback.length} testimoni terbaru</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            </MobileCollapsibleSection>

            {/* ── Modals ── */}

            {/* Add Feedback Modal */}
            <Modal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} title="Tambah Masukan Pengantin">
                <form onSubmit={handleManualFeedbackSubmit} className="space-y-4">
                    <div className="input-group">
                        <input type="text" id="clientName" name="clientName" value={manualFeedbackForm.clientName} onChange={handleManualFeedbackChange} className="input-field" placeholder=" " required />
                        <label htmlFor="clientName" className="input-label">Nama Pengantin</label>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-secondary mb-2">Rating</label>
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button key={star} type="button" onClick={() => setManualFeedbackForm(p => ({ ...p, rating: star }))}
                                    className={`p-2 rounded-xl transition-all ${manualFeedbackForm.rating >= star ? 'bg-yellow-400/20 scale-110' : 'bg-brand-input hover:bg-brand-input/80'}`}>
                                    <StarIcon className={`w-6 h-6 transition-colors ${manualFeedbackForm.rating >= star ? 'text-yellow-400 fill-current' : 'text-gray-500'}`} />
                                </button>
                            ))}
                            <span className="text-xs text-brand-text-secondary ml-1">({manualFeedbackForm.rating}/5)</span>
                        </div>
                    </div>
                    <div className="input-group">
                        <textarea id="feedback" name="feedback" value={manualFeedbackForm.feedback} onChange={handleManualFeedbackChange} className="input-field" placeholder=" " required rows={4} />
                        <label htmlFor="feedback" className="input-label">Saran / Masukan</label>
                    </div>
                    <div className="flex justify-end items-center gap-3 pt-4 border-t border-brand-border">
                        <button type="button" onClick={() => setIsFeedbackModalOpen(false)} className="button-secondary">Batal</button>
                        <button type="submit" className="button-primary">Simpan Masukan</button>
                    </div>
                </form>
            </Modal>

            {/* Share Modal */}
            <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Bagikan Formulir Masukan" size="lg">
                <div className="space-y-4">
                    <div className="p-4 bg-brand-accent/10 border border-brand-accent/25 rounded-xl">
                        <div className="flex items-start gap-3">
                            <Share2Icon className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
                            <p className="text-sm text-brand-text-secondary leading-relaxed">
                                Bagikan tautan ini kepada pengantin setelah acara selesai. Mereka dapat memberikan peringkat dan masukan yang langsung tampil di dasbor.
                            </p>
                        </div>
                    </div>
                    <div className="input-group">
                        <input type="text" readOnly value={feedbackFormUrl} className="input-field !bg-brand-input cursor-text select-all" />
                        <label className="input-label">Tautan Formulir</label>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setIsShareModalOpen(false)} className="button-secondary">Tutup</button>
                        <button onClick={copyToClipboard} className="button-primary inline-flex items-center gap-2">
                            <Share2Icon className="w-4 h-4" /> Salin Tautan
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Stat detail modal */}
            <Modal isOpen={!!activeStatModal} onClose={() => setActiveStatModal(null)} title={activeStatModal ? (modalTitles[activeStatModal] ?? '') : ''} size="2xl">
                <div className="max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
                    {modalContent}
                </div>
            </Modal>
        </div>
    );
};

export default ClientReports;
