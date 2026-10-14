import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { BioLinkPage } from '../types';

const LOCAL_STORAGE_KEY = 'weddfin-bio-link-page';

type BioLinkPageInput = Omit<BioLinkPage, 'id' | 'updated_at'>;

export const DEFAULT_BIO_LINK_PAGE: BioLinkPageInput = {
  slug: 'link-bisnis',
  title: 'Vena Pictures',
  subtitle: 'Wedding & Prewedding Photography Portfolio',
  whatsapp_number: '6281234567890',
  whatsapp_label: 'Konsultasi via WhatsApp',
  avatar_url: '/assets/images/logos/logoIcon.svg',
  cover_url: '/assets/images/backgrounds/detail-acara-pernikahan.jpg',
  links: [
    { id: 'pricelist', title: 'Pricelist & Paket Foto', url: '#/public-packages' },
    { id: 'booking', title: 'Formulir Booking Pernikahan', url: '#/public-booking' },
    { id: 'vendor-profile', title: 'Profil & Portofolio Vendor', url: '#/profile' },
  ],
  is_published: true,
};

export async function getBioLinkPage(slug?: string): Promise<BioLinkPage | null> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('bio_link_pages').select('*');
      query = slug ? query.eq('slug', slug) : query.eq('is_primary', true);

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        } catch {}
        return data as BioLinkPage;
      }
    } catch (err) {
      console.warn('[bioLinks] Supabase link fetch failed, falling back to local:', err);
    }
  }

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && (!slug || parsed.slug === slug)) {
        return parsed as BioLinkPage;
      }
    }
  } catch {}

  return {
    id: 'default-bio-link',
    ...DEFAULT_BIO_LINK_PAGE,
    slug: slug || DEFAULT_BIO_LINK_PAGE.slug,
    is_primary: true,
    updated_at: new Date().toISOString(),
  } as BioLinkPage;
}

export async function saveBioLinkPage(
  input: BioLinkPageInput,
): Promise<BioLinkPage> {
  const localPage: BioLinkPage = {
    ...input,
    id: 'bio-link-' + Date.now(),
    is_primary: true,
    updated_at: new Date().toISOString(),
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localPage));
  } catch {}

  if (!isSupabaseConfigured) {
    return localPage;
  }

  try {
    const { data: existing } = await supabase
      .from('bio_link_pages')
      .select('id')
      .eq('is_primary', true)
      .maybeSingle();

    const result = existing
      ? await supabase.from('bio_link_pages').update(input).eq('id', existing.id).select().single()
      : await supabase.from('bio_link_pages').insert(input).select().single();

    if (result.data) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(result.data));
      return result.data as BioLinkPage;
    }
  } catch (err) {
    console.warn('[bioLinks] Remote save failed, preserved locally:', err);
  }

  return localPage;
}
