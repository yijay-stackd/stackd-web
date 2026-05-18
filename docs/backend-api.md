# Stackd — Backend API, Functions & Flows (v2)

Stack: **NestJS + Prisma + Supabase Auth + Supabase Storage**.
All endpoints under `/v1`. Auth uses Supabase JWT in `Authorization: Bearer <jwt>`.

---

## Design principles applied

1. **Idempotent mutations** — every `POST` accepts `Idempotency-Key`; retries don't duplicate.
2. **No read-then-write race windows** — uniqueness is enforced by the DB, not by application checks.
3. **Server is the only place that mints storage URLs** — clients PUT to short-lived signed URLs, then send back the storage key. The API verifies the object exists before persisting the key.
4. **Search uses `websearch_to_tsquery`** — accepts arbitrary user input safely; ranks by `ts_rank` when `q` is provided, falls back to chronological order otherwise.
5. **No flow requires a session the previous step revoked** — delete + restore uses a signed email link, not a sticky session.
6. **Smallest correct response** — public endpoints return only public fields; never expose `cv_key`, `email`, or audit metadata.

---

## 1. NestJS module layout

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── guards/
│   │   ├── supabase-auth.guard.ts          # verifies JWT → req.user = { id, email }
│   │   └── profile-owner.guard.ts          # ensures req.user.id owns the target
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── public.decorator.ts             # @Public() marks anon-allowed
│   ├── interceptors/
│   │   ├── audit.interceptor.ts            # writes audit_logs on mutating actions
│   │   └── idempotency.interceptor.ts      # honours Idempotency-Key header
│   ├── filters/http-exception.filter.ts    # uniform ApiFail envelope
│   └── pipes/zod-validation.pipe.ts
├── prisma/prisma.service.ts
├── supabase/
│   ├── supabase.service.ts                 # admin client (service-role key)
│   └── storage.service.ts                  # signed-URL helpers, key validation
├── modules/
│   ├── auth/                               # magic link + session bridge
│   ├── profiles/                           # public read + owner CRUD
│   ├── uploads/                            # signed-URL minting
│   ├── tags/                               # dictionary + popular
│   └── universities/                       # trigram autocomplete
└── jobs/                                   # BullMQ workers (storage cleanup, etc.)
```

---

## 2. Response envelope + errors

```ts
type ApiOk<T> = { ok: true;  data: T; meta?: PageMeta };
type ApiFail  = { ok: false; error: { code: ErrorCode; message: string; field?: string } };
type PageMeta = { limit: number; cursor: string | null; total?: number };

type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'SLUG_TAKEN' | 'PROFILE_EXISTS'
  | 'RATE_LIMITED' | 'IDEMPOTENT_REPLAY'
  | 'STORAGE_REJECTED' | 'UPLOAD_NOT_FOUND'
  | 'INTERNAL';
```

> `total` is **only** included when no `q` is set. Counting with a tsvector predicate is expensive enough that we skip it for searches; the UI just shows "Showing N of many".

---

## 3. Public-facing DTOs

The public profile shape is smaller than the full DB row.

```ts
// Returned by GET /v1/profiles and /v1/profiles/:slug
type ProfileCard = {
  slug: string;
  name: string;
  university: string;
  course: string;
  year: '1st'|'2nd'|'3rd'|'4th'|'Masters'|'PhD';
  location: string | null;
  openTo: OpenTo[];
  availability: { from: string; to: string } | null;   // formatted: "Aug 2026"/"Ongoing"
  internshipLength: string | null;
  bio: string;
  tags: string[];                                       // labels, ordered
  contactType: ContactType;
  contact: string;
  photo: string | null;                                 // resolved public URL
  photoColor: string;                                   // resolved hex from palette
  hasCv: boolean;                                       // never expose cv_key directly
  addedAt: string;                                      // ISO
  updatedAt: string | null;
};

// Owner-only (extends ProfileCard)
type OwnProfile = ProfileCard & {
  email: string;
  isPublic: boolean;
  cvName: string | null;
};
```

---

## 4. Endpoints

> Auth: 🔓 public · 🔑 signed-in · 🔐 owner.

### Auth

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/v1/auth/magic-link` | 🔓 | Throttle (3/min/email, 10/min/IP), then `signInWithOtp` |
| `GET`  | `/v1/auth/me`         | 🔑 | `{ user, profile }`; `profile = null` if not created |

> No `/v1/auth/sign-out` — Supabase JS client calls `supabase.auth.signOut()` directly. Adding a server endpoint here just creates a second source of truth.

### Profiles — read

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/v1/profiles`        | 🔓 | Feed list with filters + cursor pagination |
| `GET` | `/v1/profiles/:slug`  | 🔓 | Returns `ProfileCard`; 404 if private/deleted |
| `GET` | `/v1/profiles/me`     | 🔑 | Returns `OwnProfile`; 404 if not created |
| `POST`| `/v1/profiles/check-slug` | 🔑 | `{ available: bool, suggestion?: string }` |

#### `GET /v1/profiles` query params

```
q          string     full-text (passed to websearch_to_tsquery)
tag        string     single tag slug
open_to    csv        any-of: internships,research,...
year       csv        any-of: 1st,2nd,...
university string     exact match on canonical name (uses university_id)
available  enum       "now" | "summer-2026" | "fall-2026" — translates to date range
sort       enum       "relevance" (default when q set) | "newest" (default otherwise) | "name"
limit      int        1..50, default 24
cursor     string     base64(JSON({ created_at, id }) or { rank, id })
```

When `q` is set, the SQL becomes:

```sql
SELECT p.*, ts_rank(p.search_vector, websearch_to_tsquery('simple', $q)) AS rank
FROM   profiles p
WHERE  p.search_vector @@ websearch_to_tsquery('simple', $q)
   AND p.is_public AND p.deleted_at IS NULL
   AND (...filters...)
ORDER BY rank DESC, p.id DESC
LIMIT  $limit + 1;
```

When `q` is not set, it's the `(created_at DESC, id DESC)` partial index — exact match.

### Profiles — mutate

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST`   | `/v1/profiles`            | 🔑 | One per user; idempotent via header |
| `PATCH`  | `/v1/profiles/me`         | 🔑 | Partial update; full-replace for `tags` / `open_to` |
| `POST`   | `/v1/profiles/me/delete`  | 🔑 | Soft delete; emails a restore link |
| `POST`   | `/v1/profiles/me/restore` | 🔓 | Body: `{ token }` from email; no session needed |

> `DELETE` would have been more REST-ful but we use `POST .../delete` because it lets us return the restore token in the response body without weirdness, and the audit log captures the action richer.

### Uploads

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/v1/uploads/photo`  | 🔑 | Mints signed PUT URL for `profile-photos` |
| `POST` | `/v1/uploads/cv`     | 🔑 | Mints signed PUT URL for `profile-cvs` |
| `GET`  | `/v1/profiles/:slug/cv` | 🔓 | Mints 5-min signed download URL when `hasCv` |

Request/response shape:

```ts
// POST /v1/uploads/photo
{ contentType: 'image/png'|'image/jpeg'|'image/webp', sizeBytes: number }
→ { uploadUrl: string, key: string, expiresIn: 300 }

// POST /v1/uploads/cv
{ contentType: 'application/pdf', sizeBytes: number }   // sizeBytes ≤ 8_388_608
→ { uploadUrl: string, key: string, expiresIn: 300 }
```

The client `PUT`s the file to `uploadUrl`, then sends `key` back in `POST /v1/profiles` or `PATCH /v1/profiles/me`. The server calls `storage.head(key)` before persisting to confirm the upload actually happened — if not, returns `UPLOAD_NOT_FOUND`.

### Tags + universities

| Method | Path | Auth |
|---|---|---|
| `GET` | `/v1/tags/popular?limit=6` | 🔓 |
| `GET` | `/v1/tags/search?q=&limit=10` | 🔓 |
| `GET` | `/v1/universities/search?q=&limit=10` | 🔓 |

---

## 5. Core service functions

### `ProfilesService.create(userId, input, idemKey)`

```ts
async create(userId: string, dto: CreateProfileDto, idemKey?: string): Promise<OwnProfile> {
  // 1. Idempotency: if (userId, idemKey) already produced a profile, return it.
  if (idemKey) {
    const cached = await this.idem.lookup(userId, idemKey);
    if (cached) return cached as OwnProfile;
  }

  // 2. Resolve slug (no read-then-write race; we rely on the partial unique index)
  const baseSlug = dto.slug ?? slugify(dto.name);
  const slug     = await this.slugWithRetry(baseSlug);

  // 3. Resolve / create university dim row (best-effort)
  const universityId = await this.universities.matchOrCreate(dto.university);

  // 4. Verify uploaded assets exist in storage before we persist references to them
  if (dto.photoKey) await this.storage.assertExists('profile-photos', dto.photoKey, userId);
  if (dto.cvKey)    await this.storage.assertExists('profile-cvs',    dto.cvKey,    userId);

  // 5. Upsert tag dictionary in one round-trip
  const tagSlugs = await this.tags.upsertMany(dto.tags);   // returns slugs in submitted order

  // 6. Transactional insert; let the unique index resolve concurrent creates
  try {
    const profile = await this.prisma.$transaction(async (tx) => {
      const p = await tx.profile.create({
        data: {
          userId,
          slug,
          name: dto.name,
          university: dto.university,
          universityId,
          course: dto.course,
          year: dto.year,
          location: dto.location ?? null,
          bio: dto.bio,
          openTo: dto.openTo,
          availableFrom: dto.availability?.from ?? null,
          availableTo:   dto.availability?.to   ?? null,
          internshipLength: dto.openTo.includes('internships') ? dto.internshipLength ?? null : null,
          contactType: dto.contactType,
          contact: dto.contact,
          photoKey: dto.photoKey ?? null,
          photoColorIdx: pickPhotoColorIdx(dto.name),
          cvKey:        dto.cvKey ?? null,
          cvName:       dto.cvKey ? dto.cvName ?? null : null,
          cvSizeBytes:  dto.cvKey ? dto.cvSizeBytes ?? null : null,
          cvUploadedAt: dto.cvKey ? new Date() : null,
        },
      });

      if (tagSlugs.length) {
        await tx.profileTag.createMany({
          data: tagSlugs.map((tagSlug, i) => ({ profileId: p.id, tagSlug, position: i })),
        });
      }

      await tx.auditLog.create({ data: { actorId: userId, profileId: p.id, action: 'profile.create' } });
      return p;
    });

    const out = await this.toOwnProfile(profile);
    if (idemKey) await this.idem.store(userId, idemKey, out);
    return out;

  } catch (e) {
    // Unique violations resolved here, not by a pre-check
    if (isUniqueViolation(e, 'profiles_user_id_live_idx')) throw new ConflictException({ code: 'PROFILE_EXISTS' });
    if (isUniqueViolation(e, 'profiles_slug_live_idx'))    throw new ConflictException({ code: 'SLUG_TAKEN' });
    throw e;
  }
}

private async slugWithRetry(base: string, max = 5): Promise<string> {
  // Optimistic: try base, then base-2, base-3, … on retry inside .create()
  // Caller catches SLUG_TAKEN once and we append a 4-char suffix as last resort.
  return base;
}
```

### `ProfilesService.update(userId, patch)`

```ts
async update(userId: string, patch: UpdateProfileDto): Promise<OwnProfile> {
  return this.prisma.$transaction(async (tx) => {
    const before = await tx.profile.findFirst({ where: { userId, deletedAt: null } });
    if (!before) throw new NotFoundException({ code: 'NOT_FOUND' });

    if (patch.photoKey) await this.storage.assertExists('profile-photos', patch.photoKey, userId);
    if (patch.cvKey)    await this.storage.assertExists('profile-cvs',    patch.cvKey,    userId);

    // Field-by-field update — only fields actually in patch
    const after = await tx.profile.update({
      where: { id: before.id },
      data:  buildPatchData(before, patch),                 // omits undefined fields
    });

    // Tags: diff, don't full-replace (fewer trigger fires, faster, audit-log-friendly)
    if (patch.tags) {
      const incoming = await this.tags.upsertMany(patch.tags);
      const current  = (await tx.profileTag.findMany({ where: { profileId: before.id } }))
                         .sort((a, b) => a.position - b.position).map(t => t.tagSlug);
      const toRemove = current.filter(s => !incoming.includes(s));
      const toAdd    = incoming.filter(s => !current.includes(s));

      if (toRemove.length) await tx.profileTag.deleteMany({ where: { profileId: before.id, tagSlug: { in: toRemove } } });
      if (toAdd.length)    await tx.profileTag.createMany({ data: toAdd.map(s => ({
                                profileId: before.id, tagSlug: s, position: incoming.indexOf(s),
                              })) });
      // Re-number positions for any tag whose index shifted (single UPDATE per shifted row)
      await this.tags.reorderPositions(tx, before.id, incoming);
    }

    // Cleanup orphaned storage objects when a new photo/CV replaces an old one
    if (patch.photoKey && before.photoKey && before.photoKey !== patch.photoKey) {
      await this.jobs.enqueueDeleteStorageObject('profile-photos', before.photoKey);
    }
    if (patch.cvKey && before.cvKey && before.cvKey !== patch.cvKey) {
      await this.jobs.enqueueDeleteStorageObject('profile-cvs', before.cvKey);
    }

    await tx.auditLog.create({ data: {
      actorId: userId, profileId: before.id, action: 'profile.update',
      diff: diffJson(before, after),
    }});

    return this.toOwnProfile(after);
  });
}
```

### `ProfilesService.list(query)`

```ts
async list(q: FeedQueryDto): Promise<{ items: ProfileCard[]; meta: PageMeta }> {
  const sortMode = q.q ? (q.sort ?? 'relevance') : (q.sort ?? 'newest');

  // Use raw SQL only when relevance ranking is involved — Prisma's `search` operator
  // is to_tsquery-based and unsafe with raw user input.
  const rows = q.q
    ? await this.searchWithRank(q, sortMode)
    : await this.searchPlain(q, sortMode);

  const items = rows.slice(0, q.limit).map(toProfileCard);
  const nextCursor = rows.length > q.limit ? encodeCursor(rows[q.limit - 1], sortMode) : null;

  // Skip total when q is set (tsvector counts are expensive)
  const total = q.q ? undefined : await this.countMatching(q);

  return { items, meta: { limit: q.limit, cursor: nextCursor, total } };
}
```

Cursor payload:
- `sort=newest` → `{ createdAt: ISO, id: uuid }`
- `sort=name`   → `{ name: string, id: uuid }`
- `sort=relevance` → `{ rank: number, id: uuid }`

The cursor is base64-encoded JSON and validated against the current `sort` to prevent injection.

### `ProfilesService.softDelete(userId)`

```ts
async softDelete(userId: string): Promise<{ restoreEmailed: true }> {
  const restoreToken = randomToken(32);                     // raw token
  const tokenHash    = sha256(restoreToken);

  return this.prisma.$transaction(async (tx) => {
    const p = await tx.profile.update({
      where: { userId_deletedAt: { userId, deletedAt: null } },
      data:  { deletedAt: new Date(), isPublic: false, restoreTokenHash: tokenHash, restoreExpiresAt: in7days() },
    });
    await tx.auditLog.create({ data: { actorId: userId, profileId: p.id, action: 'profile.soft_delete' }});
    // Schedule hard delete + storage purge for after the restore window
    await this.jobs.enqueueHardDeleteProfile(p.id, in7days());
    // Send restore email with the raw token; we never store it server-side
    await this.email.sendRestoreLink(p.email, restoreToken);
    // Do NOT revoke the session here — let the client call supabase.auth.signOut() itself
    return { restoreEmailed: true };
  });
}
```

> Note: `restoreTokenHash` and `restoreExpiresAt` are two additional nullable columns on `profiles` not shown in the schema doc — add when you implement the flow.

### `ProfilesService.restore(token)`

Validates `sha256(token)` against any `profiles.restore_token_hash` where `restore_expires_at > now()`, clears `deleted_at`, returns the slug. No session required.

### `UploadsService.mintPhotoUpload(userId, dto)`

```ts
async mintPhotoUpload(userId: string, dto: PhotoUploadDto): Promise<UploadTicket> {
  this.assertAllowedPhoto(dto.contentType, dto.sizeBytes);  // 2 MB cap + mime whitelist
  const ext = mimeExt(dto.contentType);                     // 'png' | 'jpg' | 'webp'
  const key = `${userId}/avatar-${Date.now()}.${ext}`;
  const { signedUrl } = await this.storage.createSignedUploadUrl('profile-photos', key);
  return { uploadUrl: signedUrl, key, expiresIn: 300 };
}
```

`mintCvUpload` is the same with `profile-cvs` + `application/pdf` + 8 MB cap.

`StorageService.assertExists(bucket, key, userId)` calls `supabase.storage.from(bucket).list(prefix)` (or HEAD when the JS client gains it), confirms the object is under `${userId}/`, and throws `UPLOAD_NOT_FOUND` otherwise. This is the only place where we trust the key came from a real upload.

### `TagsService.upsertMany(labels)`

```ts
// One round-trip, atomic.
async upsertMany(labels: string[]): Promise<string[]> {
  if (!labels.length) return [];
  const rows = labels.map(l => ({ slug: slugify(l), label: titleCase(l) }));
  await this.prisma.$executeRawUnsafe(`
    INSERT INTO tags (slug, label)
    SELECT * FROM unnest($1::citext[], $2::text[])
    ON CONFLICT (slug) DO NOTHING
  `, rows.map(r => r.slug), rows.map(r => r.label));
  return rows.map(r => r.slug);
}
```

### `AuthService.requestMagicLink(email, ip)`

```ts
async requestMagicLink(email: string, ip: string) {
  const oneMinuteAgo = new Date(Date.now() - 60_000);

  // Per-email AND per-IP throttle (so rotating emails from one IP is also blocked).
  const [byEmail, byIp] = await Promise.all([
    this.prisma.magicLinkThrottle.count({ where: { email, sentAt: { gte: oneMinuteAgo } } }),
    this.prisma.magicLinkThrottle.count({ where: { ip,    sentAt: { gte: oneMinuteAgo } } }),
  ]);
  if (byEmail >= 3 || byIp >= 10) throw new HttpException({ code: 'RATE_LIMITED' }, 429);

  await this.supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${env.APP_URL}/login/callback` },
  });
  await this.prisma.magicLinkThrottle.create({ data: { email, ip } });
  return { sent: true };
}
```

---

## 6. End-to-end flows

### Flow A — New user signs up + creates profile

```
[user]              [Next.js]                  [NestJS API]             [Supabase Auth]      [Storage]            [Postgres]
  │ type email        │                            │                         │                    │                    │
  ├──────────────────►│ POST /v1/auth/magic-link   │                         │                    │                    │
  │                   ├───────────────────────────►│ throttle (email + ip)   │                    │                    │
  │                   │                            ├────────────────────────►│ signInWithOtp      │                    │
  │                   │◄── { sent: true } ─────────│                         │                    │                    │
  │ click email link  │                            │                         │                    │                    │
  ├───────────────────────────────────────────────────────────────────────►│ verify, set session│                    │
  │ (redirect /login/callback with JWT in URL hash)
  │                   │ GET /v1/auth/me            │                         │                    │                    │
  │                   ├───────────────────────────►│ verify JWT (guard)      │                    │                    │
  │                   │                            ├─ findFirst by user_id ─────────────────────────────────────────►│
  │                   │◄── { user, profile: null } │                         │                    │                    │
  │ (router → /join)  │                            │                         │                    │                    │
  │ pick photo        │ POST /v1/uploads/photo     │                         │                    │                    │
  │                   ├───────────────────────────►│ mint signed upload URL  │                    │                    │
  │                   │◄── { uploadUrl, key } ─────│                         │                    │                    │
  │                   ├─ PUT photo bytes ──────────────────────────────────────────────────────►│ object written    │
  │ pick CV           │ POST /v1/uploads/cv → PUT (same pattern) ────────────────────────────►│                    │
  │ submit form       │ POST /v1/profiles + Idempotency-Key                                                          │
  │                   ├───────────────────────────►│ verify JWT, Zod validate                                         │
  │                   │                            ├─ storage.assertExists(photo_key, cv_key) ───►│ HEAD            │
  │                   │                            ├─ universities.matchOrCreate ─────────────────────────────────►│
  │                   │                            ├─ tags.upsertMany (one INSERT) ─────────────────────────────────►│
  │                   │                            ├─ TX: profile + profile_tags + audit_log ──────────────────────►│
  │                   │                            │   (unique index resolves any concurrent slug clash)             │
  │                   │◄── { profile } ────────────│                                                                 │
  │ celebration → /profile/:slug                                                                                    │
```

### Flow B — Returning user signs in (has profile)

1. `POST /v1/auth/magic-link` → email sent.
2. Callback sets session.
3. `GET /v1/auth/me` returns `{ user, profile }`.
4. Frontend `AuthProvider.signIn(email, profile.slug)`; router → `/profile/:slug`.

### Flow C — Feed browse

1. `GET /v1/tags/popular?limit=6` → chip rail.
2. `GET /v1/profiles?limit=24` → first page (chronological, `total` included).
3. Debounced query → `GET /v1/profiles?q=react&tag=ml`; response uses `ts_rank` ordering, no `total`.
4. Pagination → reuse the `cursor` from the previous response.

### Flow D — Edit profile

1. Edit page calls `GET /v1/profiles/me` → prefills [`StudentForm`](../components/forms/student-form.tsx).
2. New photo? Mint upload → PUT → keep returned `key`.
3. `PATCH /v1/profiles/me` with the changed fields only.
4. Server diffs tags + open_to, applies update, audit-logs, schedules deletion of replaced storage objects.
5. Frontend shows the "Changes saved" toast and updates its React Query cache.

### Flow E — Delete + restore

1. Confirm modal → `POST /v1/profiles/me/delete`.
2. Server: soft-delete, write `restore_token_hash`, schedule hard-delete in 7 days, email `restoreToken` to the user.
3. UI signs the user out via `supabase.auth.signOut()` and routes to `/`.
4. If user clicks the email link within 7 days → `POST /v1/profiles/me/restore { token }` (no session needed) → profile undeletes; cron job for hard-delete is cancelled.
5. After 7 days: BullMQ job hard-deletes the row, purges `{user_id}/` from both storage buckets, writes `profile.hard_delete` audit row.

### Flow F — Public visitor opens a profile

1. `GET /v1/profiles/:slug` → `ProfileCard` (no `email`, no `cv_key`).
2. Fire-and-forget: server records a `profile_views` row keyed by `(profile_id, viewer_hash, today)` with `ON CONFLICT DO NOTHING`.
3. If `card.hasCv`, the "Download CV" button calls `GET /v1/profiles/:slug/cv` → 5-minute signed URL.

---

## 7. Guards, validation, errors

- **`SupabaseAuthGuard`** — verifies `Authorization: Bearer …` via `supabase.auth.getUser(jwt)`; sets `req.user = { id, email }`. Throws 401 `UNAUTHENTICATED`.
- **`ProfileOwnerGuard`** — only used on `/profiles/me/*`; loads the live profile by `req.user.id` and attaches it.
- **`ZodValidationPipe`** — every DTO is a Zod schema. The first failing path becomes `error.field`.
- **`IdempotencyInterceptor`** — for `POST /v1/profiles`: stores `(userId, idemKey)` → response body for 24 h in Redis. Replays return the cached body with `error.code = 'IDEMPOTENT_REPLAY'` only if the *body* differs.
- **`HttpExceptionFilter`** — wraps everything into `ApiFail`.

---

## 8. Background jobs

| Job | Trigger | Action |
|---|---|---|
| `cleanup-magic-link-throttle` | cron `*/15 * * * *` | Delete rows older than 24 h |
| `recompute-tag-usage` | cron `0 4 * * 0` | `UPDATE tags SET usage_count = (SELECT count(*) FROM profile_tags WHERE tag_slug = tags.slug)` |
| `hard-delete-profile` | BullMQ delayed (7 d) | Hard-delete row + purge `{user_id}/` from both buckets + audit log |
| `delete-storage-object` | BullMQ on demand | Removes a single key when a photo/CV is replaced |
| `seed-universities` | one-shot | Import open-source university dataset |

---

## 9. Frontend → API call map

| Frontend file | Today | After backend lands |
|---|---|---|
| [components/providers/auth-provider.tsx](../components/providers/auth-provider.tsx) | localStorage `stackd:user` | Supabase JS session + `GET /v1/auth/me` on mount |
| [components/auth/login-form.tsx](../components/auth/login-form.tsx) | Fake 650 ms timer | `POST /v1/auth/magic-link` |
| [components/providers/students-provider.tsx](../components/providers/students-provider.tsx) | In-memory seed | React Query against `/v1/profiles` |
| [components/home/feed.tsx](../components/home/feed.tsx) | Client filter | Server filter via query params; popular tags from `/v1/tags/popular` |
| [components/join/join-form.tsx](../components/join/join-form.tsx) | `addStudent()` | Upload → `POST /v1/profiles` with `Idempotency-Key` |
| [components/edit-profile/edit-profile-form.tsx](../components/edit-profile/edit-profile-form.tsx) | `updateStudent()` | `PATCH /v1/profiles/me` |
| [components/edit-profile/delete-modal.tsx](../components/edit-profile/delete-modal.tsx) | `deleteStudent()` | `POST /v1/profiles/me/delete` |
| [components/join/cv-upload.tsx](../components/join/cv-upload.tsx) | Base64 data URL | Direct PUT to signed URL |
| [components/join/photo-upload.tsx](../components/join/photo-upload.tsx) | Base64 data URL | Direct PUT to signed URL |

---

## 10. Env vars

```
DATABASE_URL                   # Supabase pooler, port 6543
DIRECT_URL                     # Direct for prisma migrate, port 5432
SUPABASE_URL
SUPABASE_ANON_KEY              # Next.js client only
SUPABASE_SERVICE_ROLE_KEY      # NestJS only — never expose
SUPABASE_JWT_SECRET            # for guard JWT verification
APP_URL
STORAGE_BUCKET_PHOTOS=profile-photos
STORAGE_BUCKET_CVS=profile-cvs
REDIS_URL                      # BullMQ + idempotency cache
THROTTLE_MAGIC_LINK_PER_MIN_EMAIL=3
THROTTLE_MAGIC_LINK_PER_MIN_IP=10
RESTORE_TOKEN_TTL_DAYS=7
```

---

## 11. Open questions to confirm before build

1. **Multiple profiles per user?** Partial unique on `user_id` enforces one live profile. Drop the constraint if you want alt-accounts.
2. **Verify `contact` when contactType=email?** Currently regex-only. A confirmation email before publishing is one extra round-trip but kills typos.
3. **CV virus scanning?** Supabase doesn't scan. Hook ClamAV on the storage object-created event and quarantine to `profile-cvs-pending` first.
4. **GDPR export?** Cheap to add: `GET /v1/profiles/me/export` returns a signed URL to a generated JSON dump.
5. **Search relevance vs recency on empty `q`?** Default to recency. Add a "trending" feed (`ts_rank` over last-7-day views) when traffic justifies it.

---

## Appendix — Summary of changes from v1

| Area | v1 | v2 |
|---|---|---|
| `profiles.email` | denormalized | **dropped**; join `auth.users` when needed |
| `profile_open_to` | join table | **array column** `open_to open_to_enum[]` (GIN-indexed) |
| `availability_*` | text (`"Now"`/`"Ongoing"`) | **real `date`** with NULL sentinels + CHECK constraints |
| `photo_url` | full URL | **`photo_key`** (storage key); URL built by mapper |
| `photo_color` | hex text | **`photo_color_idx smallint`** index into palette |
| `bio` | varchar(140) | **varchar(100)** matches frontend |
| `slug` / `user_id` unique | global | **partial unique** `WHERE deleted_at IS NULL` |
| `create()` | read-then-insert | **catch unique violation**, no race window |
| `tags.upsertMany` | N round-trips | **single INSERT … ON CONFLICT** with unnest |
| Search query | Prisma `search` (`to_tsquery`) | **raw SQL `websearch_to_tsquery` + `ts_rank`** |
| Tag updates | full delete+insert | **diff-based** |
| Delete + restore | revoked session blocked restore | **signed restore link via email**, no session needed |
| `POST /profiles` | no idempotency | **`Idempotency-Key`** header + Redis cache |
| Uploaded key trust | trusted from client | **server HEADs storage** before persisting |
| `POST /auth/sign-out` | server endpoint | **removed** — client uses `supabase.auth.signOut()` |
| Composite indexes | only by single columns | **`(university_id, created_at DESC)`** etc. for real filter+sort shapes |
| Throttle | per-email only | **per-email AND per-IP** |
