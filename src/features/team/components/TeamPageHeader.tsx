/**
 * TeamPageHeader
 *
 * Top action bar: date range filters, reset, download CSV, add member button.
 * Identical markup to original.
 */

import React, { useState } from 'react';
import { CalendarIcon, DownloadIcon, PlusIcon } from '../../../constants';
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

interface TeamPageHeaderProps {
    dateFrom: string;
    dateTo: string;
    onDateFromChange: (value: string) => void;
    onDateToChange: (value: string) => void;
    onResetDateRange: () => void;
    onDownload: () => void;
    onAddMember: () => void;
}

const TeamPageHeader: React.FC<TeamPageHeaderProps> = ({
    dateFrom,
    dateTo,
    onDateFromChange,
    onDateToChange,
    onResetDateRange,
    onDownload,
    onAddMember,
}) => {
    const [mobileDateOpen, setMobileDateOpen] = useState(false);
    const hasDates = Boolean(dateFrom || dateTo);

    return (
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-[0_9px_17.5px_rgba(0,0,0,0.05)]">
            {/* Mobile Compact Action + Filter Toggle Bar */}
            <div className="flex flex-wrap sm:hidden items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => setMobileDateOpen(prev => !prev)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                        mobileDateOpen || hasDates
                            ? 'bg-[#ECF2FF] border-[#5D87FF]/40 text-[#5D87FF]'
                            : 'bg-[#F8FAFC] border-slate-200 text-[#2A3547]'
                    }`}
                >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{mobileDateOpen ? 'Tutup Filter' : 'Filter Periode'}</span>
                    {hasDates && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[#5D87FF] text-white text-[9px] font-bold">
                            Aktif
                        </span>
                    )}
                    {mobileDateOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                    <button
                        onClick={onDownload}
                        className="button-secondary inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs border border-slate-200 bg-white text-[#2A3547]"
                    >
                        <DownloadIcon className="w-3.5 h-3.5 flex-shrink-0" /> Unduh
                    </button>
                    <button
                        onClick={onAddMember}
                        className="button-primary inline-flex items-center justify-center gap-1 px-3 py-2 text-xs"
                    >
                        <PlusIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Tambah</span>
                    </button>
                </div>
            </div>

            {mobileDateOpen && (
                <div className="sm:hidden mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 animate-fade-in">
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => onDateFromChange(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-[#F8FAFC] text-[#2A3547] p-2 text-xs w-full focus:outline-none focus:border-[#5D87FF]"
                        title="Dari tanggal"
                    />
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => onDateToChange(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-[#F8FAFC] text-[#2A3547] p-2 text-xs w-full focus:outline-none focus:border-[#5D87FF]"
                        title="Sampai tanggal"
                    />
                    {hasDates && (
                        <button
                            onClick={onResetDateRange}
                            className="col-span-2 text-xs text-red-600 font-semibold hover:underline text-center py-1"
                        >
                            Reset Periode
                        </button>
                    )}
                </div>
            )}

            {/* Desktop Header */}
            <div className="hidden sm:flex sm:flex-row flex-wrap w-full items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-extrabold text-[#2A3547] tracking-tight">Manajemen Tim & Vendor</h1>
                    <p className="text-xs text-[#5A6A85] mt-0.5">Kelola anggota tim internal, mitra vendor, dan pembayaran fee acara.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-2 bg-[#F8FAFC] px-3 py-1.5 rounded-xl border border-slate-200">
                        <CalendarIcon className="w-4 h-4 text-[#5A6A85] flex-shrink-0" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => onDateFromChange(e.target.value)}
                            className="bg-white rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-[#2A3547] focus:outline-none focus:border-[#5D87FF]"
                            title="Dari tanggal"
                        />
                        <span className="text-xs text-[#5A6A85] font-medium">s/d</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => onDateToChange(e.target.value)}
                            className="bg-white rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-[#2A3547] focus:outline-none focus:border-[#5D87FF]"
                            title="Sampai tanggal"
                        />
                        {(dateFrom || dateTo) && (
                            <button
                                onClick={onResetDateRange}
                                className="text-xs text-red-600 font-semibold hover:underline px-1"
                            >
                                Reset
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onDownload}
                            className="button-secondary inline-flex items-center justify-center gap-1.5 text-xs px-3.5 py-2 border border-slate-200 bg-white text-[#2A3547] hover:bg-slate-50"
                        >
                            <DownloadIcon className="w-4 h-4 flex-shrink-0" /> Unduh CSV
                        </button>
                        <button
                            onClick={onAddMember}
                            className="button-primary inline-flex items-center justify-center gap-1.5 text-xs px-4 py-2"
                        >
                            <PlusIcon className="w-4 h-4 flex-shrink-0" />
                            <span>Tambah Anggota</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamPageHeader;
