/**
 * TeamStatDrillModal
 *
 * Renders detail content for stat card drill-downs on the Team page.
 * Extracted from the inline `renderStatModalContent` in TeamPage.tsx.
 */
import React from 'react';
import Modal from '../../../shared/ui/Modal';
import { TeamMember, TeamProjectPayment, Project } from '../../../types';
import { formatCurrency, formatDate, getStatusClass } from '../utils/teamUtils';
import { StarIcon } from '../../../constants';
import { customizeUiText, useUiTextOverrides } from '../../../utils/uiTextCustomization';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatGroup = 'team' | 'vendor';
export type StatKey =
  | 'total'
  | 'unpaid'
  | 'topRated'
  | 'events'
  | 'payments'
  | 'performance';

export interface ActiveStatModal {
  group: StatGroup;
  stat: StatKey;
}

interface TeamStatDrillModalProps {
  activeStatModal: ActiveStatModal | null;
  onClose: () => void;
  memberGroups: { team: TeamMember[]; vendor: TeamMember[] };
  teamProjectPaymentsInDateRange: TeamProjectPayment[];
  projects: Project[];
  uniqueTeamMembers: TeamMember[];
  uniqueVendorMembers: TeamMember[];
  projectsInDateRange: Project[];
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <p className="text-center py-10 text-sm text-brand-text-secondary">{message}</p>
);

const InfoRow: React.FC<{ label: string; value: string; className?: string }> = ({
  label,
  value,
  className = '',
}) => (
  <div className={`flex justify-between items-center gap-3 ${className}`}>
    <span className="text-sm text-brand-text-secondary">{label}</span>
    <span className="font-semibold text-brand-text-primary text-sm">{value}</span>
  </div>
);

// ─── Content renderers (one per stat key) ─────────────────────────────────────

const TotalContent: React.FC<{ members: TeamMember[] }> = ({ members }) => (
  <div className="space-y-2">
    {members.map((m) => (
      <div key={m.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
        <p className="font-bold text-[#2A3547] text-sm">{m.name}</p>
        <p className="text-xs text-[#5A6A85] mt-0.5">{m.role}</p>
      </div>
    ))}
  </div>
);

const UnpaidContent: React.FC<{
  groupMembers: TeamMember[];
  payments: TeamProjectPayment[];
  projects: Project[];
}> = ({ groupMembers, payments, projects }) => {
  const memberIds = new Set(groupMembers.map((m) => m.id));
  const unpaid = payments.filter(
    (p) => p.status === 'Unpaid' && memberIds.has(p.teamMemberId),
  );

  if (unpaid.length === 0) return <EmptyState message="Tidak ada fee yang belum dibayar." />;

  return (
    <div className="space-y-2">
      {unpaid.map((payment) => (
        <div
          key={payment.id}
          className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex justify-between items-center gap-3"
        >
          <div>
            <p className="font-bold text-[#2A3547] text-sm">
              {payment.teamMemberName}
            </p>
            <p className="text-xs text-[#5A6A85] mt-0.5">
              {projects.find((p) => p.id === payment.projectId)?.projectName ?? 'N/A'}
            </p>
          </div>
          <p className="font-bold text-red-600 text-sm shrink-0">
            {formatCurrency(payment.fee)}
          </p>
        </div>
      ))}
    </div>
  );
};

const TopRatedContent: React.FC<{ groupMembers: TeamMember[] }> = ({ groupMembers }) => (
  <div className="space-y-2">
    {[...groupMembers]
      .sort((a, b) => b.rating - a.rating)
      .map((m) => (
        <div
          key={m.id}
          className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex justify-between items-center gap-3"
        >
          <div>
            <p className="font-bold text-[#2A3547] text-sm">{m.name}</p>
            <p className="text-xs text-[#5A6A85] mt-0.5">{m.role}</p>
          </div>
          <div className="flex items-center gap-1 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-xs shrink-0">
            <StarIcon className="w-3.5 h-3.5 text-amber-500 fill-current" />
            {m.rating.toFixed(1)}
          </div>
        </div>
      ))}
  </div>
);

const EventsContent: React.FC<{
  groupMembers: TeamMember[];
  payments: TeamProjectPayment[];
  projectsInDateRange: Project[];
}> = ({ groupMembers, payments, projectsInDateRange }) => {
  const memberIds = new Set(groupMembers.map((m) => m.id));
  const projectIds = new Set(
    payments.filter((p) => memberIds.has(p.teamMemberId)).map((p) => p.projectId),
  );
  const related = projectsInDateRange
    .filter((p) => projectIds.has(p.id))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (related.length === 0) return <EmptyState message="Belum ada acara terkait." />;

  return (
    <div className="space-y-2">
      {related.map((p) => (
        <div key={p.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-[#2A3547] text-sm">{p.projectName}</p>
              <p className="text-xs text-[#5A6A85] mt-0.5">{p.clientName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-medium text-[#2A3547]">{formatDate(p.date)}</p>
              <p className="text-xs text-[#5A6A85]">{p.location}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const PaymentsContent: React.FC<{
  groupMembers: TeamMember[];
  payments: TeamProjectPayment[];
  projects: Project[];
}> = ({ groupMembers, payments, projects }) => {
  const memberIds = new Set(groupMembers.map((m) => m.id));
  const grouped = payments
    .filter((p) => memberIds.has(p.teamMemberId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (grouped.length === 0) return <EmptyState message="Belum ada data pembayaran." />;

  const paid = grouped.filter((p) => p.status === 'Paid');
  const unpaid = grouped.filter((p) => p.status === 'Unpaid');
  const projectMap = new Map(projects.map((p) => [p.id, p] as const));
  const MAX_DISPLAY = 100;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200">
          <p className="text-xs text-[#5A6A85] font-medium">Total Dibayar</p>
          <p className="font-bold text-emerald-600 text-sm mt-0.5">
            {formatCurrency(paid.reduce((s, p) => s + p.fee, 0))}
          </p>
          <p className="text-xs text-[#5A6A85] mt-1">{paid.length} item</p>
        </div>
        <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200">
          <p className="text-xs text-[#5A6A85] font-medium">Belum Dibayar</p>
          <p className="font-bold text-red-600 text-sm mt-0.5">
            {formatCurrency(unpaid.reduce((s, p) => s + p.fee, 0))}
          </p>
          <p className="text-xs text-[#5A6A85] mt-1">{unpaid.length} item</p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {grouped.slice(0, MAX_DISPLAY).map((pay) => {
          const proj = projectMap.get(pay.projectId);
          return (
            <div
              key={pay.id}
              className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex justify-between items-start gap-3"
            >
              <div>
                <p className="font-bold text-[#2A3547] text-sm">
                  {pay.teamMemberName}
                </p>
                <p className="text-xs text-[#5A6A85] mt-0.5">
                  {proj?.projectName ?? 'N/A'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${getStatusClass(pay.status)}`}
                >
                  {pay.status}
                </span>
                <p className="font-bold text-[#2A3547] text-sm mt-1">
                  {formatCurrency(pay.fee)}
                </p>
                <p className="text-xs text-[#5A6A85]">{formatDate(pay.date)}</p>
              </div>
            </div>
          );
        })}
        {grouped.length > MAX_DISPLAY && (
          <p className="text-center text-xs text-[#5A6A85] pt-2">
            Menampilkan {MAX_DISPLAY} dari {grouped.length} data.
          </p>
        )}
      </div>
    </div>
  );
};

const PerformanceContent: React.FC<{ groupMembers: TeamMember[] }> = ({ groupMembers }) => {
  if (groupMembers.length === 0) return <EmptyState message="Belum ada data kinerja." />;

  const avg =
    groupMembers.reduce((s, m) => s + (m.rating || 0), 0) / groupMembers.length;
  const notesCount = groupMembers.reduce(
    (s, m) => s + (m.performanceNotes?.length || 0),
    0,
  );
  const sorted = [...groupMembers].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200">
          <p className="text-xs text-[#5A6A85] font-medium">Rating Rata-rata</p>
          <p className="font-bold text-[#2A3547] text-sm mt-0.5">{avg.toFixed(1)}</p>
        </div>
        <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200">
          <p className="text-xs text-[#5A6A85] font-medium">Total Catatan</p>
          <p className="font-bold text-[#2A3547] text-sm mt-0.5">{notesCount}</p>
        </div>
      </div>
      <div className="space-y-2">
        {sorted.map((m) => (
          <div
            key={m.id}
            className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex justify-between items-center gap-3"
          >
            <div>
              <p className="font-bold text-[#2A3547] text-sm">{m.name}</p>
              <p className="text-xs text-[#5A6A85] mt-0.5">{m.role}</p>
              <p className="text-xs text-[#5A6A85] mt-0.5">
                {m.performanceNotes?.length ?? 0} catatan
              </p>
            </div>
            <div className="flex items-center gap-1 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-xs shrink-0">
              <StarIcon className="w-3.5 h-3.5 text-amber-500 fill-current" />
              {(m.rating || 0).toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Modal titles map ─────────────────────────────────────────────────────────

const MODAL_TITLES: Record<string, string> = {
  'team-total': 'Daftar Semua Tim',
  'team-unpaid': 'Rincian Fee Tim Belum Dibayar',
  'team-topRated': 'Peringkat Tim',
  'team-events': 'Rincian Acara Pernikahan (Tim)',
  'team-payments': 'Rincian Pembayaran (Tim)',
  'team-performance': 'Rincian Kinerja (Tim)',
  'vendor-total': 'Daftar Semua Vendor',
  'vendor-unpaid': 'Rincian Fee Vendor Belum Dibayar',
  'vendor-topRated': 'Peringkat Vendor',
  'vendor-events': 'Rincian Acara Pernikahan (Vendor)',
  'vendor-payments': 'Rincian Pembayaran (Vendor)',
  'vendor-performance': 'Rincian Kinerja (Vendor)',
};

// ─── Main component ───────────────────────────────────────────────────────────

const TeamStatDrillModal: React.FC<TeamStatDrillModalProps> = ({
  activeStatModal,
  onClose,
  memberGroups,
  teamProjectPaymentsInDateRange,
  projects,
  uniqueTeamMembers,
  uniqueVendorMembers,
  projectsInDateRange,
}) => {
  const uiTextOverrides = useUiTextOverrides();
  const renderContent = () => {
    if (!activeStatModal) return null;
    const { group, stat } = activeStatModal;
    const groupMembers = group === 'team' ? memberGroups.team : memberGroups.vendor;
    const displayMembers = group === 'team' ? uniqueTeamMembers : uniqueVendorMembers;

    switch (stat) {
      case 'total':
        return <TotalContent members={displayMembers} />;
      case 'unpaid':
        return (
          <UnpaidContent
            groupMembers={groupMembers}
            payments={teamProjectPaymentsInDateRange}
            projects={projects}
          />
        );
      case 'topRated':
        return <TopRatedContent groupMembers={groupMembers} />;
      case 'events':
        return (
          <EventsContent
            groupMembers={groupMembers}
            payments={teamProjectPaymentsInDateRange}
            projectsInDateRange={projectsInDateRange}
          />
        );
      case 'payments':
        return (
          <PaymentsContent
            groupMembers={groupMembers}
            payments={teamProjectPaymentsInDateRange}
            projects={projects}
          />
        );
      case 'performance':
        return <PerformanceContent groupMembers={groupMembers} />;
      default:
        return null;
    }
  };

  const title = activeStatModal
    ? customizeUiText(
      `team.drill.${activeStatModal.group}.${activeStatModal.stat}`,
      MODAL_TITLES[`${activeStatModal.group}-${activeStatModal.stat}`] ?? '',
      uiTextOverrides,
    )
    : '';

  return (
    <Modal isOpen={!!activeStatModal} onClose={onClose} title={title} size="2xl">
      <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-1">
        {renderContent()}
      </div>
    </Modal>
  );
};

export default TeamStatDrillModal;
