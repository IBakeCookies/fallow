# What the rotation baseline costs

**Kind:** repair · **Status:** landed 2026-08-17 · **Roadmap:** item 31, finding M8

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Nothing the user sees changes. MATH.md §19.3 opens with "every number below sits
on the same draw as §13.2's table", and four of its figure groups do not sit on
that draw or on any other: the 81.7% rotation spread, the −0.5% σ_ϕ witness, the
two monotonicity-cut counts, and the 0.013 → 0.031 ms against 41.7 ms cost. Two
of the four are structurally impossible for the probe named in that header —
`rv14-naive-switch-bill.probe.ts` draws σ_ϕ = 0 and never times anything. After
this, every number in §19.3 has a probe behind it, §19.3 says which draw each
one came from, and the σ_ϕ corner's reachability is measured instead of asserted.

## Scenarios

No scenario. Nothing here has a click: §19.3 is a cost-and-guarantees section,
the whole change is measurement plus the prose it corrects, and the one
behaviour worth holding onto lands as the pin in Claim 2.

**The figures quoted inside the Claims are §19.3's, not results.** They are what
the probes are built to confirm or refute. Where a figure does not survive,
MATH.md §19.3 gets the measured one and this file is not updated — M7's
precedent ([what-still-reaches-the-gain-cap.md](what-still-reaches-the-gain-cap.md)),
where three of five quoted statements changed under execution.

**Already backed, do not re-measure.** §19.3's "0 negatives in 2400 days,
asserted in the probe" is `rv14`'s arm D (`expect(single.gainPercent)
.toBeGreaterThanOrEqual(0)` on 400 days × 6 counts), and its "1 day in 2400
(−0.5%), and that day is pool-limited" is the same arm's `negativePooled` /
`negativeAndPoolBound` counters. Those two are fine as they stand.

### Claim — the rotation average sits strictly below its best rotation

`scripts/rv14-naive-switch-bill.probe.ts` → MATH.md §19.3

§19.3's exactness argument is that the optimizer dominates **every** rotation,
which is strictly stronger than dominating their average. The 81.7% is what
makes that gap non-vacuous, and nothing computes a per-rotation value: arm E
shuffles the whole list and reads the already-averaged `naive`, which is the
opposite measurement.

- **Given** rv14's own generator and draw — `randomDay`, `DAYS_PER_COUNT = 400`,
  `COUNTS = [2, 3, 4, 5, 6, 8]` — and the single-budget path, whose naive side
  is `naiveBaselineValue` with both pools `Infinity`
- **Then** the share of days on which the rotation average is strictly below the
  maximum over the n rotations is reported, per task count and pooled
- **Then** the largest gap between the average and the best rotation is reported
  as a percentage of the average
- **Then** the arm states that its per-rotation plan is a replica of the
  private `naiveBaselineValue` / `naiveBlockPlan` pair, in the same way
  `oldNaiveHours` already replicates the pre-§19 baseline

### Claim — the −0.5% witness, reproduced or refuted _(pin)_

`scripts/naive-menu-cut-corner.probe.ts` → MATH.md §19.3

The one place the ≥ 0 guarantee is claimed to fail. It is a constructed cell, so
it is deterministic and it is the natural suite pin — but the pin carries **what
the probe measures**, not the figure below.

- **Given** one task at effective difficulty 1.3 (integer sliders 1/1 through
  `getEffectiveDifficulty`), constants placing ϕ̂ at 4.5 h, a hand-built
  `FitPosterior` whose covariance gives σ_ϕ = 0.35 · ϕ̂ at that cell, and a 4 h
  budget on the single-budget path
- **Then** `optimized` reads 0.886678 against `naive` 0.891116
- **Then** `gainPercent` reads −0.5
- **Then** the same cell is pinned in `src/lib/business/model/zenith.test.ts`
  with the measured pair, dated, citing §19.3 — one fixture, never the sweep
- **Then** if no negative gain is reachable at that cell, the arm reports the
  smallest `gainPercent` it does reach and the witness is retracted from §19.3
  rather than restated

### Claim — how often the σ_ϕ menu cut fires, by slider regime

`scripts/naive-menu-cut-corner.probe.ts` → MATH.md §19.3, §5.1

§19.3's "not reachable from the product" rests entirely on these two counts, and
the grid behind them is not recoverable from the text. The probe states its own
grid; §19.3 quotes the new counts with that grid written down.

- **Given** two slider regimes over the same ϕ and σ/ϕ axes — integer sliders
  1–10 with ϕ ≤ 6 h, and quarter-step sliders with ϕ up to 8 h — where the
  sliders set (a, p₀) through `calculateTaskParams` and ϕ is an independent axis
  because the fitted plane is a property of the user, not of the task
- **Then** the count of cells whose menu is cut by the **non-decreasing** rule
  rather than by the non-positive one is reported for each regime, against the
  cell total
- **Then** for the cells that are cut, the ϕ̂ and σ/ϕ range they occupy is
  reported, which is what "all at ϕ̂ ≥ 4 h with σ/ϕ ≥ 0.35" asserts
- **Then** the count of cut cells where the cut also **costs value** — it fires
  strictly before the menu's own best block count — is reported separately, since
  a cut at or past the best costs nothing and is not a weakened guarantee
- **Then** the arm reports whether Claim 2's witness cell is inside the
  integer-slider regime, which is the tension this finding turns on: difficulty
  1.3 is integer-reachable and 4.5 h is under 6 h, so a 0-cut count over that
  regime and a witness inside it cannot both be right

### Claim — can a fitted posterior reach the cut's corner?

`scripts/naive-menu-cut-corner.probe.ts` → MATH.md §19.3, §5.1

"Not reachable from the product" is two assertions: that no slider cell is cut,
and that no user can be at σ/ϕ ≥ 0.35 with ϕ̂ ≥ 4 h. Only the first has ever been
swept, and the second is what decides whether the corner guards anything real.

- **Given** seeded synthetic `FlowObservation` histories fitted through
  `fitUserConstants`, drawn toward the SLOW end that puts ϕ̂ above 4 h
  (`phi-cap-reachability.probe.ts`'s `drawUser` already draws that end)
- **Then** the share of fitted users whose `phiParameterStd` divided by their
  `calculateFlowStateTime` reaches 0.35 or more at some UI-reachable slider cell
  is reported, by log count
- **Then** every history that reaches it is reported with its `fitted` flag
  true — a fit that fell back to the defaults is not a fitted user
- **Then** the highest ratio reached is reported when the corner is not reached,
  so "0 of N" is a bound and not a bare zero

### Claim — what the rotation baseline costs, timed

`scripts/rv14-naive-switch-bill.probe.ts` → MATH.md §19.3

Three numbers, none of them measured by anything: `performance.now()` appears in
six probes and not in this one.

- **Given** a 12-task day with a posterior, warmed and then timed over enough
  repetitions to be stable, seeded
- **Then** the pre-§19 baseline's cost (`oldNaiveHours` plus one
  `calculateTotalProductivity`) is reported in ms per call
- **Then** the §19 rotation baseline's cost is reported in ms per call
- **Then** the 2ⁿ funded-subset solve's cost is reported, reached as
  `calculateTaskAllocations` on the same inputs, with the baseline's share of it
  as a percentage
- **Then** the arm states its machine and repetition count, because a timing
  number without them is not reproducible

## Out of scope

- **Fixing §5.1's monotonicity cut.** Decided with the user: if Claim 3 or 4
  shows the corner is product-reachable, §19.3 records the measurement, the pin
  captures the witness, and a **new ROADMAP item** carries the cut question.
  `buildBlockIncrements` is not touched here — it is the exactness premise the
  whole allocator rests on, and a model change to it does not belong in a
  measurement commit.
- **`PHI_UNCERTAINTY_RELATIVE_CAP`.** Settled at 0.5 (AGENTS.md §4, MATH.md
  §5.1). The σ/ϕ axis reads the cap; it does not re-open it.
- **§19.1, §19.2 and §19.4.** M7 closed §19.4 on 2026-08-17. §19.1's and §19.2's
  tables are rv14 arms A–C and are backed.
- **The pooled path's 1-in-2400 negative and the 0-negatives assertion.** Arm D
  already measures both; re-measuring them is how a change of this shape grows
  without adding evidence.
- **Any user-visible change.** No component, view model, store or band. The gain
  the dashboard shows reads identically before and after.
- **Re-fitting the § numbers of §13.2 or §13.3** that §19.3 cites in passing
  (96.13%, 93.55–94.50%). They belong to their own sections.

## Read before building

Line numbers are as of planning. Sections and symbols are the durable address.

- `MATH.md:4929-4967` — §19.3, the section under test. The four figure groups are
  at `:4885` (81.7%), `:4894-4896` (the witness pair and −0.5%), `:4897-4901`
  (the two cut counts and the ϕ̂ ≥ 4 h / σ/ϕ ≥ 0.35 range), `:4913-4916` (the
  timing). Each gets the measured number and its date.
- `MATH.md:4833-4836` — §19's header: "so every number below sits on the same
  draw as §13.2's table". **False for §19.3 and part of this change** — the
  witness, the cut grid and the timing are not that draw and cannot be. Say
  which draw each group comes from instead of claiming one for all of them.
- `MATH.md:2248` — §10, the doc-only revision log. R7 wants a dated entry: this
  change alters explanations and adds probes, and changes no behaviour.
- `MATH.md:602` — §5.1, which owns the monotone-prefix cut and the σ ≤ 0.5·ϕ̂
  cap. Claims 3 and 4 measure its corner; they do not amend it.
- `src/lib/business/model/zenith.ts:1537-1586` — `naiveBaselineValue`: `blocksFor`,
  the scan-down `planFrom(start)`, and the average over `start = 0..n−1`.
  Claim 1's replica is of this. Private — reach the average through
  `productivityGain`, and replicate the per-rotation value.
- `src/lib/business/model/zenith.ts:1462-1500` — `naiveBlockPlan`, the round-robin
  the replica needs. With both pools `Infinity` the skips cannot fire, so the
  replica is the simple case: `target` blocks round-robin over the first `k` of
  the rotation order.
- `src/lib/business/model/zenith.ts:1674-1720` — `productivityGain`, and the
  `Infinity, Infinity` pools that make the single-budget path's naive side the
  same function. Its signature is
  `(tasks, totalBudget, constants, switchCost, posterior)`.
- `src/lib/business/model/zenith.ts:667-699` — `buildBlockIncrements`, the cut
  Claim 3 counts: `delta <= 1e-12` (non-positive) OR `delta > prevDelta + 1e-12`
  (non-decreasing), and the `maxBlocks` span. Private. Its docblock at `:640-666`
  states "σ_ϕ = 0 never triggers the monotonicity cut (proved in MATH.md §2)" —
  which is why the σ = 0 generator cannot see any of this.
- `src/lib/business/model/zenith.ts:560-586` — `calculateTaskParams`, exported:
  slider `{difficulty, enjoyment}` → `{E, beta, phi, k, a, p0}`. This is how
  Claim 3 gets (a, p₀) from a slider cell.
- `src/lib/business/model/zenith.ts:452` — `expectedAverageProductivity(T, a, p0,
phi, sigmaPhi)`, exported. The increment replica calls this and nothing else.
- `src/lib/business/model/zenith.ts:170-174`, `:164` — `calculateFlowStateTime`
  and `PHI_FLOOR_HOURS`. Claim 2's ϕ̂ = 4.5 h is a constants triple through this.
- `src/lib/business/model/zenith.ts:540-551` — `phiParameterStd(E, beta,
posterior)` = √(xᵀΣx), x = [E, β, 1]. Claim 2's exact σ_ϕ is a diagonal
  covariance with only the `[2][2]` entry set; `gain-cap-trigger.probe.ts:86-97`
  is the precedent for hand-building constants this way.
- `src/lib/business/model/zenith.ts:1779-1812` — `FitPosterior`'s shape
  (`covariance`, `sigma2`) and `priorPosterior`, the n = 0 limit.
- `src/lib/business/model/zenith.ts:1272`, `:1388` — `calculateTaskAllocations`
  and `calculateTotalProductivity`, both exported. Claim 5 times the first;
  Claims 1 and 5 score plans with the second.
- `scripts/rv14-naive-switch-bill.probe.ts:11-24` — the arms list in the
  docblock. Two new arms go in this file **and in that list**, and the docblock's
  "The generator is rv13's, so the numbers here sit on the same draw" needs the
  same qualification MATH.md's header does.
- `scripts/rv14-naive-switch-bill.probe.ts:63-89` — `DAYS_PER_COUNT`, `COUNTS`
  and `randomDay`: integer sliders, the 0.3 spillover inline, budget
  `0.5 + floor(rnd() * 32) * 0.25` (so **8.25 h** maximum). Claim 1 reuses these
  verbatim, which is the whole point of putting it here.
- `scripts/rv14-naive-switch-bill.probe.ts:95-128`, `:150-160` — `oldNaiveHours`
  (Claim 5's "before" side) and `seatedCount` / `blockTarget`, already a partial
  replica of `blocksFor`'s scan.
- `scripts/rv14-naive-switch-bill.probe.ts:309-353` — arm D, which already holds
  the two §19.3 numbers that are backed. Read it before adding a counter that
  duplicates one.
- `scripts/phi-uncertainty-cap.probe.ts:147-185` — `measure`: the increment
  sequence over the block menu with `buildBlockIncrements`' own tolerances and
  span, plus the truncation-loss calculation. **Lift the cut detector from
  here**; it is already the right code. It works in (r, ϕ, ratio) space at
  `PEAK_SCALE = 1`, so the new sweep drives it from slider-derived (a, p₀)
  instead — that difference is the only reason a second probe exists.
- `scripts/phi-cap-reachability.probe.ts:205-243`, `:395-412` — `drawUser`,
  `logAt`, and `sweepHistory`'s `fitUserConstants(logs)` → `phiParameterStd`
  shape. `drawUser`'s `c1: 0.3 + rand() * 1.1` draws SLOW users, which is the end
  Claim 4 needs — the opposite of what M7's spec had to invert.
- `scripts/gain-cap-trigger.probe.ts:389-425` — `drawFastUser`, `logAt` and the
  `LOG_COUNTS` / `NOISE_ARMS` axes, and `:453-540` — `recordFit` and
  `recordFloorCell`, which exist only to satisfy `max-depth`. `scripts/**` gets
  no exemption from that rule.
- `scripts/PROBES.md` — one new row for the new probe; rv14's existing row needs
  its description widened for the two new arms.
  `node scripts/probe-registry.mjs --check` fails `npm run lint` without it.
- `docs/testing.md:233-250` — probe policy: seed the randomness, date the number
  where it is quoted, pin what the probe found with **one** suite fixture.
- `ROADMAP.md:873-877` — item 31's M8 entry. Mark it closed with a link to this
  file, and **its four citations are stale after M7's landing**: `:4827` →
  `:4885`, `:4836-4838` → `:4894-4896`, `:4840-4842` → `:4897-4901`,
  `:4857-4858` → `:4913-4916`. Do not renumber any item.
- `ROADMAP.md` — if Claim 3 or 4 shows the corner is product-reachable, the new
  item for §5.1's cut goes at the end of the audit-findings list, taking the next
  free number.

## Decisions

- **Two probes, not one, and the split is by draw.** Claim 1 and Claim 5 belong
  in `rv14` because §19.3's rotation gap is a statement about rv14's own days and
  the timing is about the code path rv14 already exercises. Claims 2–4 cannot
  live there: rv14's generator is σ_ϕ = 0 by construction, and a σ > 0 arm inside
  a file whose docblock promises §13.2's draw is how the header overclaim
  happened in the first place. Rejected: one new probe holding all five, which
  would either copy rv14's generator (and then "the same draw" is a hope, not a
  fact) or quietly move the 81.7% off it.
- **The witness is the pin, whichever way it lands.** A negative reported gain is
  a real behaviour worth a suite fixture, and it is a constructed deterministic
  cell, so it pins cleanly. If it turns out to be unreachable, there is nothing
  new to pin — arm D's `>= 0` assertion already covers that world — and the pin
  is dropped rather than replaced with something the measurement did not find.
- **The grid behind 156,000 / 919,968 is not recoverable, so the probe states
  its own.** The text gives slider granularity and a ϕ bound but not the σ axis
  or the step counts, and 919,968 = 1369 × 672 is a factorization, not evidence.
  Rejected: reverse-engineering a grid that reproduces the counts, which would
  make the probe fit the claim instead of testing it — M1's failure mode.
- **ϕ is an axis, not a slider consequence.** In the cut sweep the sliders set
  (a, p₀) and ϕ comes from the fitted plane, which is a property of the user.
  Reading "integer sliders and ϕ ≤ 6 h" any other way would need a constants
  triple per cell and would measure the fit, not the menu. Claim 4 measures the
  fit, separately and on purpose.
- **Reachability is in scope; the fix is not.** Both halves of "not reachable
  from the product" get swept, because that phrase is the sole reason §19.3 files
  the weakened guarantee as harmless — the same unmeasured who-can-exist
  assertion that changed M7's answer. But a cut whose corner turns out reachable
  is a §5.1 model question with its own blast radius, and it gets its own item.
  Rejected: fixing `buildBlockIncrements` in the same commit, which the user
  declined; and leaving reachability unmeasured, which closes M8 on its literal
  wording and leaves the next audit exactly where this one started.
- **The cut count is split into "fires" and "costs value".** §19.3's concern is
  a guarantee that weakened, and a cut firing at or past the menu's own best
  block count forfeits nothing. Counting only firings would overstate the defect;
  counting only costly ones would hide how close the corner is.
- **§19's header is corrected, not annotated.** AGENTS.md §0's documentation
  exception. The sentence is what made four unbacked groups read as measured, and
  it will do it again to the next reader. Rejected: adding a caveat under §19.3
  and leaving the header, which leaves the false sentence in the place a reader
  starts.

## Open questions

None.
