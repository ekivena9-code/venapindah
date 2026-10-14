import { describe, expect, it } from 'vitest';
import {
  getGalleryPublicRouteId,
  getPackageShareIdentifier,
  getPublicBookingRegionOptions,
  normalizePublicBookingRegion,
  publicNameFromSlug,
  publicNamePatternsFromSlug,
  resolvePackageShareIdentifier,
  toGalleryPublicSlug,
  toPublicNameSlug,
} from './publicRouting';

describe('public name slugs', () => {
  it('creates a readable slug without URL escape sequences', () => {
    const slug = toPublicNameSlug('DYEA & HUSYAM');

    expect(slug).toBe('DYEA-and-HUSYAM');
    expect(slug).not.toMatch(/%20|%26/i);
    expect(publicNameFromSlug(slug)).toBe('DYEA & HUSYAM');
  });

  it('creates clean gallery links when the title slug is unique', () => {
    const gallery = { id: 'gallery-id', public_id: 'price-list-vena-2026-banten-8ef5y', title: 'Price List Vena 2026 Banten' };

    expect(toGalleryPublicSlug(gallery.title)).toBe('price-list-vena-2026-banten');
    expect(getGalleryPublicRouteId(gallery, [gallery])).toBe('price-list-vena-2026-banten');
  });

  it('keeps the unique id when another gallery has the same slug', () => {
    const gallery = { id: 'gallery-id', public_id: 'price-list-vena-2026-banten-8ef5y', title: 'Price List Vena 2026 Banten' };
    const duplicate = { id: 'other-gallery', public_id: 'other-id', title: 'Price List Vena 2026 Banten' };

    expect(getGalleryPublicRouteId(gallery, [gallery, duplicate])).toBe(gallery.public_id);
  });

  it('includes gallery region in public links and allows the same title in other regions', () => {
    const bantenGallery = { id: 'banten-id', public_id: 'priclesit-8ef5y', title: 'Priclesit', region: 'Banten' };
    const jakartaGallery = { id: 'jakarta-id', public_id: 'priclesit-4abc2', title: 'Priclesit', region: 'Jakarta' };

    expect(toGalleryPublicSlug(bantenGallery.title, bantenGallery.region)).toBe('priclesit-banten');
    expect(getGalleryPublicRouteId(bantenGallery, [bantenGallery, jakartaGallery])).toBe('priclesit-banten');
  });

  it('uses the stored public ID when a title and region slug is duplicated', () => {
    const gallery = { id: 'gallery-id', public_id: 'priclesit-8ef5y', title: 'Priclesit', region: 'Banten' };
    const duplicate = { id: 'other-id', public_id: 'priclesit-4abc2', title: 'Priclesit', region: 'Banten' };

    expect(getGalleryPublicRouteId(gallery, [gallery, duplicate])).toBe(gallery.public_id);
  });

  it('uses readable package identifiers and keeps IDs for duplicate names in one region', () => {
    const pkg = { id: 'package-id', name: 'Paket Wedding Banten', region: 'banten' };
    const duplicate = { id: 'other-package', name: 'Paket Wedding Banten', region: 'BANTEN' };
    const otherRegion = { id: 'jakarta-package', name: 'Paket Wedding Banten', region: 'jakarta' };

    expect(getPackageShareIdentifier(pkg, [pkg, otherRegion])).toBe('paket-wedding-banten');
    expect(getPackageShareIdentifier(pkg, [pkg, duplicate])).toBe(pkg.id);
  });

  it('resolves new package slugs and legacy IDs without guessing among duplicates', () => {
    const pkg = { id: 'package-id', name: 'Paket Wedding Banten' };
    const duplicate = { id: 'other-package', name: 'Paket Wedding Banten' };

    expect(resolvePackageShareIdentifier('paket-wedding-banten', [pkg])).toBe(pkg);
    expect(resolvePackageShareIdentifier(pkg.id, [pkg, duplicate])).toBe(pkg);
    expect(resolvePackageShareIdentifier('paket-wedding-banten', [pkg, duplicate])).toBeNull();
  });

  it('supports punctuation in names and distinguishes ampersands from the word and', () => {
    const slug = toPublicNameSlug('DYEA & HUSYAM (Gold)');

    expect(slug).toBe('DYEA-and-HUSYAM-Gold');
    expect(publicNamePatternsFromSlug(slug)).toEqual([
      'DYEA%&%HUSYAM%Gold',
      'DYEA%and%HUSYAM%Gold',
    ]);
    expect(publicNamePatternsFromSlug('John-and-Mary')).toEqual([
      'John%&%Mary',
      'John%and%Mary',
    ]);
    expect(publicNamePatternsFromSlug('name%wildcard')).toBeNull();
    expect(publicNamePatternsFromSlug('a-and-b-and-c-and-d-and-e-and-f')).toEqual([]);
  });

  it('normalizes booking regions and includes an all-regions option', () => {
    const options = getPublicBookingRegionOptions([
      { value: 'jabodetabek', label: 'Jabodetabek' },
      { value: 'banten', label: 'Banten' },
      { value: 'surabaya', label: 'Surabaya' },
    ]);

    expect(normalizePublicBookingRegion(' JABODETABEK ')).toBe('jabodetabek');
    expect(normalizePublicBookingRegion('all')).toBe('all');
    expect(normalizePublicBookingRegion('')).toBeNull();
    expect(options[0]).toEqual({ value: 'all', label: 'Semua Daerah' });
    expect(options.map(option => option.value)).toContain('surabaya');
  });
});