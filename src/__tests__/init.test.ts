/**
 * Tests for src/init.ts startup behavior.
 *
 * Covers the review finding: "Not tested: init.ts startup sequence
 * (the applyMobileUiScale-before-auth path)"
 *
 * Strategy: mock all three dependencies at the top level (required by Vitest's
 * hoisting rules), then use vi.resetModules() + re-import inside each test so
 * the module runs fresh with the current mock implementations.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Top-level mocks (hoisted by Vitest) ----

const applyMobileUiScaleMock = vi.fn((v: number) => v);
const readMobileUiScaleMock = vi.fn(() => 1.0);
const syncRemoteMobileUiScaleMock = vi.fn().mockResolvedValue(1.0);
const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock('../utils/mobileUiScale', () => ({
  applyMobileUiScale: applyMobileUiScaleMock,
  readMobileUiScale: readMobileUiScaleMock,
}));

vi.mock('../services/mobileUiScale', () => ({
  syncRemoteMobileUiScale: syncRemoteMobileUiScaleMock,
}));

vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  },
}));

describe('init.ts startup sequence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Default: no session
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it('applies the locally cached scale synchronously (before any auth call)', async () => {
    readMobileUiScaleMock.mockReturnValue(0.85);

    await import('../init');

    // readMobileUiScale must have been called and its value forwarded to applyMobileUiScale
    expect(readMobileUiScaleMock).toHaveBeenCalled();
    expect(applyMobileUiScaleMock).toHaveBeenCalledWith(0.85);
  });

  it('calls syncRemoteMobileUiScale when a valid session exists at startup', async () => {
    readMobileUiScaleMock.mockReturnValue(1.0);
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'uid-1' }, access_token: 'tok' } },
      error: null,
    });

    await import('../init');

    // Allow the promise microtask queue to flush
    await Promise.resolve();

    expect(syncRemoteMobileUiScaleMock).toHaveBeenCalled();
  });

  it('does NOT call syncRemoteMobileUiScale when no session exists at startup', async () => {
    readMobileUiScaleMock.mockReturnValue(1.0);
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });

    await import('../init');

    await Promise.resolve();

    expect(syncRemoteMobileUiScaleMock).not.toHaveBeenCalled();
  });
});
