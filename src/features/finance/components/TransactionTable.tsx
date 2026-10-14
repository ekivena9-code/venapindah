import React, { useState, useMemo } from 'react';
import { Search, Plus, FileText, Eye, Pencil, Trash2, X } from 'lucide-react';
import { Transaction, TransactionType } from '../../../types';
import { formatCurrency } from '../../../utils/currency';

export interface TransactionTableProps {
    transactions: Transaction[];
    onEdit?: (transaction: Transaction) => void;
    onDelete?: (transactionId: string) => void;
    onView?: (transaction: Transaction) => void;
    onAdd?: () => void;
    title?: string;
    subtitle?: string;
    showAddButton?: boolean;
    showSearch?: boolean;
    emptyMessage?: string;
    compact?: boolean;
}

const TransactionTable: React.FC<TransactionTableProps> = ({
    transactions,
    onEdit,
    onDelete,
    onView,
    onAdd,
    title,
    subtitle,
    showAddButton = false,
    showSearch = false,
    emptyMessage = 'Tidak ada transaksi pada periode ini.',
    compact = false,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDoc, setSelectedDoc] = useState<Transaction | null>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const hasActions = Boolean(onEdit || onDelete || onView);

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return transactions;
        const q = searchQuery.toLowerCase();
        return transactions.filter(t =>
            (t.description || '').toLowerCase().includes(q) ||
            (t.category || '').toLowerCase().includes(q) ||
            (t.method || '').toLowerCase().includes(q) ||
            (t.id || '').toLowerCase().includes(q)
        );
    }, [transactions, searchQuery]);

    const handleViewClick = (t: Transaction) => {
        if (onView) {
            onView(t);
        } else {
            setSelectedDoc(t);
        }
    };

    const confirmDelete = (id: string) => {
        if (onDelete) {
            onDelete(id);
        }
        setDeleteTargetId(null);
    };

    return (
        <div className="w-full space-y-3">
            {/* Header / Search bar if title, search, or add is active */}
            {(title || showSearch || (showAddButton && onAdd)) && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                    <div>
                        {title && <h4 className="text-base font-bold text-brand-text-primary">{title}</h4>}
                        {subtitle && <p className="text-xs text-brand-text-secondary">{subtitle}</p>}
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        {showSearch && (
                            <div className="relative w-full sm:w-64 lg:w-72">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cari transaksi..."
                                    className="h-11 w-full rounded-xl border border-brand-border bg-brand-surface !pl-10 !pr-3 text-sm text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
                                />
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-secondary/60" />
                            </div>
                        )}
                        {showAddButton && onAdd && (
                            <button
                                type="button"
                                onClick={onAdd}
                                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-accent/90"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Tambah Transaksi</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 bg-brand-surface rounded-2xl border border-dashed border-brand-border text-center">
                    <FileText className="w-10 h-10 text-brand-text-secondary/30 mb-2" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-brand-text-secondary">{emptyMessage}</p>
                    {onAdd && (
                        <button
                            type="button"
                            onClick={onAdd}
                            className="mt-3 px-3 py-1.5 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah Transaksi Baru</span>
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-brand-border bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
                        {filtered.map((t, idx) => {
                            const isIncome = t.type === TransactionType.INCOME;
                            return (
                                <div key={`${t.id || 'no-id'}-${idx}`} className="p-3 hover:bg-brand-bg/40 transition-colors">
                                    <div className="flex justify-between items-start gap-2 mb-1.5">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                    isIncome ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                                }`}>
                                                    {isIncome ? 'Pemasukan' : 'Pengeluaran'}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded-full bg-brand-bg text-brand-text-secondary text-[10px] font-medium border border-brand-border">
                                                    {t.category}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-brand-text-primary line-clamp-1">{t.description}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`text-xs font-black ${isIncome ? 'text-[#166534]' : 'text-[#DC2626]'}`}>
                                                {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                                            </p>
                                            <span className="text-[10px] text-brand-text-secondary block">
                                                {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 text-[11px] text-brand-text-secondary">
                                        <span className="font-mono text-[9px] text-brand-text-secondary/70">{t.id ? t.id.slice(0, 8).toUpperCase() : '—'}</span>
                                        {hasActions && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewClick(t)}
                                                    className="flex h-10 w-10 min-h-10 min-w-10 items-center justify-center rounded-lg text-brand-text-secondary transition-colors hover:bg-blue-500/10 hover:text-blue-500"
                                                    title="Lihat rincian"
                                                    aria-label="Lihat rincian transaksi"
                                                >
                                                    <Eye className="h-5 w-5" />
                                                </button>
                                                {onEdit && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onEdit(t)}
                                                        className="flex h-10 w-10 min-h-10 min-w-10 items-center justify-center rounded-lg text-brand-text-secondary transition-colors hover:bg-amber-500/10 hover:text-amber-500"
                                                        title="Edit transaksi"
                                                        aria-label="Edit transaksi"
                                                    >
                                                        <Pencil className="h-5 w-5" />
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteTargetId(t.id)}
                                                        className="flex h-10 w-10 min-h-10 min-w-10 items-center justify-center rounded-lg text-brand-text-secondary transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                                                        title="Hapus transaksi"
                                                        aria-label="Hapus transaksi"
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-brand-border bg-brand-surface shadow-xs">
                        <table className="w-full text-xs lg:text-sm text-left">
                            <thead className="text-[10px] lg:text-xs uppercase bg-brand-bg/70 text-brand-text-secondary border-b border-brand-border">
                                <tr>
                                    <th className={`${compact ? 'p-2' : 'p-3 lg:p-4'} font-bold tracking-wider text-center w-10`}>No</th>
                                    <th className={`${compact ? 'p-2' : 'p-3 lg:p-4'} font-bold tracking-wider`}>Tanggal</th>
                                    <th className={`${compact ? 'p-2' : 'p-3 lg:p-4'} font-bold tracking-wider`}>Deskripsi & ID</th>
                                    <th className={`${compact ? 'p-2' : 'p-3 lg:p-4'} font-bold tracking-wider`}>Kategori</th>
                                    <th className={`${compact ? 'p-2' : 'p-3 lg:p-4'} font-bold tracking-wider text-right`}>Jumlah</th>
                                    {hasActions && (
                                        <th className={`${compact ? 'p-2' : 'p-3 lg:p-4'} font-bold tracking-wider text-right w-24`}>Aksi</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-border/60">
                                {filtered.map((t, idx) => {
                                    const isIncome = t.type === TransactionType.INCOME;
                                    return (
                                        <tr key={`${t.id || 'no-id'}-${idx}`} className="hover:bg-brand-bg/40 transition-colors">
                                            <td className={`${compact ? 'p-2' : 'p-3 lg:p-4'} text-center font-bold text-brand-text-secondary`}>
                                                {idx + 1}
                                            </td>
                                            <td className={`${compact ? 'p-2' : 'p-3 lg:p-4'} text-brand-text-primary font-semibold whitespace-nowrap`}>
                                                {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className={`${compact ? 'p-2' : 'p-3 lg:p-4'}`}>
                                                <p className="font-bold text-brand-text-primary line-clamp-1">{t.description}</p>
                                                <p className="text-[9px] lg:text-[10px] text-brand-text-secondary font-mono mt-0.5">
                                                    {t.id ? t.id.slice(0, 8).toUpperCase() : 'NO-ID'}
                                                </p>
                                            </td>
                                            <td className={`${compact ? 'p-2' : 'p-3 lg:p-4'}`}>
                                                <span className="px-2 py-0.5 rounded-full bg-brand-bg text-brand-text-secondary text-[9px] lg:text-[10px] font-bold border border-brand-border">
                                                    {t.category}
                                                </span>
                                            </td>
                                            <td className={`${compact ? 'p-2' : 'p-3 lg:p-4'} text-right font-black whitespace-nowrap ${isIncome ? 'text-[#166534]' : 'text-[#DC2626]'}`}>
                                                {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                                            </td>
                                            {hasActions && (
                                                <td className={`${compact ? 'p-2' : 'p-3 lg:p-4'} text-right whitespace-nowrap`}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleViewClick(t)}
                                                            className="flex h-10 w-10 min-h-10 min-w-10 items-center justify-center rounded-lg text-brand-text-secondary transition-colors hover:bg-blue-500/10 hover:text-blue-500"
                                                            title="Lihat detail"
                                                            aria-label="Lihat detail transaksi"
                                                        >
                                                            <Eye className="h-5 w-5" />
                                                        </button>
                                                        {onEdit && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onEdit(t)}
                                                                className="flex h-10 w-10 min-h-10 min-w-10 items-center justify-center rounded-lg text-brand-text-secondary transition-colors hover:bg-amber-500/10 hover:text-amber-500"
                                                                title="Edit transaksi"
                                                                aria-label="Edit transaksi"
                                                            >
                                                                <Pencil className="h-5 w-5" />
                                                            </button>
                                                        )}
                                                        {onDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeleteTargetId(t.id)}
                                                                className="flex h-10 w-10 min-h-10 min-w-10 items-center justify-center rounded-lg text-brand-text-secondary transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                                                                title="Hapus transaksi"
                                                                aria-label="Hapus transaksi"
                                                            >
                                                                <Trash2 className="h-5 w-5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Confirmation Dialog for Delete */}
            {deleteTargetId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                    <div className="bg-brand-surface rounded-2xl p-6 max-w-sm w-full border border-brand-border shadow-xl space-y-4">
                        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-base font-bold text-brand-text-primary">Hapus Transaksi?</h3>
                            <p className="text-xs text-brand-text-secondary mt-1">
                                Transaksi ini akan dihapus permanen dari catatan keuangan. Tindakan ini tidak dapat dibatalkan.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setDeleteTargetId(null)}
                                className="flex-1 min-h-11 sm:min-h-0 py-2 rounded-xl text-xs font-semibold text-brand-text-secondary hover:bg-brand-bg border border-brand-border transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={() => confirmDelete(deleteTargetId)}
                                className="flex-1 min-h-11 sm:min-h-0 py-2 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-sm"
                            >
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Built-in Transaction Detail Modal */}
            {selectedDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                    <div className="bg-brand-surface rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto border border-brand-border shadow-xl space-y-4">
                        <div className="flex justify-between items-center border-b border-brand-border pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-brand-text-primary">Detail Transaksi</h3>
                                <p className="text-[10px] font-mono text-brand-text-secondary mt-0.5">{selectedDoc.id}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDoc(null)}
                                className="w-11 h-11 sm:w-8 sm:h-8 min-w-11 sm:min-w-0 rounded-lg flex items-center justify-center text-brand-text-secondary hover:bg-brand-bg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-3 text-xs">
                            <div className="flex justify-between py-1.5 border-b border-brand-border/50">
                                <span className="text-brand-text-secondary">Tipe</span>
                                <span className={`font-bold ${selectedDoc.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {selectedDoc.type === TransactionType.INCOME ? 'Pemasukan (+)' : 'Pengeluaran (-)'}
                                </span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-brand-border/50">
                                <span className="text-brand-text-secondary">Jumlah</span>
                                <span className={`font-black text-sm ${selectedDoc.type === TransactionType.INCOME ? 'text-[#166534]' : 'text-[#DC2626]'}`}>{formatCurrency(selectedDoc.amount)}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-brand-border/50">
                                <span className="text-brand-text-secondary">Tanggal</span>
                                <span className="font-semibold text-brand-text-primary">
                                    {new Date(selectedDoc.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-brand-border/50">
                                <span className="text-brand-text-secondary">Kategori</span>
                                <span className="font-semibold text-brand-text-primary">{selectedDoc.category}</span>
                            </div>
                            {selectedDoc.method && (
                                <div className="flex justify-between py-1.5 border-b border-brand-border/50">
                                    <span className="text-brand-text-secondary">Metode Pembayaran</span>
                                    <span className="font-semibold text-brand-text-primary">{selectedDoc.method}</span>
                                </div>
                            )}
                            <div className="pt-1">
                                <span className="text-brand-text-secondary block mb-1">Deskripsi</span>
                                <p className="p-3 bg-brand-bg rounded-xl text-brand-text-primary font-medium text-xs leading-relaxed">
                                    {selectedDoc.description || 'Tidak ada deskripsi'}
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            {onEdit && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const doc = selectedDoc;
                                        setSelectedDoc(null);
                                        onEdit(doc);
                                    }}
                                    className="min-h-11 sm:min-h-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors"
                                >
                                    Edit Transaksi
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setSelectedDoc(null)}
                                className="min-h-11 sm:min-h-0 px-4 py-1.5 bg-brand-bg hover:bg-brand-border text-brand-text-primary rounded-xl text-xs font-bold transition-colors"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionTable;
