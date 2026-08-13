# Title memory for the task sliders

**Status:** landed 2026-08-05 · **Roadmap:** item 15

Backfilled 2026-08-14 from ROADMAP item 15, whose text was written at land. Not
a pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

A task title the user has rated before comes back with its ratings. Every
stored day folds into a map from normalized title to
`{title, physicalDifficulty, mentalDifficulty, enjoyment}`, read once at boot,
and `SessionStore.suggestTitles` answers the add-task form — so the sliders
move when the user names the title they mean.

## Scenarios

The source names no test file for any of these.

### Scenario — Naming a remembered title

- **Given** a stored day whose tasks carry a title the user rated
- **When** the user names that title in the add-task form
- **Then** the sliders carry that title's last ratings

### Scenario — A title used twice in one day

- **Given** one stored day that used the same title twice
- **When** the form answers with that title
- **Then** the rating offered is the one that superseded the other

### Scenario — Typing is not naming

- **Given** a part-typed title that is a prefix of a rated one
- **When** the user types another character
- **Then** no slider moves

## Out of scope

- **No store, no schema, no formula.** The feature is a fold plus one boot
  read.
- **Nothing infers which title the user means.** No recall on keystroke, no
  per-slider ownership flag; both were built and thrown away (Decisions).
- **The map is a boot snapshot.** A title rated within one session is not
  suggested until the next load, and the map stays the boot day's answer while
  another date is viewed.
- **The task editor deliberately offers no suggestions.** Renaming a task the
  user already rated must not rewrite its ratings.
- **The whole-history read is unbudgeted.** It measured 47 ms at 3651 stored
  days, unguarded by any budget in the repo.

The last three were declared at land as limits, and none of them was worth code
that day.

## Where it landed

- `business/model/title-memory.ts` — `normalizeTitle` and
  `latestRatingsByTitle` fold every stored day into
  `Map<normalizedTitle, {title, physicalDifficulty, mentalDifficulty, enjoyment}>`.
- `readHistoryPrefills(today)` — reads the fold once at boot. It was
  `readTitleRatings` until item 16 widened it.
- `SessionStore.suggestTitles` — answers the add-task form.
- `calculateTaskPlan` — the real planner the corrected numbers were measured
  through.
- MATH.md §17 — the probe style those measurements followed (§17-style: 400
  days, 3–7 tasks, budgets {2,4,4,6,8}).
- ROADMAP item 24 — the surface this ships behind; it shipped on the same day.

## Decisions

- **The fold walks each day's tasks backwards** — a review caught it. Days sort
  ascending, but within a day `tasks` is newest-first: every writer in
  `SessionStore` prepends. Plain array order therefore handed a title used
  twice in one day the rating the user had already superseded. Rejected:
  sorting by `id`, because an import assigns ids ascending across a batch it
  prepends as a block.
- **The test that should have caught the order bug was pinning array position.**
  Its fixture was written in an order the store cannot produce.
- **The sliders move only when the user names the title they mean.** Two
  versions were built before the shipped one and both failed the same way: they
  moved the sliders while the user was still typing. Applying a rating once per
  title and never taking it back deployed `Gym session notes` at
  `gym session`'s 8/2, because typing walks through every prefix and the recall
  fires on the way past. Withdrawing it again on every keystroke fixed that and
  cost a per-slider ownership flag to stop the memory speaking over a slider the
  user had dragged — two mechanisms, both guessing. The pick in item 24 has
  neither.
- **Two corrections to this item's own numbers, both the same unit error.** The
  5.42% the item quoted is all _three_ sliders at 5/5/5, so as first shipped —
  two sliders — it overstated its reach 2.3×. Then excluding enjoyment was
  justified with "0.052% per point", which is one point on **one** task,
  against a ϕ anchor measured as +0.5 h on **every** task. Measured properly
  through the real `calculateTaskPlan`:

  | planned under                  |  mean | median |   p90 | days moved | days it helped |
  | ------------------------------ | ----: | -----: | ----: | ---------: | -------------: |
  | P/M at 5/5, enjoyment true     | 2.39% |  2.02% | 6.17% |      91.8% |      19 of 400 |
  | enjoyment at 5, P/M true       | 2.02% |  1.16% | 4.90% |      90.8% |              0 |
  | all three at 5/5/5             | 4.59% |  3.97% | 9.56% |      97.5% |      16 of 400 |
  | one task, enjoyment off by one | 0.06% |      0 | 0.18% |      26.3% |       1 of 400 |

  The last row reproduces the 0.052% that was used to exclude the third slider;
  the second row is what excluding it actually cost. Enjoyment is 85% of the
  difficulties by mean and the only arm that is never negative.

- **The stated probe was not runnable and the item shipped without it.** Its
  gate — the share of repeating titles already hand-rated — is a question about
  habit, answerable only from real sessions, and there is no exported history on
  the author's machine. Rejected: the fixture generator, which is disqualified
  for exactly this class of question.

## Open questions

The ceiling is confirmed and the realized fraction of it is still unmeasured.
Run the gate the moment a backup exists; if recurring titles turn out to be
hand-rated already, the honest move is to delete this, not to keep it.
