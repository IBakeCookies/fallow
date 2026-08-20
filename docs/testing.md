# Testing and verification

R6 and the verification gate, in full. Read with the root
[AGENTS.md](../AGENTS.md).

## R6 — Test first: write it, watch it fail, then implement

No exceptions for "small" — where "small" means a small _behaviour_ change, not
a small diff. A one-line fix to a model is a behaviour change and takes a test;
retitling a card, adding a translation key or renaming a token is not, and
takes none (the reviewer table below draws the same line for the same reason).

The test comes **before** the implementation, and you must **see it fail for
the reason you expect** — not error out on a typo, a missing import, or a
locator that never matched. A test written after the code is a description of
whatever the code happens to do; only a test you watched go red proves it can
catch the thing coming back.

This applies to features as much as to bugs. Write the assertion for the
behaviour you are about to add, run it, read the failure, then build. If the
"failure" is anything other than the behaviour being absent, the test is wrong
— fix the test before touching the implementation.

Pick the level:

| Change                            | Test                                                   |
| --------------------------------- | ------------------------------------------------------ |
| Math / model                      | `*.test.ts` beside it, asserting the identity or bound |
| Metric composition, scoping       | `daily-metrics.test.ts` — scope invariants             |
| Repository, migration, IDB schema | `*.test.ts` with `fake-indexeddb`                      |
| Store (needs a component context) | `*.svelte.spec.ts` + a test harness component          |
| Component                         | `play` function on its story (`storybook` project)     |
| Component, not story-expressible  | `*.svelte.spec.ts` — module mocks, rerender, head      |
| A user-visible flow               | `e2e/*.e2e.ts`                                         |

**Check for existing coverage first; when there is none, adding it is part of
the change, not a follow-up:**

- **Fixing a bug** — the failing test comes from the _reproduction_, so write
  the repro first and let it dictate the test.
- **Adding a feature** — it ships with tests for its own behaviour, including
  the empty, failed and boundary cases, not only the happy path. One test per
  behaviour, not per branch: a suite that grows faster than the feature is a
  cost, and every test is code that has to be maintained too.
- **Refactoring** — pin the behaviour _before_ moving it: add the test against
  the OLD code, confirm it passes, then refactor. That is what makes it a
  safety net rather than a description of whatever the new code happens to do.
- **Moving logic between layers** — coverage moves with it. When a component
  stops computing something, the assertion that used to prove it (a rendered
  label, say) no longer does; re-assert wherever the logic landed.

"There was no test for this before" is a reason to write one, never a reason to
skip it. If a change genuinely cannot be tested, say so explicitly and why —
usually a sign it is in the wrong file (R2).

Test the invariant, not the implementation: "completing a task must not move
plan-scoped metrics" — a rule that has actually been violated — not that a
function returns what it returns.

`vite.config.ts` sets `expect.requireAssertions: true`; a test with no assertion
fails. `vitest.probe.config.ts` deliberately does not.

Vitest has three projects: `server` (node, `*.test.ts`), `client` (real
chromium, `*.svelte.{test,spec}.ts`), `storybook`.

`.storybook/preview.ts` builds the theme toolbar from the catalogue in
`business/model/theme.ts` and stamps the theme classes onto `<html>` the way
`hooks.server.ts` does, so a story is reviewable on any theme in the catalogue.
`presentation/theme.stories.svelte` is the componentless one: a tall page for
judging a theme's background, scenery and token swatches, parked outside
`style/` on purpose (STYLE.md's scanner note). `@storybook/addon-a11y` runs axe
on every story with `test: 'error'` — an a11y violation **fails CI**.
`theme.stories.svelte` opts out of `color-contrast` only: it renders every
fill/ink pair on purpose, including the handful that cannot reach 4.5:1 (see
STYLE.md's ink note; the budget is measured by `scripts/ink-contrast.mjs`).
Contrast stays enforced on every real component. Storybook is also what
`scripts/hover-contrast.mjs` drives (on :6006, unlike the ink script): axe only
ever sees a story's REST state, so every hover fill's step and label contrast
is measured there instead, over every theme × the 5 button variants that carry
a hover fill (`link` carries none, so it is not measured).

## The five commands

These define green, and CI (`.github/workflows/ci.yml`) runs all of them on
every push/PR to `main`:

```sh
npm run check      # svelte-check + tsc on the service worker — must be 0 errors
npm run lint       # prettier --check, eslint (layer-boundary rules), and the five script checks
npm run depcheck   # dependency-cruiser: layer direction, no cycles, no orphans
npm run test:unit -- --run
npm run test:e2e
```

**An agent does not run the full five — the user does, and CI does.** They cost
minutes of tokens to sit through and they re-prove the whole tree to check one
diff. What an agent runs instead is the narrow thing its own change needs:

- **The test file you wrote or touched**, because R6 is not satisfiable
  otherwise — you have to watch it fail and then pass
  (`npm run test:unit -- --run path/to/file`).
- **`npx prettier --write`** on the files you touched (never the tree).
- Anything the change itself puts in doubt — `npm run check` after a type-level
  change, `npm run depcheck` after moving a module across layers.

The second of those is also held by a `Stop` hook
(`.claude/hooks/verify-before-finish.mjs`): finishing is blocked while
`prettier --check`, `eslint` or the five doc scripts fail on a changed file, and
the failure comes back as the text to fix rather than as advice. It exists
because the rule-adherence eval found eslint-enforced rules broken in about a
third of runs — an agent that had run the linter could not have broken them, so
what was missing was never the wording. It is scoped to changed files, so a
pre-existing failure elsewhere cannot block a finish, and it stands aside on a
second stop so it can never loop.

Then hand the work over saying **what you ran and what you did not**. "Tests
pass" means the file you ran; do not report a green tree you never saw. A
change is not done until the five are green, but that gate is the user's to
run, not the agent's to narrate.

Two notes on `check`: it also type-checks `src/service-worker.ts` through
`tsconfig.worker.json`, because SvelteKit's generated tsconfig `exclude`s that
file and it would otherwise never be checked. And `svelte.config.js` exists
only so svelte-check and eslint compile in the same runes mode the build forces
— `sveltekit()` takes its options inline in `vite.config.ts`, so the build
ignores the file and says so. Keep `runes` in step across the two.

`lint` is seven checks, and four of them fail on prose rather than code:
`math-index.mjs --check` on MATH.md's section index (R7 step 5),
`probe-registry.mjs --check` on [`scripts/PROBES.md`](../scripts/PROBES.md) —
both because a hand-maintained index silently rots — `brief-size.mjs --check`,
which fails when the root `AGENTS.md` grows past its line budget, and
`comment-density.mjs --check`, which fails when a component's comments do. The
last two are the only mechanical defence the doc split has: nothing else
notices an argument being pasted into the brief, or into a component's header,
instead of into the file that owns it. Both count volume and neither can tell
an earned _why_ from archaeology, so AGENTS.md §0 still governs. The seventh,
`file-names.mjs --check`, holds §2's kebab-case rule. `prettier --check` covers
the whole tree, so format the files you touched (`npx prettier --write`) and
never the tree.

`depcheck` is the other half of R1's enforcement, and it catches what eslint
cannot. `no-restricted-imports` in `eslint.config.js` matches the `$lib/...`
**specifier string** — a dynamic `import('$lib/data/...')` crossing is invisible
to it, and a relative one only cannot hide because relative specifiers are
banned outright. `.dependency-cruiser.cjs` resolves modules to disk; its four
directional rules — `data-not-to-upper-layers`, `business-not-to-presentation`,
`presentation-not-to-data`, `presentation-not-to-business-model`, all
`severity: 'error'` — catch those, `src/lib/paraglide` included: only its
generated `messages` are excluded from the cruise, and the rest of the directory
is exempt from `no-orphans` alone.
One gap worth knowing: the Svelte compiler strips `import type` before
dependency-cruiser parses a `.svelte` file, so a type-only crossing from a
component produces no edge to flag. Inside components that boundary is eslint's
alone (it does flag `import type`) — hence the error severity, and hence
persisted types coming from `$lib/business/type`.

Warnings are a known baseline, not a to-do list: 18 `max-depth` (the scheduler
loops in `business/model/zenith*.ts`, downgraded to `warn` in
`eslint.config.js` because unnesting them is a test-covered refactor, not a
lint fixup). Errors are always zero — do not add to the warning count.

`npm run depgraph` renders the module graph to `dependency-graph.svg` (needs
graphviz). It is **gitignored, not committed**: CI regenerates it every run and
publishes it as the `dependency-graph` artifact, so the current graph is a
download away instead of a 500 KB file that goes stale between commits.

Every test artefact lands under the gitignored `test-result/`: `unit/` (vitest
html report), `coverage/` (v8, over `business`/`data`/`presentation`), `e2e/`
(playwright report and traces). Coverage is a number to read, not a gate —
nothing fails on it, so it runs on CI and off locally (instrumenting every
module costs a fifth of the run). `npm run test:coverage` when you want it
here.

Traces and videos are `on-first-retry`, not `retain-on-failure`: recording every
test only to delete the recording on a green run cost a third of the e2e wall
clock (45-test subset, 6 workers: 42s → 28s; measured 2026-08-11). It is a
contention cost — six recorders on four cores — so it is nearly free at
`--workers=1`. CI retries twice, so a CI failure still ships both artefacts; a
local failure does not, and the escape hatch is `npx playwright test <file>
--trace on`. Service workers are blocked for the same reason (~10% of that
subset): only `service-worker.e2e.ts` is about the worker, and it opts back in
with `test.use`.

## The reviewer pass

**Before reporting the work as done, dispatch a read-only reviewer subagent
over the working diff.** Nothing mechanical can tell you a change is _right_; a
reviewer reading the diff cold is the only step that catches a wrong invariant,
a rule quietly broken, or a test that asserts the implementation instead of the
behaviour.

**Scope it by blast radius, and say which you picked:**

| The diff touches                                                           | Review                                   |
| -------------------------------------------------------------------------- | ---------------------------------------- |
| `business/model`, `business/store`, `data/`, or any user-visible behaviour | Full reviewer pass. No exceptions        |
| Anything with a MATH.md section, a migration, or a persisted shape         | Full pass, and give it the MATH.md §     |
| Copy, translations, comments, tokens, story fixtures, docs                 | None. Re-read the diff yourself and ship |

The middle ground is the judgement call, and it resolves toward the full pass:
if you are arguing about which row a diff falls in, it is the first row. A
rename that crosses layers is not "copy"; a "styling" change that moves a
conditional is not styling.

- `/code-review` covers the working diff; any review-focused subagent does too.
  What matters is that a second pass reads the diff, not which one runs it.
- **Give it the root `AGENTS.md` and the layer file for what the diff touches.**
  The findings worth having are mostly violations of those rules — layer
  direction (R1), logic in a route (R2), a mirrored definition (R3), a
  behaviour change with no test (R6), a formula changed without `MATH.md` (R7)
  — and a reviewer that has not read them cannot report them.

**Scope the reviewer to two things: bugs and inconsistencies.**

1. **Bugs** — a reachable input or click order that produces a wrong result,
   loses the user's typing, or writes a measurement they never gave. A bug
   report must name the inputs and the wrong outcome. Anything that cannot be
   stated that way is not a bug.
2. **Inconsistencies** — the diff contradicting itself, the rules, `MATH.md`,
   or `STYLE.md`. A comment that no longer describes its code. A test that
   passes whether or not the behaviour works.

**Ask it explicitly NOT to suggest improvements, hardening, extra abstraction,
or additional tests beyond a missing one for behaviour the diff changed.** Ask
it to say "no defects" when it finds none, and tell it that finding nothing is
a valid, expected outcome. Every reviewer will otherwise return _something_,
because that is what it was asked for.

Then, on the way back:

- **Verify each claim against the code before acting on it.** A finding is a
  claim about code, not a fact — reviewers do report things that are not true.
- **Fix bugs. Decline the rest, out loud, in one line each.** A finding that is
  real but is not a bug in what was asked for is a note, not a task; §0
  outranks it. Accepting every finding is how a small change turns into a large
  one, and that is the reviewer's job done badly by the person reading it.
- **One review pass per change.** Fix what it found, hand over, ship.
  Re-reviewing your own fixes invites a fresh set of suggestions on code that
  was fine, and the loop does not converge — it accretes.

For everything in the table's first two rows this is a step, not a suggestion.
The five commands are _mechanical_, and every hard rule exists because
something mechanical passed while the change was still wrong.

## Writing a probe

The registry itself is [`scripts/PROBES.md`](../scripts/PROBES.md). Probes are
committed because the alternative is the failure `MATH.md` already shows: the
sweep behind §14.1-2's "the trim is free" was thrown away, so the claim could
not be re-checked and stayed in the document while being false.

- **Seed the randomness.** A quoted number must be reproducible, not
  re-rollable — and a curated fixture and a random sweep answer different
  questions, so keep both (600 random days show the trim free on all 404
  levers; the pool-bound fixture beside them is non-free on 103 of 126).
- **Date the number where it is quoted.** `MATH.md` already does this ("Probe
  2026-07-27", "measured 2026-08-04"). `scripts/` is linted but sits outside
  `tsconfig.json`, and nothing runs a probe on a schedule, so one rots quietly;
  the date is what tells a reader whether the figure has been re-run since the
  code under it moved.
- **Pin what the probe found with one fixture in the suite**, never the sweep
  itself — §14.2's multi-gainer tie-break is pinned exactly that way.

## Driving the real app

See the `verify` skill. Two gotchas that will cost you an hour otherwise:

- A long-running dev server is **not a valid test target** after a batch of
  edits — it serves a stale module graph and produces failures that do not
  reproduce. Verify against `npm run build && npx vite preview`, or a
  freshly-started dev server.
- All data is client-side IndexedDB, so a headless profile starts empty. Seed
  through the UI and wait out the debounced autosave on `AUTOSAVE_DEBOUNCE_MS`
  / `e2e/helpers.ts`'s `AUTOSAVE_MS`, never a literal.
- A measurement's write is not debounced but it is still in flight, and
  `page.goto` aborts an open transaction — so never navigate straight off a log
  or a correction. Wait for the reading the store publishes from its re-read
  (the row's chip, the card's count, the list's duration): it lands only once
  the write committed. A count that held before the save proves nothing. This
  loses the race on a FAST machine, so `--workers=1` reproduces what six
  parallel workers hide, which is what CI runs.
