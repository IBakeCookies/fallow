# AGENTS.md — working rules for Fallow

The brief every change reads. It holds the **rules**; the argument behind each
one lives in the file that owns it, and you read that file only when your task
touches its area. Everything here is short on purpose — the reasoning is not
missing, it is one hop away.

## The documentation

| File                                                               | Read it when                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **this file**                                                      | always                                                                                      |
| [`src/lib/data/AGENTS.md`](src/lib/data/AGENTS.md)                 | touching repositories, IndexedDB, migrations, persisted shapes                              |
| [`src/lib/business/AGENTS.md`](src/lib/business/AGENTS.md)         | touching stores, state, the business-layer root                                             |
| [`business/model/AGENTS.md`](src/lib/business/model/AGENTS.md)     | touching the model — invariants and the settled model decisions                             |
| [`src/lib/presentation/AGENTS.md`](src/lib/presentation/AGENTS.md) | touching routes, components, the task rows, the log history                                 |
| [STYLE.md](src/lib/presentation/style/STYLE.md)                    | touching markup, classes, tokens, themes                                                    |
| [docs/testing.md](docs/testing.md)                                 | writing a test, verifying, or dispatching the reviewer                                      |
| [docs/design.md](docs/design.md)                                   | arguing about where code goes, a split, or an abstraction                                   |
| [docs/deployment.md](docs/deployment.md)                           | touching SSR, the service worker, locales, SEO, prerendering                                |
| [MATH.md](MATH.md)                                                 | changing a formula — **authoritative**. Read the section, not the file (`## Section index`) |
| [scripts/PROBES.md](scripts/PROBES.md)                             | adding or citing a probe                                                                    |
| [ROADMAP.md](ROADMAP.md)                                           | planned work in priority order — update when an item ships                                  |
| [README.md](README.md)                                             | user-facing: what the app does and how to run it                                            |
| [zenith.md](zenith.md)                                             | never a spec — a frozen copy of the source article, historical only                         |

New durable knowledge goes in the file that owns the area, never in a new
top-level `.md`. **This file keeps statements; every "because" longer than a
line belongs in the topic file.** That is what stops it growing back into the
1800-line document it was, and `scripts/brief-size.mjs` fails `npm run lint`
when it starts to.

---

## 0. Less code, fewer bugs

The rule that outranks every rule below: **build the simplest thing that does
what was asked, and nothing else.** Think like an architect about where code
goes; do not let that turn into building for a future nobody has asked for.

- **Ship the ask, not the ask plus your improvements.** A form that opens on
  check and closes on uncheck is a form that opens on check and closes on
  uncheck. Flags, live regions, extra guards and defensive branches that were
  not asked for are not free — every one is state to reason about, a comment to
  keep true, and a test to maintain.
- **No speculative generality — but shape the interface at the first caller.**
  No abstraction, parameter or branch for a second caller that does not exist;
  extract a shared module on the _second_ real duplication (R3), not in
  anticipation of one. What a function _takes and returns_ is the exception: it
  is decided once, at the first caller, and waiting costs more than it saves.
  Generality that keeps the same functionality and makes the caller shorter is
  free (`delete(start, end)` over `backspace(cursor)`); generality that adds a
  capability nobody asked for is the thing this rule bans.
- **Complexity needs a reachable failure to justify it.** If you cannot name
  the inputs and the wrong outcome, the branch does not go in. "Defensive" is
  not a reason; unreachable code is a lie about what can happen.
- **Comments earn their length.** One or two lines saying _why_, where the code
  cannot. A paragraph justifying a decision in a source file means one of two
  things: the decision is too clever, so simplify the code instead of defending
  it — or the justification is durable, in which case it belongs in a rules
  file and the comment is the one line that cites it.
- **When you notice something unrelated, say it; do not fix it.** A finding
  reported costs a sentence. A finding fixed costs a review, a test, and a
  larger diff for the thing you were actually asked to do.
- **Documentation is the exception to that: fix it, in the same change.** A
  rule in any file above that your change makes false — or that you discover
  was already false — is corrected in the diff that found it, never reported as
  a note. R7 says so for math and it holds everywhere: a stale rule misleads
  every future reader until someone else pays to rediscover it, and the fix is
  usually a line. Sweep the `file:line` citations that moved.

Deleting code to satisfy this rule is progress, not lost work.

The vocabulary the rest of these rules use — depth, information hiding and its
four leaks, general interface / specific functionality, and the three things
Ousterhout gets wrong for this repo — is in [docs/design.md](docs/design.md).

---

## 1. Hard rules

Each exists because it was broken before. The statement is here; the argument
is in the layer that owns it.

**R1 — Layers point one way: presentation → business → data.** `presentation`
(and `src/routes`) never imports `$lib/data/*`; persisted types come from
`$lib/business/type`. `business` never imports `$lib/presentation/*` —
including the toast API, which a store takes as an injected thunk. `data` never
imports upward; model defaults a migration needs are passed in as parameters.
`src/lib/logger.ts` sits below all three and is the only file allowed to touch
`console`. Detail per layer: [data](src/lib/data/AGENTS.md),
[business](src/lib/business/AGENTS.md) (including the three user-facing failure
surfaces), [presentation](src/lib/presentation/AGENTS.md).

Enforced twice, and the two catch different things. `no-restricted-imports` in
`eslint.config.js` matches the `$lib/...` **specifier string** — a dynamic
`import('$lib/data/...')` crossing is invisible to it, and a relative one only
cannot hide because relative specifiers are banned outright (see Code below).
`.dependency-cruiser.cjs` resolves modules to disk; its four directional rules —
`data-not-to-upper-layers`, `business-not-to-presentation`,
`presentation-not-to-data`, `presentation-not-to-business-model`, all
`severity: 'error'` — catch those. Run `npm run depcheck`; it is in CI.
`src/lib/paraglide` is generated and exempt. One gap worth knowing: the Svelte
compiler strips `import type` before dependency-cruiser parses a `.svelte`
file, so a type-only crossing from a component produces no edge to flag. Inside
components that boundary is eslint's alone (it does flag `import type`) — hence
the error severity, and hence persisted types coming from `$lib/business/type`.

**R2 — Routes and components hold no logic.** A `+page.svelte` may hold markup,
UI-only state (draft editors, toggles, view preferences), formatters and thin
`$derived` aliases of a store. Model orchestration, fits, persistence and
threshold policy go in a module — the table of which module is in
[presentation/AGENTS.md](src/lib/presentation/AGENTS.md). Reads end at a store,
and that is not a judgement call: `presentation-not-to-business-model` is an
error. If you cannot test it at any level in R6's table, it is in the wrong
file.

**R3 — One definition per concept.** A mapping, threshold, join or format used
by two subsystems is exported once, never mirrored — a second copy is a defect
the moment it exists, because nothing in either interface says the two agree,
so they are free to drift while auditing each other. If you catch yourself
writing "mirrors", "same as", or "keep in sync with" in a comment, export the
thing instead. The two task screens are this rule in the UI
([presentation/AGENTS.md](src/lib/presentation/AGENTS.md)).

Three questions that get confused with each other, and their three different
answers:

- _Should this fact live in one place?_ **At the first mirror** — the rule
  above.
- _Should this code become a shared module?_ **At the second real caller**
  (§0). One caller does not tell you where the seam is; guessing puts it in the
  wrong place, and the wrong place is harder to remove than the duplication.
- _What shape should this function take and return?_ **At the first caller,
  always.** An interface shaped around one caller's gesture leaks that caller's
  decision into the callee, which is precisely why the second gesture arrives
  needing a second method rather than a second line at the call site
  ([docs/design.md](docs/design.md)).

**R4 — Model inputs are persisted data, not preferences.** Anything the model
reads must survive a backup/restore round trip: IndexedDB via a repository for
anything that feeds a calculation, `localStorage` only for what may be lost,
`sessionStorage` only for surviving one reload, cookies only for what SSR needs
before hydration. Persisted values are user-reachable, so **validate on read,
in the business layer that owns the shape**. No store talks to a storage API
directly. Tiers, validators and the two repairs:
[data/AGENTS.md](src/lib/data/AGENTS.md).

**R5 — Business code does not import SvelteKit routing.** Stores take what they
need as arguments — the viewed day, both appearance snapshots — so they stay
testable without module mocks. `$app/environment`'s `browser` is fine where a
module really runs in both places, but **never inside an `$effect`**.
[business/AGENTS.md](src/lib/business/AGENTS.md).

**R6 — Test first: write it, watch it fail, then implement.** No exceptions for
"small", where small means a small _behaviour_ change and not a small diff. You
must see it fail for the reason you expect. Levels, the coverage rules and the
reviewer pass: [docs/testing.md](docs/testing.md).

**R7 — Math changes go in MATH.md, in the same change.** Update the section in
the same commit, cite it from the code (`// MATH.md §8.7`), log
explanation-only fixes in MATH.md §10, never "fix" the code to match
`zenith.md`, and run `node scripts/math-index.mjs` after adding or moving a
section. [business/model/AGENTS.md](src/lib/business/model/AGENTS.md).

**R8 — Changing the IndexedDB schema is a five-step change.** Bump
`DB_VERSION`, add the store guarded inside `onupgradeneeded`, add it to
`STORE_NAMES`, update the two literal store-name lists in the tests, and write
a migration if data is moving. Missing any one ships a broken upgrade or a
lossy backup — and a bump reloads every other tab.
[data/AGENTS.md](src/lib/data/AGENTS.md).

---

## 2. Conventions

Most are enforced by eslint/prettier — see the configs. The rest:

### Naming

- No abbreviations.
- Files and folders: singular, `kebab-case`. (Exception: config files whose
  name a tool dictates.)
- Slot names and emitted events: `kebab-case`.
- Functions: _imperative verb + object [+ from|to|by + target]_ — `getUser()`,
  `addItemToCart()`, `sortCompaniesByName()`.
- **Booleans start with `is`, `has` or `with`** — `isOpen`, `hasUser`,
  `withAutoLoad` — so the name reads as a claim and never as a command: a prop
  called `open` or `fitted` says nothing about whether it asks a question or
  performs an action, which is how a caller ends up passing the wrong thing.
  `can` / `must` / `should` are the same shape where the modal is the accurate
  verb (`canLog`, `mustDoToday`). A component's own mount-time copy of such a
  prop keeps the plain word (`isOpen` → `let open = $state(isOpen)`), so the two
  never shadow each other. Existing names are a baseline, not a to-do list:
  rename one when you touch it, in a change of its own.
- Data-layer controllers start with `$` + a CRUD verb: `$createX`, `$readX`,
  `$updateX`, `$deleteX`; an upsert is `$updateX`. Inside `.svelte`/`.svelte.ts`
  the `$` prefix is reserved for runes, so import the repository as a namespace.
  The one `$createOrUpdateX` and why it exists:
  [data/AGENTS.md](src/lib/data/AGENTS.md).

### Code

- Named exports only; default exports are for Svelte components. Enforced by
  `no-restricted-syntax` on `ExportDefaultDeclaration`; root `*.config.*` and
  `.storybook/` are exempt because their tool dictates the default export.
- Import through `$lib`, never a relative path — including a sibling. Three
  exemptions, each because the alias genuinely does not resolve: `./$types`
  (generated per route by `svelte-kit sync`), `e2e/` (Playwright has no Vite
  aliases), `.storybook/` (outside `src`). `component/ui/` is exempt too, for a
  different reason: `shadcn add` rewrites those barrels relative.
- `const` over `let`. Early returns over nested `if`.
- One responsibility per function. A function that _does_ something is an
  **action**; one that _reacts_ is a **handler**, named `onClick`,
  `onInputChange`. Handlers only handle — they compose actions.
- Comments explain _why_, and pay for their line count. Match the density of
  the file you are in.
- **Imports**, in order: types → external libs → internal helpers → data layer →
  business layer → presentation (big/abstract to small/specific).

Svelte and store conventions — `setXStore()`, where a store is created,
loaded-ness as a field, `createDebouncedWrite` — are in
[business/AGENTS.md](src/lib/business/AGENTS.md). Component conventions —
snippets over store reads, `{@attach}` focus, the two bits-ui menu facts,
stories — are in [presentation/AGENTS.md](src/lib/presentation/AGENTS.md).

---

## 3. Verification

Five commands define green, and CI (`.github/workflows/ci.yml`) runs all of
them on every push/PR to `main`:

```sh
npm run check      # svelte-check + tsc on the service worker — must be 0 errors
npm run lint       # prettier --check, eslint (layer-boundary rules), and the three doc checks
npm run depcheck   # dependency-cruiser: layer direction, no cycles, no orphans
npm run test:unit -- --run
npm run test:e2e
```

**An agent does not run the full five — the user does, and CI does.** They cost
minutes of tokens to sit through and they re-prove the whole tree to check one
diff. Run instead: the test file you touched (R6 is not satisfiable otherwise),
`npx prettier --write` on the files you touched (never the tree), and anything
the change itself puts in doubt — `npm run check` after a type-level change,
`npm run depcheck` after moving a module across layers. Then hand over saying
**what you ran and what you did not**.

**Before reporting the work as done, dispatch a read-only reviewer subagent
over the working diff** — unless the diff is only copy, translations, comments,
tokens, story fixtures or docs. Scope it to bugs and inconsistencies, give it
this file plus the layer file for what the diff touches, and decline every
finding that is not a bug, out loud, in one line each. The blast-radius table,
the exact reviewer brief and the probe rules: [docs/testing.md](docs/testing.md).

---

## 4. Settled decisions — do not re-litigate

Each was considered and decided, most of them measured. The verdict is here;
the evidence is in the linked file, and you need it only if you are about to
re-open one.

**Data** — [src/lib/data/AGENTS.md](src/lib/data/AGENTS.md)

- The per-day observation upsert reads through the `date` index, not a scan.
- 🪫 drain ratings do not upsert — one row per session, corrected by its own id.
- A day's fitted params are stored (`fitSnapshots`), not recomputed from logs.

**Stores** — [src/lib/business/AGENTS.md](src/lib/business/AGENTS.md)

- Task ids come from `nextTaskId` and nowhere else; an id is never recycled.
- A composed read reads each store once (`session-history.ts`).
- The banner is `StorageStatusStore`'s, and failure is tracked per reporting
  store, never as one flag.
- Drain and rest observations live in `EnergyObservationStore`; day routing,
  flow observations and routines deliberately stayed.
- Plan advice is computed on demand, never in a `$derived`.
- `EnergyLabStore` never writes the daily session, and the day window is
  `session.availableHours` — not a param.
- A task moves between days only via `moveTaskToTomorrow`.

**Model** — [src/lib/business/model/AGENTS.md](src/lib/business/model/AGENTS.md)

- The day's plan is solved once per `calculateDailyMetrics`, and the hours pass
  in input order.
- `buildCurves` is built once per search or fit.
- `zenith.ts`, `zenith-energy.ts` and `session-store.svelte.ts` are
  deliberately deep modules — measured by interface arithmetic, not asserted.
- The energy model is a peer mode, not a candidate to replace the main plan.
- Run order stays `calculateInterleavedOrder`'s nature alternation.
- ϕ stays one plane for all tasks — no per-task offsets.
- `PHI_UNCERTAINTY_RELATIVE_CAP` stays 0.5.
- Human Capacity is unclamped; Burnout Risk is not monotone in the declared
  budget, and that stays.
- The advisor ranks, it does not judge; a budget increase never enters the
  frontier; the budget levers carry unrounded hours; the budget's shadow price
  is a day-level reading, not a per-task column; the switch cost is
  instrumented but never advised.
- `mustDoToday` promises the day, not the hours.
- The productivity curve deviates from the source article on purpose.

**UI** — [src/lib/presentation/AGENTS.md](src/lib/presentation/AGENTS.md)

- A deleted task is undone from its toast; only routines get a confirm step.
- A dropped measurement is undone the same way, through a closure the store
  hands back — and every address the same drop arrives by opens the same
  window.
- Metric color-band thresholds live in the presentation layer (`utils/band.ts`),
  and a view model carries a `Band`, never a class string.
- The Lab's task list reads in schedule order, snapshotted per visit.
- The Lab's row reads the three model inputs, it does not slide them.

**Serving** — [docs/deployment.md](docs/deployment.md)

- No page is prerendered, including `imprint` and `privacy`.
- The service worker caches personalised HTML, and every personalised input is
  repaired when a stale copy is served.
- `app.html`'s pre-paint script takes its theme names from the catalogue.
- `sitemap.xml` and `robots.txt` prerender only when `PUBLIC_SITE_URL` is set,
  which is Production-scoped on Vercel.
- `/de/*`, `/es/*`, `/fr/*`, `/zh/*` are real, indexable URLs, not a cookie
  state.
