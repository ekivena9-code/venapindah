import React from 'react';
import { PencilIcon, Trash2Icon } from '../../../constants';

interface CategoryManagerProps {
    title: string;
    categories: string[];
    inputValue: string;
    onInputChange: (value: string) => void;
    onAddOrUpdate: () => void;
    onEdit: (value: string) => void;
    onDelete: (value: string) => void;
    editingValue: string | null;
    onCancelEdit: () => void;
    hasChanges: boolean;
    isSaving: boolean;
    onSaveChanges: () => void;
    placeholder: string;
    suggestedDefaults?: string[];
    onAddSuggested?: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ 
    title, categories, inputValue, onInputChange, onAddOrUpdate, onEdit, onDelete, 
    editingValue, onCancelEdit, hasChanges, isSaving, onSaveChanges, placeholder, suggestedDefaults, onAddSuggested 
}) => {

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onAddOrUpdate();
        } else if (e.key === 'Escape' && editingValue) {
            e.preventDefault();
            onCancelEdit();
        }
    };

    const missingSuggestions = suggestedDefaults?.filter(category => !categories?.includes(category)) || [];

    const renderCategoryItem = (category: string) => (
        <div key={category} className="flex items-center justify-between px-2.5 py-1 sm:px-3 sm:py-2 bg-[#F4F6F9] rounded-lg sm:rounded-xl">
            <span className="text-xs md:text-sm text-[#2A3547] truncate flex-1 mr-2 leading-tight">{category}</span>
            <div className="flex items-center gap-1 md:gap-1.5 flex-shrink-0">
                <button
                    type="button"
                    onClick={() => onEdit(category)}
                    className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#5A6A85] hover:text-[#5D87FF] hover:bg-white transition-colors"
                    title="Edit"
                    aria-label={`Edit ${category}`}
                >
                    <PencilIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(category)}
                    className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#5A6A85] hover:text-[#FA896B] hover:bg-white transition-colors"
                    title="Hapus"
                    aria-label={`Hapus ${category}`}
                >
                    <Trash2Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
            </div>
        </div>
    );

    return (
        <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-[#EAEFF4] shadow-sm">
            <h3 className="text-xs sm:text-sm md:text-lg font-black text-[#2A3547] border-b border-[#EAEFF4] pb-1.5 sm:pb-3 mb-2 sm:mb-3">{title}</h3>
            <div className="flex flex-row items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                <div className="input-group flex-grow !mt-0 !mb-0">
                    <input
                        type="text"
                        id={`input-${title.replace(/\s/g, '')}`}
                        value={inputValue}
                        onChange={e => onInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder=" "
                        className="input-field"
                        disabled={isSaving}
                    />
                    <label htmlFor={`input-${title.replace(/\s/g, '')}`} className="input-label">{placeholder}</label>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <button type="button" onClick={onAddOrUpdate} disabled={isSaving} className="bg-[#5D87FF] text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm hover:bg-[#4a6edb] transition-colors disabled:opacity-50">{editingValue ? 'Update' : 'Tambah'}</button>
                    {editingValue && <button type="button" onClick={onCancelEdit} disabled={isSaving} className="bg-[#F4F6F9] text-[#5A6A85] px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm hover:bg-[#e2e8f0] transition-colors">Batal</button>}
                </div>
            </div>
            {suggestedDefaults?.length && onAddSuggested && (
                <div className="mb-2 sm:mb-3">
                    <button type="button" onClick={onAddSuggested} disabled={isSaving || missingSuggestions.length === 0} className="text-[11px] md:text-xs text-[#5D87FF] font-medium hover:underline !min-h-0 !h-auto !p-0 disabled:cursor-default disabled:opacity-60 disabled:no-underline">
                        {missingSuggestions.length > 0 ? `+ Tambah dari saran default (${missingSuggestions.length})` : 'Semua saran default sudah ditambahkan'}
                    </button>
                </div>
            )}
            <div className="space-y-1 sm:space-y-1.5 max-h-52 sm:max-h-60 overflow-y-auto pr-1 sm:pr-2">
                {categories?.length > 0 ? categories.map(cat => renderCategoryItem(cat)) : (
                    <div className="text-center text-[#5A6A85] text-xs py-2.5 sm:py-4 italic">
                        Belum ada {title.toLowerCase()}
                    </div>
                )}
            </div>
            {hasChanges && (
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#EAEFF4] pt-3">
                    <span className="text-[11px] sm:text-xs text-amber-700">Perubahan belum disimpan</span>
                    <button type="button" onClick={onSaveChanges} disabled={isSaving} className="bg-[#5D87FF] text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm hover:bg-[#4a6edb] transition-colors disabled:opacity-50">
                        {isSaving ? 'Menyimpan...' : 'Simpan perubahan'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default CategoryManager;
