/**
 * Public Routing & URL Resolution Utility
 * 
 * Provides robust resolution for public URLs whether accessed via:
 * - Direct browser pathname (e.g. https://domain.com/public/abc123, /portal/abc123, /invoice/xyz)
 * - Hash URL (e.g. https://domain.com/#/public/abc123, #/portal/abc123)
 * - Direct links from WhatsApp, browser address bar, new tab, or incognito
 * 
 * Guarantees zero reloads, immediate first-render recognition, and full compatibility.
 */

export function toPublicNameSlug(name: string): string {
  return name
    .trim()
    .replace(/&/g, '-and-')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function toGalleryPublicSlug(title: string, region?: string | null): string {
  const titleSlug = toPublicNameSlug(title).toLowerCase();
  const regionSlug = region?.trim() ? toPublicNameSlug(region).toLowerCase() : '';
  return [titleSlug, regionSlug].filter(Boolean).join('-');
}

export function getGalleryPublicRouteId(
  gallery: { id: string; public_id?: string | null; title: string; region?: string | null },
  galleries: readonly { id: string; public_id?: string | null; title: string; region?: string | null }[] = []
): string {
  const slug = toGalleryPublicSlug(gallery.title, gallery.region);
  const hasCollision = galleries.some(candidate =>
    candidate.id !== gallery.id && (
      candidate.id === slug ||
      candidate.public_id === slug ||
      toGalleryPublicSlug(candidate.title, candidate.region) === slug
    )
  );

  return slug && !hasCollision ? slug : gallery.public_id || gallery.id;
}

export function getPackageShareIdentifier(
  pkg: { id: string; name: string; region?: string | null },
  packages: readonly { id: string; name: string; region?: string | null }[]
): string {
  const slug = toPublicNameSlug(pkg.name).toLowerCase();
  const region = (pkg.region || '').trim().toLowerCase();
  const hasCollision = packages.some(candidate =>
    candidate.id !== pkg.id &&
    (candidate.region || '').trim().toLowerCase() === region &&
    toPublicNameSlug(candidate.name).toLowerCase() === slug
  );

  return slug && !hasCollision ? slug : pkg.id;
}

export function resolvePackageShareIdentifier<T extends { id: string; name: string }>(
  identifier: string,
  packages: readonly T[]
): T | null {
  const idMatch = packages.find(pkg => pkg.id === identifier);
  if (idMatch) return idMatch;

  const slugMatches = packages.filter(pkg =>
    toPublicNameSlug(pkg.name).toLowerCase() === identifier.toLowerCase()
  );
  return slugMatches.length === 1 ? slugMatches[0] : null;
}

export function normalizePublicBookingRegion(region?: string | null): string | null {
  const value = region?.trim();
  if (!value) return null;

  const normalized = value.toLowerCase();
  const allRegionAliases = new Set(['all', 'semua', 'semua-daerah', 'semua daerah', 'all-region', 'all-regions']);

  if (allRegionAliases.has(normalized)) {
    return 'all';
  }

  return normalized;
}

export function getPublicBookingRegionOptions(
  regions: Array<{ value: string; label: string }> = [],
  includeAll = true
): Array<{ value: string; label: string }> {
  const seen = new Set<string>();
  const options: Array<{ value: string; label: string }> = [];

  if (includeAll) {
    options.push({ value: 'all', label: 'Semua Daerah' });
    seen.add('all');
  }

  for (const region of regions ?? []) {
    const normalizedValue = normalizePublicBookingRegion(region.value) ?? region.value.toLowerCase();
    if (normalizedValue === 'all' || seen.has(normalizedValue)) continue;
    seen.add(normalizedValue);
    options.push({ value: normalizedValue, label: region.label || normalizedValue });
  }

  return options;
}

export function publicNameFromSlug(slug: string): string {
  return slug.trim().replace(/-and-/gi, ' & ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

export function publicNamePatternsFromSlug(slug: string): string[] | null {
  if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(slug)) return null;

  const segments = slug.split(/(-and-)/i);
  if (segments.filter(segment => /^-and-$/i.test(segment)).length > 4) return [];

  return segments.reduce<string[]>((patterns, segment) => {
    if (/^-and-$/i.test(segment)) {
      return patterns.flatMap(pattern => [`${pattern}%&%`, `${pattern}%and%`]);
    }
    const safeSegment = segment.replace(/-/g, '%');
    return patterns.map(pattern => `${pattern}${safeSegment}`);
  }, ['']);
}

export function resolveCanonicalRoute(pathname?: string, hash?: string, search?: string): string {
  if (typeof window === 'undefined') return '#/home';

  const rawPath = (pathname !== undefined ? pathname : window.location.pathname) || '/';
  const rawHash = (hash !== undefined ? hash : window.location.hash) || '';
  const rawSearch = (search !== undefined ? search : window.location.search) || '';

  // Clean pathname: remove trailing slashes (except root)
  const path = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;

  // 1. If path is a meaningful path (not root '/' or '/index.html'), path takes precedence for direct access
  if (path && path !== '/' && path !== '/index.html') {
    // Contract routes
    if (path.startsWith('/portal/contract/') || path.startsWith('/contract/')) {
      const id = path.split(/\/(?:portal\/)?contract\//)[1];
      return `#/portal/contract/${id}${rawSearch}`;
    }
    // Invoice routes
    if (path.startsWith('/portal/invoice/') || path.startsWith('/invoice/')) {
      const id = path.split(/\/(?:portal\/)?invoice\//)[1];
      return `#/portal/invoice/${id}${rawSearch}`;
    }
    // Receipt routes
    if (path.startsWith('/portal/receipt/') || path.startsWith('/receipt/')) {
      const id = path.split(/\/(?:portal\/)?receipt\//)[1];
      return `#/portal/receipt/${id}${rawSearch}`;
    }
    // Checklist / project portal routes
    if (path.startsWith('/checklist-portal/') || path.startsWith('/project/')) {
      const id = path.split(/\/(?:checklist-portal|project)\//)[1];
      return `#/checklist-portal/${id}${rawSearch}`;
    }
    // Freelancer portal routes
    if (path.startsWith('/freelancer-portal/') || path.startsWith('/team-portal/') || path.startsWith('/team/')) {
      const id = path.split(/\/(?:freelancer-portal|team-portal|team)\//)[1];
      return `#/freelancer-portal/${id}${rawSearch}`;
    }
    // Gallery routes
    if (path.startsWith('/gallery/')) {
      const id = path.split(/\/gallery\//)[1];
      return `#/gallery/${id}${rawSearch}`;
    }
    // Client portal routes
    if (path.startsWith('/portal/')) {
      const id = path.split(/\/portal\//)[1];
      return `#/portal/${id}${rawSearch}`;
    }
    // Share routes
    if (path.startsWith('/share/')) {
      const sub = path.slice('/share/'.length);
      const parts = sub.split('/');
      const shareType = parts[0];
      const shareId = parts.slice(1).join('/');

      if (shareType === 'booking') return `#/public-booking${shareId ? `?id=${encodeURIComponent(shareId)}` : ''}${rawSearch ? `&${rawSearch.replace('?', '')}` : ''}`;
      if (shareType === 'project') return `#/checklist-portal/${shareId}${rawSearch}`;
      if (shareType === 'client' || shareType === 'portal') return `#/portal/${shareId}${rawSearch}`;
      if (shareType === 'invoice') return `#/portal/invoice/${shareId}${rawSearch}`;
      if (shareType === 'receipt') return `#/portal/receipt/${shareId}${rawSearch}`;
      if (shareType === 'contract') return `#/portal/contract/${shareId}${rawSearch}`;
      if (shareType === 'gallery') return `#/gallery/${shareId}${rawSearch}`;
      if (shareType === 'freelancer' || shareType === 'team') return `#/freelancer-portal/${shareId}${rawSearch}`;
      if (shareType === 'packages') return `#/public-packages${rawSearch}`;
      if (shareType === 'lead') return `#/public-lead-form${rawSearch}`;
      if (shareType === 'feedback') return `#/feedback${rawSearch}`;
      // Generic share
      return `#/public/${sub}${rawSearch}`;
    }
    // Public slug routes e.g. /public/:slug
    if (path.startsWith('/public/')) {
      const slug = path.split(/\/public\//)[1];
      return `#/public/${slug}${rawSearch}`;
    }
    // Booking & packages
    if (path === '/booking' || path === '/public-booking') return `#/public-booking${rawSearch}`;
    if (path.startsWith('/public-booking/')) return `#/public-booking/${path.slice('/public-booking/'.length)}${rawSearch}`;
    if (path === '/packages' || path === '/public-packages') return `#/public-packages${rawSearch}`;
    if (path.startsWith('/public-packages/')) return `#/public-packages/${path.slice('/public-packages/'.length)}${rawSearch}`;
    if (path === '/public-lead-form' || path === '/form-prospek') return `#/public-lead-form${rawSearch}`;
    if (path.startsWith('/public-lead-form/')) return `#/public-lead-form/${path.slice('/public-lead-form/'.length)}${rawSearch}`;
    if (path === '/feedback') return `#/feedback${rawSearch}`;
    if (path === '/profile') return `#/profile${rawSearch}`;
    if (path.startsWith('/portfolio/')) return `#/portfolio/${path.slice('/portfolio/'.length)}${rawSearch}`;
    if (path === '/login') return `#/login${rawSearch}`;
    if (path === '/home') return `#/home${rawSearch}`;

    // Any other single root path like /abc123 can be resolved via public router
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 1 && !['dashboard', 'settings', 'clients', 'projects', 'finance', 'team', 'leads'].includes(segments[0])) {
      return `#/public/${segments[0]}${rawSearch}`;
    }
  }

  // 2. Check hash route
  if (rawHash && rawHash !== '#' && rawHash !== '#/') {
    // Normalize aliases in hash
    if (rawHash.startsWith('#/invoice/')) {
      return rawHash.replace('#/invoice/', '#/portal/invoice/');
    }
    if (rawHash.startsWith('#/receipt/')) {
      return rawHash.replace('#/receipt/', '#/portal/receipt/');
    }
    if (rawHash.startsWith('#/contract/')) {
      return rawHash.replace('#/contract/', '#/portal/contract/');
    }
    if (rawHash.startsWith('#/project/')) {
      return rawHash.replace('#/project/', '#/checklist-portal/');
    }
    return rawHash;
  }

  return '#/home';
}

/**
 * Checks whether a given canonical route is a public-facing route
 * that does not require an active dashboard user session.
 */
export function isPublicRoute(route: string): boolean {
  if (!route) return false;

  if (route === '#' || route === '#/' || route.startsWith('#/?') || route.startsWith('#?')) {
    return true;
  }

  const publicPrefixes = [
    '#/public',
    '#/share',
    '#/portal',
    '#/invoice',
    '#/receipt',
    '#/contract',
    '#/gallery',
    '#/checklist-portal',
    '#/freelancer-portal',
    '#/public-booking',
    '#/public-packages',
    '#/public-lead-form',
    '#/feedback',
    '#/suggestion-form',
    '#/test-signature',
    '#/profile',
    '#/portfolio',
    '#/login',
    '#/home',
  ];

  return publicPrefixes.some(prefix => route === prefix || route.startsWith(`${prefix}/`) || route.startsWith(`${prefix}?`));
}

/**
 * Generates an absolute public URL for sharing.
 * Supports both clean path format (https://domain.com/portal/xxx)
 * and hash format (https://domain.com/#/portal/xxx).
 */
export function buildPublicShareUrl(
  type: 'portal' | 'invoice' | 'receipt' | 'contract' | 'gallery' | 'checklist' | 'freelancer' | 'booking' | 'packages' | 'lead' | 'feedback' | 'public',
  identifier?: string,
  options: { cleanUrl?: boolean; query?: Record<string, string> } = {}
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const clean = options.cleanUrl ?? false; // Default to hash or clean based on caller preference
  const id = identifier ? encodeURIComponent(identifier.trim()) : '';

  let pathPart = '';
  switch (type) {
    case 'portal':
      pathPart = id ? `portal/${id}` : 'portal';
      break;
    case 'invoice':
      pathPart = id ? `portal/invoice/${id}` : 'portal/invoice';
      break;
    case 'receipt':
      pathPart = id ? `portal/receipt/${id}` : 'portal/receipt';
      break;
    case 'contract':
      pathPart = id ? `portal/contract/${id}` : 'portal/contract';
      break;
    case 'gallery':
      pathPart = id ? `gallery/${id}` : 'gallery';
      break;
    case 'checklist':
      pathPart = id ? `checklist-portal/${id}` : 'checklist-portal';
      break;
    case 'freelancer':
      pathPart = id ? `freelancer-portal/${id}` : 'freelancer-portal';
      break;
    case 'booking':
      pathPart = id ? `public-booking/${id}` : 'public-booking';
      break;
    case 'packages':
      pathPart = id ? `public-packages/${id}` : 'public-packages';
      break;
    case 'lead':
      pathPart = id ? `public-lead-form/${id}` : 'public-lead-form';
      break;
    case 'feedback':
      pathPart = 'feedback';
      break;
    case 'public':
    default:
      pathPart = id ? `public/${id}` : 'public';
      break;
  }

  let queryString = '';
  if (options.query && Object.keys(options.query).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(options.query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, v);
      }
    });
    const qs = searchParams.toString();
    if (qs) queryString = `?${qs}`;
  }

  if (clean) {
    return `${origin}/${pathPart}${queryString}`;
  }
  return `${origin}/#/${pathPart}${queryString}`;
}

/**
 * Copies a link to clipboard with fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.warn('[copyToClipboard] navigator.clipboard failed, using fallback:', e);
  }

  // Fallback using textarea
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('[copyToClipboard] fallback copy failed:', err);
    return false;
  }
}
