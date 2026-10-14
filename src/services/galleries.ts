import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { compressImage } from './storage';
import { Gallery, GalleryImage } from '../types';
import { toGalleryPublicSlug, toPublicNameSlug } from '../utils/publicRouting';

const LOCAL_STORAGE_GALLERIES_KEY = 'weddfin-galleries';

function getStoredGalleries(): Gallery[] {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_GALLERIES_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch {}
    return [];
}

function saveStoredGalleries(galleries: Gallery[]) {
    try {
        localStorage.setItem(LOCAL_STORAGE_GALLERIES_KEY, JSON.stringify(galleries));
    } catch {}
}

export const createGallery = async (galleryData: Omit<Gallery, 'id' | 'public_id' | 'created_at' | 'updated_at'>): Promise<Gallery> => {
    // Generate a public_id from title slug + random suffix
    const slug = (galleryData.title || 'gallery')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    const random = Math.random().toString(36).substring(2, 7);
    const publicId = slug ? `${slug}-${random}` : random;

    // Ensure user_id is always set (fallback to admin user ID if missing)
    const userId = galleryData.user_id || '11111111-1111-1111-1111-111111111111';

    const payload = { ...galleryData, user_id: userId, public_id: publicId };
    console.log('[Gallery] Creating gallery with payload:', payload);

    if (isSupabaseConfigured) {
        try {
            const { data, error } = await supabase
                .from('galleries')
                .insert([payload])
                .select()
                .single();

            if (!error && data) {
                const current = getStoredGalleries();
                saveStoredGalleries([data, ...current.filter(g => g.id !== data.id)]);
                return data;
            }
        } catch (err) {
            console.warn('[Gallery] Remote create failed, saving locally:', err);
        }
    }

    const localGallery: Gallery = {
        ...payload,
        id: 'gal-' + Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    const current = getStoredGalleries();
    saveStoredGalleries([localGallery, ...current]);
    return localGallery;
};

export const listGalleries = async (): Promise<Gallery[]> => {
    if (isSupabaseConfigured !== false) {
        try {
            const { data, error } = await supabase
                .from('galleries')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) {
                saveStoredGalleries(data);
                return data;
            }
            if (error) {
                console.warn('[galleries] Remote galleries fetch failed, using stored fallback:', error.message || error);
            }
        } catch (err) {
            console.warn('[galleries] Exception fetching galleries from Supabase:', err);
        }
    }

    return getStoredGalleries();
};

export const getGallery = async (id: string): Promise<Gallery | null> => {
    if (isSupabaseConfigured !== false) {
        try {
            const { data, error } = await supabase
                .from('galleries')
                .select('*')
                .eq('id', id)
                .single();

            if (!error && data) {
                return data;
            }
        } catch (err) {
            console.warn('[galleries] Remote getGallery error:', err);
        }
    }

    const all = getStoredGalleries();
    return all.find(g => g.id === id) || null;
};

export const getPublicGallery = async (publicId: string): Promise<Gallery | null> => {
    if (!publicId) return null;

    if (!isSupabaseConfigured) {
        const stored = getStoredGalleries();
        return stored.find(g =>
            g.public_id === publicId ||
            g.id === publicId ||
            (g.is_public && toGalleryPublicSlug(g.title, g.region) === publicId)
        ) || null;
    }

    let data: Gallery | null = null;
    let error: any = null;

    try {
        const res = await supabase
            .from('galleries')
            .select('*')
            .eq('public_id', publicId)
            .maybeSingle();
        data = res.data;
        error = res.error;

        if (!error && data) return data;
    } catch (err) {
        error = err;
    }

    if (error || !data) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicId)) {
            const { data: byId } = await supabase
                .from('galleries')
                .select('*')
                .eq('id', publicId)
                .maybeSingle();
            if (byId) return byId;
        }

        const slug = toPublicNameSlug(publicId).toLowerCase();
        if (!slug || slug !== publicId.toLowerCase()) return null;

        const { data: candidates } = await supabase
            .from('galleries')
            .select('*')
            .eq('is_public', true)
            .ilike('public_id', `${slug}-%`)
            .limit(20);

        const matches = (candidates || []).filter(gallery =>
            new RegExp(`^${slug}-[a-z0-9]{5}$`, 'i').test(gallery.public_id)
        );
        if (matches.length === 1) return matches[0];

        const { data: publicGalleries } = await supabase
            .from('galleries')
            .select('id, title, region, public_id')
            .eq('is_public', true);

        const regionMatches = (publicGalleries || []).filter(gallery =>
            toGalleryPublicSlug(gallery.title, gallery.region) === slug
        );
        if (regionMatches.length !== 1) return null;

        const { data: galleryByPublicId } = await supabase
            .from('galleries')
            .select('*')
            .eq('public_id', regionMatches[0].public_id)
            .maybeSingle();
        return galleryByPublicId || null;
    }

    return data;
};

export const updateGallery = async (id: string, updates: Partial<Gallery>): Promise<Gallery> => {
    const { data, error } = await supabase
        .from('galleries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating gallery:', error);
        throw new Error('Gagal mengupdate Pricelist');
    }

    return data;
};

export const deleteGallery = async (id: string): Promise<void> => {
    // First, delete all images from storage
    const gallery = await getGallery(id);
    if (gallery) {
        const storagePaths: string[] = [];

        if (Array.isArray(gallery.images) && gallery.images.length > 0) {
            const imagePaths = gallery.images.map(img => {
                try {
                    const url = new URL(img.url);
                    return url.pathname.split('/').pop() || '';
                } catch {
                    return '';
                }
            }).filter(Boolean);

            storagePaths.push(...imagePaths);
        }

        if (gallery.pdf_url) {
            try {
                const pdfUrl = new URL(gallery.pdf_url);
                const pdfPath = pdfUrl.pathname.split('/').pop() || '';
                if (pdfPath) {
                    storagePaths.push(pdfPath);
                }
            } catch {
                // Ignore invalid URL
            }
        }

        if (storagePaths.length > 0) {
            await supabase.storage
                .from('gallery-images')
                .remove(storagePaths);
        }
    }

    // Then delete the gallery record
    const { error } = await supabase
        .from('galleries')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting gallery:', error);
        throw new Error('Gagal menghapus Pricelist');
    }
};


export const uploadGalleryImages = async (
    galleryId: string,
    files: File[],
    onProgress?: (progress: number) => void
): Promise<GalleryImage[]> => {
    const uploadedImages: GalleryImage[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const processedFile = await compressImage(file, 1600, 0.8, 200 * 1024);
        const fileExt = processedFile.name.split('.').pop() || 'jpg';
        const fileName = `${galleryId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('gallery-images')
            .upload(fileName, processedFile, {
                cacheControl: '31536000'
            });

        if (uploadError) {
            console.error('Error uploading image:', uploadError);
            continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('gallery-images')
            .getPublicUrl(fileName);

        const newImage: GalleryImage = {
            id: crypto.randomUUID(),
            url: urlData.publicUrl,
            uploadedAt: new Date().toISOString()
        };

        uploadedImages.push(newImage);

        // Update progress
        if (onProgress) {
            onProgress(Math.round(((i + 1) / files.length) * 100));
        }
    }

    // Update gallery with new images
    if (uploadedImages.length > 0) {
        const gallery = await getGallery(galleryId);
        if (gallery) {
            const updatedImages = [...gallery.images, ...uploadedImages];
            await updateGallery(galleryId, { images: updatedImages });
        }
    }

    return uploadedImages;
};

export const uploadGalleryPdf = async (
    galleryId: string,
    file: File,
    displayName?: string
): Promise<{ pdf_url: string; pdf_name: string }> => {
    const fileExt = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'pdf';
    const fileName = `${galleryId}/pricelist-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('gallery-images')
        .upload(fileName, file, {
            contentType: 'application/pdf',
            upsert: true
        });

    if (uploadError) {
        console.error('Error uploading gallery PDF:', uploadError);
        throw new Error('Gagal mengupload PDF Pricelist');
    }

    const { data: urlData } = supabase.storage
        .from('gallery-images')
        .getPublicUrl(fileName);

    const finalDisplayName = (displayName || file.name || 'Pricelist PDF').trim() || 'Pricelist PDF';
    const pdfUrl = urlData.publicUrl;
    await updateGallery(galleryId, { pdf_url: pdfUrl, pdf_name: finalDisplayName });

    return {
        pdf_url: pdfUrl,
        pdf_name: finalDisplayName
    };
};

export const deleteGalleryImage = async (galleryId: string, imageId: string): Promise<void> => {
    const gallery = await getGallery(galleryId);
    if (!gallery) {
        throw new Error('Pricelist tidak ditemukan');
    }

    const galleryImages = Array.isArray(gallery.images) ? gallery.images.filter(Boolean) : [];
    const imageToDelete = galleryImages.find(img => String(img.id) === String(imageId));

    if (!imageToDelete) {
        console.warn('[Gallery] Image not found in current gallery payload, skipping stale delete.', {
            galleryId,
            imageId,
            imageCount: galleryImages.length,
        });
        return;
    }

    // Delete from storage
    let imagePath: string | undefined;
    try {
        const url = new URL(imageToDelete.url);
        imagePath = url.pathname.split('/').pop() || undefined;
    } catch {
        const fallbackPath = (imageToDelete.url || '').split('/').pop();
        imagePath = fallbackPath || undefined;
    }

    if (imagePath) {
        await supabase.storage
            .from('gallery-images')
            .remove([imagePath]);
    }

    // Update gallery images
    const updatedImages = galleryImages.filter(img => String(img.id) !== String(imageId));
    await updateGallery(galleryId, { images: updatedImages });
};

export const reorderGalleryImages = async (
    galleryId: string,
    currentIndex: number,
    targetIndex: number
): Promise<void> => {
    const gallery = await getGallery(galleryId);
    if (!gallery) {
        throw new Error('Pricelist tidak ditemukan');
    }

    if (currentIndex === targetIndex || currentIndex < 0 || targetIndex < 0) {
        return;
    }

    const reorderedImages = [...gallery.images];
    const [imageToMove] = reorderedImages.splice(currentIndex, 1);
    reorderedImages.splice(targetIndex, 0, imageToMove);

    await updateGallery(galleryId, { images: reorderedImages });
};

export const getGalleriesByRegion = async (region: string): Promise<Gallery[]> => {
    const { data, error } = await supabase
        .from('galleries')
        .select('*')
        .eq('region', region)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching galleries by region:', error);
        throw new Error('Gagal memuat Pricelist');
    }

    return data || [];
};

export const uploadCoverImage = async (galleryId: string, file: File): Promise<string> => {
    const processedFile = await compressImage(file, 1600, 0.8, 200 * 1024);
    const fileExt = processedFile.name.split('.').pop();
    const fileName = `${galleryId}/cover-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
        .from('gallery-images')
        .upload(fileName, processedFile);

    if (uploadError) {
        console.error('Error uploading cover image:', uploadError);
        throw new Error('Gagal mengupload cover image');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('gallery-images')
        .getPublicUrl(fileName);
        
    const coverUrl = urlData.publicUrl;

    // Update gallery with new cover image URL
    await updateGallery(galleryId, { cover_image_url: coverUrl });

    return coverUrl;
};