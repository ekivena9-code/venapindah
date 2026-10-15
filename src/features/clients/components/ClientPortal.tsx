import React, { useState, useMemo, useEffect } from 'react';
import {
  Client, Project, ClientFeedback, SatisfactionLevel, Transaction,
  Profile, Package, SubStatusConfig, TransactionType, ClientPortalProps,
  ProjectStatusConfig, TeamMember,
} from '../../../types';
import {
  FolderKanbanIcon, ClockIcon, StarIcon, FileTextIcon, HomeIcon,
  CreditCardIcon, CheckCircleIcon, SendIcon, DownloadIcon,
  GalleryHorizontalIcon, MessageSquareIcon, ChevronRightIcon,
  CalendarIcon, BriefcaseIcon, DollarSignIcon, UsersIcon,
  GoogleIcon, LinkIcon,
} from '../../../constants';
import Modal from '../../../shared/ui/Modal';
import SignaturePad from '../../../shared/ui/SignaturePad';
import { createClientFeedback, updateClientFeedback } from '../../../services/clientFeedback';
import { getClientByPortalAccessId } from '../../../services/clients';
import { listProjectsByClientId } from '../../../services/projects';
import { listProjectMeetings, type ProjectMeeting } from '../../../services/calendarEvents';
import { supabase } from '../../../lib/supabaseClient';
import { toPublicNameSlug } from '../../../utils/publicRouting';
import HelpBox from '../../../shared/ui/HelpBox';
import InvoiceDocument from '../../finance/components/InvoiceDocument';
import PackageTermsDisplay from '../../packages/components/PackageTermsDisplay';
import { getPackageTerms } from '../../packages/packageTerms';
import WorkflowDisplay from '../../packages/components/WorkflowDisplay';
import { getWorkflows } from '../../packages/workflows';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Belum ditentukan';

const formatCurrency = (amount: number, opts?: { showDecimals?: boolean; compact?: boolean }) => {
  const { showDecimals = true, compact = false } = opts || {};
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
    notation: compact ? 'compact' : 'standard',
  }).format(amount);
};
const formatDocumentCurrency = (n: number) => formatCurrency(n, { showDecimals: true });
const formatDisplayCurrency = (n: number) => formatCurrency(n, { showDecimals: false });

const getSatisfactionFromRating = (r: number): SatisfactionLevel => {
  if (r >= 5) return SatisfactionLevel.VERY_SATISFIED;
  if (r >= 4) return SatisfactionLevel.SATISFIED;
  if (r >= 3) return SatisfactionLevel.NEUTRAL;
  return SatisfactionLevel.UNSATISFIED;
};

const getDisplayProgress = (project: Project, config: ProjectStatusConfig[]): number => {
  if (!config?.length) return typeof project.progress === 'number' ? Math.round(project.progress) : 0;
  const raw = project.progress;
  if (typeof raw === 'number' && !Number.isNaN(raw) && raw >= 0 && raw <= 100) return Math.round(raw);
  const idx = config.findIndex(s => s.name === project.status);
  if (idx === -1) return 0;
  const sc = config[idx];
  if (sc.defaultProgress != null) return Math.min(100, Math.max(0, sc.defaultProgress));
  return Math.round(((idx + 1) / config.length) * 100);
};

// ─── Portal CSS — monochrome ──────────────────────────────────────────────────

const PORTAL_STYLES = `
  /* ── base ── */
  .portal-page { background: #f4f4f5; min-height: 100vh; }

  .portal-card {
    background: #ffffff;
    border: 1px solid #e4e4e7;
    box-shadow: 0 2px 12px -4px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  }

  .portal-surface {
    background: #ffffff;
  }

  .portal-border {
    border-color: #e4e4e7;
  }

  /* ── hero ── */
  .hero-gradient { 
    background: url('/assets/images/backgrounds/portal-pengantin-3.jpg') center/cover no-repeat;
  }

  /* ── tabs ── */
  .tab-active-mono {
    background: #18181b;
    color: #ffffff;
    box-shadow: 0 4px 14px -4px rgba(0,0,0,0.30);
  }

  /* ── progress bar ── */
  .progress-bar { background: #3f3f46; }

  /* ── timeline dots ── */
  .timeline-dot-done    { background: #52525b; }
  .timeline-dot-current { background: #18181b; animation: portalPulse 2s infinite; }
  .timeline-dot-future  { background: #d4d4d8; }

  @keyframes portalPulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(24,24,27,0.30); }
    50%      { box-shadow: 0 0 0 8px rgba(24,24,27,0); }
  }
  @keyframes portalFadeUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .portal-animate   { animation: portalFadeUp 0.4s ease both; }
  .portal-animate-1 { animation-delay:0.05s; }
  .portal-animate-2 { animation-delay:0.10s; }
  .portal-animate-3 { animation-delay:0.15s; }
  .portal-animate-4 { animation-delay:0.20s; }
  .portal-animate-5 { animation-delay:0.25s; }

  @media (max-width: 640px) {
    .portal-page .portal-tab-content {
      scroll-margin-top: 60px;
    }

    .portal-page .portal-hero-overlay {
      background-color: rgba(0, 0, 0, 0.8);
    }

    .portal-page .portal-tab-navigation {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0;
      overflow: visible;
    }

    .portal-page .portal-tab-navigation > .portal-tab-button {
      min-width: 0;
      justify-content: center;
      padding-left: 0.375rem;
      padding-right: 0.375rem;
      text-align: center;
      white-space: normal;
      line-height: 1.2;
    }

    :is(#root:not(:has(main[data-mobile-ui-scale-excluded="true"], #invoice, .invoice-document-mobile, .print-invoice, .printable-content, .contract-document, .pdf-viewer)), .app-modal-dialog:not(:has(#invoice, .invoice-document-mobile, .print-invoice, .printable-content, .contract-document, .pdf-viewer))) button:not(.bottom-nav button).portal-tab-button {
      min-height: 44px !important;
    }

    .portal-page [class*="text-[8px]"] {
      font-size: 0.65rem !important;
      line-height: 1.25 !important;
    }

    .portal-page [class*="text-[9px]"] {
      font-size: 0.7rem !important;
      line-height: 1.3 !important;
    }

    .portal-page [class*="text-[10px]"] {
      font-size: 0.76rem !important;
      line-height: 1.35 !important;
    }

    .portal-page .text-xs {
      font-size: 0.8rem !important;
      line-height: 1.4 !important;
    }
  }
`;

// ─── Main component ───────────────────────────────────────────────────────────

const ClientPortal: React.FC<ClientPortalProps> = ({
  accessId, clients = [], projects = [], transactions = [], setClientFeedback,
  showNotification, userProfile, packages = [], teamMembers = [],
}) => {
  const profile = userProfile || {} as Profile;
  const [fetchedClient, setFetchedClient] = useState<Client | null>(null);
  const [fetchedProjects, setFetchedProjects] = useState<Project[]>([]);
  const [isFetchingDirect, setIsFetchingDirect] = useState(false);
  const [hasAttemptedDirectFetch, setHasAttemptedDirectFetch] = useState(false);

  const client = useMemo(() => {
    const matches = (clients || []).filter(c => c.portalAccessId === accessId || c.id === accessId || c.name === accessId || toPublicNameSlug(c.name) === accessId);
    const fromProps = matches.length === 1 ? matches[0] : null;
    return fromProps || fetchedClient;
  }, [clients, accessId, fetchedClient]);

  useEffect(() => {
    if (!accessId) return;
    const matchesInProps = (clients || []).filter(c => c.portalAccessId === accessId || c.id === accessId || c.name === accessId || toPublicNameSlug(c.name) === accessId);
    const existsInProps = matchesInProps.length === 1;
    if (!existsInProps && !client) {
      let active = true;
      setIsFetchingDirect(true);
      getClientByPortalAccessId(accessId)
        .then(c => {
          if (!active) return;
          setFetchedClient(c);
          if (c?.id) listProjectsByClientId(c.id).then(prjs => { if (active) setFetchedProjects(prjs || []); });
        })
        .catch(err => console.warn('[ClientPortal] Direct fetch error:', err))
        .finally(() => { if (active) { setIsFetchingDirect(false); setHasAttemptedDirectFetch(true); } });
      return () => { active = false; };
    } else if (client && fetchedProjects.length === 0) {
      const hasInProps = (projects || []).some(p => p.clientId === client.id);
      if (!hasInProps) listProjectsByClientId(client.id).then(prjs => setFetchedProjects(prjs || []));
    }
  }, [accessId, clients, client]);

  const isVendorClient = client?.clientType === 'Vendor';

  const clientProjects = useMemo(() => {
    const pool = projects && projects.length > 0 ? projects : fetchedProjects;
    const filtered = (pool || []).filter(p => p.clientId === client?.id);
    return filtered.length > 0
      ? filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      : (fetchedProjects || []);
  }, [projects, fetchedProjects, client]);

  const [viewingDocument, setViewingDocument] = useState<{ type: 'invoice' | 'receipt'; project: Project; data: any } | null>(null);
  const [activeTab, setActiveTab] = useState<string>(isVendorClient ? 'proyek' : 'beranda');

  // Loading state
  if (!client) {
    if (accessId && (isFetchingDirect || !hasAttemptedDirectFetch)) {
      return (
        <div className="flex items-center justify-center min-h-screen portal-page">
          <style>{PORTAL_STYLES}</style>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-200" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-zinc-800 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-500 animate-pulse">Memuat Portal Pengantin…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-screen portal-page px-4">
        <style>{PORTAL_STYLES}</style>
        <div className="portal-card rounded-3xl p-10 text-center max-w-md w-full">
          <h1 className="text-2xl font-black text-slate-800">Portal Tidak Ditemukan</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">Tautan portal yang Anda buka tidak valid atau sudah tidak aktif.</p>
          <a href="#/home" className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold shadow-lg hover:scale-105 transition-transform">
            Kembali ke Beranda
          </a>
        </div>
      </div>
    );
  }

  const tabs = [
    ...(!isVendorClient ? [{ key: 'beranda', label: 'Beranda', active: 'tab-active-mono' }] : []),
    { key: 'proyek', label: 'Acara Saya', active: 'tab-active-mono' },
    { key: 'meeting', label: 'Jadwal Meeting', active: 'tab-active-mono' },
    { key: 'dokumen', label: 'Link File', active: 'tab-active-mono' },
    ...(!isVendorClient ? [{ key: 'keuangan', label: 'Invoice', active: 'tab-active-mono' }] : []),
    ...(!isVendorClient ? [{ key: 'syarat-paket', label: 'Syarat & Ketentuan', active: 'tab-active-mono' }] : []),
    ...(!isVendorClient ? [{ key: 'workflow', label: 'Workflow', active: 'tab-active-mono' }] : []),
    { key: 'testimoni', label: 'Testimoni', active: 'tab-active-mono' },
  ];

  return (
    <div className="portal-page">
      <style>{PORTAL_STYLES}</style>

      {/* ══════════════════════════════════════════════════════════════════
          HERO BANNER
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="hero-gradient relative overflow-hidden"
        style={{ backgroundImage: `url(${profile.publicPageConfig?.backgroundImages?.portalPengantin || '/assets/images/backgrounds/portal-pengantin-3.jpg'})` }}
      >
        {/* Overlay for text readability */}
        <div className="portal-hero-overlay absolute inset-0 bg-black/60 pointer-events-none" />

        {/* Decorative */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            {/* Avatar (only if provided) */}
            {client.avatarUrl && (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl overflow-hidden bg-white/10 border-2 border-white/20 flex items-center justify-center flex-shrink-0 shadow-xl">
                <img src={client.avatarUrl} alt={`${client.name} avatar`} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-white/75 text-xs font-semibold uppercase tracking-widest mb-1">{profile?.companyName || ''}</p>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                Halo, <span className="text-zinc-300">{(client.name || 'Pengantin').split(/[\s&]/)[0]}!</span>
              </h1>
              <p className="text-white/85 text-sm mt-1 font-medium">Selamat datang di portal pernikahan Anda</p>

              <div className="mt-3 sm:mt-4 flex flex-wrap gap-2">
                {clientProjects.length > 0 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white text-xs font-semibold">
                    {clientProjects.length} Acara
                  </span>
                )}
                {clientProjects.some(p => p.paymentStatus === 'Lunas') && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 border border-white/15 text-zinc-200 text-xs font-semibold">
                    Lunas
                  </span>
                )}
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white text-xs font-semibold">
                  Terdaftar sejak {formatDate(client.since)}
                </span>
              </div>
            </div>

            <div className="flex-shrink-0">
              <HelpBox variant="public" phone={profile?.phone || '085693994277'} buttonOnly />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB NAV
      ══════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-zinc-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="portal-tab-navigation flex gap-1 py-2 overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (window.innerWidth <= 640) {
                    // Reset scroll to top so the new tab's content starts at the top
                    // of the viewport (below the sticky tab bar), not at the previous
                    // tab's scroll position.
                    window.scrollTo({ top: 0, behavior: 'instant' });
                  }
                }}
                className={`portal-tab-button flex-shrink-0 inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                  activeTab === tab.key
                    ? tab.active
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB CONTENT
      ══════════════════════════════════════════════════════════════════ */}
      <div className="portal-tab-content max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'beranda' && !isVendorClient && <DashboardTab client={client} projects={clientProjects} profile={profile} packages={packages} />}
        {activeTab === 'proyek' && <ProjectsTab projects={clientProjects} profile={profile} teamMembers={teamMembers} />}
        {activeTab === 'meeting' && <MeetingsTab projects={clientProjects} />}
        {activeTab === 'dokumen' && <GalleryTab projects={clientProjects} packages={packages} />}
        {activeTab === 'keuangan' && !isVendorClient && <FinanceTab projects={clientProjects} transactions={transactions} profile={profile} packages={packages} client={client} onViewDocument={setViewingDocument} />}
        {activeTab === 'syarat-paket' && !isVendorClient && (
          <PackageTermsDisplay
            terms={getPackageTerms(profile.publicPageConfig?.packageTerms)}
            packageName={Array.from(new Set(clientProjects.map(project =>
              packages.find(pkg => pkg.id === project.packageId)?.name || project.packageName,
            ).filter((name): name is string => !!name))).join(', ') || undefined}
          />
        )}
        {activeTab === 'workflow' && !isVendorClient && (
          <WorkflowDisplay
            workflows={getWorkflows(profile.publicPageConfig)}
            projectName={clientProjects.map(project => project.projectName).filter(Boolean).join(', ') || undefined}
          />
        )}
        {activeTab === 'testimoni' && <FeedbackTab client={client} setClientFeedback={setClientFeedback} showNotification={showNotification} />}
      </div>

      {/* Document viewer */}
      <DocumentViewerModal
        viewingDocument={viewingDocument}
        onClose={() => setViewingDocument(null)}
        profile={profile}
        packages={packages}
        client={client}
        projects={clientProjects}
      />
    </div>
  );
};

const MeetingsTab: React.FC<{ projects: Project[] }> = ({ projects }) => {
  const [meetings, setMeetings] = useState<Array<{ meeting: ProjectMeeting; projectName: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let requestSequence = 0;

    const loadMeetings = async () => {
      const requestId = ++requestSequence;
      setIsLoading(true);
      setError(false);
      try {
        const results = await Promise.all(projects.map(async project => ({
          projectName: project.projectName,
          meetings: await listProjectMeetings(project.id),
        })));
        if (!active || requestId !== requestSequence) return;
        setMeetings(results
          .flatMap(result => result.meetings.map(meeting => ({ meeting, projectName: result.projectName })))
          .sort((a, b) => a.meeting.event.startAt.localeCompare(b.meeting.event.startAt)));
      } catch (loadError) {
        if (!active || requestId !== requestSequence) return;
        console.error('[ClientPortal][meetings.load] Failed to load client project meetings:', loadError);
        setError(true);
      } finally {
        if (active && requestId === requestSequence) setIsLoading(false);
      }
    };

    void loadMeetings();
    const channel = supabase
      .channel(`client-portal-meetings-${projects.map(project => project.id).join('-').slice(0, 120)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
        void loadMeetings();
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[ClientPortal][meetings.realtime] Subscription failed:', status);
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [projects]);

  return (
    <div className="space-y-4">
      <div className="portal-card rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-5 h-5 text-zinc-700" />
          </div>
          <div>
            <h2 className="text-base font-black text-zinc-900">Jadwal Meeting</h2>
            <p className="text-xs text-zinc-500 mt-1">Meeting dan Zoom yang dijadwalkan untuk acara Anda.</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="portal-card rounded-2xl p-8 text-center text-sm font-semibold text-zinc-500">
          Memuat jadwal meeting...
        </div>
      ) : error ? (
        <div className="portal-card rounded-2xl p-6 text-center text-sm font-semibold text-red-700" role="alert">
          Jadwal meeting gagal dimuat. Silakan muat ulang halaman.
        </div>
      ) : meetings.length === 0 ? (
        <div className="portal-card rounded-2xl p-8 text-center">
          <CalendarIcon className="w-8 h-8 mx-auto text-zinc-300" />
          <p className="text-sm font-bold text-zinc-700 mt-3">Belum ada jadwal meeting</p>
          <p className="text-xs text-zinc-500 mt-1">Jadwal dari tim kami akan tampil di sini setelah dibuat.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map(({ meeting, projectName }) => {
            const { event, metadata } = meeting;
            const startTime = event.startAt.match(/T(\d{2}:\d{2})/)?.[1];
            const endTime = event.endAt.match(/T(\d{2}:\d{2})/)?.[1];
            const date = event.date || event.startAt.slice(0, 10);
            const _d = new Date(`${date}T00:00:00`);
            const weekdays = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
            const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
            const dateLabel = `${weekdays[_d.getDay()]} ${_d.getDate()} ${months[_d.getMonth()]} ${_d.getFullYear()}`;
            const isZoom = metadata.kind === 'zoom';

            return (
              <article key={event.id} className="portal-card rounded-2xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-600">
                      {isZoom ? 'Zoom Meeting' : 'Meeting Pengantin'}
                    </span>
                    <h3 className="mt-2 text-sm sm:text-base font-black text-zinc-900">{event.title}</h3>
                    <p className="mt-1 text-xs font-semibold text-zinc-500">{projectName}</p>
                  </div>
                  <div className="sm:text-right shrink-0">
                    <p className="text-xs font-bold text-zinc-800">{dateLabel}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {startTime || 'Waktu belum dicantumkan'}{endTime ? ` – ${endTime}` : ''}
                    </p>
                  </div>
                </div>

                {(metadata.location || event.location || (isZoom && metadata.zoomUrl)) && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-3">
                    {(metadata.location || event.location) && (
                      <p className="text-xs text-zinc-600">
                        <span className="font-bold text-zinc-800">Lokasi:</span> {metadata.location || event.location}
                      </p>
                    )}
                    {isZoom && metadata.zoomUrl && (
                      <a
                        href={metadata.zoomUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 underline underline-offset-2"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        Buka Link Zoom
                      </a>
                    )}
                  </div>
                )}

                {metadata.resultNotes && (
                  <div className="mt-3 rounded-xl bg-zinc-50 border border-zinc-100 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Catatan meeting</p>
                    <p className="text-xs leading-relaxed text-zinc-700 whitespace-pre-wrap">{metadata.resultNotes}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

const DashboardTab: React.FC<{
  client: Client; projects: Project[]; profile: Profile; packages: Package[];
}> = ({ client, projects = [], profile, packages = [] }) => {
  const safeProjects = projects || [];
  const safePackages = packages || [];
  const safeStatusConfig = profile?.projectStatusConfig || [];

  const activeProject = useMemo(() => safeProjects.find(p => p.status !== 'Selesai' && p.status !== 'Dibatalkan'), [safeProjects]);
  const displayProgress = useMemo(() => activeProject ? getDisplayProgress(activeProject, safeStatusConfig) : 0, [activeProject, safeStatusConfig]);
  const upcomingProject = useMemo(() => (safeProjects || []).filter(p => new Date(p.date) >= new Date()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0], [safeProjects]);
  const activePackage = useMemo(() => activeProject ? safePackages.find(pk => pk.id === activeProject.packageId) || null : null, [activeProject, safePackages]);

  const financial = useMemo(() => ({
    totalValue: safeProjects.reduce((s, p) => s + (p.totalCost || 0), 0),
    totalPaid: safeProjects.reduce((s, p) => s + (p.amountPaid || 0), 0),
    totalDue: safeProjects.reduce((s, p) => s + ((p.totalCost || 0) - (p.amountPaid || 0)), 0),
  }), [safeProjects]);

  return (
    <div className="space-y-5">

      {/* Upcoming event banner */}
      {upcomingProject && (
        <div className="portal-card rounded-3xl overflow-hidden portal-animate portal-animate-1">
          <div className="bg-zinc-900 px-5 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Acara Mendatang</p>
          </div>
          <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-black text-lg text-zinc-900 truncate">{upcomingProject.projectName}</p>
              <p className="text-sm text-zinc-500 mt-0.5">{upcomingProject.location}</p>
            </div>
            <div className="px-5 py-3 rounded-2xl bg-zinc-900 text-white text-center flex-shrink-0">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-50">Tanggal</p>
              <p className="text-sm font-bold mt-0.5">{formatDate(upcomingProject.date)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Finance summary */}
      <div className="grid grid-cols-3 gap-3 portal-animate portal-animate-2">
        {[
          { label: 'Total Package', value: formatDisplayCurrency(financial.totalValue) },
          { label: 'Terbayar', value: formatDisplayCurrency(financial.totalPaid) },
          { label: 'Sisa Pembayaran', value: formatDisplayCurrency(financial.totalDue) },
        ].map(item => (
          <div key={item.label} className="portal-card rounded-2xl p-4 flex flex-col justify-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{item.label}</p>
            <p className="text-sm font-black text-zinc-900 mt-1 leading-tight">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Progress card */}
      {activeProject && (
        <div className="portal-card rounded-3xl p-5 sm:p-6 portal-animate portal-animate-3">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-black text-zinc-900">Progres Acara</p>
              <p className="text-xs text-zinc-500">{activeProject.projectName}</p>
            </div>
            <span className="text-2xl font-black text-zinc-900 tabular-nums">{displayProgress}%</span>
          </div>

          <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
            <div className="h-full progress-bar rounded-full transition-all duration-1000" style={{ width: `${displayProgress}%` }} />
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-[10px] font-bold text-zinc-700 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block animate-pulse" />
              {activeProject.status}
            </span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {displayProgress >= 100 ? 'Selesai' : displayProgress >= 75 ? 'Hampir Selesai' : 'On Going'}
            </span>
          </div>
        </div>
      )}

      {/* Package detail */}
      {activeProject && (
        <div className="portal-card rounded-3xl p-5 sm:p-6 portal-animate portal-animate-4">
          <div className="mb-5">
            <p className="text-sm font-black text-zinc-900">Rincian Package</p>
            <p className="text-xs text-zinc-500">Detail pesanan Anda</p>
          </div>

          <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Paket Terpilih</p>
            <p className="text-base font-black text-zinc-900">{activeProject.packageName || activePackage?.name || 'Custom Package'}</p>
            {(activeProject as any).durationSelection && (
              <p className="text-xs font-medium text-zinc-500 mt-1">Durasi: {(activeProject as any).durationSelection}</p>
            )}
          </div>

          {/* Package items */}
          {activePackage && (activePackage.digitalItems?.length > 0 || activePackage.physicalItems?.length > 0) && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activePackage.digitalItems?.length > 0 && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Layanan Digital</p>
                  <ul className="space-y-2">
                    {activePackage.digitalItems.map((it, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeProject.completedDigitalItems?.includes(it) ? 'bg-zinc-800' : 'bg-zinc-400'}`} />
                        <span className={activeProject.completedDigitalItems?.includes(it) ? 'line-through text-zinc-400' : ''}>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {activePackage.physicalItems?.length > 0 && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Item Fisik / Vendor</p>
                  <ul className="space-y-2">
                    {activePackage.physicalItems.map((it, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 flex-shrink-0" />{it.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Projects Tab ─────────────────────────────────────────────────────────────

const ProjectsTab: React.FC<{
  projects: Project[]; profile: Profile; teamMembers: TeamMember[];
}> = ({ projects = [], profile, teamMembers = [] }) => {
  const safeProjects = projects || [];
  const safeMembers = teamMembers || [];
  const safeStatusConfig = profile?.projectStatusConfig || [];

  const [selectedId, setSelectedId] = useState<string | null>(safeProjects[0]?.id || null);

  useEffect(() => {
    if (!selectedId && safeProjects.length > 0) setSelectedId(safeProjects[0].id);
  }, [safeProjects, selectedId]);

  const selectedProject = useMemo(() => safeProjects.find(p => p.id === selectedId) || safeProjects[0], [safeProjects, selectedId]);
  const displayProgress = useMemo(() => selectedProject ? getDisplayProgress(selectedProject, safeStatusConfig) : 0, [selectedProject, safeStatusConfig]);

  const teamByCategory = useMemo(() => {
    if (!selectedProject?.team) return { Tim: {}, Vendor: {} };
    return selectedProject.team.reduce((acc, member) => {
      const orig = safeMembers.find(m => m.id === member.memberId);
      const cat = orig?.category || 'Tim';
      if (!acc[cat]) acc[cat] = {};
      if (!acc[cat][member.role]) acc[cat][member.role] = [];
      acc[cat][member.role].push({ ...member, phone: orig?.phone, email: orig?.email });
      return acc;
    }, { Tim: {}, Vendor: {} } as Record<string, Record<string, any[]>>);
  }, [selectedProject?.team, safeMembers]);

  return (
    <div className="space-y-5">
      {/* Project selector */}
      {projects.length > 1 && (
        <div className="portal-card rounded-2xl p-4 portal-animate portal-animate-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Pilih Acara</p>
          <div className="relative">
            <select
              value={selectedId || ''}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
            </select>
            <ChevronRightIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rotate-90 text-slate-400 pointer-events-none" />
          </div>
        </div>
      )}

      {!selectedProject ? (
        <div className="portal-card rounded-2xl p-8 text-center portal-animate">
          <p className="text-xs sm:text-sm font-bold text-slate-400">Pilih acara untuk melihat detailnya</p>
        </div>
      ) : (
        <div className="space-y-3.5">

          {/* Header card */}
          <div className="portal-card rounded-2xl overflow-hidden portal-animate portal-animate-1 h-fit">
            <div className="bg-zinc-900 p-3.5 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-0.5">Detail Acara</p>
                  <h3 className="text-base sm:text-lg font-black text-white leading-tight truncate">{selectedProject.projectName}</h3>
                </div>
                <span className="text-xs text-white/70 font-semibold shrink-0">{formatDate(selectedProject.date)}</span>
              </div>
              <p className="text-xs text-white/60 mt-1 truncate">{selectedProject.location}</p>

              {/* Progress */}
              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] font-bold text-white/50 mb-1">
                  <span>Progres Pengerjaan</span>
                  <span>{displayProgress}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${displayProgress}%` }} />
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 divide-x divide-zinc-100">
              {[
                { label: 'Status', value: selectedProject.status, color: 'text-zinc-800' },
                { label: 'Tahapan', value: `${safeStatusConfig.length} Langkah`, color: 'text-zinc-800' },
              ].map(s => (
                <div key={s.label} className="px-3 py-2 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{s.label}</p>
                  <p className={`text-xs font-black mt-0.5 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Journey roadmap */}
          <div className="portal-card rounded-2xl p-4 sm:p-5 portal-animate portal-animate-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Perjalanan Acara</p>

            <div className="relative pl-8">
              <div className="absolute left-2.5 top-2 bottom-2 w-px bg-zinc-200" />
              <div className="absolute left-2.5 top-2 w-px progress-bar transition-all duration-1000" style={{ height: `${displayProgress}%`, maxHeight: 'calc(100% - 16px)' }} />

              <div className="space-y-3">
                {safeStatusConfig
                  .filter(s => s.name !== 'Dibatalkan' || selectedProject.status === 'Dibatalkan')
                  .map((sc, idx) => {
                    const stageIdx = safeStatusConfig.findIndex(s => s.name === selectedProject.status);
                    const isCurrent = selectedProject.status === sc.name;
                    const isPast = idx < stageIdx;
                    const isFuture = idx > stageIdx;

                    return (
                      <div key={sc.id} className="relative">
                        <div className={`absolute -left-5.5 top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 flex items-center justify-center ${isPast ? 'timeline-dot-done' : isCurrent ? 'timeline-dot-current' : 'timeline-dot-future'
                          }`}>
                          {isPast && <CheckCircleIcon className="w-2.5 h-2.5 text-white" />}
                          {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>

                        <div className={`rounded-xl border p-3 transition-all h-fit ${isCurrent ? 'bg-white border-zinc-300 shadow-sm ring-1 ring-zinc-200' :
                            isPast ? 'bg-zinc-50 border-zinc-100 opacity-70' :
                              'bg-transparent border-transparent opacity-40'
                          }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[9px] font-black uppercase tracking-widest shrink-0 ${isCurrent ? 'text-zinc-600' : 'text-zinc-400'}`}>Tahap {idx + 1}</span>
                              <h4 className={`font-black text-sm leading-tight truncate ${isCurrent ? 'text-zinc-900' : isPast ? 'text-zinc-600' : 'text-zinc-400'}`}>{sc.name}</h4>
                              {isCurrent && <span className="px-1.5 py-0.5 bg-zinc-900 text-white rounded-full text-[8px] font-black uppercase tracking-wider shrink-0">Aktif</span>}
                            </div>
                            {sc.subStatuses.length > 0 && (
                              <span className="text-[9px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full shrink-0">
                                {sc.subStatuses.filter(s => selectedProject.confirmedSubStatuses?.includes(s.name)).length}/{sc.subStatuses.length}
                              </span>
                            )}
                          </div>

                          {sc.subStatuses.length > 0 && !isFuture && (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {sc.subStatuses.map(sub => {
                                const isConfirmed = selectedProject.confirmedSubStatuses?.includes(sub.name);
                                const isActive = selectedProject.activeSubStatuses?.includes(sub.name) && isCurrent;
                                return (
                                  <div key={sub.name} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${isConfirmed ? 'bg-zinc-100 opacity-60' :
                                      isActive ? 'bg-zinc-100 border border-zinc-300' :
                                        'bg-zinc-50'
                                    }`}>
                                    <div className={`mt-0.5 w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center ${isConfirmed ? 'bg-zinc-600' :
                                        isActive ? 'bg-zinc-900 shadow-sm' :
                                          'border-2 border-zinc-300 bg-white'
                                      }`}>
                                      {isConfirmed && <CheckCircleIcon className="w-2 h-2 text-white" />}
                                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className={`font-bold leading-tight ${isActive ? 'text-zinc-900' : isConfirmed ? 'text-zinc-400 line-through' : 'text-zinc-700'}`}>{sub.name}</p>
                                      {sub.note && <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{sub.note}</p>}
                                      {selectedProject.clientSubStatusNotes?.[sub.name] && (
                                        <p className="text-[10px] text-zinc-600 font-bold mt-1 bg-white rounded-lg px-2 py-0.5 border border-zinc-200">
                                          "{selectedProject.clientSubStatusNotes[sub.name]}"
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Vendor list */}
          {selectedProject.team && selectedProject.team.length > 0 && Object.values(teamByCategory['Vendor'] || {}).flat().length > 0 && (
            <div className="portal-card rounded-3xl p-5 sm:p-6 portal-animate portal-animate-3">
              <div className="mb-5">
                <p className="text-sm font-black text-zinc-900">Daftar Vendor</p>
                <p className="text-xs text-zinc-500">Tim yang bertugas di acara Anda</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(teamByCategory['Vendor'] || {}).map(([role, members]: [string, any[]]) => (
                  <div key={role}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 px-1">{role}</p>
                    {members.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-2xl mb-2">
                        <div className="w-8 h-8 rounded-xl bg-zinc-200 flex items-center justify-center text-zinc-700 font-black text-xs flex-shrink-0">
                          {m.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-zinc-900 truncate">{m.name}</p>
                          {m.subJob && <p className="text-[10px] text-zinc-500">{m.subJob}</p>}
                          {m.phone && <p className="text-[10px] text-zinc-400 mt-0.5">{m.phone}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Gallery / Files Tab ──────────────────────────────────────────────────────

const GalleryTab: React.FC<{ projects: Project[]; packages?: Package[] }> = ({ projects }) => {
  if (!projects || projects.length === 0) {
    return (
      <div className="portal-card rounded-3xl p-10 text-center portal-animate">
        <p className="text-sm font-black text-slate-800">Belum Ada Acara atau Berkas</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Tautan Google Drive untuk dokumentasi acara Anda akan segera ditampilkan di sini setelah disiapkan oleh tim.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {projects.map((project, i) => {
        const linkItems = [
          {
            id: 'final',
            label: 'Hasil Akhir',
            sub: 'Foto & Video Final',
            url: project.finalDriveLink,
            activeStyle: 'bg-zinc-900 text-white border-zinc-800 shadow-md hover:bg-black',
            badgeText: 'File Final',
          },
          {
            id: 'brief',
            label: 'Moodboard / Brief',
            sub: 'Referensi & Arahan Tim',
            url: project.driveLink,
            activeStyle: 'bg-zinc-800 text-white border-zinc-700 shadow-md hover:bg-zinc-900',
            badgeText: 'Brief Acara',
          },
          {
            id: 'client',
            label: 'File dari Anda',
            sub: 'Materi / Unggahan Anda',
            url: project.clientDriveLink,
            activeStyle: 'bg-zinc-700 text-white border-zinc-600 shadow-md hover:bg-zinc-800',
            badgeText: 'Unggahan',
          },
        ];

        const readyLinksCount = linkItems.filter(item => Boolean(item.url)).length;

        return (
          <div
            key={project.id}
            className="portal-card rounded-3xl p-5 sm:p-6 portal-animate"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-sm font-black text-slate-800">File & Tautan Dokumentasi</h3>
                <p className="text-xs text-slate-500 font-medium">{project.projectName}</p>
              </div>

              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                readyLinksCount > 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-zinc-100 text-zinc-500 border-zinc-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${readyLinksCount > 0 ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                {readyLinksCount > 0 ? `${readyLinksCount} dari 3 Tautan Siap` : 'Menunggu Tautan'}
              </span>
            </div>

            {/* Drive link cards: uniform grid with balanced card heights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {linkItems.map(link => {
                const isReady = Boolean(link.url);
                return (
                  <a
                    key={link.id}
                    href={link.url || '#'}
                    target={link.url ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className={`flex flex-col justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-300 min-h-[120px] ${
                      isReady
                        ? `${link.activeStyle} hover:scale-[1.02] active:scale-[0.98] cursor-pointer`
                        : 'bg-zinc-50/80 border-dashed border-zinc-200 text-zinc-400 opacity-70 cursor-not-allowed select-none'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        isReady
                          ? 'bg-white/15 text-white'
                          : 'bg-zinc-200/80 text-zinc-500'
                      }`}>
                        {link.badgeText}
                      </span>
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-black leading-snug">{link.label}</p>
                      <p className={`text-[11px] mt-0.5 font-medium ${isReady ? 'text-white/70' : 'text-zinc-400'}`}>
                        {link.sub}
                      </p>
                      <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-semibold">
                        <span className={isReady ? 'text-white font-bold' : 'text-zinc-400'}>
                          {isReady ? 'Buka Google Drive ↗' : 'Belum Ditambahkan'}
                        </span>
                        {isReady && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Subtle contextual footer */}
            <div className="mt-4 pt-3.5 border-t border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-zinc-500 font-medium">
              <span>
                Semua file tersimpan aman di Google Drive dan dapat diakses langsung tanpa batas waktu.
              </span>
              <span className="text-zinc-400 text-[10px]">
                Sinkronisasi Cloud Vena Pictures
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Finance Tab ──────────────────────────────────────────────────────────────

const FinanceTab: React.FC<{
  projects: Project[]; transactions: Transaction[]; profile: Profile;
  packages: Package[]; client: Client; onViewDocument: (d: any) => void;
}> = ({ projects = [], transactions = [], client, onViewDocument }) => (
  <div className="space-y-5">
    {(projects || []).map((project, i) => {
      const txs = (transactions || []).filter(t => t.projectId === project.id && t.type === TransactionType.INCOME);
      const paidPct = project.totalCost > 0 ? Math.min(100, Math.round((project.amountPaid / project.totalCost) * 100)) : 0;

      return (
        <div key={project.id} className="portal-card rounded-3xl p-5 sm:p-6 portal-animate" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-black text-slate-800">{project.projectName}</p>
              <p className="text-xs text-slate-500">{formatDate(project.date)}</p>
            </div>
            <button
              onClick={() => onViewDocument({ type: 'invoice', project, data: project })}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-black shadow-sm hover:scale-105 active:scale-95 transition-all"
            >
              Invoice
            </button>
          </div>

          {/* Payment summary */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] font-bold text-zinc-500 mb-1.5">
              <span>Progres Pembayaran</span>
              <span className="text-zinc-700">{paidPct}%</span>
            </div>
            <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
              <div className="h-full progress-bar rounded-full transition-all duration-700" style={{ width: `${paidPct}%` }} />
            </div>
            <div className="flex gap-3 mt-3">
              <div className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Terbayar</p>
                <p className="text-sm font-black text-zinc-900 mt-0.5">{formatDisplayCurrency(project.amountPaid)}</p>
              </div>
              <div className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Sisa</p>
                <p className="text-sm font-black text-zinc-900 mt-0.5">{formatDisplayCurrency(project.totalCost - project.amountPaid)}</p>
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">Riwayat Pembayaran</p>
            <div className="space-y-2">
              {txs.length > 0 ? txs.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-zinc-100 hover:shadow-sm transition-all group">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-zinc-700 truncate">{tx.description}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{formatDate(tx.date)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-sm font-black text-zinc-900">{formatDisplayCurrency(tx.amount)}</p>
                    <button onClick={() => onViewDocument({ type: 'receipt', project, data: tx })} className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-all">
                      Kwitansi
                    </button>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                  <p className="text-sm font-bold text-zinc-400">Belum ada pembayaran tercatat</p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

// ─── Feedback Tab ─────────────────────────────────────────────────────────────

const FeedbackTab: React.FC<{
  client: Client; setClientFeedback: any; showNotification: any;
}> = ({ client, setClientFeedback, showNotification }) => {
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [existingFeedbackId, setExistingFeedbackId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!client?.name) return;
      try {
        const { data } = await supabase
          .from('client_feedback')
          .select('*')
          .eq('client_name', client.name)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data && mounted) {
          setExistingFeedbackId(data.id);
          setRating(data.rating || 0);
          setFeedbackText(data.feedback || '');
        }
      } catch (err) { console.warn('Could not check existing feedback:', err); }
    })();
    return () => { mounted = false; };
  }, [client?.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { alert('Mohon berikan peringkat.'); return; }
    setIsSubmitting(true);
    try {
      const payload = {
        clientName: client!.name, rating,
        satisfaction: getSatisfactionFromRating(rating),
        feedback: feedbackText,
        date: new Date().toISOString(),
      };
      if (existingFeedbackId) {
        const updated = await updateClientFeedback(existingFeedbackId, payload);
        setClientFeedback((prev: ClientFeedback[]) => prev.map(f => f.id === existingFeedbackId ? updated : f));
        showNotification('Terima kasih! Ulasan Anda telah diperbarui.');
      } else {
        const created = await createClientFeedback(payload as Omit<ClientFeedback, 'id'>);
        setExistingFeedbackId(created.id);
        setClientFeedback((prev: ClientFeedback[]) => [created, ...prev]);
        showNotification('Terima kasih! Masukan Anda telah tersimpan.');
      }
    } catch (err) {
      console.error('[ClientPortal] Feedback save failed:', err);
      showNotification('Gagal menyimpan masukan. Coba lagi.');
    } finally { setIsSubmitting(false); }
  };

  const labels = ['', 'Buruk', 'Kurang', 'Cukup', 'Bagus', 'Luar Biasa'];

  return (
    <div className="portal-card rounded-3xl p-5 sm:p-6 portal-animate portal-animate-1">
      <div className="mb-6">
        <h3 className="text-base font-black text-slate-800">{existingFeedbackId ? 'Ubah Testimoni' : 'Berikan Testimoni'}</h3>
        <p className="text-xs text-slate-500">{existingFeedbackId ? 'Perbarui penilaian Anda' : 'Berbagi pengalaman bersama kami'}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Star rating */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Tingkat Kepuasan</p>
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="transition-all hover:scale-125 active:scale-95"
              >
                <StarIcon className={`w-10 h-10 transition-all ${rating >= star
                    ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                    : 'text-slate-200 fill-slate-200'
                  }`} />
              </button>
            ))}
            {rating > 0 && (
              <span className="text-sm font-black text-amber-600 ml-1">{labels[rating]}</span>
            )}
          </div>
        </div>

        {/* Textarea */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Testimoni Anda</p>
          <textarea
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
            placeholder="Tuliskan pengalaman berkesan Anda bersama kami…"
            rows={5}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-300 transition-all resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-zinc-900 text-white font-black rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          {isSubmitting ? 'Menyimpan…' : (
            <>{existingFeedbackId ? 'Perbarui Testimoni' : 'Kirim Testimoni'}</>
          )}
        </button>
      </form>
    </div>
  );
};

// ─── Document Viewer Modal ────────────────────────────────────────────────────

const DocumentViewerModal: React.FC<{
  viewingDocument: any; onClose: any; profile: Profile;
  packages: Package[]; client: Client; projects: Project[];
}> = ({ viewingDocument, onClose, profile, packages, client, projects }) => {
  const [isSigning, setIsSigning] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const handleSaveSignature = (signature: string) => {
    console.log('Saving signature:', signature?.substring(0, 50) + '...');
    setIsSigning(false);
  };

  const handleDownloadPDF = async () => {
    if (!viewingDocument) return;
    setIsDownloadingPDF(true);
    setDownloadError('');
    try {
      const targetId = viewingDocument.type === 'invoice' ? 'invoice-document' : 'receipt-document';
      const element = document.getElementById(targetId);
      if (!element) throw new Error(`Dokumen ${viewingDocument.type} tidak ditemukan untuk diunduh.`);
      const opt = {
        margin: [6, 8, 6, 8] as [number, number, number, number],
        filename: `${viewingDocument.type}-${viewingDocument.project?.clientName?.replace(/\s+/g, '-').toLowerCase()}-${viewingDocument.project?.id.slice(-8)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 1280,
          onclone: (clonedDoc: any) => {
            const el = clonedDoc.getElementById(targetId);
            if (el) {
              el.style.width = '100%';
              el.style.maxWidth = '100%';
              el.style.minWidth = '0';
              el.style.margin = '0';
              el.style.boxSizing = 'border-box';
              el.style.boxShadow = 'none';
              el.classList.add('force-desktop');
            }
            const container = clonedDoc.querySelector('.html2pdf__container');
            if (container) {
              container.style.boxSizing = 'border-box';
              container.style.overflow = 'visible';
            }
            const padDivs = clonedDoc.querySelectorAll('tbody > div');
            padDivs.forEach((div: HTMLElement) => {
              const tr = clonedDoc.createElement('tr');
              tr.className = 'html2pdf-pad-row';
              tr.style.border = 'none';
              tr.style.background = 'transparent';
              const td = clonedDoc.createElement('td');
              td.colSpan = 10;
              td.style.height = div.style.height || `${div.offsetHeight}px`;
              td.style.border = 'none';
              td.style.padding = '0';
              td.style.margin = '0';
              td.style.background = 'transparent';
              tr.appendChild(td);
              if (div.parentNode) {
                div.parentNode.replaceChild(tr, div);
              }
            });
          },
        },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.avoid-break'] },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      };
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('[ClientPortal][document.download] Failed to download document PDF:', error);
      setDownloadError('PDF gagal diunduh. Silakan coba lagi.');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const renderBody = () => {
    if (!viewingDocument) return null;
    const { type, project, data } = viewingDocument;
    if (type === 'invoice') {
      return <InvoiceDocument id="invoice-document" project={project} profile={profile} packages={packages} client={client} />;
    }
    const tx = data as Transaction;
    const proj = tx.projectId ? (projects || []).find((p: Project) => p.id === tx.projectId) : null;
    return (
      <div id="receipt-document" className="p-4 sm:p-8 bg-white border border-slate-200 shadow-xl mx-auto w-full font-sans text-slate-900">
        <div className="flex justify-between items-start mb-10 pb-6 border-b-2 border-blue-600">
          <div>
            {profile.logoBase64
              ? <img src={profile.logoBase64} alt="Logo" className="h-14 object-contain mb-2" />
              : <h2 className="text-xl font-bold text-blue-600 mb-1">{profile.companyName}</h2>
            }
            <p className="text-xs text-slate-500">{profile.address}</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-black text-slate-400 uppercase tracking-widest">Tanda Terima</h1>
            <p className="text-xs font-mono text-slate-500 mt-1">#{tx.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <div className="bg-slate-50 p-6 rounded-xl mb-8 border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
          <p className="text-xs font-bold text-emerald-600 uppercase mb-2">Telah Diterima Secara Sah</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter">{formatDocumentCurrency(tx.amount)}</p>
          <p className="text-xs text-slate-500 mt-2">Tanggal: <span className="font-bold text-slate-700">{formatDate(tx.date)}</span></p>
        </div>
        <div className="space-y-3 mb-8">
          {[['Diterima Dari', client.name], ['Metode', tx.method]].map(([l, v]) => (
            <div key={l} className="flex justify-between text-sm py-2 border-b border-slate-100">
              <span className="text-slate-500">{l}</span><span className="font-bold text-slate-800">{v}</span>
            </div>
          ))}
          <div className="py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Keterangan</p>
            <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl">{tx.description}</p>
          </div>
          {proj && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
              <p className="font-bold mb-1">{proj.projectName}</p>
              <div className="flex justify-between">
                <span>Total: {formatDocumentCurrency(proj.totalCost)}</span>
                <span className="font-bold">Sisa: {formatDocumentCurrency(proj.totalCost - proj.amountPaid)}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-between items-end pt-6 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 italic">Dicetak oleh {profile.companyName}</p>
          <div className="text-center w-40">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Penerima,</p>
            <div className="h-16 flex items-center justify-center mb-1">
              {tx.vendorSignature
                ? <img src={tx.vendorSignature} alt="TTD" className="max-h-full object-contain" />
                : <div className="h-px w-24 bg-slate-200 mt-10 mx-auto" />
              }
            </div>
            <p className="text-sm font-bold text-slate-800 underline underline-offset-4 decoration-slate-300">
              ({profile.authorizedSigner || profile.companyName})
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal
        isOpen={!!viewingDocument}
        onClose={onClose}
        title={viewingDocument ? `${viewingDocument.type === 'invoice' ? 'Invoice' : 'Tanda Terima'}: ${viewingDocument.project.projectName}` : ''}
        size="4xl"
      >
        {viewingDocument && (
          <div>
            <div className="overflow-y-auto pr-1">{renderBody()}</div>
            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloadingPDF}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-sm font-bold rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all disabled:cursor-wait disabled:opacity-60"
              >
                <DownloadIcon className="w-4 h-4" /> {isDownloadingPDF ? 'Menyiapkan PDF...' : 'Unduh PDF'}
              </button>
            </div>
            {downloadError && (
              <p className="mt-2 text-right text-xs font-semibold text-red-600" role="alert">{downloadError}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Signature pad overlay */}
      <div
        style={{ display: isSigning ? 'flex' : 'none', position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        className="items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) setIsSigning(false); }}
      >
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center p-6 border-b">
            <h3 className="text-lg font-bold text-slate-800">Bubuhkan Tanda Tangan</h3>
            <button onClick={() => setIsSigning(false)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-6 flex-1 overflow-y-auto">
            <SignaturePad onSave={handleSaveSignature} onClose={() => setIsSigning(false)} />
          </div>
        </div>
      </div>
    </>
  );
};

export default ClientPortal;
