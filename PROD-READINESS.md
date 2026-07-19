# Production-Readiness Findings

Review of 2026-07-18 (branch `v2`). Status at review time: production build green
(`@sveltejs/adapter-vercel`), 88/88 server tests passing, `svelte-check` clean
(0 errors, 0 warnings), en/de i18n fully in sync (294/294 keys). Items below are
what stands between "deploys fine" and "robust as a daily driver", ranked by
severity. Check items off (or delete them) as they're resolved.

## Top gap: data loss is unrecoverable

- [ ] **No data export / backup / import.** All user data lives only in
  IndexedDB — no way to export or restore it. Combined with the silent
  "prune sessions older than 1 year" job
  (`src/lib/data/session-repository.ts:59-79`), old data disappears
  permanently with no warning. Fix first: JSON export/import of all four
  stores.

## Should fix

- [ ] **No error surfaces.** No `+error.svelte` anywhere and no
  `hooks.client.ts` `handleError` — load/render errors show SvelteKit's
  default fallback, and client exceptions end at `console.error`.
- [ ] **No offline support.** No service worker and no web app manifest
  (`static/` has none; `src/app.html` links none). All data is local, yet the
  app needs network to load and isn't installable.
- [ ] **No multi-tab DB safety.** `src/lib/data/indexed-db.ts` handles neither
  `request.onblocked` nor `db.onversionchange`: a second tab opening a newer
  schema blocks the upgrade silently and leaves the stale tab with a dead
  handle. Also no recovery path when the on-disk DB version is *higher* than
  code `DB_VERSION` (user downgraded) — app init just fails.
- [ ] **No quota handling.** No `QuotaExceededError` handling anywhere; a
  write failing on storage pressure rejects into a `console.error` the user
  never sees.
- [ ] **Dead Postgres backend shipping.** `src/lib/data/database/postgres.ts`
  is imported nowhere, yet `pg` is the app's *only* production dependency;
  `docker-compose.yml` + `init.sql` belong to the same unwired experiment.
- [ ] **Demo/boilerplate routes deploy as live pages.** `src/routes/demo/*`
  (SvelteKit demo + Playwright example), plus committed scaffolding in
  `src/lib/vitest-examples/*` and default `src/stories/*` (Button/Header/Page).
- [ ] **No CI.** `lint`, `check`, and `test` scripts exist in `package.json`
  but nothing runs them automatically.
- [ ] **Test coverage is math-only.** Business/model logic is well tested;
  the data layer (`src/lib/data/`), the store
  (`session-store.svelte.ts`), all routes, and all real UI components have
  zero tests.

## Nice to have

- [ ] `saveRoutine`/`deleteRoutine` are the only store mutations without
  try/catch (`src/lib/business/session-store.svelte.ts:442-449`).
- [ ] Persisted energy params are merged without validation
  (`src/routes/(app)/energy/+page.svelte:65`): corrupt-but-valid JSON like
  `{"recoveryRate":"abc"}` is spread straight into the params object.
- [ ] `console.log` on startup prune (`src/lib/business/session-history.ts:30`).
- [ ] `debug-storybook.log` is ignored-but-tracked (committed before the
  ignore rule).
- [ ] No `.env.example` despite `.gitignore` whitelisting one.
- [ ] **Set `PUBLIC_SITE_URL` on Vercel** (e.g. `https://<prod-domain>`). SEO
  tags, `sitemap.xml`, and `robots.txt` (2026-07-19) fall back to the request
  origin without it, so preview deployments and `*.vercel.app` aliases declare
  themselves canonical and split indexing with the production domain.

## Already good (verified, don't re-litigate)

- Clean 3-layer architecture (data / business / presentation).
- IndexedDB migrations are additive and idempotent (v1→v3,
  `indexed-db.ts` `onupgradeneeded` guards every store), and every repository
  transaction rejects on error instead of hanging.
- Defensive `localStorage` parsing: corrupt `zenith-energy-params` falls back
  to defaults; the localStorage→IndexedDB migration guards its parse; private-
  mode `setItem` failures are caught.
- en/de message files perfectly in sync; aria keys wired on charts/controls;
  `svelte-check` clean across 1475 files.
- Known model-code perf headroom (buildCurves caching) is documented in
  `src/lib/business/model/zenith-energy.ts` and the roadmap — a deliberate
  non-fix at current plan sizes, not an oversight.
