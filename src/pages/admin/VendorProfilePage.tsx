import React, { useState, useEffect } from 'react';
import { 
  VendorProfile, VendorPortfolio, PortfolioImage,
  VendorProfileFaq, VendorProfilePartner, VendorProfileVideo
} from '../../types';
import { getVendorProfile, createOrUpdateVendorProfile, uploadVendorImage } from '../../services/vendorProfile';
import {
  listVendorPortfolios, createVendorPortfolio, deleteVendorPortfolio,
  uploadPortfolioCover, uploadPortfolioImages, updateVendorPortfolio, getVendorPortfolio
} from '../../services/vendorPortfolios';
import { 
  SaveIcon, UploadCloudIcon, XIcon, PlusIcon, TrashIcon, CameraIcon, 
  PencilIcon, EyeIcon, VideoIcon, HelpCircleIcon, HandshakeIcon
} from 'lucide-react';
import Modal from '../../shared/ui/Modal';
import { getEmbedVideoUrl } from '../../utils/videoUtils';

const DEFAULT_PORTFOLIO_CATEGORIES = ['Wedding', 'Prewedding', 'Engagement'];
const CUSTOM_CATEGORY_VALUE = '__custom_category__';

interface PortfolioCategoryFieldProps {
  categories: string[];
  value: string;
  customValue: string;
  isCustom: boolean;
  label: string;
  onValueChange: (value: string) => void;
  onCustomValueChange: (value: string) => void;
  onCustomModeChange: (isCustom: boolean) => void;
}

const PortfolioCategoryField: React.FC<PortfolioCategoryFieldProps> = ({
  categories, value, customValue, isCustom, label,
  onValueChange, onCustomValueChange, onCustomModeChange,
}) => (
  <div>
    <label className="block text-sm font-medium text-brand-text-secondary mb-1">{label}</label>
    <select
      required
      value={isCustom ? CUSTOM_CATEGORY_VALUE : value}
      onChange={event => {
        if (event.target.value === CUSTOM_CATEGORY_VALUE) {
          onCustomModeChange(true);
          onCustomValueChange('');
        } else {
          onCustomModeChange(false);
          onValueChange(event.target.value);
        }
      }}
      className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
    >
      <option value="" disabled>Pilih kategori...</option>
      {categories.map(category => <option key={category} value={category}>{category}</option>)}
      <option value={CUSTOM_CATEGORY_VALUE}>Kategori baru...</option>
    </select>
    {isCustom && (
      <input
        type="text"
        required
        value={customValue}
        onChange={event => onCustomValueChange(event.target.value)}
        className="mt-2 w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
        placeholder="Ketik kategori baru..."
      />
    )}
  </div>
);

// ─── Edit Portfolio Modal ─────────────────────────────────────────────────────
interface EditPortfolioModalProps {
  portfolio: VendorPortfolio;
  categoryOptions: string[];
  onClose: () => void;
  onUpdated: (updated: VendorPortfolio) => void;
}

const EditPortfolioModal: React.FC<EditPortfolioModalProps> = ({ portfolio, categoryOptions, onClose, onUpdated }) => {
  const [title, setTitle] = useState(portfolio.title);
  const [category, setCategory] = useState(portfolio.category);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState(portfolio.youtube_url || '');
  const [images, setImages] = useState<PortfolioImage[]>(portfolio.images || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const availableCategories = Array.from(new Set([
    ...DEFAULT_PORTFOLIO_CATEGORIES,
    ...categoryOptions,
    portfolio.category,
  ].map(option => option.trim()).filter(Boolean)));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await updateVendorPortfolio(portfolio.id, {
        title,
        category: (isCustomCategory ? customCategory : category).trim(),
        images,
        youtube_url: youtubeUrl,
      });
      onUpdated(updated);
      onClose();
    } catch {
      alert('Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      setUploading(true);
      const uploaded = await uploadPortfolioImages(portfolio.id, Array.from(e.target.files));
      const refreshed = await getVendorPortfolio(portfolio.id);
      if (refreshed) setImages(refreshed.images || []);
    } catch {
      alert('Gagal upload foto');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imgId: string) => {
    if (!confirm('Hapus foto ini?')) return;
    const newImages = images.filter(i => i.id !== imgId);
    setImages(newImages);
    await updateVendorPortfolio(portfolio.id, { images: newImages });
  };

  return (
    <Modal isOpen onClose={onClose} title={`Edit Portofolio`} size="4xl">
      <form onSubmit={handleSave} className="space-y-5 p-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Judul Acara</label>
            <input
              type="text" required value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
              placeholder="Contoh: Budi & Sinta Wedding"
            />
          </div>
          <PortfolioCategoryField
            categories={availableCategories}
            value={category}
            customValue={customCategory}
            isCustom={isCustomCategory}
            label="Kategori"
            onValueChange={setCategory}
            onCustomValueChange={setCustomCategory}
            onCustomModeChange={setIsCustomCategory}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-text-secondary mb-1">Link Video YouTube (Opsional)</label>
          <input
            type="text" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
            className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
            placeholder="Contoh: https://www.youtube.com/watch?v=..."
          />
        </div>

        {/* Photos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-brand-text-secondary">
              Foto-foto ({images.length})
            </span>
            <label className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-brand-input border border-brand-border rounded-lg hover:bg-brand-border transition-colors">
              <PlusIcon className="w-3.5 h-3.5" />
              {uploading ? 'Mengunggah...' : 'Tambah Foto'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} disabled={uploading} />
            </label>
          </div>

          {images.length > 0 ? (
            <div
              className="vendor-gallery-scroll grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[50vh] overflow-y-auto p-1"
              role="region"
              aria-label="Daftar foto portofolio"
              tabIndex={0}
            >
              {images.map((img) => (
                <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden group border border-brand-border">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(img.id)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-brand-border rounded-xl text-brand-text-secondary text-sm">
              Belum ada foto. Klik "Tambah Foto" untuk upload.
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2 border-t border-brand-border">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold">
            Batal
          </button>
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-brand-accent text-white hover:bg-brand-accent/90 rounded-xl font-semibold disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Main VendorProfilePage ───────────────────────────────────────────────────
const VendorProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<Partial<VendorProfile>>({
    hero_title: '',
    hero_subtitle: '',
    whatsapp_number: '',
    hero_images: [],
    videos: [],
    partners: [],
    faqs: [],
  });
  const [portfolios, setPortfolios] = useState<VendorPortfolio[]>([]);
  const portfolioCategories = Array.from(new Set([
    ...DEFAULT_PORTFOLIO_CATEGORIES,
    ...portfolios.map(portfolio => portfolio.category.trim()),
  ].filter(Boolean)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form states for new video, partner, and FAQ
  const [newVideo, setNewVideo] = useState({ title: '', url: '' });
  const [newPartner, setNewPartner] = useState({ name: '', logo_url: '' });
  const [uploadingPartnerLogo, setUploadingPartnerLogo] = useState(false);
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '' });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPortfolio, setNewPortfolio] = useState({ title: '', category: '', customCategory: '', isCustomCategory: false, youtube_url: '' });
  const [newPortfolioImages, setNewPortfolioImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);
  const [isUploadingNewPortfolioImages, setIsUploadingNewPortfolioImages] = useState(false);
  const [newPortfolioUploadProgress, setNewPortfolioUploadProgress] = useState(0);
  const [uploadingPortfolioId, setUploadingPortfolioId] = useState<string | null>(null);
  const [editingPortfolio, setEditingPortfolio] = useState<VendorPortfolio | null>(null);
  const [uploadingHeroSlot, setUploadingHeroSlot] = useState<number | null>(null);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const [profileData, portfoliosData] = await Promise.all([
        getVendorProfile(),
        listVendorPortfolios()
      ]);
      if (profileData) {
        const heroImgs = Array.isArray(profileData.hero_images) && profileData.hero_images.length > 0
          ? profileData.hero_images
          : (profileData.hero_image_url ? [profileData.hero_image_url] : []);
        setProfile({
          ...profileData,
          hero_images: heroImgs,
        });
      }
      setPortfolios(portfoliosData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const heroImgs = (profile.hero_images || []).filter(Boolean);
      const payload: Partial<VendorProfile> = {
        ...profile,
        hero_images: heroImgs,
        hero_image_url: heroImgs[0] || profile.hero_image_url || '',
      };
      await createOrUpdateVendorProfile(payload);
      setMessage('Profil berhasil disimpan');
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      setUploadingBannerImage(true);
      const url = await uploadVendorImage(file, 'vendor/page-banner');
      setProfile(prev => ({ ...prev, page_banner_image_url: url }));
    } catch {
      alert('Gagal upload gambar banner');
    } finally {
      setUploadingBannerImage(false);
      input.value = '';
    }
  };

  // ─── Hero Images Handlers (Up to 3 images) ───
  const handleHeroSlotUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      setUploadingHeroSlot(slotIndex);
      const url = await uploadVendorImage(e.target.files[0], `vendor/hero-slot-${slotIndex}`);
      const current = [...(profile.hero_images || [])];
      while (current.length <= slotIndex) {
        current.push('');
      }
      current[slotIndex] = url;
      const filtered = current.filter(Boolean).slice(0, 3);
      setProfile(prev => ({
        ...prev,
        hero_images: filtered,
        hero_image_url: filtered[0] || '',
      }));
    } catch {
      alert('Gagal upload gambar hero');
    } finally {
      setUploadingHeroSlot(null);
    }
  };

  const handleDeleteHeroSlot = (slotIndex: number) => {
    const current = [...(profile.hero_images || [])];
    current.splice(slotIndex, 1);
    setProfile(prev => ({
      ...prev,
      hero_images: current,
      hero_image_url: current[0] || '',
    }));
  };

  // ─── Video Handlers ───
  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideo.url.trim()) return;
    const item: VendorProfileVideo = {
      id: `vid-${Date.now()}`,
      title: newVideo.title.trim() || 'Video Highlight',
      url: newVideo.url.trim(),
    };
    setProfile(prev => ({ ...prev, videos: [...(prev.videos || []), item] }));
    setNewVideo({ title: '', url: '' });
  };

  const handleDeleteVideo = (id: string) => {
    setProfile(prev => ({ ...prev, videos: (prev.videos || []).filter(v => v.id !== id) }));
  };

  // ─── Partners Handlers ───
  const handlePartnerLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      setUploadingPartnerLogo(true);
      const url = await uploadVendorImage(e.target.files[0], 'vendor/partners');
      setNewPartner(prev => ({ ...prev, logo_url: url }));
    } catch {
      alert('Gagal upload logo');
    } finally {
      setUploadingPartnerLogo(false);
    }
  };

  const handleAddPartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.name.trim()) return;
    const item: VendorProfilePartner = {
      id: `partner-${Date.now()}`,
      name: newPartner.name.trim(),
      logo_url: newPartner.logo_url.trim() || 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=300&q=80',
    };
    setProfile(prev => ({ ...prev, partners: [...(prev.partners || []), item] }));
    setNewPartner({ name: '', logo_url: '' });
  };

  const handleDeletePartner = (id: string) => {
    setProfile(prev => ({ ...prev, partners: (prev.partners || []).filter(p => p.id !== id) }));
  };

  // ─── FAQ Handlers ───
  const handleAddFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaq.question.trim() || !newFaq.answer.trim()) return;
    const item: VendorProfileFaq = {
      id: `faq-${Date.now()}`,
      question: newFaq.question.trim(),
      answer: newFaq.answer.trim(),
    };
    setProfile(prev => ({ ...prev, faqs: [...(prev.faqs || []), item] }));
    setNewFaq({ question: '', answer: '' });
  };

  const handleDeleteFaq = (id: string) => {
    setProfile(prev => ({ ...prev, faqs: (prev.faqs || []).filter(f => f.id !== id) }));
  };

  const handleSelectNewPortfolioImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewPortfolioImages(current => [
      ...current,
      ...files.map(file => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
    e.target.value = '';
  };

  const handleRemoveNewPortfolioImage = (previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
    setNewPortfolioImages(current => current.filter(image => image.previewUrl !== previewUrl));
  };

  const clearNewPortfolioImages = () => {
    newPortfolioImages.forEach(image => URL.revokeObjectURL(image.previewUrl));
    setNewPortfolioImages([]);
    setNewPortfolioUploadProgress(0);
  };

  const closeCreatePortfolioModal = () => {
    clearNewPortfolioImages();
    setIsCreateModalOpen(false);
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    const category = (newPortfolio.isCustomCategory ? newPortfolio.customCategory : newPortfolio.category).trim();
    if (!newPortfolio.title.trim() || !category) return;
    const selectedFiles = newPortfolioImages.map(image => image.file);
    try {
      setIsCreatingPortfolio(true);
      const created = await createVendorPortfolio({
        title: newPortfolio.title.trim(),
        category,
        youtube_url: newPortfolio.youtube_url.trim(),
        images: []
      } as any);

      setPortfolios(current => [created, ...current]);
      if (selectedFiles.length > 0) {
        setIsUploadingNewPortfolioImages(true);
        setNewPortfolioUploadProgress(0);
        try {
          const uploadedImages = await uploadPortfolioImages(
            created.id,
            selectedFiles,
            setNewPortfolioUploadProgress
          );
          setPortfolios(current => current.map(portfolio =>
            portfolio.id === created.id ? { ...portfolio, images: uploadedImages } : portfolio
          ));
        } catch (err: any) {
          closeCreatePortfolioModal();
          setNewPortfolio({ title: '', category: '', customCategory: '', isCustomCategory: false, youtube_url: '' });
          alert(err?.message || 'Portofolio dibuat, tetapi gagal mengunggah foto. Anda dapat mengunggahnya melalui menu edit portofolio.');
          return;
        }
      }

      setIsCreateModalOpen(false);
      setNewPortfolio({ title: '', category: '', customCategory: '', isCustomCategory: false, youtube_url: '' });
      clearNewPortfolioImages();
    } catch (err: any) {
      alert(err?.message || 'Gagal membuat portofolio');
    } finally {
      setIsCreatingPortfolio(false);
      setIsUploadingNewPortfolioImages(false);
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    if (!confirm('Yakin ingin menghapus portofolio ini beserta semua fotonya?')) return;
    try {
      await deleteVendorPortfolio(id);
      setPortfolios(portfolios.filter(p => p.id !== id));
    } catch { alert('Gagal menghapus portofolio'); }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      setUploadingPortfolioId(id);
      const url = await uploadPortfolioCover(id, e.target.files[0]);
      setPortfolios(portfolios.map(p => p.id === id ? { ...p, cover_image_url: url } : p));
    } catch { alert('Gagal upload cover'); }
    finally { setUploadingPortfolioId(null); }
  };

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      setUploadingPortfolioId(id);
      const uploaded = await uploadPortfolioImages(id, Array.from(e.target.files));
      setPortfolios(portfolios.map(p => p.id === id ? { ...p, images: [...(p.images || []), ...uploaded] } : p));
    } catch { alert('Gagal upload gambar'); }
    finally { setUploadingPortfolioId(null); }
  };

  if (loading) return <div className="p-8 flex items-center gap-3 text-brand-text-secondary"><div className="w-5 h-5 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"/>Memuat...</div>;

  const heroImages = profile.hero_images || [];

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Profil Vendor</h1>
          <p className="text-sm text-brand-text-secondary mt-1">Kelola tampilan halaman profil publik vendor, slider hero, video, rekanan/kerjasama, dan FAQ.</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="#/profile"
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 border border-brand-border text-brand-text-primary rounded-xl font-semibold hover:bg-brand-input transition-colors text-sm"
          >
            <EyeIcon className="w-4 h-4" />
            Lihat Publik
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-xl font-semibold hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
          >
            <SaveIcon className="w-5 h-5" />
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium ${message.includes('Gagal') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {message}
        </div>
      )}

      {/* ─── 1. Hero Section & Slider Background (Max 3 Images) ─── */}
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-6">
        <div className="border-b border-brand-border pb-4">
          <h2 className="text-lg font-bold text-brand-text-primary">Hero Section & Background Slider (Header)</h2>
          <p className="text-xs text-brand-text-secondary mt-1">
            Unggah hingga 3 gambar background untuk header profil publik. Header akan otomatis menjadi slider/slide bergantian.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-text-secondary mb-1">Judul Hero</label>
              <input type="text" value={profile.hero_title || ''} onChange={e => setProfile({ ...profile, hero_title: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none"
                placeholder="Contoh: Capture Your Best Moments" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-secondary mb-1">Sub-judul / Deskripsi</label>
              <textarea value={profile.hero_subtitle || ''} onChange={e => setProfile({ ...profile, hero_subtitle: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none min-h-[100px]"
                placeholder="Contoh: Jasa dokumentasi pernikahan terbaik..." />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-brand-text-secondary">
                Gambar Hero (Maksimal 3 Gambar Slide)
              </label>
              <span className="text-xs text-brand-accent font-semibold">
                {heroImages.length} / 3 Gambar Terpasang
              </span>
            </div>

            {/* 3-Slot Grid for Hero Images */}
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((slotIdx) => {
                const imgUrl = heroImages[slotIdx];
                const isUploading = uploadingHeroSlot === slotIdx;

                return (
                  <div key={slotIdx} className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-brand-text-secondary block">
                      Slide {slotIdx + 1} {slotIdx === 0 ? '(Utama)' : ''}
                    </span>
                    {imgUrl ? (
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-brand-border group shadow-sm bg-gray-100">
                        <img src={imgUrl} alt={`Slide ${slotIdx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1">
                          <label className="cursor-pointer px-2 py-1 bg-white text-gray-900 font-medium text-[10px] rounded hover:bg-gray-100 transition-colors">
                            {isUploading ? '...' : 'Ganti'}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleHeroSlotUpload(e, slotIdx)} disabled={isUploading} />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeleteHeroSlot(slotIdx)}
                            className="px-2 py-1 bg-red-600 text-white font-medium text-[10px] rounded hover:bg-red-700 transition-colors"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center aspect-video border-2 border-dashed border-brand-border rounded-xl cursor-pointer hover:bg-brand-input/50 transition-colors text-center p-2">
                        {isUploading ? (
                          <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <UploadCloudIcon className="w-5 h-5 text-brand-text-secondary mb-1 opacity-60" />
                            <span className="text-[10px] text-brand-text-secondary">+ Upload</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleHeroSlotUpload(e, slotIdx)} disabled={isUploading} />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-brand-text-secondary mt-2">
              Gambar-gambar ini akan menjadi latar belakang slider bergantian di bagian paling atas halaman profil publik.
            </p>
          </div>
        </div>
      </div>

      {/* ─── 2. Page Banner ─── */}
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-6">
        <div className="border-b border-brand-border pb-4">
          <h2 className="text-lg font-bold text-brand-text-primary">Banner Halaman</h2>
          <p className="text-sm text-brand-text-secondary mt-1">
            Buat sorotan visual di antara perkenalan dan portofolio pada halaman profil publik.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-brand-text-primary mb-1.5">Judul Banner</label>
              <input
                type="text"
                value={profile.page_banner_title || ''}
                onChange={e => setProfile(prev => ({ ...prev, page_banner_title: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none"
                placeholder="Contoh: Cerita indah, dalam setiap bingkai"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-text-primary mb-1.5">Deskripsi Banner</label>
              <textarea
                value={profile.page_banner_subtitle || ''}
                onChange={e => setProfile(prev => ({ ...prev, page_banner_subtitle: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none min-h-[110px]"
                placeholder="Tambahkan kalimat singkat tentang layanan atau gaya karya Anda."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-brand-text-primary mb-1.5">Gambar Banner</label>
            {profile.page_banner_image_url ? (
              <div className="relative aspect-[16/9] rounded-xl overflow-hidden border border-brand-border bg-brand-input">
                <img src={profile.page_banner_image_url} alt="Pratinjau banner halaman" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/35 flex items-end justify-between p-3">
                  <label className="cursor-pointer px-3 py-2 bg-white text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors">
                    {uploadingBannerImage ? 'Mengunggah...' : 'Ganti gambar'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingBannerImage}
                      onChange={handleBannerImageUpload}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setProfile(prev => ({ ...prev, page_banner_image_url: '' }))}
                    className="px-3 py-2 bg-white text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-[16/9] border-2 border-dashed border-brand-border rounded-xl cursor-pointer hover:bg-brand-input/50 transition-colors text-center p-4">
                {uploadingBannerImage ? (
                  <div className="w-5 h-5 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <UploadCloudIcon className="w-7 h-7 text-brand-text-secondary mb-2 opacity-60" />
                    <span className="text-sm font-semibold text-brand-text-primary">Unggah gambar banner</span>
                    <span className="text-xs text-brand-text-secondary mt-1">Rasio lebar 16:9 direkomendasikan</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingBannerImage}
                  onChange={handleBannerImageUpload}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. Section Video ─── */}
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-6">
        <div className="border-b border-brand-border pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-text-primary flex items-center gap-2">
              <VideoIcon className="w-5 h-5 text-brand-accent" />
              Section Video
            </h2>
            <p className="text-xs text-brand-text-secondary mt-0.5">
              Tampilkan video teaser atau sinematik highlight pernikahan (YouTube / Vimeo) di halaman profil publik.
            </p>
          </div>
        </div>

        {/* Form Tambah Video */}
        <form onSubmit={handleAddVideo} className="bg-brand-input/50 border border-brand-border rounded-xl p-4 space-y-3">
          <span className="text-xs font-bold text-brand-text-primary uppercase tracking-wider block">Tambah Video Baru</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-brand-text-secondary mb-1">Judul / Keterangan Video</label>
              <input
                type="text"
                value={newVideo.title}
                onChange={e => setNewVideo({ ...newVideo, title: e.target.value })}
                placeholder="Contoh: Cinematic Wedding Highlight"
                className="w-full px-3 py-2 text-sm rounded-lg bg-brand-surface border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-text-secondary mb-1">Link URL Video (YouTube / Vimeo)</label>
              <input
                type="text"
                required
                value={newVideo.url}
                onChange={e => setNewVideo({ ...newVideo, url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-brand-surface border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-accent text-white rounded-lg text-xs font-bold hover:bg-brand-accent/90 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Tambah Video
            </button>
          </div>
        </form>

        {/* List of Videos */}
        {profile.videos && profile.videos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.videos.map((vid) => {
              const embedUrl = getEmbedVideoUrl(vid.url);
              return (
                <div key={vid.id} className="border border-brand-border rounded-xl p-3 bg-brand-surface space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-brand-text-primary line-clamp-1">{vid.title}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteVideo(vid.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                      title="Hapus Video"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="aspect-video rounded-lg overflow-hidden bg-black/90 relative">
                    {embedUrl ? (
                      <iframe
                        src={embedUrl}
                        title={vid.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        URL video tidak valid
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-text-secondary truncate">{vid.url}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-brand-text-secondary border-2 border-dashed border-brand-border rounded-xl">
            <VideoIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Belum ada video yang ditambahkan.</p>
          </div>
        )}
      </div>

      {/* ─── 3. Section Kerjasama & Rekanan (Partners dengan Logo) ─── */}
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-6">
        <div className="border-b border-brand-border pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-text-primary flex items-center gap-2">
              <HandshakeIcon className="w-5 h-5 text-brand-accent" />
              Section Kerjasama & Mitra (Dengan Logo)
            </h2>
            <p className="text-xs text-brand-text-secondary mt-0.5">
              Tampilkan logo hotel, venue, wedding organizer, atau rekanan vendor yang pernah bekerja sama.
            </p>
          </div>
        </div>

        {/* Form Tambah Partner */}
        <form onSubmit={handleAddPartner} className="bg-brand-input/50 border border-brand-border rounded-xl p-4 space-y-3">
          <span className="text-xs font-bold text-brand-text-primary uppercase tracking-wider block">Tambah Mitra / Rekanan Baru</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-brand-text-secondary mb-1">Nama Mitra / Venue / Brand</label>
              <input
                type="text"
                required
                value={newPartner.name}
                onChange={e => setNewPartner({ ...newPartner, name: e.target.value })}
                placeholder="Contoh: The Dharmawangsa Hotel"
                className="w-full px-3 py-2 text-sm rounded-lg bg-brand-surface border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-text-secondary mb-1">Logo Mitra (Upload atau Masukkan URL)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPartner.logo_url}
                  onChange={e => setNewPartner({ ...newPartner, logo_url: e.target.value })}
                  placeholder="https://... atau upload file"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-brand-surface border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
                />
                <label className="cursor-pointer shrink-0 px-3 py-2 bg-brand-surface border border-brand-border hover:bg-brand-input text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors">
                  <UploadCloudIcon className="w-3.5 h-3.5" />
                  {uploadingPartnerLogo ? '...' : 'Upload'}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePartnerLogoUpload} disabled={uploadingPartnerLogo} />
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-accent text-white rounded-lg text-xs font-bold hover:bg-brand-accent/90 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Tambah Mitra
            </button>
          </div>
        </form>

        {/* Grid of Partners */}
        {profile.partners && profile.partners.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {profile.partners.map((partner) => (
              <div key={partner.id} className="relative border border-brand-border rounded-xl p-3 bg-brand-surface text-center group flex flex-col items-center justify-between shadow-sm">
                <button
                  type="button"
                  onClick={() => handleDeletePartner(partner.id)}
                  className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Hapus Mitra"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
                <div className="w-20 h-16 flex items-center justify-center my-2 p-1 bg-gray-50 rounded-lg">
                  {partner.logo_url ? (
                    <img src={partner.logo_url} alt={partner.name} className="max-h-full max-w-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300" />
                  ) : (
                    <HandshakeIcon className="w-8 h-8 text-gray-300" />
                  )}
                </div>
                <span className="font-semibold text-xs text-brand-text-primary mt-1 line-clamp-1">{partner.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-brand-text-secondary border-2 border-dashed border-brand-border rounded-xl">
            <HandshakeIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Belum ada mitra kerjasama yang ditambahkan.</p>
          </div>
        )}
      </div>

      {/* ─── 4. Section FAQ (PAQ) ─── */}
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-6">
        <div className="border-b border-brand-border pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-text-primary flex items-center gap-2">
              <HelpCircleIcon className="w-5 h-5 text-brand-accent" />
              Section FAQ (Pertanyaan yang Sering Diajukan)
            </h2>
            <p className="text-xs text-brand-text-secondary mt-0.5">
              Daftar tanya-jawab umum untuk mempermudah calon pengantin memahami alur kerja Anda.
            </p>
          </div>
        </div>

        {/* Form Tambah FAQ */}
        <form onSubmit={handleAddFaq} className="bg-brand-input/50 border border-brand-border rounded-xl p-4 space-y-3">
          <span className="text-xs font-bold text-brand-text-primary uppercase tracking-wider block">Tambah Pertanyaan Baru</span>
          <div>
            <label className="block text-xs font-medium text-brand-text-secondary mb-1">Pertanyaan</label>
            <input
              type="text"
              required
              value={newFaq.question}
              onChange={e => setNewFaq({ ...newFaq, question: e.target.value })}
              placeholder="Contoh: Berapa lama waktu penyerahan hasil foto dan video?"
              className="w-full px-3 py-2 text-sm rounded-lg bg-brand-surface border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-text-secondary mb-1">Jawaban</label>
            <textarea
              required
              rows={3}
              value={newFaq.answer}
              onChange={e => setNewFaq({ ...newFaq, answer: e.target.value })}
              placeholder="Contoh: Preview 10 foto terbaik dikirim dalam 3 hari. Full album dan video jadi dalam 3-4 minggu."
              className="w-full px-3 py-2 text-sm rounded-lg bg-brand-surface border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-accent text-white rounded-lg text-xs font-bold hover:bg-brand-accent/90 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Tambah FAQ
            </button>
          </div>
        </form>

        {/* List of FAQs */}
        {profile.faqs && profile.faqs.length > 0 ? (
          <div className="space-y-3">
            {profile.faqs.map((faq, idx) => (
              <div key={faq.id} className="border border-brand-border rounded-xl p-4 bg-brand-surface space-y-1 relative group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xs font-bold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full shrink-0">
                      Q{idx + 1}
                    </span>
                    <h4 className="font-bold text-sm text-brand-text-primary">{faq.question}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteFaq(faq.id)}
                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors shrink-0"
                    title="Hapus Pertanyaan"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-brand-text-secondary pl-9 leading-relaxed whitespace-pre-line">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-brand-text-secondary border-2 border-dashed border-brand-border rounded-xl">
            <HelpCircleIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Belum ada FAQ yang ditambahkan.</p>
          </div>
        )}
      </div>

      {/* ─── 5. Kontak ─── */}
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-6">
        <h2 className="text-lg font-bold text-brand-text-primary border-b border-brand-border pb-4">Kontak</h2>
        <div>
          <label className="block text-sm font-medium text-brand-text-secondary mb-1">Nomor WhatsApp (dengan kode negara)</label>
          <input type="text" value={profile.whatsapp_number || ''} onChange={e => setProfile({ ...profile, whatsapp_number: e.target.value })}
            className="w-full max-w-md px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none"
            placeholder="Contoh: +6281234567890" />
          <p className="text-xs text-brand-text-secondary mt-1">Nomor ini akan digunakan untuk tombol direct WA di profil publik.</p>
        </div>
      </div>

      {/* ─── Portofolio Acara ─── */}
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-6">
        <div className="flex flex-col items-start gap-3 border-b border-brand-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-text-primary">Portofolio Acara</h2>
            <p className="text-sm text-brand-text-secondary mt-0.5">{portfolios.length} portofolio</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg font-semibold hover:bg-brand-accent/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Tambah Portofolio
          </button>
        </div>

        {portfolios.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {portfolios.map(portfolio => (
              <div key={portfolio.id} className="border border-brand-border rounded-xl overflow-hidden shadow-sm flex flex-col group">
                {/* Cover */}
                <div className="aspect-video bg-gray-100 relative overflow-hidden">
                  {portfolio.cover_image_url ? (
                    <img src={portfolio.cover_image_url} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <CameraIcon className="w-8 h-8 mb-2 opacity-40" />
                      <span className="text-xs">No Cover</span>
                    </div>
                  )}
                  {/* Hover overlay for cover upload */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <label className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium">
                      {uploadingPortfolioId === portfolio.id ? 'Mengunggah...' : 'Ganti Cover'}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadCover(e, portfolio.id)} disabled={uploadingPortfolioId === portfolio.id} />
                    </label>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex-grow flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-brand-text-primary line-clamp-1">{portfolio.title}</h3>
                      <span className="inline-block px-2 py-0.5 bg-brand-accent/10 text-brand-accent text-xs font-semibold rounded-md mt-1">{portfolio.category}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto flex gap-2">
                    <label className="flex-1 cursor-pointer text-center bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 py-1.5 rounded-lg text-xs font-medium transition-colors">
                      {uploadingPortfolioId === portfolio.id ? 'Uploading...' : `Upload Foto (${portfolio.images?.length || 0})`}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUploadImages(e, portfolio.id)} disabled={uploadingPortfolioId === portfolio.id} />
                    </label>
                    <button
                      onClick={() => setEditingPortfolio(portfolio)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <PencilIcon className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeletePortfolio(portfolio.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-brand-text-secondary border-2 border-dashed border-brand-border rounded-xl">
            <CameraIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Belum ada portofolio.</p>
            <p className="text-sm mt-1">Klik "Tambah Portofolio" untuk mulai.</p>
          </div>
        )}
      </div>

      {/* ─── Modal Tambah Portofolio ─── */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (!isCreatingPortfolio) closeCreatePortfolioModal();
        }}
        title="Tambah Portofolio Baru"
      >
        <form onSubmit={handleCreatePortfolio} className="space-y-4 p-2">
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Judul Acara</label>
            <input type="text" required value={newPortfolio.title} onChange={e => setNewPortfolio({ ...newPortfolio, title: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
              placeholder="Contoh: Budi & Sinta Wedding" />
          </div>
          <PortfolioCategoryField
            categories={portfolioCategories}
            value={newPortfolio.category}
            customValue={newPortfolio.customCategory}
            isCustom={newPortfolio.isCustomCategory}
            label="Kategori / Layanan"
            onValueChange={category => setNewPortfolio(current => ({ ...current, category }))}
            onCustomValueChange={customCategory => setNewPortfolio(current => ({ ...current, customCategory }))}
            onCustomModeChange={isCustomCategory => setNewPortfolio(current => ({ ...current, isCustomCategory }))}
          />
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Link Video YouTube (Opsional)</label>
            <input type="text" value={newPortfolio.youtube_url} onChange={e => setNewPortfolio({ ...newPortfolio, youtube_url: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-brand-input border border-brand-border focus:ring-2 focus:ring-brand-accent outline-none"
              placeholder="Contoh: https://www.youtube.com/watch?v=..." />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-brand-text-secondary">
                Foto Portofolio ({newPortfolioImages.length})
              </span>
              <label className={`cursor-pointer inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 bg-brand-input border border-brand-border rounded-lg hover:bg-brand-border transition-colors ${isCreatingPortfolio ? 'opacity-50 pointer-events-none' : ''}`}>
                <UploadCloudIcon className="w-4 h-4" />
                Pilih Foto
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleSelectNewPortfolioImages}
                  disabled={isCreatingPortfolio}
                />
              </label>
            </div>

            {newPortfolioImages.length > 0 ? (
              <div className="vendor-gallery-scroll grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1">
                {newPortfolioImages.map(({ file, previewUrl }) => (
                  <div key={previewUrl} className="relative aspect-square rounded-lg overflow-hidden group border border-brand-border">
                    <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveNewPortfolioImage(previewUrl)}
                      disabled={isCreatingPortfolio}
                      aria-label={`Hapus ${file.name} dari pilihan foto`}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-5 border-2 border-dashed border-brand-border rounded-xl text-brand-text-secondary text-sm">
                Belum ada foto dipilih
              </div>
            )}

            {isUploadingNewPortfolioImages && (
              <div className="space-y-2" role="status" aria-live="polite">
                <div className="flex items-center justify-between text-xs text-brand-text-secondary">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                    Mengunggah foto...
                  </span>
                  <span>{newPortfolioUploadProgress}%</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-brand-input"
                  role="progressbar"
                  aria-label="Progres upload foto"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={newPortfolioUploadProgress}
                >
                  <div
                    className="h-full bg-brand-accent transition-all duration-300"
                    style={{ width: `${newPortfolioUploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-4 border-t border-brand-border">
            <button type="button" onClick={closeCreatePortfolioModal} disabled={isCreatingPortfolio} className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold disabled:opacity-50">Batal</button>
            <button type="submit" disabled={isCreatingPortfolio} className="flex-1 px-4 py-2 bg-brand-accent text-white hover:bg-brand-accent/90 rounded-xl font-semibold disabled:opacity-50">
              {isUploadingNewPortfolioImages ? `Mengunggah ${newPortfolioUploadProgress}%` : isCreatingPortfolio ? 'Menyimpan...' : 'Buat Portofolio'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit Portfolio Modal ─── */}
      {editingPortfolio && (
        <EditPortfolioModal
          portfolio={editingPortfolio}
          categoryOptions={portfolioCategories}
          onClose={() => setEditingPortfolio(null)}
          onUpdated={(updated) => {
            setPortfolios(portfolios.map(p => p.id === updated.id ? updated : p));
            setEditingPortfolio(null);
          }}
        />
      )}
    </div>
  );
};

export default VendorProfilePage;
