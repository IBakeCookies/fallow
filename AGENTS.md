# AGENTS.md — working rules for Fallow

The single contributor/agent brief for this repo. Read it before changing code.

Other documentation, and nothing else:

| File                                                             | What it is                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| [README.md](README.md)                                           | User-facing: what the app does and how to run it                    |
| [MATH.md](MATH.md)                                               | **Authoritative** record of the implemented math — every derivation |
| [zenith.md](zenith.md)                                           | Frozen copy of the source article. Historical only — never a spec   |
| [.claude/skills/verify/SKILL.md](.claude/skills/verify/SKILL.md) | How to launch and drive the app in a real browser                   |

Do not add new top-level `.md` files. New durable knowledge belongs in one of
the four above — architecture and rules here, math in `MATH.md`.

---

## 1. Hard rules

These are the ones that get broken. Each exists because it was broken before.

### R1 — Layers point one way: presentation → business → data

- `src/lib/presentation` (and `src/routes`): UI only. **Never** imports
  `$lib/data/*`. Persisted types come from `$lib/business/type`.
- `src/lib/business`: domain logic — models (`model/`), stores (`store/`),
  app-wide reactive state (`state/`), helpers (`utils/`). Never imports
  `$lib/presentation/*`.
- `src/lib/data`: storage models (`type/`), the IndexedDB connection
  (`storage/`), repositories with `$`-prefixed CRUD controllers
  (`repository/`), migrations (`migration/`). Never imports upward. Model
  defaults a migration needs are **passed in as parameters**.
- Enforced by `no-restricted-imports` in `eslint.config.js` and by
  `.dependency-cruiser.cjs` (`npm run depcheck`). `src/lib/paraglide` is
  generated and exempt.

### R2 — Routes and components hold no logic

The lint rules enforce dependency _direction_, not code _placement_: a route
importing business code is legal, so logic drifts into `+page.svelte` where
nothing can unit-test it. It has happened twice (a 518-line main page, a
1349-line Energy Lab) and both had to be pulled back out.

A `+page.svelte` may contain: markup, local UI-only state (draft editors, open
/closed toggles, view preferences), formatters, and thin `$derived` aliases of
a store. Anything else — model orchestration, fits, persistence, threshold
policy — goes in a module:

| Kind of code                        | Where it goes                                        |
| ----------------------------------- | ---------------------------------------------------- |
| Pure math                           | `business/model/*.ts`                                |
| Composed model results for a screen | `business/model/metric/daily-metrics.ts` (or a peer) |
| Reactive state + persistence        | `business/store/*.svelte.ts`                         |
| Labels, thresholds, colors, i18n    | `presentation/utils/*.ts`, `presentation/component/` |

Rule of thumb: if you cannot write a `.test.ts` for it, it is in the wrong
file.

### R3 — One definition per concept

A mapping used by two subsystems is exported once, never mirrored. `Task →
EnergyTaskInput` lived in two places with a comment admitting it ("mirrors the
Energy Lab's task mapping"); the Lab and the calibration fits could have
silently disagreed about what a task _is_. It is now
`toEnergyTask` in `business/model/metric/calculation.ts` — one definition.

If you catch yourself writing "mirrors", "same as", or "keep in sync with" in
a comment, export the thing instead.

### R4 — Model inputs are persisted data, not preferences

Anything the model reads must survive a backup/restore round trip.

- **IndexedDB** (via a repository, listed in `backup-repository.ts`
  `STORE_NAMES`): sessions, routines, observations, and any setting that feeds
  a calculation — e.g. the Energy Lab's params (`settings` store, key
  `energyParams`).
- **localStorage**: only preferences whose loss costs nothing and that have no
  business in a backup (e.g. which tab of a card was open).
- **Cookies** (via `data/repository/appearance-repository.ts`): only what SSR
  must know before hydration — `hooks.server.ts` stamps the theme and scenery
  classes into the HTML so the first paint is already correct. Nothing else
  belongs here.

Persisted values are user-reachable — hand-edited, or restored from an older
backup, or written by a build that has since been deployed over. **Validate on
read**, in the business layer that owns the shape (`sanitizeEnergyParams`,
`resolveThemeName`). The data layer parses and stores; it does not know what a
valid value means.

No store talks to a storage API directly — not IndexedDB, not `document.cookie`,
not `localStorage`. Key names, cookie attributes and schema live in exactly one
repository, because they are read from the server and written from the browser
and will otherwise be spelled out at four call sites.

### R5 — Business code does not import SvelteKit routing

Stores take what they need as an argument. `SessionStore` reads the viewed day
through an injected `ReadDateParam` thunk supplied by the `(app)` layout — not
by importing `$app/state`. This keeps the store testable without module mocks
and keeps routing a layout concern. (`$app/environment`'s `browser` is fine.)

### R6 — Every behaviour change ships with a test

No exceptions for "small". Pick the level:

| Change                            | Test                                                   |
| --------------------------------- | ------------------------------------------------------ |
| Math / model                      | `*.test.ts` beside it, asserting the identity or bound |
| Metric composition, scoping       | `daily-metrics.test.ts` — scope invariants             |
| Repository, migration, IDB schema | `*.test.ts` with `fake-indexeddb`                      |
| Store (needs a component context) | `*.svelte.spec.ts` + a test harness component          |
| Component                         | `*.svelte.spec.ts` (browser project)                   |
| A user-visible flow               | `e2e/*.e2e.ts`                                         |

Test the invariant, not the implementation. The valuable tests here assert
things like "completing a task must not move plan-scoped metrics" — a rule
that has actually been violated — not that a function returns what it returns.

`vitest.config` sets `expect.requireAssertions: true`; a test with no
assertion fails.

### R7 — Math changes go in MATH.md, in the same change

`MATH.md` is the spec; the code is the implementation. If you change a
formula, a constant, a bound, or a fit's conditioning:

1. Update the relevant `MATH.md` section **in the same commit**.
2. Cite the section from the code comment (`// MATH.md §8.7`) so the two stay
   findable from each other.
3. If only the _explanation_ was wrong and the model did not change, log it in
   MATH.md §10 (doc-only revision log) — do not imply a model change.
4. Never "fix" the code to match `zenith.md`. The implementation deliberately
   deviates from the article; §6 lists how and why.

### R8 — Changing the IndexedDB schema is a five-step change

Missing any one of these ships a broken upgrade or a lossy backup:

1. Bump `DB_VERSION` in `src/lib/data/storage/indexed-db.ts`.
2. Add the store inside `onupgradeneeded`, guarded by
   `if (!database.objectStoreNames.contains(...))` — upgrades are additive and
   idempotent, never destructive.
3. Add the store name to `STORE_NAMES` in `backup-repository.ts`, or it is
   silently excluded from export/import/wipe.
4. Update the two hardcoded store-name lists in `indexed-db.test.ts` and
   `backup-repository.test.ts`.
5. If data is moving from somewhere else, write a migration in
   `data/migration/` that never lets the stale source win over what IndexedDB
   already owns, and drops unparseable input instead of retrying forever.

---

## 2. Conventions

Most are enforced by eslint/prettier — see the configs. The rest:

### Naming

- No abbreviations.
- Files and folders: singular, `kebab-case`. (Exception: config files whose
  name a tool dictates.)
- Slot names and emitted events: `kebab-case`.
- Functions: _imperative verb + object [+ from|to|by + target]_ —
  `getUser()`, `addItemToCart()`, `sortCompaniesByName()`.
- Data-layer controllers start with `$` + a CRUD verb: `$createX`, `$readX`,
  `$updateX`, `$deleteX`. Inside `.svelte`/`.svelte.ts` the `$` prefix is
  reserved for runes, so import the repository as a namespace:
  `import * as sessionRepository from '$lib/data/repository/session-repository'`.

### Code

- Named exports only; default exports are for Svelte components.
- `const` over `let`. Early returns over nested `if`.
- One responsibility per function. A function that _does_ something is an
  **action**; one that _reacts_ is a **handler**, named `onClick`,
  `onInputChange`. Handlers only handle — they compose actions.
- Comments explain _why_, and pay for their line count. Match the density of
  the file you are in.

### Svelte / stores

- Stores are created via context in a layout (`setXStore()` / `getXStore()`),
  **never at module scope** — module state leaks across SSR requests.
  `business/state/*.svelte.ts` is the one exception and only for values
  derived from the environment (e.g. the clock), never user data.
- A class field that a `$derived` initializer reads must be declared with `!`
  and assigned first in the constructor — the deriveds are lazy, but
  TypeScript checks declaration order.
- Components take snippets/props from the layout; they do not reach into
  stores themselves.

### Style

- Stylesheets live in `src/lib/presentation/style/`, never in `src/routes/`.
  `app.css` is the only entry (imported by the root layout); its import order
  is the cascade order and is load-bearing:

  | File            | Owns                                                       |
  | --------------- | ---------------------------------------------------------- |
  | `scenery/*.css` | one decorative layer per animated theme                    |
  | `tokens.css`    | `@custom-variant` + `@theme inline` — what utilities exist |
  | `base.css`      | `:root` defaults, `@layer base`, `.dark`                   |
  | `themes.css`    | one palette class per theme, overriding `base.css`         |

- Semantic Tailwind tokens from `tokens.css` only — no raw palette classes
  (`text-zinc-400`) in components. This also applies to class strings built in
  `.ts` helpers.
- **Never `dark:` in a component.** It matches `.dark` only — 1 of the 31 dark
  themes in the catalogue — so it silently does nothing under `abyss`, `noir`,
  `meridian`, `terminal` and the rest. Any light/dark difference must come from a
  token the themes already swap. Note `-strong` is not "darker" — it means
  _more contrast against this theme's own background_, so it is lighter on every
  dark theme and darker on every light one. Never use it as a fill sitting under
  light-coloured content.
- A hover/active surface is `surface-hover`. `hover:bg-surface-card` on an
  element already sitting on a card is a no-op, which is easy to miss.
- **A translucent surface sitting on the page needs `backdrop-blur`.** Both
  `surface-card` and `input` are translucent in ~20 themes, so without it the
  background image shows through unblurred while every card around it is frosted.
  This has been missed on the toolbar buttons, the calendar arrows and both
  segmented-toggle pills. Controls _nested inside_ an already-blurred card do not
  need their own — they sit on a blurred plane already. Bare `backdrop-blur` is
  theme-aware (`terminal` → 0, `lantern-drift` → 2rem); `backdrop-blur-sm` is not.
- Checkboxes use `appearance-auto accent-brand`, not the `@tailwindcss/forms`
  look. The plugin paints a hardcoded `fill='white'` checkmark over
  `background-color: currentColor`, so the fill has to be dark — impossible here,
  because on a dark theme every accent token is light by design. `accent-color`
  hands checkmark contrast to the browser, which is the only thing that holds
  across all 33 themes.
- Tailwind's scanner is **textual and runs at build time**, so a name assembled
  at runtime does not exist. This bites twice: class names (`bg-{x}-500`) and
  `@theme` custom properties, which are tree-shaken to the ones the scanner
  literally saw — even one inside a _comment_ is enough to emit it. Hand-authored
  `:root` declarations in `base.css` are never tree-shaken, so build a dynamic
  `var()` name over those (`--series-N`), never over a `@theme` alias
  (`--color-series-N`). See `energy/+page.svelte`'s `PALETTE`.
- Bare `rounded` and `blur` are declared in a _deprecated_ block in Tailwind's
  own `theme.css` marked `@theme default inline reference`, and `reference`
  inlines the value at build time — so both need re-declaring in `tokens.css`
  (they are), or they bake in Tailwind's v3-compat literals (`0.25rem`, `8px`)
  and no theme can reach them.
- `--series-1…8` + `--series-rest` (`base.css`) are the categorical scale for
  per-task chart series, deliberately _not_ swapped per theme: the hues only stay
  distinguishable if their lightness holds. Label them with `series-ink`, never
  `ty-primary`, which flips to white and vanishes on the fills.
- Adding a theme touches four places: the catalogue in
  `business/model/theme.ts`, a `@custom-variant` in `tokens.css`, a palette
  block in `themes.css`, and (if animated) a file under `style/scenery/`.
- Use the `cn` helper (tailwind-merge + clsx) for conditional classes.
- Avoid `<style>` blocks; prefer Tailwind.

**Imports**, in order: types → external libs → internal helpers → data layer →
business layer → presentation (big/abstract to small/specific).

---

## 3. Model invariants

Full derivations in `MATH.md`; `zenith.test.ts` is the executable spec
(closed forms vs. numeric integration, root equations, allocator vs. brute
force). Do not change these without reading the derivation first.

### Zenith model (`business/model/zenith.ts`, model v2)

- User inputs are 1–10; the model maps difficulty Eᵤ∈[1,10]→E∈[1,5] and
  enjoyment βᵤ∈[1,10]→β∈[1,2]. Metrics comparing E against β must account for
  the asymmetry (some deliberately use raw values instead).
- Productivity curve: `p(t) = (a·kt + p₀)·e^(−kt)`, `k = (1−p₀/a)/ϕ`, so
  `p(0) = p₀` genuinely holds; peak at `t = ϕ`, value `a·e^(p₀/a−1)`. The
  ratio `r = p₀/a` is capped at 0.9 (`AMPLITUDE_RATIO_CAP`).
- The single-task optimum is **per task**: `T* = ϕ·x*(r)/(1−r)` where `x*(r)`
  solves `eˣ = 1 + x + x²/(1+r)`; the multiplier ranges over (1.5, 1.7933].
  `OPTIMAL_PHI_MULTIPLIER` (1.7933) is only the r→0 limit / upper bound (and
  the energy model's seed) — use `TaskAllocation.optimalHours` for real
  values. The allocator never assigns time meaningfully past a task's `T*`.
- The objective is `Σᵢ P̄ᵢ(tᵢ)` — a sum of average productivity _rates_, not
  total output. `P̄` jumps from 0 to ≈`p₀` at `t = 0⁺` ("activation bonus"), so
  the objective is **not concave** — Lagrange/KKT solvers are invalid here.
  The allocator works on discrete 15-minute blocks (`BLOCK_HOURS`): greedy
  marginal analysis (exact for the single budget), exhaustive funded-subset
  enumeration for switch costs (exact, n ≤ 12), plus a resource-transfer pass
  when a capacity pool binds (near-exact heuristic).
- Allocated hours are exact multiples of 0.25h; budget below one block is left
  unplanned. There is no 0.01h rounding step.
- `ϕ = c₁E + c₂β + c₃`, floored at 0.1h. Constants are personalized by
  `fitUserConstants` — a Bayesian linear regression whose MAP equals the old
  ridge fit, plus posterior covariance/noise (`phiPredictionStd`) and an
  optional forgetting factor. The allocator consumes the MAP; the posterior
  makes it hedge ϕ-uncertainty (§5.1).
- Three constraints: the time budget plus cognitive/physical capacity pools
  (task weight = dimension difficulty / 10). Context switches cost
  `switchCost` hours — attention residue, distinct from ramp-up, which ϕ
  already prices — and are charged only between tasks that receive time.

### Energy model (`business/model/zenith-energy.ts`, `/energy` only)

Standalone by design: shares the curve/ϕ machinery with `zenith.ts` but none
of its allocation code, so the main page is unaffected by changes here.

- Objective is `Σ_tasks V(task's daily output)`, not `Σ P̄` — total output per
  task through the concave satiety wrapper `V(O) = κ·ln(1+O/κ)`,
  `κ = satietyScale·(that task's reference single-session output)`. Satiety
  breaks winner-take-all (re-running the best task always beat switching); it
  must key on cumulative **output**, never on session phase, which decays over
  gaps and could be gamed with breaks. `satietyScale ≤ 0` recovers pure total
  output. The objective is only well-posed with its stopping terms:
  `freeTimeValue` (per hour not worked) and `terminalEnergyValue` (end-of-
  window energy). Fatigue alone never leaves the end of the window idle — it
  only produces instrumental mid-day rest. §8.4 lists rejected satiety forms.
- Warm-up `p(s)` uses a per-task session phase with **decaying carryover**:
  leaving a task for a gap `g` and returning resumes at `s·e^(−g/τ)`
  (`resumptionTimeConstant`), not 0. `normalizeSchedule` merges adjacent
  same-task blocks. Fragmentation stays costly (probe-verified), just not the
  old hard-reset cliff.
- Reservoirs follow `dC/dτ = −α·w·C + r'·g·(1−C)` with recovery gate
  `g = 1−(1−b)·w` (`b = microRecoveryFraction`, default 0.05) and
  `r' = recoveryRate·restRecoveryMultiplier` — closed-form exponential per
  block, no ODE solver. The gate keeps a full-demand (w = 1) task above the
  floor `b·r'/(α+b·r')` instead of draining to zero; without it, demand 10 vs
  9.5 flips the plan (knife edge). A `(1−w^q)` gate does **not** fix this
  (still 0 at w = 1, probe-verified) — don't re-propose it. `b = 0` recovers
  the pure `(1−w)` gate. §8.5.
- Output gate is Cobb-Douglas: `C_cog^wc · C_phys^wp`, demands
  `w = dimensionDifficulty/10`. Block output uses composite Simpson with ≥16
  nodes per fastest timescale (min of ϕ, 1/ρ) — relative error ~1e-6 even for
  near-floor ϕ tasks in long blocks.
- The optimizer is a deterministic multi-seed steepest-ascent local search
  over (task|rest, duration) block schedules: not slot-greedy (myopic, never
  rests), not full DP. Pure single-step moves strand ~1% of the objective and
  can return the wrong plan **structure**, so it also has compound moves
  (transfer between blocks, half-block reassign, T*-session insert) and
  drop-one classic seeds — keep those when touching the search. §8.6.
- **Calibration order is load-bearing** (§8.7/§8.9/§8.10). Recovery `r` is
  fitted first from ☕ pre/post-rest pairs — during pure rest the law loses α
  entirely, so rest data identifies `r·m` on its own. The α drain rates are
  then fitted **conditioned on that recovery**, which is what makes α
  identifiable at all; `recoveryRate` is _not_ identifiable from end-of-session
  ratings, so don't try. λ₀ is fitted last, conditioned on everything else.
  Each fit is a 1-D ridge toward the **defaults**, not toward current inputs.
  Ratings with demand 0 carry no signal and are dropped.
- A fit never writes params silently: the "Apply fitted rates" button copies
  it into the manual inputs.
- The Lab never writes to the daily session. Its params live in IndexedDB
  (`settings` store, key `energyParams`) — see R4 — and are orchestrated by
  `business/store/energy-lab-store.svelte.ts`, not by the route.

---

## 4. Verification

Before claiming a change works:

```sh
npm run check      # svelte-check — must be 0 errors
npx eslint .       # includes the layer-boundary rules
npm run test:unit -- --run
npm run test:e2e
```

`npm run depcheck` for the dependency-cruiser rules (no cycles, no orphans).
CI (`.github/workflows/ci.yml`) runs svelte-check, eslint, the vitest projects
and Playwright on every push/PR to `main`. `prettier --check` is deliberately
**not** in CI, and this repo does not run prettier over the tree.

Vitest has three projects: `server` (node, `*.test.ts`), `client` (real
chromium, `*.svelte.{test,spec}.ts`), `storybook`.

**Driving the real app:** see the `verify` skill. Two gotchas that will cost
you an hour otherwise:

- A **long-running dev server is not a valid test target** after a batch of
  edits — it will serve a stale module graph and produce failures that do not
  reproduce. Verify against `npm run build && npx vite preview`, or a
  freshly-started dev server.
- All data is client-side IndexedDB, so a headless profile starts empty. Seed
  through the UI and wait ~600ms for the debounced autosave.

---

## 5. Settled decisions — do not re-litigate

Each of these was considered and decided. Re-deciding them is churn.

- **`zenith.ts`, `zenith-energy.ts` and `session-store.svelte.ts` are
  deliberately deep modules** — large implementations behind tiny interfaces.
  A 2026-07-23 interface analysis found every proposed split would force
  currently-private helpers (`amplitudeRatio`, `phiQuadratureNodes`,
  `reservoirLaw`, date-routing state) into cross-module exports: more surface,
  not less. Don't split on line count. The one seam worth cutting (generic 3×3
  linalg → `linalg.ts`) is cut.
- **Metric color-band thresholds live in the presentation layer** (`status.ts`,
  `metric-descriptor.ts`). Banding a reading as good/bad is display policy,
  not domain math.
- **`buildCurves` is not cached.** Known perf headroom, a deliberate non-fix at
  current plan sizes.
- **Human Capacity is unclamped** — it is allowed to read over 100%.
- The productivity curve deviates from the source article on purpose (§6).
- **No page is prerendered, including `imprint` and `privacy`.** Every page
  goes through a root layout that personalises the response per-cookie, so a
  build-time render bakes the defaults in. Measured on a real build served by
  `vite preview` with `theme=abyss; PARAGLIDE_LOCALE=de; scenerySeed=42`
  (2026-07-26):

  |                              | prerendered                   | today                            |
  | ---------------------------- | ----------------------------- | -------------------------------- |
  | served `<html>`              | `class="fallow "` `lang="en"` | `class="abyss dark"` `lang="de"` |
  | served `<h1>`                | `Imprint`                     | `Impressum`                      |
  | `scenerySeed` on a cold load | the one baked at build        | the visitor's cookie             |

  Hydration repairs the class and the copy, so theme and locale cost a FOUC
  rather than a wrong page — but avoiding exactly that FOUC is the entire
  reason the theme is stamped server-side, and it would hit precisely the
  cold arrivals (search results, shared links) that these pages exist for.
  The seed is not repaired: `ThemeStore` reconciles the theme against the
  cookie in the browser but not the seed, so a cold-loaded prerendered page
  renders different scenery from the rest of the session. The gain — two
  trivial renders moved to the CDN — does not pay for that.

- **`sitemap.xml` and `robots.txt` prerender only when `PUBLIC_SITE_URL` is
  set** (`export const prerender = Boolean(env.PUBLIC_SITE_URL)`). Both must
  emit absolute URLs; an unconditional prerender bakes in SvelteKit's
  `http://sveltekit-prerender` placeholder.

## 6. Known open items

- Persisted energy params are validated (`sanitizeEnergyParams`), but no other
  persisted setting has a validator yet — add one with each new setting.
- **`PUBLIC_SITE_URL` is unset on Vercel** (see `.env.example`). It is the only
  environment variable the app reads. Production origin:
  `https://zenith-drab-psi.vercel.app` — no trailing slash, **Production scope
  only**, so preview deploys keep falling back to their own request origin
  instead of claiming to be canonical. Without it, SEO tags, `sitemap.xml` and
  `robots.txt` fall back to the request origin (splitting indexing between the
  production domain and every `*.vercel.app` alias), and the two crawler files
  stay dynamic instead of prerendering.
- `app.html`'s inline pre-paint script hardcodes the dark default's classes;
  it is the one place the catalogue in `business/model/theme.ts` cannot reach,
  so it must be updated by hand if `DEFAULT_DARK_THEME` changes.
