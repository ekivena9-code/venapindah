import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const fromMock = vi.fn();
const getSessionMock = vi.fn();
type MobileScaleMockResult = {
  data: { mobile_ui_scale: number | null } | null;
  error: { message?: string; code?: string } | null;
};

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
  const eqMock = vi.fn(() => ({ maybeSingle: async () => resolvedValue }));
  return {
    eqMock,
    select: () => ({
      limit: () => ({
        maybeSingle: async () => resolvedValue,
      }),
      eq: eqMock,
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

  it('propagates session errors so the settings UI can report a load failure', async () => {
    const sessionError = new Error('Session request failed.');
    getSessionMock.mockResolvedValue({ data: { session: null }, error: sessionError });
    const { loadRemoteMobileUiScale } = await import('../mobileUiScale');
    await expect(loadRemoteMobileUiScale()).rejects.toBe(sessionError);
  });

  it('returns the default when profile row exists but mobile_ui_scale is NULL', async () => {
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    fromMock.mockReturnValue(makeSelectChain({ data: { mobile_ui_scale: null }, error: null }));
    const { loadRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await loadRemoteMobileUiScale();
    expect(result).toBe(1);
  });

  it('returns the default when no profile row exists for the authenticated account', async () => {
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    const chain = makeSelectChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);
    const { loadRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await loadRemoteMobileUiScale();
    expect(result).toBe(1);
    expect(chain.eqMock).toHaveBeenCalledWith('admin_user_id', 'user-uuid-1');
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
    const successfulUpdate: MobileScaleMockResult = { data: { mobile_ui_scale: 0.8 }, error: null };
    const eqMock = vi.fn((_column: string, _value: string) => ({
      select: () => ({
        maybeSingle: async (): Promise<typeof successfulUpdate> => successfulUpdate,
      }),
    }));
    const updateFn = vi.fn().mockReturnValue({
      eq: eqMock,
    });
    fromMock.mockReturnValue({ update: updateFn });
    const { saveRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await saveRemoteMobileUiScale(0.8);
    expect(updateFn).toHaveBeenCalledWith({ mobile_ui_scale: 0.8 });
    expect(eqMock).toHaveBeenCalledWith('admin_user_id', 'user-uuid-1');
    expect(result).toBe(0.8);
  });

  it('persists the default scale explicitly as 1.0', async () => {
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    const defaultUpdate: MobileScaleMockResult = { data: { mobile_ui_scale: null }, error: null };
    const updateFn = vi.fn().mockReturnValue({
      eq: () => ({
        select: () => ({
          maybeSingle: async (): Promise<typeof defaultUpdate> => defaultUpdate,
        }),
      }),
    });
    fromMock.mockReturnValue({ update: updateFn });
    const { saveRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await saveRemoteMobileUiScale(1.0);
    expect(updateFn).toHaveBeenCalledWith({ mobile_ui_scale: 1 });
    expect(result).toBe(1.0);
  });

  it('rejects when there is no session instead of claiming a successful save', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    const { saveRemoteMobileUiScale } = await import('../mobileUiScale');
    await expect(saveRemoteMobileUiScale(0.8)).rejects.toThrow('Sesi akun Supabase tidak ditemukan.');
  });

  it('rejects when no profile row matches the authenticated account', async () => {
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    const missingProfile: MobileScaleMockResult = { data: null, error: null };
    const updateFn = vi.fn().mockReturnValue({
      eq: () => ({
        select: () => ({
          maybeSingle: async (): Promise<typeof missingProfile> => missingProfile,
        }),
      }),
    });
    fromMock.mockReturnValue({ update: updateFn });
    const { saveRemoteMobileUiScale } = await import('../mobileUiScale');
    await expect(saveRemoteMobileUiScale(0.8)).rejects.toThrow('Profil akun tidak ditemukan; preferensi tidak disimpan.');
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

  it('applies the account default instead of uploading a stale local value', async () => {
    localStorage.setItem('venapindah.mobile-ui-scale.v1', '0.85');
    getSessionMock.mockResolvedValue({ data: VALID_SESSION, error: null });
    fromMock.mockReturnValueOnce(makeSelectChain({ data: { mobile_ui_scale: null }, error: null }));
    const { syncRemoteMobileUiScale } = await import('../mobileUiScale');
    const result = await syncRemoteMobileUiScale();
    expect(result).toBe(1);
    expect(fromMock).toHaveBeenCalledOnce();
    expect(localStorage.getItem('venapindah.mobile-ui-scale.v1')).toBe('1');
    localStorage.removeItem('venapindah.mobile-ui-scale.v1');
  });
});
