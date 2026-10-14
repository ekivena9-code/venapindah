import React, { lazy, Suspense, useState, useMemo } from 'react';
import {
  Client, Project, PaymentStatus, Package, AddOn, TransactionType,
  Transaction, Card, ViewType, NavigationAction, Profile, TeamMember,
  TeamProjectPayment, FinancialPocket,
} from '../../../types';
import Modal from '../../../shared/ui/Modal';
import RupiahInput from '../../../shared/form/RupiahInput';
import {
  PencilIcon, Trash2Icon, FileTextIcon, CreditCardIcon, Share2Icon,
  HistoryIcon, DollarSignIcon, FolderKanbanIcon, UsersIcon, TrendingUpIcon,
  TrendingDownIcon, CheckIcon, XIcon, cleanPhoneNumber
} from '../../../constants';
import { Sparkles, Zap, Plus, Settings, Gift, ChevronDown } from 'lucide-react';
import { updateProject as updateProjectRow } from '../../../services/projects';
import { formatCurrency, normalizeTerminology } from '../utils/clientHelpers';
import { useExtraChargeTemplates } from '../../../hooks/useExtraChargeTemplates';
import ManageTemplatesModal from './ManageTemplatesModal';
import { customizeUiText, useUiTextOverrides } from '../../../utils/uiTextCustomization';

const ProjectManagement = lazy(() =>
  import('../../../pages/projects/ProjectsPage').then(module => ({ default: module.Projects })),
);

interface ClientDetailModalProps {
  client: Client | null;
  profile: Profile;
  projects: Project[];
  transactions: Transaction[];
  packages: Package[];
  addOns?: AddOn[];
  onClose: () => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onViewReceipt: (transaction: Transaction) => void;
  onViewInvoice: (project: Project) => void;
  handleNavigation: (view: ViewType, action?: NavigationAction) => void;
  onRecordPayment: (projectId: string, amount: number, destinationCardId: string) => void;
  cards: Card[];
  onSharePortal: (client: Client) => void;
  onDeleteProject: (projectId: string) => void;
  showNotification: (message: string) => void;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  teamMembers: TeamMember[];
  teamProjectPayments: TeamProjectPayment[];
  setTeamProjectPayments: React.Dispatch<React.SetStateAction<TeamProjectPayment[]>>;
  pockets: FinancialPocket[];
  setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
}

// ─── Extra Charge Templates ──────────────────────────────────────────────────

export interface ExtraChargeTemplate {
  name: string;
  category: string;
  defaultAmount: number;
  badge?: string;
}

export const DEFAULT_CHARGE_TEMPLATES: ExtraChargeTemplate[] = [
  // Overtime
  { name: 'Overtime Kru (1 Jam)', category: 'Overtime & Jam Tambahan', defaultAmount: 500000 },
  { name: 'Overtime Kru (2 Jam)', category: 'Overtime & Jam Tambahan', defaultAmount: 900000 },
  { name: 'Overtime Acara (Per Jam)', category: 'Overtime & Jam Tambahan', defaultAmount: 350000 },
  { name: 'Overtime Standby / Jeda Waktu', category: 'Overtime & Jam Tambahan', defaultAmount: 250000 },

  // Dokumentasi & Personil Ekstra
  { name: 'Drone Aerial 4K / Pilot Drone', category: 'Dokumentasi & Personil', defaultAmount: 1200000 },
  { name: 'Same Day Edit (SDE) Video Teaser', category: 'Dokumentasi & Personil', defaultAmount: 1500000 },
  { name: 'Fotografer Tambahan (1 Orang)', category: 'Dokumentasi & Personil', defaultAmount: 750000 },
  { name: 'Videografer Tambahan (1 Orang)', category: 'Dokumentasi & Personil', defaultAmount: 850000 },
  { name: 'Lighting Setup & Gear Tambahan', category: 'Dokumentasi & Personil', defaultAmount: 500000 },

  // Cetak & Merchandise
  { name: 'Upgrade Cetak Album 20x30 Exclusive & Box', category: 'Cetak & Album', defaultAmount: 600000 },
  { name: 'Cetak Kanvas 24R + Frame Minimalis', category: 'Cetak & Album', defaultAmount: 450000 },
  { name: 'USB Flashdisk Kayu Exclusive & Box', category: 'Cetak & Album', defaultAmount: 250000 },
  { name: 'Mini Album Parents (2 Buku)', category: 'Cetak & Album', defaultAmount: 500000 },
  { name: 'Cetak Pembesaran 16R + Bingkai', category: 'Cetak & Album', defaultAmount: 200000 },

  // Layanan & Operasional
  { name: 'Live Streaming Acara (IG / YouTube)', category: 'Layanan & Operasional', defaultAmount: 1500000 },
  { name: 'Transport & Akomodasi Luar Kota', category: 'Layanan & Operasional', defaultAmount: 500000 },
  { name: 'Biaya Izin Lokasi / Venue Charge', category: 'Layanan & Operasional', defaultAmount: 300000 },
  { name: 'Fast Editing / Express Delivery (3 Hari)', category: 'Layanan & Operasional', defaultAmount: 750000 },

  // Bonus / Complimentary (Rp 0)
  { name: 'Bonus Overtime 1 Jam (Free)', category: 'Bonus / Free (Rp 0)', defaultAmount: 0, badge: 'Rp 0' },
  { name: 'Bonus Cetak Foto Mini Frame (Free)', category: 'Bonus / Free (Rp 0)', defaultAmount: 0, badge: 'Rp 0' },
  { name: 'Bonus Flashdisk Tambahan (Free)', category: 'Bonus / Free (Rp 0)', defaultAmount: 0, badge: 'Rp 0' },
  { name: 'Complimentary Raw Files Access (Free)', category: 'Bonus / Free (Rp 0)', defaultAmount: 0, badge: 'Rp 0' },
];

export const POPULAR_PRESET_CHIPS: { label: string; name: string; amount: number; isFree?: boolean }[] = [
  { label: 'Overtime 1 Jam', name: 'Overtime Kru (1 Jam)', amount: 500000 },
  { label: 'Drone 4K', name: 'Drone Aerial 4K / Pilot Drone', amount: 1200000 },
  { label: 'SDE Video', name: 'Same Day Edit (SDE) Video Teaser', amount: 1500000 },
  { label: 'Upgrade Album', name: 'Upgrade Cetak Album 20x30 Exclusive & Box', amount: 600000 },
  { label: 'Bonus Overtime (Rp 0)', name: 'Bonus Overtime 1 Jam (Free)', amount: 0, isFree: true },
  { label: 'Bonus Cetak (Rp 0)', name: 'Bonus Cetak Foto Mini Frame (Free)', amount: 0, isFree: true },
];

// ─── Tiny reusable sub-components ───────────────────────────────────────────

const InfoField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A6A85]">{label}</span>
    <span className="text-sm font-semibold text-[#2A3547]">{children}</span>
  </div>
);

const FinancePill: React.FC<{
  label: string;
  value: string;
  color: 'neutral' | 'green' | 'red';
}> = ({ label, value, color }) => {
  const colorMap = {
    neutral: 'bg-[#F4F6F9] border-[#EAEFF4] text-[#5A6A85]',
    green: 'bg-[#13DEB9]/10 border-[#13DEB9]/20 text-[#13DEB9]',
    red: 'bg-[#FA896B]/10 border-[#FA896B]/20 text-[#FA896B]',
  };
  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border px-2 py-2 sm:px-3 sm:py-2.5 ${colorMap[color]}`}>
      <span className="text-[7px] font-black uppercase tracking-[0.12em] opacity-80 sm:text-[8px]">{label}</span>
      <span className="mt-0.5 truncate text-[11px] font-black tracking-tight sm:text-sm">{value}</span>
    </div>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => (
  <div className="mb-3">
    <h4 className="text-sm font-bold text-[#2A3547]">{children}</h4>
    {sub && <p className="text-[11px] text-[#5A6A85] mt-0.5">{sub}</p>}
  </div>
);

// ─── Main component ──────────────────────────────────────────────────────────

const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client, profile, projects, transactions, packages, addOns,
  onClose, onEditClient, onDeleteClient,
  onViewReceipt, onViewInvoice, handleNavigation,
  onRecordPayment, cards, onSharePortal, onDeleteProject,
  showNotification, setProjects, setTransactions, setCards,
  teamMembers, teamProjectPayments, setTeamProjectPayments, pockets, setPockets,
}) => {
  const uiTextOverrides = useUiTextOverrides();
  const [activeTab, setActiveTab] = useState<'info' | 'events' | 'payments'>(() =>
    projects.some(project => project.clientId === client.id) ? 'events' : 'info',
  );
  const [newPayments, setNewPayments] = useState<{ [key: string]: { amount: string; destinationCardId: string } }>({});
  const [newCharge, setNewCharge] = useState<{ [key: string]: { name: string; amount: string } }>({});
  const [transactionFormOpen, setTransactionFormOpen] = useState<Record<string, boolean>>({});
  const [projectOverrides, setProjectOverrides] = useState<{ [projectId: string]: Partial<Project> }>({});
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [editChargeData, setEditChargeData] = useState({ name: '', amount: '' });
  const [selectedAddPkg, setSelectedAddPkg] = useState<{ [projectId: string]: string }>({});
  const [showManageTemplates, setShowManageTemplates] = useState(false);
  const [collapsedStates, setCollapsedStates] = useState<{ [projectId: string]: { payment: boolean, charge: boolean } }>({});
  const { templates } = useExtraChargeTemplates();

  // Group templates by category
  const templateCategories = useMemo(() => {
    const map = new Map<string, any[]>();
    templates.forEach(t => {
      const existing = map.get(t.category) || [];
      existing.push(t);
      map.set(t.category, existing);
    });
    return Array.from(map.entries());
  }, [templates]);

  // Group packages by region
  const packagesByRegion = useMemo(() => {
    const map = new Map<string, Package[]>();
    packages.forEach(pkg => {
      const region = pkg.region || 'Lainnya';
      const existing = map.get(region) || [];
      existing.push(pkg);
      map.set(region, existing);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [packages]);

  if (!client) return null;

  // ── handlers ────────────────────────────────────────────────────────────

  const handleNewPaymentChange = (projectId: string, field: 'amount' | 'destinationCardId', value: string) => {
    const current = newPayments[projectId] || { amount: '', destinationCardId: '' };
    setNewPayments(prev => ({ ...prev, [projectId]: { ...current, [field]: value } }));
  };

  const handleNewPaymentSubmit = (projectId: string) => {
    const paymentData = newPayments[projectId];
    const project = clientProjects.find(p => p.id === projectId);
    if (paymentData && Number(paymentData.amount) > 0 && paymentData.destinationCardId && project) {
      const amount = Number(paymentData.amount);
      if (amount > (project.totalCost - project.amountPaid)) {
        alert('Jumlah pembayaran melebihi sisa pembayaran.');
        return;
      }
      onRecordPayment(projectId, amount, paymentData.destinationCardId);
      setNewPayments(prev => ({ ...prev, [projectId]: { amount: '', destinationCardId: '' } }));
    } else {
      showNotification('Harap isi jumlah dan tujuan pembayaran dengan benar.');
    }
  };

  const handleNewChargeChange = (projectId: string, field: 'name' | 'amount', value: string) => {
    const current = newCharge[projectId] || { name: '', amount: '' };
    setNewCharge(prev => ({ ...prev, [projectId]: { ...current, [field]: value } }));
  };

  const handleApplyTemplate = (projectId: string, template: { name: string; defaultAmount: number }) => {
    setNewCharge(prev => ({
      ...prev,
      [projectId]: {
        name: template.name,
        amount: String(template.defaultAmount),
      }
    }));
  };

  const handleSetZeroAmount = (projectId: string) => {
    const current = newCharge[projectId] || { name: '', amount: '' };
    setNewCharge(prev => ({
      ...prev,
      [projectId]: {
        ...current,
        amount: '0',
      }
    }));
  };

  const handleNewChargeSubmit = async (projectId: string) => {
    const chargeData = newCharge[projectId];
    const project = clientProjects.find(p => p.id === projectId);
    const rawAmount = chargeData?.amount !== undefined ? chargeData.amount.trim() : '';
    const amount = rawAmount === '' ? 0 : Number(rawAmount);

    if (chargeData && chargeData.name.trim() && !isNaN(amount) && amount >= 0 && project) {
      const newCustomCost = { id: `custom-${Date.now()}`, description: chargeData.name.trim(), amount };
      const updatedCustomCosts = [...(project.customCosts || []), newCustomCost];
      const newTotalCost = project.totalCost + amount;
      const remaining = newTotalCost - project.amountPaid;
      const newPaymentStatus = remaining <= 0 ? PaymentStatus.LUNAS : (project.amountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);
      try {
        await updateProjectRow(projectId, { customCosts: updatedCustomCosts, totalCost: newTotalCost, paymentStatus: newPaymentStatus });
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, customCosts: updatedCustomCosts, totalCost: newTotalCost, paymentStatus: newPaymentStatus } : p));
        setNewCharge(prev => ({ ...prev, [projectId]: { name: '', amount: '' } }));
        showNotification(amount === 0
          ? 'Biaya tambahan (Rp 0 / Gratis) berhasil ditambahkan.'
          : 'Biaya tambahan berhasil ditambahkan.'
        );
      } catch (err) {
        console.error('Gagal menambahkan biaya tambahan:', err);
        showNotification('Gagal menambahkan biaya tambahan.');
      }
    } else {
      showNotification('Harap isi nama biaya dengan benar (jumlah biaya minimal Rp 0).');
    }
  };

  const handleAddAdditionalPackage = async (projectId: string, packageId: string) => {
    const project = clientProjects.find(p => p.id === projectId);
    const pkg = packages.find(p => p.id === packageId);
    if (!project || !pkg) return;

    const newAdditionalPackage = { id: pkg.id, name: pkg.name, price: pkg.price };
    const updatedAdditionalPackages = [...(project.additionalPackages || []), newAdditionalPackage];
    const newTotalCost = project.totalCost + pkg.price;
    const remaining = newTotalCost - project.amountPaid;
    const newPaymentStatus = remaining <= 0 ? PaymentStatus.LUNAS : (project.amountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);
    
    try {
      await updateProjectRow(projectId, { additionalPackages: updatedAdditionalPackages, totalCost: newTotalCost, paymentStatus: newPaymentStatus });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, additionalPackages: updatedAdditionalPackages, totalCost: newTotalCost, paymentStatus: newPaymentStatus } : p));
      showNotification('Package Tambahan berhasil ditambahkan.');
    } catch (err) {
      console.error('Gagal menambahkan package tambahan:', err);
      showNotification('Gagal menambahkan package tambahan.');
    }
  };

  const handleDeleteAdditionalPackage = async (projectId: string, packageIndex: number) => {
    if (!window.confirm('Hapus package tambahan ini?')) return;
    const project = clientProjects.find(p => p.id === projectId);
    if (!project || !project.additionalPackages) return;

    const packageToDelete = project.additionalPackages[packageIndex];
    if (!packageToDelete) return;

    const updatedAdditionalPackages = [...project.additionalPackages];
    updatedAdditionalPackages.splice(packageIndex, 1);

    const newTotalCost = project.totalCost - (packageToDelete.price || 0);
    const remaining = newTotalCost - project.amountPaid;
    const newPaymentStatus = remaining <= 0 ? PaymentStatus.LUNAS : (project.amountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);
    
    try {
      await updateProjectRow(projectId, { additionalPackages: updatedAdditionalPackages, totalCost: newTotalCost, paymentStatus: newPaymentStatus });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, additionalPackages: updatedAdditionalPackages, totalCost: newTotalCost, paymentStatus: newPaymentStatus } : p));
      showNotification('Package Tambahan berhasil dihapus.');
    } catch (err) {
      console.error('Gagal menghapus package tambahan:', err);
      showNotification('Gagal menghapus package tambahan.');
    }
  };

  const handleDeleteCharge = async (projectId: string, chargeId: string) => {
    if (!window.confirm('Hapus biaya tambahan ini?')) return;
    const project = clientProjects.find(p => p.id === projectId);
    if (!project?.customCosts) return;
    const chargeToDelete = project.customCosts.find(c => c.id === chargeId);
    if (!chargeToDelete) return;
    const updatedCustomCosts = project.customCosts.filter(c => c.id !== chargeId);
    const newTotalCost = project.totalCost - chargeToDelete.amount;
    const remaining = newTotalCost - project.amountPaid;
    const newPaymentStatus = remaining <= 0 ? PaymentStatus.LUNAS : (project.amountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);
    try {
      await updateProjectRow(projectId, { customCosts: updatedCustomCosts, totalCost: newTotalCost, paymentStatus: newPaymentStatus });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, customCosts: updatedCustomCosts, totalCost: newTotalCost, paymentStatus: newPaymentStatus } : p));
      showNotification('Biaya tambahan berhasil dihapus.');
    } catch (err) {
      console.error('Gagal menghapus biaya tambahan:', err);
      showNotification('Gagal menghapus biaya tambahan.');
    }
  };

  const handleStartEditCharge = (charge: { id: string; description: string; amount: number }) => {
    setEditingChargeId(charge.id);
    setEditChargeData({ name: charge.description, amount: String(charge.amount) });
  };

  const handleSaveEditCharge = async (projectId: string) => {
    const project = clientProjects.find(p => p.id === projectId);
    if (!project?.customCosts || !editingChargeId) return;
    const chargeToUpdate = project.customCosts.find(c => c.id === editingChargeId);
    if (!chargeToUpdate) return;
    const rawAmount = editChargeData.amount.trim();
    const newAmount = rawAmount === '' ? 0 : Number(rawAmount);
    const name = editChargeData.name.trim();
    if (!name || isNaN(newAmount) || newAmount < 0) {
      showNotification('Harap isi nama dan jumlah biaya dengan benar (minimal Rp 0).');
      return;
    }
    const diff = newAmount - chargeToUpdate.amount;
    const updatedCustomCosts = project.customCosts.map(c => c.id === editingChargeId ? { ...c, description: name, amount: newAmount } : c);
    const newTotalCost = project.totalCost + diff;
    const remaining = newTotalCost - project.amountPaid;
    const newPaymentStatus = remaining <= 0 ? PaymentStatus.LUNAS : (project.amountPaid > 0 ? PaymentStatus.DP_TERBAYAR : PaymentStatus.BELUM_BAYAR);
    try {
      await updateProjectRow(projectId, { customCosts: updatedCustomCosts, totalCost: newTotalCost, paymentStatus: newPaymentStatus });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, customCosts: updatedCustomCosts, totalCost: newTotalCost, paymentStatus: newPaymentStatus } : p));
      setEditingChargeId(null);
      showNotification('Biaya tambahan berhasil diperbarui.');
    } catch (err) {
      console.error('Gagal update biaya tambahan:', err);
      showNotification('Gagal memperbarui biaya tambahan.');
    }
  };

  // ── derived data ─────────────────────────────────────────────────────────

  const clientProjects = projects
    .filter(p => p.clientId === client.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(p => projectOverrides[p.id] ? { ...p, ...projectOverrides[p.id] } : p);

  const clientTransactions = transactions
    .filter(t => clientProjects.some(p => p.id === t.projectId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalProjects = clientProjects.length;
  const totalProjectValue = clientProjects.reduce((s, p) => s + p.totalCost, 0);
  const totalPaid = clientProjects.reduce((s, p) => s + p.amountPaid, 0);
  const totalDue = totalProjectValue - totalPaid;

  // ── avatar initials ───────────────────────────────────────────────────────

  const initials = client.name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  // ── payment status badge ──────────────────────────────────────────────────

  const getStatusBadge = (status: PaymentStatus | null) => {
    switch (status) {
      case PaymentStatus.LUNAS:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            {customizeUiText('status.client.paid', 'Lunas', uiTextOverrides)}
          </span>
        );
      case PaymentStatus.DP_TERBAYAR:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
            {customizeUiText('status.client.deposit', 'DP Terbayar', uiTextOverrides)}
          </span>
        );
      case PaymentStatus.BELUM_BAYAR:
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-700 text-[10px] font-bold border border-red-200 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            {customizeUiText('status.client.unpaid', 'Belum Bayar', uiTextOverrides)}
          </span>
        );
    }
  };

  // ── tab config ────────────────────────────────────────────────────────────

  const tabs: { key: 'info' | 'events' | 'payments'; label: string; icon: React.ReactNode }[] = [
    { key: 'info', label: customizeUiText('client.detail.tab.info', 'Informasi', uiTextOverrides), icon: <UsersIcon className="w-4 h-4" /> },
    { key: 'events', label: `${customizeUiText('client.detail.tab.events', 'Acara Pernikahan', uiTextOverrides)} (${totalProjects})`, icon: <FolderKanbanIcon className="w-4 h-4" /> },
    { key: 'payments', label: customizeUiText('client.detail.tab.payments', 'Pembayaran & Transaksi', uiTextOverrides), icon: <HistoryIcon className="w-4 h-4" /> },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full -mt-1">

      {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden mb-5 shadow-lg shadow-blue-500/20 bg-cover bg-center"
        style={{ backgroundImage: `url(${profile.publicPageConfig?.backgroundImages?.clientDetail || '/assets/images/backgrounds/detail-pengantin-4.jpg'})` }}
      >
        {/* Dark overlay to ensure text readability */}
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />

        {/* decorative rings */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative flex flex-col items-center gap-4 p-3.5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
          {/* Avatar */}
          <div className="w-24 h-24 sm:w-48 sm:h-48 rounded-2xl overflow-hidden bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-inner border border-white/30">
            {client.avatarUrl ? (
              <img src={client.avatarUrl} alt={`${client.name} avatar`} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-black text-base sm:text-2xl tracking-tight select-none">{initials}</span>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
            <div className="w-full">
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-blue-100/80 mb-0.5">{customizeUiText('client.detail.title', 'Detail Pengantin', uiTextOverrides)}</p>
              <h2 className="text-base sm:text-2xl font-black text-white leading-tight break-words">{client.name}</h2>
              <div className="mt-1 flex flex-wrap justify-center gap-1.5 sm:justify-start sm:gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white/15 text-white text-[9px] sm:text-[10px] font-semibold border border-white/20">
                  Terdaftar {new Date(client.since).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {totalProjects > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white/15 text-white text-[9px] sm:text-[10px] font-semibold border border-white/20">
                    {totalProjects} Acara
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => onEditClient(client)}
                className="h-7 sm:h-9 px-2 inline-flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl bg-[#5D87FF]/30 hover:bg-[#5D87FF]/45 border border-blue-200/40 text-blue-100 text-[9px] sm:text-xs font-semibold whitespace-nowrap transition-all active:scale-90"
                title={customizeUiText('client.detail.action.edit', 'Edit Pengantin', uiTextOverrides)}
              >
                <PencilIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{customizeUiText('client.detail.action.edit', 'Edit Pengantin', uiTextOverrides)}</span>
              </button>
              <button
                onClick={() => onSharePortal(client)}
                className="h-7 sm:h-9 px-2 inline-flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl bg-emerald-600 border border-emerald-700 text-white text-[9px] sm:text-xs font-semibold whitespace-nowrap transition-all active:scale-90"
                title={customizeUiText('client.detail.action.share', 'Bagikan Portal', uiTextOverrides)}
              >
                <Share2Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{customizeUiText('client.detail.action.share', 'Bagikan Portal', uiTextOverrides)}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ── TAB BAR ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 p-1 bg-brand-bg rounded-xl border border-brand-border mb-4">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 inline-flex items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === tab.key
                ? 'bg-brand-surface text-brand-accent shadow-sm border border-brand-border'
                : 'text-brand-text-secondary hover:text-brand-text-primary'
              }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── SCROLLABLE CONTENT ──────────────────────────────────────────── */}
      <div className="pb-4">

        {/* ════════════════════════════════════════════════════════════════
            TAB: INFO
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'info' && (
          <div className="space-y-5 animate-fade-in">

            {/* Contact & identity card */}
            <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-brand-border bg-brand-bg/60">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-text-secondary">{customizeUiText('client.detail.section.contact', 'Kontak & Identitas', uiTextOverrides)}</p>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <InfoField label="Email">
                  <span className="break-all">{client.email || '-'}</span>
                </InfoField>
                <InfoField label="Telepon">
                  <a
                    href={`https://wa.me/${cleanPhoneNumber(client.whatsapp || client.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-accent hover:underline"
                  >
                    {client.whatsapp || client.phone || '-'}
                  </a>
                </InfoField>
                <InfoField label="Instagram">
                  {client.instagram
                    ? <a href={`https://instagram.com/${client.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">{client.instagram}</a>
                    : '-'
                  }
                </InfoField>
                {client.address && (
                  <div className="sm:col-span-2">
                    <InfoField label="Alamat Lengkap">{client.address}</InfoField>
                  </div>
                )}
                {client.homeAddress && (
                  <div className="sm:col-span-2">
                    <InfoField label="📦 Alamat Rumah (Pengiriman Cetakan)">
                      {client.homeAddress}
                    </InfoField>
                  </div>
                )}
              </div>
            </div>

            {/* Financial summary cards */}
            <div>
              <SectionTitle sub="Total Package, pembayaran, dan sisa pembayaran pengantin ini">
                {customizeUiText('client.detail.section.finance', 'Ringkasan Keuangan', uiTextOverrides)}
              </SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'Jumlah Acara',
                    value: totalProjects.toString(),
                    accent: 'from-indigo-50 to-white border-indigo-100',
                    text: 'text-indigo-700',
                  },
                  {
                    label: 'Total Package',
                    value: formatCurrency(totalProjectValue),
                    accent: 'from-blue-50 to-white border-blue-100',
                    text: 'text-blue-700',
                  },
                  {
                    label: 'Terbayar',
                    value: formatCurrency(totalPaid),
                    accent: 'from-emerald-50 to-white border-emerald-100',
                    text: 'text-emerald-700',
                  },
                  {
                    label: 'Sisa Pembayaran',
                    value: formatCurrency(totalDue),
                    accent: totalDue > 0 ? 'from-red-50 to-white border-red-100' : 'from-emerald-50 to-white border-emerald-100',
                    text: totalDue > 0 ? 'text-red-700' : 'text-emerald-700',
                  },
                ].map(card => (
                  <div
                    key={card.label}
                    className={`bg-gradient-to-br ${card.accent} border rounded-2xl p-4 shadow-sm`}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-secondary">{card.label}</p>
                      <p className={`text-sm font-black ${card.text} truncate mt-1`}>{card.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Portal share button */}
            <div className="flex justify-end">
              <button
                onClick={() => onSharePortal(client)}
                className="w-auto max-w-full min-h-[38px] sm:min-h-[44px] button-secondary inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm"
              >
                <Share2Icon className="w-4 h-4" />
                Bagikan Portal Pengantin
              </button>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <Suspense fallback={<div className="py-8 text-center text-sm text-brand-text-secondary">Memuat pengelolaan acara...</div>}>
            <ProjectManagement
              projects={clientProjects}
              setProjects={setProjects}
              clients={[client]}
              packages={packages}
              teamMembers={teamMembers}
              teamProjectPayments={teamProjectPayments}
              setTeamProjectPayments={setTeamProjectPayments}
              transactions={transactions}
              setTransactions={setTransactions}
              initialAction={null}
              setInitialAction={() => undefined}
              profile={profile}
              showNotification={showNotification}
              cards={cards}
              setCards={setCards}
              pockets={pockets}
              setPockets={setPockets}
              totals={{
                projects: clientProjects.length,
                activeProjects: clientProjects.filter(project => !/selesai|dibatalkan/i.test(project.status)).length,
                clients: 1,
                activeClients: 1,
                leads: 0,
                discussionLeads: 0,
                followUpLeads: 0,
                teamMembers: teamMembers.length,
                transactions: clientTransactions.length,
                revenue: 0,
                expense: 0,
              }}
              handleNavigation={handleNavigation}
              embeddedForClient
            />
          </Suspense>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: PAYMENTS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'payments' && (
          <div className="space-y-5 animate-fade-in">
            {clientProjects.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-semibold text-brand-text-light">Belum ada acara pernikahan</p>
                <p className="text-xs text-brand-text-secondary mt-1">Tambahkan acara pernikahan untuk pengantin ini.</p>
              </div>
            )}


            {clientProjects.map((p, projectIndex) => {
              const transactionsForProject = clientTransactions.filter(t => t.projectId === p.id);
              const remainingBalance = p.totalCost - p.amountPaid;
              const displayProjectName = (p.projectName || '').replace(/^Acara Pernikahan\s+/i, '').trim();
              const pkg = packages.find(pkg => pkg.id === p.packageId || (p.packageName && pkg.name.trim().toLowerCase() === p.packageName.trim().toLowerCase())) || null;
              const selectedDurationOption = pkg?.durationOptions?.find(option => option.label === p.durationSelection);
              const teamComposition = selectedDurationOption?.photographers || pkg?.photographers;
              const packageDescriptionItems = [...(pkg?.digitalItems || [])];
              if (teamComposition?.trim()) packageDescriptionItems.unshift(`Jumlah Tim: ${teamComposition}`);
              const selectedAddOns = (p.addOns || []).filter(a => a && (a.name || a.id));
              const selectedPackageIds = new Set(packages.map(packageItem => packageItem.id));
              const additionalPackages = p.additionalPackages?.length
                ? p.additionalPackages
                : selectedAddOns.filter(item => item.id && selectedPackageIds.has(item.id) && item.id !== p.packageId);
              const additionalPackageIds = new Set(additionalPackages.map(item => item.id));
              const regularAddOns = selectedAddOns.filter(item =>
                (!item.id || !selectedPackageIds.has(item.id)) && !additionalPackageIds.has(item.id),
              );

              return (
                <div key={p.id} className="relative">
                  {/* Project number connector line (skip last) */}
                  {projectIndex < clientProjects.length - 1 && (
                    <div className="absolute left-5 top-full w-px h-8 bg-gradient-to-b from-brand-border to-transparent" />
                  )}

                  {/* ── PROJECT HEADER ───────────────────────────────── */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-200 mt-0.5">
                        <span className="text-white font-black text-xs">#{projectIndex + 1}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-brand-text-light leading-tight">
                          {displayProjectName || p.projectName}
                        </h4>
                        <p className="text-[10px] text-brand-text-secondary mt-0.5">
                          PRJ-{p.id.slice(-6).toUpperCase()} &nbsp;•&nbsp;
                          {p.date ? new Date(p.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Belum ditentukan'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      {getStatusBadge(p.paymentStatus)}
                      <button
                        type="button"
                        onClick={() => {
                          const shouldOpen = !transactionFormOpen[p.id];
                          setTransactionFormOpen(prev => ({ ...prev, [p.id]: shouldOpen }));
                          setCollapsedStates(prev => ({
                            ...prev,
                            [p.id]: {
                              payment: shouldOpen && remainingBalance > 0,
                              charge: shouldOpen && remainingBalance <= 0,
                            },
                          }));
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#5D87FF] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#4871e3]"
                        aria-expanded={!!transactionFormOpen[p.id]}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {transactionFormOpen[p.id] ? 'Tutup form' : 'Tambah transaksi'}
                      </button>
                    </div>
                  </div>

                  {/* ══════════════════════════════════════════════════════
                      INPUT SECTION — CATAT PEMBAYARAN & BIAYA TAMBAHAN
                      (ditampilkan di atas detail acara agar mudah diakses)
                  ══════════════════════════════════════════════════════ */}
                  {transactionFormOpen[p.id] && <div className="mb-4 bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden p-4 space-y-6">

                    {/* ── CATAT PEMBAYARAN MASUK (PELUNASAN / DP) ──────── */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-950">Catat Pembayaran Masuk</h4>
                        <span className="text-xs font-semibold bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md border border-gray-200">Sisa Pembayaran: {formatCurrency(remainingBalance)}</span>
                      </div>
                      
                      {remainingBalance > 0 && (
                        <div className="mb-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleNewPaymentChange(p.id, 'amount', String(remainingBalance))}
                            className="text-[10px] font-bold text-gray-700 underline underline-offset-2 hover:text-gray-950"
                            title="Isi otomatis dengan seluruh sisa pembayaran"
                          >
                            Isi otomatis sisa pembayaran
                          </button>
                        </div>
                      )}
                      {remainingBalance <= 0 ? (
                        <div className="px-4 py-3 flex items-center gap-2 bg-gray-50 rounded-lg text-gray-800 border border-gray-200">
                          <CheckIcon className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-semibold">Semua pembayaran telah lunas — tidak ada sisa pembayaran.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                          <div className="sm:col-span-6 space-y-1.5">
                            <label htmlFor={`amount-${p.id}`} className="text-xs font-semibold text-brand-text-light flex items-center justify-between">
                              <span>Jumlah Pembayaran (Rp)</span>
                              <span className="text-[10px] font-normal text-brand-text-secondary">Maks: {formatCurrency(remainingBalance)}</span>
                            </label>
                            <RupiahInput
                              id={`amount-${p.id}`}
                              value={newPayments[p.id]?.amount || ''}
                              onChange={(raw) => handleNewPaymentChange(p.id, 'amount', raw)}
                              max={remainingBalance}
                              className="w-full h-[42px] px-3.5 text-xs font-semibold bg-white border border-gray-300 rounded-xl text-gray-950 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-400"
                              placeholder="Masukkan nominal bayar..."
                            />
                          </div>
                          <div className="sm:col-span-4 space-y-1.5">
                            <label htmlFor={`dest-${p.id}`} className="text-xs font-semibold text-brand-text-light">
                              Tujuan Rekening / Kas
                            </label>
                            <select
                              id={`dest-${p.id}`}
                              value={newPayments[p.id]?.destinationCardId || ''}
                              onChange={e => handleNewPaymentChange(p.id, 'destinationCardId', e.target.value)}
                              className="w-full h-[42px] px-3 text-xs font-medium bg-white border border-gray-300 rounded-xl text-gray-950 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-400 cursor-pointer"
                            >
                              <option value="">Pilih Tujuan Rekening / Kas...</option>
                              {cards.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.bankName} {c.lastFourDigits !== 'CASH' ? `**** ${c.lastFourDigits}` : '(Tunai)'}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <button
                              onClick={() => handleNewPaymentSubmit(p.id)}
                              className="w-full h-[42px] bg-gray-950 hover:bg-gray-800 text-white !py-0 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
                            >
                              <CheckIcon className="w-3.5 h-3.5" />
                              Catat
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <hr className="border-gray-200" />

                    {/* ── INPUT BIAYA TAMBAHAN / BONUS ─────────────────── */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-bold text-gray-950">Tambah Biaya Tambahan / Package</h4>
                        <button
                          type="button"
                          onClick={() => setShowManageTemplates(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-950 bg-white hover:bg-gray-100 border border-gray-300 px-2.5 py-1.5 rounded-xl transition-all active:scale-95"
                          title="Kelola template biaya tambahan & bonus otomatis"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>Kelola Template</span>
                        </button>
                      </div>

                      <div className="space-y-4">
                        {/* Package Tambahan quick-pick */}
                        <div>
                          <h5 className="text-xs font-bold text-gray-950 mb-1.5">Pilih Package Tambahan</h5>
                          <div className="flex gap-2">
                            <select
                              id={`charge-package-${p.id}`}
                              value={selectedAddPkg[p.id] || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setSelectedAddPkg(prev => ({ ...prev, [p.id]: val }));
                              }}
                              className="flex-1 h-[42px] px-3 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-950 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-400 cursor-pointer"
                            >
                              <option value="">Pilih Package Tambahan...</option>
                              {packagesByRegion.map(([region, items]) => (
                                <optgroup key={region} label={region}>
                                  {items.map(pkgItem => (
                                    <option key={pkgItem.id} value={pkgItem.id}>
                                      {pkgItem.name} — {formatCurrency(pkgItem.price)}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const val = selectedAddPkg[p.id];
                                if (!val) return;
                                handleAddAdditionalPackage(p.id, val);
                                setSelectedAddPkg(prev => ({ ...prev, [p.id]: '' }));
                              }}
                              disabled={!selectedAddPkg[p.id]}
                              className="h-[42px] px-4 bg-gray-950 hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 text-white flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 whitespace-nowrap"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Pilih
                            </button>
                          </div>
                        </div>

                        {/* Template quick-pick */}
                        <div>
                          <select
                            id={`charge-template-${p.id}`}
                            defaultValue=""
                            onChange={e => {
                              const val = e.target.value;
                              if (!val) return;
                              const t = templates.find(item => item.name === val);
                              if (t) {
                                handleApplyTemplate(p.id, { name: t.name, defaultAmount: t.defaultAmount });
                              }
                              e.target.value = '';
                            }}
                            className="w-full h-[42px] px-3 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-950 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-400 cursor-pointer"
                          >
                            <option value="">Pilih dari Template Biaya Tambahan...</option>
                            {templateCategories.map(([category, items]) => (
                              <optgroup key={category} label={category}>
                                {items.map(t => (
                                  <option key={`${category}-${t.name}`} value={t.name}>
                                    {t.name} — {t.defaultAmount === 0 ? 'Gratis (Rp 0)' : formatCurrency(t.defaultAmount)}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        {/* Manual input */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                          <div className="sm:col-span-6 space-y-1.5">
                            <label htmlFor={`charge-name-${p.id}`} className="text-xs font-semibold text-brand-text-light">
                              Nama Biaya Tambahan Manual
                            </label>
                            <input
                              type="text"
                              id={`charge-name-${p.id}`}
                              value={newCharge[p.id]?.name || ''}
                              onChange={e => handleNewChargeChange(p.id, 'name', e.target.value)}
                              className="w-full h-[42px] px-3.5 text-xs bg-brand-bg border border-brand-border rounded-xl text-brand-text-primary focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                              placeholder="Contoh: Overtime Kru 1 Jam / Drone Aerial / Bonus"
                            />
                          </div>
                          <div className="sm:col-span-4 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label htmlFor={`charge-amount-${p.id}`} className="text-xs font-semibold text-brand-text-light">
                                Jumlah Biaya (Rp)
                              </label>
                              <button
                                type="button"
                                onClick={() => handleSetZeroAmount(p.id)}
                                className="text-[10px] font-bold text-gray-800 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-0.5 rounded transition-all active:scale-95"
                                title="Set sebagai Gratis / Bonus (Rp 0)"
                              >
                                Set Rp 0 (Gratis)
                              </button>
                            </div>
                            <RupiahInput
                              id={`charge-amount-${p.id}`}
                              value={newCharge[p.id]?.amount ?? ''}
                              onChange={raw => handleNewChargeChange(p.id, 'amount', raw)}
                              className="w-full h-[42px] px-3.5 text-xs font-semibold bg-white border border-gray-300 rounded-xl text-gray-950 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-400"
                              placeholder="0"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <button
                              type="button"
                              onClick={() => handleNewChargeSubmit(p.id)}
                              className="w-full h-[42px] bg-gray-950 hover:bg-gray-800 text-white !py-0 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Tambah
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>}
                  {/* END INPUT SECTION */}

                  {/* ── PROJECT CARD ──────────────────────────────────── */}
                  <div className="bg-brand-surface rounded-2xl border border-brand-border shadow-sm overflow-hidden">

                    <div className="p-4 sm:p-5 space-y-5">

                      {/* Cost breakdown */}
                      <details className="rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-blue-600 px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                          <span>Rincian biaya</span>
                          <span className="flex items-center gap-2">
                            {formatCurrency(p.totalCost)}
                            <ChevronDown className="h-4 w-4 text-white" />
                          </span>
                        </summary>
                        <div className="border-t border-slate-200 px-4 py-3 space-y-2.5">
                          {/* Base package */}
                          <div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-brand-text-secondary font-medium">
                                Package Utama {p.packageName || pkg?.name ? (
                                  <span className="font-bold text-brand-text-light">({p.packageName || pkg?.name})</span>
                                ) : ''}
                              </span>
                              <span className="font-bold text-brand-text-light">
                                {formatCurrency(
                                  p.totalCost
                                  - (p.customCosts?.reduce((s, c) => s + c.amount, 0) || 0)
                                  - regularAddOns.reduce((s, a) => s + (Number(a.price) || 0), 0)
                                  - additionalPackages.reduce((s, packageItem) => s + (Number(packageItem.price) || 0), 0)
                                  - (Number(p.transportCost) || 0)
                                )}
                              </span>
                            </div>

                            {((p as any).durationSelection || '').trim() && (
                              <p className="text-[11px] text-brand-accent font-medium mt-1 pl-2.5 italic">
                                {(p as any).durationSelection}
                              </p>
                            )}
                            {packageDescriptionItems.length > 0 && (
                              <ul className="mt-1.5 pl-2.5 space-y-0.5 border-l-2 border-brand-accent/30 my-1">
                                {packageDescriptionItems.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5 text-[10px] text-brand-text-secondary">
                                    <span className="text-brand-accent font-bold mt-px">·</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Additional packages */}
                          {additionalPackages.map((item, index) => {
                            const additionalPackage = packages.find(packageItem => packageItem.id === item.id);
                            const deliverables = [
                              ...(additionalPackage?.digitalItems || []),
                              ...(additionalPackage?.physicalItems || []).map(physicalItem => physicalItem.name),
                            ].filter(Boolean);

                            return (
                              <div key={item.id || index} className="group/addpkg relative">
                                <div className="flex justify-between items-center text-xs pr-6">
                                  <span className="text-brand-text-secondary font-medium">
                                    Package Tambahan <span className="font-bold text-brand-text-light">({item.name || additionalPackage?.name})</span>
                                  </span>
                                  <span className="font-semibold text-brand-text-light">{formatCurrency(Number(item.price || 0))}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDeleteAdditionalPackage(p.id, index);
                                  }}
                                  className="absolute top-0 right-0 text-red-500 opacity-0 group-hover/addpkg:opacity-100 transition-opacity p-0.5 hover:bg-red-50 rounded"
                                  title="Hapus Package Tambahan"
                                >
                                  <Trash2Icon className="w-3.5 h-3.5" />
                                </button>
                                {deliverables.length > 0 && (
                                  <ul className="mt-1.5 pl-2.5 space-y-0.5 border-l-2 border-brand-accent/30 my-1">
                                    {deliverables.map((deliverable, deliverableIndex) => (
                                      <li key={`${item.id}-${deliverableIndex}`} className="flex items-start gap-1.5 text-[10px] text-brand-text-secondary">
                                        <span className="text-brand-accent font-bold mt-px">·</span>
                                        <span>{deliverable}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            );
                          })}

                          {/* Add-ons */}
                          {regularAddOns.map((a, idx) => (
                            <div key={a.id || a.name || idx} className="flex justify-between items-center text-xs">
                              <span className="text-brand-text-secondary">+ {a.name} <span className="opacity-60">(Add-on)</span></span>
                              <span className="font-semibold text-brand-text-light">{formatCurrency(Number(a.price || 0))}</span>
                            </div>
                          ))}

                          {/* Transport */}
                          {p.transportCost && Number(p.transportCost) > 0 && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-brand-text-secondary">+ Biaya Transport</span>
                              <span className="font-semibold text-brand-text-light">{formatCurrency(Number(p.transportCost))}</span>
                            </div>
                          )}

                          {/* Custom costs */}
                          {p.customCosts && p.customCosts.length > 0 && (
                            <div className="pt-1 space-y-1.5 border-t border-slate-200">
                              {p.customCosts.map(c => {
                                const isEditing = editingChargeId === c.id;
                                const isZero = Number(c.amount) === 0;
                                return (
                                  <div key={c.id} className={`rounded-xl px-3 py-2 border transition-all group/charge ${isZero ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50 border-amber-100'}`}>
                                    {isEditing ? (
                                      <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                          type="text"
                                          value={editChargeData.name}
                                          onChange={e => setEditChargeData({ ...editChargeData, name: e.target.value })}
                                          className="flex-grow p-1.5 text-xs bg-white border border-brand-border rounded-lg text-brand-text-light focus:border-brand-accent outline-none"
                                          placeholder="Nama biaya..."
                                        />
                                        <div className="flex items-center gap-1.5">
                                          <RupiahInput
                                            value={editChargeData.amount}
                                            onChange={val => setEditChargeData({ ...editChargeData, amount: val })}
                                            className="w-full sm:w-28 p-1.5 text-xs bg-white border border-brand-border rounded-lg text-brand-text-light focus:border-brand-accent outline-none"
                                            placeholder="0"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => setEditChargeData({ ...editChargeData, amount: '0' })}
                                            className="px-2 py-1 text-[10px] font-bold rounded bg-white hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 border border-slate-200 whitespace-nowrap"
                                            title="Ubah ke Rp 0"
                                          >
                                            Rp 0
                                          </button>
                                        </div>
                                        <div className="flex gap-1">
                                          <button onClick={() => handleSaveEditCharge(p.id)} className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-all" title="Simpan">
                                            <CheckIcon className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => setEditingChargeId(null)} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all" title="Batal">
                                            <XIcon className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                          <span className={`font-semibold ${isZero ? 'text-emerald-800' : 'text-amber-700'} truncate`}>
                                            + {c.description}
                                          </span>
                                          {isZero && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                                              Gratis / Rp 0
                                            </span>
                                          )}
                                          <div className="flex items-center gap-0.5 opacity-0 group-hover/charge:opacity-100 transition-all flex-shrink-0">
                                            <button onClick={() => handleStartEditCharge(c)} className="p-1 text-blue-500 hover:text-blue-700 active:scale-90 transition-all" title="Edit">
                                              <PencilIcon className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => handleDeleteCharge(p.id, c.id)} className="p-1 text-red-400 hover:text-red-600 active:scale-90 transition-all" title="Hapus">
                                              <Trash2Icon className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                        <span className={`font-bold flex-shrink-0 ml-2 ${isZero ? 'text-emerald-700 font-mono' : 'text-amber-700'}`}>
                                          {isZero ? 'Rp 0' : formatCurrency(c.amount)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        </div>
                      </details>

                      {/* Payment summary */}
                      <div className="grid grid-cols-3 gap-2">
                        <FinancePill label="Total" value={formatCurrency(p.totalCost)} color="neutral" />
                        <FinancePill label="Terbayar" value={formatCurrency(p.amountPaid)} color="green" />
                        <FinancePill label="Sisa" value={formatCurrency(remainingBalance)} color={remainingBalance > 0 ? 'red' : 'green'} />
                      </div>

                      {/* Action buttons */}
                      <div className="client-detail-action-group flex items-center justify-end gap-2 pt-1">
                        {p.dpProofUrl && (
                          <a
                            href={p.dpProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-auto max-w-full button-secondary !py-2 !px-3 text-xs inline-flex items-center justify-center gap-1.5"
                          >
                            <CreditCardIcon className="w-3.5 h-3.5 text-brand-accent" />
                            Bukti DP
                          </a>
                        )}
                        <button
                          onClick={() => onViewInvoice(p)}
                          className="w-auto max-w-full button-primary !py-2 !px-3 text-xs inline-flex items-center justify-center gap-1.5"
                        >
                          <FileTextIcon className="w-3.5 h-3.5" />
                          Invoice PDF
                        </button>
                        <button
                          onClick={() => { if (window.confirm('Apakah Anda yakin ingin menghapus acara ini?')) onDeleteProject(p.id); }}
                          className="w-9 !py-2 rounded-xl border border-[#EAEFF4] text-[#5A6A85] hover:text-[#FA896B] hover:border-[#FA896B]/20 hover:bg-[#FA896B]/10 transition-all active:scale-95 flex items-center justify-center flex-shrink-0"
                          title="Hapus Acara"
                        >
                          <Trash2Icon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── TRANSACTION HISTORY ───────────────────────────── */}
                  <div className="mt-4">
                    <SectionTitle sub="Riwayat pembayaran dan biaya untuk acara ini">
                      {customizeUiText('client.detail.section.transactions', 'Riwayat Transaksi', uiTextOverrides)}
                    </SectionTitle>

                    {/* Mobile transaction cards */}
                    <div className="md:hidden space-y-2">
                      {transactionsForProject.length > 0 ? transactionsForProject.map(t => {
                        const isTransport =
                          (t.category?.toLowerCase().includes('transport')) ||
                          (t.description?.toLowerCase().includes('transport'));
                        return (
                          <div key={t.id} className="rounded-xl bg-brand-surface border border-brand-border p-3 shadow-sm flex items-start justify-between active:scale-[0.98] transition-transform">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <p className="text-xs font-semibold text-brand-text-light truncate">{normalizeTerminology(t.description)}</p>
                                {isTransport && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Transport</span>}
                              </div>
                              <p className="text-[10px] text-brand-text-secondary">{new Date(t.date).toLocaleDateString('id-ID')}</p>
                              <p className="text-[10px] text-brand-text-secondary opacity-70 mt-0.5">{normalizeTerminology(t.category || '-')}</p>
                            </div>
                            <div className="text-right ml-3 flex-shrink-0">
                              <p className={`text-sm font-black mb-1.5 ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-red-500'}`}>
                                {formatCurrency(t.amount)}
                              </p>
                              <button onClick={() => onViewReceipt(t)} className="button-secondary !text-[10px] !px-2.5 !py-1 active:scale-95">Bukti</button>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="text-center py-8 bg-brand-surface rounded-2xl border border-brand-border border-dashed">
                          <p className="text-xs text-brand-text-secondary">Belum ada transaksi untuk acara ini.</p>
                        </div>
                      )}
                    </div>

                    {/* Desktop transaction table */}
                    <div className="hidden md:block rounded-2xl border border-brand-border overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-brand-bg">
                            <th className="px-3 py-3 text-center font-semibold text-brand-text-secondary w-10 text-xs">#</th>
                            <th className="px-3 py-3 text-left  font-semibold text-brand-text-secondary text-xs">Tanggal</th>
                            <th className="px-3 py-3 text-left  font-semibold text-brand-text-secondary text-xs">Deskripsi</th>
                            <th className="px-3 py-3 text-left  font-semibold text-brand-text-secondary text-xs">Kategori</th>
                            <th className="px-3 py-3 text-right font-semibold text-brand-text-secondary text-xs">Jumlah</th>
                            <th className="px-3 py-3 text-center font-semibold text-brand-text-secondary text-xs w-12">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border">
                          {transactionsForProject.length > 0 ? transactionsForProject.map((t, index) => {
                            const isTransport =
                              (t.category?.toLowerCase().includes('transport')) ||
                              (t.description?.toLowerCase().includes('transport'));
                            return (
                              <tr key={t.id} className="hover:bg-brand-bg/60 transition-colors">
                                <td className="px-3 py-3 text-center text-xs text-brand-text-secondary font-medium">{index + 1}</td>
                                <td className="px-3 py-3 text-xs text-brand-text-secondary whitespace-nowrap">
                                  {new Date(t.date).toLocaleDateString('id-ID')}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-brand-text-light">{normalizeTerminology(t.description)}</span>
                                    {isTransport && (
                                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">Transport</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-[10px] text-brand-text-secondary">{normalizeTerminology(t.category || '-')}</td>
                                <td className={`px-3 py-3 text-right text-xs font-bold ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {formatCurrency(t.amount)}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <button
                                    onClick={() => onViewReceipt(t)}
                                    className="p-1.5 rounded-lg text-brand-text-secondary hover:text-brand-accent hover:bg-blue-50 transition-all"
                                    title="Lihat Bukti"
                                  >
                                    <FileTextIcon className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          }) : (
                            <tr>
                              <td colSpan={6} className="text-center py-8 text-xs text-brand-text-secondary">
                                Belum ada transaksi untuk acara ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {showManageTemplates && (
          <ManageTemplatesModal onClose={() => setShowManageTemplates(false)} />
        )}
      </div>
    </div>
  );
};

export default ClientDetailModal;