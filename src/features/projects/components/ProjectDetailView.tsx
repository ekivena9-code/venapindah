import React from 'react';
import { Project, Profile, TeamMember, Client, Package, TeamProjectPayment, Transaction, Card, AssignedTeamMember, PaymentStatus, SubStatusConfig } from '../../../types';
import { PencilIcon, Share2Icon, CheckCircleIcon, ClipboardListIcon, FileTextIcon } from '../../../constants';
import { customizeUiText, useUiTextOverrides } from '../../../utils/uiTextCustomization';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

interface ProjectDetailViewProps {
    project: Project;
    profile: Profile;
    teamMembers: TeamMember[];
    clients: Client[];
    packages: Package[];
    onEdit: () => void;
    onShareBriefing: () => void;
    onUpdateStatus: (status: string) => void;
    onToggleSubStatus: (name: string, active: boolean) => void;
}

const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ project, profile, teamMembers, clients, packages, onEdit, onShareBriefing, onUpdateStatus, onToggleSubStatus }) => {
    const uiTextOverrides = useUiTextOverrides();
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="space-y-4">
                    <h4 className="text-lg font-bold text-brand-text-light flex items-center gap-2">
                        <ClipboardListIcon className="w-5 h-5 text-brand-accent" /> {customizeUiText('project.detail.title', 'Detail Acara', uiTextOverrides)}
                    </h4>
                    <div className="p-6 rounded-2xl bg-white border border-brand-border shadow-sm space-y-5 text-sm">
                        <div className="flex justify-between items-center py-3 border-b border-slate-100">
                            <span className="text-brand-text-secondary font-medium">Pengantin</span>
                            <span className="font-bold text-brand-text-light">{project.clientName}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-slate-100">
                            <span className="text-brand-text-secondary font-medium">Tanggal</span>
                            <span className="font-bold text-brand-text-light">{project.date ? new Date(project.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Belum ditentukan'}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-slate-100">
                            <span className="text-brand-text-secondary font-medium">Lokasi</span>
                            <span className="font-bold text-brand-text-light">{project.location}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3">
                            <span className="text-brand-text-secondary font-medium">Package</span>
                            <span className="font-bold text-brand-accent">{project.packageName}</span>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h4 className="text-lg font-bold text-brand-text-light flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5 text-brand-success" /> Progres Pengerjaan
                    </h4>
                    <div className="p-6 rounded-2xl bg-white border border-brand-border shadow-sm">
                        <div className="mb-8">
                            <label className="block text-[11px] font-bold text-brand-text-secondary uppercase tracking-wider mb-3">Status Utama</label>
                            <select
                                value={project.status}
                                onChange={(e) => onUpdateStatus(e.target.value)}
                                className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-brand-text-light font-bold outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all"
                            >
                                {profile.projectStatusConfig.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="block text-[11px] font-bold text-brand-text-secondary uppercase tracking-wider mb-3">Sub-Status / Tahapan</label>
                            {(project.customSubStatuses || []).map(sub => (
                                <label key={sub.name} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer transition-all hover:bg-white hover:border-brand-accent/30 hover:shadow-sm">
                                    <input
                                        type="checkbox"
                                        checked={project.activeSubStatuses?.includes(sub.name)}
                                        onChange={(e) => onToggleSubStatus(sub.name, e.target.checked)}
                                        className="w-5 h-5 rounded border-slate-300 text-brand-accent focus:ring-brand-accent/50"
                                    />
                                    <div>
                                        <p className="text-sm font-bold text-brand-text-light">{sub.name}</p>
                                        {sub.note && <p className="text-[11px] text-brand-text-secondary mt-0.5">{sub.note}</p>}
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </section>
            </div>

            <div className="flex gap-3">
                <button onClick={onEdit} className="flex-1 py-2 rounded-xl bg-brand-surface border border-brand-border text-brand-text-light font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-white/5 transition-all">
                    <PencilIcon className="w-4 h-4" /> Edit Data
                </button>
                <button onClick={onShareBriefing} className="flex-1 py-2 rounded-xl bg-brand-accent text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-brand-accent/20 hover:scale-[1.02] transition-all">
                    <Share2Icon className="w-4 h-4" /> Bagikan Briefing
                </button>
            </div>
        </div>
    );
};

export default ProjectDetailView;
