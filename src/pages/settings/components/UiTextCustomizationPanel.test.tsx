import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UiTextCustomizationPanel from './UiTextCustomizationPanel';
import { customizeNavigationLabel, customizeUiText, readUiTextOverrides } from '../../../utils/uiTextCustomization';

vi.mock('../../../services/uiTextOverrides', () => ({
    loadUiTextOverrides: vi.fn().mockResolvedValue(undefined),
    saveRemoteUiTextOverrides: vi.fn().mockResolvedValue(undefined),
}));

describe('UiTextCustomizationPanel', () => {
    beforeEach(() => {
        window.localStorage.clear();
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
});