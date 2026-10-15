/**
 * Tests for mobileUiScale round-trip in profile.ts (fromRow ↔ toRow via getProfile/upsertProfile).
 *
 * Covers the review finding: "Not tested: toRow/fromRow round-trip for mobileUiScale"
 * and the null↔undefined asymmetry fix.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const getUserMock = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  default: {
    from: fromMock,
    auth: { getUser: getUserMock },
  },
}));

const MOBILE_UI_SCALE_DEFAULT = 1;
const queryResult = (data: any): { data: any; error: null } => ({ data, error: null });

describe('Profile mobileUiScale toRow/fromRow round-trip', () => {
  let profileRow: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: 'auth-admin-id' } }, error: null });
    profileRow = {
      id: 'profile-rt-1',
      admin_user_id: 'auth-admin-id',
      mobile_ui_scale: null,
    };

    fromMock.mockImplementation(() => ({
      select: () => ({
        limit: () => ({
          maybeSingle: async () => queryResult(profileRow),
        }),
        eq: () => ({
          maybeSingle: async () => queryResult({ booking_form_template: null }),
          single: async () => queryResult(profileRow),
        }),
      }),
      update: (updates: Record<string, any>) => ({
        eq: () => ({
          select: () => ({
            single: async () => {
              profileRow = { ...profileRow, ...updates };
              return queryResult(profileRow);
            },
          }),
        }),
      }),
      insert: (values: Record<string, any>) => ({
        select: () => ({
          single: async () => {
            profileRow = { ...values, id: 'profile-new-rt' };
            return queryResult(profileRow);
          },
        }),
      }),
    }));
  });

  it('fromRow maps null mobile_ui_scale to the default value (1.0), not undefined', async () => {
    profileRow.mobile_ui_scale = null;
    const { getProfile } = await import('../profile');
    const profile = await getProfile();
    // null in DB → default (1.0), not undefined
    expect(profile?.mobileUiScale).toBe(MOBILE_UI_SCALE_DEFAULT);
  });

  it('fromRow maps a numeric mobile_ui_scale to the same normalized number', async () => {
    profileRow.mobile_ui_scale = 0.8;
    const { getProfile } = await import('../profile');
    const profile = await getProfile();
    expect(profile?.mobileUiScale).toBe(0.8);
  });

  it('write mobileUiScale=1.0 stores the explicit default and reads it back', async () => {
    profileRow.mobile_ui_scale = 0.8; // start with a non-default value
    const { upsertProfile, getProfile } = await import('../profile');

    // Write the default scale
    await upsertProfile({ id: 'profile-rt-1', mobileUiScale: 1.0 });

    expect(profileRow.mobile_ui_scale).toBe(MOBILE_UI_SCALE_DEFAULT);

    // Reading back should yield the default (1.0), not undefined
    const profile = await getProfile();
    expect(profile?.mobileUiScale).toBe(MOBILE_UI_SCALE_DEFAULT);
  });

  it('write mobileUiScale=0.75 stores 0.75 in DB, read back yields 0.75 (clean round-trip)', async () => {
    const { upsertProfile, getProfile } = await import('../profile');

    await upsertProfile({ id: 'profile-rt-1', mobileUiScale: 0.75 });

    expect(profileRow.mobile_ui_scale).toBe(0.75);

    const profile = await getProfile();
    expect(profile?.mobileUiScale).toBe(0.75);
  });

  it('mobileUiScale is never undefined after getProfile (type annotation is accurate)', async () => {
    profileRow.mobile_ui_scale = null;
    const { getProfile } = await import('../profile');
    const profile = await getProfile();
    // mobileUiScale must always be a number — undefined is no longer a valid value
    expect(typeof profile?.mobileUiScale).toBe('number');
  });
});
