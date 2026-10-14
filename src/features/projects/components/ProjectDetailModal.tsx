import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Project, TeamMember, Client, Profile,
  Package, Transaction, TeamProjectPayment, Card, AssignedTeamMember,
  FinancialPocket,
} from '../../../types';
import {
  ClipboardListIcon, CheckCircleIcon, FileTextIcon, SendIcon,
  PencilIcon, Trash2Icon, UserIcon, PlusIcon, Share2Icon, ArrowDownIcon,
  X as XIcon, Save as SaveIcon, CalendarClock, ExternalLink, Video, Trash2,
  ChevronDown, ChevronUp, MessageCircle,
} from 'lucide-react';
import {
  listChecklistByProject, deleteChecklistItem,
  initializeDefaultChecklist, setChecklistItemCompleted, updateChecklistItemFields,
  renameChecklistCategory, deleteChecklistItemsByProjectAndCategory, upsertChecklistItems,
} from '../../../services/weddingDayChecklist';
import { updateProject as updateProjectInDb } from '../../../services/projects';
import {
  encodeProjectMeetingNotes,
  listProjectMeetings,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  ProjectMeeting,
  ProjectMeetingKind,
} from '../../../services/calendarEvents';
import supabase from '../../../lib/supabaseClient';
import { formatCurrency, getStatusClass, getProgressForStatus } from '../utils/projectHelpers';
import { EditFormData, ProjectEditSection } from '../hooks/useProjectEditMode';
import { getPackageTerms } from '../../packages/packageTerms';
import PackageTermsDisplay from '../../packages/components/PackageTermsDisplay';
import WorkflowDisplay from '../../packages/components/WorkflowDisplay';
import { getWorkflows } from '../../packages/workflows';
import { customizeUiText, useUiTextOverrides } from '../../../utils/uiTextCustomization';

export interface ProjectDetailModalProps {
  selectedProject: Project | null;
  setSelectedProject: React.Dispatch<React.SetStateAction<Project | null>>;
  teamMembers: TeamMember[];
  clients: Client[];
  profile: Profile;
  showNotification: (message: string) => void;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  onClose: () => void;
  /** @deprecated tombol edit sekarang inline — prop ini dipertahankan agar kode lain tidak error */
  /** @deprecated retained for compatibility with project page callers */
  handleOpenForm: (mode: 'edit', project: Project) => void;
  handleProjectDelete: (projectId: string) => void;
  handleOpenBriefingModal: () => void;
  packages: Package[];
  transactions: Transaction[];
  teamProjectPayments: TeamProjectPayment[];
  cards: Card[];
  onOpenSharePreview: (data: { title: string; message: string; phone?: string | null }) => void;
  onNavigateToClient?: (clientId: string) => void;
  // ── Edit mode props (injected from ProjectsPage via useProjectEditMode) ──
  isEditing: boolean;
  isSaving: boolean;
  editFormData: EditFormData | null;
  editTeamByCategory: Record<string, Record<string, TeamMember[]>>;
  onEnterEditMode: (project: Project) => void;
  onCancelEditMode: () => void;
  onEditFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onEditSubStatusToggle: (name: string, checked: boolean) => void;
  onEditTeamChange: (member: TeamMember) => void;
  onEditTeamFeeChange: (memberId: string, fee: number) => void;
  onEditTeamSubJobChange: (memberId: string, subJob: string) => void;
  onEditReplaceTeamMember: (oldMemberId: string, newMember: TeamMember) => void;
  onSaveEdit: (section?: ProjectEditSection) => void;
  sectionEditingEnabled?: boolean;
}

// ─── Reusable atoms ──────────────────────────────────────────────────────────

const InfoField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={`flex flex-col gap-1 p-2.5 sm:p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/90 ${className}`}>
    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6A85]">{label}</span>
    <span className="text-xs sm:text-sm font-bold text-[#2A3547] break-words leading-snug">{children || <span className="text-slate-400">—</span>}</span>
  </div>
);

const SectionHeading: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className="flex items-center justify-between mb-2.5 sm:mb-3.5 mt-4 sm:mt-6 first:mt-0">
    <h3 className="text-xs sm:text-sm font-extrabold text-[#2A3547] uppercase tracking-wider flex items-center gap-2">
      <span className="w-1.5 h-4 rounded-full bg-[#5D87FF] inline-block" />
      {title}
    </h3>
    {action}
  </div>
);

const SectionCard: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
    {title && <h4 className="text-xs sm:text-sm font-bold text-[#2A3547] pb-2.5 mb-3.5 border-b border-slate-200">{title}</h4>}
    {children}
  </div>
);

// Shared input / label classes for edit mode
// bg-brand-input = var(--color-input-bg) = #ffffff, konsisten dengan design system
const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-brand-border bg-brand-input text-brand-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-all';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-brand-text-secondary mb-1.5';

// ─── Main component ──────────────────────────────────────────────────────────

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  selectedProject, setSelectedProject, teamMembers, clients, profile,
  showNotification, setProjects, onClose,
  handleProjectDelete, handleOpenBriefingModal, packages, transactions,
  teamProjectPayments, cards,
  onOpenSharePreview, onNavigateToClient,
  // edit mode
  isEditing, isSaving, editFormData, editTeamByCategory,
  onEnterEditMode, onCancelEditMode,
  onEditFormChange, onEditTeamChange, onEditTeamFeeChange,
  onEditTeamSubJobChange, onEditReplaceTeamMember, onSaveEdit,
  onEditSubStatusToggle,
  sectionEditingEnabled = false,
}) => {
  const uiTextOverrides = useUiTextOverrides();
  // ── state ───────────────────────────────────────────────────────────────
  const [isEditingFinalLink, setIsEditingFinalLink] = useState(false);
  const [editingSection, setEditingSection] = useState<ProjectEditSection | null>(null);
  const [tempFinalLink, setTempFinalLink] = useState('');
  const [editingChecklistNotesId, setEditingChecklistNotesId] = useState<string | null>(null);
  const [checklistNotesDraft, setChecklistNotesDraft] = useState('');
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(null);
  const [checklistItemNameDraft, setChecklistItemNameDraft] = useState('');
  const [picDraft, setPicDraft] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [categoryNameDraft, setCategoryNameDraft] = useState('');
  const [isInitializingChecklist, setIsInitializingChecklist] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [mobileSectionTab, setMobileSectionTab] = useState<'all' | 'info' | 'meetings' | 'team' | 'checklist' | 'terms' | 'workflow' | 'files'>('all');

  const startSectionEdit = (section: ProjectEditSection) => {
    setEditingSection(section);
    onEnterEditMode(selectedProject!);
  };

  const sectionEditButton = (section: ProjectEditSection) => sectionEditingEnabled ? (
    <button
      type="button"
      onClick={() => startSectionEdit(section)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#5D6B82] transition-colors hover:border-[#5D87FF]/40 hover:text-[#315FCE]"
      aria-label={`Edit ${section === 'info' ? 'informasi utama' : section === 'status' ? 'status acara' : section === 'notes' ? 'catatan khusus' : section === 'team' ? 'tugas tim dan vendor' : 'file dan tautan'}`}
    >
      <PencilIcon className="h-3.5 w-3.5" />
      Edit
    </button>
  ) : null;
  const [projectMeetings, setProjectMeetings] = useState<ProjectMeeting[]>([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [savingMeetingKind, setSavingMeetingKind] = useState<ProjectMeetingKind | null>(null);
  const [meetingCardOpen, setMeetingCardOpen] = useState<Record<ProjectMeetingKind, boolean>>({
    regular: false,
    zoom: false,
  });
  const [meetingDrafts, setMeetingDrafts] = useState<Record<ProjectMeetingKind, { scheduledAt: string; zoomUrl: string; location: string; resultNotes: string }>>({
    regular: { scheduledAt: '', zoomUrl: '', location: '', resultNotes: '' },
    zoom: { scheduledAt: '', zoomUrl: '', location: '', resultNotes: '' },
  });

  // ── paidMemberIds — for edit form fee lock ────────────────────────────────
  const paidMemberIdsForProject = useMemo(() => {
    const projectId = selectedProject?.id;
    if (!projectId) return new Set<string>();
    return new Set(
      teamProjectPayments.filter(p => p.projectId === projectId && p.status === 'Paid').map(p => p.teamMemberId),
    );
  }, [teamProjectPayments, selectedProject?.id]);

  // ── team by category — for VIEW mode ─────────────────────────────────────
  const teamByCategory = useMemo(() => {
    if (!selectedProject?.team) return { Tim: {}, Vendor: {} };
    return selectedProject.team.reduce(
      (acc, member) => {
        const orig = teamMembers.find(m => m.id === member.memberId);
        const cat = orig?.category || 'Tim';
        if (!acc[cat]) acc[cat] = {};
        if (!acc[cat][member.role]) acc[cat][member.role] = [];
        acc[cat][member.role].push(member);
        return acc;
      },
      { Tim: {}, Vendor: {} } as Record<string, Record<string, AssignedTeamMember[]>>,
    );
  }, [selectedProject?.team, teamMembers]);

  // ── reset checklist state on project change ───────────────────────────────
  useEffect(() => {
    setEditingChecklistItemId(null);
    setChecklistItemNameDraft('');
    setPicDraft('');
    setEditingChecklistNotesId(null);
    setChecklistNotesDraft('');
    setEditingCategoryName(null);
    setCategoryNameDraft('');
    setActiveCategory(null);
  }, [selectedProject?.id]);

  useEffect(() => {
    const projectId = selectedProject?.id;
    if (!projectId) {
      setProjectMeetings([]);
      return;
    }

    let isCurrent = true;
    setIsLoadingMeetings(true);
    listProjectMeetings(projectId)
      .then(meetings => {
        if (!isCurrent) return;
        setProjectMeetings(meetings);
        setMeetingDrafts({
          regular: {
            scheduledAt: meetings.find(meeting => meeting.metadata.kind === 'regular')?.event.startAt.slice(0, 16) || '',
            zoomUrl: '',
            location: meetings.find(meeting => meeting.metadata.kind === 'regular')?.metadata.location || '',
            resultNotes: meetings.find(meeting => meeting.metadata.kind === 'regular')?.metadata.resultNotes || '',
          },
          zoom: {
            scheduledAt: meetings.find(meeting => meeting.metadata.kind === 'zoom')?.event.startAt.slice(0, 16) || '',
            zoomUrl: meetings.find(meeting => meeting.metadata.kind === 'zoom')?.metadata.zoomUrl || '',
            location: meetings.find(meeting => meeting.metadata.kind === 'zoom')?.metadata.location || '',
            resultNotes: meetings.find(meeting => meeting.metadata.kind === 'zoom')?.metadata.resultNotes || '',
          },
        });
      })
      .catch(error => {
        if (!isCurrent) return;
        console.error('[Projects][meetings.load] Failed to load project meetings:', error);
        showNotification('Gagal memuat jadwal meeting. Coba muat ulang detail acara.');
      })
      .finally(() => {
        if (isCurrent) setIsLoadingMeetings(false);
      });

    return () => { isCurrent = false; };
  }, [selectedProject?.id, showNotification]);

  // ── real-time checklist sync ──────────────────────────────────────────────
  useEffect(() => {
    const projectId = selectedProject?.id;
    if (!projectId) return;

    (async () => {
      try {
        const items = await listChecklistByProject(projectId);
        setSelectedProject(prev => {
          if (!prev || prev.id !== projectId) return prev;
          return { ...prev, weddingDayChecklist: items };
        });
        setProjects(all => all.map(p => (p.id === projectId ? { ...p, weddingDayChecklist: items } : p)));
      } catch (e) {
        console.error('Failed to load checklist:', e);
      }
    })();

    const channel = supabase
      .channel(`admin:wedding_day_checklists:project_id=eq.${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wedding_day_checklists', filter: `project_id=eq.${projectId}` },
        payload => {
          let updatedChecklist: any[] | null = null;
          setSelectedProject(prev => {
            if (!prev || prev.id !== projectId) return prev;
            const cur = prev.weddingDayChecklist || [];
            let next = [...cur];
            if (payload.eventType === 'INSERT') {
              const n = payload.new as any;
              const item = { id: n.id, projectId: n.project_id, category: n.category, itemName: n.item_name, isCompleted: n.is_completed, assignedTo: n.assigned_to, notes: n.notes, createdAt: n.created_at, updatedAt: n.updated_at };
              if (!next.some(i => i.id === item.id)) next.push(item);
            } else if (payload.eventType === 'UPDATE') {
              const n = payload.new as any;
              const item = { id: n.id, projectId: n.project_id, category: n.category, itemName: n.item_name, isCompleted: n.is_completed, assignedTo: n.assigned_to, notes: n.notes, createdAt: n.created_at, updatedAt: n.updated_at };
              next = next.map(i => (i.id === item.id ? item : i));
            } else if (payload.eventType === 'DELETE') {
              next = next.filter(i => i.id !== (payload.old as any).id);
            }
            if (JSON.stringify(next) === JSON.stringify(cur)) return prev;
            updatedChecklist = next;
            return { ...prev, weddingDayChecklist: next };
          });
          if (updatedChecklist) {
            setProjects(all => all.map(p => (p.id === projectId ? { ...p, weddingDayChecklist: updatedChecklist! } : p)));
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedProject?.id, setProjects]);

  // ── handlers (view mode) ─────────────────────────────────────────────────

  const formatDateFull = (d: string) =>
    d ? new Date(d).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

  const handleSaveMeeting = async (kind: ProjectMeetingKind) => {
    if (!selectedProject) return;
    const draft = meetingDrafts[kind];
    if (!draft.scheduledAt) {
      showNotification('Pilih tanggal dan waktu meeting terlebih dahulu.');
      return;
    }
    if (kind === 'zoom' && draft.zoomUrl && !/^https?:\/\//i.test(draft.zoomUrl.trim())) {
      showNotification('Link Zoom harus menggunakan alamat yang diawali https:// atau http://.');
      return;
    }

    const startDate = new Date(draft.scheduledAt);
    if (Number.isNaN(startDate.getTime())) {
      showNotification('Tanggal dan waktu meeting tidak valid.');
      return;
    }
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
    const toLocalDateTime = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
    const existing = projectMeetings.find(meeting => meeting.metadata.kind === kind);
    const titlePrefix = kind === 'zoom' ? 'Zoom Meeting' : 'Meeting Pengantin';
    const payload = {
      title: `${titlePrefix} — ${selectedProject.clientName}`,
      eventType: selectedProject.projectType,
      date: draft.scheduledAt.slice(0, 10),
      startAt: `${draft.scheduledAt}:00`,
      endAt: toLocalDateTime(endDate),
      allDay: false,
      location: draft.location.trim() || undefined,
      notes: encodeProjectMeetingNotes({
        projectId: selectedProject.id,
        kind,
        zoomUrl: kind === 'zoom' ? draft.zoomUrl.trim() : '',
        location: draft.location.trim(),
        resultNotes: draft.resultNotes.trim(),
      }),
    };

    setSavingMeetingKind(kind);
    try {
      if (existing) {
        await updateCalendarEvent(existing.event.id, payload);
      } else {
        await createCalendarEvent(payload);
      }
      const meetings = await listProjectMeetings(selectedProject.id);
      setProjectMeetings(meetings);
      showNotification(`${titlePrefix} berhasil disimpan dan ditambahkan ke kalender.`);
    } catch (error) {
      console.error('[Projects][meetings.save] Failed to save project meeting:', error);
      showNotification(`Gagal menyimpan ${titlePrefix.toLowerCase()}. Coba lagi.`);
    } finally {
      setSavingMeetingKind(null);
    }
  };

  const handleDeleteMeeting = async (kind: ProjectMeetingKind) => {
    const meeting = projectMeetings.find(item => item.metadata.kind === kind);
    if (!meeting) return;
    try {
      await deleteCalendarEvent(meeting.event.id);
      setProjectMeetings(items => items.filter(item => item.event.id !== meeting.event.id));
      setMeetingDrafts(drafts => ({
        ...drafts,
        [kind]: { scheduledAt: '', zoomUrl: '', location: '', resultNotes: '' },
      }));
      showNotification('Jadwal meeting berhasil dihapus dari kalender.');
    } catch (error) {
      console.error('[Projects][meetings.delete] Failed to delete project meeting:', error);
      showNotification('Gagal menghapus jadwal meeting. Coba lagi.');
    }
  };

  const handleShareMeeting = (kind: ProjectMeetingKind) => {
    if (!selectedProject) return;
    const client = clients.find(item => item.id === selectedProject.clientId);
    const phone = client?.whatsapp || client?.phone;
    if (!phone) {
      showNotification('Nomor WhatsApp pengantin tidak ditemukan.');
      return;
    }

    const draft = meetingDrafts[kind];
    if (!draft.scheduledAt) {
      showNotification('Simpan tanggal dan waktu meeting sebelum membagikannya.');
      return;
    }

    const date = new Date(draft.scheduledAt);
    const meetingDate = Number.isNaN(date.getTime())
      ? draft.scheduledAt
      : date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const meetingTime = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const meetingType = kind === 'zoom' ? 'Zoom Meeting' : 'Meeting Pengantin';
    const template = profile.chatTemplates?.find(item =>
      kind === 'zoom'
        ? /zoom|meeting|jadwal/i.test(item.title)
        : /meeting|jadwal/i.test(item.title),
    )?.template;
    const details = [
      `Jadwal: ${meetingDate}${meetingTime ? ` pukul ${meetingTime}` : ''}`,
      draft.location.trim() ? `Lokasi: ${draft.location.trim()}` : '',
      kind === 'zoom' && draft.zoomUrl.trim() ? `Link meeting: ${draft.zoomUrl.trim()}` : '',
    ].filter(Boolean).join('\n');
    const defaultMessage = [
      `Halo Kak ${selectedProject.clientName},`,
      '',
      `Kami ingin menginformasikan jadwal ${meetingType} untuk acara ${selectedProject.projectName}:`,
      details,
      '',
      'Mohon konfirmasi apakah jadwal tersebut sesuai. Terima kasih.',
    ].join('\n');
    const values: Record<string, string> = {
      clientName: selectedProject.clientName,
      projectName: selectedProject.projectName,
      meetingType,
      meetingDate,
      meetingTime,
      meetingLocation: draft.location.trim(),
      location: draft.location.trim() || selectedProject.location || '',
      zoomLink: draft.zoomUrl.trim(),
      meetingNotes: draft.resultNotes.trim(),
    };
    let message = (template || defaultMessage).replace(/\{([^}]+)\}/g, (placeholder, key: string) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : placeholder,
    );
    if (!message.includes(meetingDate) && !message.includes(draft.scheduledAt)) {
      message = `${message.trim()}\n\n${details}`;
    } else if (kind === 'zoom' && draft.zoomUrl.trim() && !message.includes(draft.zoomUrl.trim())) {
      message = `${message.trim()}\nLink meeting: ${draft.zoomUrl.trim()}`;
    }

    onOpenSharePreview({ title: `Bagikan ${meetingType} — ${selectedProject.projectName}`, message, phone });
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedProject) return;
    const nextProgress = getProgressForStatus(newStatus, profile.projectStatusConfig);
    const statusConfig = profile.projectStatusConfig.find(s => s.name === newStatus);
    try {
      const updated = {
        ...selectedProject,
        status: newStatus,
        progress: nextProgress,
        activeSubStatuses: [],
        customSubStatuses: statusConfig?.subStatuses || []
      } as Project;
      await updateProjectInDb(selectedProject.id, {
        status: newStatus as any,
        progress: nextProgress as any,
        activeSubStatuses: [] as any,
        customSubStatuses: (statusConfig?.subStatuses || []) as any
      } as any);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
      setSelectedProject(updated);
      showNotification(`Status diubah ke "${newStatus}"`);
    } catch {
      showNotification('Gagal memperbarui status. Coba lagi.');
    }
  };

  const handleSubStatusToggle = async (subName: string, checked: boolean) => {
    if (!selectedProject) return;
    const nextActive = checked
      ? [...(selectedProject.activeSubStatuses || []), subName]
      : (selectedProject.activeSubStatuses || []).filter(s => s !== subName);
    try {
      const updated = { ...selectedProject, activeSubStatuses: nextActive };
      await updateProjectInDb(selectedProject.id, { activeSubStatuses: nextActive as any } as any);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
      setSelectedProject(updated);
    } catch {
      showNotification('Gagal memperbarui tahapan.');
    }
  };

  const handleSaveFinalLink = async () => {
    if (!selectedProject) return;
    try {
      const updated = { ...selectedProject, finalDriveLink: tempFinalLink };
      await updateProjectInDb(selectedProject.id, { finalDriveLink: tempFinalLink } as any);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
      setSelectedProject(updated);
      setIsEditingFinalLink(false);
      showNotification('Link File Jadi berhasil diperbarui.');
    } catch {
      showNotification('Gagal memperbarui link.');
    }
  };

  const handleSendFinalLink = () => {
    if (!selectedProject?.finalDriveLink) { showNotification('Link File Jadi belum tersedia.'); return; }
    const client = clients.find(c => c.id === selectedProject.clientId);
    const phone = client?.whatsapp || client?.phone;
    if (!phone) { showNotification('Nomor WhatsApp pengantin tidak ditemukan.'); return; }
    const template =
      profile.chatTemplates?.find(t => t.title.toLowerCase().includes('link'))?.template ||
      `Halo Kak {clientName},\n\nTerima kasih telah mempercayakan acara {projectName} kepada kami.\nBerikut link file hasil dokumentasi:\n{finalDriveLink}\n\nSemoga suka!`;
    const message = template
      .replace(/{clientName}/g, selectedProject.clientName)
      .replace(/{projectName}/g, selectedProject.projectName)
      .replace(/{finalDriveLink}/g, selectedProject.finalDriveLink);
    onOpenSharePreview({ title: `Bagikan Link File Jadi — ${selectedProject.projectName}`, message, phone });
  };

  const handleToggleChecklistItem = async (itemId: string, current: boolean) => {
    if (!selectedProject) return;
    try {
      const row = await setChecklistItemCompleted(itemId, !current);
      const items = selectedProject.weddingDayChecklist?.map(i => (i.id === itemId ? { ...i, isCompleted: row.isCompleted, updatedAt: row.updatedAt } : i)) || [];
      const updated = { ...selectedProject, weddingDayChecklist: items };
      setSelectedProject(updated);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
    } catch {
      showNotification('Gagal memperbarui checklist.');
    }
  };

  const handleSaveChecklistNotes = async () => {
    if (!selectedProject || !editingChecklistNotesId) return;
    try {
      const row = await updateChecklistItemFields(editingChecklistNotesId, { notes: checklistNotesDraft });
      const items = selectedProject.weddingDayChecklist?.map(i => (i.id === editingChecklistNotesId ? { ...i, notes: row.notes, updatedAt: row.updatedAt } : i)) || [];
      const updated = { ...selectedProject, weddingDayChecklist: items };
      setSelectedProject(updated);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
      setEditingChecklistNotesId(null);
      setChecklistNotesDraft('');
    } catch {
      showNotification('Gagal menyimpan catatan.');
    }
  };

  const handleSaveItemEdits = async () => {
    if (!selectedProject || !editingChecklistItemId) return;
    try {
      const row = await updateChecklistItemFields(editingChecklistItemId, { itemName: checklistItemNameDraft, assignedTo: picDraft });
      const items = selectedProject.weddingDayChecklist?.map(i => (i.id === editingChecklistItemId ? { ...i, itemName: row.itemName, assignedTo: row.assignedTo, updatedAt: row.updatedAt } : i)) || [];
      const updated = { ...selectedProject, weddingDayChecklist: items };
      setSelectedProject(updated);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
      setEditingChecklistItemId(null);
      setChecklistItemNameDraft('');
      setPicDraft('');
    } catch {
      showNotification('Gagal menyimpan item.');
    }
  };

  const handleAddChecklistItem = async (category: string, itemName: string) => {
    if (!selectedProject) return;
    try {
      const [row] = await upsertChecklistItems([{ projectId: selectedProject.id, category, itemName, isCompleted: false }]);
      const items = [...(selectedProject.weddingDayChecklist || []), row];
      const updated = { ...selectedProject, weddingDayChecklist: items };
      setSelectedProject(updated);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
    } catch {
      showNotification('Gagal menambah item.');
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    if (!selectedProject) return;
    try {
      await deleteChecklistItem(itemId);
      const items = selectedProject.weddingDayChecklist?.filter(i => i.id !== itemId) || [];
      const updated = { ...selectedProject, weddingDayChecklist: items };
      setSelectedProject(updated);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
    } catch {
      showNotification('Gagal menghapus item.');
    }
  };

  const handleSaveCategoryName = async () => {
    if (!selectedProject || !editingCategoryName) return;
    const newName = categoryNameDraft.trim();
    if (!newName) { showNotification('Nama kategori tidak boleh kosong.'); return; }
    if (newName === editingCategoryName) { setEditingCategoryName(null); setCategoryNameDraft(''); return; }
    try {
      await renameChecklistCategory(selectedProject.id, editingCategoryName, newName);
      const refreshed = await listChecklistByProject(selectedProject.id);
      const updated = { ...selectedProject, weddingDayChecklist: refreshed };
      setSelectedProject(updated);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
      setEditingCategoryName(null);
      setCategoryNameDraft('');
      showNotification('Kategori berhasil diubah.');
    } catch {
      showNotification('Gagal mengubah nama kategori.');
    }
  };

  const handleDeleteCategory = async (category: string) => {
    if (!selectedProject) return;
    const catItems = selectedProject.weddingDayChecklist?.filter(i => i.category === category) || [];
    if (!catItems.length) return;
    if (!window.confirm(`Hapus kategori "${category}" beserta ${catItems.length} item di dalamnya?`)) return;
    try {
      await deleteChecklistItemsByProjectAndCategory(selectedProject.id, category);
      const refreshed = await listChecklistByProject(selectedProject.id);
      const updated = { ...selectedProject, weddingDayChecklist: refreshed };
      setSelectedProject(updated);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
      showNotification('Kategori berhasil dihapus.');
    } catch {
      showNotification('Gagal menghapus kategori.');
    }
  };

  const handleInitializeChecklist = async () => {
    if (!selectedProject || isInitializingChecklist) return;
    setIsInitializingChecklist(true);
    try {
      const custom = profile.checklistTemplates?.length ? profile.checklistTemplates : undefined;
      const result = await initializeDefaultChecklist(selectedProject.id, custom);
      const updated = { ...selectedProject, weddingDayChecklist: result };
      setSelectedProject(updated);
      setProjects(prev => prev.map(p => (p.id === selectedProject.id ? updated : p)));
      showNotification('Checklist Hari H berhasil dibuat.');
    } catch {
      showNotification('Gagal membuat checklist default.');
    } finally {
      setIsInitializingChecklist(false);
    }
  };

  const handleShareChecklist = () => {
    if (!selectedProject) return;
    const byCat = (selectedProject.weddingDayChecklist || []).reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, any[]>);
    let message = `*REKAP CHECKLIST HARI H — ${selectedProject.projectName}*\n\n`;
    Object.entries(byCat).forEach(([cat, items]) => {
      message += `*${cat}:*\n`;
      items.forEach(i => { message += `${i.isCompleted ? '✅' : '⬜'} ${i.itemName}\n`; });
      message += '\n';
    });
    onOpenSharePreview({ title: `Bagikan Rekap Checklist — ${selectedProject.projectName}`, message, phone: null });
  };

  const handleShareChecklistPortal = () => {
    if (!selectedProject) return;
    const link = `${window.location.origin}/#/checklist-portal/${selectedProject.id}`;
    onOpenSharePreview({ title: `Portal Checklist — ${selectedProject.projectName}`, message: `Portal Checklist Hari H — ${selectedProject.projectName}\n\n${link}`, phone: null });
  };

  // ── guard ─────────────────────────────────────────────────────────────────
  if (!selectedProject) return null;

  // ── derived data ──────────────────────────────────────────────────────────
  const allSubStatuses =
    selectedProject.customSubStatuses ||
    profile.projectStatusConfig.find(s => s.name === selectedProject.status)?.subStatuses ||
    [];

  const pkg = packages.find(p => p.id === selectedProject.packageId) ?? null;
  const packageTerms = getPackageTerms(profile.publicPageConfig?.packageTerms);
  const workflows = getWorkflows(profile.publicPageConfig);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full -mt-1">

      {/* ══════════════════════════════════════════════════════════════════
          HERO HEADER
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="relative mb-3 sm:mb-4 overflow-hidden rounded-xl border border-slate-200/40 bg-cover bg-center shadow-md sm:rounded-2xl"
        style={{ backgroundImage: `url(${profile.publicPageConfig?.backgroundImages?.eventDetail || '/assets/images/backgrounds/detail-acara-pernikahan.jpg'})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/75 via-slate-900/65 to-slate-900/85" />
        <div className="relative p-3.5 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-base font-black leading-snug text-white sm:text-2xl">
              {selectedProject.projectName}
            </h2>
            {selectedProject.clientName && !selectedProject.projectName.toLocaleLowerCase().startsWith(selectedProject.clientName.toLocaleLowerCase()) && (
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-200 sm:text-sm">
                Pengantin: {selectedProject.clientName}
              </p>
            )}
          </div>

          {!isEditing ? (
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
                      <button
                onClick={() => { setEditingSection(null); onEnterEditMode(selectedProject); }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#ECF2FF] px-2.5 py-1.5 text-[11px] font-bold text-[#2A3547] transition-all hover:bg-[#dbe6ff] active:scale-95 sm:px-3 sm:py-2 sm:text-xs"
                title="Edit Acara"
              >
                <PencilIcon className="h-3.5 w-3.5 flex-shrink-0 text-[#5D87FF]" />
                <span>Edit</span>
              </button>
              <button
                onClick={handleOpenBriefingModal}
                className="inline-flex flex-shrink-0 items-center gap-1 rounded-xl border border-emerald-700 bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition-all active:scale-95 sm:py-2 sm:text-xs"
                title="Briefing Tim"
              >
                <Share2Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">Briefing</span>
              </button>
            </div>
          ) : (
            <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 sm:text-xs">
              <PencilIcon className="h-3.5 w-3.5 flex-shrink-0" />
              Mode Edit
            </span>
          )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          EDIT MODE
      ══════════════════════════════════════════════════════════════════ */}
      {isEditing && editFormData && (
        <EditModeContent
          editFormData={editFormData}
          section={editingSection}
          profile={profile}
          teamMembers={teamMembers}
          teamByCategory={editTeamByCategory}
          paidMemberIds={paidMemberIdsForProject}
          isSaving={isSaving}
          onFormChange={onEditFormChange}
          onSubStatusToggle={onEditSubStatusToggle}
          onTeamChange={onEditTeamChange}
          onTeamFeeChange={onEditTeamFeeChange}
          onTeamSubJobChange={onEditTeamSubJobChange}
          onReplaceTeamMember={onEditReplaceTeamMember}
          onSave={() => onSaveEdit(editingSection || undefined)}
          onCancel={onCancelEditMode}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          VIEW MODE (UNIFIED SECTIONS WITH MOBILE TAB FILTER)
      ══════════════════════════════════════════════════════════════════ */}
      {!isEditing && (
        <div className="space-y-4 sm:space-y-6 pb-6 animate-fade-in">
          {/* Quick Section Navigation Bar */}
          <div className="sticky top-0 z-20 -mx-1 px-1 py-1.5 bg-white/95 backdrop-blur-md border-b border-slate-200">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {([
                { id: 'all', label: customizeUiText('project.detail.tab.all', 'Semua', uiTextOverrides) },
                { id: 'info', label: customizeUiText('project.detail.tab.info', 'Info & Status', uiTextOverrides) },
                { id: 'meetings', label: customizeUiText('project.detail.tab.meetings', 'Meeting', uiTextOverrides) },
                { id: 'team', label: `${customizeUiText('project.detail.tab.team', 'Tim & Paket', uiTextOverrides)} (${selectedProject.team?.length || 0})` },
                { id: 'terms', label: customizeUiText('project.detail.tab.terms', 'Syarat & Ketentuan', uiTextOverrides) },
                { id: 'workflow', label: customizeUiText('project.detail.tab.workflow', 'Workflow', uiTextOverrides) },
                { id: 'files', label: customizeUiText('project.detail.tab.files', 'File & Link', uiTextOverrides) },
              ] as const).map(tab => {
                const active = mobileSectionTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMobileSectionTab(tab.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-all whitespace-nowrap ${
                      active
                        ? 'bg-[#5D87FF] text-white border-[#5D87FF] shadow-xs'
                        : 'bg-[#F8FAFC] text-[#5A6A85] border-slate-200 hover:text-[#2A3547] hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ──────────── SEKSI 1: INFORMASI & STATUS ACARA ──────────── */}
          {(mobileSectionTab === 'all' || mobileSectionTab === 'info' || mobileSectionTab === 'meetings') && (
            <>
              {(mobileSectionTab === 'all' || mobileSectionTab === 'info') && (
                <>
              <section>
                <SectionHeading title={customizeUiText('project.detail.section.main', 'Informasi Utama', uiTextOverrides)} action={sectionEditButton('info')} />
                <SectionCard>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
                    <InfoField label={customizeUiText('project.detail.field.client', 'Pengantin', uiTextOverrides)}>{selectedProject.clientName}</InfoField>
                    <InfoField label={customizeUiText('project.detail.field.location', 'Lokasi / Kota', uiTextOverrides)}>{selectedProject.location || '—'}</InfoField>
                    <InfoField label={customizeUiText('project.detail.field.date', 'Tanggal Acara', uiTextOverrides)} className="col-span-2 sm:col-span-1">
                      {formatDateFull(selectedProject.date)}
                    </InfoField>
                    <InfoField label="Alamat Lengkap / Gedung" className="col-span-2 sm:col-span-1">
                      {selectedProject.address || '—'}
                    </InfoField>
                    <InfoField label="Google Maps" className="col-span-2">
                      {selectedProject.googleMapsLink ? (
                        <a href={selectedProject.googleMapsLink} target="_blank" rel="noopener noreferrer" className="text-[#5D87FF] hover:underline break-all">
                          Buka lokasi di Google Maps
                        </a>
                      ) : '—'}
                    </InfoField>
                    {selectedProject.startTime && <InfoField label="Jam Mulai">{selectedProject.startTime}</InfoField>}
                    {selectedProject.endTime && <InfoField label="Jam Selesai">{selectedProject.endTime}</InfoField>}
                  </div>

                </SectionCard>
              </section>

              <section>
                <SectionHeading title={customizeUiText('project.detail.section.status', 'Status & Progres Pengerjaan', uiTextOverrides)} action={sectionEditButton('status')} />
                <SectionCard>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
                    <p className="text-[11px] sm:text-xs font-bold text-[#5A6A85] uppercase tracking-wider shrink-0">
                      Status Acara:
                    </p>
                    <div className="relative flex-grow">
                      <select
                        value={selectedProject.status}
                        onChange={e => handleStatusUpdate(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[#2A3547] rounded-xl border border-slate-200 bg-[#F8FAFC] cursor-pointer focus:outline-none focus:bg-white focus:border-[#5D87FF] focus:ring-2 focus:ring-[#5D87FF]/20 transition-all"
                      >
                        {profile.projectStatusConfig.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200">
                    <div className="flex justify-between text-xs font-bold text-[#2A3547] mb-1.5">
                      <span>Progres Pengerjaan</span>
                      <span className="text-[#5D87FF]">{selectedProject.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#5D87FF] transition-all duration-700 rounded-full"
                        style={{ width: `${selectedProject.progress}%` }}
                      />
                    </div>
                  </div>

                  {allSubStatuses.length > 0 && (
                    <div className="mt-4 pt-3.5 border-t border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A6A85] mb-2.5">
                        Tahapan Detail ({selectedProject.activeSubStatuses?.length || 0}/{allSubStatuses.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {allSubStatuses.map(sub => {
                          const isActive = selectedProject.activeSubStatuses?.includes(sub.name);
                          return (
                            <label
                              key={sub.name}
                              className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all ${
                                isActive
                                  ? 'bg-[#ECF2FF] border-[#5D87FF]/40 text-[#2A3547]'
                                  : 'bg-[#F8FAFC] border-slate-200 text-[#5A6A85] hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-[#5D87FF] border-slate-300 focus:ring-[#5D87FF]/30 flex-shrink-0"
                                checked={!!isActive}
                                onChange={e => handleSubStatusToggle(sub.name, e.target.checked)}
                              />
                              <div className="min-w-0 flex-1">
                                <span className={`text-xs sm:text-sm font-bold block leading-snug ${isActive ? 'text-[#2A3547]' : 'text-[#5A6A85]'}`}>
                                  {sub.name}
                                </span>
                                {sub.note && (
                                  <span className="text-[10px] text-[#5A6A85] block mt-0.5">{sub.note}</span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </SectionCard>
              </section>

              <section>
                  <SectionHeading title={customizeUiText('project.detail.section.notes', 'Catatan Khusus', uiTextOverrides)} action={sectionEditButton('notes')} />
                  <SectionCard>
                    <p className="text-xs sm:text-sm text-[#2A3547] leading-relaxed whitespace-pre-line">
                      {selectedProject.notes || <span className="italic text-[#5A6A85]">Belum ada catatan.</span>}
                    </p>
                  </SectionCard>
              </section>
                </>
              )}

              {(mobileSectionTab === 'all' || mobileSectionTab === 'meetings') && (
              <section>
                <SectionHeading title={customizeUiText('project.detail.section.meetings', 'Jadwal Meeting & Hasil', uiTextOverrides)} />
                <div className="grid grid-cols-1 gap-3">
                  {([
                    { kind: 'regular', title: customizeUiText('project.detail.meeting.offline', 'Meeting Offline', uiTextOverrides), description: 'Atur pertemuan langsung dengan pengantin.', icon: CalendarClock },
                    { kind: 'zoom', title: customizeUiText('project.detail.meeting.online', 'Meeting Online', uiTextOverrides), description: 'Atur meeting online dan simpan tautan Zoom.', icon: Video },
                  ] as const).map(({ kind, title, description, icon: MeetingIcon }) => {
                    const draft = meetingDrafts[kind];
                    const meeting = projectMeetings.find(item => item.metadata.kind === kind);
                    const validZoomUrl = /^https?:\/\//i.test(draft.zoomUrl.trim());
                    const isOpen = meetingCardOpen[kind];
                    return (
                      <div key={kind} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
                        <div className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMeetingCardOpen(current => ({ ...current, [kind]: !current[kind] }))}
                            aria-expanded={isOpen}
                            className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-[#5D87FF]/30 sm:gap-3"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECF2FF] text-[#5D87FF] sm:h-10 sm:w-10">
                              <MeetingIcon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-extrabold text-[#2A3547]">{title}</span>
                              <span className="mt-0.5 block truncate text-[11px] text-[#5A6A85] sm:text-xs">
                                {draft.scheduledAt
                                  ? new Date(draft.scheduledAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                                  : description}
                              </span>
                              {meeting && <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">Terjadwal</span>}
                            </span>
                            {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-[#73839B]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[#73839B]" />}
                          </button>
                          {draft.scheduledAt && (
                            <button
                              type="button"
                              onClick={() => handleShareMeeting(kind)}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#1EBA59] focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 sm:w-auto sm:px-3"
                              title="Bagikan jadwal melalui WhatsApp"
                              aria-label={`Bagikan jadwal ${title} melalui WhatsApp`}
                            >
                              <MessageCircle className="h-4 w-4" />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </button>
                          )}
                        </div>

                        {isOpen && (isLoadingMeetings ? (
                          <p className="rounded-xl bg-[#F8FAFC] px-3 py-4 text-center text-xs text-[#5A6A85]">Memuat jadwal...</p>
                        ) : (
                          <form
                            onSubmit={e => {
                              e.preventDefault();
                              void handleSaveMeeting(kind);
                            }}
                            className="mt-4 space-y-4"
                          >
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <label htmlFor={`meeting-date-${kind}`} className={labelCls}>Tanggal & Waktu</label>
                                <input
                                  id={`meeting-date-${kind}`}
                                  type="datetime-local"
                                  required
                                  value={draft.scheduledAt}
                                  onChange={e => setMeetingDrafts(current => ({
                                    ...current,
                                    [kind]: { ...current[kind], scheduledAt: e.target.value },
                                  }))}
                                  className={inputCls}
                                />
                              </div>

                              {kind === 'regular' && (
                                <div>
                                  <label htmlFor={`meeting-location-${kind}`} className={labelCls}>Lokasi Meeting</label>
                                  <input
                                    id={`meeting-location-${kind}`}
                                    type="text"
                                    value={draft.location}
                                    onChange={e => setMeetingDrafts(current => ({
                                      ...current,
                                      regular: { ...current.regular, location: e.target.value },
                                    }))}
                                    placeholder="Contoh: kantor, kafe, atau alamat"
                                    className={inputCls}
                                  />
                                </div>
                              )}

                              {kind === 'zoom' && (
                                <div>
                                  <label htmlFor={`meeting-zoom-url-${kind}`} className={labelCls}>Link Zoom</label>
                                  <input
                                    id={`meeting-zoom-url-${kind}`}
                                    type="url"
                                    value={draft.zoomUrl}
                                    onChange={e => setMeetingDrafts(current => ({
                                      ...current,
                                      zoom: { ...current.zoom, zoomUrl: e.target.value },
                                    }))}
                                    placeholder="https://zoom.us/j/..."
                                    className={inputCls}
                                  />
                                  {validZoomUrl && (
                                    <a href={draft.zoomUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#4267C8] hover:underline">
                                      <ExternalLink className="h-3.5 w-3.5" /> Buka link Zoom
                                    </a>
                                  )}
                                </div>
                              )}

                              <div>
                                <label htmlFor={`meeting-notes-${kind}`} className={labelCls}>Catatan / Hasil Meeting</label>
                                <textarea
                                  id={`meeting-notes-${kind}`}
                                  value={draft.resultNotes}
                                  onChange={e => setMeetingDrafts(current => ({
                                    ...current,
                                    [kind]: { ...current[kind], resultNotes: e.target.value },
                                  }))}
                                  rows={3}
                                  placeholder="Tuliskan hasil pembahasan, keputusan, dan tindak lanjut..."
                                  className={`${inputCls} resize-y`}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                              {meeting && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteMeeting(kind)}
                                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" /> Hapus
                                </button>
                              )}
                              {draft.scheduledAt && (
                                <button
                                  type="button"
                                  onClick={() => handleShareMeeting(kind)}
                                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#1EBA59]"
                                >
                                  <MessageCircle className="h-4 w-4" /> Bagikan WhatsApp
                                </button>
                              )}
                              <button
                                type="submit"
                                disabled={savingMeetingKind !== null}
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#5D87FF] px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#4570EA] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <SaveIcon className="h-4 w-4" />
                                {savingMeetingKind === kind ? 'Menyimpan...' : meeting ? 'Perbarui & Sinkronkan Kalender' : 'Simpan & Tambahkan ke Kalender'}
                              </button>
                            </div>
                          </form>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </section>
              )}
            </>
          )}

          {/* ──────────── SEKSI TIM & BIAYA PAKET ──────────── */}
          {(mobileSectionTab === 'all' || mobileSectionTab === 'team') && (
            <>
              <section>
                <SectionHeading title="Tugas Tim dan Vendor" action={sectionEditButton('team')} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                  {(['Tim', 'Vendor'] as const).map(category => {
                    const roleGroups = Object.entries(teamByCategory[category] || {});
                    const assignmentCount = roleGroups.reduce((count, [, members]) => count + members.length, 0);

                    return (
                      <div key={category} className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
                        <div className="flex items-center justify-between gap-3 pb-2.5 mb-3 border-b border-slate-200">
                          <h4 className="text-xs sm:text-sm font-bold text-[#2A3547]">
                            {category === 'Tim' ? 'Tim Internal' : 'Vendor / Mitra'}
                          </h4>
                          <span className="text-[10px] font-bold text-[#5D87FF] bg-[#ECF2FF] border border-[#5D87FF]/20 px-2.5 py-0.5 rounded-full">
                            {assignmentCount} orang
                          </span>
                        </div>
                        {assignmentCount === 0 ? (
                          <p className="text-xs text-[#5A6A85] italic py-3 text-center bg-[#F8FAFC] rounded-xl border border-dashed border-slate-200">
                            Belum ada penugasan {category === 'Tim' ? 'tim' : 'vendor'}.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {roleGroups.map(([role, members]) => (
                              <div key={role}>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A6A85] mb-1.5">{role}</p>
                                <div className="space-y-2">
                                  {members.map(assignment => {
                                    const teamMember = teamMembers.find(member => member.id === assignment.memberId);
                                    const matchingPayments = teamProjectPayments.filter(item =>
                                      item.projectId === selectedProject.id && item.teamMemberId === assignment.memberId,
                                    );
                                    const payment = matchingPayments.find(item => item.status === 'Unpaid') ?? matchingPayments[0];
                                    const isPaid = payment?.status === 'Paid';
                                    return (
                                      <div
                                        key={assignment.id || assignment.memberId}
                                        className="flex items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl bg-[#F8FAFC] border border-slate-200"
                                      >
                                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden shrink-0 bg-[#ECF2FF] border border-[#5D87FF]/20 flex items-center justify-center text-sm font-bold text-[#5D87FF]">
                                            {teamMember?.avatarUrl ? (
                                              <img src={teamMember.avatarUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                              assignment.name?.charAt(0).toUpperCase() || '?'
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="team-assignment-name truncate text-[13px] font-bold text-[#2A3547] sm:text-[15px]">{assignment.name}</p>
                                            {assignment.subJob && (
                                              <p className="text-[11px] text-[#5A6A85] truncate">{assignment.subJob}</p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <p className="text-xs font-extrabold text-[#2A3547] tabular-nums">
                                            {formatCurrency(assignment.fee)}
                                          </p>
                                          <span
                                            className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 border ${
                                              isPaid
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                            }`}
                                          >
                                            {isPaid ? 'Lunas' : 'Belum dibayar'}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {(mobileSectionTab === 'all' || mobileSectionTab === 'terms') && (
            <section className="pt-3 border-t border-slate-200">
              <PackageTermsDisplay terms={packageTerms} packageName={pkg?.name || selectedProject.packageName} showHeader={false} />
            </section>
          )}

          {(mobileSectionTab === 'all' || mobileSectionTab === 'workflow') && (
            <section className="pt-3 border-t border-slate-200">
              <WorkflowDisplay workflows={workflows} projectName={selectedProject.projectName} showHeader={false} />
            </section>
          )}

          {/* ──────────── SEKSI 2: CHECKLIST HARI H ────────────────── */}
          {mobileSectionTab === 'checklist' && (
            <div className="space-y-3.5 pt-3 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#2A3547]">Checklist Hari H</h3>
                  <p className="text-[11px] text-[#5A6A85]">Kelola persiapan lapangan secara real-time</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={handleShareChecklistPortal}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[11px] sm:text-xs font-bold text-[#2A3547] hover:border-[#5D87FF] transition-all active:scale-95"
                  >
                    <SendIcon className="w-3.5 h-3.5 text-[#5D87FF]" /> Portal
                  </button>
                  <button
                    onClick={handleShareChecklist}
                    className="flex-1 sm:flex-none btn-box-wa justify-center px-3 py-1.5 text-[11px] sm:text-xs"
                  >
                    <SendIcon className="w-3.5 h-3.5 text-white" /> <span>WhatsApp</span>
                  </button>
                  {!selectedProject.weddingDayChecklist?.length && (
                    <button
                      onClick={handleInitializeChecklist}
                      disabled={isInitializingChecklist}
                      className="w-full sm:w-auto button-primary !py-1.5 !px-3 text-[11px] sm:text-xs disabled:opacity-50"
                    >
                      {isInitializingChecklist ? 'Membuat…' : 'Buat Checklist'}
                    </button>
                  )}
                </div>
              </div>

              {selectedProject.weddingDayChecklist?.length ? (() => {
                const total = selectedProject.weddingDayChecklist.length;
                const done  = selectedProject.weddingDayChecklist.filter(i => i.isCompleted).length;
                const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { label: 'Total',   val: total,        color: 'text-[#2A3547]',  bg: 'bg-white border-slate-200' },
                      { label: 'Selesai', val: done,         color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Sisa',    val: total - done, color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Progres', val: `${pct}%`,    color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200' },
                    ] as const).map(s => (
                      <div key={s.label} className={`${s.bg} border rounded-xl p-2 sm:p-3 flex flex-col items-center shadow-2xs`}>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[#5A6A85]">{s.label}</p>
                        <p className={`text-base sm:text-xl font-black ${s.color} mt-0.5 tabular-nums`}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                );
              })() : null}

              {(() => {
                const existingCategories = Array.from(new Set(
                  (selectedProject.weddingDayChecklist || []).slice().sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()).map(i => i.category),
                ));
                if (!existingCategories.length) {
                  return (
                    <div className="flex flex-col items-center justify-center py-8 px-4 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center">
                      <h4 className="text-sm font-bold text-[#2A3547]">Belum Ada Checklist</h4>
                      <p className="text-xs text-[#5A6A85] mt-1 mb-4">Inisialisasi checklist default untuk membantu persiapan lapangan.</p>
                      <button onClick={handleInitializeChecklist} className="button-primary !py-2 !px-5 text-xs">Inisialisasi Sekarang</button>
                    </div>
                  );
                }
                const currentCat = activeCategory || existingCategories[0];
                return (
                  <>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                      {existingCategories.map(cat => {
                        const catItems = (selectedProject.weddingDayChecklist || []).filter(i => i.category === cat);
                        const catDone  = catItems.filter(i => i.isCompleted).length;
                        const isAct    = cat === currentCat;
                        return (
                          <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all ${
                              isAct
                                ? 'bg-[#5D87FF] border-[#5D87FF] text-white shadow-xs'
                                : 'bg-white border-slate-200 text-[#2A3547] hover:bg-slate-50'
                            }`}
                          >
                            {cat}
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                isAct
                                  ? 'bg-white/25 text-white'
                                  : catDone === catItems.length && catItems.length > 0
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {catDone}/{catItems.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const catItems = (selectedProject.weddingDayChecklist || []).filter(i => i.category === currentCat);
                      const catDone  = catItems.filter(i => i.isCompleted).length;
                      return (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                          <div className="px-3.5 py-2.5 bg-[#F8FAFC] border-b border-slate-200 flex items-center justify-between gap-2 group">
                            {editingCategoryName === currentCat ? (
                              <div className="flex items-center gap-2 flex-grow">
                                <input
                                  value={categoryNameDraft}
                                  onChange={e => setCategoryNameDraft(e.target.value)}
                                  className="flex-grow bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-[#2A3547] focus:outline-none focus:border-[#5D87FF]"
                                  onKeyDown={e => { if (e.key === 'Enter') handleSaveCategoryName(); if (e.key === 'Escape') { setEditingCategoryName(null); setCategoryNameDraft(''); } }}
                                  autoFocus
                                />
                                <button onClick={handleSaveCategoryName} className="p-2 bg-[#5D87FF] text-white rounded-lg"><CheckCircleIcon className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-2 h-2 rounded-full bg-[#5D87FF] flex-shrink-0" />
                                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#2A3547] truncate">{currentCat}</p>
                                  <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingCategoryName(currentCat); setCategoryNameDraft(currentCat); }} className="p-1 text-[#5A6A85] hover:text-[#5D87FF] transition-colors" title="Ubah Kategori"><PencilIcon className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handleDeleteCategory(currentCat)} className="p-1 text-[#5A6A85] hover:text-red-500 transition-colors" title="Hapus Kategori"><Trash2Icon className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] font-black text-[#5A6A85]">{catDone}/{catItems.length}</span>
                                  <div className="w-14 sm:w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#5D87FF] rounded-full transition-all duration-500" style={{ width: `${catItems.length > 0 ? (catDone / catItems.length) * 100 : 0}%` }} />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="p-2.5 sm:p-3 divide-y divide-slate-100">
                            {catItems.map(item => (
                              <div key={item.id} className="flex items-start gap-2.5 sm:gap-3 py-2.5 px-2 rounded-xl hover:bg-[#F8FAFC] transition-all group/item">
                                <button
                                  onClick={() => handleToggleChecklistItem(item.id, item.isCompleted)}
                                  className={`checklist-item-toggle flex-shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all active:scale-90 ${
                                    item.isCompleted ? 'bg-[#5D87FF] border-[#5D87FF] shadow-xs' : 'border-slate-300 bg-white hover:border-[#5D87FF]'
                                  }`}
                                >
                                  {item.isCompleted && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
                                </button>
                                <div className="flex-grow min-w-0">
                                  {editingChecklistItemId === item.id ? (
                                    <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200">
                                      <input
                                        value={checklistItemNameDraft}
                                        onChange={e => setChecklistItemNameDraft(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2A3547] focus:outline-none focus:border-[#5D87FF]"
                                        placeholder="Nama tugas"
                                        autoFocus
                                      />
                                      <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="relative flex-grow">
                                          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5A6A85]" />
                                          <input
                                            value={picDraft}
                                            onChange={e => setPicDraft(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs sm:text-sm text-[#2A3547] focus:outline-none focus:border-[#5D87FF]"
                                            placeholder="PIC / Penanggung Jawab"
                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveItemEdits(); if (e.key === 'Escape') { setEditingChecklistItemId(null); setChecklistItemNameDraft(''); setPicDraft(''); } }}
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <button onClick={() => { setEditingChecklistItemId(null); setChecklistItemNameDraft(''); setPicDraft(''); }} className="flex-1 sm:flex-none px-3 py-1.5 bg-white text-[#5A6A85] text-xs font-bold rounded-xl border border-slate-200">Batal</button>
                                          <button onClick={handleSaveItemEdits} className="flex-1 sm:flex-none button-primary !py-1.5 !px-3 text-xs">Simpan</button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className={`text-xs sm:text-sm font-semibold transition-colors break-words ${item.isCompleted ? 'text-[#5A6A85] line-through' : 'text-[#2A3547]'}`}>
                                          {item.itemName}
                                        </p>
                                        {item.assignedTo && (
                                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-[#F8FAFC] border border-slate-200 text-[10px] font-semibold text-[#5A6A85]">
                                            <UserIcon className="w-2.5 h-2.5 text-[#5D87FF]" />{item.assignedTo}
                                          </span>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                          <button onClick={() => { setEditingChecklistNotesId(item.id); setChecklistNotesDraft(item.notes || ''); }} className={`text-[10px] font-bold uppercase tracking-wider hover:text-[#5D87FF] transition-colors ${item.notes ? 'text-[#5D87FF]' : 'text-[#5A6A85]'}`}>
                                            {item.notes ? '• Lihat Catatan' : '+ Catatan'}
                                          </button>
                                          {item.isCompleted && item.updatedAt && (
                                            <span className="text-[9px] text-[#5A6A85]">✓ {new Date(item.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity flex-shrink-0">
                                        <button onClick={() => { setEditingChecklistItemId(item.id); setChecklistItemNameDraft(item.itemName); setPicDraft(item.assignedTo || ''); }} className="p-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-[#5A6A85] hover:text-[#5D87FF] transition-colors"><PencilIcon className="w-3 h-3" /></button>
                                        <button onClick={() => handleDeleteChecklistItem(item.id)} className="p-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-[#5A6A85] hover:text-red-500 transition-colors"><Trash2Icon className="w-3 h-3" /></button>
                                      </div>
                                    </div>
                                  )}
                                  {editingChecklistNotesId === item.id && (
                                    <div className="mt-2 p-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 animate-fade-in">
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A6A85] mb-1.5">Catatan Item</p>
                                      <textarea value={checklistNotesDraft} onChange={e => setChecklistNotesDraft(e.target.value)} rows={3} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2A3547] focus:outline-none focus:border-[#5D87FF] resize-none" placeholder="Tambahkan instruksi atau update lapangan…" />
                                      <div className="flex justify-end gap-2 mt-2">
                                        <button onClick={() => { setEditingChecklistNotesId(null); setChecklistNotesDraft(''); }} className="px-3 py-1.5 bg-white text-[#5A6A85] text-xs font-bold rounded-xl border border-slate-200">Batal</button>
                                        <button onClick={handleSaveChecklistNotes} className="button-primary !py-1.5 !px-3 text-xs">Simpan Catatan</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            <div className="pt-3">
                              <div className="relative">
                                <PlusIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A6A85] pointer-events-none" />
                                <input
                                  type="text"
                                  placeholder={`Tambah item ke ${currentCat}…`}
                                  className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-[#2A3547] placeholder:text-[#5A6A85] focus:outline-none focus:bg-white focus:border-[#5D87FF] transition-all"
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                      handleAddChecklistItem(currentCat, e.currentTarget.value);
                                      e.currentTarget.value = '';
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          )}

          {/* ──────────── SEKSI 3: FILE & TAUTAN PENTING ───────────── */}
          {(mobileSectionTab === 'all' || mobileSectionTab === 'files') && (
            <div className="space-y-3.5 pt-3 border-t border-slate-200">
              <SectionHeading title="File & Tautan Penting" action={sectionEditButton('files')} />
              <SectionCard>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-slate-200">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#2A3547]">Brief / Moodboard</p>
                      <p className="text-xs text-[#5A6A85] mt-0.5">Link internal untuk tim</p>
                    </div>
                    {selectedProject.driveLink ? (
                      <a href={selectedProject.driveLink} target="_blank" rel="noopener noreferrer" className="button-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 shrink-0 border border-slate-200 bg-white text-[#2A3547]">
                        <FileTextIcon className="w-3.5 h-3.5 text-[#5D87FF]" /> Buka
                      </a>
                    ) : <span className="text-xs text-[#5A6A85] italic shrink-0">Belum ada</span>}
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-slate-200">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#2A3547]">File dari Pengantin</p>
                      <p className="text-xs text-[#5A6A85] mt-0.5">Foto / dokumen diterima dari pengantin</p>
                    </div>
                    {selectedProject.clientDriveLink ? (
                      <a href={selectedProject.clientDriveLink} target="_blank" rel="noopener noreferrer" className="button-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 shrink-0 border border-slate-200 bg-white text-[#2A3547]">
                        <FileTextIcon className="w-3.5 h-3.5 text-[#5D87FF]" /> Buka
                      </a>
                    ) : <span className="text-xs text-[#5A6A85] italic shrink-0">Belum ada</span>}
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#2A3547]">File Jadi (Hasil Akhir)</p>
                        <p className="text-xs text-[#5A6A85] mt-0.5">Link hasil dokumentasi untuk dikirim ke pengantin</p>
                      </div>
                      {!isEditingFinalLink && (
                        <div className="flex items-center gap-1.5">
                          {selectedProject.finalDriveLink && (
                            <button onClick={handleSendFinalLink} className="btn-box-wa !py-1.5 !px-2.5 text-xs">
                              <SendIcon className="w-3.5 h-3.5 text-white" /> <span>Kirim WA</span>
                            </button>
                          )}
                          <button onClick={() => { setTempFinalLink(selectedProject.finalDriveLink || ''); setIsEditingFinalLink(true); }} className="btn-box-edit !py-1.5 !px-2.5 text-xs">
                            <PencilIcon className="w-3.5 h-3.5" /> <span>Edit</span>
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditingFinalLink ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                        <input
                          type="url"
                          value={tempFinalLink}
                          onChange={e => setTempFinalLink(e.target.value)}
                          placeholder="https://drive.google.com/…"
                          className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-[#2A3547] focus:outline-none focus:border-[#5D87FF] transition-all"
                        />
                        <div className="flex items-center gap-2">
                          <button onClick={handleSaveFinalLink} className="flex-1 sm:flex-none button-primary !py-2 !px-3.5 text-xs">Simpan</button>
                          <button onClick={() => setIsEditingFinalLink(false)} className="flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-[#5A6A85] hover:text-[#2A3547]">Batal</button>
                        </div>
                      </div>
                    ) : selectedProject.finalDriveLink ? (
                      <a href={selectedProject.finalDriveLink} target="_blank" rel="noopener noreferrer" className="block text-xs sm:text-sm text-[#5D87FF] hover:underline font-bold break-all bg-white p-2.5 rounded-lg border border-slate-200">
                        {selectedProject.finalDriveLink}
                      </a>
                    ) : (
                      <p className="text-xs text-[#5A6A85] italic">Belum tersedia — klik Edit untuk menambahkan.</p>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default ProjectDetailModal;

// ══════════════════════════════════════════════════════════════════════════════
// EDIT MODE CONTENT — sub-component agar ProjectDetailModal tetap terbaca
// ══════════════════════════════════════════════════════════════════════════════

interface EditModeContentProps {
  editFormData: EditFormData;
  section: ProjectEditSection | null;
  profile: Profile;
  teamMembers: TeamMember[];
  teamByCategory: Record<string, Record<string, TeamMember[]>>;
  paidMemberIds: Set<string>;
  isSaving: boolean;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubStatusToggle: (name: string, checked: boolean) => void;
  onTeamChange: (member: TeamMember) => void;
  onTeamFeeChange: (memberId: string, fee: number) => void;
  onTeamSubJobChange: (memberId: string, subJob: string) => void;
  onReplaceTeamMember: (oldMemberId: string, newMember: TeamMember) => void;
  onSave: () => void;
  onCancel: () => void;
}

const EditModeContent: React.FC<EditModeContentProps> = ({
  editFormData, section, profile, teamMembers, teamByCategory, paidMemberIds,
  isSaving, onFormChange, onSubStatusToggle, onTeamChange, onTeamFeeChange,
  onTeamSubJobChange, onReplaceTeamMember, onSave, onCancel,
}) => {
  return (
    <div className="animate-fade-in">
      {/* Padding bawah agar konten tidak tertutup sticky action bar (~64px) */}
      <div className="pb-20 space-y-4">
        {section === 'status' && (
          <SectionCard title="Status & Progres Pengerjaan">
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-status" className={labelCls}>Status Acara</label>
                <select id="edit-status" name="status" value={editFormData.status} onChange={onFormChange} className={inputCls}>
                  {profile.projectStatusConfig.map(status => <option key={status.id} value={status.name}>{status.name}</option>)}
                </select>
              </div>
              {editFormData.customSubStatuses.map(subStatus => (
                <label key={subStatus.name} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                  <input
                    type="checkbox"
                    checked={editFormData.activeSubStatuses.includes(subStatus.name)}
                    onChange={event => onSubStatusToggle(subStatus.name, event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#5D87FF]"
                  />
                  <span className="text-sm font-semibold text-[#2A3547]">{subStatus.name}</span>
                </label>
              ))}
              {editFormData.status === 'Dikirim' && (
                <div>
                  <label htmlFor="edit-status-shippingDetails" className={labelCls}>Detail Pengiriman</label>
                  <input id="edit-status-shippingDetails" type="text" name="shippingDetails" value={editFormData.shippingDetails} onChange={onFormChange} className={inputCls} />
                </div>
              )}
            </div>
          </SectionCard>
        )}
        {section !== 'status' && (
        <div className={`grid grid-cols-1 gap-4 ${section ? '' : 'lg:grid-cols-2 lg:gap-6'}`}>

          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          {section !== 'team' && <div className="space-y-4">

            {/* 1 — Informasi Dasar */}
            {(section === null || section === 'info') && <SectionCard title="Informasi Dasar Acara">
              <div className={section === 'info' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4' : 'space-y-4'}>
                <div className={section === 'info' ? 'sm:col-span-2' : ''}>
                  <label htmlFor="edit-projectName" className={labelCls}>Nama Acara Pernikahan <span className="text-red-400">*</span></label>
                  <input id="edit-projectName" type="text" name="projectName" value={editFormData.projectName} onChange={onFormChange} className={inputCls} placeholder="Contoh: Wedding Xander & Alya" required />
                </div>
                <div>
                  <label htmlFor="edit-projectType" className={labelCls}>Jenis Acara Pernikahan <span className="text-red-400">*</span></label>
                  <select id="edit-projectType" name="projectType" value={editFormData.projectType} onChange={onFormChange} className={inputCls} required>
                    <option value="" disabled>Pilih Jenis...</option>
                    {profile.projectTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-location" className={labelCls}>Lokasi / Kota</label>
                  <input id="edit-location" type="text" name="location" value={editFormData.location} onChange={onFormChange} className={inputCls} placeholder="Contoh: Jakarta" />
                </div>
                <div className={section === 'info' ? 'sm:col-span-2' : ''}>
                  <label htmlFor="edit-address" className={labelCls}>Alamat Lengkap / Gedung</label>
                  <textarea id="edit-address" name="address" value={editFormData.address} onChange={onFormChange} className={inputCls} placeholder="Contoh: Gedung Mulia, Jl. Gatot Subroto No. 1" rows={section === 'info' ? 2 : 3} />
                </div>
                <div className={section === 'info' ? 'sm:col-span-2' : ''}>
                  <label htmlFor="edit-googleMapsLink" className={labelCls}>Link Google Maps</label>
                  <input id="edit-googleMapsLink" type="url" name="googleMapsLink" value={editFormData.googleMapsLink} onChange={onFormChange} className={inputCls} placeholder="https://maps.google.com/..." />
                  <p className="mt-1 text-[11px] text-[#5A6A85]">Tempel tautan lokasi dari Google Maps.</p>
                </div>
              </div>
            </SectionCard>}

            {/* 2 — Jadwal & Detail */}
            {(section === null || section === 'info') && <SectionCard title="Jadwal & Detail">
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-date" className={labelCls}>Tanggal Acara <span className="text-red-400">*</span></label>
                    <input id="edit-date" type="date" name="date" value={editFormData.date} onChange={onFormChange} className={inputCls} required />
                  </div>
                  <div>
                    <label htmlFor="edit-deadlineDate" className={labelCls}>Deadline</label>
                    <input id="edit-deadlineDate" type="date" name="deadlineDate" value={editFormData.deadlineDate} onChange={onFormChange} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-startTime" className={labelCls}>Waktu Mulai</label>
                    <input id="edit-startTime" type="time" name="startTime" value={editFormData.startTime} onChange={onFormChange} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="edit-endTime" className={labelCls}>Waktu Selesai</label>
                    <input id="edit-endTime" type="time" name="endTime" value={editFormData.endTime} onChange={onFormChange} className={inputCls} />
                  </div>
                </div>
                {editFormData.status === 'Dikirim' && (
                  <div>
                    <label htmlFor="edit-shippingDetails" className={labelCls}>Detail Pengiriman</label>
                    <input id="edit-shippingDetails" type="text" name="shippingDetails" value={editFormData.shippingDetails} onChange={onFormChange} className={inputCls} placeholder="Informasi pengiriman hasil ke pengantin" />
                  </div>
                )}
              </div>
            </SectionCard>}

            {(section === null || section === 'files') && <SectionCard title="File & Tautan Penting">
              <div className="space-y-4">
                <div>
                  <label htmlFor="edit-driveLink" className={labelCls}>Link Brief / Moodboard (Internal)</label>
                  <input id="edit-driveLink" type="url" name="driveLink" value={editFormData.driveLink} onChange={onFormChange} className={inputCls} placeholder="https://..." />
                </div>
                <div>
                  <label htmlFor="edit-clientDriveLink" className={labelCls}>Link File dari Pengantin</label>
                  <input id="edit-clientDriveLink" type="url" name="clientDriveLink" value={editFormData.clientDriveLink} onChange={onFormChange} className={inputCls} placeholder="https://drive.google.com/..." />
                </div>
                <div>
                  <label htmlFor="edit-finalDriveLink" className={labelCls}>Link File Jadi (untuk Pengantin)</label>
                  <input id="edit-finalDriveLink" type="url" name="finalDriveLink" value={editFormData.finalDriveLink} onChange={onFormChange} className={inputCls} placeholder="https://drive.google.com/..." />
                </div>
              </div>
            </SectionCard>}
            {(section === null || section === 'notes') && <SectionCard title="Catatan Khusus">
              <label htmlFor="edit-notes" className={labelCls}>Catatan Acara</label>
              <textarea id="edit-notes" name="notes" value={editFormData.notes} onChange={onFormChange} className={inputCls} placeholder="Catatan penting terkait acara ini..." rows={5} />
            </SectionCard>}
          </div>}

          {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
          {(section === null || section === 'team') && <div className="space-y-4">
            {(['Tim', 'Vendor'] as const).map(category => (
              <SectionCard key={category} title={category === 'Tim' ? 'Tim Internal' : 'Vendor / Mitra'}>
                <div className="space-y-4">
                  {Object.entries(teamByCategory[category] || {}).length === 0 && (
                    <p className="text-xs text-[#5A6A85] italic text-center py-3 bg-[#F8FAFC] rounded-xl border border-dashed border-slate-200">
                      Belum ada {category === 'Tim' ? 'anggota tim' : 'vendor'} terdaftar.
                    </p>
                  )}
                  {Object.entries(teamByCategory[category] || {}).map(([role, members]) => (
                    <div key={role} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-[#5A6A85] uppercase tracking-wider">{role}</p>
                        <div className="h-px flex-grow bg-slate-200" />
                      </div>
                      {(members as TeamMember[]).map(member => {
                        const assignedMember = editFormData.team.find(t => t.memberId === member.id);
                        const isSelected = !!assignedMember;
                        const isPaid = paidMemberIds.has(member.id);
                        return (
                          <div key={member.id} className={`p-3 rounded-xl transition-all ${isSelected ? 'bg-[#ECF2FF] border-2 border-[#5D87FF]' : 'bg-[#F8FAFC] border border-slate-200 hover:border-[#5D87FF]/40'}`}>
                            <label className="flex items-center gap-2.5 sm:gap-3 cursor-pointer">
                              <input type="checkbox" checked={isSelected} onChange={() => onTeamChange(member)} className="h-4 w-4 text-[#5D87FF] rounded border-slate-300 focus:ring-[#5D87FF]/40 flex-shrink-0" />
                              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden shrink-0 bg-white border border-slate-200 flex items-center justify-center text-sm font-bold text-[#5D87FF]">
                                {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" /> : member.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="flex-grow min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-[#2A3547] truncate">{member.name}</p>
                                {isSelected && <p className="text-[10px] text-[#5A6A85] mt-0.5">Fee standar: {formatCurrency(member.standardFee)}</p>}
                              </div>
                            </label>
                            {isSelected && (
                              <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                                <div>
                                  <label className={labelCls}>Biaya per Acara</label>
                                  <input type="number" value={assignedMember!.fee} onChange={e => onTeamFeeChange(member.id, Number(e.target.value))} disabled={isPaid} className={`${inputCls} text-right font-mono ${isPaid ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="0" />
                                  {isPaid && <p className="text-[10px] text-amber-600 mt-1">Sudah dibayar — tidak dapat diubah</p>}
                                </div>
                                <div>
                                  <label className={labelCls}>Keterangan Tugas</label>
                                  <input type="text" value={assignedMember!.subJob || ''} onChange={e => onTeamSubJobChange(member.id, e.target.value)} className={inputCls} placeholder="Contoh: Leader, Drone Operator..." />
                                </div>
                                <div>
                                  <label className={labelCls}>Ganti Personil / Freelance</label>
                                  <select value="" onChange={e => { const m = teamMembers.find(tm => tm.id === e.target.value); if (m) onReplaceTeamMember(member.id, m); }} className={`${inputCls} cursor-pointer`}>
                                    <option value="">— Tetap {member.name} (atau pilih pengganti) —</option>
                                    {teamMembers.filter(tm => tm.id !== member.id).map(tm => (
                                      <option key={tm.id} value={tm.id}>Ganti ke: {tm.name} ({tm.role || 'Tim'})</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </SectionCard>
            ))}
          </div>}
        </div>
        )}
      </div>

      {/* ── Sticky Action Bar ─────────────────────────────────────────── */}
      {/* z-50: di atas konten modal (overflow-y scroll), di bawah overlay (z-60) */}
      <div className="sticky bottom-0 left-0 right-0 z-50 flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <p className="flex-1 text-xs text-[#5A6A85] hidden sm:block truncate">
          <span className="font-bold text-amber-600">{section ? 'Edit Bagian Aktif' : 'Mode Edit Aktif'}</span> — Perubahan belum disimpan
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-[#5A6A85] text-xs sm:text-sm font-bold hover:text-[#2A3547] transition-all active:scale-95 disabled:opacity-50"
        >
          <XIcon className="w-4 h-4" />
          Batal
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#5D87FF] text-white text-xs sm:text-sm font-bold hover:bg-[#4570EA] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-[#5D87FF]/25"
        >
          {isSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Menyimpan...
            </>
          ) : (
            <>
              <SaveIcon className="w-4 h-4 flex-shrink-0" />
              {section ? 'Update Bagian' : 'Simpan Perubahan'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
