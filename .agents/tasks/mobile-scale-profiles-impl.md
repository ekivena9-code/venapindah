# Implementation Plan: Persist `mobile_ui_scale` via Supabase `profiles` Table

## Goal
The user sets a mobile UI scale in Settings → "Kustomisasi Teks" tab, saves it, but on every
**page reload** the scale reverts to 100% (default). The setting should apply **immediately on
load** — without needing to open that tab — and remain active on any other device using the
same Supabase account.

---

## Root-Cause Analysis (from code investigation)

### Current storage: `auth.user_metadata`

`src/services/mobileUiScale.ts` stores the scale in **Supabase Auth user metadata**
(`supabase.auth.updateUser({ data: { mobile_ui_scale: value } })`). Reading it back requires
calling `supabase.auth.getUser()`, which is **async** and fires *after* React renders.

### Why the scale appears to reset on reload

`src/init.ts` runs before React and tries to read the cached scale from the Supabase session in
`localStorage` (key pattern `sb-*-auth-token`). It looks for
`parsed.user.user_metadata.mobile_ui_scale` inside the cached JWT.

**The problem:** Supabase stores a short-lived access-token JWT in `localStorage`. The JWT is
issued at login and **is NOT automatically re-issued when user metadata is updated via
`updateUser`**. The updated metadata is persisted server-side, but the cached `access_token`
in `localStorage` still carries the old (or absent) `mobile_ui_scale`. So:

1. User sets scale → `saveRemoteMobileUiScale` calls `supabase.auth.updateUser(...)` ✓
2. Page reload → `readCachedSupabaseScale()` in `init.ts` decodes the stale JWT → no
   `mobile_ui_scale` found → falls back to `localStorage` → returns `MOBILE_UI_SCALE_DEFAULT`
   (1.0) if not also written to `localStorage` at save time.
3. `syncRemoteMobileUiScale()` fires async a few hundred ms later and applies the correct value,
   causing a visible late re-render (flicker) or, when on another device with a fresh session,
   the localStorage value is absent entirely so default 100% shows.

### Why the `localStorage` fallback sometimes saves it correctly (and sometimes not)

`saveMobileUiScale` in `utils/mobileUiScale.ts` **does** write to `localStorage`. So if you
save, reload, and never clear the browser, you'd see the correct value. But:
- A **fresh device / fresh browser** has no `localStorage` entry → always shows 100%.
- The `init.ts` branch `cachedSupabaseScale !== null` calls `saveMobileUiScale` only when the
  JWT cache has the value. When the JWT cache is stale/missing it never re-saves to
  `localStorage`.
- The async `syncRemoteMobileUiScale()` does eventually call `saveMobileUiScale`, but React has
  already rendered at 100%.

### Why using the `profiles` table fixes this

The `profiles` table (row per user, RLS-scoped) is read synchronously-compatible: we can store
`mobile_ui_scale` in a dedicated JSONB/numeric column there. This mirrors how `ui_text_overrides`
work — a separate table keyed by `user_id` with RLS, loaded once after login.

More importantly: after any change, the value is reliably readable from the database on the
**next** page load regardless of JWT staleness. Combined with the existing `init.ts` approach
(which already reads from `localStorage`), the correct pattern is:

1. **Save** → write to `profiles.mobile_ui_scale` + write to `localStorage` (belt & suspenders).
2. **Load on startup** → `init.ts` reads `localStorage` immediately (works for same-device), and
   kicks off async `syncRemoteMobileUiScale` to fetch from `profiles` and refresh `localStorage`
   for subsequent loads.
3. **Fresh device** → `localStorage` is empty, `init.ts` renders at default 100% for ~200ms,
   then `syncRemoteMobileUiScale` fires after session is confirmed and the correct value is set.
   This is the same behaviour as `ui_text_overrides` — acceptable because it only flashes on
   the very first load on a new device.

**Decision:** add a `mobile_ui_scale` column of type `NUMERIC` (nullable, 0.4–1.4) to the
`profiles` table. This avoids a new table (keeping the schema simple), is naturally RLS-scoped
via the existing profile policy, and is consistent with how all other per-user settings are
stored. Avoid using `auth.user_metadata` for persistence; it relies on a stale JWT cache that
the app cannot reliably invalidate.

---

## Dependency Order of Changes

```
1. SQL migration  →  2. Profile type  →  3. profile.ts service  →  4. mobileUiScale service
→  5. init.ts  →  6. UiTextCustomizationPanel (no real change, just verification)  →  7. Tests
```

---

## Implementation Plan

- [ ] 1. Add `mobile_ui_scale` SQL migration
      Create a new migration file that adds a nullable `NUMERIC` column to `profiles`.
      No data backfill needed (nullable → existing rows get NULL → treated as "not set").
      
      **File to create:**
      `supabase/migrations/20261016000000_profiles_mobile_ui_scale.sql`
      
      **Content:**
      ```sql
      -- Add mobile UI scale preference column to profiles table.
      -- NULL means the user has not customised the scale (apply default 1.0).
      ALTER TABLE public.profiles
          ADD COLUMN IF NOT EXISTS mobile_ui_scale NUMERIC
              CHECK (mobile_ui_scale IS NULL OR (mobile_ui_scale >= 0.4 AND mobile_ui_scale <= 1.4));

      -- No RLS changes needed — profile rows are already RLS-scoped per admin_user_id.
      NOTIFY pgrst, 'reload schema';
      ```
      
      **Verify:** Run migration against local Supabase (`supabase db push` or via the dashboard
      SQL editor). Confirm the column appears in `profiles` with `\d profiles` or via the
      Table Editor. No TypeScript changes needed at this step.

- [ ] 2. Add `mobileUiScale` field to the `Profile` TypeScript type
      Add the optional field to `Profile` in `src/types/index.ts`.
      
      **File to modify:** `src/types/index.ts`
      
      **Change:** Inside the `Profile` interface, after `checklistTemplates?` and before
      `contractTemplate?`, add:
      ```ts
      mobileUiScale?: number;
      ```
      
      **Verify:** `npm run build` — TypeScript compiles with no new errors.

- [ ] 3. Update `src/services/profile.ts` — `fromRow` and `toRow`
      Teach the profile service to read and write the new column.
      
      **File to modify:** `src/services/profile.ts`
      
      **`fromRow` change** — inside the returned object literal, after `contractTemplate` (or at
      the end of the object before the cast):
      ```ts
      mobileUiScale: (row.mobile_ui_scale !== null && row.mobile_ui_scale !== undefined)
        ? normalizeMobileUiScale(Number(row.mobile_ui_scale))
        : undefined,
      ```
      Also add the import at the top of the file:
      ```ts
      import { normalizeMobileUiScale } from '../utils/mobileUiScale';
      ```
      
      **`toRow` change** — inside the returned object spread:
      ```ts
      ...(p.mobileUiScale !== undefined
        ? { mobile_ui_scale: p.mobileUiScale === 1.0 ? null : p.mobileUiScale }
        : {}),
      ```
      (Writing `null` for the default avoids storing noise for users who never changed it.)
      
      **Verify:** `npm run build` and `npm test -- --reporter=verbose src/services/__tests__/profile-template-envelope.test.ts`
      — existing profile tests pass.

- [ ] 4. Rewrite `src/services/mobileUiScale.ts` — switch from `auth.updateUser` to `profiles`
      Replace the Auth-metadata approach with reads/writes to the `profiles` table.
      
      **File to modify:** `src/services/mobileUiScale.ts`
      
      **New implementation:**
      ```ts
      import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
      import {
          applyMobileUiScale,
          MOBILE_UI_SCALE_DEFAULT,
          normalizeMobileUiScale,
          readMobileUiScale,
          saveMobileUiScale,
      } from '../utils/mobileUiScale';

      export const MOBILE_UI_SCALE_SYNC_EVENT = 'venapindah-mobile-ui-scale-sync';

      /** Load the scale stored in the `profiles` table for the current user. */
      export async function loadRemoteMobileUiScale(): Promise<number | null | undefined> {
          if (!isSupabaseConfigured) return undefined;

          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !sessionData?.session) return undefined;

          const { data, error } = await supabase
              .from('profiles')
              .select('mobile_ui_scale')
              .limit(1)
              .maybeSingle();
          if (error) throw error;
          if (!data) return undefined; // profile not yet created

          const value = data.mobile_ui_scale;
          if (value === null || value === undefined) return null;

          const scale = Number(value);
          if (!Number.isFinite(scale)) return null;
          return normalizeMobileUiScale(scale);
      }

      /** Persist the scale to the `profiles` table for the current user. */
      export async function saveRemoteMobileUiScale(value: number): Promise<number | undefined> {
          const scale = normalizeMobileUiScale(value);
          if (!isSupabaseConfigured) return undefined;

          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!sessionData?.session) return undefined;

          // Use `update` rather than `upsert` — the profile row must already exist
          // (it is created on first login via the existing profile setup flow).
          const { data, error } = await supabase
              .from('profiles')
              .update({ mobile_ui_scale: scale === MOBILE_UI_SCALE_DEFAULT ? null : scale })
              .eq('admin_user_id', sessionData.session.user.id)
              .select('mobile_ui_scale')
              .maybeSingle();
          if (error) throw error;
          if (!data) throw new Error('Profile tidak ditemukan. Buat profil terlebih dahulu.');

          const savedScale = data.mobile_ui_scale;
          return savedScale !== null && savedScale !== undefined
              ? normalizeMobileUiScale(Number(savedScale))
              : MOBILE_UI_SCALE_DEFAULT;
      }

      /** Fetch remote scale, apply it, and sync to localStorage. */
      export async function syncRemoteMobileUiScale(): Promise<number | null> {
          const remoteScale = await loadRemoteMobileUiScale();
          if (remoteScale === undefined) return null;

          if (remoteScale === null) {
              // No remote preference yet — push the local one up if it differs from default.
              const localScale = readMobileUiScale();
              if (localScale !== MOBILE_UI_SCALE_DEFAULT) {
                  try {
                      await saveRemoteMobileUiScale(localScale);
                      return localScale;
                  } catch {
                      // Ignore sync-up error silently.
                  }
              }
              return null;
          }

          const appliedScale = saveMobileUiScale(applyMobileUiScale(remoteScale));
          window.dispatchEvent(new CustomEvent(MOBILE_UI_SCALE_SYNC_EVENT, { detail: appliedScale }));
          return appliedScale;
      }
      ```
      
      **Why `update` not `upsert`:** The profile row is always created at account setup; the
      `profiles` table doesn't expose an `id` from the session object easily. Using `update …
      eq('admin_user_id', uid)` is consistent with how other profile writes work. If for any
      reason the profile row doesn't exist yet, we throw a clear message.
      
      **Verify:** `npm run build` — no TypeScript errors.

- [ ] 5. Remove the stale JWT cache approach from `src/init.ts`
      `readCachedSupabaseScale()` decodes the JWT to find `user_metadata.mobile_ui_scale`.
      This is now unused and actively misleading because the source of truth is `profiles`.
      Remove this function and simplify init to read only from `localStorage` on startup.
      
      **File to modify:** `src/init.ts`
      
      **Changes:**
      
      a) Remove the entire `readCachedSupabaseScale` function (lines from
         `function readCachedSupabaseScale` to its closing `}`).
      
      b) Replace the block:
      ```ts
      const cachedSupabaseScale = readCachedSupabaseScale();
      if (cachedSupabaseScale !== null) {
        saveMobileUiScale(cachedSupabaseScale);
      } else {
        applyMobileUiScale(readMobileUiScale());
      }
      ```
      with simply:
      ```ts
      // Apply the locally-cached scale immediately (from a previous session's localStorage write).
      // The async syncRemoteMobileUiScale() below will update this if the remote value differs.
      applyMobileUiScale(readMobileUiScale());
      ```
      
      c) Remove the unused `normalizeMobileUiScale` and `saveMobileUiScale` imports from the
      `'./utils/mobileUiScale'` import line. Keep `applyMobileUiScale` and `readMobileUiScale`.
      Also remove `MOBILE_UI_SCALE_DEFAULT` if only used in the removed function.
      
      d) Keep the `syncRemoteMobileUiScale` call and the `onAuthStateChange` listener unchanged —
      they already correctly fire `syncRemoteMobileUiScale()` after login/session restore, which
      now reads from the `profiles` table and calls `saveMobileUiScale` (writing localStorage).
      
      **Verify:** `npm run build` — no TypeScript errors.
      
      **Behaviour after this change:**
      - First load (any device): applies `localStorage` value (or 1.0 default) synchronously,
        then 200–500 ms later `syncRemoteMobileUiScale` fires and corrects to the saved profile
        value, writing it to `localStorage` for the next load.
      - Second+ load (same device): `localStorage` already has the correct value from the
        previous sync → correct scale applied instantly, zero flicker.
      - Other device (first load): default 1.0 → sync corrects it within 500 ms. This is the
        same UX as `ui_text_overrides` and is unavoidable without a synchronous network call.

- [ ] 6. Verify `UiTextCustomizationPanel` requires no changes
      The panel already calls `loadRemoteMobileUiScale` on mount and `saveRemoteMobileUiScale`
      on save — the public API of both functions is unchanged. The only internal change is where
      the data is stored (profiles table vs auth metadata). No code edits needed.
      
      **File to inspect (READ ONLY):** `src/pages/settings/components/UiTextCustomizationPanel.tsx`
      
      **Verify:** `npm run build` — no errors.

- [ ] 7. Add unit tests for the new `mobileUiScale` service
      The existing tests for `profile-template-envelope` serve as the pattern to follow.
      Create a new test file that mocks `supabase.from` and `supabase.auth.getSession`.
      
      **File to create:**
      `src/services/__tests__/mobileUiScale.test.ts`
      
      **Test cases to cover:**
      - `loadRemoteMobileUiScale()` returns `undefined` when no Supabase session.
      - `loadRemoteMobileUiScale()` returns `null` when profile row exists but `mobile_ui_scale`
        is `NULL`.
      - `loadRemoteMobileUiScale()` returns a normalized number when column has a value.
      - `saveRemoteMobileUiScale(0.8)` calls `supabase.from('profiles').update({ mobile_ui_scale: 0.8 })`.
      - `saveRemoteMobileUiScale(1.0)` writes `null` (default scale stored as NULL).
      - `syncRemoteMobileUiScale()` calls `saveMobileUiScale` + dispatches the sync event when
        remote value is present.
      
      **Pattern to follow:** `src/services/__tests__/profile-template-envelope.test.ts` —
      use `vi.mock('../../lib/supabaseClient', ...)` with a chainable mock that returns
      the right shape for `.from().select().limit().maybeSingle()` and
      `.from().update().eq().select().maybeSingle()`.
      
      **Note:** mock `isSupabaseConfigured` by also exporting it from the mock:
      ```ts
      vi.mock('../../lib/supabaseClient', () => ({
        isSupabaseConfigured: true,
        supabase: { from: fromMock, auth: { getSession: getSessionMock } },
        default: { from: fromMock, auth: { getSession: getSessionMock } },
      }));
      ```
      
      **Verify:** `npm test -- --reporter=verbose src/services/__tests__/mobileUiScale.test.ts`
      — all new tests pass, and `npm test` — all existing tests pass.

- [ ] 8. Final integration build check
      Run the full build and test suite to confirm nothing is broken.
      
      **Verify:**
      ```
      npm run build
      npm test
      ```
      Both must exit 0.

---

## Risks & Gotchas

| Risk | Mitigation |
|------|------------|
| Profile row may not exist yet when `saveRemoteMobileUiScale` is called (new user who hasn't filled in settings). | The `update … eq('admin_user_id', uid)` will update 0 rows and `.maybeSingle()` returns `data: null`. The service throws a clear user-facing error. The `UiTextCustomizationPanel` already shows `mobileScaleError` in the UI. No data loss. |
| Some profile rows use `id` as PK but are looked up by `admin_user_id`. | The existing `getProfile()` and all profile mutations use `admin_user_id` for filtering via RLS. The `update … eq('admin_user_id', uid)` pattern matches how RLS works (`admin_user_id = auth.uid()`). If the RLS policy is `USING (admin_user_id = auth.uid())`, Supabase will automatically filter to the right row. Alternatively, use `getProfile()` to get the `id` then `eq('id', profile.id)`. See Note 1 below. |
| Removing `readCachedSupabaseScale` breaks fast-path on devices that have a freshly-issued JWT containing the old `user_metadata` value. | The old JWT path was unreliable anyway (value only present if `updateUser` refresh propagated to the cached token, which doesn't happen deterministically). The `localStorage` fallback is equivalent in practice and already the path taken for 100% of non-first-loads. |
| `mobile_ui_scale` written as `null` for 1.0 (default). `fromRow` must handle null correctly. | Step 3 explicitly maps `null → undefined` in `fromRow`, and `undefined` means "use default" throughout the app. |
| `npm test` runs all tests including those that mock `supabaseClient`. The new service mock shape must export both `default` and named `supabase` + `isSupabaseConfigured`. | Step 7 shows the correct mock shape. |

**Note 1 — alternative save strategy if RLS blocks `admin_user_id` filter:**
If the profiles RLS policy only allows reads/writes to the user's own row without a WHERE clause
(i.e. relies on implicit filtering), replace the `update … eq('admin_user_id', uid)` with:
```ts
// Get the profile id first, then update by PK
const { data: profileData } = await supabase
    .from('profiles').select('id').limit(1).maybeSingle();
if (!profileData?.id) throw new Error('Profile tidak ditemukan.');
const { data, error } = await supabase
    .from('profiles')
    .update({ mobile_ui_scale: … })
    .eq('id', profileData.id)
    .select('mobile_ui_scale')
    .maybeSingle();
```
This adds one extra round-trip but is safe under any RLS policy shape. The coder should
choose based on what they observe when testing against the live database.

---

## File Summary

| File | Action |
|------|--------|
| `supabase/migrations/20261016000000_profiles_mobile_ui_scale.sql` | **CREATE** — adds `mobile_ui_scale` column |
| `src/types/index.ts` | **MODIFY** — add `mobileUiScale?: number` to `Profile` |
| `src/services/profile.ts` | **MODIFY** — `fromRow` reads column, `toRow` writes column |
| `src/services/mobileUiScale.ts` | **REWRITE** — read/write `profiles` table instead of `auth.updateUser` |
| `src/init.ts` | **MODIFY** — remove stale JWT cache function, simplify to localStorage-only sync start |
| `src/pages/settings/components/UiTextCustomizationPanel.tsx` | **NO CHANGE** — API unchanged |
| `src/services/__tests__/mobileUiScale.test.ts` | **CREATE** — unit tests for new service |
