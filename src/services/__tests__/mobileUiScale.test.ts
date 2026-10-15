import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const fromMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: fromMock,
    auth: { getSession: getSessionMock },
  },
  default: {
    from: fromMock,
    auth: { getSession: getSessionMock },
  },
}));

// Mock localStorage + window.dispatchEvent for jsdom env
const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

const VALID_SESSION = {
  session: {
    user: { id: 'user-uuid-1' },
    access_token: 'token',
  },
};

// Helper to build a chainable from() mock for .select().limit().maybeSingle()
function makeSelectChain(resolvedValue: { data: any; error: any }) {
  return {
    select: () => ({
      limit: () => ({
        maybeSingle: async () => resolvedValue,
      }),
      eq: () => ({
        maybeSingle: async () => resolvedValue,
        select: () => ({
          maybeSingle: async () => resolvedValue,
        }),
      }),
    }),
  };
}

// Helper to build a chainable from() mock for .update().eq().select().maybeSingle()
function makeUpdateChain(resolvedValue: { data: any; error: any }) {
  return {
    update: () => ({
      eq: () => ({
        select: () => ({
          maybeSingle: async () => resolvedValue,
        }),
      }),
    }),
  };
}

describe('loadRemoteMobileUiScale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchEventSpy.mockClear();
  });

  it('returns undefined when there is no session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    const { loadRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await loadRemoteMobileUiScale();
    expect(result).toBeUndefined();
  });

  it('returns null when profile row exists but mobile_ui_scale is NULL', async () => {
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    fromMock.mockReturnValue(makeSelectChain({ data: { mobile_ui_scale: null }, error: null }));
    const { loadRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await loadRemoteMobileUiScale();
    expect(result).toBeNull();
  });

  it('returns undefined when no profile row exists', async () => {
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    fromMock.mockReturnValue(makeSelectChain({ data: null, error: null }));
    const { loadRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await loadRemoteMobileUiScale();
    expect(result).toBeUndefined();
  });

  it('returns a normalized number when column has a valid value', async () => {
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    fromMock.mockReturnValue(makeSelectChain({ data: { mobile_ui_scale: 0.8 }, error: null }));
    const { loadRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await loadRemoteMobileUiScale();
    expect(result).toBe(0.8);
  });

  it('clamps an out-of-range value from the database', async () => {
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    fromMock.mockReturnValue(makeSelectChain({ data: { mobile_ui_scale: 2.5 }, error: null }));
    const { loadRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await loadRemoteMobileUiScale();
    // normalizeMobileUiScale clamps to max 1.4
    expect(result).toBe(1.4);
  });
});

describe('saveRemoteMobileUiScale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchEventSpy.mockClear();
  });

  it('calls update with the given scale value', async () => {
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    const updateFn = vi.fn().mockReturnValue({
      eq: () => ({
        select: () => ({
          maybeSingle: async () => ({ data: { mobile_ui_scale: 0.8 }, error: null }),
        }),
      }),
    });
    fromMock.mockReturnValue({ update: updateFn });
    const { saveRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await saveRemoteMobileUiScale(0.8);
    expect(updateFn).toHaveBeenCalledWith({ mobile_ui_scale: 0.8 });
    expect(result).toBe(0.8);
  });

  it('saves null to the profiles table when scale is the default (1.0)', async () => {
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    const updateFn = vi.fn().mockReturnValue({
      eq: () => ({
        select: () => ({
          maybeSingle: async () => ({ data: { mobile_ui_scale: null }, error: null }),
        }),
      }),
    });
    fromMock.mockReturnValue({ update: updateFn });
    const { saveRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await saveRemoteMobileUiScale(1.0);
    expect(updateFn).toHaveBeenCalledWith({ mobile_ui_scale: null });
    // null in DB means default 1.0
    expect(result).toBe(1.0);
  });

  it('returns undefined when there is no session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    const { saveRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await saveRemoteMobileUiScale(0.8);
    expect(result).toBeUndefined();
  });

  it('returns undefined (does not throw) when profile row does not exist', async () => {
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    const updateFn = vi.fn().mockReturnValue({
      eq: () => ({
        select: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    });
    fromMock.mockReturnValue({ update: updateFn });
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { saveRemoteMobileUiScale } = await import('../mobileUiScale');
    // Must not throw — returns undefined instead
    await expect(saveRemoteMobileUiScale(0.8)).resolves.toBeUndefined();
    // Must log a warning so silent failures are observable
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[MobileUiScale] No profile row found for current user; scale preference not saved.',
    );
    consoleWarnSpy.mockRestore();
  });
});

describe('syncRemoteMobileUiScale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchEventSpy.mockClear();
    // Clear localStorage scale so each test starts clean
    localStorage.removeItem('venapindah.mobile-ui-scale.v1');
  });

  it('applies and dispatches the sync event when remote value is present', async () => {
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    fromMock.mockReturnValue(makeSelectChain({ data: { mobile_ui_scale: 0.75 }, error: null }));
    const { syncRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await syncRemoteMobileUiScale();
    expect(result).toBe(0.75);
    expect(dispatchEventSpy).toHaveBeenCalledOnce();
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('venapindah-mobile-ui-scale-sync');
    expect(event.detail).toBe(0.75);
    // Confirm it was written to localStorage
    expect(localStorage.getItem('venapindah.mobile-ui-scale.v1')).toBe('0.75');
  });

  it('returns null when no session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    const { syncRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await syncRemoteMobileUiScale();
    expect(result).toBeNull();
    expect(dispatchEventSpy).not.toHaveBeenCalled();
  });

  it('logs a warning and returns null when sync-up errors on first device', async () => {
    // remote is null (no stored preference), local scale differs from default
    localStorage.setItem('venapindah.mobile-ui-scale.v1', '0.85');
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    // loadRemoteMobileUiScale: returns null (no preference stored yet)
    fromMock.mockReturnValueOnce(makeSelectChain({ data: { mobile_ui_scale: null }, error: null }));
    // saveRemoteMobileUiScale: update fails (e.g., network error)
    fromMock.mockReturnValueOnce({
      update: () => ({
        eq: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: null, error: { message: 'network error', code: 'net' } }),
          }),
        }),
      }),
    });
    const { syncRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await syncRemoteMobileUiScale();
    // Should not throw — returns null on failure
    expect(result).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[MobileUiScale] Failed to push local scale to remote:',
      expect.anything(),
    );
    consoleWarnSpy.mockRestore();
    localStorage.removeItem('venapindah.mobile-ui-scale.v1');
  });
});
