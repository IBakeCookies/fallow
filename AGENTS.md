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
- `src/lib/logger.ts`: below all three, and the only module that is. Every layer
  and the hooks report diagnostics, so a home inside any one layer would break
  the direction for the other two. It imports nothing from the app
  (`logger-imports-nothing`, an error) and is the only file allowed to touch
  `console` — `no-console` is an **error** everywhere else (`scripts/` aside,
  where console output is the point). Call `logError` / `logWarning` with a
  message, the caught error, and a `context` object of ids, dates and counts —
  never task titles or notes, which is the payload a reporting service would
  ship off-device. Plugging in Sentry or similar is one `setLogSink` call in
  `hooks.client.ts`; do not add per-call-site reporting. Logging is **not** the
  banner: `reportStorageError` raises the user-facing failure state, and most
  persistence failures do both.
- Enforced twice, and the two catch different things. `no-restricted-imports`
  in `eslint.config.js` matches the `$lib/...` **specifier string**, so a
  dynamic (`import('$lib/data/...')`) crossing is invisible to it. A relative
  one cannot hide there either, but only because the same rule bans relative
  specifiers outright (see R-Code); it is not read as a layer violation.
  `.dependency-cruiser.cjs` resolves modules to disk, so
  its three directional rules — `data-not-to-upper-layers`,
  `business-not-to-presentation`, `presentation-not-to-data`, all
  `severity: 'error'` — catch those. Run with `npm run depcheck`; it is in CI.
  `src/lib/paraglide` is generated and exempt.
- One gap worth knowing: the Svelte compiler strips `import type` before
  dependency-cruiser parses a `.svelte` file, so a type-only crossing from a
  component produces no edge for it to flag. Inside components that boundary is
  eslint's alone (it does flag `import type`) — which is why the rule is an
  error there and why persisted types come from `$lib/business/type`.

### R2 — Routes and components hold no logic

The lint rules enforce dependency _direction_, not code _placement_: a route
importing business code is legal, so logic drifts into `+page.svelte` where
nothing can unit-test it. It has happened twice (a 518-line main page, a
1349-line Energy Lab) and both had to be pulled back out.

Reads end at a store, so `presentation-not-to-business-model` in
`.dependency-cruiser.cjs` is an **error** when a route or component
value-imports `$lib/business/model/*` (stores, state, `utils`, and `import
type` are fine). Adding one is not a judgement call any more: put the
orchestration in a store and give the page the result.

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

- **IndexedDB** (via a repository, listed in `indexed-db.ts` `STORE_NAMES`,
  which `backup-repository.ts` imports): sessions, routines, observations, and
  any setting that feeds
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

**Check for existing coverage first, and add it when there is none.** Before
touching anything, find the test that covers it. If none exists, writing one is
part of the change, not a follow-up:

- **Fixing a bug** — write the failing test _first_, from the reproduction.
  Watch it fail for the stated reason, then fix the code and watch it pass. A
  fix that never had a red test does not prove the bug is gone, and nothing
  stops it coming back.
- **Adding a feature** — it ships with tests for its own behaviour, including
  the empty, failed and boundary cases, not only the happy path.
- **Refactoring** — the behaviour must already be pinned before you move it. If
  it is not, add the test against the OLD code, confirm it passes, then
  refactor: that is what makes it a safety net rather than a description of
  whatever the new code happens to do.
- **Moving logic between layers** — coverage moves with it. When a component
  stops computing something, the assertion that _used_ to prove it (a rendered
  label, say) no longer does; re-assert it wherever the logic landed.

"There was no test for this before" is a reason to write one, never a reason to
skip it. If a change genuinely cannot be tested, say so explicitly and why —
that is usually a sign it is in the wrong file (see R2).

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
3. Add the store name to `STORE_NAMES` in `indexed-db.ts` (that is where the
   list lives; `backup-repository.ts` imports it), or it is silently excluded
   from export/import/wipe.
4. Update the two hardcoded store-name lists in `indexed-db.test.ts` and
   `backup-repository.test.ts`. Keep them literal — they are an independent
   oracle, which a list derived from `STORE_NAMES` would not be. A separate
   test in `indexed-db.test.ts` asserts the created stores equal
   `STORE_NAMES`, so schema/`STORE_NAMES` drift fails on its own even if you
   update the literals wrongly.
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

- Named exports only; default exports are for Svelte components. Enforced by
  `no-restricted-syntax` on `ExportDefaultDeclaration`; root `*.config.*` and
  `.storybook/` are exempt because their tool dictates the default export.
- Import through `$lib`, never a relative path — including a sibling. Three
  exemptions, each because the alias genuinely does not resolve: `./$types`
  (generated per route by `svelte-kit sync`), `e2e/` (Playwright has no Vite
  aliases), and `.storybook/` (outside `src`). `component/ui/` is exempt too,
  for a different reason: `shadcn add` rewrites those barrels relative.
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
- **A debounce flush belongs in `onDestroy`, never in an `$effect` teardown.**
  An effect's cleanup runs before _every_ re-run, not only on destroy, so
  flushing there fires on each keystroke and defeats the debounce. Both stores
  arm their timer in an `$effect` and flush from `onDestroy` plus a
  `visibilitychange` listener — cancelling on teardown instead (the old bug)
  silently drops the last edit when the user navigates away.
- Storybook stories live **beside their component** (`*.stories.svelte`), one
  file per component or primitive group, and are rendered as smoke tests by the
  `storybook` vitest project. `.storybook/preview.ts` builds the theme toolbar
  from the catalogue in `business/model/theme.ts` and stamps the theme classes
  onto `<html>` the way `hooks.server.ts` does, so a story is reviewable on any
  of the 33 themes. `presentation/theme.stories.svelte` is the componentless
  one: a tall page for judging a theme's background, scenery and token
  swatches. It sits outside `style/` on purpose — see the scanner note below.
  `@storybook/addon-a11y` runs axe on every story with `test: 'error'`, so an
  a11y violation **fails CI**. `theme.stories.svelte` opts out of
  `color-contrast` only: it is a token swatch sheet that renders every
  fill/ink pair on purpose, including the 15 of 297 that cannot reach 4.5:1
  (see the ink note below). That budget is measured by
  `scripts/ink-contrast.mjs`; contrast stays enforced on every real component.

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
- **Never `dark:` in a component.** Not because it fails to match — it does
  match: `@custom-variant dark (&:is(.dark *))` in `tokens.css`, and 20 of the
  33 themes stamp `.dark`, `abyss`, `noir`, `meridian` and `terminal` among
  them. That is the problem. `dark:` is a **binary** over a catalogue of 33
  distinct palettes: it bakes one hardcoded dark look across all 20 (which
  `themes.css` then contradicts per theme) and does nothing at all on the
  other 13. Any light/dark difference must come from a
  token the themes already swap. Note `-strong` is not "darker" — it means
  _more contrast against this theme's own background_, so it is lighter on every
  dark theme and darker on every light one. Never use it as a fill sitting under
  light-coloured content.
- **A state or domain colour has three roles; picking the wrong one is the usual
  contrast bug.** Bare (`bg-danger`, `border-danger`) is the fill. `-strong`
  (`text-danger-strong`) is text on a _tinted_ background — the `bg-danger/5` +
  `text-danger-strong` + `border-danger/20` recipe every callout in the app
  uses, and the right choice for anything longer than a label. `-ink`
  (`text-danger-ink`) is text on the _solid_ fill, and only exists for short
  bold labels: chips, badges, chart annotations. `-strong` on a solid fill is
  the same hue twice and reads as mush.
  `-ink` is derived in `base.css` from the fill's own lightness — not the
  theme's, because the two diverge (on a light theme white reads on `danger`
  but fails on `warning`). So a theme that overrides a fill silently changes
  its ink, and `themes.css` overrides them 200+ times: after touching a state
  or domain fill, run `node scripts/ink-contrast.mjs` (dev server on :5173),
  which checks all 33 themes × 9 fills. Worst case across the catalogue is
  4.28:1, and 15 of the 297 pairs cannot reach 4.5:1 with _any_ ink because a
  mid-luminance chromatic fill caps out — one more reason solid fills are for
  labels and the tinted recipe is for prose.
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
  across all 33 themes. The plugin is nonetheless still loaded in `app.css` and
  **cannot just be dropped**: the two bare-`border` inputs in
  `page-header.svelte` inherit their border colour from its base layer. Give
  them explicit token borders first, then remove it.
- Tailwind's scanner is **textual and runs at build time**, so a name assembled
  at runtime does not exist. This bites twice: class names (`bg-{x}-500`) and
  `@theme` custom properties, which are tree-shaken to the ones the scanner
  literally saw — even one inside a _comment_ is enough to emit it. Hand-authored
  `:root` declarations in `base.css` are never tree-shaken, so build a dynamic
  `var()` name over those (`--series-N`), never over a `@theme` alias
  (`--color-series-N`). See `energy/+page.svelte`'s `PALETTE`.
- **Two namespaces, and only one of them is yours to declare.** `base.css` and
  `themes.css` own the _unprefixed_ names (`--danger`, `--ty-primary`,
  `--surface-page`, `--series-1`); `tokens.css` maps each to a `--color-*` entry
  purely to generate the utility. So `bg-danger` is the normal way to reach it,
  and any raw `var()` — JS, inline styles, SVG `fill`/`stroke` — names the
  unprefixed one. Never declare a `--color-*` yourself.
  `--color-danger: var(--color-danger)` used to be the idiom here and is now
  gone on purpose: it only worked because `app.css` imports `tokens.css` before
  `base.css`, so the real value won on source order. Flip that import order and
  every such token silently becomes a self-referential cycle resolving to
  invalid — no error, just transparent. `--radius` and `--blur` are the two
  deliberate exceptions (see the next entry); leave them alone.
- The scanner also **skips the directory holding the CSS entry point**, so a
  class whose only occurrence is inside `presentation/style/` is never emitted —
  markup belongs anywhere else. (Cost an hour: a `h-[100rem]` in a story file
  parked in `style/` silently had no height.)
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
npm run check      # svelte-check + tsc on the service worker — must be 0 errors
npx eslint .       # includes the layer-boundary rules — 0 errors, warnings are a baseline
npm run depcheck   # dependency-cruiser: layer direction, no cycles, no orphans
npm run test:unit -- --run
npm run test:e2e
```

All five run in CI (`.github/workflows/ci.yml`) on every push/PR to `main`.
Two notes on `check`: it also type-checks `src/service-worker.ts` through
`tsconfig.worker.json`, because SvelteKit's generated tsconfig `exclude`s that
file and it would otherwise never be checked. And `svelte.config.js` exists
only so svelte-check and eslint compile in the same runes mode the build
forces — `sveltekit()` takes its options inline in `vite.config.ts`, so the
build ignores the file and says so. Keep `runes` in step across the two.

`prettier --check` is not in CI, but it does pass and `npm run lint` runs it —
so keep it passing (`npx prettier --write` the files you touched, never the
tree).

Warnings are a known baseline, not a to-do list: 18 `max-depth` (the scheduler
loops in `business/model/zenith*.ts`, which `eslint.config.js` downgrades to
`warn` because unnesting them is a test-covered refactor, not a lint fixup).
Errors are always zero — do not add to the warning count.

`npm run depgraph` renders the module graph to `dependency-graph.svg` (needs
graphviz). It is **gitignored, not committed**: CI regenerates it every run and
publishes it as the `dependency-graph` artifact, so the current graph is a
download away from any run instead of a 500 KB file that was stale between the
commits someone remembered to regenerate it in.

Vitest has three projects: `server` (node, `*.test.ts`), `client` (real
chromium, `*.svelte.{test,spec}.ts`), `storybook`.

**Driving the real app:** see the `verify` skill. Two gotchas that will cost
you an hour otherwise:

- A **long-running dev server is not a valid test target** after a batch of
  edits — it will serve a stale module graph and produce failures that do not
  reproduce. Verify against `npm run build && npx vite preview`, or a
  freshly-started dev server.
- All data is client-side IndexedDB, so a headless profile starts empty. Seed
  through the UI and wait for the debounced autosave: it is 500ms in both
  stores, and `e2e/helpers.ts` exports `AUTOSAVE_MS = 1000` to wait on — use
  that rather than a literal, so the margin moves with the constant.

---

## 5. Settled decisions — do not re-litigate

Each of these was considered and decided. Re-deciding them is churn.

- **`zenith.ts`, `zenith-energy.ts` and `session-store.svelte.ts` are
  deliberately deep modules** — large implementations behind tiny interfaces.
  A 2026-07-23 interface analysis found every proposed split would force
  currently-private helpers (`amplitudeRatio`, `phiQuadratureNodes`,
  `reservoirLaw`, date-routing state) into cross-module exports: more surface,
  not less. Don't split on line count. Two seams were worth cutting and are
  cut: generic 3×3 linalg → `linalg.ts`, and the drain/rest measurements →
  `energy-observation-store.svelte.ts` (below).

  **The test is interface arithmetic, not size.** A split pays only if it
  removes more public surface than it adds. Measure before proposing one:
  `session-store.svelte.ts` was 675 lines behind **39 public members** (~1 per
  17 lines, vs. 1 per 50 in `zenith.ts`), with 34 of the 39 called from exactly
  one place — a wide facade, not a deep module. So the store's size was never
  the argument for or against.

- **Drain and rest observations live in `EnergyObservationStore`**, not the
  session store (extracted 2026-07-27). They were the one cluster whose
  extraction cost **zero** new cross-module exports: a measurement is stamped
  with the live clock's today, never the viewed day, so it needs none of the
  date-routing, load or auto-save state — only a task lookup and somewhere to
  report a failed write, both of which were already public (`tasks`,
  `reportStorageError`, and `liveToday` needs no store at all). It also needs no
  `initializeStorage()` ordering: the localStorage migration writes only
  sessions and `energyParams`, never these two object stores.

  What deliberately did **not** move, and why re-proposing it is churn:

  | Stayed                        | Because                                                                     |
  | ----------------------------- | --------------------------------------------------------------------------- |
  | Day routing + load + autosave | One concern; task mutations work _because_ the autosave effect watches them |
  | Flow observations             | `logFlow` stamps `flowMinutes` onto the task, persisted with the session    |
  | Routines                      | 3 members, needs a `tasks` thunk — not worth a file                         |
  | The `storageError` banner     | One banner app-wide; every store reports into it via `reportStorageError`   |

  Both stores can raise `'load-failed'` and neither knows about the other, so
  the layout's retry action re-runs **both** `retryLoad()`s. A new store that
  can fail a read belongs in that handler too.

- **Metric color-band thresholds live in the presentation layer** (`status.ts`,
  `metric-descriptor.ts`). Banding a reading as good/bad is display policy,
  not domain math. `metric-descriptor.ts` exports that policy as `BAND` +
  `isOutOfBand` because the plan-advice card decides which findings to surface
  from the same call the metric rows are colored by — two copies of the same
  thresholds is exactly the R3 failure.

- **Plan advice is computed on demand, never in a `$derived`** (MATH.md §14).
  `suggestPlanAdjustments` re-solves the whole day once per candidate, so cost
  scales with the 2ⁿ funded-subset enumeration: measured 12 ms for a 6-task day
  but **946 ms for a 12-task one**. In a `$derived` that is a frozen main
  thread on every keystroke in the budget field. `DailyPlanStore` therefore
  exposes `computeAdvice()` plus `adviceStale`, and staleness compares a
  **fingerprint of the inputs** — a `$derived` read from outside a reactive
  context is not guaranteed to return the same object twice, so identity
  reports staleness on a day that never changed.

- **The advisor ranks, it does not judge.** It reports every axis
  unconditionally with a lower-is-better badness function; whether a reading is
  bad enough to act on is the band above. Options per axis are the Pareto
  frontier on (improvement ↑, plan value ↑) so there is no weight λ to defend —
  see MATH.md §14 for why "the single biggest improvement" is bad advice.
- **`buildCurves` is not cached.** Known perf headroom, a deliberate non-fix at
  current plan sizes.
- **Human Capacity is unclamped** — it is allowed to read over 100%.
- The productivity curve deviates from the source article on purpose (§6).
- **No page is prerendered, including `imprint` and `privacy`.** Every page
  goes through a root layout that personalises the response per-cookie, so a
  build-time render bakes the defaults in. Measured on a real build served by
  `vite preview` with `theme=abyss; scenerySeed=42`, comparing `/imprint`
  against `/de/imprint` (2026-07-26):

  |                              | prerendered                   | today                            |
  | ---------------------------- | ----------------------------- | -------------------------------- |
  | served `<html>`              | `class="fallow "` `lang="en"` | `class="abyss dark"` `lang="de"` |
  | served `<h1>`                | `Imprint`                     | `Impressum`                      |
  | `scenerySeed` on a cold load | the one baked at build        | the visitor's cookie             |

  Locale now comes from the URL rather than a cookie, which makes the case
  stronger, not weaker: there are 12 indexable URLs and every one of them is
  still cookie-personalised for theme and seed.

  Hydration repairs the class and the copy, so theme and locale cost a FOUC
  rather than a wrong page — but avoiding exactly that FOUC is the entire
  reason the theme is stamped server-side, and it would hit precisely the
  cold arrivals (search results, shared links) that these pages exist for.
  The seed is not repaired: `ThemeStore` reconciles the theme and the scenery
  motion preference against the cookie in the browser, but not the seed, so a
  cold-loaded prerendered page
  renders different scenery from the rest of the session. The gain — two
  trivial renders moved to the CDN — does not pay for that.

- **`sitemap.xml` and `robots.txt` prerender only when `PUBLIC_SITE_URL` is
  set** (`export const prerender = Boolean(env.PUBLIC_SITE_URL)`). Both must
  emit absolute URLs; an unconditional prerender bakes in SvelteKit's
  `http://sveltekit-prerender` placeholder. The sitemap lists every route in
  **both** locales with `xhtml:link` alternates, `/imprint` and `/privacy`
  included.

- **`/de/*` is a real, indexable URL, not a cookie state.** The paraglide
  strategy is `['url', 'cookie', 'baseLocale']`; `en` stays unprefixed. Two
  consequences that are easy to get wrong:
  - Every internal `href` goes through `localizeHref`, and every comparison
    against a pathname goes through `deLocalizeHref`. A raw `===` on
    `page.url.pathname` is wrong on half the site.
  - The strategy is declared **twice** — in `vite.config.ts` for
    build/dev/vitest, and in the `paraglide` npm script for `check`/`prepare`.
    paraglide 2.x has no config file for it, so this is a deliberate,
    documented exception to R3; change one and you must change the other.

## 6. Known open items

- Persisted **settings** are validated (`sanitizeEnergyParams`) and so is the
  session shape read from IndexedDB (`sanitizeSession`), but nothing else is —
  add a validator with each new persisted shape.
- **A task cannot move between days.** Tasks live inside their day's
  `DailySession` record, so "move to tomorrow" means removing from today's
  session _and_ appending to tomorrow's. The data layer is already
  date-general (`$readSessionByDate`, `$updateSession` both take a date); the
  gap is one layer up — every write in `session-store.svelte.ts` targets the
  **viewed** day (`#tasks` plus the debounced autosave under `#selectedDate`),
  and the one method that names another date, `importFromDate`, reads _from_
  that date _into_ the current one. A real move needs its own store method,
  the existing `#loadedDate !== #selectedDate` guard so a mid-navigation write
  cannot clobber the incoming day, and a decision about what happens when the
  destination day is the one on screen.
  This is why the plan-advice card shows no Apply button on a `defer-task`
  option: the only mechanism available is `removeTask`, which discards the task
  with no undo. The advice states the price and the user acts (MATH.md §14).
- **`PUBLIC_SITE_URL` is unset on Vercel** (see `.env.example`). It is the only
  environment variable the app reads. Production origin:
  `https://zenith-drab-psi.vercel.app` — no trailing slash, **Production scope
  only**, so preview deploys keep falling back to their own request origin
  instead of claiming to be canonical. Without it, SEO tags, `sitemap.xml` and
  `robots.txt` fall back to the request origin (splitting indexing between the
  production domain and every `*.vercel.app` alias), and the two crawler files
  stay dynamic instead of prerendering.
- `app.html`'s inline pre-paint script hardcodes **two** theme names: it
  removes `DEFAULT_THEME`'s class and adds `DEFAULT_DARK_THEME`'s (it no
  longer assigns `className`, which used to wipe the server-stamped
  scenery-paused class). It is the one place the catalogue in
  `business/model/theme.ts` cannot reach, so both must be updated by hand if
  either default changes.
- The service worker caches page HTML that is **per-cookie personalised**.
  It is bounded and its failures are no longer silent, and `ThemeStore`
  repairs theme and scenery motion at hydration — but the locale and the
  SSR'd seed style are not repaired, so a served-from-cache page can briefly
  show the wrong one.
