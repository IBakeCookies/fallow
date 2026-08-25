# The subset size bound under a prefix

**Status:** landed 2026-08-14 · **Roadmap:** item 31, finding M1

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Nothing the user sees changes. MATH.md §34 states a `maxFunded` bound that is
not the one that ships and proves it with a variable that cannot express the
shipped one; after this, §34 states the shipped bound, the proof carries the
day's funded set, and the suite pins the bound's exactness on a prefix day —
which nothing does today, which is why it drifted.

## Scenarios

No user-visible behaviour changes, so there are no scenarios — only the Claim
below and the document corrections in **Read before building**. The allocator is
not touched.

### Claim — the bounded search is exact on a prefix day _(pin)_

`src/lib/business/model/zenith.test.ts` → MATH.md §34

Phrased through the surface that exists today, so it runs green against the
current code on its first run. It pins the seam §34's cold-day fixtures
(`zenith.test.ts:637`, `:699`, and the 13-task one below the insertion point)
cannot reach.

- **Given** 13 tasks, 8 of them carrying worked hours, 4 h of budget left,
  `switchCost` 0.33, and capacity pools set high enough that neither binds
- **When** the plan is solved through `calculatePooledAllocations` with
  `workedHours`
- **Then** its value equals the exhaustive funded-subset optimum whose switch
  bill is charged on `dayFundedCount(S)`, not on `|S|`

**The day is chosen, not arbitrary, and the pin was mutation-tested.** The first
fixture written for this Claim — 10 started, 3.25 h, `switchCost` 0.25 — passed
against the shipped bound _and_ against the stale one, because the day is tight
enough that forward selection reaches the optimum anyway. A pin that cannot fail
pins nothing. The day above is one of the 9 in 3000 random prefix days where the
two bounds actually value differently: it splits `maxFunded` 6 against 7, which
is 4095 plans against 5811 and so the bounded exact search against the fallback,
and the stale bound forfeits **0.4210 P̄-units, 15.0%**. Verified both ways —
green on the shipped bound, red with that exact delta once `zenith.ts:1098` is
mutated to the doc's form.

Two things the oracle has to get right, both verified before this spec was
written — the claim passes as stated, gap 0, identical hours vector:

- **The bill is the day's.** An oracle charging `(|S| − 1)·switchCost` — the
  shape the existing fixture at `:676` uses, correctly, because its day is cold
  — reproduces the refund bug §35 exists to prevent, and would pin the wrong
  plan.
- **The currency is increments above the prefix.** The objective the allocator
  maximizes under a prefix is `Σᵢ [P̄(workedᵢ + tᵢ) − P̄(workedᵢ)]`.
  `TaskAllocation.avgProductivity` is `P̄(allocatedHours)` from zero
  (`zenith.ts:1223`) and does not carry the prefix, so summing it scores a
  different quantity. Score with `expectedAverageProductivity` and
  `calculateTaskParams` directly.

## Out of scope

- **Any change to what `zenith.ts` computes.** The shipped bound is correct and
  this spec keeps it — no expression moved. See the first decision below for why
  M1 is not a code bug. One comment line was corrected under §0; see the routing
  entry for `zenith.ts:1076-1092`.
- **M29 and M30**, the other two audit findings against
  `subset-search-bound.probe.ts`. Both are unverified leads; item 29's rule says
  they do not get acted on until each has had its own check.
- **Re-measuring §34's crossover or its "What it costs" bands under a prefix.**
  The crossover paragraph gets a qualifier, not a new measurement. Its existing
  figures reproduce exactly and its bands were never prefix measurements.
- **The sweep incidence.** How often a real day's two forms diverge is not
  measured here and no number for it goes in MATH.md — see the fourth decision.
- **`avgProductivity` ignoring the prefix** (`zenith.ts:1223`). Noticed while
  building the oracle above. Report it, do not fix it (AGENTS.md §0).
- The other 34 findings in ROADMAP item 31.

## Read before building

Every `MATH.md` line number below is **as of planning, before this change**;
they moved when it landed. Sections, not lines, are the durable address.

- `MATH.md:6518-6545` — §34 "The bound". Line 6473 is the formula to amend;
  6480-6489 is the proof whose variable `b = budgetBlocksFor(|S|)` is the
  second half of the defect.
- `MATH.md:6502-6512` — §34's crossover paragraph. Both figures reproduce
  exactly (3 h → `maxFunded` 6, 4095 plans; 3.25 h → 7, 5811). They are
  cold-day numbers and the text does not say so; that qualifier is the whole
  edit here.
- `MATH.md:6697-6705` — §35's union rule, where `S` = worked ∪ newly funded is
  defined and where the note that the size bound reads the same set belongs.
- `MATH.md:2247` — §10, the doc-only revision log. R7 requires a dated entry:
  this changes no formula, constant, bound or fit **in the code**, only the
  document's account of one.
- `src/lib/business/model/zenith.ts:986-1000` — `startedCount`,
  `dayFundedCount`, `budgetBlocksForSubset`. The shipped definitions.
- `src/lib/business/model/zenith.ts:1093-1103` — the scan and the
  `SUBSET_SEARCH_BUDGET` gate. Line 1098 is the shipped bound.
- `src/lib/business/model/zenith.ts:1076-1092` — the comment that argues the
  shipped form. §34 must end up agreeing with it, not the reverse. **Half wrong,
  found during the build:** `:1095-1097` argues it, but `:1090` stated the
  monotonicity for `budgetBlocksFor(m) − m` — the same lag as §34's, in the code
  comment. Corrected here, which makes this the one line of `zenith.ts` the
  change touches (a comment; no expression moved).
- `src/lib/business/model/AGENTS.md:84-88` — already states the union rule and
  that `hᵢ = 0` keeps §34 undisturbed. Correct as written; it is the evidence
  that the intent was always the union rule and only MATH.md lagged. No edit.
- `scripts/subset-search-bound.probe.ts:87-104` — `boundedSearchRuns`
  re-derives the doc's stale form. Its numbers stand (that probe never sets
  `workedHours`, and at `startedCount` = 0 the two forms are the same
  expression), but it is a fourth copy of the wrong rule and is corrected here.
  It keeps re-deriving rather than importing — its docblock at `:82-86` says why,
  and that reason is still good.
- `src/lib/business/model/zenith.test.ts:637-697` — the fixture the new pin
  mirrors, including its oracle shape.
- `docs/testing.md:28` — the level: math/model goes in the `*.test.ts` beside it.
- `ROADMAP.md:788-796` — M1's own text. It prescribes
  `budgetBlocksFor(dayFundedCount(S))` for **both** the bound and the proof
  variable, which is right only for the proof (first decision below). Correct
  that line and mark the finding closed with this spec's link, in the landing
  commit.

## Decisions

- **The bound becomes `max { m : budgetBlocksFor(max(startedCount, m)) ≥ m }`,
  not ROADMAP M1's `budgetBlocksFor(dayFundedCount(S))`** — the bound quantifies
  over sizes with no `S` in hand, so it cannot name one. `max(startedCount, m)`
  is the smallest day-funded count a size-`m` subset can have, which is exactly
  what makes the result an upper bound. `dayFundedCount(S)` is the right
  amendment for the _proof_ variable, where `S` is in hand. Rejected: one
  expression for both, because it does not survive the quantifier.
- **No code changes — the shipped bound is the right one, and now measurably.**
  Over 50,000 random `(n, budget, switchCost, startedCount)` draws the doc's
  form is never tighter than the shipped one (14,468 differ, all with the doc
  looser, none the other way), so as a _bound_ it never excludes a subset worth
  keeping. That is not the same as harmless, and the first draft of this spec
  had it wrong: because the looser bound admits more sizes, it overruns
  `SUBSET_SEARCH_BUDGET` and hands the day to forward selection instead. Run
  against the doc's form, 9 of 3000 random prefix days lose value — never one
  the other way — worst **15.0%**. So M1's "changes a plan" is right, and it is
  the branch that changes it, not the bound. Rejected: treating M1 as a code
  defect; also rejected: the first draft's "exact-but-slower, never a wrong
  plan", which was inference and is now disproven.
- **The proof survives the amendment structurally.** With
  `b = budgetBlocksFor(dayFundedCount(S))` and `F ⊆ S`: `dayFundedCount(F) ≤
dayFundedCount(S)`, so `budgetBlocksFor(dayFundedCount(F)) ≥ b ≥ |F|`; and
  `max(startedCount, |F|) ≤ dayFundedCount(F)`, so `F` is inside `maxFunded`.
  The interval step survives too — `g(m) = budgetBlocksFor(max(startedCount, m))
− m` is non-increasing on both sides of the junction, checked at 370,019
  points with 0 breaks, so "scan to the first failure" still finds the interval.
  Rejected: re-deriving the proof from scratch.
- **§34 quotes the pin's day and its forfeit, and nothing else measured.**
  n = 13, B = 4 h, s = 0.33, `startedCount` = 8: the doc's form gives 7 →
  `Σⱼ₌₁⁷ C(13,j)` = 5811 > 4095 → forward selection; the shipped form gives 6 →
  `Σⱼ₌₁⁶ C(13,j)` = 4095 ≤ 4095 → the bounded exact search. The size arithmetic
  is closed form, so a reader checks it without running anything; the 15.0%
  forfeit is backed by the committed pin, which is the whole point — a number in
  §34 that no committed artefact reaches is the defect class this audit exists
  to remove. Rejected: ROADMAP M1's own witness (s = 0.25, B = 3.25 h,
  `startedCount` = 10, 7 against 4), whose arithmetic is right but which costs
  nothing on that day, so quoting it would show a branch flip with no
  consequence. Also rejected: the two sweep incidences — 28.9% of 50,000 draws
  differing, 9 of 3000 prefix days moving — because both draw `startedCount`
  uniformly, which is not a day, and neither has a committed probe behind it.
- **The cold-day equivalence is stated as an identity, not a measurement.**
  `startedCount` = 0 makes `max(0, m)` = `m`, so the two forms are the same
  expression — the same fact `model/AGENTS.md:87` and `MATH.md:6755-6756`
  already state for the switch bill. Rejected: quoting the measured 0
  disagreements in 50,000 cold draws, which would dress an identity as evidence.
- **The pin runs through `calculatePooledAllocations` with generous pools.**
  `calculateTaskAllocations` takes no `workedHours` (`zenith.ts:1271-1277`), so
  the prefix is reachable only on the pooled path — and a binding pool would put
  the claim under §13.3's near-exact heuristic status instead of §4's exactness,
  which is not what the bound promises. Rejected: `DEFAULT_CAPACITY_POOLS`.
- **`boundedSearchRuns` is corrected in place.** Rejected: deleting it in favour
  of importing the real bound, because a probe that asks the code under test
  which branch it took measures nothing (`subset-search-bound.probe.ts:82-86`).
- **Two things were adjudicated in during the build, both §0 documentation
  duties this change created.** `zenith.ts:1090`'s monotonicity comment named
  `budgetBlocksFor(m) − m`, the same stale function §34 named, so the scan at
  `:1098` was justified by a property of something it does not compute; and
  §34's "Pinned in the suite" enumerates that section's fixtures, so adding one
  and not listing it would leave the subsection false the day it landed. Both
  declined by the implementer as out of scope, correctly — the spec had not
  named them. Rejected: reporting them as notes, because §0 exempts
  documentation from "report, do not fix" by name.
- **This is an R7 doc-only correction, so it lands with a `MATH.md` §10 entry**
  and no §34 date change. Rejected: writing it as a §34 revision, which would
  imply the model moved on 2026-08-14 when it last moved on 2026-08-10.

## Open questions

None.
