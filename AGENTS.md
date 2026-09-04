# AGENTS.md — working rules for Fallow

The brief every change reads. It holds the **rules**; the argument behind each
one lives in the file that owns it, and you read that file only when your task
touches its area. Everything here is short on purpose — the reasoning is not
missing, it is one hop away.

## The documentation

| File                                                               | Read it when                                                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **this file**                                                      | always                                                                                                                                                  |
| [`src/lib/data/AGENTS.md`](src/lib/data/AGENTS.md)                 | touching repositories, IndexedDB, migrations, persisted shapes                                                                                          |
| [`src/lib/business/AGENTS.md`](src/lib/business/AGENTS.md)         | touching stores, state, the business-layer root                                                                                                         |
| [`business/model/AGENTS.md`](src/lib/business/model/AGENTS.md)     | touching the model — invariants and the settled model decisions                                                                                         |
| [`src/lib/presentation/AGENTS.md`](src/lib/presentation/AGENTS.md) | touching routes, components, the task rows, the log history                                                                                             |
| [STYLE.md](src/lib/presentation/style/STYLE.md)                    | touching markup, classes, tokens, themes                                                                                                                |
| [docs/testing.md](docs/testing.md)                                 | writing a test, verifying, or dispatching the reviewer                                                                                                  |
| [docs/design.md](docs/design.md)                                   | arguing about where code goes, a split, or an abstraction                                                                                               |
| [docs/deployment.md](docs/deployment.md)                           | touching SSR, the service worker, locales, SEO, prerendering                                                                                            |
| [MATH.md](MATH.md)                                                 | changing a formula — **authoritative**. Derivations only: the shape and why not the alternative                                                         |
| [scripts/PROBES.md](scripts/PROBES.md)                             | adding or citing a probe                                                                                                                                |
| [ROADMAP.md](ROADMAP.md)                                           | what is next and what was refused; a shipped item or closed finding is a date and a link to its spec                                                    |
| [docs/features/](docs/features/)                                   | one file per planned change — kind `feature`, `model`, `repair` or `audit`; frozen at land                                                              |
| [`.claude/skills/`](.claude/skills/)                               | the workflow itself: `plan` writes the spec, `build` implements one, `refactor` moves shipped code, `verify` drives the app, `eval` measures these docs |
| [README.md](README.md)                                             | user-facing: what the app does and how to run it                                                                                                        |
| [zenith.md](zenith.md)                                             | never a spec — a frozen copy of the source article, historical only                                                                                     |

New durable knowledge goes in the file that owns the area, never in a new
top-level `.md`. **This file keeps statements; every "because" longer than a
line belongs in the topic file.** That is what stops it growing back into the
1800-line document it was. `scripts/brief-size.mjs` budgets **every file in the
table above**, not this one alone — capping only the brief measured the one file
that was not growing — and `npm run lint` fails when any of them is over.

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
  cannot — and only where the code cannot. Three kinds never earn it, however
  true they are: **archaeology** (a date, "used to", what the code was before —
  git holds that), **restatement** (what the signature, type, name or class
  already says), and **a rule a rules file already holds** (cite it in one line,
  or say nothing). Each arrives one plausible line at a time, which is how a
  paragraph gets built without anyone writing one. A paragraph
  justifying a decision means the decision is too clever — simplify the code —
  or the justification is durable, and belongs in the rules file that owns it.
  `scripts/comment-density.mjs --check` budgets **components only**; in a `.ts`
  module the volume is yours to hold. Where it does count it counts lines, not
  judgement, so the three above stay yours to catch either way.
- **When you notice something unrelated, say it; do not fix it.** A finding
  reported costs a sentence. A finding fixed costs a review, a test, and a
  larger diff for the thing you were actually asked to do.
- **Documentation is the exception to that: fix it, in the same change.** A
  rule in any file above that your change makes false — or that you discover
  was already false — is corrected in the diff that found it, never reported as
  a note. R7 says so for math and it holds everywhere: a stale rule misleads
  every future reader until someone else pays to rediscover it, and the fix is
  usually a line. Cite a document by section, never by line: a `file:line`
  address is stale the next time anything is inserted above it, and silently.

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
`console` (`scripts/`, `eval/` and `.claude/hooks/` aside). Detail per layer: [data](src/lib/data/AGENTS.md),
[business](src/lib/business/AGENTS.md) (including the three user-facing failure
surfaces), [presentation](src/lib/presentation/AGENTS.md).

Enforced twice, and the two catch different things — eslint on the specifier
string, dependency-cruiser on disk (`npm run depcheck`, in CI). Which catches
what, and the one gap a `.svelte` file opens:
[docs/testing.md](docs/testing.md).

**R2 — Routes and components hold no logic.** A `+page.svelte` may hold markup,
UI-only state (draft editors, toggles, view preferences), formatters and thin
`$derived` aliases of a store. Model orchestration, fits, persistence and
threshold policy go in a module — the table of which module is in
[presentation/AGENTS.md](src/lib/presentation/AGENTS.md). Reads end at a store,
and that is not a judgement call: `presentation-not-to-business-model` is an
error, and so is an `await` or a `.then()` inside a route or component
`$effect`. If you cannot test it at any level in R6's table, it is in the wrong
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
the same commit, cite it from the code (`// MATH.md §8.7`), never "fix" the code
to match `zenith.md`, and run `node scripts/math-index.mjs` after adding or
moving a section. `scripts/math-citations.mjs --check` enforces the other
direction: every `§`-citation in tracked source resolves to a heading that
exists in MATH.md. **MATH.md holds derivations, not measurements** — the formula,
why it has that shape, and why the alternative was rejected. A figure read off a
run belongs in the probe that produced it, never quoted into prose that cannot
re-run: that is what grew the file to 9,431 lines and left eleven of its numbers
stale. There is no revision log; git holds the history.
[business/model/AGENTS.md](src/lib/business/model/AGENTS.md).

**R8 — Changing the IndexedDB schema is a five-step change.** Bump
`DB_VERSION`, add the store guarded inside `onupgradeneeded`, add it to
`STORE_NAMES`, update the two literal store-name lists in the tests, and write
a migration if data is moving. Missing any one ships a broken upgrade or a
lossy backup — and a bump reloads every other tab.
[data/AGENTS.md](src/lib/data/AGENTS.md).

---

## 2. Conventions

Enforced by eslint, prettier and `scripts/file-names.mjs`, except
abbreviations, boolean prefixes and import order:

### Naming

- No abbreviations.
- Files and folders: singular, `kebab-case` — except where a tool dictates the
  name (`+page.svelte`, `(app)/`, dot files, the uppercase `.md` rule files,
  `.dc.html` design artboards).
- Slot names and emitted events: `kebab-case`.
- Functions: _imperative verb + object [+ from|to|by + target]_ — `getUser()`,
  `addItemToCart()`, `sortCompaniesByName()`.
- **Booleans start with `is`, `has` or `with`** — `isOpen`, `hasUser`,
  `withAutoLoad` — so the name reads as a claim and never as a command: a prop
  called `open` or `fitted` says nothing about whether it asks a question or
  performs an action, which is how a caller ends up passing the wrong thing.
  `can` / `must` / `should` where the modal is the accurate verb (`canLog`,
  `mustDoToday`). A component's own mount-time copy of such a prop keeps the
  plain word (`isOpen` → `let open = $state(isOpen)`), so the two never shadow
  each other. Existing names are a baseline, not a to-do list: rename one when
  you touch it, in a change of its own. Coerce with `Boolean(x)`, never `!!x`.
- Data-layer controllers start with `$` + a verb — `create`, `read`, `update`,
  `delete`, `export`, `import`, `restore`; an upsert is `$updateX`. Inside
  `.svelte`/`.svelte.ts` the `$` prefix is reserved for runes, so import the
  repository as a namespace. The one `$createOrUpdateX` and why it exists:
  [data/AGENTS.md](src/lib/data/AGENTS.md).

### Code

- Named exports only; default exports are for Svelte components. Enforced by
  `no-restricted-syntax` on `ExportDefaultDeclaration`; root `*.config.{js,ts}`
  and `.storybook/` are exempt because their tool dictates the default export.
- Import through `$lib`, never a relative path — including a sibling. Four
  exemptions, each because the alias genuinely does not resolve: `./$types`
  (generated per route by `svelte-kit sync`), `e2e/` (Playwright has no Vite
  aliases), `.storybook/` and `eval/` (outside `src`, and `eval/` is a Node CLI
  Vite never loads). `component/ui/` is exempt too, for a different reason:
  `shadcn add` rewrites those barrels relative.
- `const` over `let`. Early returns over nested `if`.
- One responsibility per function. A function that _does_ something is an
  **action**; one that _reacts_ is a **handler**, named `onClick`,
  `onInputChange`. Handlers only handle — they compose actions.
- **Imports**, in order: types → external libs → internal helpers → data layer →
  business layer → presentation (big/abstract to small/specific).

Svelte and store conventions — `setXStore()`, where a store is created,
loaded-ness as a field, `createDebouncedWrite` — are in
[business/AGENTS.md](src/lib/business/AGENTS.md). Component conventions —
snippets over store reads, `{@attach}` focus, the two bits-ui menu facts,
stories — are in [presentation/AGENTS.md](src/lib/presentation/AGENTS.md).

---

## 3. Verification

Five commands define green (`check`, `lint`, `depcheck`, `test:unit`,
`test:e2e`) and CI runs all of them. **An agent runs three of them: `check`,
`depcheck`, and the test file it touched** (R6 is not satisfiable otherwise) —
plus `npx prettier --write` on the files you touched, never the tree. `check`
is the only type check the repo has, since eslint enables no type-checked rule
set. **`lint` and `test:e2e` are the user's and CI's**: they re-prove the whole
tree to check one diff. Then hand over saying **what you ran and what you did
not**.

A `Stop` hook holds **prettier** and **`check`**: finishing is blocked while
`prettier --check`, `eslint`, `check` or the six doc scripts fail. Prettier and
eslint are scoped to the files you changed; `check` and the doc scripts take no
paths, so they read the whole tree and a failure you did not cause still blocks
you until it is fixed. `depcheck` and the test run are yours to remember — the
hook does not hold them.

**Before reporting the work as done, dispatch a read-only reviewer subagent
over the working diff** — unless the diff is only copy, translations, comments,
tokens, story fixtures or docs. Scope it to bugs and inconsistencies, give it
this file plus the layer file for what the diff touches, and decline every
finding that is not a bug, out loud, in one line each.

The commands in full, the blast-radius table, the reviewer brief and the probe
rules: [docs/testing.md](docs/testing.md).

---

## 4. Settled decisions — do not re-litigate

Each layer file ends in a **Settled decisions** section, and
`docs/deployment.md` is one from top to bottom: the verdict, and the
measurement or argument behind it. Read the one for the area you are about to
change _before_ proposing a change to it — most of what looks like an obvious
improvement in this repo has already been built, measured and refused, and the
file says which. Do not index them here: a copy of those headings is a second
definition of the same fact (R3), free to drift from the file that owns it.

[data](src/lib/data/AGENTS.md) · [stores](src/lib/business/AGENTS.md) ·
[model](src/lib/business/model/AGENTS.md) ·
[UI](src/lib/presentation/AGENTS.md) · [serving](docs/deployment.md)
