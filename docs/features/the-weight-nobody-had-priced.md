# The weight nobody had priced

**Kind:** model · **Status:** landed 2026-09-03 · **Roadmap:** item 23 (its price, unmeasured at land)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Item 23 shipped the importance weight `v` measured for **reach** and
**delivery** — what share of days have a task it could move, and how often
raising one funds it — and never for **value**. So the one input that scales
the objective itself has no row in ROADMAP Phase 2's misdeclaration list, which
prices ϕ, enjoyment, both difficulties, the pools and the switch cost. This
measures that row: what a day planned with every task left at `normal` costs in
`Σ vᵢ·P̄ᵢ`, at the scope that list uses. It measures one more beside it — what a
**wrong** weight costs against no weight at all — because that is the number
that decides whether a remembered weight is worth carrying.

Nothing user-facing changes and no formula moves. `IMPORTANCE_WEIGHT`, the
three levels and the allocator are all untouched.

## Claims

Every figure lands in the probe header, never in MATH.md (R7).

### Claim D — what an undeclared importance costs

`scripts/task-importance.probe.ts` → MATH.md §0 (the objective it scores;
derivation only, no figures)

- **Given** days drawn on-surface — two integer 1–10 sliders and an integer
  enjoyment per task, through `toPooledInputs` — swept over task count, budget
  per task, and the mix of `high`/`low` tasks in the day
- **When** the day is planned at uniform `v` and scored under its true `v`
- **Then** the relative loss against the plan that knew the true `v` is
  reported as mean, median, p90, days moved and days it helped — the five
  columns [title-memory-for-task-sliders](title-memory-for-task-sliders.md)
  reports for enjoyment, so the two are comparable

### Claim E — what a stale importance costs

`scripts/task-importance.probe.ts`

- **Given** the same days, and a `high` placed on a task that is not the truly
  important one — a weight remembered from a week when it was true
- **When** that day is planned under the stale `v` and scored under the true one
- **Then** its loss is reported in the same five columns, against Claim D's
- **Then** the probe states which of the two is larger, per cell — a stale
  weight costing more than no weight is the condition under which importance
  must **not** be remembered

### Claim F — where the weight reaches

`scripts/task-importance.probe.ts`

- **Given** only the days on which every task is funded, at the budgets per
  task the current Arm B calls inert (0.9 h and above)
- **Then** the share of those days whose allocated hours differ between the
  uniform-`v` and true-`v` plans is reported, with the value gap
- **Then** the header's reach sentence is rewritten from that number: MATH.md
  §0's worked example moves blocks between two tasks that are **both funded
  before and after**, so "reach" measured as the contested share can only be a
  lower bound on it

### Claim G — the arms above it, re-read on the same surface (pin)

`scripts/task-importance.probe.ts`

- **Given** Arms A, B and C, with `makeDay` replaced by the on-surface draw
- **Then** every figure in the header comes from that run, and each verdict the
  header states is re-decided at its new level rather than edited in place

## Out of scope

- **No model change.** Nothing outside `scripts/` and the documents this
  corrects. The three levels, `IMPORTANCE_WEIGHT` and the allocator stay.
- **No title-memory change.** Whether `TitleRating` grows a fourth field is a
  separate spec, gated on Claim E. Building it here would be building the
  answer before the measurement.
- **No habit estimate.** How often a real user's importance is anything but
  `normal` is answerable only from real history, and there is none — the same
  wall item 15's own gate hit. Claims D and E are ceilings per cell; the
  realized fraction of them is not claimed.
- **No new MATH.md figures.** §0 already derives where `v` may act; measurements
  do not go there (R7).
- **No second probe file.** See Decisions.

## Read before building

- `scripts/task-importance.probe.ts` — the file the arms are added to. Its
  header carries the reach sentence Claim F corrects and the `makeDay` Claim G
  replaces.
- `src/lib/business/model/metric/calculation.ts` — `toPooledInputs` and
  `getEffectiveDifficulty`: the app's only path from sliders to a
  `PooledTaskInput`, and therefore the surface the generator must draw through.
- `src/lib/business/model/zenith.ts` — `IMPORTANCE_WEIGHT`,
  `importanceWeightOf`, `calculatePooledAllocations`, and
  `calculateTotalProductivity`, which reads `importanceWeight` off the tasks it
  is handed and so scores any plan under any `v`.
- MATH.md §0 — the objective `Σ vᵢ·P̄ᵢ`, the three levels, and the
  two-task worked example that contradicts the current reach sentence. Read
  §3 and §4 for the two properties that bound where `v` may act. **No edit
  expected**: §0 already says what Claim F measures.
- `docs/features/title-memory-for-task-sliders.md` — the five-column table
  Claims D and E mirror, and the unit error that produced it. That error is the
  reason this spec measures a whole day rather than one task.
- `ROADMAP.md` — Phase 2's framing paragraph gains the `v` row, and item 23's
  entry gains this file. Read the file's own preamble on numbering before
  touching it.
- `scripts/PROBES.md` — the row for this probe changes with its arms;
  `node scripts/probe-registry.mjs --check` gates it.
- `docs/testing.md` — probe policy: a probe is committed, is not a test, and
  does not run in `npm test`.

## Where it landed

Every figure is in `scripts/task-importance.probe.ts`'s header, beside the run
that produced it, and nowhere else (R7, and `docs/testing.md`'s probe rules).
What each claim decided:

- **D and D-ref** — the price has a row in ROADMAP Phase 2's framing paragraph
  now, read at that paragraph's own scope (400 days, 3–7 tasks, budgets
  {2,4,4,6,8}). It is the same order as the constraint-side figures, not the
  ϕ-anchor side, and it never went to zero anywhere on the grid.
- **E** — a stale `high` costs MORE than declaring nothing in every cell of the
  grid, with no crossover. That closes the follow-up question before it was
  asked: `TitleRating` must not grow an importance field, because a title's
  remembered weight is wrong exactly when the week has moved on, and being
  wrong is worse than being silent. The spec for that field is not written.
- **F** — the reach sentence item 23 shipped on was wrong. It read reach off the
  CONTESTED share, and MATH.md §0's worked example already showed blocks moving
  between two tasks that stay funded. On days where the flat plan funds
  everything, the two plans still allocate differently almost always. The
  header now says that instead.
- **G** — the day generator went on-surface, through `toPooledInputs`. Every
  Arm A/B/C figure moved and one verdict died with it: "exactly 0.0% contested
  at 0.9 h/task and above" was an artefact of drawing `difficulty` and the two
  pool weights independently, which no day the app can produce does. There is
  no budget above which the weight stops mattering.

## Decisions

- **The arms go on the existing probe, not a new file** — it owns the reach
  sentence Claim F corrects and the day generator all four claims need.
  Rejected: a second probe, because two files would then answer one question
  about one weight, and the wrong sentence would keep standing in the older of
  them.
- **The true `v` is swept, not assumed** — the mix of `high`/`low` tasks is a
  grid axis and the surface is reported. Rejected: one plausible mix, because it
  invents an audience; that is why item 15's own gate was declared unrunnable.
- **Scored with `calculateTotalProductivity` under the true `v`, applying each
  plan's own allocations.** Rejected: scoring by funded set or by
  `classicOverlap` — ROADMAP item 18 records at length what happens when plan
  adherence is asked to rank a model input.
- **The generator moves on-surface, in this change.** `makeDay` currently draws
  `difficulty` and the two pool weights independently and continuously, where
  the app derives all three from the same two integer sliders — so no day it
  draws is reachable, and the independence it assumes is impossible. Rejected:
  declaring the old surface and leaving it, because M40's five closures each
  found the figures moved; rejected: fixing it in a change of its own, because
  the new arms would then sit in one file with arms drawn on a different
  surface.
- **The stale arm misplaces the weight rather than mis-grading it** — `high` on
  the wrong task, not `high` where `normal` was true by one step. The failure
  mode a remembered weight risks is one that belonged to a different week, not
  one graded slightly wrong.
- **Whether title memory carries importance is not decided here.** Claim E is
  its gate, and the spec for it is written after this lands.

## Open questions

None.
