import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewType } from '../types';
import { LAST_ROUTE_STORAGE_KEY } from '../routes/routesConfig';
import { resolveAuthenticatedViewFromHash, useAppRouting } from './useAppRouting';

const hookProps = {
  isAuthenticated: true,
  profile: {},
  teamPaymentsLoaded: true,
  setTeamProjectPayments: vi.fn(),
  setTeamPaymentsLoaded: vi.fn(),
  onMarkNotificationRead: vi.fn(),
  appDataLoader: {
    loadTotals: vi.fn().mockResolvedValue(undefined),
    loadClientFeedback: vi.fn().mockResolvedValue(undefined),
  },
};

describe('authenticated route restoration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = '';
  });

  it.each([
    ['#/Manajemen%20Pengantin', ViewType.CLIENTS],
    ['#/Input%20Package', ViewType.PACKAGES],
    ['#/clients?tab=analytics', ViewType.CLIENTS],
    ['#/projects', ViewType.CLIENTS],
    ['#/Pricelist%20Upload', ViewType.GALLERY],
  ])('resolves %s to its authenticated page', (hash, expectedView) => {
    expect(resolveAuthenticatedViewFromHash(hash)).toBe(expectedView);
  });

  it('does not rewrite public gallery URLs as the authenticated gallery page', () => {
    expect(resolveAuthenticatedViewFromHash('#/gallery/primaryamclesit-banten')).toBeNull();
  });

  it('opens the addressed authenticated view immediately after reload', () => {
    window.location.hash = '#/Input%20Package';

    const { result } = renderHook(() => useAppRouting(hookProps));

    expect(result.current.activeView).toBe(ViewType.PACKAGES);
    expect(result.current.route).toBe('/Input Package');
  });

  it('restores the last authenticated page when the hash is empty', () => {
    window.localStorage.setItem(LAST_ROUTE_STORAGE_KEY, '#/Manajemen%20Pengantin');

    const { result } = renderHook(() => useAppRouting(hookProps));

    expect(result.current.activeView).toBe(ViewType.CLIENTS);
  });

  it('persists dashboard navigation and updates the address bar', () => {
    window.location.hash = '#/Input%20Package';
    const { result } = renderHook(() => useAppRouting(hookProps));

    act(() => result.current.handleNavigation(ViewType.CLIENTS));

    expect(window.location.hash).toBe('#/Manajemen%20Pengantin');
    expect(window.localStorage.getItem(LAST_ROUTE_STORAGE_KEY)).toBe('#/Manajemen%20Pengantin');
  });
});
