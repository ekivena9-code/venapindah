import React, { useEffect, useState } from 'react';
import { Copy, Link2, RefreshCw, Unlink } from 'lucide-react';
import Modal from '../../../shared/ui/Modal';
import {
  createGoogleCalendarFeed,
  getGoogleCalendarFeedStatus,
  revokeGoogleCalendarFeed,
} from '../../../services/googleCalendarFeed';

interface GoogleCalendarFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GoogleCalendarFeedModal: React.FC<GoogleCalendarFeedModalProps> = ({ isOpen, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;
    setIsLoading(true);
    setError('');
    setMessage('');
    getGoogleCalendarFeedStatus()
      .then(result => {
        if (isCurrent) setIsActive(Boolean(result.active));
      })
      .catch(reason => {
        if (isCurrent) setError(reason instanceof Error ? reason.message : 'Gagal memeriksa status feed.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => { isCurrent = false; };
  }, [isOpen]);

  const handleCreate = async () => {
    if (isActive && !window.confirm('Tautan lama akan berhenti berfungsi. Anda perlu menggantinya di Google Calendar. Lanjutkan?')) return;
    setIsBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await createGoogleCalendarFeed();
      setIsActive(Boolean(result.active));
      setFeedUrl(result.url || '');
      setMessage('Tautan feed berhasil dibuat. Salin lalu tambahkan melalui Google Calendar > Kalender lainnya > Dari URL.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Gagal membuat tautan feed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setMessage('Tautan feed berhasil disalin.');
      setError('');
    } catch {
      setError('Tidak dapat menyalin otomatis. Pilih dan salin tautan secara manual.');
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm('Matikan feed ini? Kalender Google yang berlangganan akan berhenti diperbarui.')) return;
    setIsBusy(true);
    setError('');
    setMessage('');
    try {
      await revokeGoogleCalendarFeed();
      setIsActive(false);
      setFeedUrl('');
      setMessage('Feed berhasil dimatikan.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Gagal mematikan feed.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sinkron Google Calendar" size="lg">
      <div className="space-y-4 text-sm">
        <p className="text-brand-text-secondary">
          Langganan ini mengirim acara proyek, agenda internal, dan deadline dari aplikasi ke Google Calendar.
          Google memperbarui kalender secara berkala, jadi perubahan tidak selalu langsung terlihat.
        </p>

        <ol className="list-decimal space-y-1 pl-5 text-brand-text-primary">
          <li>Buat tautan feed di bawah.</li>
          <li>Di Google Calendar, pilih <strong>Kalender lainnya</strong> lalu <strong>Dari URL</strong>.</li>
          <li>Tempel tautan feed. Perubahan di Google Calendar tidak disinkronkan kembali ke aplikasi.</li>
        </ol>

        {isLoading && <p role="status" className="text-brand-text-secondary">Memeriksa status feed...</p>}
        {!isLoading && isActive && !feedUrl && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
            Feed aktif. Tautan rahasia tidak disimpan di browser. Jika tautannya hilang, buat tautan baru dan ganti langganan di Google Calendar.
          </p>
        )}

        {feedUrl && (
          <div className="flex items-stretch gap-2">
            <input
              aria-label="URL langganan Google Calendar"
              readOnly
              value={feedUrl}
              className="input-field min-w-0 flex-1 text-xs"
              onFocus={event => event.currentTarget.select()}
            />
            <button type="button" onClick={handleCopy} className="button-secondary inline-flex shrink-0 items-center gap-1.5" aria-label="Salin tautan feed">
              <Copy className="h-4 w-4" /> Salin
            </button>
          </div>
        )}

        <p className="flex items-start gap-2 rounded-lg bg-brand-bg p-3 text-xs text-brand-text-secondary">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
          Siapa pun yang memiliki tautan rahasia ini dapat melihat data acara. Jangan bagikan tautan secara publik.
        </p>

        {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col-reverse gap-2 border-t border-brand-border/50 pt-4 sm:flex-row sm:justify-between">
          {isActive ? (
            <button type="button" disabled={isBusy || isLoading} onClick={handleRevoke} className="button-secondary inline-flex items-center justify-center gap-2 text-red-600 disabled:opacity-50">
              <Unlink className="h-4 w-4" /> Matikan Feed
            </button>
          ) : <span />}
          <button type="button" disabled={isBusy || isLoading} onClick={handleCreate} className="button-primary inline-flex items-center justify-center gap-2 disabled:opacity-50">
            <RefreshCw className="h-4 w-4" />
            {isBusy ? 'Memproses...' : isActive ? 'Buat Ulang Tautan' : 'Buat Tautan Feed'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default GoogleCalendarFeedModal;