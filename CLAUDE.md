# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Three sibling projects sit at the repo root, each independently deployed:

- **`app/`** — Next.js 16 App Router app (the actual product). All current development happens here. Mounted under `/app` on the production domain via `basePath: "/app"` in [app/next.config.ts](app/next.config.ts).
- **`TripKawan - Frontend/`** — Static HTML/CSS/JS landing page for `tripkawan.my`. The root `vercel.json` rewrites `/`, `/css/*`, `/js/*`, etc. to the `tripkawan.vercel.app` deployment so the landing page and the Next app coexist on the same domain.
- **`TripKawan - Backend/`** — A single Google Apps Script (`google-sheets-script.gs`) that captures landing-page form submissions to Google Sheets. No local runtime; deploy via Apps Script UI.

When the user says "the app" or "the product," they almost always mean `app/`. The landing page and Apps Script are essentially frozen.

## Common commands (run from `app/`)

```bash
npm run dev      # next dev — local at http://localhost:3000/app
npm run build    # next build
npm run start    # production server
npm run lint     # eslint (flat config in eslint.config.mjs)
```

There is no test suite. There is no separate typecheck script — rely on `npm run build` or the editor TS server.

The path alias `@/*` resolves to `app/src/*`.

## Architecture (the `app/` Next.js project)

### Auth + request flow

Auth is Supabase OAuth (Google) via `@supabase/ssr`. Three pieces work together:

1. **[app/src/proxy.ts](app/src/proxy.ts)** — Next 16 proxy (not `middleware.ts`). Matcher `/app/((?!login|auth).*)` excludes the login page and the PKCE callback so they're never blocked.
2. **[app/src/lib/supabase/middleware.ts](app/src/lib/supabase/middleware.ts)** — `updateSession` refreshes the Supabase session and redirects unauthenticated users to `/login`. Do not return early before `supabase.auth.getUser()` — that call is what refreshes cookies.
3. **[app/src/app/auth/callback/route.ts](app/src/app/auth/callback/route.ts)** — PKCE exchange. Cookies are pinned to `.tripkawan.my` in production (and *not* on localhost) so apex/www variants share the session.

Browser-side, [app/src/lib/supabase/client.ts](app/src/lib/supabase/client.ts) sets `cookieOptions.domain = ".tripkawan.my"` for the same reason — the PKCE `code_verifier` set in the browser must be readable by the callback regardless of which host the user landed on. There is a memory entry (`feedback_auth_cookies.md`) with full lessons on this; consult it before changing anything in the auth path.

### Server vs client Supabase

- **Server Components / Route Handlers** — `createClient()` from [app/src/lib/supabase/server.ts](app/src/lib/supabase/server.ts) (uses `next/headers` cookies).
- **Client Components** — `createClient()` from [app/src/lib/supabase/client.ts](app/src/lib/supabase/client.ts) (browser client with apex-domain cookie scope).

Both files export the same name; pick by where you are.

### Data model

Schema lives in [app/supabase/migrations/](app/supabase/migrations/) (numbered `001_…` through `008_…`). RLS is enabled on every table. A `security definer` helper `public.get_my_trip_ids()` exists specifically to avoid infinite recursion when a `trip_members` policy needs to look up `trip_members` — use it in any new policy that has the same shape.

A trigger on `auth.users` insert auto-creates a `profiles` row from Google OAuth metadata.

TypeScript shapes for these tables live in [app/src/lib/types.ts](app/src/lib/types.ts). Keep them in sync when adding columns.

### Realtime

[app/src/components/RealtimeRefresh.tsx](app/src/components/RealtimeRefresh.tsx) mounts once in the root layout and subscribes to `postgres_changes` on `trips`, `trip_members`, `itinerary_items`, `expenses`. Every event triggers `router.refresh()`. Realtime publication membership is set up in [`005_enable_realtime.sql`](app/supabase/migrations/005_enable_realtime.sql) — new tables that need realtime must be added there.

Because of this, server components do not need to manually re-fetch on mutation; a successful insert/update will round-trip through Supabase realtime → router refresh.

### AI itinerary generation

[app/src/app/api/trips/[tripId]/generate-itinerary/route.ts](app/src/app/api/trips/[tripId]/generate-itinerary/route.ts) calls Groq (`llama-3.3-70b-versatile`) with trip + preferences, parses a JSON array, deletes the previous `source = 'ai'` items, and inserts new ones. Admin-only (checked against `trip_members.role`). Requires `GROQ_API_KEY` — note the `.env.local.example` still references `ANTHROPIC_API_KEY` from an earlier iteration.

### Drag-and-drop itinerary

Itinerary uses `@dnd-kit` (core / sortable / utilities). The `sort_order` column added in [`004_sort_order.sql`](app/supabase/migrations/004_sort_order.sql) is what persists ordering — keep writes in sync when reordering.

### Routing conventions

- All app routes live under `/app/...` because of `basePath`. Never hardcode `/app` in `redirect()` calls from inside the Next app — `next/navigation` already accounts for the basePath. The auth callback is the one place that constructs explicit `/app/...` URLs because it builds them from `request.url`.
- Trip-scoped pages live under `app/src/app/trip/[tripId]/` with a shared layout that renders `TripHeader` + `BottomNav`.
- Per-trip features: `setup`, `itinerary`, `expenses`, `members`, `photos`.

### Styling

Tailwind v4 (PostCSS plugin in [app/postcss.config.mjs](app/postcss.config.mjs)), Poppins via `next/font/google`. Custom utility `pb-nav` is used to clear the bottom nav — bottom-sheet UI must use enough bottom padding to clear it (recently fixed in commit `2071b33`).

## Environment

[app/.env.local.example](app/.env.local.example) lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and an `ANTHROPIC_API_KEY` placeholder, but the running code reads `GROQ_API_KEY`. When adding a new env var, update both `.env.local.example` and the Vercel project settings.

## Things to know before editing

- **Auth path is fragile** — there's a documented history of breakage around www/apex cookie scoping and OAuth callbacks. Don't change cookie domains, the proxy matcher, or the callback redirect target without re-reading the auth code end-to-end.
- **basePath = `/app`** changes how every URL behaves. Static asset paths, `redirect()` targets, and the auth callback all assume it.
- **No tests, no typecheck script** — `npm run build` is the closest thing to verification before pushing.
- **Two `vercel.json` files exist** (root + `app/`). The root one is the rewrite shim that fronts both deployments on `tripkawan.my`; the `app/` one configures the Next deployment itself.
