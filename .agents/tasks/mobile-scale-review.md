# Mobile UI scale persistence via Supabase profiles table

The change migrates the mobile UI scale preference from Supabase `auth.user_metadata` to a
dedicated `mobile_ui_scale` column on the `profiles` table. The original approach was broken
because the JWT cached in `localStorage` was never updated after `updateUser()` calls, so the
scale reverted to default on every reload. The new approach stores the value in the profiles row
and seeds `localStorage` on each sync so subsequent loads apply the correct scale synchronously
before any auth round-trip completes. This is a second-pass review; all three findings from the
first pass (null→undefined asymmetry, silent no-op on missing profile row, test coverage gaps)
have been addressed.

Watch for: **(confirmed)** `toRow` in `profile.ts` compares `p.mobileUiScale === 1.0` using a
literal instead of the `MOBILE_UI_SCALE_DEFAULT` constant that is already imported in the same
file. `saveRemoteMobileUiScale` uses the constant correctly. If the default ever moves, these two
sites will silently disagree on what sentinel to write to the DB.

**Verdict**: APPROVED

---

## High-level view

`init.ts` applies the `localStorage`-cached scale synchronously at module load, then fires
`syncRemoteMobileUiScale()` after the session is confirmed. On a fresh device the first render is
at the default 100%, corrected within ~200–500 ms once the profiles query returns — the same UX
as `ui_text_overrides`.

`saveRemoteMobileUiScale` stores `null` in the DB for the default scale (1.0) and a numeric value
otherwise. `fromRow` in `profile.ts` maps `null → MOBILE_UI_SCALE_DEFAULT`, which keeps the
round-trip clean. The two sites that encode this null-for-default sentinel are both correct today
but use different spellings: `scale === MOBILE_UI_SCALE_DEFAULT` in the service vs `=== 1.0` in
`toRow`. With `MOBILE_UI_SCALE_DEFAULT` already imported in `profile.ts`, fixing `toRow` is a
one-line change.

The SQL migration adds `mobile_ui_scale NUMERIC CHECK (IS NULL OR 0.4–1.4)` with `IF NOT EXISTS`,
idempotent and non-destructive. The check constraint enforces the same range as
`normalizeMobileUiScale`, so out-of-range values from any DB client are rejected at the DB level.

---

<details>
<summary>Issues (2)</summary>

1. **`toRow` sentinel uses literal instead of constant** — `profile.ts` `toRow` contains
   `p.mobileUiScale === 1.0 ? null : p.mobileUiScale`. The file already imports
   `MOBILE_UI_SCALE_DEFAULT`; use it here so both encoding sites stay in sync if the constant
   changes. Change to: `p.mobileUiScale === MOBILE_UI_SCALE_DEFAULT ? null : p.mobileUiScale`.

2. **Divergence risk between `toRow` and `saveRemoteMobileUiScale`** — Two independent code
   paths decide what value to write to `profiles.mobile_ui_scale` (one via `upsertProfile`,
   one via the `mobileUiScale` service). If a caller ever uses `upsertProfile` with
   `mobileUiScale: 1.0`, it will write `null` (correct). If the literal `1.0` in `toRow` drifts
   from the constant in the service, a partial save could store a non-null default. The fix for
   issue 1 eliminates this risk entirely.

</details>

<details>
<summary>Details</summary>

### Default-value sentinel: floating-point comparison

`saveRemoteMobileUiScale` writes `null` when `scale === MOBILE_UI_SCALE_DEFAULT` (using the
imported constant). `toRow` in `profile.ts` mirrors this logic but uses the literal `1.0`:

```ts
// profile.ts toRow — current
...(p.mobileUiScale !== undefined
  ? { mobile_ui_scale: p.mobileUiScale === 1.0 ? null : p.mobileUiScale }
  : {}),
```

`normalizeMobileUiScale` rounds to two decimal places, so `normalizeMobileUiScale(1.0)` is always
exactly `1` and the comparison is safe today. The problem is a future-maintenance one: the file
already imports `MOBILE_UI_SCALE_DEFAULT` for use in `fromRow`, so there is no cost to using it
in `toRow` as well. The one-line fix:

```ts
{ mobile_ui_scale: p.mobileUiScale === MOBILE_UI_SCALE_DEFAULT ? null : p.mobileUiScale }
```

</details>

---

<details>
<summary>File map</summary>

- `src/init.ts` — removed stale JWT-decode path; applies localStorage scale synchronously, defers remote sync until session confirmed
- `src/services/mobileUiScale.ts` — rewritten to read/write `profiles.mobile_ui_scale`; added PGRST116 guard, AuthSessionMissingError catch, missing-row console.warn
- `src/services/profile.ts` — `fromRow` maps `null → MOBILE_UI_SCALE_DEFAULT`; `toRow` serializes `1.0 → null`
- `src/types/index.ts` — `mobileUiScale?: number` added to `Profile` (no `| null`)
- `supabase/migrations/20261015200000_add_mobile_ui_scale_to_profiles.sql` — adds nullable NUMERIC column with check constraint 0.4–1.4
- `src/services/__tests__/mobileUiScale.test.ts` — new unit tests for all service paths
- `src/services/__tests__/profile-mobile-ui-scale.test.ts` — new round-trip tests for toRow/fromRow
- `src/__tests__/init.test.ts` — new startup-sequence tests

Full diff: `git diff main`

</details>
