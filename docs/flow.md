# Stackd — Flow Catalogue

Every user-visible and system-internal flow in the project, grouped by module. Each flow lists the happy path, every failure path we expect, and the edge cases that race or contend with it.

The product has **two user-facing modules**: **Auth** and **Profiles**. Everything else (uploads, tags, universities, feed, views) is a sub-concern of Profiles.

Conventions:
- 🟢 success · 🔴 failure · 🟡 partial / recoverable
- `[FE]` Next.js client · `[API]` NestJS · `[DB]` Postgres · `[ST]` Supabase Storage · `[AUTH]` Supabase Auth
- Error codes are the `ErrorCode` enum from [backend-api.md](backend-api.md#2-response-envelope--errors).

---

## Table of contents

- [1. Auth](#1-auth)
  - [1.1 Request magic link](#11--request-magic-link-new-or-returning-email)
  - [1.2 Magic-link failure modes](#12--magic-link-failure-modes)
  - [1.3 Verification + session bootstrap](#13--magic-link-verification--session-bootstrap)
  - [1.4 Verification failure modes](#14--verification-failure-modes)
  - [1.5 Sign out](#15--sign-out)
  - [1.6 Cold-load session restore](#16--session-restore-on-cold-page-load)
  - [1.7 Background: throttle cleanup](#17-background-cleanup-magic-link-throttle)
- [2. Profiles](#2-profiles)
  - [2.1 Create (join)](#21-create-join)
  - [2.2 Read (public + own + CV download)](#22-read-public--own)
  - [2.3 Edit](#23-edit)
  - [2.4 Delete + restore](#24-delete--restore)
  - [2.5 Browse / search (feed)](#25-browse--search-feed)
  - [2.6 Sub-concern: Uploads (photo + CV)](#26-sub-concern-uploads-photo--cv)
  - [2.7 Sub-concern: Tags](#27-sub-concern-tags)
  - [2.8 Sub-concern: Universities](#28-sub-concern-universities)
  - [2.9 Background jobs](#29-background-jobs)
- [3. Cross-cutting concerns](#3-cross-cutting-concerns)

---

# 1. Auth

The Auth module owns the magic-link sign-in handshake and the JWT session that every other API call relies on. It does **not** own the profile; that lives in Profiles.

## 1.1 🟢 Request magic link (new or returning email)

1. [FE] User types `email`, submits [login-form.tsx](../components/auth/login-form.tsx).
2. [FE] Client-side validate against `EMAIL_REGEX`.
3. [FE] `POST /v1/auth/magic-link { email, redirectTo? }`.
4. [API] Throttle check: `magic_link_throttle` count in last 60 s per email (≤ 3) and per IP (≤ 10).
5. [API] `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: APP_URL + '/login/callback' }})`.
6. [API] Insert one row into `magic_link_throttle (email, sent_at, ip)`.
7. [API] Return `{ ok: true, data: { sent: true } }`.
8. [FE] Render "Check your email" state.

## 1.2 🔴 Magic-link failure modes

| Scenario | Detection | Handling |
|---|---|---|
| Invalid email format | FE regex + Zod on API | `400 VALIDATION_FAILED { field: 'email' }` |
| Per-email rate limit hit (≥ 3 in 60 s) | `magic_link_throttle` query | `429 RATE_LIMITED`; FE shows "Too many attempts. Try again in a minute." |
| Per-IP rate limit hit (≥ 10 in 60 s) | same | Same error; possible attacker rotating addresses |
| Supabase Auth 5xx | catch in API | `502 INTERNAL`; FE shows generic retry message; throttle row **not** written |
| Email provider bounce | async — not surfaced to user | User clicks "Resend" after ~30 s |
| User clicks "Resend" before throttle window resets | client guard + API throttle | FE shows "Wait a moment" with countdown; if API hit, returns `RATE_LIMITED` |
| User clicks "Use different email" | local state reset | Re-enters `idle`; throttle counter is per-email, so unaffected |

## 1.3 🟢 Magic-link verification + session bootstrap

1. [User] Clicks link in email → browser opens `/login/callback#access_token=…&refresh_token=…`.
2. [FE] Supabase JS picks up the URL hash, calls `setSession()`, stores tokens.
3. [FE] AuthProvider mounts → `GET /v1/auth/me` with `Authorization: Bearer <jwt>`.
4. [API] Guard verifies JWT via `supabase.auth.getUser(jwt)`; attaches `req.user = { id, email }`.
5. [API] Looks up profile by `user_id` where `deleted_at IS NULL`.
6. [API] Returns `{ user: { id, email }, profile: OwnProfile | null }`.
7. [FE] `signIn(email, profile?.slug ?? null)`; routes to `/profile/:slug` (existing) or `/join` (new).

## 1.4 🔴 Verification failure modes

| Scenario | Detection | Handling |
|---|---|---|
| Link expired (>15 min) | Supabase returns 401 on `getUser` | FE shows "Link expired — request a new one"; back to 1.1 |
| Link reused (already consumed) | same | Same — Supabase invalidates after first use |
| Tampered token | JWT verify fails | `401 UNAUTHENTICATED`; FE clears session and routes to `/login` |
| Network failure on `/auth/me` | FE catch | Retry once with backoff; if still fails, allow anon browse, defer profile load |
| User has a soft-deleted profile | `profile` query filters `deleted_at IS NULL` | Returns `profile: null` → routes to `/join` (will hit `PROFILE_EXISTS` on submit if still in restore window, see [2.4.5](#245--edge-user-signs-in-during-the-7-day-restore-window)) |
| User had profile, now hard-deleted | same | Returns `profile: null` → fresh `/join` flow works |

## 1.5 🟢 Sign out

1. [FE] User clicks Sign out → `supabase.auth.signOut()`.
2. [FE] AuthProvider's `useEffect` clears `stackd:user` in localStorage.
3. [FE] Router pushes `/`.

> No server call. There is intentionally no `POST /v1/auth/sign-out` endpoint — Supabase already invalidates the refresh token; adding a server hop creates a second source of truth.

## 1.6 🟡 Session restore on cold page load

1. [FE] AuthProvider mounts; Supabase JS reads tokens from localStorage.
2. [FE] If refresh token valid → silent refresh → `GET /v1/auth/me`.
3. [FE] If refresh token expired → treat as signed out.
4. [FE] If `/auth/me` returns 401 (e.g. user was banned, JWT secret rotated) → `supabase.auth.signOut()` and route to `/login`.

## 1.7 Background: `cleanup-magic-link-throttle`

- Cron: `*/15 * * * *`.
- Query: `DELETE FROM magic_link_throttle WHERE sent_at < now() - interval '1 day'`.
- Failure: log + retry next tick.

---

# 2. Profiles

The Profiles module owns the profile lifecycle (create, read, edit, delete, restore), the feed/search surface, and all profile-bound assets (photos, CVs, tags, universities, views).

## 2.1 Create (join)

### 2.1.1 🟢 Brand-new user — full happy path

Pre-condition: user is signed in, has no live profile (`GET /v1/auth/me` returned `profile: null`).

1. [FE] User lands on `/join` ([join-form.tsx](../components/join/join-form.tsx)).
2. [FE] Optional: upload photo
   - `POST /v1/uploads/photo { contentType, sizeBytes }` → `{ uploadUrl, key }`.
   - Direct `PUT` to `uploadUrl`.
   - Keep `key` in form state as `photoKey`.
3. [FE] Optional: upload CV (same pattern; key stored as `cvKey`).
4. [FE] Fill form, validate locally, submit.
5. [FE] `POST /v1/profiles + Idempotency-Key: <uuid>` with full DTO.
6. [API] Guard verifies JWT.
7. [API] `IdempotencyInterceptor` checks Redis for `(userId, idemKey)` — miss → proceed.
8. [API] Zod validates DTO.
9. [API] `storage.assertExists('profile-photos', photoKey, userId)` — HEAD object, confirm prefix matches `userId`.
10. [API] `storage.assertExists('profile-cvs', cvKey, userId)` if provided.
11. [API] `universities.matchOrCreate(university)` → `universityId` (see [2.8](#28-sub-concern-universities)).
12. [API] `tags.upsertMany(labels)` → one `INSERT … ON CONFLICT DO NOTHING` → returns slug list (see [2.7](#27-sub-concern-tags)).
13. [API] Transaction:
    - `INSERT INTO profiles` (relies on partial unique index for slug + user_id).
    - `INSERT INTO profile_tags` (with `position`).
    - `INSERT INTO audit_logs (action='profile.create')`.
14. [API] Cache response under `(userId, idemKey)` for 24 h in Redis.
15. [API] Return `{ profile: OwnProfile }`.
16. [FE] Show celebration, route to `/profile/:slug`.

### 2.1.2 🔴 Creation failure modes

| Scenario | Detection | Handling |
|---|---|---|
| User already has a live profile | Partial unique on `profiles_user_id_live_idx` → P2002 | `409 PROFILE_EXISTS`; FE routes to `/profile/:existingSlug` (existing profile fetched first) |
| Two users submit at the same instant with same slug | Partial unique on `profiles_slug_live_idx` → P2002 | `409 SLUG_TAKEN`; API retries once with auto-suffix `-2`; if still taken, surface error to FE |
| Slug fails format CHECK | DB rejects | `400 VALIDATION_FAILED { field: 'slug' }` |
| `photoKey` not actually uploaded | `assertExists` HEAD returns 404 | `400 UPLOAD_NOT_FOUND { field: 'photoKey' }`; FE prompts re-upload |
| `cvKey` not actually uploaded | same | Same with `field: 'cvKey'` |
| `photoKey` outside user's prefix (`<otherUser>/...`) | `assertExists` prefix check | `403 FORBIDDEN`; possible attack — also writes audit log entry `cv.upload` denied |
| Bio > 100 chars / missing required field | Zod | `400 VALIDATION_FAILED { field: 'bio' }` |
| Contact format wrong when contactType=email | Zod | `400 VALIDATION_FAILED { field: 'contact' }` |
| Tag count > 6 | Zod | `400 VALIDATION_FAILED { field: 'tags' }` |
| `open_to` empty but `availability` provided | Zod | Normalize to `availability: null`; not an error |
| `internshipLength` set without `'internships'` in `open_to` | API normalize | Silently drop |
| Postgres outage mid-transaction | catch | `500 INTERNAL`; idempotency key NOT cached so retry can succeed; orphan storage objects remain (see [3.3](#33-orphan-storage-objects)) |
| Network drops between FE submit and API ack | FE shows "saving…" + retries with same `Idempotency-Key` | On retry, server returns cached response → no duplicate row |
| FE retries with **different body** but same `Idempotency-Key` | `IdempotencyInterceptor` body-hash mismatch | `409 IDEMPOTENT_REPLAY`; FE generates new key and retries |
| User navigates away mid-form | nothing persisted | Orphaned storage objects garbage-collected by [`cleanup-orphan-storage`](#29-background-jobs) |

### 2.1.3 🟡 Edge: user opens `/join` while having a soft-deleted profile inside restore window

1. [FE] `GET /v1/auth/me` returns `profile: null` (live filter excludes soft-deleted).
2. [FE] User starts filling form.
3. [API] On `POST /v1/profiles` — partial unique allows insert (deleted profile doesn't block).
4. [Result] User has a brand-new profile + a soft-deleted one with a restore link still valid.
5. [API] Restore link, if clicked later, **fails with `409 PROFILE_EXISTS`** because user now has a live profile. Audit log records the rejected restore attempt.

### 2.1.4 🟡 Edge: idempotency replay across days

- Redis key TTL is 24 h. After expiry, a retry with the same `Idempotency-Key` will be treated as a new submission — and will hit the unique constraint on `user_id` → `PROFILE_EXISTS`. Safe.

---

## 2.2 Read (public + own)

### 2.2.1 🟢 Public visitor opens `/profile/:slug`

1. [FE] [`app/(main)/profile/[slug]/page.tsx`] React Query: `GET /v1/profiles/:slug`.
2. [API] Lookup `profiles WHERE slug = ? AND is_public AND deleted_at IS NULL`.
3. [API] Hydrate tags via `profile_tags JOIN tags`; resolve `photo_key` → public URL; resolve `photo_color_idx` → hex.
4. [API] Fire-and-forget: `INSERT INTO profile_views (profile_id, viewer_hash, viewed_on) ON CONFLICT DO NOTHING` where `viewer_hash = sha256(ip + ua + rotating_salt)`.
5. [API] Return `ProfileCard` (no `email`, no `cv_key`).
6. [FE] Render `profile-detail.tsx`; if `card.hasCv`, show Download CV button.

### 2.2.2 🔴 Public read failure modes

| Scenario | Detection | Handling |
|---|---|---|
| Slug not found | query returns 0 rows | `404 NOT_FOUND`; FE renders [`profile-not-found.tsx`](../components/profile/profile-not-found.tsx) |
| Profile soft-deleted | `deleted_at IS NULL` filter | Same 404 — soft-deleted is indistinguishable from non-existent to the public |
| Profile private (`is_public=false`) | `is_public` filter | Same 404 — never confirm existence |
| Slug case-folding | `citext` column | "Maya-Chen" matches "maya-chen"; canonical lowercase enforced on insert |
| Stale CDN of `photo_key` | new upload uses timestamp-suffixed key | Old object purged async; no stale URL because new URL points to new object |

### 2.2.3 🟢 Owner opens own profile

Identical to 2.2.1 except `GET /v1/profiles/me` returns `OwnProfile` (includes `email`, `isPublic`, `cvName`). Used by the edit screen header.

### 2.2.4 🟢 Public visitor downloads CV

1. [FE] User clicks Download → `GET /v1/profiles/:slug/cv`.
2. [API] Lookup profile (same filters as 2.2.1).
3. [API] If `cv_key IS NULL` → `404 NOT_FOUND`.
4. [API] `storage.createSignedUrl('profile-cvs', cv_key, expiresIn: 300)`.
5. [API] Return `{ url, expiresIn: 300 }`.
6. [FE] `window.location = url` triggers browser download.

### 2.2.5 🔴 CV download failure modes

| Scenario | Detection | Handling |
|---|---|---|
| Profile has no CV | `cv_key IS NULL` | `404 NOT_FOUND`; FE hides the button (button never renders when `hasCv = false`) |
| User waits >5 min before clicking signed URL | Supabase URL expired | Browser sees 401; FE catches and re-mints |
| CV object missing in bucket (e.g. accidental deletion) | signed URL returns 404 on click | FE shows "CV unavailable"; API audit-logs `cv.delete` mismatch |
| Profile gone private/deleted between page load and click | API check before minting | `404 NOT_FOUND` |

### 2.2.6 🟡 Edge: `profile_views` recording

- Same viewer + same profile + same day → `ON CONFLICT DO NOTHING`, no row growth.
- Different day → new row.
- Anonymous viewer (no IP, server-side render with no headers) → still hashed with empty string + salt; collision rate acceptable.
- Bot traffic with rotating UAs → over-counts; mitigated by `viewer_hash` including IP, not UA only.

---

## 2.3 Edit

### 2.3.1 🟢 Owner saves changes

Pre: signed-in user has a live profile.

1. [FE] [`edit-profile-form.tsx`] mounts → React Query reads from `GET /v1/profiles/me`.
2. [FE] User edits fields; if photo or CV replaced, upload flow runs (see [2.6](#26-sub-concern-uploads-photo--cv)) yielding new `photoKey`/`cvKey`.
3. [FE] `PATCH /v1/profiles/me { …only changed fields… }`.
4. [API] Guard + `ProfileOwnerGuard` resolves `profile` by `user_id`.
5. [API] `assertExists` for any new storage keys.
6. [API] Inside transaction:
   - `UPDATE profiles SET …` for scalar fields.
   - If `tags` in patch → diff against existing rows; `DELETE` removed, `INSERT` added, re-number `position`.
   - `INSERT audit_logs(action='profile.update', diff=…)`.
   - If `slug` changed: also `INSERT audit_logs(action='profile.slug_change', diff={from,to})`.
7. [API] If `photoKey` replaced: enqueue BullMQ job `delete-storage-object` for old key.
8. [API] If `cvKey` replaced: same for old CV.
9. [API] Return fresh `OwnProfile`.
10. [FE] Update React Query cache, show "Changes saved" toast.

### 2.3.2 🔴 Edit failure modes

| Scenario | Detection | Handling |
|---|---|---|
| User doesn't own a live profile | `ProfileOwnerGuard` | `404 NOT_FOUND` (intentionally vague) |
| Slug changed to one already taken | `profiles_slug_live_idx` violation | `409 SLUG_TAKEN`; FE shows inline error |
| New `photoKey` not uploaded | `assertExists` | `400 UPLOAD_NOT_FOUND` |
| New `photoKey` outside user prefix | prefix check | `403 FORBIDDEN`; audit-logged |
| Bio over limit / required field cleared | Zod | `400 VALIDATION_FAILED` |
| Two devices edit at the same time | last write wins | Both succeed; second overwrites first. No optimistic concurrency (could add `If-Match: updated_at` later) |
| Network drop mid-PATCH | FE | Retry; PATCH is idempotent on its own body (same diff applied twice yields same state) |
| Removing all tags | Zod min(1) on tags | `400 VALIDATION_FAILED { field: 'tags' }` |
| Reordering tags only (same set) | diff yields empty add/remove | `position` re-number runs; trigger doesn't fire (no INSERT/DELETE on `profile_tags`); fast path |
| Changing `open_to` to remove `internships` | normalize sets `internship_length = null` | Single UPDATE, no orphan |
| Setting `is_public = false` | UPDATE | Profile disappears from feed immediately (partial index excludes it) |
| Photo upload succeeded but `PATCH` failed (e.g. validation) | nothing committed | Uploaded object becomes orphan → cleaned by [`cleanup-orphan-storage`](#29-background-jobs) |

### 2.3.3 🟡 Edge: CV replaced with no CV

- Patch with `cvKey: null` → `cv_paired` CHECK requires `cv_name` and `cv_uploaded_at` also null → API normalizes them.
- Old `cv_key` enqueued for deletion.

---

## 2.4 Delete + restore

### 2.4.1 🟢 Soft delete

1. [FE] `delete-modal.tsx` confirm → `POST /v1/profiles/me/delete`.
2. [API] Generate `restoreToken` (32 bytes random) and `tokenHash = sha256(restoreToken)`.
3. [API] Transaction:
   - `UPDATE profiles SET deleted_at=now(), is_public=false, restore_token_hash=$1, restore_expires_at=now()+'7 days'`.
   - `INSERT audit_logs(action='profile.soft_delete')`.
4. [API] Enqueue BullMQ delayed job `hard-delete-profile` with `delay=7d`.
5. [API] Send restore email with raw `restoreToken` in link.
6. [API] Return `{ ok: true, data: { restoreEmailed: true } }`.
7. [FE] Calls `supabase.auth.signOut()`, routes to `/`.

### 2.4.2 🟢 Restore within 7 days

1. [User] Clicks restore link → opens `/restore?token=…` on the FE.
2. [FE] `POST /v1/profiles/me/restore { token }` (no Authorization needed).
3. [API] `SELECT id FROM profiles WHERE restore_token_hash = sha256($1) AND restore_expires_at > now()` — limit 1.
4. [API] If found:
   - `UPDATE profiles SET deleted_at=null, is_public=true, restore_token_hash=null, restore_expires_at=null`.
   - Cancel the BullMQ `hard-delete-profile` job by id.
   - `INSERT audit_logs(action='profile.restore')`.
5. [API] Return `{ slug }`.
6. [FE] Router → `/login?prefill=<email>` (user must sign in again with magic link).

### 2.4.3 🟢 Hard delete (cron)

After 7 days, no restore happened:

1. [Job] BullMQ fires `hard-delete-profile(profileId)`.
2. [API] Transaction:
   - `INSERT audit_logs(action='profile.hard_delete')`.
   - `DELETE FROM profiles WHERE id=$1 AND deleted_at IS NOT NULL`.
   - Cascading deletes via FK: `profile_tags`, `profile_views`.
   - Tag usage triggers decrement `tags.usage_count` per removed `profile_tags` row.
3. [Job] List and delete every storage object under `${user_id}/` in both buckets.

### 2.4.4 🔴 Delete + restore failure modes

| Scenario | Detection | Handling |
|---|---|---|
| Token expired | `restore_expires_at > now()` filter | `404 NOT_FOUND`; FE shows "Restore link expired — your profile has been permanently removed" (truthful enough; if it's only "almost expired", the same UX is acceptable) |
| Token reused | second call finds matching `tokenHash` but row is no longer deleted (deleted_at IS NULL); we treat that as expired | `404 NOT_FOUND` |
| Token tampered / random | sha256 won't match | `404 NOT_FOUND` (no info leak) |
| Two restore attempts in flight | second update affects 0 rows | first wins; second gets `404` |
| User has created a new profile in the window | `restore_token_hash` still on the old (soft-deleted) row; new profile is live | API checks: if `auth.users.id` already has a live profile, refuse restore with `409 PROFILE_EXISTS` and tell user to delete the new one first |
| Hard delete job runs while restore is happening | BullMQ cancellation may lose race | Hard-delete job re-checks `deleted_at IS NOT NULL` inside its transaction; aborts if restored |
| Hard delete: storage object missing | listing returns nothing | Job logs and continues (idempotent) |
| Hard delete: cascading FK fails | DB exception | Job retries with exponential backoff up to 5 attempts; alerts on final failure |

### 2.4.5 🟡 Edge: user signs in during the 7-day restore window

- `GET /v1/auth/me` returns `profile: null` (live filter excludes soft-deleted).
- Frontend routes to `/join`. See [2.1.3](#213--edge-user-opens-join-while-having-a-soft-deleted-profile-inside-restore-window) for what happens if they create a new one.

---

## 2.5 Browse / search (feed)

### 2.5.1 🟢 Default feed load

1. [FE] [`feed.tsx`] mounts → React Query: `GET /v1/profiles?limit=24`.
2. [FE] React Query: `GET /v1/tags/popular?limit=6`.
3. [API] Profile list query uses `profiles_feed_idx` (partial, `is_public AND deleted_at IS NULL`).
4. [API] Returns 25 rows; trims to 24 + builds cursor from 24th row.
5. [API] `total` count via separate query (cheap; uses same partial index).
6. [FE] Renders cards; chip rail shows popular tags.

### 2.5.2 🟢 Search with `q`

1. [FE] User types in toolbar; 300 ms debounce → `GET /v1/profiles?q=react`.
2. [API] Switches to raw SQL with `websearch_to_tsquery('simple', $q)` + `ts_rank` + `ORDER BY rank DESC, id DESC`.
3. [API] Skips `total` count (tsvector COUNT is expensive); response `meta.total` is undefined.
4. [FE] Renders count as "Showing N profiles" not "N of M".

### 2.5.3 🟢 Filter combinations

`?q=react&tag=ml&open_to=internships,research&year=3rd,4th&university=Stanford%20University&available=summer-2026`

- `q` → tsvector match.
- `tag` → join `profile_tags` filter.
- `open_to` → `open_to && ARRAY[...]::open_to_enum[]`.
- `year` → `year IN (...)`.
- `university` → resolve to `university_id`, exact match on FK.
- `available` translated to date range:
  - `now` → `available_from IS NULL OR available_from <= today`.
  - `summer-2026` → `available_from <= '2026-08-31' AND (available_to IS NULL OR available_to >= '2026-06-01')`.

Planner uses `profiles_university_feed_idx` or `profiles_year_feed_idx` when those are the dominant filters; combined with `search_vector` GIN for `q`.

### 2.5.4 🔴 Feed failure modes

| Scenario | Detection | Handling |
|---|---|---|
| Empty result set | `items.length === 0` | FE renders `feed-empty.tsx` (different empty state if filters active vs not — see [feed.tsx:69](../components/home/feed.tsx#L69)) |
| Invalid `cursor` | base64 decode fails OR JSON malformed OR sort field doesn't match | `400 VALIDATION_FAILED { field: 'cursor' }`; FE clears cursor and refetches from page 1 |
| Cursor encoded for a different `sort` (e.g. user toggled relevance↔newest) | API checks sort field matches | Same 400 |
| `tag` doesn't exist in dictionary | LEFT join + filter | Empty result, not error |
| `university` string doesn't resolve to any `universities.id` | match returns null | API uses literal text match on `profiles.university` as fallback |
| `available` value unknown | Zod enum | `400 VALIDATION_FAILED` |
| Search injection attempt (`q = 'react;DROP TABLE'`) | `websearch_to_tsquery` parses safely | Returns 0 or normal results; no SQL injection possible (parameterized) |
| Very long `q` (> 200 chars) | API caps at 200 | Truncates with debug log |
| Postgres timeout on cold cache | statement_timeout | `500 INTERNAL`; FE shows `feed-error.tsx` with retry button |

### 2.5.5 🟡 Edge: pagination consistency

- Cursor is based on `(created_at, id)` for `sort=newest`. If a new profile is created between page 1 and page 2, it appears at the top (not in page 2). Acceptable for a directory.
- For `sort=relevance`, ranks can shift if data changes; we accept duplicates across pages as a rare edge case.

### 2.5.6 🟡 Edge: hot tags

- Popular tags returned from `SELECT slug, label FROM tags ORDER BY usage_count DESC LIMIT 6`.
- Usage counts may briefly drift if the trigger fires after a transaction rollback (it doesn't — `AFTER` triggers run inside the transaction). Truth-keeping is the [`recompute-tag-usage`](#29-background-jobs) weekly cron.

---

## 2.6 Sub-concern: Uploads (photo + CV)

Uploads exist only to feed asset keys into profile create/edit. They are never standalone resources.

### 2.6.1 🟢 Photo upload

1. [FE] [`photo-upload.tsx`] user picks file.
2. [FE] Client-side validate: type ∈ {png, jpeg, webp}, size ≤ 2 MB.
3. [FE] `POST /v1/uploads/photo { contentType, sizeBytes }`.
4. [API] Server-side validate same constraints.
5. [API] `key = '<userId>/avatar-<epoch>.<ext>'`.
6. [API] `supabase.storage.from('profile-photos').createSignedUploadUrl(key)` → `signedUrl`.
7. [API] Return `{ uploadUrl: signedUrl, key, expiresIn: 300 }`.
8. [FE] `PUT uploadUrl` with the file blob.
9. [FE] Store `key` in form state.

### 2.6.2 🟢 CV upload

Same as 2.6.1 but bucket=`profile-cvs`, type=`application/pdf`, size ≤ 8 MB. No `publicUrl` returned (CVs are always served via signed download URL — see [2.2.4](#224--public-visitor-downloads-cv)).

### 2.6.3 🔴 Upload failure modes

| Scenario | Detection | Handling |
|---|---|---|
| Wrong MIME type | FE + API check | `400 STORAGE_REJECTED { field: 'contentType' }` |
| File too large | FE + API check | `400 STORAGE_REJECTED { field: 'sizeBytes' }` |
| User not signed in | guard | `401 UNAUTHENTICATED` |
| `PUT` fails (network, 5xx from Supabase) | FE catch | FE shows "Upload failed, retry"; signed URL still valid for 5 min so re-PUT works |
| Signed URL expired before `PUT` | Supabase returns 403 on PUT | FE re-mints by calling `/v1/uploads/photo` again |
| User abandons after `PUT` but before profile submit | nothing persisted in DB | Orphan storage object → cleaned by [`cleanup-orphan-storage`](#29-background-jobs) |
| Duplicate filename | timestamp suffix in key | Practically impossible |
| Upload to another user's prefix | RLS on `storage.objects` (`auth.uid() = foldername[1]`) | Supabase rejects PUT with 403 |
| PUT bytes don't match declared `sizeBytes` | Supabase enforces via signed URL conditions | 400 from Supabase; FE retries |

### 2.6.4 🟡 Edge: replacing existing photo/CV

- Each upload generates a new key (timestamp suffix). Old key is enqueued for deletion *after* the DB update succeeds, never before — so a failed PATCH leaves the old asset intact.

### 2.6.5 🟡 Edge: PDF that's actually not a PDF

- We trust MIME on the client and Supabase's storage validation. For stricter handling, run `delete-storage-object` jobs and a quarantine bucket via ClamAV scan; see open question (5) in [backend-api.md](backend-api.md#11-open-questions-to-confirm-before-build).

---

## 2.7 Sub-concern: Tags

### 2.7.1 🟢 Add a brand-new tag during sign-up

1. [FE] User types "WebGPU" in [`tag-input.tsx`](../components/join/tag-input.tsx), presses Enter.
2. [FE] Adds label to local form state.
3. [API] On profile `POST`, `tags.upsertMany(['WebGPU'])`.
4. [DB] `INSERT INTO tags (slug, label) VALUES ('webgpu','WebGPU') ON CONFLICT DO NOTHING`.
5. [DB] `INSERT INTO profile_tags (profile_id, tag_slug, position) VALUES (…, 'webgpu', 4)`.
6. [Trigger] `usage_count` → 1.

### 2.7.2 🟢 Pre-existing tag — same slug

1. Steps 1–3 as above.
2. [DB] `INSERT … ON CONFLICT DO NOTHING` — no row written, slug already present.
3. [DB] `profile_tags` row created.
4. [Trigger] `usage_count` += 1.

### 2.7.3 🟢 Tag autocomplete

1. [FE] User types "re" in tag input.
2. [FE] Debounced `GET /v1/tags/search?q=re&limit=10`.
3. [API] `SELECT slug, label, usage_count FROM tags WHERE slug ILIKE 're%' ORDER BY usage_count DESC LIMIT 10`.

### 2.7.4 🟢 Popular tags

`GET /v1/tags/popular?limit=6` → ordered by `usage_count DESC`. Backed by `tags_usage_idx`.

### 2.7.5 🔴 Tag failure modes

| Scenario | Detection | Handling |
|---|---|---|
| Tag label > 40 chars | Zod (and CHECK) | `400 VALIDATION_FAILED` |
| Tag with invalid characters (e.g. `react!`) | slugify normalizes; if empty after slugify, reject | `400 VALIDATION_FAILED` |
| Same tag added twice in one form | FE dedup before submit | API also dedups in `upsertMany` |
| `recompute-tag-usage` job finds drift | log diff per tag | Updates `usage_count` to truth; alerts if > 5% drift |
| Attempt to delete a `tags` row that's still referenced | FK `ON DELETE RESTRICT` | Hard delete blocked; tag retained until orphaned, then optionally GC'd manually |

### 2.7.6 🟡 Edge: tag rename / merge

Out of scope for v1. To do later: introduce `tag_aliases(slug → canonical_slug)` and rewrite `profile_tags` references. Don't try to do this with `ON UPDATE CASCADE` on `tags.slug` — it pretends to work but `citext` and triggers interact badly.

---

## 2.8 Sub-concern: Universities

### 2.8.1 🟢 Autocomplete during form fill

1. [FE] User types "Stan" in university field.
2. [FE] Debounced `GET /v1/universities/search?q=Stan&limit=10`.
3. [API] `SELECT id, name FROM universities WHERE name_norm % $1 ORDER BY similarity(name_norm, $1) DESC LIMIT 10` (pg_trgm operator).
4. [FE] Renders suggestions; user may pick or keep typing.

### 2.8.2 🟢 Match-or-create on profile save

1. [API] `universities.matchOrCreate(userInput)`:
   - Normalize: `toLowerCase().trim()`.
   - `SELECT id FROM universities WHERE name_norm = $1` → exact match.
   - Else `SELECT id FROM universities WHERE name_norm % $1 ORDER BY similarity DESC LIMIT 1` and accept if `similarity > 0.6`.
   - Else `INSERT INTO universities (name, name_norm) VALUES ($1, lower($1))` and return new id.
2. [DB] `profiles.university` keeps the original spelling.
3. [DB] `profiles.university_id` points to the dim row.

### 2.8.3 🔴 University failure modes

| Scenario | Detection | Handling |
|---|---|---|
| User types nothing | Zod required | `400 VALIDATION_FAILED { field: 'university' }` |
| Concurrent insert of same `name_norm` | `universities_name_norm_key` unique violation | Catch P2002, re-`SELECT` and use existing id |
| Trigram returns false-positive match (e.g. "Stanfird" → matches "Stanford" at 0.61) | acceptable trade-off | User can override by not picking from autocomplete and typing literal text; we still set `university_id` though |
| Filter on `?university=Stanford%20University` when no canonical row exists | API falls back to `WHERE profiles.university ILIKE $1` | Slower (no FK index) but functional |

### 2.8.4 🟡 Edge: data hygiene

- Dim table grows organically with sign-ups. Periodic admin task: merge near-duplicates (`name_norm = 'mit'` vs `'massachusetts institute of technology'`). Could automate via embedding similarity later.

---

## 2.9 Background jobs

All profile-related scheduled work. The auth module's throttle cleanup is in [1.7](#17-background-cleanup-magic-link-throttle).

### 2.9.1 `recompute-tag-usage`

- Cron: `0 4 * * 0` (Sunday 04:00).
- Query:
  ```sql
  UPDATE tags t
     SET usage_count = sub.cnt
    FROM (SELECT tag_slug, count(*) AS cnt FROM profile_tags GROUP BY tag_slug) sub
   WHERE t.slug = sub.tag_slug AND t.usage_count <> sub.cnt;
  ```
- Failure: log + alert; next run heals state.

### 2.9.2 `hard-delete-profile`

- BullMQ delayed job (7 days after soft delete).
- Re-check `deleted_at IS NOT NULL` inside the transaction.
- Delete row, cascade `profile_tags`/`profile_views`, then list & purge `${user_id}/` from both buckets.
- Failure: BullMQ retries up to 5× with exponential backoff. Final failure raises alert.

### 2.9.3 `cleanup-orphan-storage`

- Cron: `0 3 * * *` (nightly).
- For each object in `profile-photos` and `profile-cvs`:
  - Extract `userId` from key prefix.
  - If no live profile for `userId` references this key, AND the object is older than 24 h → delete.
- Failure: log per-object error, continue.

### 2.9.4 `delete-storage-object`

- BullMQ on-demand (fired from PATCH and hard-delete).
- Deletes a single key.
- Idempotent: missing object → success.

### 2.9.5 `seed-universities`

- One-shot at deploy: import open-source university dataset (e.g. Hipolabs Universities API).
- Idempotent via `ON CONFLICT (name_norm) DO NOTHING`.

---

# 3. Cross-cutting concerns

These span both modules.

## 3.1 Idempotency

- All `POST` mutations accept `Idempotency-Key` header (UUID).
- Stored in Redis: `idem:{userId}:{key} → { status, body, bodyHash, expiresAt }` with TTL 24 h.
- Replay with same key + same body → cached response.
- Replay with same key + different body → `409 IDEMPOTENT_REPLAY`.
- After 24 h, replay falls through to underlying constraints (which will usually reject duplicates anyway).

## 3.2 Rate limiting

| Endpoint | Limit | Backed by |
|---|---|---|
| `POST /v1/auth/magic-link` | 3/min/email, 10/min/IP | `magic_link_throttle` |
| `POST /v1/uploads/*` | 30/min/user | Redis counter |
| `POST /v1/profiles` | 5/min/user | Redis counter (also gated by unique constraint) |
| `GET /v1/profiles` (anon) | 120/min/IP | Edge / Cloudflare |

Exceeding → `429 RATE_LIMITED`.

## 3.3 Orphan storage objects

- Created when: user uploads photo/CV then abandons sign-up, or PATCH validation fails after upload.
- Cleaned by [`cleanup-orphan-storage`](#293-cleanup-orphan-storage) within 24 h.
- Hard cap: per-user storage usage tracked; if a user exceeds 50 MB of orphans in a day, signed URLs are throttled.

## 3.4 Audit logging

Inserted by `AuditInterceptor` after every mutating action (`profile.create`, `profile.update`, `profile.slug_change`, `profile.contact_change`, `profile.soft_delete`, `profile.restore`, `profile.hard_delete`, `cv.upload`, `cv.delete`). Append-only, never updated.

## 3.5 Personally-identifiable data on errors

- `magic_link_throttle` stores emails plaintext for ≤ 24 h. Acceptable trade-off for throttle simplicity; can hash later if compliance requires.
- `audit_logs.diff` may include the old `contact` value (e.g. email or LinkedIn URL). Trimmed on the GDPR export endpoint when implemented.
- `profile_views.viewer_hash` uses a rotating salt; raw IP never persisted.

## 3.6 Concurrency safety summary

| Resource | Mechanism |
|---|---|
| Slug uniqueness | Partial unique index `profiles_slug_live_idx`; catch P2002 |
| One profile per user | Partial unique index `profiles_user_id_live_idx`; catch P2002 |
| Tag dictionary inserts | `INSERT … ON CONFLICT DO NOTHING` |
| University dim inserts | Unique on `name_norm`; catch P2002 and re-select |
| `profile_views` dedup | PK `(profile_id, viewer_hash, viewed_on)` + `ON CONFLICT DO NOTHING` |
| Restore token consumption | Atomic `UPDATE … WHERE restore_token_hash=$1 AND deleted_at IS NOT NULL` |
| BullMQ job double-runs | Idempotent SQL inside each job (re-checks pre-conditions) |

## 3.7 Failure recovery summary

| Failure | Recovery |
|---|---|
| Supabase Auth outage | Magic-link endpoint surfaces 502; FE retry |
| Postgres outage | All endpoints fail with 5xx; FE shows global retry banner |
| Storage outage | Upload mint succeeds (it's a URL signing op), `PUT` fails; FE retry |
| Redis outage | Idempotency falls back to constraint-based dedup; rate limit becomes effectively unlimited (acceptable temporary state) |
| BullMQ outage | Soft-delete still works; hard-delete + orphan cleanup delayed until queue recovers |
| Email provider outage | Magic-link + restore-link emails delayed; user can resend |
