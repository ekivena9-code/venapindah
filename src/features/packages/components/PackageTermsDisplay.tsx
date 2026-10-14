import React from 'react';
import { FileText } from 'lucide-react';
import { PackageTermItem } from '../../../types';

interface PackageTermsDisplayProps {
  terms: PackageTermItem[];
  packageName?: string;
  showHeader?: boolean;
}

const PackageTermsDisplay: React.FC<PackageTermsDisplayProps> = ({ terms, packageName, showHeader = true }) => (
  <div className="space-y-3">
    {showHeader && (
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#5D87FF] shadow-sm">
          <FileText className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-extrabold text-[#2A3547]">Syarat & Ketentuan Paket</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-[#5A6A85]">
            {packageName ? `Ketentuan untuk paket ${packageName}.` : 'Harap membaca ketentuan paket berikut sebelum melanjutkan.'}
          </p>
        </div>
      </div>
    )}

    {terms.map(term => (
      <section key={term.id} className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
        <h4 className="text-xs font-extrabold text-[#2A3547] sm:text-sm">{term.title}</h4>
        {term.items.length > 0 ? (
          <ul className="mt-2.5 list-inside list-disc space-y-2 text-xs leading-relaxed text-[#5A6A85] sm:text-sm">
            {term.items.map((item, index) => <li key={`${term.id}-${index}`}>{item}</li>)}
          </ul>
        ) : (
          <p className="mt-2 text-xs italic text-[#5A6A85]">Belum ada ketentuan pada bagian ini.</p>
        )}
      </section>
    ))}
  </div>
);

export default PackageTermsDisplay;
