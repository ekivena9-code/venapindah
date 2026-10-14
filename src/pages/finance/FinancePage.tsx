import React, { useState, useMemo } from 'react';
import {
    Transaction,
    TransactionType,
    FinancialPocket,
    Profile,
    Project,
    Card,
    TeamMember
} from '../../types';

import { PlusIcon } from '../../constants';

const InfoIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

import { FinanceHeaderStats } from '../../features/finance/components/FinanceHeaderStats';
import { FinanceTabs } from '../../features/finance/components/FinanceTabs';
import { MobileCollapsibleSection } from '../../components/ui/MobileProgressiveDisclosure';
import TransactionsTab from '../../features/finance/components/TransactionsTab';
import PocketsTab from '../../features/finance/components/PocketsTab';
import CardsTab from '../../features/finance/components/CardsTab';
import CashflowTab from '../../features/finance/components/CashflowTab';
import CardReportTab from '../../features/finance/components/CardReportTab';
import FinanceReportsTab from '../../features/finance/components/FinanceReportsTab';
import EventProfitabilityTab from '../../features/finance/components/EventProfitabilityTab';
import FinanceFormModal from '../../features/finance/components/FinanceFormModal';
import FinanceHistoryModal from '../../features/finance/components/FinanceHistoryModal';
import FinanceStatDetailModal from '../../features/finance/components/FinanceStatDetailModal';
import FinanceGuideModal from '../../features/finance/components/FinanceGuideModal';
import InteractiveCashflowChart from '../../shared/ui/InteractiveCashflowChart';
import CategoryBarChart from '../../features/finance/components/CategoryBarChart';

import { useFinance } from '../../features/finance/hooks/useFinance';
import { useFinanceCalculations } from '../../features/finance/hooks/useFinanceCalculations';
import { useFinanceOperations } from '../../features/finance/hooks/useFinanceOperations';
import {
    getTransactionSubDescription,
    pocketIcons
} from '../../features/finance/utils/financeHelpers';
import {
    downloadReportCSV,
    downloadTransactionsCSV,
    downloadProfitReportCSV
} from '../../features/finance/utils/financeExport';

interface FinanceProps {
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    pockets: FinancialPocket[];
    setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    profile: Profile;
    cards: Card[];
    setCards: React.Dispatch<React.SetStateAction<Card[]>>;
    teamMembers: TeamMember[];
}

export type FinanceTabType =
    | 'transactions'
    | 'pockets'
    | 'cards'
    | 'cashflow'
    | 'laporan'
    | 'laporanKartu'
    | 'labaAcara Pernikahan';

// ── Small inline icon so we don't need to import a wallet icon ─────────────
const WalletIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4z" />
        <path d="M12 2v4M6 2v4" />
        <circle cx="17" cy="12" r="1" fill="currentColor" />
    </svg>
);

const Finance: React.FC<FinanceProps> = ({
    transactions,
    setTransactions,
    pockets,
    setPockets,
    projects,
    setProjects,
    profile,
    cards,
    setCards
}) => {
    const showNotification = (_message: string) => {};

    const { handleDelete, handleAddTransaction, handleUpdateTransaction } = useFinance(
        transactions,
        setTransactions,
        pockets,
        setPockets,
        cards,
        setCards,
        showNotification
    );

    // ── Navigation & Modal State ─────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<FinanceTabType>('transactions');
    const [showVisualSummary, setShowVisualSummary] = useState(false);
    const [historyModalState, setHistoryModalState] = useState<{
        type: 'card' | 'pocket';
        item: Card | FinancialPocket | null;
    } | null>(null);
    const [activeStatModal, setActiveStatModal] = useState<'assets' | 'pockets' | 'income' | 'expense' | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    // ── Filters ──────────────────────────────────────────────────────────────
    const [filters, setFilters] = useState({ searchTerm: '', dateFrom: '', dateTo: '' });
    const [categoryFilter, setCategoryFilter] = useState<{ type: TransactionType | 'all'; category: string }>({
        type: 'all',
        category: 'Semua'
    });
    const [reportFilters, setReportFilters] = useState({ client: 'all', dateFrom: '', dateTo: '' });
    const [profitReportFilters, setProfitReportFilters] = useState({
        year: new Date().getFullYear(),
        month: new Date().getMonth()
    });
    const [transactionProjectMonthFilter, setTransactionProjectMonthFilter] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [projectionMonths, setProjectionMonths] = useState<number>(6);

    // ── Calculations ─────────────────────────────────────────────────────────
    const {
        cashflowChartData,
        cashflowMetrics,
        summary,
        thisMonthIncome,
        thisMonthExpense,
        monthlyBudgetPocket,
        categoryTotals,
        filteredTransactions,
        filteredSummary,
        reportClientOptions,
        reportTransactions,
        projectProfitabilityData,
        profitReportMetrics,
        generalReportMetrics,
        cardStats,
        expenseDonutData,
        incomeDonutData,
        projectionDecisionInsights
    } = useFinanceCalculations({
        transactions,
        cards,
        pockets,
        projects,
        filters,
        categoryFilter,
        reportFilters,
        profitReportFilters,
        projectionMonths
    });

    // ── Business Operations ───────────────────────────────────────────────────
    const {
        modalState,
        isSubmitting,
        form,
        setForm,
        hasMore,
        isLoadingMore,
        loadMoreTransactions,
        handleOpenModal,
        handleCloseModal,
        handleSubmit,
        handleFormChange,
        handleFilterChange,
        handleTutupAnggaran
    } = useFinanceOperations({
        transactions,
        setTransactions,
        pockets,
        setPockets,
        cards,
        setCards,
        projects,
        setProjects,
        handleAddTransaction,
        handleUpdateTransaction,
        showNotification,
        monthlyBudgetPocket,
        setFilters,
        setTransactionProjectMonthFilter
    });

    // ── CSV / Print handlers ──────────────────────────────────────────────────
    const handleDownloadReportCSVClick = () =>
        downloadReportCSV(reportTransactions, reportFilters, reportClientOptions);
    const handleDownloadTransactionsCSVClick = () =>
        downloadTransactionsCSV(filteredTransactions, transactions, filteredSummary);
    const handleDownloadProfitReportCSVClick = () =>
        downloadProfitReportCSV(projectProfitabilityData, profitReportFilters);

    // ── Tab content ───────────────────────────────────────────────────────────
    const renderTabContent = () => {
        switch (activeTab) {
            case 'transactions':
                return (
                    <TransactionsTab
                        monthlyBudgetPocket={monthlyBudgetPocket}
                        onTutupAnggaran={handleTutupAnggaran}
                        categoryTotals={categoryTotals}
                        categoryFilter={categoryFilter}
                        setCategoryFilter={setCategoryFilter}
                        filters={filters}
                        handleFilterChange={handleFilterChange}
                        handleDownloadTransactionsCSV={handleDownloadTransactionsCSVClick}
                        filteredSummary={filteredSummary}
                        filteredTransactions={filteredTransactions}
                        getTransactionSubDescription={(t) => getTransactionSubDescription(t, cards, pockets, projects)}
                        onOpenModal={handleOpenModal}
                        onDeleteTransaction={(id) => handleDelete('transaction', id)}
                        hasMore={hasMore}
                        loadMoreTransactions={loadMoreTransactions}
                        isLoadingMore={isLoadingMore}
                    />
                );
            case 'pockets':
                return (
                    <PocketsTab
                        pockets={pockets}
                        cards={cards}
                        summary={summary}
                        onOpenModal={handleOpenModal}
                        onDeletePocket={(id) => handleDelete('pocket', id)}
                        onViewHistory={(p) => setHistoryModalState({ type: 'pocket', item: p })}
                    />
                );
            case 'cards':
                return (
                    <CardsTab
                        cards={cards}
                        pockets={pockets}
                        cardStats={cardStats}
                        onOpenModal={handleOpenModal}
                        onDeleteCard={(id) => handleDelete('card', id)}
                        onViewHistory={(card) => setHistoryModalState({ type: 'card', item: card })}
                    />
                );
            case 'cashflow':
                return (
                    <CashflowTab
                        cashflowMetrics={cashflowMetrics}
                        filteredSummary={filteredSummary}
                        cashflowChartData={cashflowChartData}
                        expenseDonutData={expenseDonutData}
                        incomeDonutData={incomeDonutData}
                        decisionInsights={projectionDecisionInsights}
                        projectionMonths={projectionMonths}
                        onProjectionMonthsChange={setProjectionMonths}
                    />
                );
            case 'laporan':
                return (
                    <FinanceReportsTab
                        reportFilters={reportFilters}
                        setReportFilters={setReportFilters}
                        reportClientOptions={reportClientOptions}
                        handleDownloadReportCSV={handleDownloadReportCSVClick}
                        generalReportMetrics={generalReportMetrics}
                        reportTransactions={reportTransactions}
                        profile={profile}
                        projects={projects}
                        onEditTransaction={(t) => handleOpenModal('transaction', 'edit', t)}
                        onDeleteTransaction={(id) => handleDelete('transaction', id)}
                        onAddTransaction={() => handleOpenModal('transaction', 'add')}
                    />
                );
            case 'laporanKartu':
                return (
                    <CardReportTab
                        transactions={transactions}
                        cards={cards}
                        profile={profile}
                        onEditTransaction={(t) => handleOpenModal('transaction', 'edit', t)}
                        onDeleteTransaction={(id) => handleDelete('transaction', id)}
                        onAddTransaction={() => handleOpenModal('transaction', 'add')}
                    />
                );
            case 'labaAcara Pernikahan':
                return (
                    <EventProfitabilityTab
                        profitReportFilters={profitReportFilters}
                        setProfitReportFilters={setProfitReportFilters}
                        profitReportMetrics={profitReportMetrics}
                        projectProfitabilityData={projectProfitabilityData}
                        projects={projects}
                        profile={profile}
                        handleDownloadProfitReportCSV={handleDownloadProfitReportCSVClick}
                    />
                );
            default:
                return null;
        }
    };

    // ── All-time totals for header stat cards ────────────────────────────────
    const allTimeTotals = useMemo(() => {
        const income = transactions
            .filter(t => t.type === TransactionType.INCOME)
            .reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions
            .filter(t => t.type === TransactionType.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);
        return { income, expense };
    }, [transactions]);

    // ── Derived values for summary panel ─────────────────────────────────────
    const netThisMonth = summary.totalIncomeThisMonth - summary.totalExpenseThisMonth;

    return (
        <div className="space-y-5">

            {/* ── Page header bar ──────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3 non-printable">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#ECF2FF] border border-[#d8e6ff]
                                    flex items-center justify-center flex-shrink-0 shadow-xs">
                        <WalletIcon className="w-5 h-5 text-[#5D87FF]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#2A3547] leading-tight">Keuangan</h1>
                        <p className="text-xs text-[#5A6A85] font-medium leading-tight hidden sm:block">
                            {transactions.length} transaksi &middot; {cards.length} kartu &middot; {pockets.length} kantong
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsInfoModalOpen(true)}
                        className="bg-white hover:bg-[#F4F6F9] border border-[#EAEFF4] text-[#2A3547] font-bold rounded-xl px-3.5 py-2 text-xs gap-1.5 hidden sm:inline-flex items-center shadow-xs transition-all"
                        title="Panduan Keuangan"
                    >
                        <InfoIcon className="w-4 h-4 text-[#5A6A85] flex-shrink-0" />
                        <span>Panduan</span>
                    </button>
                    <button
                        onClick={() => handleOpenModal('transaction', 'add')}
                        className="bg-[#5D87FF] hover:bg-[#4871e3] text-white font-bold rounded-xl px-4 py-2.5 text-xs sm:text-sm shadow-md shadow-[#5D87FF]/25 inline-flex items-center gap-1.5 transition-all"
                    >
                        <PlusIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Tambah Transaksi</span>
                        <span className="sm:hidden">+ Transaksi</span>
                    </button>
                </div>
            </div>

            {/* ── Stat cards ───────────────────────────────────────────────── */}
            <FinanceHeaderStats summary={summary} allTimeTotals={allTimeTotals} setActiveStatModal={setActiveStatModal} />

            {/* ── Tab bar (shared desktop + mobile) ────────────────────────── */}
            <FinanceTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                showVisualSummary={showVisualSummary}
                setShowVisualSummary={setShowVisualSummary}
            />

            {/* ── Visual summary panel (real content, collapsible) ─────────── */}
            {showVisualSummary && (
                <div className="rounded-2xl border border-[#EAEFF4] bg-white shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] overflow-hidden animate-fade-in non-printable">
                    {/* Panel header */}
                    <div className="px-5 py-3.5 border-b border-[#EAEFF4] flex items-center justify-between">
                        <h3 className="font-bold text-[#2A3547] text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 text-[#5D87FF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Ringkasan Visual
                        </h3>
                        {/* Quick KPI strip */}
                        <div className="hidden sm:flex items-center gap-4 text-xs">
                            <span className="text-[#5A6A85] font-medium">Bulan ini:</span>
                            <span className="font-bold text-[#166534]">
                                +{new Intl.NumberFormat('id-ID', { notation: 'compact', currency: 'IDR', style: 'currency', minimumFractionDigits: 0 }).format(summary.totalIncomeThisMonth)}
                            </span>
                            <span className="font-bold text-[#DC2626]">
                                -{new Intl.NumberFormat('id-ID', { notation: 'compact', currency: 'IDR', style: 'currency', minimumFractionDigits: 0 }).format(summary.totalExpenseThisMonth)}
                            </span>
                            <span className={`font-bold ${netThisMonth >= 0 ? 'text-[#166534]' : 'text-[#DC2626]'}`}>
                                Net: {new Intl.NumberFormat('id-ID', { notation: 'compact', currency: 'IDR', style: 'currency', minimumFractionDigits: 0 }).format(netThisMonth)}
                            </span>
                        </div>
                    </div>

                    {/* Chart grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[#EAEFF4]">
                            {/* Cashflow bar+line chart — takes 2/3 */}
                            <div className="lg:col-span-2 p-4 md:p-5">
                                <h4 className="text-xs font-bold text-[#5A6A85] uppercase tracking-wider mb-3">
                                    Arus Kas Bulanan
                                </h4>
                                <InteractiveCashflowChart data={cashflowChartData} />
                                {/* Legend */}
                                <div className="flex items-center gap-4 mt-3 text-xs text-[#5A6A85] font-medium">
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#13DEB9]"></span>Pemasukan</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FA896B]"></span>Pengeluaran</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 rounded-full bg-[#FFAE1F]"></span>Saldo</span>
                                </div>
                            </div>

                            {/* Category bar charts — takes 1/3, split in two */}
                            <div className="p-4 md:p-5 flex flex-col gap-6">
                                <div>
                                    <h4 className="text-xs font-bold text-[#5A6A85] uppercase tracking-wider mb-3">
                                        Pemasukan per Kategori
                                    </h4>
                                    <CategoryBarChart data={incomeDonutData} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-[#5A6A85] uppercase tracking-wider mb-3">
                                        Pengeluaran per Kategori
                                    </h4>
                                    <CategoryBarChart data={expenseDonutData} />
                                </div>
                            </div>
                        </div>

                    {/* Monthly cashflow mini-table */}
                    {cashflowChartData.length > 0 && (
                        <div className="border-t border-[#EAEFF4]">
                            <div className="px-5 py-3 flex items-center justify-between">
                                <p className="text-xs font-bold text-[#5A6A85] uppercase tracking-wider">
                                    Data Bulanan
                                </p>
                                <p className="text-xs text-[#5A6A85] font-medium">{cashflowChartData.length} bulan</p>
                            </div>
                            <div className="overflow-x-auto max-h-48">
                                <table className="w-full text-xs !border-0">
                                    <thead>
                                        <tr className="bg-[#F4F6F9] text-[#5A6A85]">
                                            <th className="px-4 py-2.5 text-left font-bold !border-0 border-b border-[#EAEFF4]">Periode</th>
                                            <th className="px-4 py-2.5 text-right font-bold !border-0 border-b border-[#EAEFF4]">Masuk</th>
                                            <th className="px-4 py-2.5 text-right font-bold !border-0 border-b border-[#EAEFF4]">Keluar</th>
                                            <th className="px-4 py-2.5 text-right font-bold !border-0 border-b border-[#EAEFF4]">Net</th>
                                            <th className="px-4 py-2.5 text-right font-bold !border-0 border-b border-[#EAEFF4]">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...cashflowChartData].reverse().map((d) => {
                                            const net = d.income - d.expense;
                                            const fmt = (n: number) =>
                                                new Intl.NumberFormat('id-ID', {
                                                    notation: 'compact', style: 'currency',
                                                    currency: 'IDR', minimumFractionDigits: 0
                                                }).format(n);
                                            return (
                                                <tr key={d.label} className="border-t border-[#EAEFF4] hover:bg-[#F4F6F9]/60 transition-colors">
                                                    <td className="px-4 py-2 font-bold text-[#2A3547] !border-0">{d.label}</td>
                                                    <td className="px-4 py-2 text-right font-semibold text-[#166534] !border-0">{fmt(d.income)}</td>
                                                    <td className="px-4 py-2 text-right font-semibold text-[#DC2626] !border-0">{fmt(d.expense)}</td>
                                                    <td className={`px-4 py-2 text-right font-bold !border-0 ${net >= 0 ? 'text-[#166534]' : 'text-[#DC2626]'}`}>
                                                        {net >= 0 ? '+' : ''}{fmt(net)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-semibold text-[#2A3547] !border-0">{fmt(d.balance)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab content ──────────────────────────────────────────────── */}
            <div className="widget-animate">
                {renderTabContent()}
            </div>

            {/* ── Modals ───────────────────────────────────────────────────── */}
            <FinanceGuideModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />

            <FinanceFormModal
                modalState={modalState}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                form={form}
                setForm={setForm}
                handleFormChange={handleFormChange}
                isSubmitting={isSubmitting}
                profile={profile}
                cards={cards}
                pockets={pockets}
                projects={projects}
                transactionProjectMonthFilter={transactionProjectMonthFilter}
                setTransactionProjectMonthFilter={setTransactionProjectMonthFilter}
                pocketIcons={pocketIcons}
            />

            <FinanceHistoryModal
                historyModalState={historyModalState}
                onClose={() => setHistoryModalState(null)}
                transactions={transactions}
                cards={cards}
            />

            <FinanceStatDetailModal
                activeStatModal={activeStatModal}
                onClose={() => setActiveStatModal(null)}
                cards={cards}
                pockets={pockets}
                thisMonthIncome={thisMonthIncome}
                thisMonthExpense={thisMonthExpense}
            />
        </div>
    );
};

export default Finance;
