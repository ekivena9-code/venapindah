import React, { useEffect, useMemo, useState } from 'react';
import { Project, Client, Transaction, TransactionType, ViewType, TeamMember, Card, FinancialPocket, PocketType, Lead, LeadStatus, TeamProjectPayment, Package, ClientFeedback, ClientStatus, NavigationAction, User, ProjectStatusConfig, Profile, PaymentStatus, CalendarEvent } from '../../types';
import { listCalendarEventsInRange } from '../../services/calendarEvents';
import { useCalendarEventsQuery } from '../../hooks/queries';
import StatCardModal from '../../shared/ui/StatCardModal';
import Modal from '../../shared/ui/Modal';
import { NAV_ITEMS, DollarSignIcon, FolderKanbanIcon, UsersIcon, BriefcaseIcon, ChevronRightIcon, CreditCardIcon, CalendarIcon, ClipboardListIcon, LightbulbIcon, TargetIcon, StarIcon, CameraIcon, FileTextIcon, TrendingUpIcon, AlertCircleIcon, MapPinIcon, ClockIcon } from '../../constants';
import { Breadcrumb, ModernStatCard, ModernBadge } from '../../components/modernize';
import { MobileCollapsibleSection } from '../../components/ui/MobileProgressiveDisclosure';
import { customizeNavigationLabel, customizeUiText, useUiTextOverrides } from '../../utils/uiTextCustomization';

// Helper Functions
const formatCurrency = (amount: number, minimumFractionDigits = 0) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits }).format(amount);
};

const getStatusClass = (status: string, config: ProjectStatusConfig[]) => {
    const statusConfig = config.find(c => c.name === status);
    const color = statusConfig ? statusConfig.color : '#64748b'; // slate-500
    // Note: Tailwind purge might not see this. Inline styles are safer for dynamic colors.
    // This is a simplified approach.
    const colorMap: { [key: string]: string } = {
        '#10b981': 'bg-[#E6FFFA] text-[#13DEB9]',
        '#3b82f6': 'bg-[#ECF2FF] text-[#5D87FF]',
        '#8b5cf6': 'bg-purple-100 text-purple-600',
        '#f97316': 'bg-[#FEF5E5] text-[#FFAE1F]',
        '#06b6d4': 'bg-teal-50 text-teal-600',
        '#eab308': 'bg-[#FEF5E5] text-[#FFAE1F]',
        '#6366f1': 'bg-indigo-50 text-indigo-600',
        '#ef4444': 'bg-[#FDEDE8] text-[#FA896B]'
    };
    return colorMap[color] || 'bg-slate-100 text-slate-600';
};


// --- Sub-components for Dashboard ---

const QuickLinksWidget: React.FC<{ handleNavigation: (view: ViewType) => void; currentUser: User | null; }> = ({ handleNavigation, currentUser }) => {
    const uiTextOverrides = useUiTextOverrides();
    const quickLinks = useMemo(() => {
        const allLinks = NAV_ITEMS.filter(item => item.view !== ViewType.DASHBOARD);
        if (!currentUser || currentUser.role === 'Admin') {
            return allLinks;
        }
        const memberPermissions = new Set(currentUser.permissions || []);
        return allLinks.filter(link => memberPermissions.has(link.view));
    }, [currentUser]);


    return (
        <div className="bg-white p-4 sm:p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)]">
            <h3 className="font-bold text-base md:text-lg text-[#2A3547] mb-3 md:mb-4">Akses Cepat</h3>
            <div className="grid grid-cols-2 gap-2 md:gap-4">
                {quickLinks.map(link => (
                    <button
                        key={link.view}
                        onClick={() => handleNavigation(link.view)}
                        className="flex flex-col items-center justify-center p-3 md:p-4 bg-[#F4F6F9] rounded-xl text-center hover:bg-[#ECF2FF] hover:border-[#5D87FF]/25 border border-transparent hover:shadow-xs transition-all duration-200 active:scale-95"
                        aria-label={`Buka ${customizeNavigationLabel(link.label, uiTextOverrides)}`}
                    >
                        <link.icon className="w-6 h-6 md:w-7 md:h-7 text-[#5D87FF] mb-1.5 md:mb-2" />
                        <span className="text-[11px] md:text-xs font-semibold text-[#2A3547]">{customizeNavigationLabel(link.label, uiTextOverrides)}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

const IncomeChartWidget: React.FC<{ transactions: Transaction[]; projects?: Project[] }> = ({ transactions, projects = [] }) => {
    const [chartView, setChartView] = useState<'monthly' | 'yearly' | 'projection'>('monthly');

    const chartData = useMemo(() => {
        const currentYear = new Date().getFullYear();
        if (chartView === 'yearly') {
            const totals: { [year: string]: { income: number, expense: number } } = {};
            transactions.forEach(t => {
                const year = new Date(t.date).getFullYear().toString();
                if (!totals[year]) totals[year] = { income: 0, expense: 0 };
                if (t.type === TransactionType.INCOME) totals[year].income += t.amount;
                else totals[year].expense += t.amount;
            });
            return Object.entries(totals)
                .sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB))
                .map(([year, values]) => ({ name: year, isProjected: false, projectedReceivables: 0, ...values }));
        } else if (chartView === 'projection') {
            // Forward 6-month projection based on rolling monthly baseline + project receivables
            const monthlyTotals: { [key: string]: { income: number; expense: number } } = {};
            transactions.forEach(t => {
                const d = new Date(t.date);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                if (!monthlyTotals[key]) monthlyTotals[key] = { income: 0, expense: 0 };
                if (t.type === TransactionType.INCOME) monthlyTotals[key].income += t.amount;
                else if (t.type === TransactionType.EXPENSE) monthlyTotals[key].expense += t.amount;
            });
            const histValues = Object.values(monthlyTotals);
            const avgIncome = histValues.length > 0
                ? Math.round(histValues.reduce((s, v) => s + v.income, 0) / histValues.length)
                : 0;
            const avgExpense = histValues.length > 0
                ? Math.round(histValues.reduce((s, v) => s + v.expense, 0) / histValues.length)
                : 0;

            const now = new Date();
            const projList = [];
            for (let i = 0; i < 6; i++) {
                const target = new Date(now.getFullYear(), now.getMonth() + i, 1);
                const targetYear = target.getFullYear();
                const targetMonth = target.getMonth();
                const monthName = target.toLocaleString('id-ID', { month: 'short', year: '2-digit' });

                // Find unpaid receivables for projects scheduled in this month
                const monthProjects = projects.filter(p => {
                    const pDate = new Date(p.date || p.deadlineDate || '');
                    return !isNaN(pDate.getTime()) &&
                           pDate.getFullYear() === targetYear &&
                           pDate.getMonth() === targetMonth;
                });
                const receivables = monthProjects.reduce((sum, p) => {
                    const cost = Number(p.totalCost) || 0;
                    const paid = Number(p.amountPaid) || 0;
                    return sum + Math.max(0, cost - paid);
                }, 0);

                projList.push({
                    name: `${monthName}${i === 0 ? ' (Kini)' : ''}`,
                    income: avgIncome + receivables,
                    expense: avgExpense,
                    isProjected: true,
                    projectedReceivables: receivables
                });
            }
            return projList;
        } else {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const data = months.map(month => ({ name: month, income: 0, expense: 0, isProjected: false, projectedReceivables: 0 }));
            transactions.forEach(t => {
                const d = new Date(t.date);
                if (d.getFullYear() === currentYear) {
                    const m = d.getMonth();
                    if (t.type === TransactionType.INCOME) data[m].income += t.amount;
                    else data[m].expense += t.amount;
                }
            });
            return data;
        }
    }, [transactions, projects, chartView]);

    const maxVal = Math.max(...chartData.map(d => Math.max(d.income, d.expense)), 1);

    return (
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] h-full">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                <div>
                    <h3 className="font-bold text-lg text-[#2A3547] flex items-center gap-2">
                        Analisis Keuangan
                        {chartView === 'projection' && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#ECF2FF] text-[#5D87FF]">
                                Proyeksi 6 Bln
                            </span>
                        )}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 mt-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#5D87FF]"></div>
                            <span className="text-[11px] text-[#5A6A85] uppercase font-bold tracking-tight">
                                {chartView === 'projection' ? 'Est. Masuk (+Piutang)' : 'Pemasukan'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#FA896B]"></div>
                            <span className="text-[11px] text-[#5A6A85] uppercase font-bold tracking-tight">
                                {chartView === 'projection' ? 'Est. Pengeluaran' : 'Pengeluaran'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="p-1 bg-[#F4F6F9] rounded-xl flex items-center h-fit border border-[#EAEFF4]">
                    {[
                        { id: 'monthly', label: 'Bulanan' },
                        { id: 'yearly', label: 'Tahunan' },
                        { id: 'projection', label: 'Proyeksi Kas' }
                    ].map(view => (
                        <button
                            key={view.id}
                            onClick={() => setChartView(view.id as any)}
                            className={`px-4 py-3 sm:px-3 sm:py-1.5 text-sm sm:text-xs font-bold rounded-lg transition-all ${chartView === view.id ? 'bg-[#5D87FF] text-white shadow-xs' : 'text-[#5A6A85] hover:text-[#2A3547]'}`}
                        >
                            {view.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="h-56 flex justify-between items-end gap-3 mt-4">
                {chartData.map(item => (
                    <div key={item.name} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-20">
                            <div className="bg-white border border-[#EAEFF4] shadow-xl p-2.5 rounded-xl text-[10px] whitespace-nowrap">
                                <p className="text-[#2A3547] font-bold border-b border-[#EAEFF4] pb-1">
                                    {item.name} {item.isProjected ? '(Proyeksi)' : ''}
                                </p>
                                <p className="text-[#166534] font-bold mt-1">In: {formatCurrency(item.income, 0)}</p>
                                {Boolean(item.projectedReceivables) && (
                                    <p className="text-[#5D87FF] font-semibold pl-2">↳ Piutang: {formatCurrency(item.projectedReceivables || 0, 0)}</p>
                                )}
                                <p className="text-[#DC2626] font-bold">Out: {formatCurrency(item.expense, 0)}</p>
                                <p className={`font-bold mt-0.5 pt-0.5 border-t border-[#EAEFF4] ${(item.income - item.expense) >= 0 ? 'text-[#166534]' : 'text-[#DC2626]'}`}>
                                    Net: {(item.income - item.expense) >= 0 ? '+' : ''}{formatCurrency(item.income - item.expense, 0)}
                                </p>
                            </div>
                            <div className="w-2 h-2 bg-white border-r border-b border-[#EAEFF4] rotate-45 -mt-1"></div>
                        </div>
                        <div className="w-full flex items-end gap-1 h-full">
                            <div
                                className={`flex-1 rounded-t-md transition-all duration-300 ${
                                    item.isProjected
                                        ? 'bg-[#ECF2FF] border-t-2 border-x-2 border-dashed border-[#5D87FF] group-hover:bg-[#5D87FF]'
                                        : 'bg-[#ECF2FF] group-hover:bg-[#5D87FF]'
                                }`}
                                style={{ height: `${(item.income / maxVal) * 100}%` }}
                            ></div>
                            <div
                                className={`flex-1 rounded-t-md transition-all duration-300 ${
                                    item.isProjected
                                        ? 'bg-[#FDEDE8] border-t-2 border-x-2 border-dashed border-[#FA896B] group-hover:bg-[#FA896B]'
                                        : 'bg-[#FDEDE8] group-hover:bg-[#FA896B]'
                                }`}
                                style={{ height: `${(item.expense / maxVal) * 100}%` }}
                            ></div>
                        </div>
                        <span className={`text-[10px] font-bold mt-3 uppercase tracking-tighter truncate max-w-full ${item.isProjected ? 'text-[#5D87FF]' : 'text-[#5A6A85]'}`}>
                            {item.name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};


const RecentTransactionsWidget: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => (
    <div className="bg-white p-4 sm:p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] h-full">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-[#2A3547]">Transaksi Terbaru</h3>
            <button className="p-3 text-[#5A6A85] hover:text-[#2A3547] rounded-lg hover:bg-[#F4F6F9]"><ChevronRightIcon className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3.5">
            {transactions.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${t.type === TransactionType.INCOME ? 'bg-[#E6FFFA] text-[#13DEB9]' : 'bg-[#FDEDE8] text-[#FA896B]'}`}>
                        <DollarSignIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <p className="font-bold text-[#2A3547] truncate text-sm">{t.description}</p>
                        <p className="text-xs text-[#5A6A85]">{new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <div className={`font-bold text-sm ${t.type === TransactionType.INCOME ? 'text-[#166534]' : 'text-[#DC2626]'}`}>
                        {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount, 0)}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const CardWidget: React.FC<{ card: Card }> = ({ card }) => {
    const gradient = card.colorGradient || 'from-slate-700 to-slate-900';
    const isLight = gradient.includes('slate-100') || gradient.includes('slate-200') || gradient.includes('white');
    const textColor = isLight ? 'text-slate-800' : 'text-white';

    return (
        <div className={`p-4 rounded-2xl ${textColor} shadow-md flex flex-col justify-between h-40 flex-1 min-w-64 bg-gradient-to-br ${gradient}`}>
            <div>
                <div className="flex justify-between items-center">
                    <p className="font-bold text-sm">{card.bankName}</p>
                    <p className="text-xs opacity-90">{card.cardType}</p>
                </div>
            </div>
            <div>
                <p className="text-xl font-mono tracking-wider">**** {card.lastFourDigits}</p>
                <p className="text-2xl font-extrabold tracking-tight">{formatCurrency(card.balance)}</p>
            </div>
        </div>
    );
};

const MyCardsWidget: React.FC<{ cards: Card[], handleNavigation: (view: ViewType) => void }> = ({ cards, handleNavigation }) => (
    <div className="bg-white p-4 sm:p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] h-full">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-[#2A3547] flex items-center gap-2"><CreditCardIcon className="w-5 h-5 text-[#5D87FF]" /> Kartu Saya</h3>
            <button onClick={() => handleNavigation(ViewType.FINANCE)} className="p-2 text-sm font-semibold text-[#5D87FF] hover:underline rounded-lg hover:bg-[#ECF2FF]">Kelola Kartu &rarr;</button>
        </div>
        <div className="flex flex-wrap gap-4">
            {cards.map(card => <CardWidget key={card.id} card={card} />)}
        </div>
    </div>
);

const weekdaysShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const eventTypeColors: Record<string, string> = {
    'Meeting Pengantin': '#3b82f6',
    'Survey Lokasi': '#22c55e',
    'Libur': '#94a3b8',
    'Workshop': '#a855f7',
    'Lainnya': '#eab308',
};

interface DashboardCalendarItem {
    id: string;
    date: string;
    projectName: string;
    projectType?: string;
    status: string;
    clientId?: string;
}

const getEventColor = (event: DashboardCalendarItem, profile: Profile) => {
    const type = event.projectType?.toLowerCase() || '';
    if (type.includes('wedding') || type.includes('pernikahan')) return '#ef4444'; // Merah
    if (type.includes('engagement') || type.includes('lamaran')) return '#f97316'; // Orange
    if (type.includes('meeting') || type.includes('internal')) return '#3b82f6'; // Biru
    
    const isInternalEvent = profile.eventTypes?.includes(event.projectType);
    if (isInternalEvent) return eventTypeColors[event.projectType] || '#6366f1';
    return profile.projectStatusConfig?.find(s => s.name === event.status)?.color || '#64748b';
};

/** Kalender bulan ringkas untuk Dashboard - menampilkan Acara Pernikahan & Acara Pernikahan internal */
const CalendarMonthWidget: React.FC<{
    projects: Project[];
    profile: Profile;
    handleNavigation: (view: ViewType, action?: NavigationAction) => void;
}> = ({ projects, profile, handleNavigation }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [internalEvents, setInternalEvents] = useState<DashboardCalendarItem[]>([]);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const from = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
                const to = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];
                const rows = await listCalendarEventsInRange(from, to);
                if (!isMounted) return;
                setInternalEvents(
                    (Array.isArray(rows) ? rows : []).map((event: CalendarEvent) => ({
                        id: event.projectId || event.id,
                        date: event.date || event.startAt,
                        projectName: event.title,
                        projectType: event.eventType,
                        status: event.status,
                        clientId: event.projectId || 'INTERNAL',
                    })),
                );
            } catch {
                setInternalEvents([]);
            }
        })();
        return () => { isMounted = false; };
    }, [currentDate]);

    const deadlineEvents = useMemo(() =>
        (projects || [])
            .filter(p => (p as { deadlineDate?: string }).deadlineDate)
            .map(p => ({
                id: `${p.id}-deadline`,
                projectName: `Deadline: ${p.projectName}`,
                projectType: p.projectType,
                status: p.status,
                clientId: p.clientId,
                date: (p as { deadlineDate?: string }).deadlineDate!,
            })),
        [projects]
    );

    const allEvents = useMemo<DashboardCalendarItem[]>(() => [
        ...projects.map(({ id, date, projectName, projectType, status, clientId }) => ({
            id, date, projectName, projectType, status, clientId,
        })),
        ...internalEvents,
        ...deadlineEvents,
    ], [projects, internalEvents, deadlineEvents]);

    const { daysInMonth, eventsByDate } = useMemo(() => {
        const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const start = new Date(first);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(last);
        end.setDate(end.getDate() + (6 - end.getDay()));
        const days: Date[] = [];
        let d = new Date(start);
        while (d <= end) {
            days.push(new Date(d));
            d.setDate(d.getDate() + 1);
        }
        const byDate = new Map<string, DashboardCalendarItem[]>();
        allEvents.forEach(ev => {
            const key = new Date(ev.date).toDateString();
            if (!byDate.has(key)) byDate.set(key, []);
            byDate.get(key)!.push(ev);
        });
        return { daysInMonth: days, eventsByDate: byDate };
    }, [currentDate, allEvents]);

    const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1));
    const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1));

    return (
        <div className="bg-white p-4 sm:p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-[#2A3547] flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-[#5D87FF]" /> Kalender Acara
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={prevMonth} className="p-3 rounded-lg hover:bg-[#F4F6F9] text-[#5A6A85] transition-colors" aria-label="Bulan sebelumnya">
                        <ChevronRightIcon className="w-5 h-5 rotate-180" />
                    </button>
                    <span className="text-sm font-bold text-[#2A3547] min-w-[100px] text-center">
                        {currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={nextMonth} className="p-3 rounded-lg hover:bg-[#F4F6F9] text-[#5A6A85] transition-colors" aria-label="Bulan berikutnya">
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleNavigation(ViewType.CALENDAR)} className="p-2 text-sm font-bold text-[#5D87FF] hover:underline ml-2 rounded-lg hover:bg-[#ECF2FF]">
                        Kalender Lengkap &rarr;
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-7 border border-[#EAEFF4] rounded-xl overflow-hidden">
                {weekdaysShort.map(day => (
                    <div key={day} className="bg-[#F4F6F9] py-2 text-center text-xs font-bold text-[#5A6A85] border-b border-r border-[#EAEFF4] last:border-r-0">
                        {day}
                    </div>
                ))}
                {daysInMonth.map((day, i) => {
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const isToday = day.toDateString() === new Date().toDateString();
                    const events = eventsByDate.get(day.toDateString()) || [];
                    return (
                        <div
                            key={i}
                            className={`min-h-[64px] sm:min-h-[80px] p-1 border-b border-r border-[#EAEFF4] last:border-r-0 ${isCurrentMonth ? 'bg-white' : 'bg-[#FAFCFE]'}`}
                        >
                            <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full ${isCurrentMonth ? 'text-[#2A3547]' : 'text-[#5A6A85]/40'} ${isToday ? 'bg-[#5D87FF] text-white shadow-xs' : ''}`}>
                                {day.getDate()}
                            </span>
                            <div className="mt-0.5 space-y-0.5 overflow-hidden">
                                {events.slice(0, 2).map(ev => (
                                    <div
                                        key={ev.id}
                                        onClick={(e) => {
                                             e.stopPropagation();
                                             if (ev.clientId === 'INTERNAL') {
                                                 handleNavigation(ViewType.CALENDAR);
                                             } else {
                                                 handleNavigation(ViewType.CLIENTS, { type: 'VIEW_CLIENT_DETAILS', id: ev.clientId });
                                             }
                                        }}
                                        className="text-[10px] px-1.5 py-0.5 rounded text-white truncate cursor-pointer font-semibold shadow-2xs"
                                        style={{ backgroundColor: getEventColor(ev, profile) }}
                                    >
                                        {ev.projectName}
                                    </div>
                                ))}
                                {events.length > 2 && (
                                    <span className="text-[10px] font-bold text-[#5D87FF]">+{events.length - 2} lagi</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const UpcomingCalendarWidget: React.FC<{ projects: Project[], handleNavigation: (view: ViewType, action?: NavigationAction) => void }> = ({ projects, handleNavigation }) => {
    const upcoming = projects
        .filter(p => new Date(p.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);

    return (
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-[#2A3547] flex items-center gap-2">Acara Pernikahan Mendatang</h3>
                <button onClick={() => handleNavigation(ViewType.CALENDAR)} className="p-2 text-sm font-semibold text-[#5D87FF] hover:underline rounded-lg hover:bg-[#ECF2FF]">Lihat Semua &rarr;</button>
            </div>
            <div className="space-y-3">
                {upcoming.map(p => {
                    const daysAway = Math.ceil((new Date(p.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    const isToday = daysAway === 0;
                    const countdownText = isToday ? 'Hari Ini' : daysAway > 0 ? `${daysAway} Hari Lagi` : 'Selesai';

                    return (
                        <div key={p.id} className="group flex items-center gap-4 p-3 rounded-xl hover:bg-[#F4F6F9] border border-[#EAEFF4]/60 hover:border-[#5D87FF]/20 cursor-pointer transition-all duration-200" onClick={() => handleNavigation(ViewType.CLIENTS, { type: 'VIEW_CLIENT_DETAILS', id: p.clientId })}>
                            <div className="w-12 h-12 rounded-xl bg-[#ECF2FF] flex-shrink-0 flex flex-col items-center justify-center border border-[#5D87FF]/20">
                                <p className="text-[10px] font-bold text-[#5D87FF] uppercase tracking-wider">{new Date(p.date).toLocaleString('id-ID', { month: 'short' })}</p>
                                <p className="text-xl font-extrabold text-[#2A3547]">{new Date(p.date).getDate()}</p>
                            </div>
                            <div className="flex-grow overflow-hidden">
                                <p className="font-bold text-[#2A3547] truncate text-sm group-hover:text-[#5D87FF] transition-colors">{p.projectName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-semibold text-[#5A6A85] uppercase tracking-tight">{p.projectType}</span>
                                    {p.location && (
                                        <div className="flex items-center gap-1 text-[10px] text-[#5A6A85] truncate">
                                            <MapPinIcon className="w-3 h-3 text-[#5D87FF]" />
                                            <span className="truncate">{p.location}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isToday ? 'bg-[#FDEDE8] text-[#FA896B]' : 'bg-[#ECF2FF] text-[#5D87FF]'}`}>
                                    {countdownText}
                                </span>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusClass(p.status, [])}`}>{p.status}</span>
                            </div>
                        </div>
                    );
                })}
                {upcoming.length === 0 && <p className="text-center text-sm text-[#5A6A85] py-8">Tidak ada Acara Pernikahan mendatang.</p>}
            </div>
        </div>
    );
}

const ProjectStatusWidget: React.FC<{ projects: Project[], projectStatusConfig: ProjectStatusConfig[], handleNavigation: (view: ViewType) => void }> = ({ projects, projectStatusConfig, handleNavigation }) => {
    const statusOrder = projectStatusConfig.map(s => s.name).filter(name => name !== 'Selesai' && name !== 'Dibatalkan');

    const statusCounts = useMemo(() => {
        return statusOrder.map(statusName => {
            const count = projects.filter(p => p.status === statusName).length;
            const config = projectStatusConfig.find(s => s.name === statusName);
            return {
                name: statusName,
                count: count,
                color: config ? config.color : '#64748b'
            };
        }).filter(s => s.count > 0);

    }, [projects, statusOrder, projectStatusConfig]);

    const total = statusCounts.reduce((sum, item) => sum + item.count, 0);

    return (
        <div className="bg-white p-4 sm:p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] h-full flex flex-col">
            <h3 className="font-bold text-lg text-[#2A3547] mb-4">Progres Acara Pernikahan Pengantin Aktif</h3>
            <div className="space-y-3 flex-grow">
                {statusCounts.map(status => (
                    <div key={status.name} className="text-sm">
                        <div className="flex justify-between mb-1">
                            <span className="text-[#2A3547] font-semibold">{status.name}</span>
                            <span className="text-[#5A6A85] font-bold">{status.count}</span>
                        </div>
                        <div className="w-full bg-[#F4F6F9] rounded-full h-2 overflow-hidden">
                            <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${total > 0 ? (status.count / total) * 100 : 0}%`, backgroundColor: status.color }}></div>
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={() => handleNavigation(ViewType.CLIENTS)} className="p-2 mt-4 text-sm font-semibold text-[#5D87FF] hover:underline self-start rounded-lg hover:bg-[#ECF2FF]">Kelola di Manajemen Pengantin &rarr;</button>
        </div>
    );
};

const LeadsSummaryWidget: React.FC<{ leads: Lead[]; handleNavigation: (view: ViewType) => void }> = ({ leads, handleNavigation }) => {
    const newLeadsThisMonth = leads.filter(l => new Date(l.date).getMonth() === new Date().getMonth() && new Date(l.date).getFullYear() === new Date().getFullYear()).length;
    const convertedLeads = leads.filter(l => l.status === LeadStatus.CONVERTED).length;
    const conversionRate = leads.length > 0 ? (convertedLeads / leads.length) * 100 : 0;

    const SmallStat: React.FC<{ icon: React.ReactNode; title: string; value: string; }> = ({ icon, title, value }) => (
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#ECF2FF] flex items-center justify-center text-[#5D87FF] flex-shrink-0">{icon}</div>
            <div>
                <p className="text-xs font-medium text-[#5A6A85]">{title}</p>
                <p className="font-extrabold text-lg text-[#2A3547]">{value}</p>
            </div>
        </div>
    );

    return (
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] h-full flex flex-col justify-between">
            <h3 className="font-bold text-lg text-[#2A3547] mb-4">Ringkasan Calon Pengantin</h3>
            <div className="space-y-4 flex-grow">
                <SmallStat icon={<LightbulbIcon className="w-5 h-5" />} title="Calon Pengantin Baru Bulan Ini" value={newLeadsThisMonth.toString()} />
                <SmallStat icon={<TargetIcon className="w-5 h-5" />} title="Tingkat Konversi" value={`${conversionRate.toFixed(1)}%`} />
            </div>
            <button onClick={() => handleNavigation(ViewType["Calon Pengantin"])} className="p-2 mt-4 text-sm font-semibold text-[#5D87FF] hover:underline self-start rounded-lg hover:bg-[#ECF2FF]">Kelola Calon Pengantin &rarr;</button>
        </div>
    );
};

const ClientSatisfactionWidget: React.FC<{ feedback: ClientFeedback[]; handleNavigation: (view: ViewType) => void }> = ({ feedback, handleNavigation }) => {
    const totalFeedback = feedback.length;
    const avgRating = totalFeedback > 0 ? feedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback : 0;
    const StarRatingDisplay = ({ rating }: { rating: number }) => (<div className="flex items-center">{[1, 2, 3, 4, 5].map(star => (<StarIcon key={star} className={`w-5 h-5 ${star <= rating ? 'text-[#FFAE1F] fill-current' : 'text-slate-200'}`} />))}</div>);

    return (
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] h-full flex flex-col justify-between">
            <div>
                <h3 className="font-bold text-lg text-[#2A3547] mb-2">Kepuasan Pengantin</h3>
                <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-extrabold text-[#2A3547]">{avgRating.toFixed(1)}</p>
                    <p className="text-[#5A6A85] font-semibold">/ 5.0</p>
                </div>
                <div className="my-3"><StarRatingDisplay rating={avgRating} /></div>
                <p className="text-xs text-[#5A6A85]">Berdasarkan {totalFeedback} ulasan kepuasan.</p>
            </div>
            <button onClick={() => handleNavigation(ViewType.CLIENT_REPORTS)} className="p-2 mt-4 text-sm font-semibold text-[#5D87FF] hover:underline self-start rounded-lg hover:bg-[#ECF2FF]">Lihat Laporan &rarr;</button>
        </div>
    );
};

const BookingTrendWidget: React.FC<{ projects: Project[] }> = ({ projects }) => {
    const monthlyBookings = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const data = months.map(month => ({ name: month, count: 0 }));

        projects.forEach(p => {
            const d = new Date(p.date);
            if (d.getFullYear() === currentYear) {
                data[d.getMonth()].count += 1;
            }
        });
        return data;
    }, [projects]);

    const maxCount = Math.max(...monthlyBookings.map(d => d.count), 1);

    return (
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] h-full">
            <h3 className="font-bold text-lg text-[#2A3547] mb-6">Tren Booking (Wedding Date)</h3>
            <div className="h-44 flex justify-between items-end gap-1">
                {monthlyBookings.map(item => {
                    const height = (item.count / maxCount) * 100;
                    return (
                        <div key={item.name} className="flex-1 flex flex-col items-center group relative">
                            <div className="absolute -top-8 bg-[#2A3547] text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{item.count} Wedding</div>
                            <div className="w-full bg-[#ECF2FF] rounded-t-lg group-hover:bg-[#5D87FF] transition-colors" style={{ height: `${Math.max(height, 5)}%` }}></div>
                            <span className="text-[10px] font-bold text-[#5A6A85] mt-2 uppercase">{item.name}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const PackageDistributionWidget: React.FC<{ projects: Project[] }> = ({ projects }) => {
    const distribution = useMemo(() => {
        const counts: Record<string, number> = {};
        projects.forEach(p => {
            counts[p.packageName] = (counts[p.packageName] || 0) + 1;
        });
        const total = projects.length || 1;
        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({ name, count, percentage: (count / total) * 100 }));
    }, [projects]);

    return (
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] h-full">
            <h3 className="font-bold text-lg text-[#2A3547] mb-4">Distribusi Paket</h3>
            <div className="space-y-4">
                {distribution.slice(0, 5).map((pkg, idx) => (
                    <div key={pkg.name}>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-[#2A3547] font-semibold truncate">{pkg.name}</span>
                            <span className="text-[#5A6A85] font-bold">{pkg.count} ({pkg.percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-[#F4F6F9] rounded-full h-2 overflow-hidden">
                            <div 
                                className={`h-full rounded-full ${idx === 0 ? 'bg-[#5D87FF]' : 'bg-[#49BEFF]'}`} 
                                style={{ width: `${pkg.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ConversionFunnelWidget: React.FC<{ leads: Lead[] }> = ({ leads }) => {
    const total = leads.length || 1;
    const stats = [
        { label: 'Total Leads', count: leads.length, color: 'bg-[#5D87FF]' },
        { label: 'Diskusi', count: leads.filter(l => l.status === LeadStatus.DISCUSSION || l.status === LeadStatus.CONVERTED).length, color: 'bg-[#49BEFF]' },
        { label: 'Converted', count: leads.filter(l => l.status === LeadStatus.CONVERTED).length, color: 'bg-[#13DEB9]' },
    ];

    return (
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] h-full">
            <h3 className="font-bold text-lg text-[#2A3547] mb-6">Funnel Konversi</h3>
            <div className="flex flex-col items-center space-y-2">
                {stats.map((step, i) => {
                    const width = (step.count / total) * 100;
                    return (
                        <div key={step.label} className="w-full flex flex-col items-center">
                            <div 
                                className={`${step.color} h-10 flex items-center justify-center text-white text-xs font-bold rounded-xl transition-all duration-500 shadow-2xs`}
                                style={{ width: `${Math.max(width, 30)}%` }}
                            >
                                {step.label}: {step.count}
                            </div>
                            {i < stats.length - 1 && <div className="w-px h-2 bg-[#EAEFF4]"></div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


const LeadSourceWidget: React.FC<{ leads: Lead[] }> = ({ leads }) => {
    const sourceData = useMemo(() => {
        const counts: Record<string, number> = {};
        leads.forEach(l => {
            counts[l.contactChannel] = (counts[l.contactChannel] || 0) + 1;
        });
        const total = leads.length || 1;
        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({ name, count, percentage: (count / total) * 100 }));
    }, [leads]);

    const modernColors = ['#5D87FF', '#49BEFF', '#13DEB9', '#FFAE1F', '#FA896B'];

    return (
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] h-full">
            <h3 className="font-bold text-lg text-[#2A3547] mb-4">Sumber Calon Pengantin</h3>
            <div className="grid grid-cols-1 gap-4">
                {sourceData.map((source, idx) => (
                    <div key={source.name} className="flex items-center gap-3">
                        <div className="flex-grow">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-[#2A3547] font-semibold uppercase tracking-tight">{source.name}</span>
                                <span className="text-[#5A6A85] font-bold">{source.count}</span>
                            </div>
                            <div className="w-full bg-[#F4F6F9] rounded-full h-2 overflow-hidden">
                                <div 
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ 
                                        width: `${source.percentage}%`,
                                        backgroundColor: modernColors[idx % modernColors.length]
                                    }}
                                ></div>
                            </div>
                        </div>
                        <span className="text-xs font-bold text-[#2A3547] w-10 text-right">{source.percentage.toFixed(0)}%</span>
                    </div>
                ))}
                {leads.length === 0 && <p className="text-center text-sm text-[#5A6A85] py-8">Belum ada data calon pengantin.</p>}
            </div>
        </div>
    );
};

const BusinessHealthWidget: React.FC<{ projects: Project[], transactions: Transaction[] }> = ({ projects, transactions }) => {
    const stats = useMemo(() => {
        const totalRevenue = transactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
        const totalExpense = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
        const margin = totalRevenue > 0 ? ((totalRevenue - totalExpense) / totalRevenue) * 100 : 0;
        
        const completed = projects.filter(p => p.status === 'Selesai').length;
        const total = projects.length || 1;
        const successRate = (completed / total) * 100;

        return [
            { label: 'Profit Margin', value: `${margin.toFixed(1)}%`, icon: <TrendingUpIcon className="w-4 h-4" />, iconBg: 'bg-[#E6FFFA]', color: 'text-[#13DEB9]' },
            { label: 'Project Success', value: `${successRate.toFixed(1)}%`, icon: <StarIcon className="w-4 h-4" />, iconBg: 'bg-[#ECF2FF]', color: 'text-[#5D87FF]' },
            { label: 'Avg Revenue/Acara', value: formatCurrency(totalRevenue / total, 0), icon: <DollarSignIcon className="w-4 h-4" />, iconBg: 'bg-[#FEF5E5]', color: 'text-[#FFAE1F]' },
        ];
    }, [projects, transactions]);

    return (
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] h-full">
            <h3 className="font-bold text-lg text-[#2A3547] mb-6">Ringkasan Performa Bisnis</h3>
            <div className="space-y-4">
                {stats.map(stat => (
                    <div key={stat.label} className="flex items-center justify-between p-3.5 bg-[#F4F6F9] rounded-xl border border-[#EAEFF4]">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${stat.iconBg} ${stat.color}`}>{stat.icon}</div>
                            <span className="text-sm font-semibold text-[#5A6A85]">{stat.label}</span>
                        </div>
                        <span className={`text-base font-extrabold ${stat.color}`}>{stat.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


const EMPTY_DASHBOARD_TOTALS = {
    projects: 0,
    activeProjects: 0,
    clients: 0,
    activeClients: 0,
    leads: 0,
    discussionLeads: 0,
    followUpLeads: 0,
    teamMembers: 0,
    transactions: 0,
    revenue: 0,
    expense: 0,
};

interface DashboardProps {
    projects: Project[];
    clients: Client[];
    transactions: Transaction[];
    teamMembers: TeamMember[];
    cards: Card[];
    pockets: FinancialPocket[];
    handleNavigation: (view: ViewType, action?: NavigationAction) => void;
    leads: Lead[];
    teamProjectPayments: TeamProjectPayment[];
    packages: Package[];
    clientFeedback: ClientFeedback[];
    currentUser: User | null;
    projectStatusConfig: ProjectStatusConfig[];
    profile: Profile;
    totals?: typeof EMPTY_DASHBOARD_TOTALS;
}

const Dashboard: React.FC<DashboardProps> = ({
    projects = [],
    clients = [],
    transactions = [],
    teamMembers = [],
    cards = [],
    pockets = [],
    handleNavigation,
    leads = [],
    teamProjectPayments = [],
    packages = [],
    clientFeedback = [],
    currentUser,
    projectStatusConfig = [],
    profile,
    totals,
}) => {
    const uiTextOverrides = useUiTextOverrides();
    const [activeModal, setActiveModal] = useState<'balance' | 'projects' | 'clients' | 'teamMembers' | 'payments' | null>(null);
    const safeTotals = totals ?? EMPTY_DASHBOARD_TOTALS;

    const getSubStatusDisplay = (project: Project) => {
        if (project.activeSubStatuses?.length) {
            return `${project.status}: ${project.activeSubStatuses.join(', ')}`;
        }
        if (project.status === 'Dikirim' && project.shippingDetails) {
            return `Dikirim: ${project.shippingDetails}`;
        }
        return project.status;
    };

    const summary = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const eventsThisMonth = projects.filter(p => {
            const d = new Date(p.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;

        const incomeThisMonth = transactions.filter(t => {
            const d = new Date(t.date);
            return t.type === TransactionType.INCOME && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).reduce((sum, t) => sum + t.amount, 0);

        const unpaidInvoices = projects.filter(p => p.paymentStatus !== PaymentStatus.LUNAS && p.status !== 'Dibatalkan').length;

        return {
            totalBalance: cards.reduce((sum, c) => sum + c.balance, 0),
            activeProjects: safeTotals.activeProjects,
            activeClients: safeTotals.activeClients,
            totalteamMembers: safeTotals.teamMembers,
            eventsThisMonth,
            incomeThisMonth,
            unpaidInvoices
        };
    }, [cards, safeTotals.activeProjects, safeTotals.activeClients, safeTotals.teamMembers, projects, transactions]);

    const activeProjects = useMemo(() => projects.filter(p => p.status !== 'Selesai' && p.status !== 'Dibatalkan'), [projects]);
    const activeClients = useMemo(() => clients.filter(c => c.status === ClientStatus.ACTIVE), [clients]);
    const unpaidTeamPayments = useMemo(() => teamProjectPayments.filter(p => p.status === 'Unpaid'), [teamProjectPayments]);

    const modalTitles: { [key: string]: string } = {
        balance: 'Rincian Saldo',
        projects: 'Daftar Acara Pernikahan Aktif',
        clients: 'Daftar Pengantin Aktif',
        teamMembers: 'Daftar Semua Tim / Vendor',
        payments: 'Rincian Sisa Pembayaran Tim'
    };

    return (
        <div className="space-y-3 sm:space-y-6">
            {/* Command Center Quick Action Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)]">
                <div>
                    <h1 className="text-base sm:text-2xl font-extrabold text-[#2A3547] tracking-tight">
                        {customizeUiText('dashboard.title', '{companyName} Dashboard', uiTextOverrides)
                            .replaceAll('{companyName}', profile.companyName || 'Studio')}
                    </h1>
                    <p className="text-[11px] sm:text-sm text-[#5A6A85] mt-0.5 sm:mt-1">
                        {customizeUiText('dashboard.subtitle', 'Pusat kendali operasional, agenda pernikahan, dan kesehatan finansial studio.', uiTextOverrides)}
                    </p>
                </div>
                <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2.5">
                    <button
                        onClick={() => handleNavigation(ViewType.CLIENTS)}
                        className="min-w-0 flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm font-semibold py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl bg-[#5D87FF] text-white hover:bg-[#4570EA] shadow-xs transition-colors"
                    >
                        <FolderKanbanIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span>+ Acara Pernikahan</span>
                    </button>
                    <button
                        onClick={() => handleNavigation(ViewType.FINANCE)}
                        className="min-w-0 flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm font-semibold py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl bg-[#ECF2FF] text-[#5D87FF] hover:bg-[#d8e6ff] transition-colors"
                    >
                        <DollarSignIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span>+ Catat Transaksi</span>
                    </button>
                </div>
            </div>

            {/* 4 Core Primary Vital KPI Cards using ModernStatCard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
                <ModernStatCard
                    icon={<DollarSignIcon className="w-6 h-6" />}
                    title="Total Saldo Kas & Bank"
                    value={formatCurrency(summary.totalBalance)}
                    subtitle="Saldo semua kartu & kas tunai"
                    iconColorVariant="primary"
                    compactOnMobile
                    onClick={() => setActiveModal('balance')}
                />
                <ModernStatCard
                    icon={<TrendingUpIcon className="w-6 h-6" />}
                    title="Pendapatan Bulan Ini"
                    value={formatCurrency(summary.incomeThisMonth)}
                    valueClassName="!text-[#166534]"
                    subtitle={`Target: ${formatCurrency(50000000)}`}
                    iconColorVariant="success"
                    compactOnMobile
                    change="+12.5%"
                    changeType="increase"
                />
                <ModernStatCard
                    icon={<FolderKanbanIcon className="w-6 h-6" />}
                    title="Acara Aktif"
                    value={summary.activeProjects.toString()}
                    subtitle="Project sedang berjalan"
                    iconColorVariant="secondary"
                    compactOnMobile
                    onClick={() => setActiveModal('projects')}
                />
                <ModernStatCard
                    icon={<UsersIcon className="w-6 h-6" />}
                    title="Pengantin Aktif"
                    value={summary.activeClients.toString()}
                    subtitle="Pengantin dengan acara berjalan"
                    iconColorVariant="warning"
                    compactOnMobile
                    onClick={() => setActiveModal('clients')}
                />
            </div>

            {/* Action Alert Bar (Operational Signals) */}
            <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#EAEFF4] shadow-[0_9px_17.5px_rgba(0,0,0,0.05)]">
                <div className="dashboard-action-grid grid min-w-0 grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <button
                        onClick={() => handleNavigation(ViewType.CALENDAR)}
                        className="dashboard-action-card min-w-0 flex items-center gap-3 p-3 rounded-xl bg-[#F4F6F9] hover:bg-[#ECF2FF] border border-[#EAEFF4] hover:border-[#5D87FF]/30 transition-all text-left group"
                    >
                        <div className="p-2.5 rounded-xl bg-[#FEF5E5] text-[#FFAE1F] group-hover:scale-105 transition-transform flex-shrink-0">
                            <CalendarIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase font-bold text-[#5A6A85] tracking-wider">Jadwal Bulan Ini</p>
                            <p className="text-sm font-extrabold text-[#2A3547]">{summary.eventsThisMonth} Acara</p>
                        </div>
                    </button>

                    <button
                        onClick={() => handleNavigation(ViewType.CLIENTS)}
                        className="dashboard-action-card min-w-0 flex items-center gap-3 p-3 rounded-xl bg-[#F4F6F9] hover:bg-[#FDEDE8] border border-[#EAEFF4] hover:border-[#FA896B]/30 transition-all text-left group"
                    >
                        <div className="p-2.5 rounded-xl bg-[#FDEDE8] text-[#FA896B] group-hover:scale-105 transition-transform flex-shrink-0">
                            <AlertCircleIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase font-bold text-[#5A6A85] tracking-wider">Invoice Belum Lunas</p>
                            <p className="text-sm font-extrabold text-[#FA896B]">{summary.unpaidInvoices} Invoice</p>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveModal('teamMembers')}
                        className="dashboard-action-card min-w-0 flex items-center gap-3 p-3 rounded-xl bg-[#F4F6F9] hover:bg-[#ECF2FF] border border-[#EAEFF4] hover:border-[#5D87FF]/30 transition-all text-left group"
                    >
                        <div className="p-2.5 rounded-xl bg-[#ECF2FF] text-[#5D87FF] group-hover:scale-105 transition-transform flex-shrink-0">
                            <BriefcaseIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase font-bold text-[#5A6A85] tracking-wider">Tim & Vendor</p>
                            <p className="text-sm font-extrabold text-[#2A3547]">{summary.totalteamMembers} Orang</p>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveModal('payments')}
                        className="dashboard-action-card min-w-0 flex items-center gap-3 p-3 rounded-xl bg-[#F4F6F9] hover:bg-[#E8F7FF] border border-[#EAEFF4] hover:border-[#49BEFF]/30 transition-all text-left group"
                    >
                        <div className="p-2.5 rounded-xl bg-[#E8F7FF] text-[#49BEFF] group-hover:scale-105 transition-transform flex-shrink-0">
                            <DollarSignIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase font-bold text-[#5A6A85] tracking-wider">Sisa Honor Tim</p>
                            <p className="text-sm font-extrabold text-[#5D87FF]">
                                {formatCurrency(teamProjectPayments.filter(p => p.status === 'Unpaid').reduce((s, p) => s + p.fee, 0))}
                            </p>
                        </div>
                    </button>
                </div>
            </div>

            {/* SECTION 1: Operasional & Agenda */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-[#5D87FF]" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#5A6A85]">
                        Operasional & Agenda
                    </h2>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                    <div className="col-span-1 xl:col-span-7">
                        <UpcomingCalendarWidget projects={projects} handleNavigation={handleNavigation} />
                    </div>
                    <div className="col-span-1 xl:col-span-5">
                        <ProjectStatusWidget projects={projects} projectStatusConfig={projectStatusConfig} handleNavigation={handleNavigation} />
                    </div>
                    <div className="col-span-1 xl:col-span-12">
                        <MobileCollapsibleSection
                            title="Kalender Acara Bulan Ini"
                            subtitle="Lihat jadwal lengkap bulanan"
                            variant="card"
                            actionLabelOpen="Lihat Kalender"
                            actionLabelClose="Tutup"
                        >
                            <CalendarMonthWidget projects={projects} profile={profile} handleNavigation={handleNavigation} />
                        </MobileCollapsibleSection>
                    </div>
                </div>
            </div>

            {/* SECTION 2: Finansial & Arus Kas */}
            <MobileCollapsibleSection
                title="Kesehatan Finansial & Arus Kas"
                subtitle={`${cards.length} kartu · ${transactions.length} transaksi`}
                variant="stats"
                actionLabelOpen="Lihat Finansial"
                actionLabelClose="Tutup"
            >
                <div className="space-y-3">
                    <div className="hidden md:flex items-center gap-2">
                        <DollarSignIcon className="w-4 h-4 text-[#5D87FF]" />
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#5A6A85]">
                            Kesehatan Finansial & Kas
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                        <div className="col-span-1 xl:col-span-8">
                            <IncomeChartWidget transactions={transactions} projects={projects} />
                        </div>
                        <div className="col-span-1 xl:col-span-4">
                            <BusinessHealthWidget projects={projects} transactions={transactions} />
                        </div>
                        <div className="col-span-1 xl:col-span-7">
                            <MyCardsWidget cards={cards} handleNavigation={handleNavigation} />
                        </div>
                        <div className="col-span-1 xl:col-span-5">
                            <RecentTransactionsWidget transactions={transactions} />
                        </div>
                    </div>
                </div>
            </MobileCollapsibleSection>

            {/* SECTION 3: CRM & Penjualan */}
            <MobileCollapsibleSection
                title="Pipeline Pengantin & Analitik Penjualan"
                subtitle={`${leads.length} prospek · ${projects.length} acara`}
                variant="stats"
                actionLabelOpen="Lihat Analitik"
                actionLabelClose="Tutup"
            >
                <div className="space-y-3">
                    <div className="hidden md:flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-[#5D87FF]" />
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#5A6A85]">
                            Pipeline Pengantin & Penjualan
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        <div className="col-span-1">
                            <LeadSourceWidget leads={leads} />
                        </div>
                        <div className="col-span-1">
                            <ConversionFunnelWidget leads={leads} />
                        </div>
                        <div className="col-span-1">
                            <PackageDistributionWidget projects={projects} />
                        </div>
                        <div className="col-span-1">
                            <LeadsSummaryWidget leads={leads} handleNavigation={handleNavigation} />
                        </div>
                        <div className="col-span-1">
                            <BookingTrendWidget projects={projects} />
                        </div>
                        <div className="col-span-1">
                            <ClientSatisfactionWidget feedback={clientFeedback} handleNavigation={handleNavigation} />
                        </div>
                    </div>
                </div>
            </MobileCollapsibleSection>

            {/* SECTION 4: Aksi Cepat */}
            <MobileCollapsibleSection
                title="Akses Cepat Menu"
                subtitle="Pintasan navigasi halaman"
                variant="card"
                actionLabelOpen="Buka Pintasan"
                actionLabelClose="Tutup"
            >
                <QuickLinksWidget handleNavigation={handleNavigation} currentUser={currentUser} />
            </MobileCollapsibleSection>

            {/* StatCard Detail Modals */}
            <StatCardModal
                isOpen={activeModal === 'balance'}
                onClose={() => setActiveModal(null)}
                icon={<DollarSignIcon className="w-6 h-6" />}
                title="Total Saldo"
                value={formatCurrency(summary.totalBalance)}
                subtitle="Saldo semua kartu & kas"
                colorVariant="blue"
                description={`Total saldo mencakup semua kartu bank, kartu kredit, dan uang tunai yang Anda miliki.\n\nRincian:\n• Kartu Bank: ${cards.filter(c => c.cardType === 'Debit').length} kartu\n• Kartu Kredit: ${cards.filter(c => c.cardType === 'Kredit').length} kartu\n• Tunai: ${cards.filter(c => c.cardType === 'Tunai').length} akun\n\nSaldo ini diperbarui secara real-time berdasarkan transaksi yang Anda catat.`}
            >
                <div className="space-y-4">
                    <h4 className="font-semibold text-brand-text-light border-b border-brand-border pb-2">Kartu & Tunai</h4>
                    <div className="space-y-3">
                        {cards.map(card => (
                            <div key={card.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center hover:bg-brand-input transition-colors">
                                <p className="font-semibold text-brand-text-light">{card.bankName} {card.id !== 'CARD_CASH' ? `**** ${card.lastFourDigits}` : '(Tunai)'}</p>
                                <p className="font-semibold text-brand-accent">{formatCurrency(card.balance)}</p>
                            </div>
                        ))}
                    </div>
                    {pockets.length > 0 && (
                        <>
                            <h4 className="font-semibold text-brand-text-light border-b border-brand-border pb-2 mt-6">Kantong</h4>
                            <div className="space-y-3">
                                {pockets.map(pocket => (
                                    <div key={pocket.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center hover:bg-brand-input transition-colors">
                                        <p className="font-semibold text-brand-text-light">{pocket.name}</p>
                                        <p className="font-semibold text-brand-accent">{formatCurrency(pocket.amount)}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </StatCardModal>

            <StatCardModal
                isOpen={activeModal === 'projects'}
                onClose={() => setActiveModal(null)}
                icon={<FolderKanbanIcon className="w-6 h-6" />}
                title="Acara Pernikahan Aktif"
                value={summary.activeProjects.toString()}
                subtitle="Acara Pernikahan yang sedang berjalan"
                colorVariant="purple"
                description={`Acara Pernikahan aktif adalah Acara Pernikahan yang statusnya bukan "Selesai" atau "Dibatalkan".\n\nAcara Pernikahan aktif memerlukan perhatian dan tindak lanjut untuk memastikan penyelesaian tepat waktu.`}
            >
                <div className="space-y-3">
                    {projects.filter(p => p.status !== 'Selesai' && p.status !== 'Dibatalkan').map(project => (
                        <div key={project.id} className="p-4 bg-brand-bg rounded-lg hover:bg-brand-input transition-colors cursor-pointer" onClick={() => { setActiveModal(null); handleNavigation(ViewType.CLIENTS, { type: 'VIEW_CLIENT_DETAILS', id: project.clientId }); }}>
                            <div className="flex justify-between items-start mb-2">
                                <p className="font-semibold text-brand-text-light">{project.projectName}</p>
                                <span className="text-xs px-2 py-1 rounded-full bg-brand-accent/20 text-brand-accent">{project.status}</span>
                            </div>
                            <p className="text-sm text-brand-text-secondary">{clients.find(c => c.id === project.clientId)?.name || 'Unknown Client'}</p>
                            <p className="text-sm text-brand-accent font-semibold mt-2">{formatCurrency(project.totalCost)}</p>
                        </div>
                    ))}
                </div>
            </StatCardModal>

            <StatCardModal
                isOpen={activeModal === 'clients'}
                onClose={() => setActiveModal(null)}
                icon={<UsersIcon className="w-6 h-6" />}
                title="Pengantin Aktif"
                value={summary.activeClients.toString()}
                subtitle="Pengantin dengan Acara Pernikahan berjalan"
                colorVariant="green"
                description={`Pengantin aktif adalah pengantin yang memiliki minimal satu Acara Pernikahan yang sedang berjalan.\n\nMempertahankan hubungan baik dengan pengantin aktif sangat penting untuk bisnis Anda.`}
            >
                <div className="space-y-3">
                    {clients.filter(c => projects.some(p => p.clientId === c.id && p.status !== 'Selesai' && p.status !== 'Dibatalkan')).map(client => {
                        const clientProjects = projects.filter(p => p.clientId === client.id && p.status !== 'Selesai' && p.status !== 'Dibatalkan');
                        return (
                            <div key={client.id} className="p-4 bg-brand-bg rounded-lg hover:bg-brand-input transition-colors cursor-pointer" onClick={() => { setActiveModal(null); handleNavigation(ViewType.CLIENTS); }}>
                                <p className="font-semibold text-brand-text-light">{client.name}</p>
                                <p className="text-sm text-brand-text-secondary mt-1">{clientProjects.length} Acara Pernikahan aktif</p>
                                <p className="text-xs text-brand-text-secondary mt-1">{client.email}</p>
                            </div>
                        );
                    })}
                </div>
            </StatCardModal>

            <StatCardModal
                isOpen={activeModal === 'teamMembers'}
                onClose={() => setActiveModal(null)}
                icon={<BriefcaseIcon className="w-6 h-6" />}
                title="Total Tim / Vendor"
                value={summary.totalteamMembers.toString()}
                subtitle="Anggota tim terdaftar"
                colorVariant="orange"
                description={`Total Tim / Vendor mencakup semua anggota tim yang terdaftar dalam sistem Anda.\n\nTim / Vendor dapat ditugaskan ke berbagai Acara Pernikahan dan menerima fee sesuai pekerjaan mereka.`}
            >
                <div className="space-y-3">
                    {teamMembers.map(member => {
                        const unpaidPayments = teamProjectPayments.filter(p => p.teamMemberId === member.id && p.status === 'Unpaid');
                        const totalUnpaid = unpaidPayments.reduce((sum, p) => sum + p.fee, 0);
                        return (
                            <div key={member.id} className="p-4 bg-brand-bg rounded-lg hover:bg-brand-input transition-colors cursor-pointer" onClick={() => { setActiveModal(null); handleNavigation(ViewType.TEAM); }}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-brand-text-light">{member.name}</p>
                                        <p className="text-sm text-brand-text-secondary">{member.role}</p>
                                    </div>
                                    {totalUnpaid > 0 && (
                                        <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800">
                                            {formatCurrency(totalUnpaid)} belum dibayar
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </StatCardModal>

            <Modal isOpen={!!activeModal && !['balance', 'projects', 'clients', 'teamMembers'].includes(activeModal)} onClose={() => setActiveModal(null)} title={activeModal ? modalTitles[activeModal] : ''} size="2xl">
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                    {activeModal === 'balance' && (
                        <div className="space-y-4">
                            <h4 className="font-semibold text-gradient border-b border-brand-border pb-2">Kartu & Tunai</h4>
                            <div className="space-y-3">
                                {cards.map(card => (
                                    <div key={card.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                        <p className="font-semibold text-brand-text-light">{card.bankName} {card.id !== 'CARD_CASH' ? `**** ${card.lastFourDigits}` : '(Tunai)'}</p>
                                        <p className="font-semibold text-brand-text-light">{formatCurrency(card.balance)}</p>
                                    </div>
                                ))}
                            </div>
                            <h4 className="font-semibold text-gradient border-b border-brand-border pb-2 mt-6">Kantong</h4>
                            <div className="space-y-3">
                                {pockets.map(pocket => (
                                    <div key={pocket.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                        <p className="font-semibold text-brand-text-light">{pocket.name}</p>
                                        <p className="font-semibold text-brand-text-light">{formatCurrency(pocket.amount)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {activeModal === 'projects' && (
                        <div className="space-y-3">
                            {activeProjects.length > 0 ? activeProjects.map(project => (
                                <div key={project.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-brand-text-light">{project.projectName}</p>
                                        <p className="text-sm text-brand-text-secondary">{project.clientName}</p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(project.status, projectStatusConfig)}`}>
                                        {getSubStatusDisplay(project)}
                                    </span>
                                </div>
                            )) : <p className="text-center text-brand-text-secondary py-8">Tidak ada Acara Pernikahan aktif.</p>}
                        </div>
                    )}
                    {activeModal === 'clients' && (
                        <div className="space-y-3">
                            {activeClients.map(client => (
                                <div key={client.id} className="p-3 bg-brand-bg rounded-lg">
                                    <p className="font-semibold text-brand-text-light">{client.name}</p>
                                    <p className="text-sm text-brand-text-secondary">{client.email}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {activeModal === 'teamMembers' && (
                        <div className="space-y-3">
                            {teamMembers.map(member => (
                                <div key={member.id} className="p-3 bg-brand-bg rounded-lg">
                                    <p className="font-semibold text-brand-text-light">{member.name}</p>
                                    <p className="text-sm text-brand-text-secondary">{member.role}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {activeModal === 'payments' && (
                        <div className="space-y-3">
                            {unpaidTeamPayments.length > 0 ? unpaidTeamPayments.map(p => (
                                <div key={p.id} className="p-3 bg-brand-bg rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-brand-text-light">{p.teamMemberName}</p>
                                        <p className="text-sm text-brand-text-secondary">Acara Pernikahan: {projects.find(proj => proj.id === p.projectId)?.projectName || 'N/A'}</p>
                                    </div>
                                    <p className="font-semibold text-brand-danger">{formatCurrency(p.fee)}</p>
                                </div>
                            )) : <p className="text-center text-brand-text-secondary py-8">Tidak ada pembayaran yang tertunda.</p>}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default Dashboard;
