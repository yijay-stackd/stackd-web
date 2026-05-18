# Stackd — Backend Implementation Plan

Build order for the NestJS + Prisma + Supabase backend. Each step is self-contained — give one step at a time to an AI agent (or yourself).

**Stack reminders:**
- NestJS (latest) + Prisma + Supabase (Postgres + Auth + Storage)
- Schema: [`db-diagram.dbml`](./db-diagram.dbml) (visual) + [`backend-schema.md`](./backend-schema.md) (SQL)
- v2 backlog: [`v2-backlog.md`](./v2-backlog.md)

**How to use this file:**
- Tackle steps in order. Don't skip — later steps depend on earlier ones.
- Each step has a **Goal**, **Build**, and **Verify**. Don't move on until Verify passes.
- If a step balloons, split it into sub-PRs — the verify gate stays the same.

---

## Phase 1 — Foundation

### Step 1. Initialize the NestJS project
- **Goal:** project skeleton boots locally with health check.
- **Build:**
  - `nest new backend` (TypeScript, npm or pnpm — match your preference)
  - Install deps: `@nestjs/config`, `@prisma/client`, `prisma`, `@supabase/supabase-js`, `@nestjs/throttler`, `class-validator`, `class-transformer`, `zod`
  - `.env.example` with `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
  - `GET /health` endpoint returning `{ status: 'ok' }`
- **Verify:** `npm run start:dev` boots; `curl localhost:3000/health` returns 200.

### Step 2. Configure Prisma + Supabase connection
- **Goal:** Prisma can reach the Supabase Postgres instance.
- **Build:**
  - `npx prisma init`
  - Set `provider = "postgresql"`, `url = env("DATABASE_URL")`
  - Use Supabase **Session pooler** URL for migrations, **Transaction pooler** for runtime (`?pgbouncer=true&connection_limit=1`)
  - `PrismaService` extending `PrismaClient` registered as a global provider
- **Verify:** `npx prisma db pull` succeeds (even on empty DB); `prismaService.$queryRaw\`SELECT 1\`` works in a test endpoint.

---

## Phase 2 — Database

### Step 3. Prisma schema for all tables
- **Goal:** `prisma/schema.prisma` mirrors [`backend-schema.md`](./backend-schema.md) sections 3–8.
- **Build:** Models for `profiles`, `skills`, `profile_skills`, `profile_contacts`, `universities`, `content_reports`, `moderation_events`. Enums for all 8 enum types. `@@map` to snake_case table names.
- **Verify:** `npx prisma format` clean; `npx prisma migrate dev --name init` creates the migration; tables appear in Supabase Studio.

### Step 4. Raw SQL migration for everything Prisma can't model
- **Goal:** Extensions, generated columns, partial indexes, expression indexes, triggers, functions, RLS policies all in place.
- **Build:** Create `prisma/migrations/<timestamp>_init/migration.sql` (or a follow-up migration) with everything from `backend-schema.md` that Prisma's DSL doesn't cover:
  - Extensions (`citext`, `pg_trgm`, `pgcrypto`, `moddatetime`)
  - `universities.name_norm` generated column
  - Partial unique indexes on `profiles(slug)` and `profiles(user_id)` WHERE deleted_at IS NULL
  - Expression unique index on `profile_contacts(profile_id, kind, lower(value))`
  - All CHECK constraints
  - `profiles_update_search_vector` trigger
  - `profile_skills_after_change` trigger (maintains `usage_count` + `skill_slugs`)
  - `skills_after_reject` trigger
  - `moddatetime` trigger on `profiles.updated_at`
  - `purge_profile()` and `allocate_profile_slug()` functions
  - All RLS policies (section 11)
- **Verify:**
  - Insert a profile + skill assignment → `skills.usage_count` bumps, `profiles.skill_slugs` updates.
  - Mark a skill as `rejected` → assignments deleted, `moderation_events` row written with `action = 'reject_skill'`.
  - Query `profiles` as anon role → suspended/deleted profiles invisible.

### Step 5. Storage buckets + RLS
- **Goal:** `profile-photos` (public) and `profile-cvs` (private) buckets exist with owner-only write policies.
- **Build:** Create buckets via Supabase Studio or CLI. Apply storage RLS from `backend-schema.md` section 10. Add size + MIME limits in bucket config.
- **Verify:** Anon client can read photo; cannot list/read CVs. Authenticated client can only write under `{their_user_id}/*` path.

### Step 6. Seed universities from ROR
- **Goal:** ~100k universities loaded with aliases + country.
- **Build:** `scripts/seed-universities.ts` — fetch latest [ROR data dump](https://ror.readme.io/docs/data-dump), parse JSON, bulk insert. Set `is_verified = true` for ROR-sourced rows.
- **Verify:** `SELECT COUNT(*) FROM universities WHERE is_verified = true` returns ~100k. Trigram search for "harv" returns Harvard with aliases populated.

---

## Phase 3 — Auth

### Step 7. Supabase JWT validation
- **Goal:** Protected endpoints validate the Supabase-issued JWT and attach `req.user` ({ id, email, email_verified }).
- **Build:**
  - `auth/supabase-jwt.guard.ts` — verifies JWT signature with `SUPABASE_JWT_SECRET`, extracts `sub`, `email`, `email_verified`.
  - `auth/current-user.decorator.ts` — `@CurrentUser()` parameter decorator.
  - `auth/auth.module.ts` — exports guard + decorator.
  - Wrap with `SupabaseAuthService` (per portability seam from v2-backlog).
- **Verify:** `GET /me` returns 401 without `Authorization` header, 200 with a valid Supabase token (`sb-access-token` from the JS client).

### Step 8. Email-verification gate
- **Goal:** Mutations require `email_verified = true`.
- **Build:** `EmailVerifiedGuard` checks `req.user.email_verified`; apply to all mutating profile/skill/contact routes.
- **Verify:** Unverified user gets 403 on POST /profiles; clicking magic link → can create.

---

## Phase 4 — Domain modules

### Step 9. Universities module (read-only)
- **Goal:** Autocomplete endpoint that searches name + aliases.
- **Build:**
  - `universities/universities.module.ts`, `universities.service.ts`, `universities.controller.ts`
  - `GET /universities?q=<query>&country=<iso>&limit=10` — trigram on `name_norm` + array contains on `aliases`, ordered by similarity.
  - `POST /universities/suggest` — authenticated, creates `is_verified = false` row + admin notification.
- **Verify:** `GET /universities?q=mit` returns Massachusetts Institute of Technology. Submitting "Backyard University" creates a pending row, doesn't appear in default autocomplete.

### Step 10. Profiles module — create + read
- **Goal:** Authenticated user can create their own profile and read any public profile.
- **Build:**
  - `profiles/profiles.module.ts`, `profiles.service.ts`, `profiles.controller.ts`
  - DTO with class-validator (or Zod): name, university_id, course, year, bio, optional location/dates
  - `POST /profiles` — calls `allocate_profile_slug()`, inserts with `status = 'active'`, returns full profile
  - `GET /profiles/:slug` — RLS handles visibility; returns 404 if hidden/suspended/deleted (unless owner)
  - `GET /me/profile` — owner's own profile regardless of status
- **Verify:** Create returns 201 with slug; second create from same user returns 409 (partial unique). Public reader can't see hidden profiles.

### Step 11. Profiles module — update + status transitions
- **Goal:** Owner can edit; optimistic lock prevents lost writes; admin status changes log moderation events.
- **Build:**
  - `PATCH /profiles/:id` — body includes `version`; UPDATE uses `WHERE version = $current` then bumps; 409 on mismatch. No moderation log (routine user edit).
  - `PATCH /profiles/:id/status` — owner can flip `hidden ↔ active` (updates `status_changed_at`, no moderation log). Admin (service role) can `suspend`/`unsuspend` with `reason` — these DO write to `moderation_events`.
- **Verify:** Two-tab edit scenario returns 409 on stale version. Admin suspending writes a `moderation_events` row with `action = 'suspend'` and the reason; user toggling hidden does not.

### Step 12. Profiles module — soft delete + restore + purge
- **Goal:** User can soft-delete and restore within window; admin can hard-purge.
- **Build:**
  - `DELETE /profiles/:id` — sets `deleted_at = now()` (no moderation log; user action on own row)
  - `POST /profiles/:id/restore` — clears `deleted_at` if user owns it (no token needed; login is the verification)
  - `DELETE /admin/profiles/:id/purge` — service-role only, calls `purge_profile()`, removes storage objects first
- **Verify:** Soft-deleted profile invisible to public, restorable by owner. Purge cascades; `moderation_events` row with `action = 'purge'` survives; storage files gone.

### Step 13. Skills module
- **Goal:** Autocomplete + skill assignment with profanity filter on new entries.
- **Build:**
  - `skills/skills.module.ts`, autocomplete service, profanity guard (LDNOOBW word list as middleware)
  - `GET /skills?q=<query>&limit=10` — trigram on label, filtered to `moderation_status = 'approved'`, ordered by `usage_count DESC`
  - `POST /profiles/:id/skills` — body: `{ slug, sort_order }`. If slug doesn't exist, create with `moderation_status = 'approved'` (stage 1 default), `created_by = currentUser`. Triggers handle `usage_count` + `skill_slugs`.
  - `DELETE /profiles/:id/skills/:slug` — removes assignment
  - `PATCH /profiles/:id/skills/reorder` — bulk update of `sort_order` in a transaction
- **Verify:** Adding "react" auto-creates if missing; `usage_count` bumps. Profanity ("fuck") returns 422. `profiles.skill_slugs` reflects the change.

### Step 14. Contacts module
- **Goal:** CRUD for `profile_contacts` with exact-duplicate prevention.
- **Build:**
  - `POST /profiles/:id/contacts` — body: `{ kind, value, label?, sort_order? }`. Validates `value` format per `kind` (URL / email / handle). 409 on duplicate (expression unique index catches it).
  - `PATCH /profiles/:id/contacts/:contactId`
  - `DELETE /profiles/:id/contacts/:contactId`
- **Verify:** Adding same LinkedIn URL twice returns 409. Different WhatsApp numbers allowed.

### Step 15. Storage module — photo + CV
- **Goal:** Upload + serve avatar (public) and CV (signed URL).
- **Build:**
  - `storage/storage.module.ts` wraps Supabase Storage via `SupabaseStorageService` interface (portability seam)
  - `POST /profiles/:id/photo` — multipart, validates MIME + size, uploads to `profile-photos/{user_id}/avatar-{epoch}.{ext}`, sets `profiles.photo_key`
  - `DELETE /profiles/:id/photo` — clears `photo_key`, deletes object
  - `POST /profiles/:id/cv` — same shape for PDF only, sets `cv_key` + `cv_name`
  - `GET /profiles/:id/cv/signed` — mints time-limited signed URL (60s)
- **Verify:** Photo loads in browser via public URL. CV download requires hitting `/signed` first. RLS blocks writes to another user's path.

### Step 16. Reports module
- **Goal:** User submits reports; admin processes them.
- **Build:**
  - `POST /reports` — `{ target_type, target_id, reason, details? }`. Anti-flood unique index makes re-report an UPDATE (handle via `ON CONFLICT DO UPDATE`).
  - `GET /admin/reports?status=open` — service-role only, paginated, ordered by oldest first
  - `PATCH /admin/reports/:id` — `{ status: 'resolved' | 'dismissed' }`. If resolved, optionally trigger downstream action (suspend profile, reject skill).
- **Verify:** Submitting twice from same user updates the original row. Admin list shows open reports oldest first. Resolution writes a `moderation_events` row with `action = 'resolve_report'` (or `dismiss_report`).

### Step 17. Feed module
- **Goal:** Public paginated feed with multi-filter recruiter query.
- **Build:**
  - `GET /feed?university_id=&year=&engagement_types=&skill_slugs=&country=&q=&cursor=&limit=20`
  - Keyset pagination on `(created_at, id)` — never OFFSET
  - Filters AND together; `skill_slugs` uses `@>` array contains on `profiles.skill_slugs`
  - `q` uses `search_vector @@ websearch_to_tsquery('english', q)`
  - Response includes `nextCursor` (base64 of `created_at|id`)
- **Verify:** Filtering by `?skill_slugs=react,figma` returns only profiles with BOTH. `EXPLAIN ANALYZE` shows GIN index used. Pagination is stable across new inserts.

### Step 18. Trending / aggregates (lightweight)
- **Goal:** "Top skills" endpoint for autocomplete ranking and homepage chips.
- **Build:** `GET /skills/trending?limit=20` — `SELECT slug, label, usage_count FROM skills WHERE moderation_status = 'approved' ORDER BY usage_count DESC LIMIT 20`. Cache for 5 min in-memory (or skip caching for MVP).
- **Verify:** After adding 50 profiles with React, "react" appears in top trending.

---

## Phase 5 — Cross-cutting

### Step 19. Rate limiting
- **Goal:** `@nestjs/throttler` protects all mutating endpoints + a stricter limit on profile/report creation.
- **Build:**
  - `ThrottlerModule.forRoot({ ttl: 60, limit: 60 })` global default
  - `@Throttle({ default: { limit: 3, ttl: 60 } })` on `POST /profiles`, `POST /reports`
  - `@SkipThrottle()` on `GET /health`
- **Verify:** 4th profile creation in a minute returns 429. Forensic event written to `moderation_events` with `action = 'rate_limited'`.

### Step 20. Moderation log service (cross-cutting)
- **Goal:** Centralized service for writing `moderation_events`, called only from admin/system actions (suspend, purge, reject_skill, merge_skill, resolve_report, dismiss_report, rate_limited).
- **Build:** `moderation/moderation-log.service.ts` with one method `record({ actorId?, targetType, targetId, action, reason?, metadata? })`. Wire into the handlers that perform those specific actions — NOT into routine user-edit endpoints.
- **Verify:** Admin suspends a profile → exactly one `moderation_events` row. User edits their bio → zero `moderation_events` rows (the row's `updated_at` is the audit trail).

### Step 21. Error handling + DTO validation
- **Goal:** Consistent error envelope; validation errors return 422 with field details.
- **Build:**
  - Global `ValidationPipe` with `transform: true, whitelist: true, forbidNonWhitelisted: true`
  - `AllExceptionsFilter` returning `{ success: false, error: { code, message, details? } }`
  - Success responses: `{ success: true, data, meta? }`
- **Verify:** POST with bad body returns 422 + field list. 404 returns `{ success: false, error: { code: 'NOT_FOUND' } }`.

---

## Phase 6 — Quality

### Step 22. E2E test suite
- **Goal:** Golden path covered end-to-end against a real test database.
- **Build:** Supertest (or Playwright API tests) covering:
  1. Anon → signup magic link (mock Supabase Auth) → JWT obtained
  2. Create profile with university + skills + contacts
  3. Upload photo + CV
  4. Public feed shows profile
  5. Filter feed by skill → profile appears
  6. Soft-delete → profile gone from feed
  7. Restore → profile reappears
  8. Submit report → admin resolves
- **Verify:** `npm run test:e2e` green against a clean DB (use Supabase local dev or testcontainers).

### Step 23. RLS policy tests
- **Goal:** Verify the actual policies, not just the API layer.
- **Build:** Tests that connect directly with anon / authenticated / service-role keys and assert SELECT/INSERT/UPDATE/DELETE behaviour matches policy intent.
- **Verify:** Anon cannot SELECT suspended profile. Authenticated user cannot UPDATE another user's profile. Service role bypasses everything.

---

## Phase 7 — Connect

### Step 24. Connect frontend
- Point the Next.js app at the deployed backend URL, swap mock data calls for real `fetch` calls, ship.
