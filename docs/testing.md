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

### A test that is hard to arrange is a design report

Above is the placement half — code you cannot test at any level is in the wrong
file. This is the shape half: code you can only test by mocking a module is
usually in the wrong **signature**. The tell is reaching for `vi.mock` to build
the **arrange** rather than to silence a side effect — you cannot vary an input
you cannot pass, so the case you meant to write is unconstructible and one mock
ends up serving both the setup and the assertion.

The fix is a parameter. Every store rule in
[business/AGENTS.md](../src/lib/business/AGENTS.md) that injects a collaborator
is this signal acted on — the notify thunks, `SessionStore`'s `ReadDateParam`,
`ThemeStore`'s two appearance snapshots, whose precedence no test could set up
while the store read `document.cookie` for itself.

Mocking is not itself the smell: silencing I/O, freezing a clock or stubbing a
write you are about to assert on stays correct — `theme-store.svelte.spec.ts`
mocks the appearance repository's write side, and only that.

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
`scripts/inset-contrast.mjs` drives :6006 the same way, for the pair axe cannot
see either: `--surface-inset` is derived from the card it sits in, so the only
reading that means anything is the well against ITS OWN CARD, and the Theme >
Swatches story composites every surface over the page instead. It has a story of
its own (Theme > Inset on card, the real `log-row` inside a `card-shell`) and
checks two ratios per theme — the well against the card, and the row's label
against the well.

A note in a story file never goes in an HTML comment. `addon-svelte-csf` takes the
last markup comment it walked past and writes it into the next story's
`parameters.docs.description.story`, so the note becomes prose on the autodocs page —
first line as a paragraph, the indented rest as a code block, which is what broke the
Dialog page. A blank line does not detach it; only moving it out of the markup does.
The note goes at the top of the story's `play` body, or inside its `args` object when
it has no play, or — for an `asChild` story with neither — in the module script,
labelled `// <Story name="…"> — …`.

A story that opens a **dialog** has three things working against it, and all three
bit before they were handled. Content is portalled to `document.body`, so it is
reached through `within(document.body)` and never the story's `canvas`. It enters on
a `fade-in-0`, so `toBeVisible` on something inside it races the opacity it starts
at — assert `toBeInTheDocument` instead. And bits-ui's body scroll lock puts
`pointer-events: none` on the body, lifted on a TIMEOUT after the last lock goes, so
a play that ends with a dialog open — or fails before closing one — hands the next
story a page it cannot click, in whatever file that story lives in. Each play still
closes what it opens (waiting for both the unmount and the lock), and
`.storybook/preview.ts`'s `beforeEach` clears the body's `pointerEvents`/`overflow`
so no story can inherit another's lock.

A component whose root is a `<tbody>` — both task rows, through
`task-row-shell.svelte` — cannot be rendered bare: with no table around it every
cell lays out as an inline box, so a visual or axe assertion reads the wrong DOM.
Those stories set `render: template` in `defineMeta` and wrap the component once
for the whole file (`{#snippet template(args: ComponentProps<typeof X>)}`, typed
because a snippet referenced through a variable gets no contextual type).

## The five commands

These define green, and CI (`.github/workflows/ci.yml`) runs all of them on
every push/PR to `main`:

```sh
npm run check      # svelte-check + tsc on the service worker — must be 0 errors
npm run lint       # prettier --check, eslint (layer-boundary rules), and the six script checks
npm run depcheck   # dependency-cruiser: layer direction, no cycles, no orphans
npm run test:unit -- --run
npm run test:e2e
```

**An agent runs three of the five; `lint` and `test:e2e` are the user's and
CI's.** Those two re-prove the whole tree to check one diff. The other three
are cheap and one of them is load-bearing:

- **`npm run check`** — 13 s, and the only type check there is. `eslint.config.js`
  enables `ts.configs.recommended` and no type-checked rule set, so nothing else
  in the repo sees a type error. Run it yourself rather than leaving it to the
  `Stop` hook below: the hook is the backstop, and a type error caught there
  surfaces after you thought the work was done.
- **`npm run depcheck`** — 2 s, and the half of R1 eslint cannot see (a dynamic
  import, a `.svelte` type-only crossing).
- **The test file you wrote or touched**, because R6 is not satisfiable
  otherwise — you have to watch it fail and then pass
  (`npm run test:unit -- --run path/to/file`). The full `test:unit` stays the
  user's: three projects, two of them real browsers.
- **`npx prettier --write`** on the files you touched (never the tree).

The costs above are this repo on a 4-core box, 2026-09-04; re-time them rather
than trusting the figures if one starts to feel expensive. These two used to be
excluded along with `lint` and `test:e2e`, on the argument that the five "cost
minutes of tokens to sit through" — which was never true of a 13 s command and
a 2 s one. What is true of `lint` and `test:e2e` is the other half of that
sentence: they re-prove the whole tree, and `test:e2e` drives a browser. That
is the line, not the clock.

**prettier** and **`check`** are also held by a `Stop` hook
(`.claude/hooks/verify-before-finish.mjs`), so `depcheck` and the test run stay
yours to remember: finishing is blocked while `prettier --check`, `eslint`,
`check` or the six doc scripts fail, and the failure comes back as the text to
fix rather than as advice. It exists because the rule-adherence eval found
eslint-enforced rules broken in about a third of runs — an agent that had run
the linter could not have broken them, so what was missing was never the
wording. That argument reads across to `check` unchanged: a documented-only
instruction to type-check is the same shape as a documented-only lint rule.
`prettier` and `eslint` run on the changed files alone, so a pre-existing
failure in code you did not touch cannot block a finish; `check` reads the
project rather than a file list, and the six doc scripts take no paths, so
those can — `check` at least skips the stops where nothing but `.md` changed.
Not the stops with no source file: a `messages/*.json` value can fail `check`
on its own, per the trap below. It stands aside on a second stop so it can
never loop.

Then hand the work over saying **what you ran and what you did not**. "Tests
pass" means the file you ran; do not report a green tree you never saw. A
change is not done until the five are green, but that gate is the user's to
run, not the agent's to narrate.

Three notes on `check`. It also type-checks `src/service-worker.ts` through
`tsconfig.worker.json`, because SvelteKit's generated tsconfig `exclude`s that
file and it would otherwise never be checked. And `svelte.config.js` exists
only so svelte-check and eslint compile in the same runes mode the build forces
— `sveltekit()` takes its options inline in `vite.config.ts`, so the build
ignores the file and says so. Keep `runes` in step across the two.

The third is a trap in `messages/*.json`, not in code: **a message value must not
end with `@`.** Paraglide inlines a no-input message's value into a JSDoc table
(`| "Flow @" |`), where `@"` is an unterminated tag, so `check` fails inside
generated code with `Identifier expected` at
`src/lib/paraglide/messages/<key>.js`. A trailing space does not help — the value
is trimmed before it is inlined. Mid-value is fine (`flow @ {flow}` has always
shipped): only a `@` with no identifier after it breaks the parse.

`lint` is eight checks, and five of them fail on prose rather than code:
`math-index.mjs --check` on MATH.md's section index (R7 step 5),
`math-citations.mjs --check`, which resolves every MATH.md `§`-citation in
tracked source and prose against MATH.md's actual headings — the direction
`math-index.mjs` doesn't cover — skipping the `§12-14`-style range form,
`probe-registry.mjs --check` on [`scripts/PROBES.md`](../scripts/PROBES.md) —
both because a hand-maintained index silently rots — `brief-size.mjs --check`,
which holds a per-file line budget over every rules doc the routing table names
(the brief alone was the one file not growing), and `comment-density.mjs
--check`, which fails when a **component's** comments do and measures no `.ts`
module at all. The last two are the only mechanical defence the doc split has:
nothing else notices an argument being pasted into a rules file, or into a
component's header, instead of into the file that owns it. Both count volume
and neither can tell an earned _why_ from archaeology, so AGENTS.md §0 still
governs. The eighth,
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

`eslint .` is clean: zero errors and **zero warnings**. There is no warning
baseline, so a warning is a regression — do not introduce one. `max-depth` is
`['error', 3]` everywhere, `scripts/**` included; the two exceptions are
`zenith.ts` and `zenith-energy.ts` at `['error', 4]`, a cap and not an
exemption (`eslint.config.js` says why, and a fifth level still fails).

Two idioms keep a search loop inside that limit. Enumerate a lattice as one
counter in base (ceiling + 1), so the arity is a digit count rather than a
nesting level — `bruteForceThree` and `bruteForceMixedDay` in `zenith.test.ts`.
Or fold the guard into the loop itself: `max-depth` counts an `if` as a level
whether or not it opens a block, so the guard inside the innermost loop is
usually what trips it, not the loop. Two shapes, both in `zenith.ts` — an
`if (…) push` over an index range becomes a `filter` over that range (the mask
expansion), and a `break` becomes a conjunct of the `while` it breaks out of
(the eviction loop).

Both are usually free; `zenith.ts`'s two measure as costing nothing. What is
not free is materializing a search loop's iteration space in order to flatten
it — `scripts/max-depth-fold-cost.probe.ts` prices that fold on the allocator's
donor×give pairs and it loses on every run, which is why the two exceptions
above exist rather than a third fold. Measure before flattening a loop that
runs inside a search, and quote the probe's band across runs, never one run's
ratio.

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
committed because the alternative is the failure that wrote this rule: the
sweep behind "the trim is free" was thrown away, so the claim could not be
re-checked and stayed in `MATH.md` while being false.

- **Seed the randomness.** A quoted number must be reproducible, not
  re-rollable — and a curated fixture and a random sweep answer different
  questions, so keep both (600 random days show the trim free on all 404
  levers; the pool-bound fixture beside them is non-free on 103 of 126).
- **A wall clock is a range, not a figure.** Everything else a seeded probe
  prints is reproducible byte-for-byte; a timing is not, and quoting it like one
  invents precision. Print the spread the reps were read at, quote only the
  digits that survive a re-run, and check the conclusion against the whole band
  — if the decision moves inside it, the measurement is not finished and the
  answer is more reps, not a rounder number.
  `energy-search-gap.probe.ts` is the worked example: four runs of one arm read
  1.28×–1.62×, 1.27×–1.60×, 1.23×–1.68× and 1.26×–1.58× for the same comparison,
  so roughly 1.2×–1.7× is the result and no cell is. Read them on an IDLE box:
  one earlier run of that arm, taken while other probes held the cores, put 2.84×
  on the same cell — outside the whole idle band, with its neighbours' printed ±
  running to 51% against the 2% an idle run reads. Note that the spread WITHIN a run and the
  spread BETWEEN runs are different quantities and the first can be much the
  smaller — on the same statistic that arm's budget sweep reads ±5% across its
  own reps and ±9% across three runs — so a printed ± is the instrument's
  precision, not the figure's reproducibility.
- **Quote the number in the probe, not in prose. And do not describe what
  MATH.md says about it.** A figure belongs in the file that can re-derive it —
  the probe's header, beside the run that produced it. The reverse direction is
  the same rule read backwards: a header that says "MATH.md claims X" outlives
  the section it quotes, and `math-citations.mjs` cannot see the rot — it
  resolves `§N` to a heading, never to what that heading still says, and an
  unnumbered "MATH.md says" it cannot see at all. State the claim; the probe is
  what answers it.
  Nothing runs a probe on a schedule, so a figure copied into a document that
  cannot re-run rots silently and the copy is the last thing anyone checks. This
  used to be handled by hand-dating every quoted number; MATH.md carried 182 of
  those stamps in one section and eleven of its figures were stale anyway. So
  MATH.md now holds derivations only (R7) and the dating rule is gone with them.
- **Reachability: required where a number is quoted, optional where a bound is
  pinned — but then declared.** `EnergyTaskInput.difficulty` and its two demands
  are independent knobs of the MODEL's input type; the app's projection onto it
  is `toEnergyTask`'s business, and `getEffectiveDifficulty` couples them
  (sliders 9/1 give demands 0.9/0.1 and difficulty **9.3**, never 1). So most
  fixtures are legitimately off the surface — the majority of
  `zenith-energy.test.ts`'s `makeTask` calls are — and "every task must be reachable" is the wrong rule.
  The rule is: a day whose numbers get QUOTED, or that witnesses APP-level
  behaviour, has to be one `toEnergyTask` could produce. A model-level property
  or bound test may sit off the surface and often should, and then it says so in
  a sentence — which extreme it is, and why the reading survives it. See
  `energy-search-gap.probe.ts` ("here that is the point"),
  `session-row-truncation.probe.ts` and `enb-simpson-error.probe.ts`, whose
  off-surface extreme is measured against the worst reachable task rather than
  argued — and measured PER BLOCK LENGTH, because a global maximum over cells and
  lengths together hid that the same witness is exceeded at eight of the thirteen
  lengths it prints (ROADMAP M40, M44, M48, M55).
- **Pin what the probe found with one fixture in the suite**, never the sweep
  itself.
- **Pin it against a literal, never against the constant it bounds.**
  `expect(fit.alpha).toBeLessThanOrEqual(ALPHA_FIT_MAX)` moves with
  `ALPHA_FIT_MAX`, so it holds at any value and pins none. Perturbing all 40
  module-level model constants against the suite (2026-08-20, ROADMAP M45)
  found 9 survivors, two of them surviving exactly this way and four more
  because nothing asserted a ± the Energy page prints. That sweep is the only
  check for this; nothing in `npm run lint` can see it.

## Driving the real app

See the `verify` skill. Three gotchas that will cost you an hour otherwise:

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
