import React, { useState, useMemo, useEffect } from 'react';
import { Check, ListTodo, Pencil, Plus, Save, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Project, TeamMember, Profile, AssignedTeamMember, Client, ViewType, NavigationAction, CalendarEvent, PaymentStatus } from '../../../types';
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, UsersIcon, PlusIcon, MapPinIcon, CalendarIcon, DollarSignIcon, LinkIcon, FolderKanbanIcon, BriefcaseIcon } from '../../../constants';
import Modal from '../../../shared/ui/Modal';
import BottomSheet from '../../../shared/ui/BottomSheet';
import StatCard from '../../../shared/ui/StatCard';
import { MobileCollapsibleSection } from '../../../components/ui/MobileProgressiveDisclosure';
import { listCalendarEventsInRange, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, parseProjectMeetingNotes } from '../../../services/calendarEvents';
import { updateProject as updateProjectInDb } from '../../../services/projects';
import supabase from '../../../lib/supabaseClient';

// --- HELPER FUNCTIONS ---

const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const ClientAvatar: React.FC<{ client?: Client | null; name: string; className: string }> = ({ client, name, className }) => (
    <div className={`${className} rounded-full overflow-hidden shrink-0 bg-brand-accent/10 flex items-center justify-center text-[9px] font-bold text-brand-accent`}>
        {client?.avatarUrl ? <img src={client.avatarUrl} alt={`${name} avatar`} className="w-full h-full object-cover" /> : getInitials(name)}
    </div>
);

const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const weekdaysFull = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

const eventTypeColors: { [key: string]: string } = {
    'Meeting Pengantin': '#2563eb', // blue-600
    'Survey Lokasi': '#16a34a',     // green-600
    'Libur': '#475569',             // slate-600
    'Workshop': '#9333ea',          // purple-600
    'Lainnya': '#ca8a04',           // yellow-600
};

const getEventColor = (event: Project, profile: Profile) => {
    const isInternalEvent = profile.eventTypes?.includes(event.projectType);
    if (isInternalEvent) {
        return eventTypeColors[event.projectType] || '#64748b';
    }
    return profile.projectStatusConfig?.find(s => s.name === event.status)?.color || '#64748b';
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const calendarEventToProject = (event: CalendarEvent, teamMembers: TeamMember[]): Project => {
    const date = event.date || (typeof event.startAt === 'string' ? event.startAt.slice(0, 10) : '');
    const startTime = event.allDay ? undefined : event.startAt?.match(/T(\d{2}:\d{2})/)?.[1];
    const endTime = event.allDay ? undefined : event.endAt?.match(/T(\d{2}:\d{2})/)?.[1];
    const assignedMember = event.teamMemberId ? teamMembers.find(member => member.id === event.teamMemberId) : undefined;

    return {
        id: event.id,
        projectName: event.title,
        clientName: '',
        clientId: 'INTERNAL',
        projectType: event.eventType,
        packageName: '',
        packageId: '',
        addOns: [],
        date,
        location: event.location || '',
        progress: 0,
        status: event.status,
        totalCost: 0,
        amountPaid: 0,
        paymentStatus: PaymentStatus.BELUM_BAYAR,
        team: assignedMember ? [{
            memberId: assignedMember.id,
            name: assignedMember.name,
            role: assignedMember.role,
            fee: assignedMember.standardFee,
        }] : [],
        notes: event.notes,
        startTime,
        endTime,
        tasks: event.tasks,
    };

};

const calendarEventToCalendarProject = (
    event: CalendarEvent,
    teamMembers: TeamMember[],
    projects: Project[],
): Project => {
    const meeting = parseProjectMeetingNotes(event.notes);
    if (!meeting) return calendarEventToProject(event, teamMembers);

    const sourceProject = projects.find(project => project.id === meeting.projectId);
    if (!sourceProject) return calendarEventToProject(event, teamMembers);

    const timeFromDateTime = (value: string) => value.match(/T(\d{2}:\d{2})/)?.[1];
    const meetingName = meeting.kind === 'zoom' ? 'Zoom Meeting' : 'Meeting Pengantin';
    return {
        ...sourceProject,
        id: event.id,
        projectName: `${meetingName} — ${sourceProject.projectName}`,
        date: event.date || event.startAt.slice(0, 10),
        startTime: event.allDay ? undefined : timeFromDateTime(event.startAt),
        endTime: event.allDay ? undefined : timeFromDateTime(event.endAt),
        location: meeting.location || event.location || '',
        notes: [
            meeting.resultNotes,
            meeting.kind === 'zoom' && meeting.zoomUrl ? `Link Zoom: ${meeting.zoomUrl}` : '',
        ].filter(Boolean).join('\n\n') || undefined,
    };
};

type CalendarEventColumn = { index: number; count: number };

const getEventTiming = (event: Project) => {
    const parseTime = (value: string | undefined, fallback: number) => {
        if (!value) return fallback;
        const [hours, minutes] = value.split(':').map(Number);
        return Number.isFinite(hours) && Number.isFinite(minutes)
            ? hours * 60 + minutes
            : fallback;
    };

    const start = event.startTime ? parseTime(event.startTime, 0) : 0;
    const requestedEnd = event.startTime
        ? parseTime(event.endTime, start + 60)
        : start + 60;
    const end = requestedEnd > start ? requestedEnd : start + 60;

    return { start, end: Math.max(end, start + 30) };
};

const getCompactEventTitle = (event: Project) =>
    event.projectType.toLowerCase().includes('meeting')
        ? event.projectType
        : event.projectName;

const getEventColumnLayout = (events: Project[]): Map<string, CalendarEventColumn> => {
    const intervals = events.map(event => {
        const { start, end } = getEventTiming(event);
        return { event, start, end };
    }).sort((a, b) => a.start - b.start || a.end - b.end);

    const layout = new Map<string, CalendarEventColumn>();
    let group: typeof intervals = [];
    let groupEnd = -1;

    const assignGroup = () => {
        if (group.length === 0) return;
        const laneEnds: number[] = [];
        const assignments: { id: string; index: number }[] = [];

        group.forEach(({ event, start, end }) => {
            let lane = laneEnds.findIndex(laneEnd => laneEnd <= start);
            if (lane === -1) lane = laneEnds.length;
            laneEnds[lane] = end;
            assignments.push({ id: event.id, index: lane });
        });

        assignments.forEach(({ id, index }) => layout.set(id, { index, count: laneEnds.length }));
        group = [];
        groupEnd = -1;
    };

    intervals.forEach(interval => {
        if (group.length > 0 && interval.start >= groupEnd) assignGroup();
        group.push(interval);
        groupEnd = Math.max(groupEnd, interval.end);
    });
    assignGroup();

    return layout;
};

// --- SUB-COMPONENTS ---

interface CalendarSidebarProps {
    profile: Profile;
    isClientProjectVisible: boolean;
    visibleEventTypes: Set<string> | null;
    selectedClientId: string | null;
    clientsThisMonth: { id: string; name: string }[];
    stats: { totalProjects: number; totalInternal: number; totalClients: number; activeTeamMembers: number; teamStats?: Array<{ member: TeamMember; eventCount: number }> };
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onAddEvent: () => void;
    onClientFilterChange: (isVisible: boolean) => void;
    onEventTypeFilterChange: (eventType: string) => void;
    onClientSelect: (clientId: string | null) => void;
    onTeamMemberSelect: (member: TeamMember | null) => void;
    currentDate: Date;
    onDateSelect: (date: Date) => void;
}

const CalendarSidebar: React.FC<CalendarSidebarProps> = ({ profile, isClientProjectVisible, visibleEventTypes, selectedClientId, clientsThisMonth, stats, searchTerm, onSearchChange, onAddEvent, onClientFilterChange, onEventTypeFilterChange, onClientSelect, onTeamMemberSelect, currentDate, onDateSelect }) => {
    // Mini Calendar Logic
    const [miniDate, setMiniDate] = useState(new Date(currentDate));

    // Sync mini calendar when main calendar changes externally
    useEffect(() => {
        setMiniDate(new Date(currentDate));
    }, [currentDate]);

    const handlePrevMonth = () => {
        setMiniDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setMiniDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const daysInMiniMonth = useMemo(() => {
        const days = [];
        const firstDay = new Date(miniDate.getFullYear(), miniDate.getMonth(), 1);
        const lastDay = new Date(miniDate.getFullYear(), miniDate.getMonth() + 1, 0);

        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - startDate.getDay());

        const endDate = new Date(lastDay);
        endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

        let d = new Date(startDate);
        while (d <= endDate) {
            days.push(new Date(d));
            d.setDate(d.getDate() + 1);
        }
        return days;
    }, [miniDate]);

    return (
        <div className="w-72 xl:w-80 border-r border-brand-border/40 p-5 flex flex-col hidden lg:flex overflow-y-auto bg-brand-surface/20 backdrop-blur-sm custom-scrollbar">
            <div className="flex items-center gap-3 mb-6 p-3 bg-white/40 rounded-2xl border border-brand-border/30 shadow-sm animate-fade-in">
                <div className="w-10 h-10 rounded-full bg-brand-accent/10 flex items-center justify-center font-bold text-brand-accent shadow-inner">
                    {getInitials(profile.fullName)}
                </div>
                <div className="min-w-0">
                    <p className="font-semibold text-sm text-brand-text-light truncate">{profile.fullName?.split(' ')[0] || 'User'}</p>
                    <p className="text-xs text-brand-text-secondary truncate">{profile.email}</p>
                </div>
            </div>
            <button onClick={onAddEvent} className="button-primary w-full mb-6 inline-flex items-center justify-center gap-2 shadow-sm">
                <PlusIcon className="w-5 h-5" />
                Buat Agenda Baru
            </button>

            {/* Mini Calendar Start */}
            <div className="mb-6 p-4 glass-card rounded-2xl border border-brand-border/40 shadow-sm animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={handlePrevMonth} className="p-1.5 rounded-full hover:bg-brand-input transition-colors text-brand-text-secondary"><ChevronLeftIcon className="w-4 h-4" /></button>
                    <h3 className="text-xs font-semibold text-brand-text-light">{miniDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={handleNextMonth} className="p-1.5 rounded-full hover:bg-brand-input transition-colors text-brand-text-secondary"><ChevronRightIcon className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((d, i) => (
                        <div key={i} className="text-[10px] font-semibold text-brand-text-secondary">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                    {daysInMiniMonth.map((day, i) => {
                        const isCurrentMonth = day.getMonth() === miniDate.getMonth();
                        const isToday = day.toDateString() === new Date().toDateString();
                        const isSelectedDate = day.toDateString() === currentDate.toDateString();

                        return (
                            <button
                                key={i}
                                onClick={() => onDateSelect(day)}
                                className={`w-7 h-7 mx-auto rounded-full text-xs font-medium flex items-center justify-center transition-all
                                ${!isCurrentMonth ? 'text-brand-text-secondary/30 hover:bg-white/40' :
                                        isSelectedDate ? 'bg-brand-accent text-white shadow-md scale-110 z-10' :
                                            isToday ? 'bg-brand-accent/20 text-brand-accent font-bold hover:bg-brand-accent/30' :
                                                'text-brand-text-light hover:bg-white/60 hover:shadow-sm'}`}
                            >
                                {day.getDate()}
                            </button>
                        );
                    })}
                </div>
            </div>
            {/* Mini Calendar End */}

            <div className="mb-6 p-4 glass-card rounded-2xl space-y-3 border border-brand-border/40 shadow-sm">
                <h3 className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-wider">Statistik Bulan Ini</h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-white/50 border border-brand-border/20">
                        <p className="text-xl font-bold text-brand-accent leading-tight">{stats.totalProjects}</p>
                        <p className="text-[9px] font-medium text-brand-text-secondary uppercase tracking-wider mt-0.5">Acara Agenda</p>
                    </div>
                    <div className="p-2 rounded-xl bg-white/50 border border-brand-border/20">
                        <p className="text-xl font-bold text-brand-accent leading-tight">{stats.totalInternal}</p>
                        <p className="text-[9px] font-medium text-brand-text-secondary uppercase tracking-wider mt-0.5">Internal</p>
                    </div>
                    <div className="p-2 rounded-xl bg-white/50 border border-brand-border/20">
                        <p className="text-xl font-bold text-brand-accent leading-tight">{stats.totalClients}</p>
                        <p className="text-[9px] font-medium text-brand-text-secondary uppercase tracking-wider mt-0.5">Pengantin</p>
                    </div>
                    <div className="p-2 rounded-xl bg-white/50 border border-brand-border/20">
                        <p className="text-xl font-bold text-brand-accent leading-tight">{stats.activeTeamMembers}</p>
                        <p className="text-[9px] font-medium text-brand-text-secondary uppercase tracking-wider mt-0.5">Tim</p>
                    </div>
                </div>
            </div>

            {clientsThisMonth.length > 0 && (
                <div className="mb-4">
                    <h3 className="text-xs font-semibold text-brand-text-secondary uppercase tracking-wider mb-2">Pengantin Bulan Ini</h3>
                    <select value={selectedClientId || ''} onChange={(e) => onClientSelect(e.target.value || null)} className="input-field w-full text-sm py-2">
                        <option value="">Semua Pengantin</option>
                        {clientsThisMonth.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <p className="text-[10px] text-brand-text-secondary mt-1">Filter Acara Agenda berdasarkan pengantin</p>
                </div>
            )}

            {stats.teamStats && stats.teamStats.length > 0 && (
                <div className="mb-4">
                    <h3 className="text-xs font-semibold text-brand-text-secondary uppercase tracking-wider mb-2">Statistik Tim</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {stats.teamStats.sort((a, b) => b.eventCount - a.eventCount).map(({ member, eventCount }) => (
                            <div
                                key={member.id}
                                onClick={() => onTeamMemberSelect(member)}
                                className="p-3 rounded-xl bg-white/50 border border-brand-border/40 cursor-pointer hover:bg-white transition-colors flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-accent/10 flex items-center justify-center text-brand-accent font-bold text-sm border border-brand-accent/20">
                                        {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" /> : getInitials(member.name)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-brand-text-light text-sm truncate">{member.name}</p>
                                        <p className="text-[10px] text-brand-text-secondary truncate">{member.role}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-brand-accent text-lg leading-tight">{eventCount}</p>
                                    <p className="text-[9px] text-brand-text-secondary uppercase tracking-wider">Acara</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-brand-text-secondary mt-1">Klik untuk lihat detail acara tim</p>
                </div>
            )}

            <label className="mb-4 flex items-center gap-2 rounded-xl border border-brand-border/60 bg-white px-3 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-brand-text-secondary" />
                <input type="search" aria-label="Cari acara kalender" value={searchTerm} onChange={e => onSearchChange(e.target.value)} placeholder="Cari acara, pengantin, lokasi" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <h3 className="text-xs font-semibold text-brand-text-secondary uppercase tracking-wider mb-2">Filter Tampilan</h3>
            <div className="space-y-1">
                <label className="flex items-center p-2 rounded-lg hover:bg-brand-bg cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 rounded flex-shrink-0 transition-colors" checked={isClientProjectVisible} onChange={(e) => onClientFilterChange(e.target.checked)} style={{ accentColor: '#ef4444' }} />
                    <span className="ml-2 text-sm font-medium text-brand-text-light">Acara Agenda Pengantin</span>
                </label>
                {(profile.eventTypes || []).map(type => (
                    <label key={type} className="flex items-center p-2 rounded-lg hover:bg-brand-bg cursor-pointer">
                        <input type="checkbox" className="h-4 w-4 rounded flex-shrink-0 transition-colors" checked={visibleEventTypes === null || visibleEventTypes.has(type)} onChange={() => onEventTypeFilterChange(type)} style={{ accentColor: eventTypeColors[type] || '#94a3b8' }} />
                        <span className="w-2 h-2 rounded-full ml-2" style={{ backgroundColor: eventTypeColors[type] || '#94a3b8' }}></span>
                        <span className="ml-2 text-sm font-medium text-brand-text-light">{type}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};


interface CalendarHeaderProps {
    currentDate: Date;
    selectedYear: number;
    viewMode: 'Day' | 'Week' | 'Month' | 'Year' | 'Team' | 'Agenda' | 'Client';
    stats?: { totalProjects: number; totalInternal: number; totalClients: number; activeTeamMembers: number; teamStats?: Array<{ member: TeamMember; eventCount: number }> };
    onPrev: () => void;
    onNext: () => void;
    onAddEvent: () => void;
    onToday: () => void;
    onViewModeChange: (mode: 'Day' | 'Week' | 'Month' | 'Year' | 'Team' | 'Agenda' | 'Client') => void;
    onYearChange: (year: number) => void;
    onInfoClick: () => void;
    onFilterClick: () => void;
    activeFilterCount: number;
    onStatClick: (stat: 'events' | 'internal' | 'clients' | 'team') => void;
    onPrint?: () => void;
    onExport?: () => void;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({ currentDate, selectedYear, viewMode, stats, onPrev, onNext, onAddEvent, onToday, onViewModeChange, onYearChange, onInfoClick, onFilterClick, activeFilterCount, onStatClick, onPrint, onExport }) => {
    const getHeaderTitle = () => {
        if (viewMode === 'Day') {
            return currentDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else if (viewMode === 'Week' || viewMode === 'Team') {
            const weekStart = new Date(currentDate);
            weekStart.setDate(currentDate.getDate() - currentDate.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            const startLabel = weekStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            const endLabel = weekEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            return `${startLabel} - ${endLabel}`;
        } else if (viewMode === 'Year') {
            return `Tahun ${selectedYear}`;
        }
        return currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    };

    const getMobileTitle = () => {
        if (viewMode === 'Day') {
            return currentDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        } else if (viewMode === 'Week' || viewMode === 'Team') {
            const weekStart = new Date(currentDate);
            weekStart.setDate(currentDate.getDate() - currentDate.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            const startLabel = weekStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            const endLabel = weekEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            return `${startLabel} - ${endLabel}`;
        }
        return currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    };

    const getViewLabel = (view: CalendarHeaderProps['viewMode']) => ({
        Day: 'Hari',
        Week: 'Minggu',
        Month: 'Bulan',
        Year: 'Tahun',
        Team: 'Tim',
        Client: 'Pengantin',
        Agenda: 'Agenda'
    })[view];

    return (
        <div className="flex-shrink-0 border-b border-brand-border">
            {/* Mobile Header */}
            <div className="sm:hidden">
                <div className="p-3 flex items-center justify-between">
                    <h2 className="min-w-0 truncate text-sm font-semibold text-brand-text-light">{getMobileTitle()}</h2>
                    <div className="flex flex-shrink-0 items-center gap-2">
                        <button onClick={onToday} className="button-secondary px-3 py-1.5 text-xs">Hari Ini</button>
                        <button onClick={onAddEvent} className="button-primary p-2" aria-label="Buat Agenda Baru" title="Buat Agenda Baru">
                            <PlusIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                {stats && (
                    <div className="grid grid-cols-4 gap-2 px-3 pb-2 text-center">
                        <button type="button" onClick={() => onStatClick('events')} className="min-w-0 rounded-lg py-1 text-center hover:bg-brand-bg">
                            <span className="block text-sm font-bold text-brand-accent">{stats.totalProjects}</span>
                            <span className="block text-[9px] text-brand-text-secondary">Acara</span>
                        </button>
                        <button type="button" onClick={() => onStatClick('internal')} className="min-w-0 rounded-lg py-1 text-center hover:bg-brand-bg">
                            <span className="block text-sm font-bold text-brand-text-primary">{stats.totalInternal}</span>
                            <span className="block text-[9px] text-brand-text-secondary">Internal</span>
                        </button>
                        <button type="button" onClick={() => onStatClick('clients')} className="min-w-0 rounded-lg py-1 text-center hover:bg-brand-bg">
                            <span className="block text-sm font-bold text-brand-text-primary">{stats.totalClients}</span>
                            <span className="block text-[9px] text-brand-text-secondary">Pengantin</span>
                        </button>
                        <button type="button" onClick={() => onStatClick('team')} className="min-w-0 rounded-lg py-1 text-center hover:bg-brand-bg">
                            <span className="block text-sm font-bold text-brand-text-primary">{stats.activeTeamMembers}</span>
                            <span className="block text-[9px] text-brand-text-secondary">Tim</span>
                        </button>
                    </div>
                )}
                <div className="px-3 pb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <button onClick={onPrev} className="w-8 h-8 rounded-full hover:bg-brand-input active:bg-brand-input flex items-center justify-center transition-colors"><ChevronLeftIcon className="w-4 h-4 text-brand-text-secondary" /></button>
                        <button onClick={onNext} className="w-8 h-8 rounded-full hover:bg-brand-input active:bg-brand-input flex items-center justify-center transition-colors"><ChevronRightIcon className="w-4 h-4 text-brand-text-secondary" /></button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onFilterClick} aria-label="Buka filter kalender" className="relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-border bg-white px-2 py-1.5 text-xs font-semibold text-brand-text-light">
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Filter
                            {activeFilterCount > 0 && <span className="inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[9px] text-white">{activeFilterCount}</span>}
                        </button>
                        <select
                            aria-label="Tampilan kalender"
                            value={viewMode}
                            onChange={(e) => onViewModeChange(e.target.value as any)}
                            className="input-field w-[92px] min-w-[92px] max-w-[92px] shrink-0 text-xs py-1.5 px-2 rounded-lg"
                        >
                            {(['Day', 'Week', 'Month', 'Year', 'Team', 'Client', 'Agenda'] as const).map(v => (
                                <option key={v} value={v}>
                                    {getViewLabel(v)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden sm:flex p-4 items-center justify-between">
                <div className="flex items-center gap-2">
                    {viewMode === 'Year' ? (
                        <>
                            <button onClick={onPrev} className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full hover:bg-brand-input flex items-center justify-center"><ChevronLeftIcon className="w-5 h-5" /></button>
                            <select
                                value={selectedYear}
                                onChange={(e) => onYearChange(Number(e.target.value))}
                                className="input-field w-32 text-sm py-2 px-3 rounded-lg"
                            >
                                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                            <button onClick={onNext} className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full hover:bg-brand-input flex items-center justify-center"><ChevronRightIcon className="w-5 h-5" /></button>
                        </>
                    ) : (
                        <>
                            <button onClick={onPrev} className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full hover:bg-brand-input flex items-center justify-center"><ChevronLeftIcon className="w-5 h-5" /></button>
                            <button onClick={onNext} className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full hover:bg-brand-input flex items-center justify-center"><ChevronRightIcon className="w-5 h-5" /></button>
                            <h2 className="text-lg font-semibold text-brand-text-light ml-2">{getHeaderTitle()}</h2>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {onExport && <button onClick={onExport} className="button-secondary px-3 py-1.5 text-sm hidden lg:block" title="Export .ics">Export</button>}
                    <button onClick={onToday} className="button-secondary px-3 py-1.5 text-sm">Hari Ini</button>
                    <div className="p-1 bg-brand-bg rounded-lg flex">
                        {(['Day', 'Week', 'Month', 'Year', 'Team', 'Client', 'Agenda'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => onViewModeChange(v)}
                                className={`px-3 py-1 text-sm font-medium rounded-md ${viewMode === v ? 'bg-brand-surface shadow-sm' : 'text-brand-text-secondary'}`}
                            >
                                {getViewLabel(v)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- TOOLTIP COMPONENT ---
interface HoverTooltipProps {
    event: Project;
    profile: Profile;
    position: { x: number; y: number } | null;
}

const SmartHoverTooltip: React.FC<HoverTooltipProps> = ({ event, profile, position }) => {
    if (!position || !event) return null;

    const bgColor = getEventColor(event, profile);
    const subtitle = event.clientId === 'INTERNAL' ? event.projectType : (event.clientName || '');

    // Ensure tooltip stays within viewport (basic collision detection)
    const leftOffset = position.x > window.innerWidth - 300 ? position.x - 280 : position.x + 10;
    const topOffset = position.y > window.innerHeight - 200 ? position.y - 180 : position.y + 10;

    return (
        <div
            className="fixed z-50 w-64 p-3 bg-brand-surface/90 backdrop-blur-xl border border-brand-border/40 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] pointer-events-none animate-fade-in"
            style={{ left: leftOffset, top: topOffset }}
        >
            <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: bgColor }}></div>
                <span className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-wider">{event.projectType}</span>
            </div>
            <h4 className="font-bold text-sm text-brand-text-light mb-0.5 leading-tight">{event.projectName}</h4>
            {subtitle && <p className="text-xs font-medium text-brand-text-secondary mb-2">{subtitle}</p>}

            <div className="space-y-1.5 mt-3 pt-2 border-t border-brand-border/40">
                <div className="flex items-start gap-2 text-xs">
                    <ClockIcon className="w-3.5 h-3.5 text-brand-text-secondary mt-0.5" />
                    <span className="text-brand-text-light">{event.startTime ? `${event.startTime} - ${event.endTime || '...'}` : 'Sepanjang hari'}</span>
                </div>
                {event.location && (
                    <div className="flex items-start gap-2 text-xs">
                        <MapPinIcon className="w-3.5 h-3.5 text-brand-text-secondary mt-0.5" />
                        <span className="text-brand-text-light truncate">{event.location}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- LOADING SKELETON ---
const CalendarSkeleton = () => (
    <div className="absolute inset-0 z-30 bg-brand-surface/50 backdrop-blur-[2px] flex items-center justify-center animate-pulse rounded-2xl">
        <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-brand-accent/40 animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 rounded-full bg-brand-accent/60 animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 rounded-full bg-brand-accent/80 animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
    </div>
);

interface MonthViewProps {
    currentDate: Date;
    daysInMonth: Date[];
    eventsByDate: Map<string, Project[]>;
    profile: Profile;
    clients: Client[];
    isLoading?: boolean;
    onDayClick: (date: Date) => void;
    onEventClick: (event: Project) => void;
    onEventDrop?: (eventId: string, newDate: string) => void;
}

const MonthView: React.FC<MonthViewProps> = ({ currentDate, daysInMonth, eventsByDate, profile, clients, isLoading, onDayClick, onEventClick, onEventDrop }) => {
    const [hoveredEvent, setHoveredEvent] = useState<{ event: Project, pos: { x: number, y: number } } | null>(null);
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [selectedDateEvents, setSelectedDateEvents] = useState<{ date: Date, events: Project[] } | null>(null);

    return (
        <div className="grid grid-cols-7 flex-none lg:flex-grow lg:h-full calendar-grid bg-brand-surface/30 relative">
            {isLoading && <CalendarSkeleton />}
            {weekdays.map(day => (<div key={day} className="text-center py-3 text-xs font-semibold text-brand-text-secondary border-b border-l border-brand-border/40 bg-white/50 backdrop-blur-sm">{day}</div>))}
            {daysInMonth.map((day, i) => {
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = day.toDateString() === new Date().toDateString();
                const events = eventsByDate.get(day.toDateString()) || [];
                const dateStr = formatLocalDate(day);
                const isDragOver = dragOverDate === day.toDateString();
                const visibleEvents = events.slice(0, 2);
                const hasMore = events.length > 2;

                return (
                    <div
                        key={i}
                        tabIndex={0}
                        aria-label={day.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        aria-pressed={day.toDateString() === currentDate.toDateString()}
                        onClick={() => setSelectedDateEvents({ date: day, events })}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedDateEvents({ date: day, events });
                            }
                        }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverDate(day.toDateString()); }}
                        onDragLeave={() => setDragOverDate(null)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragOverDate(null);
                            const id = e.dataTransfer.getData('eventId');
                            if (id && onEventDrop) onEventDrop(id, dateStr);
                        }}
                        className={`relative border-b border-l border-brand-border/40 p-1.5 sm:p-2 flex flex-col h-20 sm:h-24 lg:h-32 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent ${isCurrentMonth ? 'bg-white/40' : 'bg-brand-bg/40 backdrop-blur-sm opacity-60'
                            } cursor-pointer transition-colors group ${isDragOver ? 'ring-2 ring-inset ring-brand-accent bg-brand-accent/10 scale-[1.02]' : 'hover:bg-white'
                            }`}
                    >
                        <span className={`text-xs font-semibold self-start mb-1.5 w-6 h-6 flex items-center justify-center rounded-full transition-colors ${isCurrentMonth ? 'text-brand-text-light group-hover:bg-brand-input' : 'text-brand-text-secondary/50'} ${isToday ? '!bg-brand-accent text-white shadow-md' : ''}`}>{day.getDate()}</span>
                        <div className="flex-grow space-y-1.5 overflow-hidden custom-scrollbar pr-0.5">
                            {visibleEvents.map(event => {
                                const bgColor = getEventColor(event, profile);
                                const client = clients.find(item => item.id === event.clientId);
                                const isInternal = event.clientId === 'INTERNAL';
                                const isDragging = draggingId === event.id;
                                return (
                                    <div
                                        key={event.id}
                                        draggable={isInternal}
                                        onDragStart={(e) => {
                                            if (!isInternal) { e.preventDefault(); return; }
                                            e.dataTransfer.setData('eventId', event.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                            setDraggingId(event.id);
                                            setHoveredEvent(null);
                                        }}
                                        onDragEnd={() => setDraggingId(null)}
                                        onClick={(e) => { e.stopPropagation(); setHoveredEvent(null); onEventClick(event); }}
                                        onMouseEnter={(e) => { if (!draggingId) setHoveredEvent({ event, pos: { x: e.clientX, y: e.clientY } }); }}
                                        onMouseMove={(e) => { if (!draggingId) setHoveredEvent({ event, pos: { x: e.clientX, y: e.clientY } }); }}
                                        onMouseLeave={() => setHoveredEvent(null)}
                                        className={`text-[10px] sm:text-xs p-1.5 rounded-lg text-white truncate leading-tight shadow-sm transition-all ${isInternal ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                                            } ${isDragging ? 'opacity-40 scale-95' : 'hover:opacity-90 active:scale-[0.98]'
                                            }`}
                                        style={{ backgroundColor: bgColor }}
                                        title={isInternal ? 'Drag untuk pindahkan' : undefined}
                                    >
                                        <div className="flex items-center gap-1 min-w-0">
                                            {!isInternal && <ClientAvatar client={client} name={event.clientName || 'Pengantin'} className="w-4 h-4" />}
                                            <p className="font-semibold truncate tracking-tight">{event.projectName}</p>
                                        </div>
                                    </div>
                                )
                            })}
                            {hasMore && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedDateEvents({ date: day, events }); }}
                                    className="text-[10px] bg-brand-bg px-2 py-0.5 rounded text-brand-text-secondary hover:bg-brand-input w-full text-center"
                                >
                                    +{events.length - 2} lagi
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
            {hoveredEvent && <SmartHoverTooltip event={hoveredEvent.event} profile={profile} position={hoveredEvent.pos} />}
            {selectedDateEvents && (
                <BottomSheet
                    isOpen={!!selectedDateEvents}
                    onClose={() => setSelectedDateEvents(null)}
                    title={(() => { const _d = selectedDateEvents.date; const _wd = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']; const _mo = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']; return `${_wd[_d.getDay()]} ${_d.getDate()} ${_mo[_d.getMonth()]} ${_d.getFullYear()}`; })()}
                >
                    <div className="space-y-4 p-4">
                        {selectedDateEvents.events.length === 0 ? (
                            <div className="text-center space-y-3 py-6">
                                <p className="text-sm text-brand-text-secondary">Tidak ada acara pada hari ini.</p>
                                <button
                                    type="button"
                                    className="button-primary"
                                    onClick={() => {
                                        const date = selectedDateEvents.date;
                                        setSelectedDateEvents(null);
                                        onDayClick(date);
                                    }}
                                >
                                    Tambah acara
                                </button>
                            </div>
                        ) : selectedDateEvents.events.map(event => {
                            const bgColor = getEventColor(event, profile);
                            const isInternal = event.clientId === 'INTERNAL';
                            const client = clients.find(item => item.id === event.clientId);
                            return (
                                <div
                                    key={event.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        setSelectedDateEvents(null);
                                        onEventClick(event);
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSelectedDateEvents(null);
                                            onEventClick(event);
                                        }
                                    }}
                                    className="calendar-event-entry p-4 rounded-xl border border-brand-border/40 bg-white/50 hover:bg-white transition-colors space-y-2 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
                                    style={{ borderLeft: `4px solid ${bgColor}` }}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <ClientAvatar
                                            client={isInternal ? undefined : client}
                                            name={isInternal ? 'Internal' : (event.clientName || 'Pengantin')}
                                            className="w-10 h-10 text-xs"
                                        />
                                        <h4 className="font-bold text-brand-text-light break-words">{event.projectName}</h4>
                                    </div>
                                    <p className="text-xs text-brand-text-secondary">
                                        {event.startTime || 'Sepanjang hari'}
                                        {event.endTime ? ` - ${event.endTime}` : ''}
                                        {' · '}
                                        {event.clientId === 'INTERNAL' ? event.projectType : (event.clientName || '')}
                                    </p>
                                    {event.location && (
                                        <p className="text-xs text-brand-text-secondary">
                                            <span className="font-semibold">Lokasi: </span>{event.location}
                                        </p>
                                    )}
                                    {event.team && event.team.length > 0 && (
                                        <div className="text-xs text-brand-text-primary">
                                            <span className="font-semibold">Tim: </span>
                                            {event.team.map(t => t.name).join(', ')}
                                        </div>
                                    )}
                                    {event.notes && (
                                        <div className="text-xs text-brand-text-secondary">
                                            <span className="font-semibold">Agenda: </span>
                                            {event.notes}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </BottomSheet>
            )}
        </div>
    );
};


interface AgendaViewProps {
    agendaByDate: [string, Project[]][];
    profile: Profile;
    clients: Client[];
    onEventClick: (event: Project) => void;
    emptyMessage?: string;
}

const AgendaView: React.FC<AgendaViewProps> = ({ agendaByDate, profile, clients, onEventClick, emptyMessage = 'Tidak ada acara pada bulan ini.' }) => (
    <div className="p-4 md:p-6 lg:p-10 max-w-4xl mx-auto custom-scrollbar overflow-x-hidden">
        {agendaByDate.map(([dateString, eventsOnDate]) => (
            <div key={dateString} className="mb-10 animate-fade-in relative">
                <div className="sticky top-0 z-10 bg-brand-surface/90 backdrop-blur-md py-3 -mx-4 px-4 md:mx-0 md:px-0 mb-4 border-b border-brand-border/40">
                    <h3 className="font-bold text-base md:text-lg text-brand-text-light">{(() => { const _d = new Date(dateString); const _wd = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']; const _mo = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']; return `${_wd[_d.getDay()]} ${_d.getDate()} ${_mo[_d.getMonth()]}`; })()}</h3>
                </div>
                <div className="relative pl-10 md:pl-16 border-l-2 border-brand-border/40 ml-2 md:ml-4">
                    {eventsOnDate.map(event => {
                        const bgColor = getEventColor(event, profile);
                        const client = clients.find(item => item.id === event.clientId);
                        return (
                            <div key={event.id} className="relative mb-6 group">
                                <div className="absolute -left-[3.5rem] md:-left-[5rem] top-2 font-semibold text-[10px] md:text-xs text-brand-text-primary bg-white/60 px-1.5 py-0.5 rounded shadow-sm scale-90 md:scale-100 origin-right">{event.startTime || 'All Day'}</div>
                                <div className="absolute -left-[0.65rem] top-2.5 w-4 h-4 rounded-full border-4 border-brand-surface shadow-sm ring-2 ring-transparent group-hover:ring-brand-accent/30 transition-all" style={{ backgroundColor: bgColor }}></div>
                                <div onClick={() => onEventClick(event)} className="ml-4 md:ml-6 p-4 md:p-5 rounded-2xl cursor-pointer glass-card card-hover-lift shadow-sm transition-all" style={{ borderLeft: `4px solid ${bgColor}` }}>
                                    <h4 className="font-bold text-sm md:text-base text-brand-text-light">{event.projectName}</h4>
                                    <div className="text-xs md:text-sm font-medium text-brand-text-secondary mt-1 flex items-center gap-1.5">
                                        {event.clientId !== 'INTERNAL' && <ClientAvatar client={client} name={event.clientName || 'Pengantin'} className="w-5 h-5" />}
                                        <span>{event.clientId === 'INTERNAL' ? event.projectType : (event.clientName || event.projectType)}</span>
                                        {event.location && ` • ${event.location}`}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        ))}
        {agendaByDate.length === 0 && <p className="text-center text-brand-text-secondary py-16">{emptyMessage}</p>}
    </div>
);


interface WeekViewProps {
    currentDate: Date;
    eventsByDate: Map<string, Project[]>;
    profile: Profile;
    clients: Client[];
    isLoading?: boolean;
    onDayClick: (date: Date) => void;
    onEventClick: (event: Project) => void;
}

const WeekView: React.FC<WeekViewProps> = ({ currentDate, eventsByDate, profile, clients, isLoading, onDayClick, onEventClick }) => {
    const weekStart = new Date(currentDate);
    const [hoveredEvent, setHoveredEvent] = useState<{ event: Project, pos: { x: number, y: number } } | null>(null);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        return day;
    });
    const weekAgendaByDate = weekDays.map(day => {
        const events = [...(eventsByDate.get(day.toDateString()) || [])]
            .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        return [day.toDateString(), events] as [string, Project[]];
    }).filter(([, events]) => events.length > 0);

    const getEventPosition = (event: Project) => {
        const { start, end } = getEventTiming(event);
        return {
            top: start,
            height: end - start
        };
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="hidden sm:flex sm:flex-1 sm:min-h-0 sm:flex-col sm:overflow-hidden">
            {/* Week header */}
            <div className="grid grid-cols-8 border-b border-brand-border/40 bg-white/70 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                <div className="p-1 sm:p-2 text-[10px] sm:text-xs font-semibold text-brand-text-secondary border-r border-brand-border/40 flex items-center justify-center text-center">Waktu</div>
                {weekDays.map((day, i) => {
                    const isToday = day.toDateString() === new Date().toDateString();
                    return (
                        <div key={i} className={`p-1 sm:p-2 text-center border-r border-brand-border/40 ${isToday ? 'bg-brand-accent/5 backdrop-blur-sm' : 'bg-white/40'}`}>
                            <div className="text-[10px] sm:text-xs font-medium text-brand-text-secondary">{weekdays[day.getDay()]}</div>
                            <div className={`text-sm sm:text-lg font-bold mt-0.5 sm:mt-1 mx-auto w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-accent text-white shadow-md' : 'text-brand-text-light'}`}>
                                {day.getDate()}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Time grid */}
            <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar bg-brand-surface/30">
                <div className="grid grid-cols-8 relative" style={{ minHeight: '1440px', minWidth: '600px' }}>
                    <div className="border-r border-brand-border/40 bg-white/40 backdrop-blur-sm shadow-sm z-10 relative">
                        {hours.map((hour) => (
                            <div key={hour} className="h-[60px] border-b border-brand-border/40 px-1 sm:px-2 py-1.5 text-[10px] sm:text-xs font-medium text-brand-text-secondary text-center">
                                {hour}
                            </div>
                        ))}
                    </div>

                    {weekDays.map((day, dayIndex) => {
                        const events = eventsByDate.get(day.toDateString()) || [];
                        const eventColumns = getEventColumnLayout(events);
                        const isToday = day.toDateString() === new Date().toDateString();

                        return (
                            <div
                                key={dayIndex}
                                className={`relative border-r border-brand-border ${isToday ? 'bg-brand-accent/5' : ''}`}
                                onClick={() => onDayClick(day)}
                            >
                                {hours.map((_, i) => (
                                    <div key={i} className="h-[60px] border-b border-brand-border hover:bg-brand-input/50 active:bg-brand-input cursor-pointer transition-colors"></div>
                                ))}

                                <div className="absolute inset-0 pointer-events-none">
                                    {events.map(event => {
                                        const { top, height } = getEventPosition(event);
                                        const column = eventColumns.get(event.id) || { index: 0, count: 1 };
                                        const bgColor = getEventColor(event, profile);
                                        const client = clients.find(item => item.id === event.clientId);
                                        const compactTitle = column.count > 1 ? getCompactEventTitle(event) : event.projectName;
                                        const shortEvent = height <= 44;

                                        return (
                                            <div
                                                key={event.id}
                                                onClick={(e) => { e.stopPropagation(); setHoveredEvent(null); onEventClick(event); }}
                                                onMouseEnter={(e) => setHoveredEvent({ event, pos: { x: e.clientX, y: e.clientY } })}
                                                onMouseMove={(e) => setHoveredEvent({ event, pos: { x: e.clientX, y: e.clientY } })}
                                                onMouseLeave={() => setHoveredEvent(null)}
                                                className="absolute rounded-md p-0.5 sm:p-1 cursor-pointer pointer-events-auto overflow-hidden text-white hover:opacity-95 active:scale-[0.99] transition-all shadow-sm"
                                                title={`${event.projectName} (${event.startTime || 'Sepanjang hari'}${event.endTime ? `–${event.endTime}` : ''})`}
                                                style={{
                                                    top: `${top + 2}px`,
                                                    height: `${Math.max(height - 4, 20)}px`,
                                                    left: `calc(${column.index * 100 / column.count}% + 4px)`,
                                                    right: `calc(${(column.count - column.index - 1) * 100 / column.count}% + 4px)`,
                                                    backgroundColor: bgColor
                                                }}
                                            >
                                                    <div className="min-w-0 text-[9px] sm:text-xs font-semibold truncate leading-tight">{shortEvent && event.startTime ? `${event.startTime} ` : ''}{compactTitle}</div>
                                                    {column.count === 1 && !shortEvent && (
                                                        <div className="min-w-0 text-[8px] sm:text-[10px] truncate opacity-90 leading-tight flex items-center gap-1">
                                                            {event.clientId !== 'INTERNAL' && <ClientAvatar client={client} name={event.clientName || 'Pengantin'} className="w-4 h-4" />}
                                                            <span className="min-w-0 truncate">{event.clientId === 'INTERNAL' ? event.projectType : (event.clientName || '')}</span>
                                                        </div>
                                                    )}
                                                    {column.count > 1 && !shortEvent && (
                                                        <div className="text-[8px] sm:text-[10px] truncate leading-tight">{event.startTime}{event.endTime ? `–${event.endTime}` : ''}</div>
                                                    )}
                                                    {column.count === 1 && (
                                                        <div className="hidden text-[8px] sm:text-[10px] truncate leading-tight xl:block">{event.startTime}</div>
                                                    )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            </div>
            <div className="sm:hidden flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <AgendaView
                    agendaByDate={weekAgendaByDate}
                    profile={profile}
                    clients={clients}
                    onEventClick={onEventClick}
                    emptyMessage="Tidak ada acara pada minggu ini."
                />
            </div>
            {hoveredEvent && <SmartHoverTooltip event={hoveredEvent.event} profile={profile} position={hoveredEvent.pos} />}
        </div>
    );
};


interface DayViewProps {
    currentDate: Date;
    eventsByDate: Map<string, Project[]>;
    profile: Profile;
    clients: Client[];
    onEventClick: (event: Project) => void;
}

const DayView: React.FC<DayViewProps> = ({ currentDate, eventsByDate, profile, clients, onEventClick }) => {
    const events = eventsByDate.get(currentDate.toDateString()) || [];
    const eventColumns = getEventColumnLayout(events);
    const isToday = currentDate.toDateString() === new Date().toDateString();

    const getEventPosition = (event: Project) => {
        const { start, end } = getEventTiming(event);
        return {
            top: start,
            height: end - start
        };
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Day header */}
            <div className="border-b border-brand-border/40 bg-white/70 backdrop-blur-md p-3 sm:p-5 sticky top-0 z-10 shadow-sm">
                <div className="text-center flex flex-col items-center">
                    <div className="text-xs sm:text-sm font-semibold text-brand-text-secondary uppercase tracking-wider">{weekdaysFull[currentDate.getDay()]}</div>
                    <div className={`text-2xl sm:text-4xl font-black mt-2 mb-1 flex items-center justify-center rounded-full ${isToday ? 'w-12 h-12 sm:w-16 sm:h-16 bg-brand-accent text-white shadow-lg' : 'text-brand-text-light'}`}>
                        {currentDate.getDate()}
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-brand-text-secondary">
                        {currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </div>
                </div>
            </div>

            {/* Time grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-brand-surface/30">
                <div className="flex relative" style={{ minHeight: '1440px' }}>
                    <div className="w-12 sm:w-20 border-r border-brand-border/40 flex-shrink-0 bg-white/40 backdrop-blur-sm z-10">
                        {hours.map((hour) => (
                            <div key={hour} className="h-[60px] border-b border-brand-border/40 px-1 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium text-brand-text-secondary text-right">
                                {hour}
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 relative">
                        {hours.map((_, i) => (
                            <div key={i} className="h-[60px] border-b border-brand-border hover:bg-brand-input/50 active:bg-brand-input transition-colors"></div>
                        ))}

                        <div className="absolute inset-0">
                            {events.map(event => {
                                const { top, height } = getEventPosition(event);
                                const column = eventColumns.get(event.id) || { index: 0, count: 1 };
                                const bgColor = getEventColor(event, profile);
                                const client = clients.find(item => item.id === event.clientId);
                                const compactTitle = column.count > 1 ? getCompactEventTitle(event) : event.projectName;
                                const shortEvent = height <= 44;

                                return (
                                    <div
                                        key={event.id}
                                        onClick={() => onEventClick(event)}
                                        className={`absolute overflow-hidden rounded-lg cursor-pointer text-white hover:opacity-95 active:scale-[0.99] transition-all shadow-md ${column.count > 1 ? 'p-1 sm:p-1.5' : 'p-1.5 sm:p-2'}`}
                                        title={`${event.projectName} (${event.startTime || 'Sepanjang hari'}${event.endTime ? `–${event.endTime}` : ''})`}
                                        style={{
                                            top: `${top + 2}px`,
                                            height: `${Math.max(height - 4, 20)}px`,
                                            left: `calc(${column.index * 100 / column.count}% + 4px)`,
                                            right: `calc(${(column.count - column.index - 1) * 100 / column.count}% + 4px)`,
                                            backgroundColor: bgColor
                                        }}
                                    >
                                        <div className="min-w-0 font-semibold text-xs sm:text-sm mb-0.5 sm:mb-1 truncate">{shortEvent && event.startTime ? `${event.startTime} ` : ''}{compactTitle}</div>
                                        {column.count === 1 && !shortEvent && (event.clientName || event.clientId === 'INTERNAL') && (
                                            <div className="min-w-0 text-[10px] sm:text-xs opacity-90 truncate flex items-center gap-1">
                                                {event.clientId !== 'INTERNAL' && <ClientAvatar client={client} name={event.clientName || 'Pengantin'} className="w-4 h-4" />}
                                                <span className="min-w-0 truncate">{event.clientId === 'INTERNAL' ? event.projectType : event.clientName}</span>
                                            </div>
                                        )}
                                        {!shortEvent && (
                                            <div className="truncate text-[10px] sm:text-xs opacity-90">{event.startTime || 'Sepanjang hari'}{event.endTime ? ` - ${event.endTime}` : ''}</div>
                                        )}
                                        {column.count === 1 && event.location && height > 50 && (
                                            <div className="text-[10px] sm:text-xs opacity-90 mt-1 flex items-center gap-1 truncate">
                                                <MapPinIcon className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{event.location}</span>
                                            </div>
                                        )}
                                        {column.count === 1 && event.notes && height > 90 && (
                                            <div className="text-[10px] sm:text-xs opacity-75 mt-2 line-clamp-2">{event.notes}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- YEAR VIEW COMPONENT ---
interface YearViewProps {
    selectedYear: number;
    eventsByDate: Map<string, Project[]>;
    profile: Profile;
    clients: Client[];
    onMonthClick: (month: number) => void;
    onEventClick: (event: Project) => void;
}

const YearView: React.FC<YearViewProps> = ({ selectedYear, eventsByDate, profile, clients, onMonthClick, onEventClick }) => {
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const getMonthEvents = (month: number) => {
        const events: Project[] = [];
        const firstDay = new Date(selectedYear, month, 1);
        const lastDay = new Date(selectedYear, month + 1, 0);

        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            const dayEvents = eventsByDate.get(d.toDateString()) || [];
            events.push(...dayEvents);
        }

        return events;
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto custom-scrollbar overflow-y-auto h-full">
            <h2 className="text-2xl font-bold text-brand-text-light mb-6">Kalender Tahun {selectedYear}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {monthNames.map((monthName, monthIndex) => {
                    const monthEvents = getMonthEvents(monthIndex);
                    const eventCount = monthEvents.length;

                    return (
                        <div
                            key={monthIndex}
                            onClick={() => onMonthClick(monthIndex)}
                            className="bg-brand-surface rounded-2xl border border-brand-border/40 p-5 hover:border-brand-border hover:shadow-lg transition-all cursor-pointer group min-h-[280px] flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-brand-text-light text-lg">{monthName}</h3>
                                <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-brand-accent/15 text-brand-accent">
                                    {eventCount} acara
                                </span>
                            </div>

                            {/* Mini calendar preview */}
                            <div className="mb-4 flex-grow">
                                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                    {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((d, i) => (
                                        <div key={i} className="text-[9px] font-semibold text-brand-text-secondary">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1 text-center">
                                    {(() => {
                                        const firstDay = new Date(selectedYear, monthIndex, 1);
                                        const lastDay = new Date(selectedYear, monthIndex + 1, 0);
                                        const startDate = new Date(firstDay);
                                        startDate.setDate(startDate.getDate() - startDate.getDay());
                                        const endDate = new Date(lastDay);
                                        endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

                                        const days = [];
                                        let d = new Date(startDate);
                                        while (d <= endDate) {
                                            days.push(new Date(d));
                                            d.setDate(d.getDate() + 1);
                                        }

                                        return days.map((day, i) => {
                                            const isCurrentMonth = day.getMonth() === monthIndex;
                                            const isToday = day.toDateString() === new Date().toDateString();
                                            const hasEvent = eventsByDate.has(day.toDateString());

                                            return (
                                                <div
                                                    key={i}
                                                    className={`w-6 h-6 mx-auto rounded-full text-[10px] font-medium flex items-center justify-center transition-colors
                                                    ${!isCurrentMonth ? 'text-brand-text-secondary/20' :
                                                            isToday ? 'bg-brand-accent text-white' :
                                                                hasEvent ? 'bg-brand-accent/20 text-brand-accent' :
                                                                    'text-brand-text-light hover:bg-brand-input'
                                                        }`}
                                                >
                                                    {day.getDate()}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            {/* Preview events */}
                            {eventCount > 0 && (
                                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar mt-auto">
                                    {monthEvents.slice(0, 4).map(event => {
                                        const bgColor = getEventColor(event, profile);
                                        return (
                                            <div
                                                key={event.id}
                                                onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                                                className="text-[11px] p-2 rounded text-white truncate cursor-pointer hover:opacity-90 transition-colors"
                                                style={{ backgroundColor: bgColor }}
                                            >
                                                {event.projectName}
                                            </div>
                                        );
                                    })}
                                    {eventCount > 4 && (
                                        <div className="text-[11px] text-brand-text-secondary text-center pt-1">
                                            +{eventCount - 4} lagi
                                        </div>
                                    )}
                                </div>
                            )}

                            {eventCount === 0 && (
                                <div className="text-center py-4 text-xs text-brand-text-secondary/50 mt-auto">
                                    Tidak ada acara
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


interface EventPanelProps {
    isOpen: boolean;
    mode: 'detail' | 'edit';
    selectedEvent: Project | null;
    eventForm: any;
    teamMembers: TeamMember[];
    clients: Client[];
    profile: Profile;
    canDelete: boolean;
    onClose: () => void;
    onSetMode: (mode: 'detail' | 'edit') => void;
    onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    onFormCustomColorChange?: (color: string) => void;
    onTeamChange: (memberId: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onDelete: () => void;
    onNavigateToProject?: (projectId: string) => void;
    onNavigateToClient?: (clientId: string) => void;
    canEditProjectNotes: boolean;
    onSaveProjectNotes: (notes: string) => Promise<void>;
    onTaskToggle?: (taskId: string, completed: boolean) => void;
    onTaskAdd?: (taskName: string) => void;
    onTaskDelete?: (taskId: string) => void;
}

const customColors = [
    '#2563eb', // blue-600
    '#dc2626', // red-600
    '#16a34a', // green-600
    '#ca8a04', // yellow-600
    '#9333ea', // purple-600
    '#db2777', // pink-600 (approx)
    '#ea580c', // orange-600
    '#0d9488', // teal-600
    '#4f46e5', // indigo-600
    '#475569'  // slate-600
];

// --- CLIENT VIEW COMPONENT ---
interface ClientViewProps {
    projects: Project[];
    clients: Client[];
    profile: Profile;
    onEventClick: (event: Project) => void;
}

const ClientView: React.FC<ClientViewProps> = ({ projects, clients, profile, onEventClick }) => {
    const clientStats = useMemo(() => {
        const stats = new Map<string, { client: Client | null; clientName: string; events: Project[]; teamMembers: Set<string> }>();

        projects.forEach(p => {
            if (!p.clientId || p.clientId === 'INTERNAL') return;

            if (!stats.has(p.clientId)) {
                const client = clients.find(c => c.id === p.clientId) || null;
                stats.set(p.clientId, {
                    client,
                    clientName: client?.name || p.clientName || 'Unknown Client',
                    events: [],
                    teamMembers: new Set()
                });
            }

            const stat = stats.get(p.clientId)!;
            stat.events.push(p);
            if (p.team) {
                p.team.forEach(t => stat.teamMembers.add(t.name));
            }
        });

        return Array.from(stats.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
    }, [projects, clients]);

    return (
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto custom-scrollbar overflow-y-auto h-full">
            <h2 className="text-xl font-bold text-brand-text-light mb-6">Pusat Informasi Pengantin</h2>

            {clientStats.length === 0 ? (
                <div className="text-center text-brand-text-secondary py-20 bg-brand-surface/40 rounded-2xl border border-brand-border/40">
                    <UsersIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Belum ada jadwal pekerjaan untuk pengantin saat ini.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {clientStats.map((stat, idx) => (
                        <div key={stat.client?.id || idx} className="glass-card p-5 rounded-2xl border border-brand-border/40 shadow-sm flex flex-col animate-fade-in group hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <ClientAvatar client={stat.client} name={stat.clientName} className="w-12 h-12 text-lg border border-brand-accent/20" />
                                    <div>
                                        <h3 className="font-bold text-brand-text-light text-lg">{stat.clientName}</h3>
                                        <p className="text-xs text-brand-text-secondary">{stat.events.length} Pekerjaan Jadwal</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-5 rounded-xl border border-brand-border/30 bg-white/40 p-3">
                                <div>
                                    <p className="text-[10px] text-brand-text-secondary font-semibold uppercase tracking-wider mb-1">Tim Terlibat</p>
                                    <p className="break-words text-xs leading-5 text-brand-text-secondary">
                                        {Array.from(stat.teamMembers).join(', ') || 'Belum ada tim'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col">
                                <h4 className="text-xs font-semibold text-brand-text-secondary mb-3 uppercase tracking-wider">Daftar Jadwal</h4>
                                <div className="space-y-2 flex-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                    {stat.events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(event => (
                                        <div
                                            key={event.id}
                                            onClick={() => onEventClick(event)}
                                            className="p-3 rounded-xl bg-white/60 hover:bg-white border border-brand-border/40 cursor-pointer transition-colors flex items-center justify-between group/item"
                                            style={{ borderLeftColor: getEventColor(event, profile), borderLeftWidth: '4px' }}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-sm text-brand-text-light truncate">{event.projectName}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-brand-text-secondary flex items-center gap-1">
                                                        <CalendarIcon className="w-3 h-3" />
                                                        {new Date(event.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                    {event.startTime && (
                                                        <span className="text-[10px] text-brand-text-secondary flex items-center gap-1">
                                                            <ClockIcon className="w-3 h-3" />
                                                            {event.startTime}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="w-4 h-4 text-brand-text-secondary opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- TEAM VIEW COMPONENT ---
interface TeamViewProps {
    currentDate: Date;
    eventsByDate: Map<string, Project[]>;
    teamMembers: TeamMember[];
    clients: Client[];
    profile: Profile;
    isLoading?: boolean;
    onEventClick: (event: Project) => void;
}

const TeamView: React.FC<TeamViewProps> = ({ currentDate, eventsByDate, teamMembers, clients, profile, isLoading, onEventClick }) => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        return day;
    });

    const [hoveredEvent, setHoveredEvent] = useState<{ event: Project, pos: { x: number, y: number } } | null>(null);

    return (
        <div className="flex flex-col h-full overflow-hidden relative bg-brand-surface/30">
            {isLoading && <CalendarSkeleton />}
            <div className="hidden sm:flex border-b border-brand-border/40 bg-white/70 backdrop-blur-md sticky top-0 z-20 shadow-sm">
                <div className="w-32 sm:w-48 p-3 font-semibold text-xs text-brand-text-secondary border-r border-brand-border/40 flex items-center justify-center shrink-0">Anggota Tim</div>
                <div className="flex-1 grid grid-cols-7 min-w-[600px]">
                    {weekDays.map((day, i) => {
                        const isToday = day.toDateString() === new Date().toDateString();
                        return (
                            <div key={i} className={`p-2 text-center border-r border-brand-border/40 ${isToday ? 'bg-brand-accent/5' : 'bg-white/40'}`}>
                                <div className="text-[10px] sm:text-xs font-medium text-brand-text-secondary">{weekdays[day.getDay()]}</div>
                                <div className={`text-sm font-bold mt-1 mx-auto w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-accent text-white shadow-md' : 'text-brand-text-light'}`}>
                                    {day.getDate()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="hidden sm:flex sm:flex-1 sm:min-h-0 overflow-y-auto custom-scrollbar">
                <div className="min-w-[600px] pb-10 flex flex-col">
                    {teamMembers.map(member => (
                        <div key={member.id} className="flex border-b border-brand-border/40 hover:bg-white/40 transition-colors group">
                            <div className="w-32 sm:w-48 p-3 border-r border-brand-border/40 flex items-center gap-3 shrink-0 bg-brand-surface/50 z-10 sticky left-0 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-input flex items-center justify-center text-xs font-bold text-brand-text-secondary border border-brand-border/50">
                                    {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" /> : getInitials(member.name)}
                                </div>
                                <div className="min-w-0 hidden sm:block">
                                    <p className="font-semibold text-sm text-brand-text-light truncate">{member.name}</p>
                                    <p className="text-[10px] text-brand-text-secondary truncate">{member.role}</p>
                                </div>
                            </div>
                            <div className="flex-1 grid grid-cols-7">
                                {weekDays.map((day, dayIndex) => {
                                    const events = eventsByDate.get(day.toDateString()) || [];
                                    const memberEvents = events.filter(e => e.team && e.team.some(t => t.memberId === member.id));
                                    const isToday = day.toDateString() === new Date().toDateString();

                                    return (
                                        <div key={dayIndex} className={`p-1.5 border-r border-brand-border/40 min-h-[80px] ${isToday ? 'bg-brand-accent/5' : ''}`}>
                                            <div className="space-y-1.5 flex flex-col">
                                                {memberEvents.map(event => {
                                                    const bgColor = getEventColor(event, profile);
                                                    return (
                                                        <div
                                                            key={event.id}
                                                            onClick={(e) => { e.stopPropagation(); setHoveredEvent(null); onEventClick(event); }}
                                                            onMouseEnter={(e) => setHoveredEvent({ event, pos: { x: e.clientX, y: e.clientY } })}
                                                            onMouseMove={(e) => setHoveredEvent({ event, pos: { x: e.clientX, y: e.clientY } })}
                                                            onMouseLeave={() => setHoveredEvent(null)}
                                                            className="text-[10px] p-1.5 rounded-md text-white truncate cursor-pointer shadow-sm hover:opacity-90 active:scale-95 transition-all text-left"
                                                            style={{ backgroundColor: bgColor }}
                                                        >
                                                            <p className="font-semibold truncate leading-tight">{event.projectName}</p>
                                                            {event.startTime && <p className="text-[8px] opacity-90 truncate leading-tight">{event.startTime}</p>}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                    {teamMembers.length === 0 && (
                        <div className="p-10 text-center text-brand-text-secondary">Tidak ada anggota tim terdaftar.</div>
                    )}
                </div>
            </div>
            <div className="sm:hidden flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-3">
                {teamMembers.length === 0 ? (
                    <p className="rounded-xl border border-brand-border/50 bg-white px-4 py-6 text-center text-sm text-brand-text-secondary">Belum ada anggota tim.</p>
                ) : teamMembers.map(member => {
                    const memberEvents = weekDays.flatMap(day =>
                        (eventsByDate.get(day.toDateString()) || [])
                            .filter(event => event.team?.some(assigned => assigned.memberId === member.id))
                            .map(event => ({ day, event }))
                    );

                    return (
                        <section key={member.id} className="overflow-hidden rounded-xl border border-brand-border/50 bg-white shadow-sm">
                            <div className="flex items-center gap-3 border-b border-brand-border/40 px-3 py-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border/50 bg-brand-input text-xs font-bold text-brand-text-secondary">
                                    {member.avatarUrl ? <img src={member.avatarUrl} alt={`${member.name} avatar`} className="h-full w-full object-cover" /> : getInitials(member.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-brand-text-light">{member.name}</p>
                                    <p className="truncate text-xs text-brand-text-secondary">{member.role}</p>
                                </div>
                                <span className="shrink-0 rounded-full bg-brand-bg px-2 py-1 text-[10px] font-semibold text-brand-text-secondary">{memberEvents.length} acara</span>
                            </div>
                            {memberEvents.length === 0 ? (
                                <p className="px-3 py-3 text-xs text-brand-text-secondary">Tidak ada acara minggu ini.</p>
                            ) : (
                                <div className="divide-y divide-brand-border/40">
                                    {memberEvents.map(({ day, event }) => (
                                        <div
                                            key={`${event.id}-${day.toDateString()}`}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => onEventClick(event)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    onEventClick(event);
                                                }
                                            }}
                                            className="calendar-event-entry flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-brand-bg/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
                                            style={{ borderLeft: `3px solid ${getEventColor(event, profile)}` }}
                                        >
                                            <span className="w-11 shrink-0 rounded-lg bg-brand-bg px-1 py-1.5 text-center">
                                                <span className="block text-[9px] text-brand-text-secondary">{weekdays[day.getDay()]}</span>
                                                <span className="block text-sm font-bold text-brand-text-light">{day.getDate()}</span>
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block break-words text-xs font-semibold text-brand-text-light">{event.projectName}</span>
                                                <span className="mt-0.5 block truncate text-[10px] text-brand-text-secondary">{event.clientId === 'INTERNAL' ? event.projectType : (event.clientName || event.projectType)}</span>
                                                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-brand-text-secondary">
                                                    <span className="inline-flex items-center gap-1">
                                                        <ClockIcon className="h-3 w-3 shrink-0" />
                                                        {event.startTime ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ''}` : 'Sepanjang hari'}
                                                    </span>
                                                    {event.location && <span className="inline-flex min-w-0 items-center gap-1"><MapPinIcon className="h-3 w-3 shrink-0" /><span className="truncate">{event.location}</span></span>}
                                                </span>
                                            </span>
                                            <ChevronRightIcon className="h-4 w-4 shrink-0 text-brand-text-secondary" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>
            {hoveredEvent && <SmartHoverTooltip event={hoveredEvent.event} profile={profile} position={hoveredEvent.pos} />}
        </div>
    );
};

const EventPanel: React.FC<EventPanelProps> = ({ isOpen, mode, selectedEvent, eventForm, teamMembers, clients, profile, canDelete, onClose, onSetMode, onFormChange, onFormCustomColorChange, onTeamChange, onSubmit, onDelete, onNavigateToProject, onNavigateToClient, canEditProjectNotes, onSaveProjectNotes, onTaskToggle, onTaskAdd, onTaskDelete }) => {
    const [activeTab, setActiveTab] = React.useState<'info' | 'team' | 'notes'>('info');
    const [taskDraft, setTaskDraft] = React.useState('');
    const [projectNotesDraft, setProjectNotesDraft] = React.useState('');
    const [isEditingProjectNotes, setIsEditingProjectNotes] = React.useState(false);
    const [isSavingProjectNotes, setIsSavingProjectNotes] = React.useState(false);
    const [projectNotesMessage, setProjectNotesMessage] = React.useState('');

    React.useEffect(() => {
        if (!isOpen) setActiveTab('info');
    }, [isOpen]);

    React.useEffect(() => {
        setProjectNotesDraft(selectedEvent?.notes || '');
        setIsEditingProjectNotes(false);
    }, [selectedEvent?.id, selectedEvent?.notes]);

    React.useEffect(() => {
        setProjectNotesMessage('');
    }, [selectedEvent?.id]);

    const tasks = selectedEvent?.tasks || [];
    const completedTaskCount = tasks.filter(task => task.completed).length;
    const taskProgress = tasks.length ? Math.round((completedTaskCount / tasks.length) * 100) : 0;
    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        const taskName = taskDraft.trim();
        if (!taskName || !onTaskAdd) return;
        onTaskAdd(taskName);
        setTaskDraft('');
    };

    const handleProjectNotesSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingProjectNotes(true);
        setProjectNotesMessage('');
        try {
            await onSaveProjectNotes(projectNotesDraft);
            setIsEditingProjectNotes(false);
            setProjectNotesMessage('Keterangan berhasil disimpan.');
        } catch {
            setProjectNotesMessage('Keterangan gagal disimpan. Silakan coba lagi.');
        } finally {
            setIsSavingProjectNotes(false);
        }
    };

    return (
        <div
            className={mode === 'detail'
                ? `fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm ${isOpen && selectedEvent ? '' : 'hidden'}`
                : `flex-shrink-0 border-l border-brand-border/30 flex flex-col bg-brand-surface/80 backdrop-blur-xl transform transition-transform duration-300 ease-in-out z-20 ${isOpen ? 'fixed inset-x-3 top-16 bottom-20 w-[calc(100vw-1.5rem)] translate-x-0 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] md:relative md:inset-auto md:w-[400px]' : 'fixed left-full top-16 bottom-20 w-[calc(100vw-1.5rem)] translate-x-0 pointer-events-none md:absolute md:left-auto md:right-0 md:top-0 md:bottom-0 md:w-[400px] md:translate-x-full'}`}
            onClick={mode === 'detail' ? onClose : undefined}
            role={mode === 'detail' && isOpen ? 'dialog' : undefined}
            aria-modal={mode === 'detail' && isOpen ? true : undefined}
            aria-label={mode === 'detail' ? `Detail agenda ${selectedEvent?.projectName || ''}` : undefined}
        >
            <div
                className={mode === 'detail'
                    ? 'flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-brand-border/50 bg-brand-surface text-brand-text-primary shadow-2xl'
                    : 'contents'}
                onClick={e => e.stopPropagation()}
            >
            <div className="p-4 border-b border-brand-border/40 bg-white/40 flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-brand-text-light text-sm">{mode === 'detail' ? 'Detail Acara Agenda' : (selectedEvent ? 'Edit Acara Agenda' : 'Buat Agenda')}</h3>
                <button onClick={onClose} aria-label={mode === 'detail' ? 'Tutup detail agenda' : 'Tutup panel acara'} className="p-2 rounded-full border text-brand-accent hover:bg-[#DCE8FF] transition-colors" style={{ backgroundColor: '#ECF2FF', borderColor: '#D8E6FF' }}>
                    {mode === 'detail' ? <X className="h-5 w-5" /> : <ChevronRightIcon className="w-5 h-5" />}
                </button>
            </div>
            <div className="overflow-hidden flex-1 flex flex-col">
                {mode === 'detail' && selectedEvent ? (
                    <div className="flex-1 flex flex-col animate-fade-in h-full">
                        <div className="flex border-b border-brand-border/40 bg-white/50 px-2 pt-2 gap-1 shrink-0">
                            <button onClick={() => setActiveTab('info')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'info' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-primary'}`}>Acara</button>
                            {selectedEvent.clientId !== 'INTERNAL' && (
                                <>
                                    <button onClick={() => setActiveTab('team')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'team' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-primary'}`}>Tim</button>
                                </>
                            )}
                            <button onClick={() => setActiveTab('notes')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'notes' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-brand-text-secondary hover:text-brand-text-primary'}`}>Keterangan</button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/30">
                            {activeTab === 'info' && (
                                <div className="p-6">
                                    {selectedEvent.image && <div className="relative h-48 w-full -mx-6 -mt-6 mb-6"><img src={selectedEvent.image} alt={selectedEvent.projectName} className="w-full h-full object-cover" /><div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 to-transparent"></div></div>}
                                    <h3 className="text-xl font-semibold text-brand-text-light">{selectedEvent.projectName}</h3>
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full mt-2 inline-block" style={{ backgroundColor: `${getEventColor(selectedEvent, profile)}30`, color: getEventColor(selectedEvent, profile) }}>{selectedEvent.projectType}</span>
                                    {selectedEvent.clientId !== 'INTERNAL' && selectedEvent.clientName && (
                                        <div className="mt-4 p-4 bg-white/50 rounded-2xl border border-brand-border/40 flex items-center justify-between shadow-sm cursor-pointer hover:bg-white/80 transition-colors" onClick={() => onNavigateToClient && onNavigateToClient(selectedEvent.clientId || '')}>
                                            <div className="flex items-center gap-3">
                                                <ClientAvatar client={clients.find(client => client.id === selectedEvent.clientId)} name={selectedEvent.clientName} className="w-10 h-10 text-sm" />
                                                <div>
                                                    <p className="text-xs text-brand-text-secondary uppercase tracking-wider font-semibold">Pengantin</p>
                                                    <p className="font-semibold text-brand-text-light">{selectedEvent.clientName}</p>
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="w-5 h-5 text-brand-text-secondary" />
                                        </div>
                                    )}
                                    {selectedEvent.clientId === 'INTERNAL' ? (
                                        <div className="mt-6 space-y-5 text-sm">
                                            <div className="flex items-start gap-4"><ClockIcon className="w-5 h-5 text-brand-text-secondary flex-shrink-0 mt-0.5" /><p className="text-brand-text-primary font-medium">{(() => { const _d = new Date(selectedEvent.date); const _wd = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']; const _mo = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']; return `${_wd[_d.getDay()]} ${_d.getDate()} ${_mo[_d.getMonth()]}`; })()} <br /><span className="text-brand-text-secondary">{selectedEvent.startTime && selectedEvent.endTime ? `${selectedEvent.startTime} - ${selectedEvent.endTime}` : 'Sepanjang hari'}</span></p></div>
                                            {selectedEvent.location && (<div className="flex items-start gap-4"><MapPinIcon className="w-5 h-5 text-brand-text-secondary flex-shrink-0 mt-0.5" /><p className="text-brand-text-primary font-medium">{selectedEvent.location}</p></div>)}
                                        </div>
                                    ) : (
                                        <div className="mt-6 space-y-6">
                                            <section>
                                                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-text-secondary">Informasi Utama</h4>
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <div><p className="text-xs text-brand-text-secondary">Pengantin</p><p className="text-sm font-medium text-brand-text-primary">{selectedEvent.clientName || '—'}</p></div>
                                                    <div><p className="text-xs text-brand-text-secondary">Lokasi / Kota</p><p className="text-sm font-medium text-brand-text-primary">{selectedEvent.location || '—'}</p></div>
                                                    <div><p className="text-xs text-brand-text-secondary">Tanggal Acara</p><p className="text-sm font-medium text-brand-text-primary">{new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(selectedEvent.date))}</p></div>
                                                    <div><p className="text-xs text-brand-text-secondary">Alamat Lengkap / Gedung</p><p className="text-sm font-medium text-brand-text-primary">{selectedEvent.address || '—'}</p></div>
                                                    <div className="sm:col-span-2">
                                                        <p className="text-xs text-brand-text-secondary">Google Maps</p>
                                                        {selectedEvent.googleMapsLink ? (
                                                            <a href={selectedEvent.googleMapsLink} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-medium text-brand-accent hover:underline">Buka lokasi di Google Maps</a>
                                                        ) : <p className="text-sm font-medium text-brand-text-primary">—</p>}
                                                    </div>
                                                    <div><p className="text-xs text-brand-text-secondary">Jam Mulai</p><p className="text-sm font-medium text-brand-text-primary">{selectedEvent.startTime || '—'}</p></div>
                                                    <div><p className="text-xs text-brand-text-secondary">Jam Selesai</p><p className="text-sm font-medium text-brand-text-primary">{selectedEvent.endTime || '—'}</p></div>
                                                </div>
                                            </section>

                                            <section>
                                                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-text-secondary">File &amp; Tautan Penting</h4>
                                                <div className="space-y-2">
                                                    {[
                                                        { title: 'Brief / Moodboard', description: 'Link internal untuk tim', url: selectedEvent.driveLink, emptyText: 'Belum ada' },
                                                        { title: 'File dari Pengantin', description: 'Foto / dokumen diterima dari pengantin', url: selectedEvent.clientDriveLink, emptyText: 'Belum ada' },
                                                        { title: 'File Jadi (Hasil Akhir)', description: 'Link hasil dokumentasi untuk dikirim ke pengantin', url: selectedEvent.finalDriveLink, emptyText: 'Belum tersedia' },
                                                    ].map(file => (
                                                        <div key={file.title} className="flex items-center justify-between gap-3 rounded-xl border border-brand-border/40 bg-white/50 p-3">
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-semibold text-brand-text-primary">{file.title}</p>
                                                                <p className="mt-0.5 text-xs text-brand-text-secondary">{file.description}</p>
                                                            </div>
                                                            {file.url ? (
                                                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg border border-brand-border/50 bg-white px-3 py-1.5 text-xs font-semibold text-brand-accent hover:bg-brand-bg">Buka</a>
                                                            ) : <span className="shrink-0 text-xs italic text-brand-text-secondary">{file.emptyText}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        </div>
                                    )}

                                    {canDelete && (
                                        <section className="mt-6 rounded-2xl border border-[#DCE6F8] bg-gradient-to-br from-white to-[#F5F8FF] p-4 shadow-sm">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECF2FF] text-[#5D87FF]">
                                                        <ListTodo className="h-5 w-5" />
                                                    </span>
                                                    <div>
                                                        <h4 className="font-bold text-brand-text-light">To-Do List</h4>
                                                        <p className="text-xs text-brand-text-secondary">Daftar tugas agenda ini</p>
                                                    </div>
                                                </div>
                                                <span className="shrink-0 rounded-full bg-[#ECF2FF] px-2.5 py-1 text-xs font-bold text-[#4267C8]">
                                                    {completedTaskCount}/{tasks.length} selesai
                                                </span>
                                            </div>
                                            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#E8EDF6]" role="progressbar" aria-label="Progres To-Do List" aria-valuemin={0} aria-valuemax={100} aria-valuenow={taskProgress}>
                                                <div className="h-full rounded-full bg-[#5D87FF] transition-all" style={{ width: `${taskProgress}%` }} />
                                            </div>

                                            <div className="mt-3 space-y-2">
                                                {tasks.map(task => (
                                                    <div key={task.id} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${task.completed ? 'border-[#E4EAF2] bg-[#F7F9FC]' : 'border-[#E3EAF5] bg-white hover:border-[#C8D7F3]'}`}>
                                                        <input
                                                            id={`calendar-task-${selectedEvent.id}-${task.id}`}
                                                            type="checkbox"
                                                            checked={task.completed}
                                                            onChange={(e) => onTaskToggle?.(task.id, e.target.checked)}
                                                            aria-label={`Tandai "${task.name}" ${task.completed ? 'belum selesai' : 'selesai'}`}
                                                            className="h-5 w-5 shrink-0 cursor-pointer rounded border-2 border-[#AAB8CC] text-[#5D87FF] accent-[#5D87FF] focus:ring-2 focus:ring-[#5D87FF]/30"
                                                        />
                                                        <label htmlFor={`calendar-task-${selectedEvent.id}-${task.id}`} className={`min-w-0 flex-1 cursor-pointer break-words text-sm font-medium ${task.completed ? 'text-brand-text-secondary line-through' : 'text-brand-text-primary'}`}>
                                                            {task.name}
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => onTaskDelete?.(task.id)}
                                                            aria-label={`Hapus tugas ${task.name}`}
                                                            title="Hapus tugas"
                                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500 transition-colors hover:border-red-200 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {tasks.length === 0 && (
                                                    <div className="rounded-xl border border-dashed border-[#CCD7E8] bg-white/70 px-3 py-4 text-center">
                                                        <p className="text-sm font-medium text-brand-text-secondary">Belum ada tugas</p>
                                                        <p className="mt-1 text-xs text-brand-text-secondary/80">Tambahkan tugas pertama untuk agenda ini.</p>
                                                    </div>
                                                )}
                                            </div>

                                            <form onSubmit={handleAddTask} className="mt-3 flex gap-2">
                                                <input
                                                    type="text"
                                                    value={taskDraft}
                                                    onChange={(e) => setTaskDraft(e.target.value)}
                                                    placeholder="Tulis tugas baru..."
                                                    aria-label="Tugas baru"
                                                    className="input-field min-w-0 flex-1 bg-white px-3 py-2 text-sm"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={!taskDraft.trim() || !onTaskAdd}
                                                    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#5D87FF] px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#4B75E8] focus:outline-none focus:ring-2 focus:ring-[#5D87FF]/40 disabled:cursor-not-allowed disabled:bg-[#A9BDEB] disabled:shadow-none"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    Tambah
                                                </button>
                                            </form>
                                            {tasks.length > 0 && completedTaskCount === tasks.length && (
                                                <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                                                    <Check className="h-4 w-4" /> Semua tugas selesai
                                                </p>
                                            )}
                                        </section>
                                    )}
                                </div>
                            )}

                            {activeTab === 'team' && (
                                <div className="p-6">
                                    <h4 className="font-semibold text-brand-text-light mb-4 text-sm uppercase tracking-wider text-brand-text-secondary">Tim yang Bertugas</h4>
                                    {selectedEvent.team && selectedEvent.team.length > 0 ? (
                                        <div className="space-y-3">
                                            {selectedEvent.team.map(t => (
                                                <div key={t.memberId} className="p-3 bg-white/50 border border-brand-border/40 rounded-xl flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-input flex items-center justify-center text-sm font-bold text-brand-text-secondary border-2 border-brand-surface">
                                                        {teamMembers.find(member => member.id === t.memberId)?.avatarUrl ? (
                                                            <img src={teamMembers.find(member => member.id === t.memberId)?.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                        ) : getInitials(t.name)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-brand-text-light text-sm">{t.name}</p>
                                                        <p className="text-xs text-brand-text-secondary">{t.role}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-brand-text-secondary italic">Belum ada tim yang ditugaskan.</p>
                                    )}
                                </div>
                            )}

                            {activeTab === 'notes' && (
                                <div className="p-6">
                                    <h4 className="font-semibold text-brand-text-light mb-4 text-sm uppercase tracking-wider text-brand-text-secondary">Keterangan</h4>
                                    {selectedEvent.clientId === 'INTERNAL' ? (
                                        <form onSubmit={onSubmit} className="space-y-3">
                                            <textarea
                                                name="notes"
                                                value={eventForm.notes}
                                                onChange={onFormChange}
                                                rows={4}
                                                placeholder="Tulis keterangan acara..."
                                                aria-label="Keterangan acara"
                                                className="input-field w-full bg-white/80 custom-scrollbar"
                                            />
                                            <button type="submit" className="button-primary">Simpan Keterangan</button>
                                        </form>
                                    ) : canEditProjectNotes ? (
                                        <div className="space-y-3">
                                            {isEditingProjectNotes ? (
                                                <form onSubmit={handleProjectNotesSubmit} className="space-y-3">
                                                    <textarea
                                                        value={projectNotesDraft}
                                                        onChange={e => setProjectNotesDraft(e.target.value)}
                                                        rows={4}
                                                        placeholder="Tulis keterangan acara..."
                                                        aria-label="Keterangan acara"
                                                        className="input-field w-full bg-white/80 custom-scrollbar"
                                                    />
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={isSavingProjectNotes}
                                                            onClick={() => {
                                                                setProjectNotesDraft(selectedEvent.notes || '');
                                                                setProjectNotesMessage('');
                                                                setIsEditingProjectNotes(false);
                                                            }}
                                                            className="button-secondary inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            <X className="h-4 w-4" /> Batal
                                                        </button>
                                                        <button type="submit" disabled={isSavingProjectNotes} className="button-primary inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60">
                                                            <Save className="h-4 w-4" />
                                                            {isSavingProjectNotes ? 'Menyimpan...' : 'Simpan Keterangan'}
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <>
                                                    {selectedEvent.notes ? (
                                                        <p className="whitespace-pre-wrap text-sm text-brand-text-primary">{selectedEvent.notes}</p>
                                                    ) : (
                                                        <p className="text-sm italic text-brand-text-secondary">Belum ada keterangan.</p>
                                                    )}
                                                    <button type="button" onClick={() => setIsEditingProjectNotes(true)} className="button-secondary inline-flex items-center gap-1.5">
                                                        <Pencil className="h-4 w-4" /> Edit Keterangan
                                                    </button>
                                                </>
                                            )}
                                            {projectNotesMessage && <p role="status" className="text-sm text-brand-text-secondary">{projectNotesMessage}</p>}
                                        </div>
                                    ) : onNavigateToProject && !selectedEvent.id.endsWith('-deadline') ? (
                                        <div>
                                            {selectedEvent.notes ? (
                                                <p className="mb-4 text-sm text-brand-text-primary whitespace-pre-wrap">{selectedEvent.notes}</p>
                                            ) : (
                                                <p className="mb-4 text-sm text-brand-text-secondary italic">Belum ada keterangan.</p>
                                            )}
                                            <button onClick={() => onNavigateToProject(selectedEvent.id)} className="button-secondary">
                                                Tambah Keterangan di Halaman Acara Agenda
                                            </button>
                                        </div>
                                    ) : selectedEvent.notes ? (
                                        <p className="text-sm text-brand-text-primary whitespace-pre-wrap">{selectedEvent.notes}</p>
                                    ) : (
                                        <p className="text-sm text-brand-text-secondary italic">Belum ada keterangan.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-brand-border/40 space-y-2 shrink-0 bg-white/30">
                            {selectedEvent.clientId === 'INTERNAL' ? (
                                <button onClick={() => onSetMode('edit')} className="button-primary w-full">Edit Detail Acara Agenda</button>
                            ) : onNavigateToProject && !selectedEvent.id.endsWith('-deadline') ? (
                                <button onClick={() => onNavigateToProject(selectedEvent.id)} className="button-primary w-full inline-flex items-center justify-center gap-2">
                                    <FolderKanbanIcon className="w-5 h-5" /> Edit di Halaman Acara Agenda
                                </button>
                            ) : (
                                <button onClick={() => onSetMode('edit')} className="button-primary w-full">Lihat Detail (Baca Saja)</button>
                            )}
                            {selectedEvent.clientId === 'INTERNAL' && (
                                <button
                                    onClick={onDelete}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                                >
                                    <Trash2 className="h-4 w-4" /> Hapus Agenda
                                </button>
                            )}
                            {!profile.eventTypes?.includes(selectedEvent.projectType) && (
                                <p className="text-xs text-brand-text-secondary mt-2 text-center">Acara Agenda pengantin hanya dapat diedit di halamannya langsung.</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-6 relative bg-white/30 h-full overflow-y-auto custom-scrollbar">
                        <form onSubmit={onSubmit} className="space-y-5 animate-fade-in form-compact">
                            <div className="input-group"><input type="text" id="eventName" name="projectName" value={eventForm.projectName} onChange={onFormChange} className="input-field bg-white/80" placeholder=" " required /><label htmlFor="eventName" className="input-label">Nama Acara Agenda</label></div>
                            <div className="input-group"><select name="projectType" id="projectType" value={eventForm.projectType} onChange={onFormChange} className="input-field bg-white/80">{(profile.eventTypes || []).map(type => <option key={type} value={type}>{type}</option>)}</select><label htmlFor="projectType" className="input-label">Jenis Acara Agenda</label></div>
                            <div className="input-group"><input type="date" id="eventDate" name="date" value={eventForm.date} onChange={onFormChange} className="input-field bg-white/80" placeholder=" " required /><label htmlFor="eventDate" className="input-label">Tanggal</label></div>
                            <div className="grid grid-cols-2 gap-4"><div className="input-group"><input type="time" id="startTime" name="startTime" value={eventForm.startTime} onChange={onFormChange} className="input-field bg-white/80" placeholder=" " /><label htmlFor="startTime" className="input-label">Mulai</label></div><div className="input-group"><input type="time" id="endTime" name="endTime" value={eventForm.endTime} onChange={onFormChange} className="input-field bg-white/80" placeholder=" " /><label htmlFor="endTime" className="input-label">Selesai</label></div></div>
                            <div className="input-group"><input type="text" id="eventLocation" name="location" value={eventForm.location || ''} onChange={onFormChange} className="input-field bg-white/80" placeholder=" " /><label htmlFor="eventLocation" className="input-label">Lokasi (Opsional)</label></div>
                            <div className="input-group"><input type="url" id="imageUrl" name="image" value={eventForm.image} onChange={onFormChange} className="input-field bg-white/80" placeholder=" " /><label htmlFor="imageUrl" className="input-label">URL Gambar Sampul (Opsional)</label></div>
                            <div className="input-group">
                                <label className="input-label !static !-top-4 !text-brand-accent">Warna Acara Agenda</label>
                                <div className="flex flex-wrap gap-2 mt-2 p-3 border border-brand-border/40 bg-white/60 rounded-xl shadow-inner">
                                    {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6'].map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => onFormCustomColorChange && onFormCustomColorChange(color)}
                                            className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent p-0"
                                            style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, padding: 0 }}
                                            aria-label={`Pilih warna ${color}`}
                                            aria-pressed={eventForm.color === color}
                                        >
                                            <span
                                                className={`block rounded-full border-2 transition-transform ${eventForm.color === color ? 'border-brand-text-primary scale-110 shadow-sm' : 'border-transparent hover:scale-110'}`}
                                                style={{ width: 24, height: 24, backgroundColor: color }}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-brand-text-secondary mt-1">Acara Agenda internal akan menggunakan warna ini. Acara Agenda pengantin akan menggunakan warna Progres Acara Agenda Pengantin (jika ada).</p>
                            </div>
                            <div className="input-group">
                                <label className="input-label !static !-top-4 !text-brand-accent">Tim</label>
                                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-brand-border/40 bg-white/60 p-3 custom-scrollbar shadow-inner">
                                    {teamMembers.length === 0 ? (
                                        <p className="px-2 py-3 text-sm text-brand-text-secondary">Belum ada anggota tim.</p>
                                    ) : teamMembers.map(member => {
                                        const isAssigned = eventForm.team.some((assigned: AssignedTeamMember) => assigned.memberId === member.id);
                                        return (
                                            <label
                                                key={member.id}
                                                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${isAssigned ? 'border-[#5D87FF] bg-[#ECF2FF]' : 'border-brand-border/50 bg-white hover:bg-brand-bg'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isAssigned}
                                                    onChange={() => onTeamChange(member.id)}
                                                    className="h-4 w-4 shrink-0 accent-brand-accent"
                                                />
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border/50 bg-brand-input text-xs font-bold text-brand-text-secondary">
                                                    {member.avatarUrl ? <img src={member.avatarUrl} alt={`${member.name} avatar`} className="h-full w-full object-cover" /> : getInitials(member.name)}
                                                </div>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold text-brand-text-light">{member.name}</span>
                                                    <span className="block truncate text-xs text-brand-text-secondary">{member.role}</span>
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="input-group"><textarea name="notes" id="eventNotes" value={eventForm.notes} onChange={onFormChange} className="input-field bg-white/80 custom-scrollbar" rows={3} placeholder=" "></textarea><label htmlFor="eventNotes" className="input-label">Keterangan</label></div>
                            <div className="flex justify-end gap-3 pt-6 pb-2 border-t border-brand-border/40">
                                {selectedEvent && canDelete && (
                                    <button type="button" onClick={onDelete} className="text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-semibold transition-colors mr-auto">Hapus</button>
                                )}
                                <button type="button" onClick={mode === 'edit' && selectedEvent ? () => onSetMode('detail') : onClose} className="button-secondary shadow-sm">Batal</button>
                                <button type="submit" className="button-primary shadow-md">{selectedEvent ? 'Update Acara Agenda' : 'Simpan Acara Agenda'}</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
interface CalendarViewProps {
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    teamMembers: TeamMember[];
    profile: Profile;
    clients: Client[];
    handleNavigation: (view: ViewType, action?: NavigationAction) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ projects, setProjects, teamMembers, profile, clients, handleNavigation }) => {
    // STATE
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [viewMode, setViewMode] = useState<'Day' | 'Week' | 'Month' | 'Year' | 'Team' | 'Agenda' | 'Client'>(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 640) {
            return 'Agenda';
        }
        return 'Year';
    });

    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Project | null>(null);
    const [panelMode, setPanelMode] = useState<'detail' | 'edit'>('detail');
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
    const [internalEvents, setInternalEvents] = useState<Project[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(true);
    const [calendarLoadError, setCalendarLoadError] = useState(false);
    const [calendarRetryToken, setCalendarRetryToken] = useState(0);
    const [selectedTeamMember, setSelectedTeamMember] = useState<TeamMember | null>(null);
    const [selectedStatModal, setSelectedStatModal] = useState<'events' | 'internal' | 'clients' | 'team' | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [filters, setFilters] = useState<{
        isClientProjectVisible: boolean;
        visibleEventTypes: Set<string> | null;
        selectedClientId: string | null;
    }>({
        isClientProjectVisible: true,
        visibleEventTypes: null,
        selectedClientId: null,
    });

    const initialFormState = useMemo(() => ({
        id: '', projectName: '', projectType: (profile.eventTypes || [])[0] || 'Lainnya', date: formatLocalDate(new Date()),
        startTime: '', endTime: '', notes: '', team: [] as AssignedTeamMember[], image: '', location: '', color: '#3b82f6'
    }), [profile.eventTypes]);

    const [eventForm, setEventForm] = useState(initialFormState);

    useEffect(() => {
        setIsPanelOpen(false);
    }, [currentDate, viewMode]);

    // Load internal calendar events from Supabase for the current month/year
    useEffect(() => {
        let isMounted = true;
        (async () => {
            setIsLoadingEvents(true);
            setCalendarLoadError(false);
            setInternalEvents([]);
            try {
                const from = formatLocalDate(new Date(selectedYear, 0, 1));
                const to = formatLocalDate(new Date(selectedYear, 11, 31));
                const rows = await listCalendarEventsInRange(from, to);
                if (!isMounted) return;
                setInternalEvents(Array.isArray(rows) ? rows.map(event => calendarEventToCalendarProject(event, teamMembers, projects)) : []);
            } catch (e) {
                if (!isMounted) return;
                setCalendarLoadError(true);
                console.warn('[Supabase] Failed to fetch calendar events (range).', e);
            } finally {
                if (isMounted) setIsLoadingEvents(false);
            }
        })();
        return () => { isMounted = false; };
    }, [selectedYear, calendarRetryToken, teamMembers, projects]);

    // Realtime subscription for calendar_events
    useEffect(() => {
        const channel = supabase
            .channel('calendar-events-ch')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calendar_events' }, (payload) => {
                // Refetch or append
                // Safer to re-map quickly
                (async () => {
                    try {
                        const from = formatLocalDate(new Date(selectedYear, 0, 1));
                        const to = formatLocalDate(new Date(selectedYear, 11, 31));
                        const rows = await listCalendarEventsInRange(from, to);
                        setInternalEvents(Array.isArray(rows) ? rows.map(event => calendarEventToCalendarProject(event, teamMembers, projects)) : []);
                    } catch { }
                })();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calendar_events' }, (payload) => {
                (async () => {
                    try {
                        const from = formatLocalDate(new Date(selectedYear, 0, 1));
                        const to = formatLocalDate(new Date(selectedYear, 11, 31));
                        const rows = await listCalendarEventsInRange(from, to);
                        setInternalEvents(Array.isArray(rows) ? rows.map(event => calendarEventToCalendarProject(event, teamMembers, projects)) : []);
                    } catch { }
                })();
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'calendar_events' }, (payload) => {
                setInternalEvents(prev => prev.filter(e => e.id !== (payload.old as any).id));
            })
            .subscribe();

        return () => {
            try { supabase.removeChannel(channel); } catch { }
        };
    }, [currentDate, selectedYear, teamMembers, projects]);

    // MEMOS
    const firstDayOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate]);
    const lastDayOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), [currentDate]);

    const daysInMonthGrid = useMemo(() => {
        const days = [];
        const startDate = new Date(firstDayOfMonth);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        const endDate = new Date(lastDayOfMonth);
        endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
        let date = startDate;
        while (date <= endDate) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    }, [firstDayOfMonth, lastDayOfMonth]);

    const filteredEvents = useMemo(() => {
        const deadlineEvents = (projects || [])
            .filter(p => {
                const deadlineDate = (p as Project & { deadlineDate?: string }).deadlineDate;
                return deadlineDate && deadlineDate.slice(0, 10) !== p.date.slice(0, 10);
            })
            .map(p => ({
                ...p,
                id: `${p.id}-deadline`,
                projectName: `Deadline: ${p.projectName}`,
                date: (p as Project & { deadlineDate?: string }).deadlineDate!,
            } as Project));

        const all = [...projects, ...internalEvents, ...deadlineEvents];
        return all.filter(p => {
            const query = searchTerm.trim().toLocaleLowerCase();
            if (query) {
                const searchableValues = [p.projectName, p.clientName, p.projectType, p.location, p.notes, ...(p.team || []).map(member => member.name)];
                if (!searchableValues.some(value => value?.toLocaleLowerCase().includes(query))) return false;
            }
            const isInternalEvent = profile.eventTypes?.includes(p.projectType);
            if (isInternalEvent) {
                return filters.visibleEventTypes === null || filters.visibleEventTypes.has(p.projectType);
            }
            if (!filters.isClientProjectVisible) return false;
            if (filters.selectedClientId) {
                return p.clientId === filters.selectedClientId;
            }
            return true;
        });
    }, [projects, internalEvents, filters, profile.eventTypes, searchTerm]);

    const monthEvents = useMemo(() => {
        const monthStart = formatLocalDate(firstDayOfMonth);
        const monthEnd = formatLocalDate(lastDayOfMonth);
        return filteredEvents.filter(event => {
            if (!event.date) return false;
            const eventDate = event.date.slice(0, 10);
            return eventDate >= monthStart && eventDate <= monthEnd;
        });
    }, [filteredEvents, firstDayOfMonth, lastDayOfMonth]);

    const internalMonthEvents = useMemo(() => {
        const internalTypes = new Set(profile.eventTypes || []);
        return monthEvents.filter(event => !event.id.endsWith('-deadline') && (event.clientId === 'INTERNAL' || internalTypes.has(event.projectType)));
    }, [monthEvents, profile.eventTypes]);

    const monthProjectEvents = useMemo(() => {
        const internalTypes = new Set(profile.eventTypes || []);
        return monthEvents.filter(event =>
            !event.id.endsWith('-deadline')
            && Boolean(event.clientId)
            && event.clientId !== 'INTERNAL'
            && !internalTypes.has(event.projectType)
        );
    }, [monthEvents, profile.eventTypes]);

    const stats = useMemo(() => {
        const teamStats = new Map<string, { member: TeamMember; eventCount: number }>();
        monthEvents.filter(event => !event.id.endsWith('-deadline')).forEach(event => {
            if (event.team && event.team.length > 0) {
                event.team.forEach(teamMember => {
                    const member = teamMembers.find(m => m.id === teamMember.memberId);
                    if (member) {
                        const current = teamStats.get(member.id) || { member, eventCount: 0 };
                        current.eventCount++;
                        teamStats.set(member.id, current);
                    }
                });
            }
        });
        
        return {
            totalProjects: monthEvents.length,
            totalInternal: internalMonthEvents.length,
            totalClients: new Set(monthProjectEvents.map(event => event.clientId)).size,
            activeTeamMembers: teamStats.size,
            teamStats: Array.from(teamStats.values()),
        };
    }, [monthEvents, internalMonthEvents, monthProjectEvents, teamMembers]);

    const clientsThisMonth = useMemo(() => {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const clientIds = new Set<string>();
        (projects || []).filter(p => {
            const d = new Date(p.date);
            return d >= monthStart && d <= monthEnd && p.clientId && p.clientId !== 'INTERNAL';
        }).forEach(p => clientIds.add(p.clientId));
        return Array.from(clientIds).map(id => {
            const client = clients.find(c => c.id === id);
            return { id, name: client?.name || projects.find(p => p.clientId === id)?.clientName || 'Pengantin' };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [projects, clients, currentDate]);

    const visibleClientsThisMonth = useMemo(() => {
        const visibleClientIds = new Set(monthProjectEvents.map(event => event.clientId));
        return clientsThisMonth.filter(client => visibleClientIds.has(client.id));
    }, [clientsThisMonth, monthProjectEvents]);

    const agendaByDate = useMemo(() => {
        const map = new Map<string, Project[]>();
        [...monthEvents]
            .sort((a, b) => {
                const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
                if (dateDiff !== 0) return dateDiff;
                return (a.startTime || '').localeCompare(b.startTime || '');
            })
            .forEach(event => {
                const dateKey = new Date(event.date).toDateString();
                if (!map.has(dateKey)) { map.set(dateKey, []); }
                map.get(dateKey)!.push(event);
            });
        return Array.from(map.entries());
    }, [monthEvents]);

    const eventsByDate = useMemo(() => {
        const map = new Map<string, Project[]>();
        filteredEvents.forEach(p => {
            const dateKey = new Date(p.date).toDateString();
            if (!map.has(dateKey)) { map.set(dateKey, []); }
            map.get(dateKey)!.push(p);
        });
        return map;
    }, [filteredEvents]);

    // HANDLERS
    const handleOpenPanelForAdd = (date: Date) => {
        setSelectedEvent(null);
        setEventForm({ ...initialFormState, date: formatLocalDate(date) });
        setPanelMode('edit');
        setIsPanelOpen(true);
    };

    const handleOpenPanelForEdit = (event: Project) => {
        setSelectedEvent(event);
        setEventForm({
            id: event.id, projectName: event.projectName, projectType: event.projectType, date: event.date,
            startTime: event.startTime || '', endTime: event.endTime || '', notes: event.notes || '',
            team: event.team || [], image: event.image || '', location: event.location || '',
            color: event.color || '#3b82f6',
        });
        setPanelMode('detail');
        setIsPanelOpen(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setEventForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleProjectNotesSave = async (notes: string) => {
        if (!selectedEvent) throw new Error('Tidak ada acara yang dipilih.');
        const projectId = selectedEvent.id.replace(/-deadline$/, '');
        const project = projects.find(item => item.id === projectId);
        if (!project) throw new Error('Data proyek tidak ditemukan.');

        const updated = await updateProjectInDb(project.id, { notes });
        setProjects(prev => prev.map(item => item.id === project.id ? { ...item, notes: updated.notes } : item));
        setSelectedEvent(prev => prev?.id.replace(/-deadline$/, '') === project.id ? { ...prev, notes: updated.notes } : prev);
    };

    const handleTeamChange = (memberId: string) => {
        const member = teamMembers.find(m => m.id === memberId);
        if (!member) return;
        setEventForm(prev => {
            const isSelected = prev.team.some(t => t.memberId === memberId);
            return { ...prev, team: isSelected ? prev.team.filter(t => t.memberId !== memberId) : [...prev.team, { memberId: member.id, name: member.name, role: member.role, fee: member.standardFee }] };
        });
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const startAt = `${eventForm.date}T${eventForm.startTime || '00:00'}:00`;
        const defaultTimedEnd = eventForm.startTime ? new Date(startAt) : null;
        defaultTimedEnd?.setHours(defaultTimedEnd.getHours() + 1);
        const endAt = eventForm.endTime
            ? `${eventForm.date}T${eventForm.endTime}:00`
            : defaultTimedEnd
                ? `${formatLocalDate(defaultTimedEnd)}T${String(defaultTimedEnd.getHours()).padStart(2, '0')}:${String(defaultTimedEnd.getMinutes()).padStart(2, '0')}:00`
                : `${eventForm.date}T23:59:00`;
        const calendarEventInput = {
            title: eventForm.projectName.trim(),
            eventType: eventForm.projectType,
            date: eventForm.date,
            startAt,
            endAt,
            allDay: !eventForm.startTime,
            teamMemberId: eventForm.team[0]?.memberId,
            notes: eventForm.notes || undefined,
            location: eventForm.location || undefined,
        };

        if (!calendarEventInput.title) {
            alert('Nama agenda wajib diisi.');
            return;
        }
        if (eventForm.endTime && !eventForm.startTime) {
            alert('Isi waktu mulai sebelum mengisi waktu selesai.');
            return;
        }
        const isInternalEvent = (profile.eventTypes || []).includes(eventForm.projectType);
        // Validate time range if both provided
        if (eventForm.startTime && eventForm.endTime) {
            const [sh, sm] = eventForm.startTime.split(':').map((n: string) => parseInt(n, 10));
            const [eh, em] = eventForm.endTime.split(':').map((n: string) => parseInt(n, 10));
            const startMin = sh * 60 + (sm || 0);
            const endMin = eh * 60 + (em || 0);
            if (endMin <= startMin) {
                alert('Waktu selesai harus lebih besar dari waktu mulai.');
                return;
            }
        }
        try {
            if (selectedEvent) {
                // Editing
                if (isInternalEvent && internalEvents.some(ev => ev.id === selectedEvent.id)) {
                    const updated = await updateCalendarEvent(selectedEvent.id, {
                        ...calendarEventInput,
                    });
                    const updatedProject = calendarEventToCalendarProject(updated, teamMembers, projects);
                    setInternalEvents(prev => prev.map(p => p.id === selectedEvent.id ? updatedProject : p));
                    setSelectedEvent(updatedProject);
                    setPanelMode('detail');
                } else {
                    // Client projects are view-only from Calendar. Prevent edit here.
                    alert('Edit Acara Agenda pengantin dari halaman Acara Agenda. Kalender hanya mengedit Acara Agenda internal.');
                }
            } else {
                // Adding new
                if (!isInternalEvent) {
                    alert('Untuk menambahkan Acara Agenda di Kalender, pilih jenis Acara Agenda internal.');
                    return;
                }
                const created = await createCalendarEvent(calendarEventInput);
                setInternalEvents(prev => [...prev, calendarEventToCalendarProject(created, teamMembers, projects)]);
                setIsPanelOpen(false);
            }
        } catch (err: any) {
            console.error('[Supabase][calendar_events.save] error:', err);
            alert(`Gagal menyimpan Acara Agenda. ${err?.message || 'Coba lagi.'}`);
        }
    };

    const handleDeleteEvent = async () => {
        if (!selectedEvent) return;
        const isCalendarEvent = internalEvents.some(event => event.id === selectedEvent.id);
        if (!isCalendarEvent) {
            alert('Agenda ini tidak ditemukan sebagai agenda internal Kalender, jadi tidak dapat dihapus dari sini.');
            return;
        }
        if (!window.confirm(`Yakin ingin menghapus Acara Agenda "${selectedEvent.projectName}"?`)) return;
        try {
            await deleteCalendarEvent(selectedEvent.id);
            setInternalEvents(prev => prev.filter(p => p.id !== selectedEvent.id));
            setIsPanelOpen(false);
        } catch (err: any) {
            console.error('[Supabase][calendar_events.delete] error:', err);
            alert(`Gagal menghapus Acara Agenda. ${err?.message || 'Coba lagi.'}`);
        }
    };

    const handleFilterChange = (filterType: 'client' | 'event', value: boolean | string) => {
        if (filterType === 'client') {
            setFilters(prev => ({ ...prev, isClientProjectVisible: value as boolean }));
        } else {
            setFilters(prev => {
                const newSet = new Set(prev.visibleEventTypes ?? profile.eventTypes ?? []);
                if (newSet.has(value as string)) newSet.delete(value as string);
                else newSet.add(value as string);
                return { ...prev, visibleEventTypes: newSet };
            });
        }
    };

    const handleClientSelect = (clientId: string | null) => {
        setFilters(prev => ({ ...prev, selectedClientId: clientId }));
    };

    const activeFilterCount = Number(Boolean(searchTerm.trim()))
        + Number(!filters.isClientProjectVisible)
        + Number(Boolean(filters.selectedClientId))
        + (filters.visibleEventTypes === null ? 0 : (profile.eventTypes || []).filter(type => !filters.visibleEventTypes?.has(type)).length);

    const resetCalendarFilters = () => {
        setSearchTerm('');
        setFilters({
            isClientProjectVisible: true,
            visibleEventTypes: null,
            selectedClientId: null,
        });
    };

    const handleNavigateToProject = (projectId: string) => {
        const id = projectId.replace(/-deadline$/, '');
        const project = projects.find(item => item.id === id);
        if (project?.clientId) {
            handleNavigation(ViewType.CLIENTS, { type: 'VIEW_CLIENT_DETAILS', id: project.clientId });
        } else {
            handleNavigation(ViewType.CLIENTS);
        }
    };

    const handleNavigateToClient = (clientId: string) => {
        handleNavigation(ViewType.CLIENTS, { type: 'VIEW_CLIENT_DETAILS', id: clientId });
    };

    const handleTaskToggle = async (taskId: string, completed: boolean) => {
        if (!selectedEvent) return;
        const newTasks = (selectedEvent.tasks || []).map(t => t.id === taskId ? { ...t, completed } : t);
        try {
            const updated = await updateCalendarEvent(selectedEvent.id, { tasks: newTasks });
            const updatedProject = calendarEventToCalendarProject(updated, teamMembers, projects);
            setInternalEvents(prev => prev.map(p => p.id === selectedEvent.id ? updatedProject : p));
            setSelectedEvent(updatedProject);
        } catch (e) { console.error('Failed to toggle task', e); }
    };

    const handleTaskAdd = async (taskName: string) => {
        if (!selectedEvent) return;
        const newTask = { id: Date.now().toString(), name: taskName, completed: false };
        const newTasks = [...(selectedEvent.tasks || []), newTask];
        try {
            const updated = await updateCalendarEvent(selectedEvent.id, { tasks: newTasks });
            const updatedProject = calendarEventToCalendarProject(updated, teamMembers, projects);
            setInternalEvents(prev => prev.map(p => p.id === selectedEvent.id ? updatedProject : p));
            setSelectedEvent(updatedProject);
        } catch (e) { console.error('Failed to add task', e); }
    };

    const handleTaskDelete = async (taskId: string) => {
        if (!selectedEvent) return;
        const newTasks = (selectedEvent.tasks || []).filter(t => t.id !== taskId);
        try {
            const updated = await updateCalendarEvent(selectedEvent.id, { tasks: newTasks });
            const updatedProject = calendarEventToCalendarProject(updated, teamMembers, projects);
            setInternalEvents(prev => prev.map(p => p.id === selectedEvent.id ? updatedProject : p));
            setSelectedEvent(updatedProject);
        } catch (e) { console.error('Failed to delete task', e); }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportICS = () => {
        if (filteredEvents.length === 0) {
            alert('Tidak ada acara untuk diekspor.');
            return;
        }

        let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Atter//Calendar//EN\n";

        filteredEvents.forEach(event => {
            const startDate = event.date.replace(/-/g, '');
            let startTime = '000000';
            let endTime = '235959';

            if (event.startTime) {
                startTime = event.startTime.replace(':', '') + '00';
            }
            if (event.endTime) {
                endTime = event.endTime.replace(':', '') + '00';
            } else if (event.startTime) {
                // assume 1 hour duration if no end time
                const endH = parseInt(event.startTime.split(':')[0]) + 1;
                endTime = endH.toString().padStart(2, '0') + event.startTime.split(':')[1] + '00';
            }

            const isAllDay = !event.startTime;

            icsContent += "BEGIN:VEVENT\n";
            icsContent += `UID:${event.id}@atter\n`;
            if (isAllDay) {
                icsContent += `DTSTART;VALUE=DATE:${startDate}\n`;
            } else {
                icsContent += `DTSTART:${startDate}T${startTime}\n`;
                icsContent += `DTEND:${startDate}T${endTime}\n`;
            }
            icsContent += `SUMMARY:${event.projectName}\n`;
            if (event.location) icsContent += `LOCATION:${event.location}\n`;
            if (event.notes) icsContent += `DESCRIPTION:${event.notes.replace(/\n/g, '\\n')}\n`;
            icsContent += "END:VEVENT\n";
        });

        icsContent += "END:VCALENDAR";

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `atter_calendar_${new Date().toISOString().split('T')[0]}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleEventDrop = async (eventId: string, newDate: string) => {
        const event = internalEvents.find(e => e.id === eventId);
        if (!event) return;
        if (event.date === newDate) return; // no change
        try {
            const updated = await updateCalendarEvent(eventId, { date: newDate });
            const updatedProject = calendarEventToCalendarProject(updated, teamMembers, projects);
            setInternalEvents(prev => prev.map(e => e.id === eventId ? updatedProject : e));
            if (selectedEvent?.id === eventId) setSelectedEvent(updatedProject);
        } catch (e) {
            console.error('Failed to drop/move event:', e);
            alert('Gagal memindahkan acara. Coba lagi.');
        }
    };

    
    return (
        <div className="flex min-h-[calc(100vh-8rem)] lg:h-[calc(100vh-8rem)] bg-brand-surface rounded-2xl overflow-visible lg:overflow-hidden relative">
            <CalendarSidebar
                profile={profile}
                isClientProjectVisible={filters.isClientProjectVisible}
                visibleEventTypes={filters.visibleEventTypes}
                selectedClientId={filters.selectedClientId}
                clientsThisMonth={clientsThisMonth}
                stats={stats}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onAddEvent={() => handleOpenPanelForAdd(new Date(currentDate))}
                onClientFilterChange={(v) => handleFilterChange('client', v)}
                onEventTypeFilterChange={(v) => handleFilterChange('event', v)}
                onClientSelect={handleClientSelect}
                onTeamMemberSelect={setSelectedTeamMember}
                currentDate={currentDate}
                onDateSelect={setCurrentDate}
            />

            <BottomSheet
                isOpen={isMobileFilterOpen}
                onClose={() => setIsMobileFilterOpen(false)}
                title="Filter kalender"
                snapPoints={[60, 90]}
            >
                <div className="space-y-5">
                    <label className="flex items-center gap-2 rounded-xl border border-brand-border/60 bg-white px-3 py-2.5">
                        <Search className="h-4 w-4 shrink-0 text-brand-text-secondary" />
                        <input type="search" aria-label="Cari acara kalender" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Cari acara, pengantin, lokasi" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                    </label>
                    <section className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-brand-text-secondary">Sumber acara</h4>
                        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-border/60 bg-white px-3 py-2 text-sm font-medium text-brand-text-light">
                            <input type="checkbox" checked={filters.isClientProjectVisible} onChange={e => handleFilterChange('client', e.target.checked)} className="h-4 w-4 accent-brand-accent" />
                            Acara pengantin
                        </label>
                        {clientsThisMonth.length > 0 && (
                            <select aria-label="Filter berdasarkan pengantin" value={filters.selectedClientId || ''} onChange={e => handleClientSelect(e.target.value || null)} className="input-field w-full rounded-xl text-sm">
                                <option value="">Semua pengantin</option>
                                {clientsThisMonth.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                            </select>
                        )}
                    </section>
                    <section className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-brand-text-secondary">Jenis acara internal</h4>
                        {(profile.eventTypes || []).length > 0 ? (profile.eventTypes || []).map(type => (
                            <label key={type} className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-border/60 bg-white px-3 py-2 text-sm font-medium text-brand-text-light">
                                <input type="checkbox" checked={filters.visibleEventTypes === null || filters.visibleEventTypes.has(type)} onChange={() => handleFilterChange('event', type)} className="h-4 w-4 accent-brand-accent" />
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: eventTypeColors[type] || '#94a3b8' }} />
                                {type}
                            </label>
                        )) : <p className="text-sm text-brand-text-secondary">Belum ada jenis acara internal.</p>}
                    </section>
                    <button type="button" onClick={resetCalendarFilters} className="w-full rounded-xl border border-brand-border px-4 py-3 text-sm font-semibold text-brand-text-secondary hover:bg-brand-bg">
                        Reset filter
                    </button>
                </div>
            </BottomSheet>

            <div className="flex-1 flex flex-row min-h-0 overflow-visible lg:overflow-hidden">
                <div className="flex-1 min-w-0 flex flex-col overflow-visible lg:overflow-y-auto">
                    {/* Stat Cards */}
                    <div className="hidden sm:block p-2.5 sm:p-4 border-b border-brand-border/40 bg-brand-bg/30">
                        <div className="grid grid-cols-2 sm:grid-cols-4 auto-rows-fr gap-3 sm:gap-4 [&>div]:min-h-[120px]">
                            <StatCard
                                icon={<FolderKanbanIcon />}
                                title="Acara Agenda"
                                value={stats.totalProjects.toString()}
                                colorVariant="blue"
                                compactOnMobile
                                iconBesideContentOnMobile
                                onClick={() => setSelectedStatModal('events')}
                            />
                            <StatCard
                                icon={<ClockIcon />}
                                title="Internal"
                                value={stats.totalInternal.toString()}
                                colorVariant="orange"
                                compactOnMobile
                                iconBesideContentOnMobile
                                onClick={() => setSelectedStatModal('internal')}
                            />
                            <StatCard
                                icon={<UsersIcon />}
                                title="Pengantin"
                                value={stats.totalClients.toString()}
                                colorVariant="purple"
                                compactOnMobile
                                iconBesideContentOnMobile
                                onClick={() => setSelectedStatModal('clients')}
                            />
                            <StatCard
                                icon={<BriefcaseIcon />}
                                title="Tim"
                                value={stats.teamStats?.length.toString() || '0'}
                                colorVariant="green"
                                compactOnMobile
                                iconBesideContentOnMobile
                                onClick={() => setSelectedStatModal('team')}
                            />
                        </div>
                    </div>

                    <CalendarHeader
                        currentDate={currentDate}
                        selectedYear={selectedYear}
                        viewMode={viewMode}
                        stats={stats}
                        onFilterClick={() => setIsMobileFilterOpen(true)}
                        activeFilterCount={activeFilterCount}
                        onStatClick={setSelectedStatModal}
                        onAddEvent={() => handleOpenPanelForAdd(new Date(currentDate))}
                        onPrev={() => {
                            if (viewMode === 'Year') {
                                setSelectedYear(prev => prev - 1);
                            } else if (viewMode === 'Day') {
                                const newDate = new Date(currentDate);
                                newDate.setDate(currentDate.getDate() - 1);
                                setCurrentDate(newDate);
                            } else if (viewMode === 'Week') {
                                const newDate = new Date(currentDate);
                                newDate.setDate(currentDate.getDate() - 7);
                                setCurrentDate(newDate);
                            } else {
                                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
                            }
                        }}
                        onNext={() => {
                            if (viewMode === 'Year') {
                                setSelectedYear(prev => prev + 1);
                            } else if (viewMode === 'Day') {
                                const newDate = new Date(currentDate);
                                newDate.setDate(currentDate.getDate() + 1);
                                setCurrentDate(newDate);
                            } else if (viewMode === 'Week') {
                                const newDate = new Date(currentDate);
                                newDate.setDate(currentDate.getDate() + 7);
                                setCurrentDate(newDate);
                            } else {
                                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
                            }
                        }}
                        onToday={() => {
                            setCurrentDate(new Date());
                            setSelectedYear(new Date().getFullYear());
                        }}
                        onViewModeChange={setViewMode}
                        onYearChange={setSelectedYear}
                        onInfoClick={() => setIsInfoModalOpen(true)}
                        onPrint={handlePrint}
                        onExport={handleExportICS}
                    />

                    {isLoadingEvents && viewMode === 'Agenda' && (
                        <p role="status" className="mx-3 mt-3 rounded-xl bg-brand-bg px-3 py-2 text-xs text-brand-text-secondary">
                            Memuat agenda bulan ini...
                        </p>
                    )}

                    {calendarLoadError && (
                        <div role="alert" className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            <p>Acara internal gagal dimuat. Data acara tetap tersedia.</p>
                            <button type="button" onClick={() => setCalendarRetryToken(value => value + 1)} className="shrink-0 rounded-lg border border-amber-300 px-3 py-2 font-semibold hover:bg-amber-100">
                                Coba lagi
                            </button>
                        </div>
                    )}

                    <div
                        className="flex-none lg:flex-1 calendar-grid-container"
                        onTouchStart={(e) => {
                            const touch = e.touches[0];
                            (e.currentTarget as any).touchStartX = touch.clientX;
                            (e.currentTarget as any).touchStartY = touch.clientY;
                        }}
                        onTouchEnd={(e) => {
                            const touchEndX = e.changedTouches[0].clientX;
                            const touchEndY = e.changedTouches[0].clientY;
                            const touchStartX = (e.currentTarget as any).touchStartX;
                            const touchStartY = (e.currentTarget as any).touchStartY;
                            if (touchStartX === undefined || touchStartY === undefined) return;

                            const diffX = touchStartX - touchEndX;
                            const diffY = touchStartY - touchEndY;

                            // Only trigger swipe if horizontal movement is significantly larger than vertical
                            // This prevents accidental year changes when scrolling vertically
                            if (Math.abs(diffX) < Math.abs(diffY)) return;
                            if (Math.abs(diffX) < 50) return;

                            // Swipe Left (Next)
                            if (diffX > 50) {
                                if (viewMode === 'Year') {
                                    setSelectedYear(prev => prev + 1);
                                } else if (viewMode === 'Day') {
                                    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1));
                                } else if (viewMode === 'Week') {
                                    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
                                } else if (viewMode === 'Month') {
                                    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                                }
                            }
                            // Swipe Right (Prev)
                            else if (diffX < -50) {
                                if (viewMode === 'Year') {
                                    setSelectedYear(prev => prev - 1);
                                } else if (viewMode === 'Day') {
                                    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 1));
                                } else if (viewMode === 'Week') {
                                    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
                                } else if (viewMode === 'Month') {
                                    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                                }
                            }
                        }}
                    >
                        {isLoadingEvents && viewMode !== 'Agenda' && <CalendarSkeleton />}
                        {viewMode === 'Day' ? (
                            <DayView
                                currentDate={currentDate}
                                eventsByDate={eventsByDate}
                                profile={profile}
                                clients={clients}
                                onEventClick={handleOpenPanelForEdit}
                            />
                        ) : viewMode === 'Week' ? (
                            <WeekView
                                currentDate={currentDate}
                                eventsByDate={eventsByDate}
                                profile={profile}
                                clients={clients}
                                isLoading={isLoadingEvents}
                                onDayClick={setCurrentDate}
                                onEventClick={handleOpenPanelForEdit}
                            />
                        ) : viewMode === 'Month' ? (
                            <MonthView
                                currentDate={currentDate}
                                daysInMonth={daysInMonthGrid}
                                eventsByDate={eventsByDate}
                                profile={profile}
                                clients={clients}
                                isLoading={isLoadingEvents}
                                onDayClick={handleOpenPanelForAdd}
                                onEventClick={handleOpenPanelForEdit}
                                onEventDrop={handleEventDrop}
                            />
                        ) : viewMode === 'Year' ? (
                            <YearView
                                selectedYear={selectedYear}
                                eventsByDate={eventsByDate}
                                profile={profile}
                                clients={clients}
                                onMonthClick={(month) => {
                                    setCurrentDate(new Date(selectedYear, month, 1));
                                    setViewMode('Month');
                                }}
                                onEventClick={handleOpenPanelForEdit}
                            />
                        ) : viewMode === 'Team' ? (
                            <TeamView
                                currentDate={currentDate}
                                eventsByDate={eventsByDate}
                                teamMembers={teamMembers}
                                clients={clients}
                                profile={profile}
                                isLoading={isLoadingEvents}
                                onEventClick={handleOpenPanelForEdit}
                            />
                        ) : viewMode === 'Client' ? (
                            <ClientView
                                projects={projects}
                                clients={clients}
                                profile={profile}
                                onEventClick={handleOpenPanelForEdit}
                            />
                        ) : (
                            <AgendaView
                                agendaByDate={agendaByDate}
                                profile={profile}
                                clients={clients}
                                onEventClick={handleOpenPanelForEdit}
                            />
                        )}
                    </div>
                </div>

                <EventPanel
                    isOpen={isPanelOpen}
                    mode={panelMode}
                    selectedEvent={selectedEvent}
                    eventForm={eventForm}
                    teamMembers={teamMembers}
                    clients={clients}
                    profile={profile}
                    canDelete={selectedEvent ? internalEvents.some(event => event.id === selectedEvent.id) : false}
                    canEditProjectNotes={selectedEvent ? projects.some(project => project.id === selectedEvent.id.replace(/-deadline$/, '')) : false}
                    onSaveProjectNotes={handleProjectNotesSave}
                    onClose={() => setIsPanelOpen(false)}
                    onSetMode={setPanelMode}
                    onFormChange={handleFormChange}
                    onTeamChange={handleTeamChange}
                    onSubmit={handleFormSubmit}
                    onDelete={handleDeleteEvent}
                    onNavigateToProject={handleNavigateToProject}
                    onNavigateToClient={handleNavigateToClient}
                    onTaskToggle={handleTaskToggle}
                    onTaskAdd={handleTaskAdd}
                    onTaskDelete={handleTaskDelete}
                />
            </div>

            <Modal isOpen={!!selectedTeamMember} onClose={() => setSelectedTeamMember(null)} title={`Detail Tim - ${selectedTeamMember?.name}`}>
                {selectedTeamMember && (
                    <div className="space-y-6">
                        {/* Member Profile Card */}
                        <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-brand-accent/5 to-brand-accent/10 rounded-2xl border border-brand-accent/20">
                            <div className="w-20 h-20 rounded-full overflow-hidden bg-brand-accent/20 flex items-center justify-center text-brand-accent font-bold text-3xl border-2 border-brand-accent/30 shadow-lg">
                                {selectedTeamMember.avatarUrl ? <img src={selectedTeamMember.avatarUrl} alt={`${selectedTeamMember.name} avatar`} className="w-full h-full object-cover" /> : getInitials(selectedTeamMember.name)}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-xl text-brand-text-light">{selectedTeamMember.name}</h3>
                                <p className="text-sm text-brand-text-secondary font-medium">{selectedTeamMember.role}</p>
                                <div className="flex items-center gap-4 mt-2">
                                    {selectedTeamMember.phone && (
                                        <p className="text-xs text-brand-text-secondary flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-brand-accent"></span>
                                            {selectedTeamMember.phone}
                                        </p>
                                    )}
                                    {selectedTeamMember.standardFee && (
                                        <p className="text-xs text-brand-text-secondary flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                            {formatCurrency(selectedTeamMember.standardFee)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Stats Summary */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 bg-white/50 rounded-xl border border-brand-border/40 text-center">
                                <p className="text-2xl font-bold text-brand-accent">
                                    {(() => {
                                        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                                        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                                        const memberEvents = filteredEvents.filter(event => {
                                            const eventDate = new Date(event.date);
                                            const isInMonth = eventDate >= monthStart && eventDate <= monthEnd;
                                            const hasMember = event.team?.some(t => t.memberId === selectedTeamMember.id);
                                            return isInMonth && hasMember;
                                        });
                                        return memberEvents.length;
                                    })()}
                                </p>
                                <p className="text-[10px] text-brand-text-secondary uppercase tracking-wider mt-1">Acara Bulan Ini</p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-xl border border-brand-border/40 text-center">
                                <p className="text-2xl font-bold text-brand-accent">
                                    {(() => {
                                        const memberEvents = filteredEvents.filter(event => 
                                            event.team?.some(t => t.memberId === selectedTeamMember.id)
                                        );
                                        return memberEvents.length;
                                    })()}
                                </p>
                                <p className="text-[10px] text-brand-text-secondary uppercase tracking-wider mt-1">Total Acara</p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-xl border border-brand-border/40 text-center">
                                <p className="text-2xl font-bold text-brand-accent">
                                    {(() => {
                                        const memberEvents = filteredEvents.filter(event => 
                                            event.team?.some(t => t.memberId === selectedTeamMember.id)
                                        );
                                        const totalRevenue = memberEvents.reduce((sum, event) => sum + (event.totalCost || 0), 0);
                                        return formatCurrency(totalRevenue);
                                    })()}
                                </p>
                                <p className="text-[10px] text-brand-text-secondary uppercase tracking-wider mt-1">Total Revenue</p>
                            </div>
                        </div>

                        {/* Events List */}
                        <div>
                            <h4 className="font-semibold text-brand-text-light mb-4 flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-brand-accent" />
                                Acara Bulan Ini
                            </h4>
                            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                                {(() => {
                                    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                                    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                                    const memberEvents = filteredEvents.filter(event => {
                                        const eventDate = new Date(event.date);
                                        const isInMonth = eventDate >= monthStart && eventDate <= monthEnd;
                                        const hasMember = event.team?.some(t => t.memberId === selectedTeamMember.id);
                                        return isInMonth && hasMember;
                                    });

                                    if (memberEvents.length === 0) {
                                        return (
                                            <div className="text-center py-8 bg-white/30 rounded-xl border border-brand-border/30">
                                                <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-brand-text-secondary/30" />
                                                <p className="text-sm text-brand-text-secondary">Tidak ada acara bulan ini</p>
                                            </div>
                                        );
                                    }

                                    return memberEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(event => {
                                        const bgColor = getEventColor(event, profile);
                                        const eventDate = new Date(event.date);
                                        const dayName = eventDate.toLocaleDateString('id-ID', { weekday: 'long' });
                                        const formattedDate = eventDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
                                        
                                        return (
                                            <div
                                                key={event.id}
                                                onClick={() => {
                                                    setSelectedTeamMember(null);
                                                    handleOpenPanelForEdit(event);
                                                }}
                                                className="p-4 rounded-xl bg-white/60 border border-brand-border/40 cursor-pointer hover:bg-white hover:shadow-md transition-all group"
                                                style={{ borderLeft: `4px solid ${bgColor}` }}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-[10px] font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-bg/50 px-2 py-0.5 rounded">
                                                                {dayName}
                                                            </span>
                                                            <span className="text-xs text-brand-text-secondary">
                                                                {formattedDate}
                                                            </span>
                                                        </div>
                                                        <p className="font-semibold text-brand-text-light text-base mb-1">{event.projectName}</p>
                                                        <div className="flex items-center gap-3 text-xs text-brand-text-secondary">
                                                            {event.startTime && (
                                                                <span className="flex items-center gap-1">
                                                                    <ClockIcon className="w-3 h-3" />
                                                                    {event.startTime} {event.endTime && `- ${event.endTime}`}
                                                                </span>
                                                            )}
                                                            {event.location && (
                                                                <span className="flex items-center gap-1">
                                                                    <MapPinIcon className="w-3 h-3" />
                                                                    {event.location}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {event.clientId !== 'INTERNAL' && event.clientName && (
                                                            <div className="text-xs text-brand-text-secondary mt-2 flex items-center gap-1">
                                                                <UsersIcon className="w-3 h-3" />
                                                                {event.clientName}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {event.totalCost && (
                                                            <span className="text-sm font-bold text-brand-accent">
                                                                {formatCurrency(event.totalCost)}
                                                            </span>
                                                        )}
                                                        <ChevronRightIcon className="w-5 h-5 text-brand-text-secondary group-hover:text-brand-accent transition-colors" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Stat Card Modals */}
            <Modal isOpen={selectedStatModal === 'events'} onClose={() => setSelectedStatModal(null)} title="Detail Acara Agenda">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-white/50 rounded-xl border border-brand-border/40">
                            <p className="text-2xl font-bold text-brand-accent">{stats.totalProjects}</p>
                            <p className="text-xs text-brand-text-secondary uppercase tracking-wider mt-1">Total Acara</p>
                        </div>
                        <div className="p-4 bg-white/50 rounded-xl border border-brand-border/40">
                            <p className="text-2xl font-bold text-brand-accent">
                                {formatCurrency(monthProjectEvents.reduce((sum, event) => sum + (event.totalCost || 0), 0))}
                            </p>
                            <p className="text-xs text-brand-text-secondary uppercase tracking-wider mt-1">Total Revenue</p>
                        </div>
                    </div>
                    
                    <h4 className="font-semibold text-brand-text-light mb-3">Acara Bulan Ini</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {(() => {
                            const eventsForMonth = monthEvents;

                            if (eventsForMonth.length === 0) {
                                return <p className="text-sm text-brand-text-secondary italic text-center py-4">Tidak ada acara bulan ini.</p>;
                            }

                            return eventsForMonth.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(event => {
                                const bgColor = getEventColor(event, profile);
                                return (
                                    <div
                                        key={event.id}
                                        onClick={() => {
                                            setSelectedStatModal(null);
                                            handleOpenPanelForEdit(event);
                                        }}
                                        className="p-3 rounded-xl bg-white/50 border border-brand-border/40 cursor-pointer hover:bg-white transition-colors"
                                        style={{ borderLeft: `4px solid ${bgColor}` }}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="font-semibold text-brand-text-light text-sm">{event.projectName}</p>
                                                <p className="text-xs text-brand-text-secondary mt-1">
                                                    {new Date(event.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                    {event.startTime && ` • ${event.startTime}`}
                                                </p>
                                                {event.location && (
                                                    <p className="text-xs text-brand-text-secondary mt-1 flex items-center gap-1">
                                                        <MapPinIcon className="w-3 h-3" />
                                                        {event.location}
                                                    </p>
                                                )}
                                            </div>
                                            <ChevronRightIcon className="w-4 h-4 text-brand-text-secondary mt-1" />
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={selectedStatModal === 'internal'} onClose={() => setSelectedStatModal(null)} title="Detail Acara Internal">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-white/50 rounded-xl border border-brand-border/40">
                            <p className="text-2xl font-bold text-brand-accent">{stats.totalInternal}</p>
                            <p className="text-xs text-brand-text-secondary uppercase tracking-wider mt-1">Total Internal</p>
                        </div>
                        <div className="p-4 bg-white/50 rounded-xl border border-brand-border/40">
                            <p className="text-2xl font-bold text-brand-accent">{internalMonthEvents.length}</p>
                            <p className="text-xs text-brand-text-secondary uppercase tracking-wider mt-1">Bulan Ini</p>
                        </div>
                    </div>
                    
                    <h4 className="font-semibold text-brand-text-light mb-3">Acara Internal Bulan Ini</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {(() => {
                            const monthInternalEventsList = internalMonthEvents;

                            if (monthInternalEventsList.length === 0) {
                                return <p className="text-sm text-brand-text-secondary italic text-center py-4">Tidak ada acara internal bulan ini.</p>;
                            }

                            return monthInternalEventsList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(event => {
                                const bgColor = getEventColor(event, profile);
                                return (
                                    <div
                                        key={event.id}
                                        onClick={() => {
                                            setSelectedStatModal(null);
                                            handleOpenPanelForEdit(event);
                                        }}
                                        className="p-3 rounded-xl bg-white/50 border border-brand-border/40 cursor-pointer hover:bg-white transition-colors"
                                        style={{ borderLeft: `4px solid ${bgColor}` }}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="font-semibold text-brand-text-light text-sm">{event.projectName}</p>
                                                <p className="text-xs text-brand-text-secondary mt-1">
                                                    {new Date(event.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                    {event.startTime && ` • ${event.startTime}`}
                                                </p>
                                                {event.location && (
                                                    <p className="text-xs text-brand-text-secondary mt-1 flex items-center gap-1">
                                                        <MapPinIcon className="w-3 h-3" />
                                                        {event.location}
                                                    </p>
                                                )}
                                            </div>
                                            <ChevronRightIcon className="w-4 h-4 text-brand-text-secondary mt-1" />
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={selectedStatModal === 'clients'} onClose={() => setSelectedStatModal(null)} title="Detail Pengantin">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-white/50 rounded-xl border border-brand-border/40">
                            <p className="text-2xl font-bold text-brand-accent">{stats.totalClients}</p>
                            <p className="text-xs text-brand-text-secondary uppercase tracking-wider mt-1">Total Pengantin</p>
                        </div>
                        <div className="p-4 bg-white/50 rounded-xl border border-brand-border/40">
                            <p className="text-2xl font-bold text-brand-accent">
                                {formatCurrency(monthProjectEvents.reduce((sum, event) => sum + (event.totalCost || 0), 0))}
                            </p>
                            <p className="text-xs text-brand-text-secondary uppercase tracking-wider mt-1">Total Revenue</p>
                        </div>
                    </div>
                    
                    <h4 className="font-semibold text-brand-text-light mb-3">Pengantin Bulan Ini</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {visibleClientsThisMonth.length === 0 ? (
                            <p className="text-sm text-brand-text-secondary italic text-center py-4">Tidak ada pengantin bulan ini.</p>
                        ) : (
                            visibleClientsThisMonth.map(client => {
                                const clientProjects = monthProjectEvents.filter(p => p.clientId === client.id);
                                return (
                                    <div
                                        key={client.id}
                                        onClick={() => {
                                            setSelectedStatModal(null);
                                            handleNavigateToClient(client.id);
                                        }}
                                        className="p-3 rounded-xl bg-white/50 border border-brand-border/40 cursor-pointer hover:bg-white transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="font-semibold text-brand-text-light text-sm">{client.name}</p>
                                                <p className="text-xs text-brand-text-secondary mt-1">{clientProjects.length} Acara</p>
                                            </div>
                                            <ChevronRightIcon className="w-4 h-4 text-brand-text-secondary mt-1" />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={selectedStatModal === 'team'} onClose={() => setSelectedStatModal(null)} title="Detail Tim">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-white/50 rounded-xl border border-brand-border/40">
                            <p className="text-2xl font-bold text-brand-accent">{teamMembers.length}</p>
                            <p className="text-xs text-brand-text-secondary uppercase tracking-wider mt-1">Total Tim</p>
                        </div>
                        <div className="p-4 bg-white/50 rounded-xl border border-brand-border/40">
                            <p className="text-2xl font-bold text-brand-accent">{stats.teamStats?.length.toString() || '0'}</p>
                            <p className="text-xs text-brand-text-secondary uppercase tracking-wider mt-1">Tim Aktif Bulan Ini</p>
                        </div>
                    </div>
                    
                    <h4 className="font-semibold text-brand-text-light mb-3">Semua Anggota Tim</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {teamMembers.length === 0 ? (
                            <p className="text-sm text-brand-text-secondary italic text-center py-4">Tidak ada anggota tim terdaftar.</p>
                        ) : (
                            teamMembers.map(member => {
                                const memberStats = stats.teamStats?.find(s => s.member.id === member.id);
                                const eventCount = memberStats?.eventCount || 0;
                                
                                return (
                                    <div
                                        key={member.id}
                                        onClick={() => {
                                            setSelectedStatModal(null);
                                            setSelectedTeamMember(member);
                                        }}
                                        className="p-3 rounded-xl bg-white/50 border border-brand-border/40 cursor-pointer hover:bg-white transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-accent/10 flex items-center justify-center text-brand-accent font-bold text-sm border border-brand-accent/20">
                                                    {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" /> : getInitials(member.name)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-brand-text-light text-sm">{member.name}</p>
                                                    <p className="text-xs text-brand-text-secondary">{member.role}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-brand-accent text-lg">{eventCount}</p>
                                                <p className="text-[9px] text-brand-text-secondary uppercase tracking-wider">Acara</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Panduan Halaman Kalender">
                <div className="space-y-4 text-sm text-brand-text-primary max-h-[70vh] overflow-y-auto">
                    <p>Halaman Kalender membantu Anda memvisualisasikan semua jadwal penting dalam satu tempat.</p>
                    <h4 className="font-semibold text-brand-text-light mt-4">Fitur Tampilan</h4>
                    <ul className="list-disc list-inside space-y-1.5">
                        <li><strong>Hari:</strong> Tampilan detail per hari dengan timeline jam.</li>
                        <li><strong>Minggu:</strong> Tampilan mingguan untuk melihat jadwal 7 hari sekaligus.</li>
                        <li><strong>Bulan:</strong> Kalender bulanan tradisional dengan Acara Agenda di tiap tanggal.</li>
                        <li><strong>Agenda:</strong> Daftar acara pada bulan terpilih, dikelompokkan per tanggal.</li>
                    </ul>
                    <h4 className="font-semibold text-brand-text-light mt-4">Jenis Acara Agenda</h4>
                    <ul className="list-disc list-inside space-y-1.5">
                        <li><strong>Acara Agenda Pengantin:</strong> Semua Acara Agenda wedding pengantin tampil otomatis dengan nama pengantin, Package, status bayar, dan lokasi. Klik Acara Agenda untuk lihat detail lengkap dan buka halaman Acara Agenda/Pengantin.</li>
                        <li><strong>Acara Agenda Internal:</strong> Meeting Pengantin, Survey Lokasi, Libur, Workshop, dll. Bisa dibuat dan diedit langsung dari kalender.</li>
                        <li><strong>Deadline Acara Agenda:</strong> Tanggal deadline Acara Agenda tampil otomatis sebagai Acara Agenda terpisah.</li>
                    </ul>
                    <h4 className="font-semibold text-brand-text-light mt-4">Filter & Statistik</h4>
                    <ul className="list-disc list-inside space-y-1.5">
                        <li><strong>Statistik Bulan:</strong> Jumlah Acara Agenda, Acara Agenda internal, dan pengantin unik bulan ini.</li>
                        <li><strong>Statistik Tim:</strong> Daftar semua anggota tim dengan jumlah acara bulan ini. Klik untuk lihat detail acara tim.</li>
                        <li><strong>Filter per Pengantin:</strong> Dropdown untuk fokus pada Acara Agenda satu pengantin tertentu.</li>
                        <li><strong>Filter Tampilan:</strong> Sembunyikan Acara Agenda pengantin atau Acara Agenda internal tertentu (Meeting, Libur, dll).</li>
                    </ul>
                    <h4 className="font-semibold text-brand-text-light mt-4">Aksi Cepat</h4>
                    <ul className="list-disc list-inside space-y-1.5">
                        <li>Klik tanggal kosong → buka form buat Agenda baru pada tanggal tersebut.</li>
                        <li>Klik Acara Agenda → modal detail dengan info pengantin, Package, pembayaran, lokasi, tim.</li>
                        <li><strong>Buka Halaman Acara Agenda</strong> → navigasi langsung ke detail Acara Agenda.</li>
                        <li><strong>Buka Pengantin</strong> → navigasi ke profil pengantin.</li>
                    </ul>
                </div>
            </Modal>
        </div>
    );
};

export default CalendarView;