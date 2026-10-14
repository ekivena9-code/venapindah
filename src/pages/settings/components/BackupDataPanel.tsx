import React, { useMemo, useState } from 'react';
import { AlertCircle, DatabaseBackup, Download, LoaderCircle, RefreshCw } from 'lucide-react';
import supabase, { isSupabaseConfigured } from '../../../lib/supabaseClient';
import { downloadCSV } from '../../../utils/export';

interface BackupDataset {
    table: string;
    label: string;
    category: string;
    amountFields?: string[];
}

interface BackupRecord {
    dataset: BackupDataset;
    value: Record<string, unknown>;
}

const PAGE_SIZE = 1000;
const DATASETS: BackupDataset[] = [
    { table: 'clients', label: 'Klien', category: 'Klien' },
    { table: 'leads', label: 'Calon klien', category: 'Klien' },
    { table: 'client_feedback', label: 'Umpan balik klien', category: 'Klien' },
    { table: 'projects', label: 'Proyek', category: 'Proyek', amountFields: ['total_cost', 'totalCost'] },
    { table: 'project_add_ons', label: 'Add-on proyek', category: 'Proyek' },
    { table: 'project_team_assignments', label: 'Penugasan tim proyek', category: 'Proyek' },
    { table: 'wedding_day_checklists', label: 'Checklist hari acara', category: 'Proyek' },
    { table: 'calendar_events', label: 'Agenda kalender', category: 'Proyek' },
    { table: 'contracts', label: 'Kontrak', category: 'Proyek' },
    { table: 'transactions', label: 'Transaksi ledger', category: 'Keuangan', amountFields: ['amount'] },
    { table: 'cards', label: 'Kartu/rekening', category: 'Keuangan', amountFields: ['balance'] },
    { table: 'pockets', label: 'Kantong keuangan', category: 'Keuangan', amountFields: ['balance'] },
    { table: 'team_members', label: 'Anggota tim', category: 'Tim' },
    { table: 'team_project_payments', label: 'Pembayaran tim per proyek', category: 'Tim', amountFields: ['fee', 'amount'] },
    { table: 'team_payment_records', label: 'Catatan pembayaran tim', category: 'Tim', amountFields: ['amount', 'fee'] },
    { table: 'packages', label: 'Paket', category: 'Paket', amountFields: ['price'] },
    { table: 'add_ons', label: 'Add-on paket', category: 'Paket', amountFields: ['price'] },
    { table: 'promo_codes', label: 'Kode promo', category: 'Paket', amountFields: ['discount_amount'] },
    { table: 'notifications', label: 'Notifikasi', category: 'Lainnya' },
];

const currency = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

const getDate = (record: Record<string, unknown>) => {
    const value = record.date ?? record.event_date ?? record.wedding_date ?? record.payment_date ?? record.created_at;
    if (!value) return '';
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString().slice(0, 10);
};

const getAmount = (record: BackupRecord) => {
    for (const field of record.dataset.amountFields ?? []) {
        const value = record.value[field];
        if (value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))) {
            return Number(value);
        }
    }
    return 0;
};

const getRecordLabel = (record: Record<string, unknown>) => {
    const value = record.name ?? record.full_name ?? record.description ?? record.title ?? record.client_name ?? record.code;
    return value === null || value === undefined ? '' : String(value);
};

const toCsvRows = (records: BackupRecord[]) => records.map(({ dataset, value }) => [
    dataset.category,
    dataset.label,
    String(value.id ?? ''),
    getDate(value),
    getRecordLabel(value),
    String(value.category ?? value.type ?? value.status ?? ''),
    currency.format(getAmount({ dataset, value })),
    JSON.stringify(value),
]);

const BackupDataPanel: React.FC = () => {
    const [records, setRecords] = useState<BackupRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Semua kategori');
    const [tableFilter, setTableFilter] = useState('Semua tabel');
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const loadBackupData = async () => {
        if (!isSupabaseConfigured) {
            setLoadError('Koneksi database belum dikonfigurasi.');
            return;
        }
        setIsLoading(true);
        setLoadError('');
        try {
            const tableRecords = await Promise.all(DATASETS.map(async dataset => {
                const rows: Record<string, unknown>[] = [];
                for (let offset = 0; ; offset += PAGE_SIZE) {
                    const { data, error } = await supabase
                        .from(dataset.table)
                        .select('*')
                        .range(offset, offset + PAGE_SIZE - 1);
                    if (error) throw new Error(`${dataset.label}: ${error.message}`);
                    const page = (data ?? []) as Record<string, unknown>[];
                    rows.push(...page);
                    if (page.length < PAGE_SIZE) break;
                }
                return rows.map(value => ({ dataset, value }));
            }));
            setRecords(tableRecords.flat());
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Gagal mengambil data backup.');
            setRecords([]);
        } finally {
            setIsLoading(false);
        }
    };

    const categories = useMemo(() => ['Semua kategori', ...new Set(DATASETS.map(dataset => dataset.category))], []);
    const tables = useMemo(() => ['Semua tabel', ...DATASETS.map(dataset => dataset.table)], []);
    const filteredRecords = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase('id-ID');
        return records.filter(record => {
            if (categoryFilter !== 'Semua kategori' && record.dataset.category !== categoryFilter) return false;
            if (tableFilter !== 'Semua tabel' && record.dataset.table !== tableFilter) return false;
            const recordDate = getDate(record.value);
            if (dateFrom && (!recordDate || recordDate < dateFrom)) return false;
            if (dateTo && (!recordDate || recordDate > dateTo)) return false;
            if (normalizedSearch && !JSON.stringify(record.value).toLocaleLowerCase('id-ID').includes(normalizedSearch)) return false;
            return true;
        });
    }, [records, categoryFilter, tableFilter, search, dateFrom, dateTo]);

    const ledgerSummary = useMemo(() => filteredRecords
        .filter(record => record.dataset.table === 'transactions')
        .reduce((summary, record) => {
            const amount = getAmount(record);
            const type = String(record.value.type ?? '').toLocaleLowerCase('id-ID');
            if (type === 'pemasukan' || type === 'income') summary.income += amount;
            else if (type === 'pengeluaran' || type === 'expense') summary.expense += amount;
            return summary;
        }, { income: 0, expense: 0 }), [filteredRecords]);

    const downloadRecords = (target: BackupRecord[], filename: string) => {
        const totals = target.reduce((sum, record) => sum + getAmount(record), 0);
        downloadCSV(
            ['Kategori', 'Tabel', 'ID', 'Tanggal', 'Nama/Deskripsi', 'Kategori/Status', 'Nilai (Rp)', 'Data Lengkap (JSON)'],
            toCsvRows(target),
            filename,
            [
                ['Ringkasan backup', new Date().toLocaleString('id-ID')],
                ['Jumlah baris', target.length],
                ['Total nilai kolom Rupiah', currency.format(totals)],
            ],
        );
    };

    const datasetCounts = useMemo(() => DATASETS.map(dataset => ({
        ...dataset,
        count: filteredRecords.filter(record => record.dataset.table === dataset.table).length,
    })), [filteredRecords]);

    return (
        <section className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-semibold text-brand-text-light">
                        <DatabaseBackup className="h-5 w-5 text-brand-accent" /> Backup Data
                    </h3>
                    <p className="mt-1 text-sm text-brand-text-secondary">Ekspor data operasional, tanpa profil publik dan portofolio.</p>
                </div>
                <button type="button" onClick={loadBackupData} disabled={isLoading} className="button-secondary inline-flex items-center justify-center gap-2">
                    {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {records.length ? 'Muat ulang data' : 'Muat data backup'}
                </button>
            </div>

            {loadError && (
                <div role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{loadError} Backup tidak dibuat sebagian; periksa izin/tabel lalu muat ulang.</span>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border border-brand-border bg-brand-bg p-3">
                    <p className="text-xs text-brand-text-secondary">Total data termuat</p>
                    <p className="mt-1 text-lg font-semibold text-brand-text-primary">{records.length.toLocaleString('id-ID')} baris</p>
                </div>
                <div className="rounded-md border border-brand-border bg-brand-bg p-3">
                    <p className="text-xs text-brand-text-secondary">Pemasukan ledger</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-700">{currency.format(ledgerSummary.income)}</p>
                </div>
                <div className="rounded-md border border-brand-border bg-brand-bg p-3">
                    <p className="text-xs text-brand-text-secondary">Pengeluaran ledger</p>
                    <p className="mt-1 text-lg font-semibold text-rose-700">{currency.format(ledgerSummary.expense)}</p>
                </div>
                <div className="rounded-md border border-brand-border bg-brand-bg p-3">
                    <p className="text-xs text-brand-text-secondary">Saldo bersih ledger</p>
                    <p className="mt-1 text-lg font-semibold text-brand-text-primary">{currency.format(ledgerSummary.income - ledgerSummary.expense)}</p>
                </div>
            </div>

            <div className="space-y-3 rounded-md border border-brand-border p-3 md:p-4">
                <h4 className="text-sm font-semibold text-brand-text-primary">Filter data</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <input aria-label="Cari data backup" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama, ID, kategori..." className="input-field" />
                    <select aria-label="Filter kategori data" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="input-field">
                        {categories.map(category => <option key={category}>{category}</option>)}
                    </select>
                    <select aria-label="Filter tabel data" value={tableFilter} onChange={event => setTableFilter(event.target.value)} className="input-field">
                        {tables.map(table => <option key={table}>{table}</option>)}
                    </select>
                    <label className="space-y-1 text-xs text-brand-text-secondary">Dari tanggal<input aria-label="Dari tanggal" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="input-field" /></label>
                    <label className="space-y-1 text-xs text-brand-text-secondary">Sampai tanggal<input aria-label="Sampai tanggal" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="input-field" /></label>
                    <p className="flex items-center text-sm text-brand-text-secondary">{filteredRecords.length.toLocaleString('id-ID')} baris sesuai filter</p>
                </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-brand-border">
                <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-brand-bg text-xs uppercase text-brand-text-secondary">
                        <tr><th className="px-3 py-2.5">Kategori</th><th className="px-3 py-2.5">Tabel</th><th className="px-3 py-2.5 text-right">Jumlah baris</th></tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                        {datasetCounts
                            .filter(dataset => categoryFilter === 'Semua kategori' || dataset.category === categoryFilter)
                            .filter(dataset => tableFilter === 'Semua tabel' || dataset.table === tableFilter)
                            .map(dataset => <tr key={dataset.table}>
                                <td className="px-3 py-2.5 text-brand-text-secondary">{dataset.category}</td>
                                <td className="px-3 py-2.5 font-medium text-brand-text-primary">{dataset.label}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-brand-text-primary">{dataset.count.toLocaleString('id-ID')}</td>
                            </tr>)}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-brand-border pt-4 sm:flex-row sm:justify-end">
                <button type="button" disabled={!records.length || isLoading} onClick={() => downloadRecords(filteredRecords, `backup-filter-${new Date().toISOString().slice(0, 10)}.csv`)} className="button-secondary inline-flex items-center justify-center gap-2">
                    <Download className="h-4 w-4" /> Unduh hasil filter
                </button>
                <button type="button" disabled={!records.length || isLoading} onClick={() => downloadRecords(records, `backup-lengkap-${new Date().toISOString().slice(0, 10)}.csv`)} className="button-primary inline-flex items-center justify-center gap-2">
                    <Download className="h-4 w-4" /> Unduh semua data CSV
                </button>
            </div>
        </section>
    );
};

export default BackupDataPanel;