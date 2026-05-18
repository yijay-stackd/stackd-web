# stackd-web — Handoff doc

For picking up where the previous session left off. Self-contained: read this
before touching code, and you should be able to start without re-reading the
whole repo.

---

## TL;DR

stackd-web is the frontend for **stackd** — a "students put themselves on the
map; companies browse and reach out directly" app. The backend is a separate
NestJS service (`../stackd-backend`). The frontend is a Next.js 16 app talking
to that backend over CORS + Supabase JWT.

Architecture is **SPA-style + TanStack Query**, modeled on the patterns in
[`hata_web_fronted`](../hata_web_fronted) (a known prod-grade Vue/Vite SPA).
Auth = Supabase magic-link OTP; backend verifies the JWT.

**Status:** core flows wired end-to-end (login, join, feed, profile read/edit,
photo + CV upload, skills, contacts). Latent issues are tracked at the bottom
of this doc.

---

## Tech + versions

- Next.js **16.2.6** — App Router. **Note**: `middleware.ts` was renamed to
  `proxy.ts` in v16. Our root [`proxy.ts`](../proxy.ts) refreshes the Supabase
  session per request.
- React **19.2**
- TypeScript strict
- TailwindCSS v4
- TanStack Query v5 — server state, mutations, cache
- `@supabase/ssr` 0.10 — uses the modern `getAll`/`setAll` cookie API (NOT
  the deprecated `get`/`set`/`remove`)
- Backend on `http://localhost:3001` (NestJS, separate repo)

---

## Run + verify (60 seconds)

```bash
# .env.local must have these (all NEXT_PUBLIC_ prefix — required for browser access)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Start backend separately
cd ../stackd-backend && npm run start:dev

# Start frontend
npm run dev                 # → http://localhost:3000
npx tsc --noEmit           # must be clean
npm run lint               # only cosmetic Tailwind warnings allowed
```

Then hit `/` (feed) and `/login` — both should render. Feed pulls real data
from backend `/feed`.

---

## Architecture — the 5-layer onion

```
┌────────────────────────────────────────────────┐
│  1. UI component                  *.tsx        │  "what user sees"
├────────────────────────────────────────────────┤
│  2. Feature composable      features/*/use-*  │  form state machine
├────────────────────────────────────────────────┤
│  3. Hook (TanStack Query)   features/*/use-*  │  cache, retry, dedup
├────────────────────────────────────────────────┤
│  4. API resource module     lib/api/*.ts      │  typed endpoints
├────────────────────────────────────────────────┤
│  5. HTTP transport          lib/http/*.ts     │  fetch, auth, retry
└────────────────────────────────────────────────┘
```

**Rule:** every layer talks only to the one directly beneath it. If layer 1
imports from `lib/api/`, that's a leak.

### Folder map

```
app/                          Next 16 routes (App Router)
  layout.tsx                  Root: QueryProvider + AuthProvider + Nav
  (main)/                     Authed shell route group
    (home)/page.tsx
    join/page.tsx
    login/page.tsx
    profile/[slug]/page.tsx
    profile/me/page.tsx       Redirect-only: → /profile/:slug or /join
    profile/me/edit/page.tsx

proxy.ts                      Next 16 proxy (renamed middleware) — refreshes
                              Supabase session cookie per request

lib/
  env.ts                      Lazy typed env getters (throw at use-site)
  http/
    fetcher.ts                Isomorphic fetch: retry+backoff+jitter, GET
                              dedup, 401→refresh→retry, X-Request-ID, timeout
    client.ts  ("use client") Browser instance: bearer from Supabase session
    server.ts  (server-only)  Server instance: bearer from cookies
    types.ts, errors.ts, log.ts
  supabase/
    browser.ts                createBrowserClient (lazy singleton)
    server.ts                 createServerClient (per-request)
    proxy.ts                  session-refresh helper for proxy.ts
  api/                        Resource modules — typed wrappers, take Http
    auth.ts  (currently unused, deleted in cleanup pass)
    profiles.ts               CRUD + feed
    universities.ts           Autocomplete + suggest
    skills.ts                 Search + assign/remove
    profile-files.ts          Photo + CV upload, signed-URL
    profile-contacts.ts       Contact CRUD
    profile-mapper.ts         backend ProfileResponse ⇌ legacy Student shape
  query/
    client.ts                 QueryClient factory + default options

features/                     Domain-grouped (matches hata's pattern)
  auth/
    auth-provider.tsx         Supabase session + email-required policy
    use-login-form.ts         OTP state machine
    login-form.tsx, join-gate.tsx, profile-exists.tsx
  feed/
    use-feed.ts               useInfiniteQuery against /feed
    feed.tsx, student-row.tsx, ...
  join/
    join-form.tsx             Chains: create → uploads + skills + contact
    photo-upload.tsx, cv-upload.tsx, tag-input.tsx, ...
  profile/
    use-my-profile.ts         GET /me/profile
    use-profile-by-slug.ts    GET /profiles/:slug
    use-profile-mutations.ts  create/update/updateStatus/delete
    use-profile-files.ts      photo + CV uploads, signed CV URL
    use-skills.ts             search + assign + remove
    use-contacts.ts           create + update + delete
    profile-detail.tsx, edit-profile-form.tsx, ...

components/                   Shared (used by 2+ features)
  forms/                      StudentForm, UniversityAutocomplete,
                              use-university-search.ts
  layout/                     Nav
  ui/                         Modal, Toast
  providers/                  QueryProvider

utils/                        Pure helpers (no React)
  student.ts                  statusLabel, formatContact, etc.
  use-debounced-value.ts
  availability.ts, relative-time.ts

types/                        Shared TypeScript types
  student.ts, index.ts

constants/                    Static value sets
  student-options.ts
```

---

## Conventions when adding a new feature

### 1. New backend resource → new `lib/api/<resource>.ts`

```ts
// lib/api/<resource>.ts
import type { Http } from "../http/fetcher";

export type FooResponse = { id: string; name: string; ... };
export type CreateFooInput = { ... };

export const fooApi = {
  list(http: Http): Promise<FooResponse[]> {
    return http.get<FooResponse[]>("/foos");
  },
  create(http: Http, body: CreateFooInput): Promise<FooResponse> {
    return http.post<FooResponse>("/foos", body, { skipRetry: true });
  },
};

export const fooKeys = {
  all: ["foos"] as const,
  list: () => [...fooKeys.all, "list"] as const,
  byId: (id: string) => [...fooKeys.all, "by-id", id] as const,
};
```

**Notes:**
- Mutations always pass `{ skipRetry: true }` — they aren't safe to re-fire blindly
- Query keys live in the same file as the API so invalidations stay matched
- `lib/api/*` modules accept an `Http` parameter so the same code works in
  RSC, client components, and server actions (whoever passes the right Http)

### 2. New hook → `features/<area>/use-<thing>.ts`

```ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { getHttpClient } from "@/lib/http/client";
import { fooApi, fooKeys } from "@/lib/api/foo";

export function useFooList() {
  return useQuery({
    queryKey: fooKeys.list(),
    queryFn: ({ signal }) => fooApi.list(getHttpClient()),
  });
}
```

Mutation hooks should patch the cache directly (`setQueryData`) and ONLY
invalidate sibling lists, never the rows we just authoritatively know.
Pattern: see [`use-profile-mutations.ts`](../features/profile/use-profile-mutations.ts).

### 3. Backend mapping → use `profile-mapper.ts` pattern

Don't sprinkle `as unknown as` casts across the codebase. If the backend
shape differs from a legacy frontend shape, write a mapper in `lib/api/` and
funnel everything through it. The mapper shrinks over time as components
migrate to the backend shape directly.

### 4. Form values → file picks expose the underlying `File`

`PhotoUpload` and `CvUpload` emit both a data-URL (for preview) AND the raw
`File` (for multipart upload). `StudentForm` carries `photoFile` and `cvFile`
in its `StudentFormValues`. After `createProfile` resolves, `JoinForm` chains
the uploads. See [`join-form.tsx`](../features/join/join-form.tsx) for the
"best-effort followups" pattern.

### 5. Errors → `ApiError` with structured fields

```ts
catch (err) {
  if (err instanceof ApiError && err.status === 409) {
    // optimistic-lock failure
  } else if (err instanceof ApiError && err.status === 422) {
    const first = err.details?.[0];
    // first.field, first.errors[]
  }
}
```

Every error carries `requestId` (X-Request-ID echoed from backend or
generated client-side). Surface this in user-facing error messages when you
add error reporting / Sentry.

---

## What works end-to-end today

| Feature | Status |
|---|---|
| Login (Supabase OTP) | ✅ wired, blocked by Supabase email rate-limit on free tier — see "Known dev-env issues" |
| Feed (`/`) | ✅ infinite query against `/feed`, filters by query + tag |
| Profile detail (`/profile/:slug`) | ✅ real backend data, photo from Storage public URL, signed CV download |
| Create profile (`/join`) | ✅ + chains photo, CV, skill, contact uploads as best-effort followups |
| Edit profile (`/profile/me/edit`) | ✅ + diff-aware skill add/remove + contact PATCH-or-CREATE |
| Delete profile | ✅ soft-delete via DELETE /profiles/:id |
| Nav avatar | ✅ pulls from useMyProfile |

## What's wired but UI-incomplete

- **Profile status toggle** (active ↔ hidden): `useUpdateProfileStatus` exists,
  no button in UI yet
- **University suggest** ("can't find your university?"): `universitiesApi.suggest`
  exists, no button in UI yet
- **Skill reorder**: `skillsApi.reorder` not wrapped in a hook
- **Multi-contact display**: form has 1 contact slot; mapper picks lowest-sort_order;
  other kinds (instagram, telegram, github, etc.) are visible to owner but
  collapsed to "portfolio" by the legacy ContactType projection. Needs a UI
  redesign before exposing the wider type system

---

## Open items — work to do

### Frontend audit fixes (latent)

Read [`docs/handoff.md`](handoff.md) below this section for the list and
priority. Highlights:

- **M4** — worst-case 4× 30s timeouts + retry backoff = ~137s before user
  sees a final failure. Needs a total-time-budget reshape, not just a timeout
  knob
- **N3, N4** — multi-contact display blocked on UI redesign
- **N5** — mutation idempotency needs backend `Idempotency-Key` support
- **A2** — `EditProfileForm` silently drops 4+ form fields
  (country_code, is_remote_ok, availability dates, internship length).
  Form refactor.
- **S1–S4** — small items: query key sentinel pollution, popular-tags from
  filtered feed (semi-tautological), abort listener accumulation on
  long-lived signals, addedAt timezone

### Backend asks (blocking-ish)

See [`backend-asks.md`](backend-asks.md). Two items open:

1. `engagement_types` array contains `null` entries on some seeded profiles
   — data quality. Frontend hardened, but backend should fix the data and
   tighten the write path.
2. `status` field missing on `/feed` response — pick: include it, or
   document the omission.

### Module gaps vs backend (no UI yet)

Recap of what backend has that frontend hasn't surfaced as UI:

- `POST /universities/suggest` — owner-side "submit a missing uni" flow
- `PATCH /profiles/:id/status` — visibility toggle on edit profile page
- `PATCH /profiles/:id/skills/reorder` — drag-to-reorder skill chips
- Contact CRUD beyond the single-slot form — multi-contact UI

---

## Known dev-env issues

### Supabase email rate limit on OTP login
Free-tier Supabase allows ~3 emails/hour. After that, `signInWithOtp` returns
*"Error sending magic link email"* and login is dead until the limit resets.
Fixes:
- Configure your own SMTP in Supabase Dashboard → Auth → SMTP, or
- For testing logged-in flows: create a user manually in Supabase Dashboard
  and temporarily swap our login form for password auth

### `.env.local` requires `NEXT_PUBLIC_` prefix
Next.js only inlines env vars prefixed with `NEXT_PUBLIC_` into the browser
bundle. If you forget the prefix, every Supabase call throws "Missing
required env var" at runtime. Restart the dev server after editing env vars
— hot reload doesn't always pick them up.

---

## Quality bar — what "done" means here

- `npx tsc --noEmit` is clean
- `npm run lint` is clean (cosmetic Tailwind warnings about `rounded-[14px]`
  → `rounded-lg` allowed as they match existing pattern)
- Smoke test: `/`, `/login`, `/join`, `/profile/:slug` all HTTP 200
- New code follows the 5-layer onion — components don't bypass hooks,
  hooks don't bypass API modules, API modules don't read env directly
- New mutations: cache hygiene via `setQueryData` for known rows, partial-key
  `invalidateQueries` for lists. Don't invalidate keys you just wrote.
- New external calls: catch `ApiError`, branch on `status` (409 / 422 / 401
  have semantics)

---

## Files worth reading first (in order)

1. **[`docs/backend-asks.md`](backend-asks.md)** — current blocking asks +
   completed items
2. **[`lib/http/fetcher.ts`](../lib/http/fetcher.ts)** — the heart of the
   HTTP layer; understand retry + dedup + 401-refresh before changing it
3. **[`features/profile/use-profile-mutations.ts`](../features/profile/use-profile-mutations.ts)**
   — the canonical mutation hook pattern
4. **[`lib/api/profiles.ts`](../lib/api/profiles.ts)** — the canonical API
   module
5. **[`features/join/join-form.tsx`](../features/join/join-form.tsx)** — the
   "create profile then chain best-effort followups" pattern used twice
6. **[`features/auth/auth-provider.tsx`](../features/auth/auth-provider.tsx)**
   — Supabase session normalization + per-user cache eviction

---

## Reference docs in this repo

- **[backend-api.md](backend-api.md)** — backend endpoint catalog (shared
  with backend repo)
- **[backend-schema.md](backend-schema.md)** — DB schema reference
- **[backend-asks.md](backend-asks.md)** — open asks of the backend team
- **[db-diagram.dbml](db-diagram.dbml)** — DBML for visualization
- **[flow.md](flow.md), [implementation-plan.md](implementation-plan.md),
  [v2-backlog.md](v2-backlog.md)** — historical planning docs
