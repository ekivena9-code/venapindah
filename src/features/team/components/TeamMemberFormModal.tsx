import React, { useState } from 'react';
import { Upload, Users as UsersIcon } from 'lucide-react';
import Modal from '../../../shared/ui/Modal';
import RupiahInput from '../../../shared/form/RupiahInput';
import { uploadTeamMemberAvatar } from '../../../services/teamMembers';
import { TeamMember } from '../../../types';

export interface TeamMemberFormData {
    name: string;
    role: string;
    email: string;
    phone: string;
    standardFee: number;
    noRek: string;
    avatarUrl?: string;
    bankName?: string;
    category?: 'Tim' | 'Vendor';
}

export interface TeamMemberFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    formMode: 'add' | 'edit';
    formData: Omit<TeamMember, 'id' | 'rating' | 'performanceNotes' | 'portalAccessId'>;
    setFormData: React.Dispatch<React.SetStateAction<Omit<TeamMember, 'id' | 'rating' | 'performanceNotes' | 'portalAccessId'>>>;
    onSubmit: (e: React.FormEvent) => void;
    isSubmitting: boolean;
}

export const TeamMemberFormModal: React.FC<TeamMemberFormModalProps> = ({
    isOpen,
    onClose,
    formMode,
    formData,
    setFormData,
    onSubmit,
    isSubmitting
}) => {
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [avatarError, setAvatarError] = useState('');

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'standardFee' ? Number(value) : value
        }));
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.currentTarget;
        const file = input.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setAvatarError('Pilih file gambar yang valid.');
            input.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setAvatarError('Ukuran foto maksimal 5 MB.');
            input.value = '';
            return;
        }

        setAvatarError('');
        setIsUploadingAvatar(true);
        try {
            const avatarUrl = await uploadTeamMemberAvatar(file);
            setFormData(prev => ({ ...prev, avatarUrl }));
        } catch (error) {
            console.error('[TeamMemberForm] Avatar upload failed:', error);
            setAvatarError('Foto gagal diunggah. Periksa koneksi lalu coba lagi.');
        } finally {
            setIsUploadingAvatar(false);
            input.value = '';
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        if (isUploadingAvatar) {
            e.preventDefault();
            setAvatarError('Tunggu sampai foto selesai diunggah.');
            return;
        }
        onSubmit(e);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={formMode === 'add' ? 'Tambah Tim / Vendor' : 'Edit Tim / Vendor'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="hidden sm:block bg-blue-100 border border-blue-600/30 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                        <UsersIcon className="w-4 h-4" />
                        Informasi Tim / Vendor
                    </h4>
                    <p className="text-xs text-brand-text-secondary">
                        Tambahkan data lengkap Tim / Vendor yang akan bekerja sama dengan Anda. Data ini akan digunakan untuk manajemen Acara Pernikahan dan pembayaran.
                    </p>
                </div>

                <div>
                    <h5 className="text-sm font-semibold text-brand-text-light mb-3">Data Pribadi</h5>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border border-brand-border bg-brand-bg flex items-center justify-center text-xl font-bold text-brand-text-secondary">
                            {formData.avatarUrl ? (
                                <img src={formData.avatarUrl} alt="Foto profil Tim / Vendor" className="w-full h-full object-cover" />
                            ) : (
                                formData.name?.charAt(0).toUpperCase() || '?'
                            )}
                        </div>
                        <div>
                            <label htmlFor="team-member-avatar" className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-border text-sm font-medium ${isUploadingAvatar ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:bg-brand-input'}`}>
                                <Upload className="w-4 h-4" />
                                {isUploadingAvatar ? 'Mengunggah...' : formData.avatarUrl ? 'Ganti Foto Profil' : 'Unggah Foto Profil'}
                            </label>
                            <input id="team-member-avatar" type="file" accept="image/*" onChange={handleAvatarChange} disabled={isUploadingAvatar} className="sr-only" />
                            <p className="text-xs text-brand-text-secondary mt-1">JPG, PNG, atau WebP. Maksimal 5 MB.</p>
                            {avatarError && <p role="alert" className="text-xs text-red-600 mt-1">{avatarError}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="input-group">
                            <input type="text" id="name" name="name" value={formData.name} onChange={handleFormChange} className="input-field" placeholder=" " required />
                            <label htmlFor="name" className="input-label">Nama Tim / Freelance</label>
                            <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Nama lengkap anggota tim atau nama vendor</p>
                        </div>
                        <div className="input-group">
                            <input type="text" id="role" name="role" value={formData.role} onChange={handleFormChange} className="input-field" placeholder=" " required />
                            <label htmlFor="role" className="input-label">Role/Posisi</label>
                            <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Contoh: Make-Up Artist, Dekorator, Musisi</p>
                        </div>
                    </div>
                </div>

                <div>
                    <h5 className="text-sm font-semibold text-brand-text-light mb-3">Kontak</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="input-group">
                            <input type="email" id="email" name="email" value={formData.email} onChange={handleFormChange} className="input-field" placeholder=" " />
                            <label htmlFor="email" className="input-label">Email (Opsional)</label>
                            <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Email untuk komunikasi dan akses portal</p>
                        </div>
                        <div className="input-group">
                            <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleFormChange} className="input-field" placeholder=" " required />
                            <label htmlFor="phone" className="input-label">Nomor Telepon</label>
                            <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Nomor WhatsApp/telepon aktif</p>
                        </div>
                    </div>
                </div>

                <div>
                    <h5 className="text-sm font-semibold text-brand-text-light mb-3">Informasi Pembayaran</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="input-group">
                            <RupiahInput id="standardFee" value={formData.standardFee.toString()} onChange={(raw) => setFormData(prev => ({ ...prev, standardFee: Number(raw) }))} className="input-field" placeholder=" " />
                            <label htmlFor="standardFee" className="input-label">Fee Standar (IDR) (Opsional)</label>
                            <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Fee default per Acara Pernikahan dalam Rupiah</p>
                        </div>
                        <div className="input-group">
                            <input type="text" id="noRek" name="noRek" value={formData.noRek} onChange={handleFormChange} className="input-field" placeholder=" " />
                            <label htmlFor="noRek" className="input-label">Nomor Rekening</label>
                            <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Untuk transfer pembayaran (opsional)</p>
                        </div>
                    </div>
                </div>

                <div>
                    <h5 className="text-sm font-semibold text-brand-text-light mb-3">Kategori</h5>
                    <div className="input-group">
                        <select
                            id="category"
                            name="category"
                            value={formData.category}
                            onChange={handleFormChange}
                            className="input-field"
                        >
                            <option value="Tim">Tim Internal</option>
                            <option value="Vendor">Vendor Eksternal</option>
                        </select>
                        <label htmlFor="category" className="input-label">Pilih Kategori</label>
                        <p className="hidden sm:block text-xs text-brand-text-secondary mt-1">Pilih "Tim" untuk tim internal Anda, atau "Vendor" untuk pihak ketiga.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-brand-border">
                    <button type="button" onClick={onClose} className="button-secondary w-full sm:w-auto">Batal</button>
                    <button type="submit" disabled={isSubmitting} className="button-primary w-full sm:w-auto">{isSubmitting ? 'Menyimpan...' : (formMode === 'add' ? 'Simpan' : 'Update')}</button>
                </div>
            </form>
        </Modal>
    );
};

export default TeamMemberFormModal;
