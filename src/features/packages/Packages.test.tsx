import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Packages } from './Packages';

vi.mock('../../services/profile', () => ({
  upsertProfile: vi.fn(() => new Promise(() => {})),
  updateProfile: vi.fn(() => new Promise(() => {})),
}));

describe('Packages catalog layout', () => {
  it('filters the catalog to the default region on first open', () => {
    render(
      <Packages
        packages={[
          {
            id: 'pkg-vendor',
            name: 'Paket Vendor',
            price: 5000000,
            category: 'Wedding',
            region: 'vendor',
            physicalItems: [],
            digitalItems: [],
          },
          {
            id: 'pkg-banten',
            name: 'Paket Banten',
            price: 7000000,
            category: 'Wedding',
            region: 'banten',
            physicalItems: [],
            digitalItems: [],
          },
        ]}
        setPackages={vi.fn()}
        addOns={[
          { id: 'addon-vendor', name: 'Add-On Vendor', price: 500000, region: 'vendor' },
          { id: 'addon-banten', name: 'Add-On Banten', price: 700000, region: 'banten' },
        ]}
        setAddOns={vi.fn()}
        projects={[]}
        profile={{ packageCategories: ['Wedding'] } as any}
        setProfile={vi.fn()}
        showNotification={vi.fn()}
        initialAction={null}
        setInitialAction={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Vendor' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Paket Vendor')).toBeTruthy();
    expect(screen.queryByText('Paket Banten')).toBeNull();
    expect(screen.getByText('Add-On Vendor')).toBeTruthy();
    expect(screen.queryByText('Add-On Banten')).toBeNull();
  });

  it('renders package and add-on sections separately with add-ons below packages', () => {
    render(
      <Packages
        packages={[
          {
            id: 'pkg-1',
            name: 'Paket Premium',
            price: 5000000,
            category: 'Wedding',
            region: 'vendor',
            physicalItems: [],
            digitalItems: ['Album Digital'],
            processingTime: '7 hari',
            photographers: '2 fotografer',
          },
        ]}
        setPackages={vi.fn()}
        addOns={[
          { id: 'addon-1', name: 'Album', price: 900000, region: 'vendor' },
        ]}
        setAddOns={vi.fn()}
        projects={[]}
        profile={{ packageCategories: ['Wedding'] } as any}
        setProfile={vi.fn()}
        showNotification={vi.fn()}
        initialAction={null}
        setInitialAction={vi.fn()}
      />,
    );

    const packageHeading = screen.getByRole('heading', { name: 'Paket' });
    const addOnHeading = screen.getByRole('heading', { name: 'Add-On' });

    expect(packageHeading).toBeTruthy();
    expect(addOnHeading).toBeTruthy();
    expect(packageHeading.compareDocumentPosition(addOnHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('updates package order immediately while the server save is still pending', () => {
    render(
      <Packages
        packages={[
          {
            id: 'pkg-1',
            name: 'Paket Pertama',
            price: 5000000,
            category: 'Wedding',
            region: 'vendor',
            physicalItems: [],
            digitalItems: [],
          },
          {
            id: 'pkg-2',
            name: 'Paket Kedua',
            price: 7000000,
            category: 'Wedding',
            region: 'vendor',
            physicalItems: [],
            digitalItems: [],
          },
        ]}
        setPackages={vi.fn()}
        addOns={[]}
        setAddOns={vi.fn()}
        projects={[]}
        profile={{
          publicPageConfig: { packageOrder: ['pkg-1', 'pkg-2'] },
        } as any}
        setProfile={vi.fn()}
        showNotification={vi.fn()}
        initialAction={null}
        setInitialAction={vi.fn()}
      />,
    );

    const firstPackageCard = screen.getByText('Paket Pertama').closest('.group');
    expect(firstPackageCard).toBeTruthy();
    const mobileMoveDown = firstPackageCard?.querySelector('.package-card-mobile-toolbar button[aria-label="Pindah ke Bawah"]');
    expect(mobileMoveDown).toBeTruthy();
    fireEvent.click(mobileMoveDown as HTMLButtonElement);

    const firstMobileToolbar = firstPackageCard?.querySelector('.package-card-mobile-toolbar');
    const secondPackageCard = screen.getByText('Paket Kedua').closest('.group');
    const secondMobileToolbar = secondPackageCard?.querySelector('.package-card-mobile-toolbar');
    expect(within(firstMobileToolbar as HTMLElement).getByText('#2')).toBeTruthy();
    expect(within(secondMobileToolbar as HTMLElement).getByText('#1')).toBeTruthy();
  });

  it('offers Add-On duplication with a destination-region selector', () => {
    render(
      <Packages
        packages={[]}
        setPackages={vi.fn()}
        addOns={[{ id: 'addon-1', name: 'Album Tambahan', price: 900000, region: 'banten' }]}
        setAddOns={vi.fn()}
        projects={[]}
        profile={{ publicPageConfig: { addOnOrder: ['addon-1'] } } as any}
        setProfile={vi.fn()}
        showNotification={vi.fn()}
        initialAction={null}
        setInitialAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Banten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplikat Add-On' }));
    expect(screen.getByRole('heading', { name: 'Duplikasi Add-On ke Wilayah Lain' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Banten' })[1]);
    expect(screen.getByText(/Album Tambahan \(Banten\)/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Duplikasi Sekarang' })).toBeTruthy();
  });

  it('keeps Add-On order changes visible immediately while saving', () => {
    const { rerender } = render(
      <Packages
        packages={[]}
        setPackages={vi.fn()}
        addOns={[
          { id: 'addon-1', name: 'Add-On Pertama', price: 900000, region: 'vendor' },
          { id: 'addon-2', name: 'Add-On Kedua', price: 1200000, region: 'vendor' },
        ]}
        setAddOns={vi.fn()}
        projects={[]}
        profile={{ publicPageConfig: { addOnOrder: ['addon-1', 'addon-2'] } } as any}
        setProfile={vi.fn()}
        showNotification={vi.fn()}
        initialAction={null}
        setInitialAction={vi.fn()}
      />,
    );

    const firstAddOnCard = screen.getByText('Add-On Pertama').closest('article');
    expect(firstAddOnCard).toBeTruthy();
    fireEvent.click(within(firstAddOnCard as HTMLElement).getByRole('button', { name: 'Pindah ke Bawah' }));

    expect(within(firstAddOnCard as HTMLElement).getByText('#2')).toBeTruthy();
    expect(screen.getByText('Add-On Kedua').closest('article')?.textContent).toContain('#1');

    rerender(
      <Packages
        packages={[]}
        setPackages={vi.fn()}
        addOns={[
          { id: 'addon-1', name: 'Add-On Pertama', price: 900000, region: 'vendor' },
          { id: 'addon-2', name: 'Add-On Kedua', price: 1200000, region: 'vendor' },
        ]}
        setAddOns={vi.fn()}
        projects={[]}
        profile={{ publicPageConfig: { addOnOrder: ['addon-1', 'addon-2'] } } as any}
        setProfile={vi.fn()}
        showNotification={vi.fn()}
        initialAction={null}
        setInitialAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Add-On Pertama').closest('article')?.textContent).toContain('#2');
    expect(screen.getByText('Add-On Kedua').closest('article')?.textContent).toContain('#1');
  });

  it('keeps Add-Ons missing from the saved order in a stable alphabetical position', () => {
    render(
      <Packages
        packages={[]}
        setPackages={vi.fn()}
        addOns={[
          { id: 'addon-z', name: 'Zulu', price: 900000, region: 'vendor' },
          { id: 'addon-a', name: 'Alpha', price: 1200000, region: 'vendor' },
          { id: 'addon-pinned', name: 'Pilihan Utama', price: 1500000, region: 'vendor' },
        ]}
        setAddOns={vi.fn()}
        projects={[]}
        profile={{ publicPageConfig: { addOnOrder: ['addon-pinned'] } } as any}
        setProfile={vi.fn()}
        showNotification={vi.fn()}
        initialAction={null}
        setInitialAction={vi.fn()}
      />,
    );

    const cards = screen.getAllByText(/Pilihan Utama|Alpha|Zulu/).map(element => element.closest('article'));
    expect(cards.map(card => card?.querySelector('h3')?.textContent)).toEqual(['Pilihan Utama', 'Alpha', 'Zulu']);
  });
});
