import React, { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, ImagePlus, Link as LinkIcon, Plus, Save, Trash2 } from 'lucide-react';
import { BioLink, BioLinkPage } from '../../types';
import { DEFAULT_BIO_LINK_PAGE, getBioLinkPage, saveBioLinkPage } from '../../services/bioLinks';
import { uploadVendorImage } from '../../services/vendorProfile';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#c5b39c] focus:ring-2 focus:ring-[#c5b39c]/20';

const BioLinksPage: React.FC = () => {
  const [page, setPage] = useState<BioLinkPage | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_BIO_LINK_PAGE });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getBioLinkPage().then((data) => {
      if (data) {
        setPage(data);
        const usedLinkIds = new Set<string>();
        setForm({
          slug: data.slug,
          title: data.title,
          subtitle: data.subtitle,
          whatsapp_number: data.whatsapp_number,
          whatsapp_label: data.whatsapp_label || 'WhatsApp',
          avatar_url: data.avatar_url,
          cover_url: data.cover_url,
          links: (data.links || []).map((link) => {
            const id = link.id && !usedLinkIds.has(link.id) ? link.id : crypto.randomUUID();
            usedLinkIds.add(id);
            return { ...link, id };
          }),
          is_published: data.is_published,
        });
      }
    }).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'Gagal memuat halaman link.');
    }).finally(() => setLoading(false));
  }, []);

  const publicUrl = useMemo(() => {
    const slug = form.slug.trim().toLowerCase();
    return `${window.location.origin}/#/link/${slug || 'link-bisnis'}`;
  }, [form.slug]);

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleImageUpload = async (kind: 'avatar' | 'cover', file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('File harus berupa gambar.');
      return;
    }
    setUploading(kind);
    setMessage('');
    try {
      const url = await uploadVendorImage(file, `bio-links/${kind}`);
      updateForm(kind === 'avatar' ? 'avatar_url' : 'cover_url', url);
    } catch (error) {
      console.error('[BioLinksPage] Image upload failed:', error);
      setMessage('Gagal mengunggah gambar. Silakan coba lagi.');
    } finally {
      setUploading(null);
    }
  };

  const handleLinkChange = (id: string, key: 'title' | 'url', value: string) => {
    updateForm('links', form.links.map((link) => link.id === id ? { ...link, [key]: value } : link));
  };

  const addLink = () => {
    const link: BioLink = { id: crypto.randomUUID(), title: '', url: '' };
    updateForm('links', [...form.links, link]);
  };

  const removeLink = (id: string) => {
    updateForm('links', form.links.filter((link) => link.id !== id));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    const slug = form.slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setMessage('Nama link hanya boleh berisi huruf kecil, angka, dan tanda hubung.');
      return;
    }
    const invalidLink = form.links.find((link) => {
      if (!link.title.trim() && !link.url.trim()) return false;
      try {
        const url = new URL(link.url);
        return !link.title.trim() || !['http:', 'https:'].includes(url.protocol);
      } catch {
        return true;
      }
    });
    if (invalidLink) {
      setMessage('Setiap tautan harus memiliki judul dan URL yang valid (http:// atau https://).');
      return;
    }

    setSaving(true);
    try {
      const saved = await saveBioLinkPage({
        ...form,
        slug,
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        whatsapp_number: form.whatsapp_number.replace(/\D/g, ''),
        links: form.links.filter((link) => link.title.trim() && link.url.trim()),
      });
      setPage(saved);
      setMessage('Halaman link berhasil disimpan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan halaman link.');
    } finally {
      setSaving(false);
    }
  };

  const copyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setMessage('Link publik berhasil disalin.');
    } catch (error) {
      console.error('[BioLinksPage] Clipboard write failed:', error);
      setMessage('Tidak dapat menyalin link. Silakan salin URL secara manual.');
    }
  };

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">Memuat pengaturan link publik...</div>;
  }

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a08b73]">Halaman publik</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Kelola Link Publik</h1>
          <p className="mt-1 text-sm text-slate-500">Atur profil, WhatsApp, foto, dan semua tautan yang dibagikan.</p>
        </div>
        <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8f7b65] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#77644f] disabled:cursor-not-allowed disabled:opacity-60">
          <Save size={17} />{saving ? 'Menyimpan...' : 'Simpan perubahan'}
        </button>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-[#f2eee8] p-2.5 text-[#8f7b65]"><LinkIcon size={19} /></div>
          <div><h2 className="font-semibold text-slate-900">Link yang bisa dibagikan</h2><p className="text-sm text-slate-500">Buka halaman publik atau salin alamatnya.</p></div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input aria-label="URL publik" readOnly value={publicUrl} className={`${inputClass} bg-slate-50`} />
          <button type="button" onClick={copyPublicUrl} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Copy size={16} /> Salin link</button>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink size={16} /> Lihat halaman</a>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-semibold text-slate-900">Profil dan tampilan</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500">Foto sampul dan foto profil mengikuti contoh halaman publik.</p>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Foto sampul</span>
            <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
              {form.cover_url ? <img src={form.cover_url} alt="Sampul halaman" className="h-full w-full object-cover" /> : <div className="text-center text-slate-400"><ImagePlus className="mx-auto mb-2" /><span className="text-sm">Pilih foto sampul</span></div>}
              <input type="file" accept="image/*" aria-label="Unggah foto sampul" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => handleImageUpload('cover', event.target.files?.[0])} />
              {uploading === 'cover' && <span className="absolute bottom-2 rounded-lg bg-white/90 px-3 py-1 text-xs font-medium">Mengunggah...</span>}
            </div>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Foto profil / logo</span>
            <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
              {form.avatar_url ? <img src={form.avatar_url} alt="Foto profil" className="h-32 w-32 rounded-full object-cover" /> : <div className="text-center text-slate-400"><ImagePlus className="mx-auto mb-2" /><span className="text-sm">Pilih foto profil</span></div>}
              <input type="file" accept="image/*" aria-label="Unggah foto profil" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => handleImageUpload('avatar', event.target.files?.[0])} />
              {uploading === 'avatar' && <span className="absolute bottom-2 rounded-lg bg-white/90 px-3 py-1 text-xs font-medium">Mengunggah...</span>}
            </div>
          </label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Nama / judul</span><input className={inputClass} value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="Contoh: Imagenic" required /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Deskripsi singkat</span><input className={inputClass} value={form.subtitle} onChange={(e) => updateForm('subtitle', e.target.value)} placeholder="Contoh: Photography & Videography" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Nama link publik</span><div className="flex items-center rounded-xl border border-slate-200 focus-within:border-[#c5b39c]"><span className="pl-3 text-sm text-slate-400">#/link/</span><input className="min-w-0 flex-1 rounded-r-xl bg-transparent px-2 py-2.5 text-sm outline-none" value={form.slug} onChange={(e) => updateForm('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="nama-bisnis" required /></div></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Nomor WhatsApp</span><input className={inputClass} type="tel" value={form.whatsapp_number} onChange={(e) => updateForm('whatsapp_number', e.target.value)} placeholder="Contoh: 6281234567890" /><span className="mt-1 block text-xs text-slate-400">Masukkan kode negara, misalnya 62. Halaman akan membuat tombol WhatsApp.</span></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Nama tombol WhatsApp</span><input className={inputClass} value={form.whatsapp_label} onChange={(e) => updateForm('whatsapp_label', e.target.value)} placeholder="Contoh: WhatsApp (Harun)" /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold text-slate-900">Tautan langsung</h2><p className="mt-1 text-sm text-slate-500">Tambahkan website, pricelist, media sosial, atau URL lainnya.</p></div>
          <button type="button" onClick={addLink} className="inline-flex items-center gap-2 rounded-xl border border-[#c5b39c] px-4 py-2 text-sm font-semibold text-[#77644f] hover:bg-[#f7f4f0]"><Plus size={16} /> Tambah tautan</button>
        </div>
        <div className="space-y-3">
          {form.links.map((link, index) => (
            <div key={link.id} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center">
              <label><span className="mb-1 block text-xs font-medium text-slate-500">Nama tombol {index + 1}</span><input className={inputClass} value={link.title} onChange={(e) => handleLinkChange(link.id, 'title', e.target.value)} placeholder="Contoh: Pricelist" /></label>
              <label><span className="mb-1 block text-xs font-medium text-slate-500">URL tujuan</span><input className={inputClass} type="url" value={link.url} onChange={(e) => handleLinkChange(link.id, 'url', e.target.value)} placeholder="https://..." /></label>
              <button type="button" aria-label={`Hapus tautan ${index + 1}`} onClick={() => removeLink(link.id)} className="justify-self-end rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={17} /></button>
            </div>
          ))}
          {form.links.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">Belum ada tautan. Tekan “Tambah tautan” untuk mulai.</div>}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-semibold text-slate-900">Status halaman</h2><p className="mt-1 text-sm text-slate-500">Nonaktifkan jika halaman publik belum ingin ditampilkan.</p></div>
        <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700"><input type="checkbox" className="h-4 w-4 accent-[#8f7b65]" checked={form.is_published} onChange={(e) => updateForm('is_published', e.target.checked)} /> Halaman aktif / dipublikasikan</label>
      </section>

      {(message || page) && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.startsWith('Gagal') || message.startsWith('Tidak dapat') || message.startsWith('Setiap') || message.startsWith('Nama link') ? 'bg-red-50 text-red-700' : 'bg-[#f2eee8] text-[#77644f]'}`}>{message || 'Perubahan terakhir tersimpan.'}</p>}
      <div className="flex justify-end pb-6">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#8f7b65] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#77644f] disabled:opacity-60"><Save size={17} />{saving ? 'Menyimpan...' : 'Simpan perubahan'}</button>
      </div>
    </form>
  );
};

export default BioLinksPage;
