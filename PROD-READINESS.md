# Production-Readiness Findings

Review of 2026-07-18 (branch `v2`). Status at review time: production build green
(`@sveltejs/adapter-vercel`), 88/88 server tests passing, `svelte-check` clean
(0 errors, 0 warnings), en/de i18n fully in sync (294/294 keys). Items below are
what stands between "deploys fine" and "robust as a daily driver", ranked by
severity. Check items off (or delete them) as they're resolved.

## Top gap: data loss is unrecoverable

- [x] **No data export / backup / import.** _Fixed 2026-07-20:_
      `src/lib/data/repository/backup-repository.ts` exports all five object
      stores (sessions, routines, flow/drain/rest observations) to a versioned
      JSON file and imports one back in a single all-stores transaction
      (merge via `put`, atomic — a bad record aborts the whole import).
      Footer buttons on every page (`footer.svelte`, wired in the app layout)
      download `fallow-backup-YYYY-MM-DD.json` and restore from file, reloading
      after import. The "old data disappears" part was already resolved when
      the 1-year retention cap was removed — no pruning code remains. Covered
      by `backup-repository.test.ts`.

## Should fix

- [x] **No error surfaces.** _Fixed 2026-07-20:_ root `+error.svelte`
      (localized, themed; 404 vs generic variant, reload + home actions) and
      `hooks.client.ts` `handleError` as the central hook for a future
      error-reporting service.
- [x] **No offline support.** _Fixed 2026-07-20:_ `src/service-worker.ts`
      precaches build assets + `/` app shell (cache-first for versioned assets,
      network-first with shell fallback for navigations, old caches pruned on
      activate). `static/manifest.webmanifest` (standalone, brand colors,
      192/512 maskable icons rendered from the new Fallow mark) is linked in
      `app.html` with `apple-touch-icon` and light/dark `theme-color`. Verified
      offline reload in headless chromium against `vite preview`.
- [x] **No multi-tab DB safety.** _Fixed 2026-07-20:_
      `src/lib/data/storage/indexed-db.ts` now caches the open promise, closes
      its handle on `db.onversionchange` (and clears the cache on `onclose`) so
      another tab's upgrade proceeds, warns on `request.onblocked`, and retries
      without a version on `VersionError` so a downgraded build opens the newer
      on-disk schema. Covered by `indexed-db.test.ts`.
- [ ] **No quota handling.** No `QuotaExceededError` handling anywhere; a
      write failing on storage pressure rejects into a `console.error` the user
      never sees.
- [x] **Dead Postgres backend shipping.** Removed `postgres.ts`,
      `docker-compose.yml`, `init.sql`, and the `pg` / `@types/pg` deps
      (2026-07-20).
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
