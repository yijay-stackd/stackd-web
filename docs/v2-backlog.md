# Stackd — v2 Backlog

One-line items for features, fixes, and refactors deferred past MVP. Add freely; each item should be self-contained enough to grok in a glance.

## Schema extensions

- [ ] `profile_projects` table — students showcase work (title, description, url, image_key, sort_order, technologies array).
- [ ] `profile_files` — refactor `cv_key` / `cv_name` into 1:N table when adding any second file kind (transcripts, portfolio PDFs, multiple CVs).
- [ ] `outbox_events` — transactional outbox table for BullMQ when async jobs come in (write DB + job intent atomically).
- [ ] `profile_views` — recruiter view tracking for "X recruiters viewed your profile this week" feature.
- [ ] `bookmarks` — recruiter saves a profile to a private list.
- [ ] `endorsements` — peer-confirmed skills (Sarah endorses John for "React").
- [ ] `notifications` — in-app notifications when profile is reported, suspended, viewed, etc.
- [ ] `profile_education_history` — multi-degree students, transfers, alumni status.
- [ ] `universities.email_domains text[]` — for edu-domain whitelist signup verification.
- [ ] `profiles.completeness_score smallint` — trigger-maintained 0-100 score; powers "profile 80% complete" nudges.
- [ ] `skills.embedding vector(1536)` — pgvector column for semantic search and dupe suggestion on write.
- [ ] `universities.embedding vector(1536)` — same, for fuzzy university dedup.
- [ ] `profile_contacts.is_verified boolean` — verify user owns the contact (LinkedIn OAuth, email confirmation).

## Naming / consistency fixes

- [ ] Add `UNIQUE (profile_id, sort_order)` to `profile_contacts` — match `profile_skills` for strict ordering (or accept ties).
- [ ] Cap `profile_contacts` rows per profile (~15 max) via trigger or app guard.
- [ ] Drop `cv_name` if storage key already encodes filename (decide after first month of uploads).

## Moderation (stage 2 — when admin capacity exists)

- [ ] Flip `skills.moderation_status` default from `approved` → `pending` to enable quarantine mode.
- [ ] Build admin UI for skill moderation queue.
- [ ] Build admin UI for `content_reports` queue with bulk actions.
- [ ] Auto-promote skills to `approved` after N (e.g., 5) independent users add the same slug.
- [ ] Auto-flag accounts with 3+ rejected skill creations for admin review.
- [ ] Serial-reporter detection: auto-throttle reporters with >5 dismissed reports.
- [ ] Suspension review queue: surface suspensions older than 7 days for re-review.

## Auth / verification

- [ ] Edu-domain whitelist on signup (only `.edu`, `.ac.uk`, university-specific domains).
- [ ] Manual student verification flow for edge cases (e.g., students at unis without `.edu` domains).
- [ ] 2FA / TOTP support via Supabase Auth MFA.
- [ ] Account merge: same student with multiple email accounts.

## Infrastructure

- [ ] Migrate `@nestjs/throttler` to Redis-backed store when scaling past single instance.
- [ ] Add Redis + BullMQ for async jobs (ESCO ingest, ROR ingest, reconcile, email).
- [ ] ESCO bulk import job — seed ~13.5k skills with `esco_uri` set.
- [ ] ROR bulk import job — seed ~100k universities with aliases.
- [ ] Weekly `skills.usage_count` reconcile job (corrects trigger drift).
- [ ] Soft-delete cleanup job — hard-purge profiles soft-deleted >90 days via `purge_profile()`.
- [ ] `audit_events` archive job — move rows >180 days to cold storage.
- [ ] Partition `audit_events` by month when row count crosses ~10M.
- [ ] Read replica for feed queries (Supabase Pro) once write/read contention shows.

## Performance

- [ ] Materialized view for "trending skills last 7 days" refreshed hourly.
- [ ] pgvector index on skill embeddings for semantic dupe detection on write.
- [ ] Profile feed cursor pagination tuning (verify `(created_at, id)` keyset performs at 100k+ rows).
- [ ] Consider Algolia / Meilisearch / Typesense if Postgres FTS hits relevance/latency ceiling.

## Compliance / privacy

- [ ] GDPR Article 20 data export endpoint (one-click "download my data").
- [ ] PDPA-equivalent for SG / regional jurisdictions.
- [ ] Cookie consent banner.
- [ ] Privacy policy + ToS pages with version history.
- [ ] Retention policy for CV files (auto-purge N days after profile deletion).
- [ ] Admin action audit dashboard (admin-only `audit_events` view).

## Trust & safety

- [ ] Image moderation API for uploaded photos (AWS Rekognition / Sightengine).
- [ ] Virus scan for uploaded CVs before serving.
- [ ] Reverse-image search to detect stolen profile photos.
- [ ] Rate limit profile creation per IP / device fingerprint.

## UX / product

- [ ] Linktree-style public profile view emphasizing multi-contact section.
- [ ] Profile completion meter widget on dashboard.
- [ ] Skill autocomplete "did you mean React?" when typing close to existing canonical.
- [ ] University autocomplete with country filter.
- [ ] Recruiter saved searches with email digest.
- [ ] Multi-skill AND-filter UI on recruiter feed.
- [ ] Profile sharing helpers (QR code, OG image generation, copy-link with UTM).
- [ ] Drag-to-reorder UI for skills and contacts.
- [ ] Mobile-first responsive review (currently desktop-centric).

## Technical debt

- [ ] Wrap Supabase auth in `SupabaseAuthService` interface (portability seam).
- [ ] Wrap Supabase storage in `SupabaseStorageService` interface (portability seam).
- [ ] Implement `universities.name_norm` as a true `GENERATED ALWAYS AS (lower(name)) STORED` column.
- [ ] Implement slug allocation as SECURITY DEFINER function with retry-on-conflict.
- [ ] Add `moddatetime` extension and triggers for `updated_at` on all relevant tables.
- [ ] Write RLS policies for all tables (currently documented but not implemented).
- [ ] Document the `purge_profile()` function with full cascade semantics.

## Testing

- [ ] E2E test suite with Playwright covering: signup → create profile → publish → search → contact.
- [ ] RLS policy tests (PostgREST anonymous user must not see suspended/deleted profiles).
- [ ] Load test recruiter filter queries with 10k synthetic profiles.
- [ ] Snapshot test the trigger that maintains `profiles.skill_slugs`.
- [ ] Property-based tests for slug normalization (kebab-case, punctuation stripping).

## Open questions / decisions to revisit

- [ ] When to flip skills from free-form to quarantine (stage 1 → stage 2 trigger criteria).
- [ ] Whether to enforce one-CV-per-profile or allow multiple (decides `profile_files` shape).
- [ ] Whether to keep `cv_name` column or fold into storage key.
- [ ] Whether to commit to `i18n` (`label_i18n jsonb`) before non-English universities arrive.
- [ ] Whether to model students differently from working professionals if Stackd expands beyond students.
