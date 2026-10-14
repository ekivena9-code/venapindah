import React from 'react';
import { ModernStatCard } from '../../../components/modernize/ModernStatCard';
import InteractiveCashflowChart, { ChartDataPoint, DecisionInsight } from '../../../shared/ui/InteractiveCashflowChart';
import { AnalyticsChartCard } from '../../../shared/ui/AnalyticsChartCard';
import { formatCurrency } from '../../../utils/currency';
import { DollarSignIcon, TrendingUpIcon, TrendingDownIcon } from '../../../constants';
import { Calendar, Shield } from 'lucide-react';
import CategoryBarChart from './CategoryBarChart';

interface CashflowMetrics {
    runway: string;
    avgIncome: number;
    avgExpense: number;
    burnRate: number;
}

interface CashflowTabProps {
    cashflowMetrics: CashflowMetrics;
    filteredSummary: { net: number };
    cashflowChartData: ChartDataPoint[];
    expenseDonutData: any[];
    incomeDonutData?: any[];
    decisionInsights?: DecisionInsight;
    projectionMonths?: number;
    onProjectionMonthsChange?: (months: number) => void;
}

const CashflowTab: React.FC<CashflowTabProps> = ({
    cashflowMetrics,
    filteredSummary,
    cashflowChartData,
    expenseDonutData,
    incomeDonutData = [],
    decisionInsights,
    projectionMonths = 6,
    onProjectionMonthsChange
}) => {
    return (
        <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-5">
                <ModernStatCard
                    icon={<Shield className="w-5 h-5" />}
                    title="Ketahanan Kas (Runway)"
                    value={cashflowMetrics.runway}
                    subtitle={`Burn Rate: ${formatCurrency(cashflowMetrics.burnRate)}/bln`}
                    iconColorVariant="warning"
                    compactOnMobile
                />
                <ModernStatCard
                    icon={<DollarSignIcon className="w-5 h-5" />}
                    title="Laba/Rugi Historis"
                    value={formatCurrency(filteredSummary.net)}
                    valueClassName={filteredSummary.net >= 0 ? '!text-[#166534]' : '!text-[#DC2626]'}
                    subtitle="Berdasarkan transaksi tercatat"
                    iconColorVariant="primary"
                    compactOnMobile
                />
                <ModernStatCard
                    icon={<TrendingUpIcon className="w-5 h-5" />}
                    title="Rata-rata Pemasukan"
                    value={formatCurrency(cashflowMetrics.avgIncome)}
                    valueClassName="!text-[#166534]"
                    subtitle="Rata-rata historis per bulan"
                    iconColorVariant="success"
                    compactOnMobile
                />
                <ModernStatCard
                    icon={<TrendingDownIcon className="w-5 h-5" />}
                    title="Rata-rata Pengeluaran"
                    value={formatCurrency(cashflowMetrics.avgExpense)}
                    valueClassName="!text-[#DC2626]"
                    subtitle="Rata-rata operasional bulanan"
                    iconColorVariant="error"
                    compactOnMobile
                />
            </div>

            {/* Main Interactive Cashflow & Projection Chart */}
            <div className="bg-white p-3 sm:p-5 md:p-6 rounded-2xl shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] border border-[#EAEFF4]">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div>
                        <h4 className="text-sm sm:text-base md:text-lg font-bold text-[#2A3547] flex items-center gap-2">
                            Grafik Arus Kas & Proyeksi Berbasis Data
                        </h4>
                        <p className="text-xs text-[#5A6A85] mt-0.5">
                            Berdasarkan transaksi tercatat dan sisa pembayaran pada acara yang akan datang.
                        </p>
                    </div>
                </div>

                <InteractiveCashflowChart
                    data={cashflowChartData}
                    projectionMonths={projectionMonths}
                    onProjectionMonthsChange={onProjectionMonthsChange}
                    decisionInsights={decisionInsights}
                    showControls={true}
                />
            </div>

            {/* Category Analytics Distribution Charts: Income and Expense */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <AnalyticsChartCard title="Distribusi Pemasukan per Kategori">
                    <CategoryBarChart data={incomeDonutData} />
                </AnalyticsChartCard>
                <AnalyticsChartCard title="Distribusi Pengeluaran per Kategori">
                    <CategoryBarChart data={expenseDonutData} />
                </AnalyticsChartCard>
            </div>

            {/* Monthly Cashflow Data Table */}
            <div className="bg-white p-3 sm:p-5 md:p-6 rounded-2xl shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] border border-[#EAEFF4]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                        <h4 className="text-sm font-bold text-[#2A3547] uppercase tracking-wider">
                            Rincian Arus Kas & Proyeksi Bulanan
                        </h4>
                        <p className="text-xs text-[#5A6A85] mt-0.5">
                            Data historis berpadu dengan estimasi tren masa depan untuk perencanaan anggaran.
                        </p>
                    </div>
                </div>
                <div className="min-w-0 w-full overflow-x-auto max-h-96">
                    <table className="w-full text-xs lg:text-sm">
                        <thead className="text-xs text-[#5A6A85] uppercase bg-[#F4F6F9]/80 border-b border-[#EAEFF4] sticky top-0 z-10">
                            <tr className="text-[#5A6A85]">
                                <th className="p-3 font-bold text-center w-12">No</th>
                                <th className="p-3 font-bold text-left">Periode</th>
                                <th className="p-3 font-bold text-center">Tipe</th>
                                <th className="p-3 font-bold text-right">Pemasukan</th>
                                <th className="p-3 font-bold text-right">Pengeluaran</th>
                                <th className="p-3 font-bold text-right">Net Arus Kas</th>
                                <th className="p-3 font-bold text-right">Saldo Kumulatif</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAEFF4]">
                            {cashflowChartData.map((d, index) => {
                                const netVal = d.income - d.expense;
                                return (
                                    <tr
                                        key={d.label}
                                        className={`transition-colors ${
                                            d.isProjected
                                                ? 'bg-[#ECF2FF]/20 hover:bg-[#ECF2FF]/40'
                                                : 'hover:bg-[#F4F6F9]/60'
                                        }`}
                                    >
                                        <td className="p-3 text-center text-[#5A6A85] font-bold">{index + 1}</td>
                                        <td className="p-3 font-bold text-[#2A3547]">
                                            {d.label}
                                            {d.isProjected && Boolean(d.projectedReceivables) && (
                                                <span className="block text-[10px] font-normal text-[#5D87FF]">
                                                    (Sisa pembayaran acara: {formatCurrency(d.projectedReceivables || 0)})
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            {d.isProjected ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECF2FF] text-[#5D87FF]">
                                                    <Calendar className="w-2.5 h-2.5" />
                                                    Proyeksi
                                                </span>
                                            ) : (
                                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F4F6F9] text-[#5A6A85]">
                                                    Aktual
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right font-semibold text-[#166534]">{formatCurrency(d.income)}</td>
                                        <td className="p-3 text-right font-semibold text-[#DC2626]">{formatCurrency(d.expense)}</td>
                                        <td className={`p-3 text-right font-bold ${netVal >= 0 ? 'text-[#166534]' : 'text-[#DC2626]'}`}>
                                            {netVal >= 0 ? '+' : ''}{formatCurrency(netVal)}
                                        </td>
                                        <td className="p-3 text-right font-bold text-[#2A3547]">{formatCurrency(d.balance)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CashflowTab;
