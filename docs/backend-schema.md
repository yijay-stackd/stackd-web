# Stackd — Backend Schema

Stack: **NestJS + Prisma + Supabase (Postgres + Auth + Storage)**.
Auth users live in `auth.users` (managed by Supabase). Everything below is in the `public` schema, joined by `user_id`.

> Conventions: `snake_case` columns, plural table names, all timestamps `timestamptz`, all PKs `uuid` (`gen_random_uuid()`) except audit (`bigserial`), all enums versioned via `ALTER TYPE ... ADD VALUE`.

This document mirrors [`docs/db-diagram.dbml`](./db-diagram.dbml) with the SQL specifics DBML can't model (CHECK constraints, triggers, RLS policies, functions, storage rules). Backlog for v2 features lives in [`docs/v2-backlog.md`](./v2-backlog.md).

---

## Design principles

1. **Single source of truth** — no column duplicates data living in another table. `auth.users.email` is the login email; contact email lives in `profile_contacts` (intentionally separate per product spec).
2. **Storage keys, not URLs** — `photo_key` and `cv_key` store Supabase Storage object keys; URLs are computed by the API. Swap CDN / bucket without migrating data.
3. **Real types for real queries** — availability is `date`, country is `char(2)` ISO, skills are a normalized dictionary. If you can't `ORDER BY` / `WHERE … BETWEEN` / `JOIN` on a value, it's the wrong type.
4. **Arrays for fixed-cardinality sets, join tables for unbounded sets** — `engagement_types` is an enum array (5 values, fixed). `skills` is a join table (unbounded, needs canonicalization + usage counts + moderation).
5. **Denormalize for hot reads** — `profiles.skill_slugs` is a trigger-maintained projection of `profile_skills` for the recruiter AND-filter query.
6. **Soft delete must not poison uniqueness** — `slug` and `user_id` use partial unique indexes scoped to live rows.
7. **Status is a state machine, not a boolean** — `profile_status_enum { active | hidden | suspended }` because admin actions ≠ user actions.
8. **Don't reinvent the wheel** — universities seeded from [ROR](https://ror.org), skills seeded from [ESCO](https://esco.ec.europa.eu) when curation matters.
9. **Audit only what can't be reconstructed** — `moderation_events` logs admin/system actions (suspend, purge, reject, rate-limit). Routine user edits rely on `created_at` / `updated_at` / `status_changed_at` on the row itself.
10. **Rate limiting in middleware** — `@nestjs/throttler` (in-memory MVP, Redis later). Postgres is not a counter store.

---

## 1. Entities

| Table | Purpose |
|---|---|
| `profiles` | One row per public student profile (1:1 live with `auth.users`) |
| `skills` | ESCO-aware skill dictionary with alias merging + moderation |
| `profile_skills` | M:N profile ↔ skill with user-defined sort order |
| `profile_contacts` | 1:N contact methods (LinkedIn, Instagram, WhatsApp, …) |
| `universities` | ROR-seeded institution dim with multilingual aliases |
| `content_reports` | Community moderation: profile/skill reports awaiting admin review |
| `moderation_events` | Append-only log of admin/system actions only (NOT routine user edits) |

External: `auth.users` (Supabase).
Not a table: `engagement_types` is an enum array on `profiles`.

---

## 2. Extensions + enums

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS moddatetime;  -- for updated_at auto-bump
CREATE EXTENSION IF NOT EXISTS pg_cron;       -- Supabase add-on; optional

-- Demographics
CREATE TYPE year_enum AS ENUM ('1st','2nd','3rd','4th','Masters','PhD');

-- Engagement / availability
CREATE TYPE engagement_type_enum AS ENUM (
  'internships','full_time','part_time','freelance','research'
);

-- Profile lifecycle
CREATE TYPE profile_status_enum AS ENUM ('active','hidden','suspended');

-- Skill moderation
CREATE TYPE skill_moderation_enum AS ENUM ('approved','pending','rejected');

-- Contacts (open-ended, add values via ALTER TYPE as platforms emerge)
CREATE TYPE contact_kind_enum AS ENUM (
  'linkedin','email','portfolio','instagram','whatsapp',
  'wechat','telegram','github','twitter','website','other'
);

-- Reports
CREATE TYPE report_target_type_enum AS ENUM ('profile','skill');
CREATE TYPE report_reason_enum      AS ENUM ('inappropriate','spam','fake','harassment','copyright','other');
CREATE TYPE report_status_enum      AS ENUM ('open','resolved','dismissed');

-- Moderation log uses plain text for target_type and action (open-ended,
-- add freely without ALTER TYPE migrations). Scope is intentionally narrow
-- to admin/system events — see section 8.
```

> Adding an enum value is `ALTER TYPE … ADD VALUE` — fast and non-locking on modern Postgres. Removing one requires migration. Pick conservatively.

---

## 3. `profiles`

```sql
CREATE TABLE profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity (no email column: pull from auth.users)
  slug                citext   NOT NULL,
  name                text     NOT NULL,
  photo_key           text,                              -- "<user_id>/avatar-<epoch>.<ext>"
  avatar_color_seed   smallint NOT NULL DEFAULT 0,       -- fallback color index when photo_key is null

  -- Academic
  university_id       uuid     NOT NULL REFERENCES universities(id) ON DELETE RESTRICT,
  course              text     NOT NULL,
  year                year_enum NOT NULL,

  -- Location (structured — no free-text "Singapore (remote ok)" mess)
  country_code        char(2),                           -- ISO 3166-1 alpha-2
  city                text,
  is_remote_ok        boolean  NOT NULL DEFAULT false,

  -- Pitch
  bio                 varchar(100) NOT NULL,
  engagement_types    engagement_type_enum[] NOT NULL DEFAULT '{}',

  -- Availability (NULL from = "Now", NULL to = "Ongoing")
  available_from      date,
  available_to        date,

  -- CV
  cv_key              text,
  cv_name             text,

  -- Read-optimized skill projection (trigger-maintained)
  skill_slugs         citext[] NOT NULL DEFAULT '{}',

  -- State
  status              profile_status_enum NOT NULL DEFAULT 'active',
  status_reason       text,                              -- admin-supplied when suspended
  status_changed_at   timestamptz NOT NULL DEFAULT now(),
  search_vector       tsvector,
  version             integer  NOT NULL DEFAULT 1,       -- optimistic lock
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,                       -- orthogonal to status

  -- Integrity
  CONSTRAINT name_not_blank        CHECK (length(btrim(name)) > 0),
  CONSTRAINT bio_not_blank         CHECK (length(btrim(bio))  > 0),
  CONSTRAINT slug_format           CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 60),
  CONSTRAINT avatar_color_range    CHECK (avatar_color_seed BETWEEN 0 AND 31),
  CONSTRAINT engagement_size       CHECK (cardinality(engagement_types) <= 5),
  CONSTRAINT engagement_unique     CHECK (cardinality(engagement_types) = cardinality(array(SELECT DISTINCT unnest(engagement_types)))),
  CONSTRAINT skill_slugs_size      CHECK (cardinality(skill_slugs) <= 6),
  CONSTRAINT country_code_format   CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT availability_order    CHECK (available_from IS NULL OR available_to IS NULL OR available_from <= available_to),
  CONSTRAINT cv_paired             CHECK ((cv_key IS NULL AND cv_name IS NULL) OR (cv_key IS NOT NULL AND cv_name IS NOT NULL)),
  CONSTRAINT suspension_has_reason CHECK (status <> 'suspended' OR status_reason IS NOT NULL)
);
```

### Why these choices

| Decision | Rationale |
|---|---|
| **No `email` column** | `auth.users.email` is login source-of-truth. Public contact email lives in `profile_contacts` (intentionally distinct — students log in with school email, post personal). |
| **`university_id` required (no text fallback)** | ROR-seeded autocomplete is the only entry path. New universities → moderation queue. Drops the dual-write problem entirely. |
| **Structured location** | `country` + `city` + `is_remote_ok` enables real filtering. Free-text fragmented immediately ("SG"/"Singapore"/"Singapore (remote ok)"). |
| **`engagement_types engagement_type_enum[]`** | Fixed 5-value set, max 5 per user, GIN-indexable for `WHERE 'internships' = ANY(engagement_types)`. Join table would be overkill. |
| **`bio varchar(100)`** | Matches frontend `BIO_LIMIT`. Frontend is the contract. |
| **`skill_slugs citext[]`** | Trigger-maintained denorm of `profile_skills` filtered by `moderation_status = 'approved'`. Powers the AND-filter recruiter query (~10× faster than double-join). |
| **`status` enum, not boolean** | `suspended` ≠ `hidden`. A user can't un-suspend themselves; a boolean would let them. Adding new states is `ALTER TYPE`. |
| **`version` column** | Optimistic locking. UPDATE WHERE version = $current AND bump. Two-tab edits don't silently overwrite. |
| **`status_changed_at`** | Powers admin queue ("suspensions older than 7d for re-review") and UX nudges ("hidden for 30d — still want it private?") without scanning moderation_events. |

### Indexes on `profiles`

```sql
-- Identity lookups (partial: only live rows can claim the slug/user)
CREATE UNIQUE INDEX profiles_slug_live_idx     ON profiles(slug)    WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX profiles_user_id_live_idx  ON profiles(user_id) WHERE deleted_at IS NULL;

-- Feed: newest-first, only active live profiles
CREATE INDEX profiles_feed_idx
  ON profiles(created_at DESC, id DESC)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Admin dashboard (filter by suspended/hidden)
CREATE INDEX profiles_status_idx ON profiles(status);

-- Faceted filters
CREATE INDEX profiles_university_feed_idx
  ON profiles(university_id, created_at DESC)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX profiles_year_feed_idx
  ON profiles(year, created_at DESC)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX profiles_available_idx
  ON profiles(available_from, available_to)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Full-text search
CREATE INDEX profiles_search_idx
  ON profiles USING GIN (search_vector)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Array membership (engagement type AND-filter is rare; OR-filter common)
CREATE INDEX profiles_engagement_idx
  ON profiles USING GIN (engagement_types)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Recruiter AND-filter: "knows React AND Figma AND Python"
CREATE INDEX profiles_skills_idx
  ON profiles USING GIN (skill_slugs)
  WHERE status = 'active' AND deleted_at IS NULL;
```

### `search_vector` trigger

```sql
CREATE FUNCTION profiles_update_search_vector() RETURNS trigger AS $$
DECLARE
  uni_name text;
BEGIN
  SELECT name INTO uni_name FROM universities WHERE id = NEW.university_id;
  NEW.search_vector :=
       setweight(to_tsvector('simple',  coalesce(NEW.name,'')),    'A')
    || setweight(to_tsvector('simple',  coalesce(NEW.course,'')),  'B')
    || setweight(to_tsvector('simple',  coalesce(uni_name,'')),    'B')
    || setweight(to_tsvector('english', coalesce(NEW.bio,'')),     'C');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_search_vector_tg
  BEFORE INSERT OR UPDATE OF name, course, university_id, bio
  ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_update_search_vector();
```

### `updated_at` auto-bump

```sql
CREATE TRIGGER profiles_moddatetime_tg
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
```

> Apply the same `moddatetime` trigger to any other mutable table where you want `updated_at` to track changes (currently only `profiles` has it; add as needed).

---

## 4. `skills` + `profile_skills`

### Why join table for skills vs array for engagement types?

| Dimension | `engagement_types` | `skills` |
|---|---|---|
| Value set | Fixed enum (5 values) | Unbounded (ESCO ~13.5k + user-created) |
| Max per profile | 5 | 6 |
| Canonical label needed | No | Yes (`react` ↔ `React`) |
| Aliases / merges | No | Yes (`reactjs` → `react`) |
| Moderation needed | No | Yes (stage 2) |
| Provenance tracking | No | Yes (ESCO vs user-created) |
| Usage analytics | No | Yes (trending, autocomplete ranking) |

Skills earn their dictionary; engagement types don't.

### Tables

```sql
CREATE TABLE skills (
  slug              citext PRIMARY KEY,
  label             text NOT NULL,
  canonical_slug    citext REFERENCES skills(slug) ON DELETE SET NULL,
  esco_uri          text,                              -- NULL → user-created
  category          text,                              -- ESCO category, optional
  moderation_status skill_moderation_enum NOT NULL DEFAULT 'approved',
  usage_count       integer NOT NULL DEFAULT 0,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slug_format     CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 1 AND 60),
  CONSTRAINT label_format    CHECK (length(btrim(label)) BETWEEN 1 AND 60),
  CONSTRAINT usage_nonneg    CHECK (usage_count >= 0),
  CONSTRAINT no_self_alias   CHECK (canonical_slug IS NULL OR canonical_slug <> slug)
);

CREATE INDEX skills_usage_idx       ON skills(usage_count DESC, slug)            WHERE moderation_status = 'approved';
CREATE INDEX skills_alias_idx       ON skills(canonical_slug)                    WHERE canonical_slug IS NOT NULL;
CREATE INDEX skills_label_trgm_idx  ON skills USING GIN (label gin_trgm_ops)     WHERE moderation_status = 'approved';
CREATE INDEX skills_moderation_idx  ON skills(moderation_status);

CREATE TABLE profile_skills (
  profile_id uuid     NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_slug citext   NOT NULL REFERENCES skills(slug)  ON DELETE RESTRICT,
  sort_order smallint NOT NULL,
  PRIMARY KEY (profile_id, skill_slug),
  CONSTRAINT sort_order_unique_per_profile UNIQUE (profile_id, sort_order),
  CONSTRAINT sort_order_range CHECK (sort_order BETWEEN 0 AND 5)
);

CREATE INDEX profile_skills_skill_idx ON profile_skills(skill_slug);
```

### `usage_count` + `skill_slugs` denorm trigger

Single trigger maintains two derived columns. Filters by `moderation_status = 'approved'` so pending/rejected skills never reach the recruiter filter.

```sql
CREATE FUNCTION profile_skills_after_change() RETURNS trigger AS $$
DECLARE
  target_profile uuid;
  target_slug    citext;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target_profile := NEW.profile_id;
    target_slug    := NEW.skill_slug;
    UPDATE skills SET usage_count = usage_count + 1 WHERE slug = target_slug;
  ELSE
    target_profile := OLD.profile_id;
    target_slug    := OLD.skill_slug;
    UPDATE skills SET usage_count = GREATEST(0, usage_count - 1) WHERE slug = target_slug;
  END IF;

  -- Rebuild approved-only projection
  UPDATE profiles SET skill_slugs = (
    SELECT COALESCE(array_agg(ps.skill_slug ORDER BY ps.sort_order), '{}')
    FROM profile_skills ps
    JOIN skills s ON s.slug = ps.skill_slug
    WHERE ps.profile_id = target_profile
      AND s.moderation_status = 'approved'
  )
  WHERE id = target_profile;

  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER profile_skills_change_tg
  AFTER INSERT OR DELETE ON profile_skills
  FOR EACH ROW EXECUTE FUNCTION profile_skills_after_change();
```

### Skill rejection cascade

When admin sets `skills.moderation_status = 'rejected'`, trigger removes all assignments + rebuilds affected `skill_slugs` arrays + writes one audit event.

```sql
CREATE FUNCTION skills_after_reject() RETURNS trigger AS $$
DECLARE
  affected_count int;
BEGIN
  IF NEW.moderation_status = 'rejected' AND OLD.moderation_status <> 'rejected' THEN
    WITH deleted AS (
      DELETE FROM profile_skills WHERE skill_slug = NEW.slug RETURNING profile_id
    )
    SELECT COUNT(DISTINCT profile_id) INTO affected_count FROM deleted;

    INSERT INTO moderation_events (target_type, target_id, action, metadata)
    VALUES ('skill', NEW.slug::text, 'reject_skill',
            jsonb_build_object('affected_profile_count', affected_count));
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER skills_reject_tg
  AFTER UPDATE OF moderation_status ON skills
  FOR EACH ROW EXECUTE FUNCTION skills_after_reject();
```

Weekly reconcile (`recompute-skill-usage`) re-derives `usage_count` from `profile_skills` as drift insurance.

---

## 5. `profile_contacts`

```sql
CREATE TABLE profile_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind        contact_kind_enum NOT NULL,
  value       text NOT NULL,
  label       text,
  sort_order  smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT value_not_blank CHECK (length(btrim(value)) > 0),
  CONSTRAINT label_length    CHECK (label IS NULL OR length(label) <= 40)
);

CREATE INDEX profile_contacts_order_idx ON profile_contacts(profile_id, sort_order);
CREATE INDEX profile_contacts_kind_idx  ON profile_contacts(profile_id, kind);

-- Case-insensitive dedup (can't model in DBML)
CREATE UNIQUE INDEX profile_contacts_dedup_idx
  ON profile_contacts(profile_id, kind, lower(value));
```

> No `UNIQUE (profile_id, kind)` — students legitimately have two emails (school + personal display), two WhatsApp numbers (dual citizenship), etc. The dedup index prevents *exact* duplicates only.
>
> `value` format is validated in the app layer per `kind` (URL for linkedin/portfolio/website, email regex for email, handle/phone for messaging apps).

---

## 6. `universities`

```sql
CREATE TABLE universities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ror_id       text UNIQUE,                            -- NULL for admin-added
  name         text NOT NULL,
  name_norm    citext NOT NULL UNIQUE GENERATED ALWAYS AS (lower(name)) STORED,
  aliases      text[] NOT NULL DEFAULT '{}',
  country      char(2),                                 -- ISO 3166-1 alpha-2
  is_verified  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT name_not_blank      CHECK (length(btrim(name)) > 0),
  CONSTRAINT country_format      CHECK (country IS NULL OR country ~ '^[A-Z]{2}$')
);

CREATE INDEX universities_name_trgm_idx     ON universities USING GIN (name_norm gin_trgm_ops);
CREATE INDEX universities_aliases_trgm_idx  ON universities USING GIN (aliases);
```

Seeded post-deploy from the [ROR data dump](https://ror.readme.io/docs/data-dump) (~100k institutions with multilingual aliases). Profile creation autocomplete matches against `name_norm` OR any element of `aliases`. User-submitted entries go to admin queue with `is_verified = false`.

---

## 7. `content_reports`

```sql
CREATE TABLE content_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type  report_target_type_enum NOT NULL,
  target_id    text NOT NULL,                          -- uuid for profile, citext for skill slug
  reason       report_reason_enum NOT NULL,
  details      text,
  status       report_status_enum NOT NULL DEFAULT 'open',
  resolved_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT details_length     CHECK (details IS NULL OR length(details) <= 500),
  CONSTRAINT resolved_paired    CHECK ((status IN ('resolved','dismissed')) = (resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);

-- Anti-flood: each reporter can report each target once
CREATE UNIQUE INDEX reports_one_per_reporter_idx ON content_reports(reporter_id, target_type, target_id);

CREATE INDEX reports_open_queue_idx ON content_reports(status, created_at) WHERE status = 'open';
CREATE INDEX reports_target_idx     ON content_reports(target_type, target_id);
CREATE INDEX reports_reporter_idx   ON content_reports(reporter_id, created_at);
```

> Re-report = `UPDATE existing row` (bump `reason` / `details`), not new INSERT. Middleware rate-limits report creation per reporter (e.g., 10/day).

---

## 8. `moderation_events`

Scope: **admin and system actions only**. Routine user edits (profile updates, skill add/remove, contact changes) are NOT logged here — the row's own `created_at` / `updated_at` / `status_changed_at` already capture them. Audit table earns its keep only for things you can't reconstruct from current row state.

```sql
CREATE TABLE moderation_events (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type text NOT NULL,                            -- 'profile' | 'skill' | 'report' | 'auth'
  target_id   text NOT NULL,                            -- uuid / citext slug / email / ip
  action      text NOT NULL,                            -- see allowlist below
  reason      text,                                     -- admin rationale (null for system actions)
  metadata    jsonb,                                    -- ip, user_agent, request_id, affected_count, ...
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_known CHECK (action IN (
    'suspend','unsuspend','purge',
    'reject_skill','merge_skill',
    'resolve_report','dismiss_report',
    'rate_limited'
  )),
  CONSTRAINT target_type_known CHECK (target_type IN ('profile','skill','report','auth'))
);

CREATE INDEX moderation_events_target_idx ON moderation_events(target_type, target_id, created_at);
CREATE INDEX moderation_events_actor_idx  ON moderation_events(actor_id, created_at);
CREATE INDEX moderation_events_action_idx ON moderation_events(action, created_at);
```

`target_id` is polymorphic `text` with no FK — survives hard deletes of the target (required for GDPR purge proof).

### Example rows

```jsonc
// Admin suspended a profile
{ actor_id: <admin>, target_type: "profile", target_id: "<uuid>",
  action: "suspend", reason: "Fake university affiliation; cross-checked with .edu list",
  metadata: { "ip": "1.2.3.4", "request_id": "..." } }

// Admin rejected a skill (trigger writes this automatically)
{ actor_id: <admin>, target_type: "skill", target_id: "good-in-bed",
  action: "reject_skill", reason: "Inappropriate; profanity filter miss",
  metadata: { "affected_profile_count": 3 } }

// Rate limit hit (system event, no actor)
{ actor_id: null, target_type: "auth", target_id: "user@example.com",
  action: "rate_limited", reason: null,
  metadata: { "event": "magic_link", "ip": "...", "attempts_in_window": 6 } }
```

> Partition by `created_at` monthly when row count crosses ~10M. Volume should be low (admin actions are rare) so partitioning is far in the future. See v2-backlog.

---

## 9. Functions

### `purge_profile()` — GDPR / right-to-erasure hard delete

```sql
CREATE FUNCTION purge_profile(p_profile_id uuid, p_actor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile % not found', p_profile_id;
  END IF;

  -- Storage cleanup is the API's job (call before this function):
  --   await storage.from('profile-photos').remove([photo_key])
  --   await storage.from('profile-cvs').remove([cv_key])

  -- Cascade removes profile_skills, profile_contacts via FK
  DELETE FROM profiles WHERE id = p_profile_id;

  -- Single moderation event (target survives hard delete via polymorphic id)
  INSERT INTO moderation_events (actor_id, target_type, target_id, action, metadata)
  VALUES (p_actor_id, 'profile', p_profile_id::text, 'purge',
          jsonb_build_object('user_id', v_user_id));
END $$;
```

### `allocate_profile_slug()` — race-safe slug creation

```sql
CREATE FUNCTION allocate_profile_slug(p_base citext) RETURNS citext
LANGUAGE plpgsql
AS $$
DECLARE
  v_slug    citext := p_base;
  v_suffix  int := 1;
BEGIN
  LOOP
    -- Partial unique index treats soft-deleted as free
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE slug = v_slug AND deleted_at IS NULL) THEN
      RETURN v_slug;
    END IF;
    v_suffix := v_suffix + 1;
    v_slug := p_base || '-' || v_suffix;
    EXIT WHEN v_suffix > 1000;  -- bail on pathological cases
  END LOOP;
  RAISE EXCEPTION 'unable to allocate slug from base %', p_base;
END $$;
```

Call from the create-profile transaction; the partial unique index is the final guard against races.

---

## 10. Supabase Storage buckets

| Bucket | Visibility | Path | Limits |
|---|---|---|---|
| `profile-photos` | Public | `{user_id}/avatar-{epoch}.{ext}` | ≤ 2 MB; `image/png \| image/jpeg \| image/webp` |
| `profile-cvs`    | Private | `{user_id}/cv-{epoch}.pdf`      | ≤ 8 MB; `application/pdf` only |

### Storage RLS

```sql
-- Writes scoped to user's prefix (both buckets)
CREATE POLICY storage_owner_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY storage_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY storage_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (auth.uid()::text = (storage.foldername(name))[1]);

-- profile-photos: public read
CREATE POLICY photos_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-photos');

-- profile-cvs: no client read — always via NestJS-minted signed URL
```

> Object keys include a timestamp suffix so re-uploads don't collide with cached CDN copies.

---

## 11. RLS on `public.*`

NestJS uses the service-role key (bypasses RLS), but policies provide defense-in-depth and let any future direct-from-client reads stay safe.

```sql
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_skills   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills           ENABLE ROW LEVEL SECURITY;
ALTER TABLE universities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_events ENABLE ROW LEVEL SECURITY;

-- profiles: public sees active+live; owner sees own (including hidden/deleted for restore)
CREATE POLICY profiles_public_read ON profiles
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY profiles_owner_read ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY profiles_owner_write ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY profiles_owner_update ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- profile_skills: visible if parent profile is visible; writable by owner
CREATE POLICY profile_skills_public_read ON profile_skills
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p
            WHERE p.id = profile_skills.profile_id
              AND p.status = 'active' AND p.deleted_at IS NULL)
  );

CREATE POLICY profile_skills_owner ON profile_skills
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p
            WHERE p.id = profile_skills.profile_id AND p.user_id = auth.uid())
  );

-- profile_contacts: same pattern
CREATE POLICY profile_contacts_public_read ON profile_contacts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p
            WHERE p.id = profile_contacts.profile_id
              AND p.status = 'active' AND p.deleted_at IS NULL)
  );

CREATE POLICY profile_contacts_owner ON profile_contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p
            WHERE p.id = profile_contacts.profile_id AND p.user_id = auth.uid())
  );

-- skills: approved entries readable by all; writes via service role only
CREATE POLICY skills_public_read ON skills
  FOR SELECT USING (moderation_status = 'approved');

-- universities: verified entries readable by all
CREATE POLICY universities_public_read ON universities
  FOR SELECT USING (is_verified = true);

-- content_reports: reporters see their own; admins via service role
CREATE POLICY reports_reporter_read ON content_reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY reports_create ON content_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- moderation_events: service role only (no client policy — deny by default)
```

> The `profiles` table has no DELETE policy for owners — the API soft-deletes via `UPDATE deleted_at = now()`. Hard delete only via `purge_profile()` called by service role.

---

## 12. Field ↔ frontend mapping

| Frontend field | DB source |
|---|---|
| `slug` | `profiles.slug` |
| `name` | `profiles.name` |
| `photo` | `profiles.photo_key` → mapper builds public URL |
| `avatarColor` | `PHOTO_COLORS[profiles.avatar_color_seed]` |
| `university` | `universities.name` via `profiles.university_id` |
| `course` | `profiles.course` |
| `year` | `profiles.year` |
| `location` | `{ country: country_code, city, isRemoteOk: is_remote_ok }` |
| `bio` | `profiles.bio` |
| `engagementTypes[]` | `profiles.engagement_types` |
| `availability.from` | `profiles.available_from` (NULL → `"Now"`) |
| `availability.to`   | `profiles.available_to`   (NULL → `"Ongoing"`) |
| `skills[]` | `skills.label` via `profile_skills`, ordered by `sort_order` |
| `contacts[]` | `profile_contacts` rows ordered by `sort_order` |
| `cvName` | `profiles.cv_name` |
| `cvUrl` | signed URL from `profiles.cv_key` (per-request) |
| `status` | `profiles.status` |
| `addedAt` | `profiles.created_at` |
| `updatedAt` | `profiles.updated_at` |
| `loginEmail` | `auth.users.email` (joined; never duplicated) |

---

## 13. Migration order

1. Extensions
2. Enum types (all of section 2)
3. `universities` (table → indexes — needed by `profiles.university_id` FK)
4. `skills` (table → indexes — self-ref FK on `canonical_slug`)
5. `profiles` (table → CHECKs → indexes → search_vector trigger → moddatetime trigger)
6. `profile_skills` (table → indexes → after_change trigger)
7. `profile_contacts` (table → indexes including expression dedup)
8. `content_reports` (table → indexes)
9. `moderation_events` (table → indexes)
10. Functions (`purge_profile`, `allocate_profile_slug`)
11. Skill rejection trigger on `skills` (depends on `moderation_events`)
12. RLS policies on `public.*`
13. Storage buckets + storage RLS
14. **Post-deploy:** seed `universities` from ROR dump; ESCO seed for `skills` deferred to v2 per backlog.

Prisma handles 3–9 via migrations. Triggers, RLS, functions, and storage policies live in raw SQL migrations applied by the Supabase CLI or `prisma migrate` with raw `-- @sql` blocks.

---

## 14. Deferred work

All v2 features, schema extensions, and infrastructure work tracked in [`docs/v2-backlog.md`](./v2-backlog.md). Highlights that touch this document when promoted:

- `profile_files` extraction (replaces `cv_key`/`cv_name`)
- `profile_projects` table
- ESCO skill seed + admin moderation UI
- `outbox_events` for BullMQ
- `moderation_events` monthly partitioning
- pgvector embeddings on skills + universities
- Edu-domain whitelist on signup
