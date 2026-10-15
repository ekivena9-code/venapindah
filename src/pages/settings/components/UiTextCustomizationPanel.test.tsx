import fs from 'node:fs';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UiTextCustomizationPanel from './UiTextCustomizationPanel';
import { customizeNavigationLabel, customizeUiText, readUiTextOverrides } from '../../../utils/uiTextCustomization';
import { MOBILE_UI_SCALE_STORAGE_KEY } from '../../../utils/mobileUiScale';

const mobileScaleMocks = vi.hoisted(() => ({
    loadRemoteMobileUiScale: vi.fn(),
    saveRemoteMobileUiScale: vi.fn(),
}));

vi.mock('../../../lib/supabaseClient', () => ({ isSupabaseConfigured: true }));

vi.mock('../../../services/uiTextOverrides', () => ({
    loadUiTextOverrides: vi.fn().mockResolvedValue(undefined),
    saveRemoteUiTextOverrides: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/mobileUiScale', () => ({
    loadRemoteMobileUiScale: mobileScaleMocks.loadRemoteMobileUiScale,
    MOBILE_UI_SCALE_SYNC_EVENT: 'venapindah-mobile-ui-scale-sync',
    saveRemoteMobileUiScale: mobileScaleMocks.saveRemoteMobileUiScale,
}));

describe('UiTextCustomizationPanel', () => {
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.style.removeProperty('--mobile-ui-scale');
        mobileScaleMocks.loadRemoteMobileUiScale.mockReset().mockResolvedValue(undefined);
        mobileScaleMocks.saveRemoteMobileUiScale.mockReset().mockImplementation(async (scale: number) => scale);
    });

    it('stages a group reset and applies it only when that group is saved', async () => {
        render(<UiTextCustomizationPanel />);

        fireEvent.change(screen.getByLabelText('Data Pengantin'), { target: { value: 'Pelanggan' } });
        fireEvent.click(screen.getByRole('button', { name: 'Simpan 1 perubahan' }));

        await waitFor(() => expect(customizeNavigationLabel('Data Pengantin', readUiTextOverrides())).toBe('Pelanggan'));

        const menuGroup = screen.getByLabelText('Data Pengantin').closest('details') as HTMLElement;
        fireEvent.click(within(menuGroup).getByRole('button', { name: 'Reset grup' }));

        expect(customizeNavigationLabel('Data Pengantin', readUiTextOverrides())).toBe('Pelanggan');

        fireEvent.click(within(menuGroup).getByRole('button', { name: 'Simpan 1 perubahan' }));

        await waitFor(() => expect(customizeNavigationLabel('Data Pengantin', readUiTextOverrides())).toBe('Data Pengantin'));
    });

    it('applies an independently customized label inside a detail page', async () => {
        render(<UiTextCustomizationPanel />);

        fireEvent.click(screen.getByText('Detail Pengantin'));
        fireEvent.change(screen.getByLabelText('Judul detail pengantin'), { target: { value: 'Detail Klien' } });
        fireEvent.click(screen.getByRole('button', { name: 'Simpan 1 perubahan' }));

        await waitFor(() => expect(customizeUiText('client.detail.title', 'Detail Pengantin', readUiTextOverrides())).toBe('Detail Klien'));
    });

    it('customizes a package form label independently from navigation labels', async () => {
        render(<UiTextCustomizationPanel />);

        fireEvent.click(screen.getByText('Detail Paket'));
        fireEvent.change(screen.getByLabelText('Field nama paket'), { target: { value: 'Nama Layanan' } });
        fireEvent.click(screen.getByRole('button', { name: 'Simpan 1 perubahan' }));

        await waitFor(() => {
            const overrides = readUiTextOverrides();
            expect(customizeUiText('packages.form.field.name', 'Nama Paket', overrides)).toBe('Nama Layanan');
            expect(customizeNavigationLabel('Paket & Layanan', overrides)).toBe('Paket & Layanan');
        });
    });

    it('filters the list to matching package labels', () => {
        render(<UiTextCustomizationPanel />);

        fireEvent.change(screen.getByLabelText('Cari label atau teks asli'), { target: { value: 'nama paket' } });

        expect(screen.getByLabelText('Field nama paket')).not.toBeNull();
        expect(screen.queryByLabelText('Data Pengantin')).toBeNull();
    });

    it('saves the mobile text scale to Supabase only after the user clicks save', async () => {
        render(<UiTextCustomizationPanel />);
        let finishRemoteSave: ((scale: number) => void) | undefined;
        mobileScaleMocks.saveRemoteMobileUiScale.mockImplementationOnce(scale => new Promise(resolve => {
            finishRemoteSave = resolve;
        }));

        fireEvent.change(screen.getByRole('slider', { name: 'Ukuran teks dan tampilan mobile' }), {
            target: { value: '1.25' },
        });

        expect(window.localStorage.getItem(MOBILE_UI_SCALE_STORAGE_KEY)).toBeNull();
        expect(document.documentElement.style.getPropertyValue('--mobile-ui-scale')).toBe('1.25');
        expect(screen.getByText('125%')).not.toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Simpan skala mobile' }));

        expect(window.localStorage.getItem(MOBILE_UI_SCALE_STORAGE_KEY)).toBeNull();
        expect(screen.getByText('Menyimpan...')).not.toBeNull();
        finishRemoteSave?.(1.25);
        await waitFor(() => expect(mobileScaleMocks.saveRemoteMobileUiScale).toHaveBeenCalledWith(1.25));
        expect(window.localStorage.getItem(MOBILE_UI_SCALE_STORAGE_KEY)).toBe('1.25');
        expect(screen.getByText('Preferensi disimpan ke akun Supabase ini.')).not.toBeNull();
    });

    it('resets the applied scale immediately and persists the default only after save', async () => {
        window.localStorage.setItem(MOBILE_UI_SCALE_STORAGE_KEY, '1.25');
        const { unmount } = render(<UiTextCustomizationPanel />);

        fireEvent.click(screen.getByRole('button', { name: 'Reset 100%' }));

        expect(document.documentElement.style.getPropertyValue('--mobile-ui-scale')).toBe('1');
        expect(screen.getByText('100%')).not.toBeNull();
        expect(window.localStorage.getItem(MOBILE_UI_SCALE_STORAGE_KEY)).toBe('1.25');

        fireEvent.click(screen.getByRole('button', { name: 'Simpan skala mobile' }));

        await waitFor(() => expect(mobileScaleMocks.saveRemoteMobileUiScale).toHaveBeenCalledWith(1));
        expect(window.localStorage.getItem(MOBILE_UI_SCALE_STORAGE_KEY)).toBe('1');
        unmount();

        mobileScaleMocks.loadRemoteMobileUiScale.mockResolvedValueOnce(1);
        render(<UiTextCustomizationPanel />);
        await waitFor(() => {
            expect(screen.getByText('100%')).not.toBeNull();
            expect(document.documentElement.style.getPropertyValue('--mobile-ui-scale')).toBe('1');
        });
    });

    it('reports remote persistence errors without marking the preference as saved', async () => {
        mobileScaleMocks.saveRemoteMobileUiScale.mockRejectedValueOnce(new Error('Kolom belum tersedia.'));
        render(<UiTextCustomizationPanel />);

        fireEvent.change(screen.getByRole('slider', { name: 'Ukuran teks dan tampilan mobile' }), {
            target: { value: '1.25' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Simpan skala mobile' }));

        expect((await screen.findByRole('alert')).textContent).toContain('Kolom belum tersedia.');
        expect((screen.getByRole('button', { name: 'Simpan skala mobile' }) as HTMLButtonElement).disabled).toBe(false);
        expect(window.localStorage.getItem(MOBILE_UI_SCALE_STORAGE_KEY)).toBeNull();
    });

    it('applies the user-controlled mobile scale in the app stylesheet', () => {
        const css = fs.readFileSync(`${process.cwd()}/app/index.css`, 'utf8');
        const scaleAnchor = css.indexOf('html { font-size: 16px !important;');
        const scaleStart = css.lastIndexOf('@media (max-width: 768px)', scaleAnchor);
        const mobileOverrides = css.slice(scaleStart);

        expect(mobileOverrides).toContain('main[data-mobile-ui-scale-excluded="true"]');
        expect(mobileOverrides).toContain('#invoice');
        expect(mobileOverrides).toContain('.invoice-document-mobile');
        expect(mobileOverrides).toContain('.text-xs { font-size: calc(12px * var(--mobile-ui-scale, 1)) !important;');
        expect(mobileOverrides).toContain('button[class*="text-"]');
        expect(mobileOverrides).toContain('main button[class*="text-"]');
        expect(mobileOverrides).toContain('min-height: max(44px, calc(40px * var(--mobile-ui-scale, 1))) !important;');
        expect(mobileOverrides).toContain('font-size: calc(14px * var(--mobile-ui-scale, 1)) !important;');
        expect(mobileOverrides).toContain('table td p,');
        expect(mobileOverrides).toContain('.input-group input.input-field:not([type="checkbox"])');
        expect(mobileOverrides).toContain('label.input-label,');
        expect(mobileOverrides).toContain('.stat-card-value,');
        expect(mobileOverrides).toContain('button[class*="text-"]');
        expect(mobileOverrides).toContain('button svg,');
        expect(mobileOverrides).toContain('width: calc(16px * var(--mobile-ui-scale, 1)) !important;');
        expect(mobileOverrides).not.toContain('width: max(16px, calc(16px * var(--mobile-ui-scale, 1))) !important;');
        expect(mobileOverrides).toContain('button[class*="text-"]:has(svg)');
        expect(mobileOverrides).toContain(':not([class*="flex-col"]):not(.dashboard-action-card):not(.finance-add-pocket-card)');
        const iconButtonRuleStart = mobileOverrides.indexOf('button[class*="text-"]:has(svg)');
        const iconButtonRuleEnd = mobileOverrides.indexOf('}', iconButtonRuleStart);
        expect(mobileOverrides.slice(iconButtonRuleStart, iconButtonRuleEnd)).not.toContain('white-space: nowrap !important;');
        expect(mobileOverrides).toContain('[class~="sm:text-2xl"].font-extrabold.tabular-nums');
        expect(mobileOverrides).toContain('[class~="min-h-[90px]"][class~="sm:min-h-0"]');
        expect(mobileOverrides).toContain('font-size: min(calc(16px * var(--mobile-ui-scale, 1)), 17px) !important;');
        expect(mobileOverrides).toContain('[class~="grid-cols-2"][class~="lg:grid-cols-4"] > div[class~="flex"]');
        expect(mobileOverrides).toContain('width: max-content !important;');
        expect(mobileOverrides).toContain('font-size: min(calc(14px * var(--mobile-ui-scale, 1)), 16px) !important;');
        expect(mobileOverrides).toContain('font-size: min(calc(11px * var(--mobile-ui-scale, 1)), 12px) !important;');
        expect(mobileOverrides).toContain('button[class*="w-11"][class*="h-6"]');
        expect(mobileOverrides).toContain('width: calc(44px * var(--mobile-ui-scale, 1)) !important;');
        expect(mobileOverrides).toContain('min-height: max(44px, calc(40px * var(--mobile-ui-scale, 1))) !important;');
        expect(mobileOverrides).toContain('width: calc(16px * var(--mobile-ui-scale, 1)) !important;');
        expect(mobileOverrides).not.toContain('width: max(16px, calc(16px * var(--mobile-ui-scale, 1))) !important;');
        expect(mobileOverrides).toContain('a[class*="flex"]');
        expect(mobileOverrides).toContain('nav[aria-label="breadcrumb"] a');
        expect(mobileOverrides).toContain('button[class*="w-11"][class*="h-6"]::after');
        expect(mobileOverrides).toContain('button > span:not([class*="text-"])');
        expect(mobileOverrides).toContain('[role="dialog"] .grid.grid-cols-2 > div p.text-2xl.font-bold');
        expect(mobileOverrides).toContain('font-size: calc(9px * var(--mobile-ui-scale, 1)) !important;');
        expect(mobileOverrides).not.toContain('font-size: max(9px, calc(9px * var(--mobile-ui-scale, 1))) !important;');
        expect(mobileOverrides).toContain('.dashboard-action-card > div:last-child p:first-child');
        expect(mobileOverrides).toContain('p.text-xs.font-semibold.truncate');
            expect(mobileOverrides).toContain('textarea.input-field,');
            expect(mobileOverrides).toContain('#modal-title:empty');
        expect(mobileOverrides).toContain('html { font-size: 16px !important; }');
        expect(mobileOverrides).not.toContain('calc(0.75rem * var(--mobile-ui-scale, 1))');
        expect(css).toContain('font-size: calc(0.62rem * var(--mobile-ui-scale, 1)) !important;');
        expect(css).toContain('font-size: calc(0.58rem * var(--mobile-ui-scale, 1)) !important;');
    });

    it('keeps the invoice list in the mobile scale scope', () => {
        const app = fs.readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8');

        expect(app).not.toContain('data-mobile-ui-scale-excluded={routing.activeView === ViewType.INVOICES');
    });

    it('keeps labels above inputs instead of floating inside the field box', () => {
        const css = fs.readFileSync(`${process.cwd()}/app/index.css`, 'utf8');

        expect(css).toContain('.input-group {');
        expect(css).toContain('.input-group > .input-label');
        expect(css).toContain('position: static !important');
    });

    it('saves only the selected group and preserves drafts in other groups', async () => {
        render(<UiTextCustomizationPanel />);

        fireEvent.change(screen.getByLabelText('Data Pengantin'), { target: { value: 'Pelanggan' } });
        fireEvent.click(screen.getByText('Detail Paket'));
        fireEvent.change(screen.getByLabelText('Field nama paket'), { target: { value: 'Nama Layanan' } });

        const menuGroup = screen.getByLabelText('Data Pengantin').closest('details') as HTMLElement;
        fireEvent.click(within(menuGroup).getByRole('button', { name: 'Simpan 1 perubahan' }));

        await waitFor(() => {
            const overrides = readUiTextOverrides();
            expect(customizeNavigationLabel('Data Pengantin', overrides)).toBe('Pelanggan');
            expect(customizeUiText('packages.form.field.name', 'Nama Paket', overrides)).toBe('Nama Paket');
        });
        expect((screen.getByLabelText('Field nama paket') as HTMLInputElement).value).toBe('Nama Layanan');

        const packageGroup = screen.getByLabelText('Field nama paket').closest('details') as HTMLElement;
        fireEvent.click(within(packageGroup).getByRole('button', { name: 'Simpan 1 perubahan' }));

        await waitFor(() => {
            expect(customizeUiText('packages.form.field.name', 'Nama Paket', readUiTextOverrides())).toBe('Nama Layanan');
        });
    });

    it('syncs remote mobile scale when panel mounts', async () => {
        mobileScaleMocks.loadRemoteMobileUiScale.mockResolvedValueOnce(0.8);
        render(<UiTextCustomizationPanel />);

        await waitFor(() => {
            expect(screen.getByText('80%')).not.toBeNull();
            expect(window.localStorage.getItem(MOBILE_UI_SCALE_STORAGE_KEY)).toBe('0.8');
            expect(document.documentElement.style.getPropertyValue('--mobile-ui-scale')).toBe('0.8');
        });
    });

    it('loads the saved remote scale again after the settings panel is reopened', async () => {
        const { unmount } = render(<UiTextCustomizationPanel />);
        fireEvent.change(screen.getByRole('slider', { name: 'Ukuran teks dan tampilan mobile' }), {
            target: { value: '1.25' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Simpan skala mobile' }));

        await waitFor(() => expect(screen.getByText('Preferensi disimpan ke akun Supabase ini.')).not.toBeNull());
        expect(window.localStorage.getItem(MOBILE_UI_SCALE_STORAGE_KEY)).toBe('1.25');
        unmount();

        mobileScaleMocks.loadRemoteMobileUiScale.mockResolvedValueOnce(1.25);
        render(<UiTextCustomizationPanel />);
        await waitFor(() => {
            expect(screen.getByText('125%')).not.toBeNull();
            expect(document.documentElement.style.getPropertyValue('--mobile-ui-scale')).toBe('1.25');
        });
    });

    it('does not report success or persist locally when the remote session is absent', async () => {
        mobileScaleMocks.saveRemoteMobileUiScale.mockResolvedValueOnce(undefined);
        render(<UiTextCustomizationPanel />);

        fireEvent.change(screen.getByRole('slider', { name: 'Ukuran teks dan tampilan mobile' }), {
            target: { value: '1.4' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Simpan skala mobile' }));

        expect((await screen.findByRole('alert')).textContent).toContain('tidak mengembalikan hasil penyimpanan');
        expect(window.localStorage.getItem(MOBILE_UI_SCALE_STORAGE_KEY)).toBeNull();
        expect(screen.queryByText('Preferensi disimpan di browser ini.')).toBeNull();
        expect((screen.getByRole('button', { name: 'Simpan skala mobile' }) as HTMLButtonElement).disabled).toBe(false);
    });
});