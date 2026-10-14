import React, { useState } from 'react';
import { XIcon, DownloadIcon } from '../../../constants';
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { PaymentStatus, ClientStatus } from '../../../types';

interface ClientFilterBarProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    monthFilter: string;
    setMonthFilter: (month: string) => void;
    dateFrom: string;
    setDateFrom: (date: string) => void;
    dateTo: string;
    setDateTo: (date: string) => void;
    statusFilter: string;
    setStatusFilter: (status: string) => void;
    onDownloadExcel: () => void;
}

export const ClientFilterBar: React.FC<ClientFilterBarProps> = ({
    searchTerm,
    setSearchTerm,
    monthFilter,
    setMonthFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    statusFilter,
    setStatusFilter,
    onDownloadExcel,
}) => {
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const hasActiveFilters = searchTerm || monthFilter || dateFrom || dateTo || statusFilter !== 'Semua Status';
    const extraFilterCount = [
        monthFilter,
        dateFrom,
        dateTo,
        statusFilter !== 'Semua Status' ? statusFilter : '',
    ].filter(Boolean).length;
    
    const clearAllFilters = () => {
        setSearchTerm('');
        setMonthFilter('');
        setDateFrom('');
        setDateTo('');
        setStatusFilter('Semua Status');
    };

    return (
        <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-[0_9px_17.5px_rgba(0,0,0,0.05)] border border-[#EAEFF4]">
            {/* Mobile Compact Bar: Search + Filter Toggle + Download */}
            <div className="flex sm:hidden items-center gap-2">
                <div className="relative flex-1 min-w-0">
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] p-2 text-xs text-[#2A3547] placeholder-[#5A6A85] outline-none transition-all"
                        placeholder="Cari nama, email, HP..."
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#FA896B]"
                            title="Hapus pencarian"
                        >
                            <XIcon className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(prev => !prev)}
                    className={`px-2.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-all ${
                        mobileFiltersOpen || extraFilterCount > 0
                            ? 'bg-[#ECF2FF] border-[#5D87FF]/30 text-[#5D87FF]'
                            : 'bg-[#F4F6F9] border-[#EAEFF4] text-[#5A6A85]'
                    }`}
                >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{mobileFiltersOpen ? 'Tutup' : 'Filter'}</span>
                    {extraFilterCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[#5D87FF] text-white text-[9px] font-bold">
                            {extraFilterCount}
                        </span>
                    )}
                    {mobileFiltersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <button
                    onClick={onDownloadExcel}
                    className="bg-[#ECF2FF] text-[#5D87FF] font-semibold p-2 rounded-xl inline-flex items-center justify-center shrink-0"
                    title="Unduh Excel lengkap"
                >
                    <DownloadIcon className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Mobile Collapsible Extra Filters */}
            {mobileFiltersOpen && (
                <div className="sm:hidden mt-2.5 pt-2.5 border-t border-[#EAEFF4] grid grid-cols-2 gap-2 animate-fade-in">
                    <input
                        type="month"
                        value={monthFilter}
                        onChange={e => setMonthFilter(e.target.value)}
                        className="w-full min-w-0 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] p-2 text-xs text-[#2A3547] outline-none"
                        title="Filter per Bulan"
                    />
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="w-full min-w-0 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] p-2 text-xs text-[#2A3547] outline-none"
                    >
                        <option value="Semua Status">Semua Status</option>
                        <optgroup label="Status Pengantin">
                            {Object.values(ClientStatus).map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Status Pembayaran">
                            {Object.values(PaymentStatus).map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </optgroup>
                    </select>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="w-full min-w-0 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] p-2 text-xs text-[#2A3547] outline-none"
                        title="Dari Tanggal"
                    />
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full min-w-0 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] p-2 text-xs text-[#2A3547] outline-none"
                        title="Sampai Tanggal"
                    />
                    {hasActiveFilters && (
                        <button
                            onClick={clearAllFilters}
                            className="col-span-2 bg-[#FDEDE8] text-[#FA896B] font-semibold px-3 py-1.5 rounded-xl inline-flex items-center justify-center gap-1.5 text-xs"
                        >
                            <XIcon className="w-3.5 h-3.5" />
                            <span>Reset Semua Filter</span>
                        </button>
                    )}
                </div>
            )}

            {/* Desktop / Tablet Filter Bar (Unchanged) */}
            <div className="hidden sm:flex sm:flex-wrap items-center gap-2">
                {/* Search Box */}
                <div className="relative col-span-2 min-w-0 sm:flex-1 sm:min-w-[200px]">
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] p-2 sm:p-2.5 text-xs sm:text-sm text-[#2A3547] placeholder-[#5A6A85] outline-none transition-all"
                        placeholder="Cari nama, email, HP..."
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#FA896B] hover:text-[#e67458] transition-colors"
                            title="Hapus pencarian"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Month Filter */}
                <input
                    type="month"
                    value={monthFilter}
                    onChange={e => setMonthFilter(e.target.value)}
                    className="col-start-1 row-start-2 w-full min-w-0 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] p-2 sm:p-2.5 text-xs sm:text-sm text-[#2A3547] outline-none transition-all sm:col-auto sm:row-auto sm:w-[160px]"
                    title="Filter per Bulan"
                />

                {/* Status Filter */}
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="col-start-2 row-start-2 w-full min-w-0 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] p-2 sm:p-2.5 text-xs sm:text-sm text-[#2A3547] outline-none transition-all sm:col-auto sm:row-auto sm:w-[180px]"
                >
                    <option value="Semua Status">Semua Status</option>
                    <optgroup label="Status Pengantin">
                        {Object.values(ClientStatus).map(s => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </optgroup>
                    <optgroup label="Status Pembayaran">
                        {Object.values(PaymentStatus).map(s => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </optgroup>
                </select>

                <div className="col-span-2 row-start-3 grid grid-cols-2 gap-2 sm:contents">
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="w-full min-w-0 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] p-2 sm:p-2.5 text-xs sm:text-sm text-[#2A3547] outline-none transition-all sm:w-[150px]"
                        title="Dari Tanggal"
                        aria-label="Dari Tanggal"
                    />
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full min-w-0 rounded-xl border border-[#EAEFF4] bg-[#F4F6F9] focus:bg-white focus:border-[#5D87FF] p-2 sm:p-2.5 text-xs sm:text-sm text-[#2A3547] outline-none transition-all sm:w-[150px]"
                        title="Sampai Tanggal"
                        aria-label="Sampai Tanggal"
                    />
                </div>

                {/* Spacer untuk push buttons ke kanan */}
                <div className="hidden sm:block sm:flex-1 sm:min-w-[20px]"></div>

                {/* Clear All Filters Button */}
                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="w-full col-span-1 bg-[#FDEDE8] hover:bg-[#FA896B] text-[#FA896B] hover:text-white font-semibold px-2 sm:px-3 py-2 rounded-xl inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-all whitespace-nowrap sm:col-auto sm:w-auto"
                        title="Hapus semua filter"
                    >
                        <XIcon className="w-4 h-4" />
                        <span>Reset</span>
                    </button>
                )}

                {/* Download CSV Button */}
                <button
                    onClick={onDownloadExcel}
                    className="w-full col-span-2 justify-self-end bg-[#ECF2FF] hover:bg-[#d8e6ff] text-[#5D87FF] font-semibold px-2 sm:px-3 py-2 rounded-xl inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-colors whitespace-nowrap sm:col-auto sm:w-auto"
                    title="Unduh data pengantin lengkap (Excel)"
                >
                    <DownloadIcon className="w-4 h-4" />
                    <span>Unduh</span>
                </button>
            </div>
        </div>
    );
};

export default ClientFilterBar;
