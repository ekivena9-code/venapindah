import React, { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { Profile, Gallery, REGIONS } from '../../../types';
import Modal from '../../../shared/ui/Modal';
import { UploadIcon, TrashIcon, LinkIcon, MapPinIcon, PlusIcon, FileTextIcon, CameraIcon } from '../../../constants';
import { createGallery, listGalleries, uploadGalleryImages, deleteGallery, updateGallery, uploadCoverImage, uploadGalleryPdf, deleteGalleryImage, reorderGalleryImages } from '../../../services/galleries';
import { getGalleryPublicRouteId } from '../../../utils/publicRouting';
import { useSupabaseRealtimeRefresh } from '../../../hooks/useSupabaseRealtimeRefresh';

interface GalleryUploadProps {
    userProfile: Profile;
    showNotification: (message: string) => void;
}

// Booking links per region configuration
const BOOKING_LINKS_BY_REGION = [
    { value: '', label: 'Gunakan Default (berdasarkan wilayah)' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'jabodetabek', label: 'Jabodetabek' },
    { value: 'banten', label: 'Banten' },
];

interface GalleryDraftImagePickerProps {
    inputId: string;
    files: File[];
    onFilesSelected: (files: File[]) => void;
    onRemoveFile: (index: number) => void;
    disabled: boolean;
    isUploading: boolean;
    progress: number;
}

const GalleryDraftImagePicker: React.FC<GalleryDraftImagePickerProps> = ({
    inputId,
    files,
    onFilesSelected,
    onRemoveFile,
    disabled,
    isUploading,
    progress,
}) => {
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);

    useEffect(() => {
        const urls = files.map(file => URL.createObjectURL(file));
        setPreviewUrls(urls);
        return () => urls.forEach(url => URL.revokeObjectURL(url));
    }, [files]);

    return (
        <div className="space-y-3 rounded-xl border border-brand-border/50 bg-brand-bg/30 p-3">
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-brand-text-light">Foto Pricelist ({files.length})</span>
                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-brand-accent/30 bg-brand-accent/5 px-3 py-2 text-xs font-semibold text-brand-accent transition-colors hover:bg-brand-accent/10 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
                    <UploadIcon className="h-4 w-4" />
                    Pilih Foto
                    <input
                        id={inputId}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        disabled={disabled}
                        onChange={event => {
                            onFilesSelected(Array.from(event.target.files || []));
                            event.target.value = '';
                        }}
                    />
                </label>
            </div>

            {files.length > 0 ? (
                <div className="vendor-gallery-scroll grid max-h-48 grid-cols-3 gap-2 overflow-y-auto p-1 sm:grid-cols-4">
                    {files.map((file, index) => (
                        <div key={`${file.name}-${file.lastModified}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border border-brand-border">
                            {previewUrls[index] && <img src={previewUrls[index]} alt={file.name} className="h-full w-full object-cover" />}
                            <button
                                type="button"
                                onClick={() => onRemoveFile(index)}
                                disabled={disabled}
                                aria-label={`Hapus ${file.name} dari pilihan foto`}
                                className="absolute right-1 top-1 rounded-md bg-red-600 p-1 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-50"
                            >
                                <TrashIcon className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border border-dashed border-brand-border px-3 py-4 text-center text-xs text-brand-text-secondary">
                    Belum ada foto dipilih
                </div>
            )}

            {isUploading && (
                <div className="space-y-2" role="status" aria-live="polite">
                    <div className="flex items-center justify-between text-xs text-brand-text-secondary">
                        <span className="inline-flex items-center gap-2">
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-accent border-t-transparent" aria-hidden="true" />
                            Mengunggah foto...
                        </span>
                        <span>{progress}%</span>
                    </div>
                    <div
                        className="h-2 overflow-hidden rounded-full bg-brand-input"
                        role="progressbar"
                        aria-label="Progres upload foto Pricelist"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                    >
                        <div className="h-full bg-brand-accent transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            )}
        </div>
    );
};

const GalleryUpload: React.FC<GalleryUploadProps> = ({ userProfile, showNotification }) => {
    const [galleries, setGalleries] = useState<Gallery[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createImageFiles, setCreateImageFiles] = useState<File[]>([]);
    const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
    const [isUploadingDraftImages, setIsUploadingDraftImages] = useState(false);
    const [draftImageUploadProgress, setDraftImageUploadProgress] = useState(0);

    const [newGallery, setNewGallery] = useState({
        title: '',
        region: '',
        description: '',
        is_public: true,
        booking_link: ''
    });

    const [editGallery, setEditGallery] = useState({
        title: '',
        region: '',
        description: '',
        is_public: true,
        booking_link: ''
    });

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
    const [pdfDisplayName, setPdfDisplayName] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
    const [isAllPhotosOpen, setIsAllPhotosOpen] = useState(false);

    useEffect(() => {
        loadGalleries();
    }, []);

    const loadGalleries = async () => {
        try {
            setIsLoading(true);
            const data = await listGalleries();
            setGalleries(data);
        } catch (error) {
            console.error('Error loading galleries:', error);
            showNotification('Gagal memuat Pricelist');
        } finally {
            setIsLoading(false);
        }
    };

    useSupabaseRealtimeRefresh('dashboard-galleries', ['galleries'], loadGalleries);

    const validateDraftImageFiles = (files: File[]) => files.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
            showNotification(`File ${file.name} terlalu besar (max 10MB)`);
            return false;
        }
        if (!file.type.startsWith('image/')) {
            showNotification(`File ${file.name} bukan gambar`);
            return false;
        }
        return true;
    });

    const handleCreateDraftFiles = (files: File[]) => {
        const validFiles = validateDraftImageFiles(files);
        setCreateImageFiles(current => [...current, ...validFiles]);
    };

    const handleEditDraftFiles = (files: File[]) => {
        const validFiles = validateDraftImageFiles(files);
        setEditImageFiles(current => [...current, ...validFiles]);
    };

    const handleCreateGallery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGallery.title.trim() || !newGallery.region.trim()) {
            showNotification('Judul dan daerah harus diisi');
            return;
        }

        const filesToUpload = createImageFiles;
        let createdGallery: Gallery | null = null;
        let uploadedCount = 0;
        try {
            setIsSubmitting(true);
            createdGallery = await createGallery({
                user_id: userProfile.adminUserId,
                title: newGallery.title.trim(),
                region: newGallery.region.trim(),
                description: newGallery.description.trim(),
                is_public: newGallery.is_public,
                booking_link: newGallery.booking_link?.trim() || undefined,
                images: []
            });

            if (filesToUpload.length > 0) {
                setIsUploadingDraftImages(true);
                setDraftImageUploadProgress(0);
                const uploadedImages = await uploadGalleryImages(
                    createdGallery.id,
                    filesToUpload,
                    setDraftImageUploadProgress
                );
                uploadedCount = uploadedImages.length;
                setDraftImageUploadProgress(100);
                createdGallery = { ...createdGallery, images: [...createdGallery.images, ...uploadedImages] };
            }

            setGalleries(prev => [createdGallery!, ...prev]);
            setIsCreateModalOpen(false);
            setNewGallery({ title: '', region: '', description: '', is_public: true, booking_link: '' });
            setCreateImageFiles([]);
            showNotification(filesToUpload.length > 0
                ? uploadedCount === filesToUpload.length
                    ? `Pricelist berhasil dibuat dengan ${uploadedCount} foto`
                    : `Pricelist dibuat, ${uploadedCount} dari ${filesToUpload.length} foto berhasil diunggah`
                : 'Pricelist berhasil dibuat');
        } catch (error) {
            console.error('Error creating gallery:', error);
            if (createdGallery) {
                setGalleries(prev => [createdGallery!, ...prev]);
                setIsCreateModalOpen(false);
                setNewGallery({ title: '', region: '', description: '', is_public: true, booking_link: '' });
                setCreateImageFiles([]);
                showNotification('Pricelist dibuat, tetapi foto gagal diunggah. Anda dapat menambahkannya nanti.');
            } else {
                showNotification('Gagal membuat Pricelist');
            }
        } finally {
            setIsSubmitting(false);
            setIsUploadingDraftImages(false);
            setDraftImageUploadProgress(0);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const validFiles = files.filter(file => {
                if (file.size > 10 * 1024 * 1024) {
                    showNotification(`File ${file.name} terlalu besar (max 10MB)`);
                    return false;
                }
                if (!file.type.startsWith('image/')) {
                    showNotification(`File ${file.name} bukan gambar`);
                    return false;
                }
                return true;
            });
            setSelectedFiles(validFiles);
        }
    };

    const handleUploadImages = async () => {
        if (!selectedGallery || selectedFiles.length === 0) return;

        try {
            setIsSubmitting(true);
            setUploadProgress(0);

            const uploadedImages = await uploadGalleryImages(
                selectedGallery.id,
                selectedFiles,
                (progress) => setUploadProgress(progress)
            );

            const updatedImages = [...selectedGallery.images, ...uploadedImages];
            setGalleries(prev => prev.map(g =>
                g.id === selectedGallery.id
                    ? { ...g, images: updatedImages }
                    : g
            ));

            setSelectedGallery(prev => prev && prev.id === selectedGallery.id
                ? { ...prev, images: updatedImages }
                : prev);
            setSelectedFiles([]);
            setUploadProgress(0);
            showNotification(`${uploadedImages.length} gambar berhasil diupload`);
        } catch (error) {
            console.error('Error uploading images:', error);
            showNotification('Gagal mengupload gambar');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleImageLoad = (imageId: string, event: React.SyntheticEvent<HTMLImageElement>) => {
        const img = event.currentTarget;
        if (!img.naturalWidth || !img.naturalHeight) return;

        const ratio = img.naturalWidth / img.naturalHeight;
        setImageRatios(prev => ({
            ...prev,
            [imageId]: ratio
        }));
    };

    const handleDeleteGalleryImage = async (galleryId: string, imageId: string) => {
        if (!confirm('Yakin ingin menghapus gambar ini?')) return;

        try {
            setIsSubmitting(true);
            await deleteGalleryImage(galleryId, imageId);

            setGalleries(prev => prev.map(g =>
                g.id === galleryId
                    ? { ...g, images: g.images.filter(img => img.id !== imageId) }
                    : g
            ));

            setSelectedGallery(prev =>
                prev && prev.id === galleryId
                    ? { ...prev, images: prev.images.filter(img => img.id !== imageId) }
                    : prev
            );

            showNotification('Gambar berhasil dihapus');
        } catch (error) {
            console.error('Error deleting gallery image:', error);
            showNotification('Gagal menghapus gambar');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMoveGalleryImage = async (galleryId: string, imageId: string, direction: 'up' | 'down') => {
        if (!selectedGallery) return;

        const currentIndex = selectedGallery.images.findIndex(img => img.id === imageId);
        if (currentIndex < 0) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= selectedGallery.images.length) return;

        try {
            setIsSubmitting(true);
            await reorderGalleryImages(galleryId, currentIndex, targetIndex);

            const nextImages = [...selectedGallery.images];
            const [moved] = nextImages.splice(currentIndex, 1);
            nextImages.splice(targetIndex, 0, moved);

            setGalleries(prev => prev.map(g =>
                g.id === galleryId ? { ...g, images: nextImages } : g
            ));

            setSelectedGallery(prev =>
                prev && prev.id === galleryId ? { ...prev, images: nextImages } : prev
            );

            showNotification('Urutan foto berhasil diubah');
        } catch (error) {
            console.error('Error reordering gallery image:', error);
            showNotification('Gagal mengubah urutan foto');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUploadCoverImage = async (e: React.ChangeEvent<HTMLInputElement>, galleryId: string) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        try {
            setIsSubmitting(true);
            const coverUrl = await uploadCoverImage(galleryId, file);
            
            setGalleries(prev => prev.map(g =>
                g.id === galleryId
                    ? { ...g, cover_image_url: coverUrl }
                    : g
            ));
            
            showNotification('Cover image berhasil diupload');
        } catch (error) {
            console.error('Error uploading cover image:', error);
            showNotification('Gagal mengupload cover image');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePdfFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
            showNotification('File PDF saja yang dapat diupload');
            return;
        }

        setSelectedPdfFile(file);
        const defaultName = file.name.replace(/\.pdf$/i, '').trim() || 'Pricelist PDF';
        setPdfDisplayName(prev => prev && prev.trim() ? prev : defaultName);
    };

    const handleUploadPdf = async () => {
        if (!selectedGallery || !selectedPdfFile) return;

        const finalPdfName = (pdfDisplayName || selectedGallery.title || 'Pricelist PDF').trim() || 'Pricelist PDF';

        try {
            setIsSubmitting(true);
            const result = await uploadGalleryPdf(selectedGallery.id, selectedPdfFile, finalPdfName);

                const updatedGallery = { ...selectedGallery, pdf_url: result.pdf_url, pdf_name: result.pdf_name };
                setGalleries(prev => prev.map(g =>
                g.id === selectedGallery.id
                    ? updatedGallery
                    : g
            ));

                setSelectedGallery(prev => prev && prev.id === selectedGallery.id ? updatedGallery : prev);
            setPdfDisplayName(result.pdf_name);
            setSelectedPdfFile(null);
            showNotification('PDF Pricelist berhasil diupload');
        } catch (error) {
            console.error('Error uploading gallery PDF:', error);
            showNotification('Gagal mengupload PDF Pricelist');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteGallery = async (galleryId: string) => {
        if (!confirm('Yakin ingin menghapus Pricelist ini? Semua gambar akan ikut terhapus.')) return;

        try {
            await deleteGallery(galleryId);
            setGalleries(prev => prev.filter(g => g.id !== galleryId));
            showNotification('Pricelist berhasil dihapus');
        } catch (error) {
            console.error('Error deleting gallery:', error);
            showNotification('Gagal menghapus Pricelist');
        }
    };

    const copyPublicLink = async (gallery: Gallery) => {
        const routeId = getGalleryPublicRouteId(gallery, galleries);
        const link = `${window.location.origin}/#/gallery/${routeId}`;

        try {
            await navigator.clipboard.writeText(link);
            showNotification('Link publik berhasil disalin');
        } catch (error) {
            console.error('Error copying gallery link:', error);
            showNotification('Link publik gagal disalin. Buka halaman publik untuk menyalin URL.');
        }
    };

    const openUploadModal = (gallery: Gallery) => {
        openEditModal(gallery);
    };

    const openEditModal = (gallery: Gallery) => {
        setSelectedGallery(gallery);
        setEditImageFiles([]);
        setSelectedFiles([]);
        setSelectedPdfFile(null);
        setPdfDisplayName(gallery.pdf_name || 'Pricelist PDF');
        setUploadProgress(0);
        setIsAllPhotosOpen(false);
        setEditGallery({
            title: gallery.title,
            region: gallery.region,
            description: gallery.description || '',
            is_public: gallery.is_public,
            booking_link: gallery.booking_link || ''
        });
        setIsEditModalOpen(true);
    };

    const handleBookingLinkSelect = (regionValue: string) => {
        if (!regionValue) {
            setEditGallery(prev => ({ ...prev, booking_link: '' }));
            return;
        }
        const path = window.location.pathname.replace(/index\.html$/, '');
        const bookingUrl = `${window.location.origin}${path}#/public-booking?region=${regionValue}`;
        setEditGallery(prev => ({ ...prev, booking_link: bookingUrl }));
    };

    const getSelectedRegionValue = (bookingLink: string): string => {
        if (!bookingLink) return '';
        const path = window.location.pathname.replace(/index\.html$/, '');
        const baseUrl = `${window.location.origin}${path}#/public-booking?region=`;
        if (bookingLink.startsWith(baseUrl)) {
            return bookingLink.replace(baseUrl, '');
        }
        return '';
    };

    const handleNewBookingLinkSelect = (regionValue: string) => {
        if (!regionValue) {
            setNewGallery(prev => ({ ...prev, booking_link: '' }));
            return;
        }
        const path = window.location.pathname.replace(/index\.html$/, '');
        const bookingUrl = `${window.location.origin}${path}#/public-booking?region=${regionValue}`;
        setNewGallery(prev => ({ ...prev, booking_link: bookingUrl }));
    };

    const handleEditGallery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGallery || !editGallery.title.trim() || !editGallery.region.trim()) {
            showNotification('Judul dan daerah harus diisi');
            return;
        }

        const filesToUpload = editImageFiles;
        let updatedGallery: Gallery | null = null;
        let uploadedCount = 0;
        try {
            setIsSubmitting(true);
            const updated = await updateGallery(selectedGallery.id, {
                title: editGallery.title.trim(),
                region: editGallery.region.trim(),
                description: editGallery.description.trim(),
                is_public: editGallery.is_public,
                booking_link: editGallery.booking_link?.trim() || null
            });

            updatedGallery = { ...selectedGallery, ...updated, images: selectedGallery.images };
            if (filesToUpload.length > 0) {
                setIsUploadingDraftImages(true);
                setDraftImageUploadProgress(0);
                const uploadedImages = await uploadGalleryImages(
                    selectedGallery.id,
                    filesToUpload,
                    setDraftImageUploadProgress
                );
                uploadedCount = uploadedImages.length;
                setDraftImageUploadProgress(100);
                updatedGallery = { ...updatedGallery, images: [...updatedGallery.images, ...uploadedImages] };
            }

            setGalleries(prev => prev.map(g =>
                g.id === selectedGallery.id ? updatedGallery! : g
            ));
            setIsEditModalOpen(false);
            setEditImageFiles([]);
            showNotification(filesToUpload.length > 0
                ? uploadedCount === filesToUpload.length
                    ? `Pricelist berhasil diupdate dengan ${uploadedCount} foto`
                    : `Pricelist diupdate, ${uploadedCount} dari ${filesToUpload.length} foto berhasil diunggah`
                : 'Pricelist berhasil diupdate');
        } catch (error) {
            console.error('Error updating gallery:', error);
            if (updatedGallery) {
                setGalleries(prev => prev.map(g => g.id === updatedGallery!.id ? updatedGallery! : g));
                setIsEditModalOpen(false);
                setEditImageFiles([]);
                showNotification('Pricelist tersimpan, tetapi foto gagal diunggah. Anda dapat menambahkannya nanti.');
            } else {
                showNotification('Gagal mengupdate Pricelist');
            }
        } finally {
            setIsSubmitting(false);
            setIsUploadingDraftImages(false);
            setDraftImageUploadProgress(0);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 lg:space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-brand-surface/60 backdrop-blur-xl p-5 md:p-6 rounded-2xl border border-brand-border/50 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-gradient">Pricelist Upload</h2>
                    <p className="text-sm text-brand-text-secondary mt-1">Kelola Pricelist hasil Acara Pernikahan pengantin berdasarkan daerah.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="button-primary whitespace-nowrap"
                >
                    <PlusIcon className="w-5 h-5 flex-shrink-0" />
                    Buat Pricelist Baru
                </button>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {galleries.map(gallery => (
                    <div key={gallery.id} className="glass-card card-hover-lift rounded-2xl flex flex-col overflow-hidden border border-brand-border/50 shadow-sm group">
                        {/* Gallery Cover */}
                        <div className="h-44 bg-brand-bg relative overflow-hidden group-hover:shadow-inner transition-shadow">
                            {gallery.cover_image_url ? (
                                <img
                                    src={gallery.cover_image_url}
                                    alt={gallery.title}
                                    loading="lazy"
                                    width="400"
                                    height="300"
                                    className="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-105"
                                />
                            ) : gallery.images.length > 0 ? (
                                <img
                                    src={gallery.images[0].url}
                                    alt={gallery.title}
                                    loading="lazy"
                                    width="400"
                                    height="300"
                                    className="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-105"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-brand-text-secondary/40 bg-brand-input/50">
                                    <CameraIcon className="w-12 h-12 mb-2 opacity-50" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Tanpa Cover</span>
                                </div>
                            )}
                            
                            {/* Hover Actions for Cover */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                <label className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors">
                                    Ganti Cover
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={(e) => handleUploadCoverImage(e, gallery.id)}
                                    />
                                </label>
                            </div>

                            <div className="absolute top-3 right-3 flex gap-1.5 flex-wrap justify-end">
                                <span className="bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-xs font-medium border border-white/10 shadow-sm">
                                    {gallery.images.length} foto
                                </span>
                                {gallery.pdf_url && (
                                    <span className="bg-amber-500/90 text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm">
                                        PDF
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Gallery Info */}
                        <div className="p-5 flex-grow flex flex-col bg-brand-surface/40">
                            <div className="flex items-start justify-between mb-3 gap-2">
                                <h3 className="font-bold text-base md:text-lg text-brand-text-light line-clamp-2 leading-tight flex-grow">{gallery.title}</h3>
                                {gallery.is_public && (
                                    <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-full mt-0.5">
                                        Publik
                                    </span>
                                )}
                            </div>

                            <p className="text-xs font-medium text-brand-accent mb-3 flex items-center gap-1.5 bg-brand-accent/5 self-start px-2.5 py-1 rounded-full border border-brand-accent/10">
                                <MapPinIcon className="w-3.5 h-3.5" />
                                {gallery.region}
                            </p>

                            {gallery.description && (
                                <p className="text-xs text-brand-text-secondary mb-4 line-clamp-2 flex items-start gap-1.5">
                                    <FileTextIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-60" />
                                    <span className="leading-relaxed">{gallery.description}</span>
                                </p>
                            )}

                            {/* Action Buttons */}
                            <div className="mt-auto flex items-center gap-2 pt-4 border-t border-brand-border/50">
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(gallery)}
                                        className="button-secondary !w-9 !h-9 !p-0 text-brand-text-secondary hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50"
                                        title="Edit Pricelist"
                                        aria-label="Edit Pricelist"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    {gallery.is_public && (
                                        <>
                                            <a
                                                href={`/#/gallery/${getGalleryPublicRouteId(gallery, galleries)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="button-secondary !w-9 !h-9 !p-0 text-brand-text-secondary hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50"
                                                title="Buka Halaman Publik"
                                                aria-label="Buka Halaman Publik"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => copyPublicLink(gallery)}
                                                className="button-secondary !w-9 !h-9 !p-0 text-brand-text-secondary hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50"
                                                title="Salin Link Publik"
                                                aria-label="Salin Link Publik"
                                            >
                                                <LinkIcon className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteGallery(gallery.id)}
                                        className="button-secondary !w-9 !h-9 !p-0 text-brand-text-secondary hover:text-red-600 hover:border-red-300 hover:bg-red-50"
                                        title="Hapus Pricelist"
                                        aria-label="Hapus Pricelist"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {galleries.length === 0 && (
                <div className="text-center py-16 bg-brand-surface/40 backdrop-blur-md rounded-3xl border border-brand-border/50 border-dashed">
                    <div className="text-brand-text-secondary/30 mb-5 relative inline-block">
                        <div className="absolute inset-0 bg-brand-accent/20 blur-xl rounded-full"></div>
                        <CameraIcon className="w-20 h-20 mx-auto relative z-10" />
                    </div>
                    <h3 className="text-xl font-bold text-brand-text-light mb-2">Belum Ada Pricelist</h3>
                    <p className="text-brand-text-secondary mb-6 max-w-sm mx-auto">Mulai unggah foto portofolio / event Anda dan kelola berdasarkan wilayah pemasaran dengan mudah.</p>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="button-primary"
                    >
                        <PlusIcon className="w-5 h-5 flex-shrink-0" />
                        Buat Pricelist Baru
                    </button>
                </div>
            )}

            {/* Create Gallery Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    if (!isSubmitting) {
                        setCreateImageFiles([]);
                        setIsCreateModalOpen(false);
                    }
                }}
                title="Buat Pricelist Baru"
            >
                <form onSubmit={handleCreateGallery} className="space-y-5 p-1">
                    <div className="input-group">
                        <input
                            type="text"
                            id="newTitle"
                            value={newGallery.title}
                            onChange={(e) => setNewGallery(prev => ({ ...prev, title: e.target.value }))}
                            className="input-field"
                            placeholder=" "
                            required
                        />
                        <label htmlFor="newTitle" className="input-label">Judul Pricelist</label>
                    </div>

                    <div className="input-group">
                        <input
                            type="text"
                            id="newRegion"
                            value={newGallery.region}
                            onChange={(e) => setNewGallery(prev => ({ ...prev, region: e.target.value }))}
                            className="input-field"
                            placeholder=" "
                            required
                        />
                        <label htmlFor="newRegion" className="input-label">Daerah/Tempat (cth: Jakarta)</label>
                    </div>

                    <div className="input-group">
                        <textarea
                            id="newDesc"
                            value={newGallery.description}
                            onChange={(e) => setNewGallery(prev => ({ ...prev, description: e.target.value }))}
                            className="input-field"
                            rows={3}
                            placeholder=" "
                        />
                        <label htmlFor="newDesc" className="input-label">Deskripsi Opsional</label>
                    </div>

                    <div className="input-group">
                        <label htmlFor="newLinkSelect" className="input-label">Tautan Booking & Paket per Wilayah</label>
                        <select
                            id="newLinkSelect"
                            value={getSelectedRegionValue(newGallery.booking_link)}
                            onChange={(e) => handleNewBookingLinkSelect(e.target.value)}
                            className="input-field"
                        >
                            {BOOKING_LINKS_BY_REGION.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-brand-text-secondary mt-1 pl-1">Pilih wilayah untuk otomatis mengisi tautan booking di bawah.</p>
                    </div>

                    <div className="input-group">
                        <input
                            type="url"
                            id="newLink"
                            value={newGallery.booking_link}
                            onChange={(e) => setNewGallery(prev => ({ ...prev, booking_link: e.target.value }))}
                            className="input-field"
                            placeholder=" "
                        />
                        <label htmlFor="newLink" className="input-label">Tautan Booking (opsional)</label>
                        <p className="text-[10px] text-brand-text-secondary mt-1 pl-1">Jika diisi, tombol Booking di halaman Pricelist akan dialihkan ke tautan ini.</p>
                    </div>

                    <div className="flex items-center p-3 rounded-xl border border-brand-border/50 bg-brand-bg/50">
                        <input
                            type="checkbox"
                            id="is_public"
                            checked={newGallery.is_public}
                            onChange={(e) => setNewGallery(prev => ({ ...prev, is_public: e.target.checked }))}
                            className="h-4 w-4 rounded border-brand-border text-brand-accent focus:ring-brand-accent focus:ring-offset-brand-surface"
                        />
                        <label htmlFor="is_public" className="ml-3 text-sm font-medium text-brand-text-light cursor-pointer select-none">
                            Buat Pricelist publik (dapat diakses pengantin)
                        </label>
                    </div>

                    <GalleryDraftImagePicker
                        inputId="new-gallery-images"
                        files={createImageFiles}
                        onFilesSelected={handleCreateDraftFiles}
                        onRemoveFile={index => setCreateImageFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}
                        disabled={isSubmitting}
                        isUploading={isUploadingDraftImages}
                        progress={draftImageUploadProgress}
                    />

                    <div className="flex gap-3 pt-6 border-t border-brand-border/50 sticky bottom-0 bg-brand-surface">
                        <button
                            type="button"
                            onClick={() => {
                                setCreateImageFiles([]);
                                setIsCreateModalOpen(false);
                            }}
                            disabled={isSubmitting}
                            className="flex-1 button-secondary"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 button-primary"
                        >
                            {isUploadingDraftImages ? `Mengunggah foto ${draftImageUploadProgress}%` : isSubmitting ? 'Menyimpan...' : 'Buat Pricelist'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Edit Gallery Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => {
                    if (!isSubmitting) {
                        setEditImageFiles([]);
                        setIsEditModalOpen(false);
                    }
                }}
                title="Edit Pricelist"
            >
                <form onSubmit={handleEditGallery} className="space-y-5 p-1">
                    <div className="input-group">
                        <input
                            type="text"
                            id="editTitle"
                            value={editGallery.title}
                            onChange={(e) => setEditGallery(prev => ({ ...prev, title: e.target.value }))}
                            className="input-field"
                            placeholder=" "
                            required
                        />
                        <label htmlFor="editTitle" className="input-label">Judul Pricelist</label>
                    </div>

                    <div className="input-group">
                        <input
                            type="text"
                            id="editRegion"
                            value={editGallery.region}
                            onChange={(e) => setEditGallery(prev => ({ ...prev, region: e.target.value }))}
                            className="input-field"
                            placeholder=" "
                            required
                        />
                        <label htmlFor="editRegion" className="input-label">Daerah/Tempat</label>
                    </div>

                    <div className="input-group">
                        <textarea
                            id="editDesc"
                            value={editGallery.description}
                            onChange={(e) => setEditGallery(prev => ({ ...prev, description: e.target.value }))}
                            className="input-field"
                            rows={3}
                            placeholder=" "
                        />
                        <label htmlFor="editDesc" className="input-label">Deskripsi Opsional</label>
                    </div>

                    <div className="input-group">
                        <label htmlFor="editLinkSelect" className="input-label">Tautan Booking & Paket per Wilayah</label>
                        <select
                            id="editLinkSelect"
                            value={getSelectedRegionValue(editGallery.booking_link)}
                            onChange={(e) => handleBookingLinkSelect(e.target.value)}
                            className="input-field"
                        >
                            {BOOKING_LINKS_BY_REGION.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-brand-text-secondary mt-1 pl-1">Pilih wilayah untuk otomatis mengisi tautan booking di bawah.</p>
                    </div>

                    <div className="input-group">
                        <input
                            type="url"
                            id="editLink"
                            value={editGallery.booking_link}
                            onChange={(e) => setEditGallery(prev => ({ ...prev, booking_link: e.target.value }))}
                            className="input-field"
                            placeholder=" "
                        />
                        <label htmlFor="editLink" className="input-label">Tautan Booking (opsional)</label>
                        <p className="text-[10px] text-brand-text-secondary mt-1 pl-1">Kosongkan untuk memakai tautan booking default berdasarkan wilayah.</p>
                    </div>

                    <div className="flex items-center p-3 rounded-xl border border-brand-border/50 bg-brand-bg/50">
                        <input
                            type="checkbox"
                            id="edit_is_public"
                            checked={editGallery.is_public}
                            onChange={(e) => setEditGallery(prev => ({ ...prev, is_public: e.target.checked }))}
                            className="h-4 w-4 rounded border-brand-border text-brand-accent focus:ring-brand-accent focus:ring-offset-brand-surface"
                        />
                        <label htmlFor="edit_is_public" className="ml-3 text-sm font-medium text-brand-text-light cursor-pointer select-none">
                            Buat Pricelist publik (dapat diakses pengantin)
                        </label>
                    </div>

                    <GalleryDraftImagePicker
                        inputId="edit-gallery-images"
                        files={editImageFiles}
                        onFilesSelected={handleEditDraftFiles}
                        onRemoveFile={index => setEditImageFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}
                        disabled={isSubmitting}
                        isUploading={isUploadingDraftImages}
                        progress={draftImageUploadProgress}
                    />

                    {selectedGallery && (
                        <div className="space-y-4">
                            <section className="space-y-3 rounded-2xl border border-brand-border/50 bg-brand-bg/30 p-3 sm:p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h4 className="text-sm font-semibold text-brand-text-light">Foto Saat Ini</h4>
                                    <span className="text-xs text-brand-text-secondary">{selectedGallery.images.length} foto</span>
                                </div>

                                {selectedGallery.images.length > 0 ? (
                                    <>
                                        <div className="vendor-gallery-scroll grid max-h-[45vh] grid-cols-3 gap-2 overflow-y-auto p-1 sm:grid-cols-4">
                                            {(isAllPhotosOpen ? selectedGallery.images : selectedGallery.images.slice(0, 6)).map((image, index) => {
                                                const ratio = imageRatios[image.id] || 1;
                                                const actualIndex = selectedGallery.images.findIndex(item => item.id === image.id);
                                                return (
                                                    <div key={image.id || index} className="group relative">
                                                        <img
                                                            src={image.url}
                                                            alt={`${selectedGallery.title} ${actualIndex + 1}`}
                                                            onLoad={event => handleImageLoad(image.id, event)}
                                                            className="h-auto w-full rounded-xl border border-brand-border/50 bg-brand-surface object-contain"
                                                            style={{ aspectRatio: `${ratio}` }}
                                                        />
                                                        <div className="absolute bottom-2 right-2 flex gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveGalleryImage(selectedGallery.id, image.id, 'up')}
                                                                disabled={actualIndex === 0 || isSubmitting}
                                                                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white/90 text-xs font-bold text-brand-text-primary shadow-sm disabled:opacity-40"
                                                                aria-label={`Geser foto ${actualIndex + 1} ke atas`}
                                                            >
                                                                ↑
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveGalleryImage(selectedGallery.id, image.id, 'down')}
                                                                disabled={actualIndex === selectedGallery.images.length - 1 || isSubmitting}
                                                                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white/90 text-xs font-bold text-brand-text-primary shadow-sm disabled:opacity-40"
                                                                aria-label={`Geser foto ${actualIndex + 1} ke bawah`}
                                                            >
                                                                ↓
                                                            </button>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteGalleryImage(selectedGallery.id, image.id)}
                                                            disabled={isSubmitting}
                                                            className="absolute -right-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white text-sm font-bold text-red-600 shadow-md disabled:opacity-50"
                                                            title="Hapus gambar"
                                                            aria-label={`Hapus foto ${actualIndex + 1}`}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {selectedGallery.images.length > 6 && (
                                            <button
                                                type="button"
                                                onClick={() => setIsAllPhotosOpen(open => !open)}
                                                className="w-full rounded-xl border border-brand-accent/25 bg-brand-accent/5 px-3 py-2 text-sm font-semibold text-brand-accent"
                                            >
                                                {isAllPhotosOpen ? 'Tutup Semua Foto' : `Lihat Semua Foto (${selectedGallery.images.length})`}
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-brand-border/60 bg-brand-surface px-3 py-4 text-center text-xs text-brand-text-secondary">
                                        Belum ada foto pada pricelist ini.
                                    </div>
                                )}
                            </section>

                            <section className="space-y-3 rounded-2xl border border-brand-border/50 bg-brand-surface/80 p-3 sm:p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h4 className="text-sm font-semibold text-brand-text-light">PDF Pricelist</h4>
                                        <p className="mt-0.5 text-xs text-brand-text-secondary">Lampiran PDF untuk halaman publik.</p>
                                    </div>
                                    {selectedGallery.pdf_url && (
                                        <a href={selectedGallery.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand-accent underline underline-offset-2">
                                            Lihat PDF
                                        </a>
                                    )}
                                </div>
                                <label htmlFor="edit-pdf-display-name" className="block text-xs font-medium text-brand-text-secondary">
                                    Nama PDF di Halaman Publik
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="edit-pdf-display-name"
                                        type="text"
                                        value={pdfDisplayName}
                                        onChange={event => setPdfDisplayName(event.target.value)}
                                        className="input-field min-w-0 flex-1"
                                        placeholder="Nama PDF"
                                    />
                                    <input id="edit-pdf-upload" type="file" accept=".pdf,application/pdf" onChange={handlePdfFileSelect} className="hidden" />
                                    <label htmlFor="edit-pdf-upload" className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs font-semibold text-brand-text-light hover:border-brand-accent">
                                        {selectedPdfFile ? 'Ganti PDF' : 'Pilih PDF'}
                                    </label>
                                </div>
                                {selectedPdfFile && (
                                    <div className="flex items-center justify-between gap-3 text-xs text-brand-text-secondary">
                                        <span className="truncate">{selectedPdfFile.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedPdfFile(null);
                                                setPdfDisplayName(selectedGallery.pdf_name || 'Pricelist PDF');
                                            }}
                                            className="shrink-0 text-brand-danger hover:underline"
                                        >
                                            Hapus pilihan
                                        </button>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleUploadPdf}
                                    disabled={!selectedPdfFile || isSubmitting}
                                    className="button-primary w-full !py-2.5 !text-sm font-semibold"
                                >
                                    {isSubmitting && selectedPdfFile ? 'Mengunggah PDF...' : 'Upload PDF'}
                                </button>
                            </section>
                            <p className="text-xs text-brand-text-secondary">Maksimal 10 MB per gambar. Format: JPG, PNG, WebP.</p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-6 border-t border-brand-border/50 sticky bottom-0 bg-brand-surface">
                        <button
                            type="button"
                            onClick={() => {
                                setEditImageFiles([]);
                                setIsEditModalOpen(false);
                            }}
                            disabled={isSubmitting}
                            className="flex-1 button-secondary"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 button-primary"
                        >
                            {isUploadingDraftImages ? `Mengunggah foto ${draftImageUploadProgress}%` : isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Upload Images Modal */}
            <Modal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                title={selectedGallery ? `Edit Pricelist - ${selectedGallery.title}` : 'Edit Pricelist'}
            >
                <div className="space-y-5 p-1">
                    <div className="rounded-2xl border border-brand-border/50 bg-brand-bg/40 p-3.5 sm:p-4 space-y-3">
                        {selectedGallery && (
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between gap-3">
                                    <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-text-secondary/80">Foto Saat Ini</h4>
                                    <span className="text-[10px] font-medium text-brand-text-secondary">{selectedGallery.images.length} foto</span>
                                </div>

                                {selectedGallery.images.length > 0 ? (
                                    <>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(isAllPhotosOpen ? selectedGallery.images : selectedGallery.images.slice(0, 6)).map((image, index) => {
                                                const ratio = imageRatios[image.id] || 1;
                                                const isPortrait = ratio < 1;
                                                const actualIndex = selectedGallery.images.findIndex(img => img.id === image.id);

                                                return (
                                                    <div key={image.id || index} className="relative group">
                                                        <img
                                                            src={image.url}
                                                            alt={`${selectedGallery.title} ${actualIndex + 1}`}
                                                            onLoad={(event) => handleImageLoad(image.id, event)}
                                                            className={`w-full rounded-xl border border-brand-border/50 bg-brand-surface ${isPortrait ? 'h-auto object-contain' : 'h-auto object-cover'}`}
                                                            style={{ aspectRatio: `${ratio}` }}
                                                        />

                                                        <div className="absolute bottom-2 right-2 flex gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveGalleryImage(selectedGallery.id, image.id, 'up')}
                                                                disabled={actualIndex === 0 || isSubmitting}
                                                                className="flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-white/90 text-[10px] font-bold text-brand-text-primary shadow-sm transition hover:bg-brand-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
                                                                title="Geser ke atas"
                                                                aria-label="Geser ke atas"
                                                            >
                                                                ↑
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveGalleryImage(selectedGallery.id, image.id, 'down')}
                                                                disabled={actualIndex === selectedGallery.images.length - 1 || isSubmitting}
                                                                className="flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-white/90 text-[10px] font-bold text-brand-text-primary shadow-sm transition hover:bg-brand-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
                                                                title="Geser ke bawah"
                                                                aria-label="Geser ke bawah"
                                                            >
                                                                ↓
                                                            </button>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteGalleryImage(selectedGallery.id, image.id)}
                                                            className="delete-image-button absolute -top-2 -right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white text-[10px] font-bold text-red-600 shadow-md transition hover:scale-105 hover:bg-red-50"
                                                            title="Hapus gambar"
                                                            aria-label="Hapus gambar"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {selectedGallery.images.length > 6 && (
                                            <button
                                                type="button"
                                                onClick={() => setIsAllPhotosOpen(prev => !prev)}
                                                className="w-full rounded-xl border border-brand-accent/25 bg-brand-accent/5 px-3 py-2 text-sm font-semibold text-brand-accent transition hover:border-brand-accent hover:bg-brand-accent/10"
                                            >
                                                {isAllPhotosOpen ? 'Tutup Semua Foto' : `Lihat Semua Foto (${selectedGallery.images.length})`}
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-brand-border/60 bg-brand-surface px-3 py-3 text-xs text-brand-text-secondary">
                                        Belum ada foto pada pricelist ini.
                                    </div>
                                )}

                                <div className="pt-1 space-y-2.5">
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label
                                        htmlFor="file-upload"
                                        className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-brand-accent/30 bg-gradient-to-r from-brand-accent/10 to-brand-accent/20 px-3 py-2.5 text-sm font-semibold text-brand-accent shadow-sm transition-all hover:border-brand-accent hover:shadow-md hover:scale-[1.01]"
                                    >
                                        Pilih Foto Baru
                                    </label>

                                    {selectedFiles.length > 0 && (
                                        <div className="bg-brand-surface border border-brand-border/50 rounded-xl p-4">
                                            <div className="flex justify-between items-center mb-3">
                                                <h5 className="text-sm font-semibold text-brand-text-light flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent text-[10px]">{selectedFiles.length}</span>
                                                    File Siap Upload
                                                </h5>
                                                <button onClick={() => setSelectedFiles([])} className="text-xs text-brand-danger hover:underline font-medium">Reset</button>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                                {selectedFiles.map((file, index) => (
                                                    <div key={index} className="flex justify-between items-center p-2 rounded-lg bg-brand-bg text-xs">
                                                        <span className="truncate flex-grow text-brand-text-primary pr-3 font-medium">{file.name}</span>
                                                        <span className="flex-shrink-0 text-brand-text-secondary">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleUploadImages}
                                        disabled={selectedFiles.length === 0 || isSubmitting}
                                        className="button-primary w-full !py-2.5 !text-sm font-semibold"
                                    >
                                        {isSubmitting ? 'Mengupload...' : 'Upload Gambar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-brand-border/50 bg-brand-surface/80 p-3.5 sm:p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h4 className="text-sm font-semibold text-brand-text-light">PDF Pricelist</h4>
                                <p className="text-[10px] sm:text-[11px] text-brand-text-secondary mt-0.5 leading-relaxed">
                                    Lampiran PDF untuk pengunjung di halaman publik.
                                </p>
                            </div>
                            {selectedGallery?.pdf_url && (
                                <a
                                    href={selectedGallery.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] sm:text-[11px] font-medium text-brand-accent underline underline-offset-2 whitespace-nowrap"
                                >
                                    Lihat PDF
                                </a>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="pdf-display-name" className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-text-secondary/80">
                                Nama PDF di Halaman Publik
                            </label>

                            <div className="flex items-center gap-2 rounded-xl border border-brand-border/60 bg-brand-bg/40 px-2 py-2 min-h-[42px]">
                                <input
                                    id="pdf-display-name"
                                    type="text"
                                    value={pdfDisplayName}
                                    onChange={(e) => setPdfDisplayName(e.target.value)}
                                    className="w-full bg-transparent text-sm text-brand-text-primary outline-none placeholder:text-brand-text-secondary/60"
                                    placeholder="Masukkan nama PDF custom"
                                />

                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={handlePdfFileSelect}
                                    className="hidden"
                                    id="pdf-upload"
                                />

                                <label
                                    htmlFor="pdf-upload"
                                    className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-[11px] font-semibold text-brand-text-light hover:border-brand-accent hover:text-brand-accent transition-colors whitespace-nowrap"
                                >
                                    {selectedPdfFile ? 'Ganti PDF' : 'Pilih PDF'}
                                </label>

                                {selectedPdfFile && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedPdfFile(null);
                                            setPdfDisplayName(selectedGallery?.pdf_name || 'Pricelist PDF');
                                        }}
                                        className="text-[10px] font-medium text-brand-danger hover:opacity-80 whitespace-nowrap"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleUploadPdf}
                            disabled={!selectedPdfFile || isSubmitting}
                            className="button-primary w-full !py-2.5 !text-sm font-semibold"
                        >
                            {isSubmitting ? 'Mengupload PDF...' : 'Upload PDF'}
                        </button>
                    </div>

                    <div className="rounded-2xl border border-brand-border/50 bg-brand-bg/20 p-2.5 sm:p-3">
                        <p className="text-[10px] sm:text-[11px] text-brand-text-secondary leading-relaxed">
                            Maksimal 10MB per file. Format: JPG, PNG, WebP.
                        </p>
                    </div>

                    {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="bg-brand-surface rounded-xl p-4 border border-brand-border/50">
                            <div className="flex justify-between text-sm mb-2 font-medium">
                                <span className="text-brand-text-light flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full border-2 border-brand-accent border-t-transparent animate-spin"></div>
                                    Mengupload...
                                </span>
                                <span className="text-brand-accent">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-brand-input rounded-full h-2.5 overflow-hidden">
                                <div
                                    className="bg-brand-accent h-full rounded-full transition-all duration-300 relative"
                                    style={{ width: `${uploadProgress}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-brand-border/50 sticky bottom-0 bg-brand-surface">
                        <button
                            type="button"
                            onClick={() => setIsUploadModalOpen(false)}
                            className="flex-1 button-secondary"
                        >
                            Batal
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default GalleryUpload;