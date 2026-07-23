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
- [x] **No quota handling.** _Fixed 2026-07-23:_ repository writes resolve on
      `transaction.oncomplete` (not pre-commit `request.onsuccess`) and reject
      on `onabort` via the shared `withStore()` helper, so quota aborts surface
      with their `DOMException` intact; every session-store persistence failure
      now sets `storageError`, rendered as a dismissible localized banner in the
      app layout. Autosave is debounced (500ms trailing, flushed on tab-hide and
      before date-switch loads) so typing no longer writes per keystroke, and
      the ⚡ flow badge is stamped only after its write commits.
- [x] **Backup import ignored `schemaVersion`.** _Fixed 2026-07-23:_
      `$importAllStores` rejects backups whose `schemaVersion` is newer than
      `DB_VERSION`; older/missing versions still import (readers tolerate
      absent fields).
- [x] **Second tab silently clobbered the day's session** (whole-session
      last-write-wins put on the date key). _Mitigated 2026-07-23:_ pending
      saves flush when a tab hides; on becoming visible a tab re-reads the
      selected date, so tab-switching picks up the other tab's writes.
- [x] **Charts were theme-blind** (hardcoded hexes; white-alpha gridlines
      invisible on light themes — including the default `fallow`). _Fixed
      2026-07-23:_ analytics + energy charts use theme tokens
      (`--color-line-soft/strong`, `--color-brand`, `--color-mind/body`,
      `--color-flow`); residual categorical palettes are mid-tone and legible
      on both light and dark.
- [x] **Corrupt legacy localStorage retried migration forever.** _Fixed
      2026-07-23:_ parse failures mark the migration done and stop; only
      transient IndexedDB failures retry.
- [x] **Dead Postgres backend shipping.** Removed `postgres.ts`,
      `docker-compose.yml`, `init.sql`, and the `pg` / `@types/pg` deps
      (2026-07-20).
- [x] **Demo/boilerplate routes deploy as live pages.** `src/routes/demo/*`
      (SvelteKit demo + Playwright example), plus committed scaffolding in
      `src/lib/vitest-examples/*` and default `src/stories/*` (Button/Header/Page).
- [x] **No CI.** _Fixed 2026-07-23:_ `.github/workflows/ci.yml` runs
      `svelte-check`, eslint, the vitest projects (browser mode included), and
      the Playwright e2e suite on every push/PR to `main`. (`prettier --check`
      is deliberately not in CI.)
- [x] **Test coverage is math-only.** _Fixed piecemeal by 2026-07-23:_ the
      data layer (all repositories, `indexed-db.ts`, the localStorage
      migration), the session store, and the real UI components now have
      specs; business/model keeps its numeric suite (135 tests as of
      2026-07-23). Routes are exercised only via the Playwright e2e suite.

## Nice to have

- [x] `saveRoutine`/`deleteRoutine` were the only store mutations without
      try/catch. _Fixed 2026-07-23:_ same try/catch + `storageError` treatment
      as every sibling mutation.
- [ ] Persisted energy params are merged without validation
      (`src/routes/(app)/energy/+page.svelte:65`): corrupt-but-valid JSON like
      `{"recoveryRate":"abc"}` is spread straight into the params object.
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
- `zenith.ts`, `zenith-energy.ts`, and `session-store.svelte.ts` are
  **deliberately deep modules** (large implementations behind tiny interfaces:
  the store is 500+ lines behind 3 exports). A 2026-07-23 interface analysis
  confirmed every proposed split would force currently-private helpers
  (`amplitudeRatio`, `phiQuadratureNodes`, `reservoirLaw`, date-routing state)
  into cross-module exports — more surface, not less. Don't split on line
  count; the one seam worth cutting (generic 3×3 linalg → `linalg.ts`) is cut.
- Metric color-band thresholds live in the presentation layer **by explicit
  decision** (`status.ts` header): banding is display policy, not domain math.
