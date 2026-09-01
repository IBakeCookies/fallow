# The verdict band with no noise model

**Kind:** model · **Status:** landed 2026-09-01 · **Roadmap:** item 29 (g)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one.

## Goal

The Plan adherence card prints one of three English sentences — the energy model
fits your days, the classic plan does, or it is a tie — and the whole decision
is `ADHERENCE_TIE_BAND = 0.05` against a difference of two means. Nothing has
ever measured that width. After this change the band is whatever a committed
probe justifies, the sentence the user reads changes wherever the old width was
wrong, and the docblock cites the instrument instead of asserting a number.

Item 29's own rule, which this residue is the last case of: **do not quote a
number as a result until a committed instrument prints it.**

## Claims

`scripts/adherence-tie-band.probe.ts` → MATH.md §9

The probe drives `auditPlanAdherence` end-to-end. `sharesOf`, `overlapOf` and
`taskSpreadOf` are module-private and stay that way — the public entry point
takes `PlanAuditDay[]` and returns the two means the verdict reads. Corrected at
build: the follower arm below DOES rebuild each planner's allocation, from
exported calls, because a day whose logged hours ARE one plan cannot be
generated without computing that plan — so there is a replica after all, and it
is validated the way `stop-inversion-margin.probe.ts`'s bracket is (with no
recall error the followed planner's own overlap must read 1). Seed every
generator; declare the reachability of any day whose numbers get quoted
(`docs/testing.md`, _Writing a probe_).

### Claim — how far the mean difference wanders when neither planner is being followed

- **Given** seeded days whose logged hours are drawn from a generator with no
  preference for either plan, over the day counts the card actually reads at
  (n ∈ {1, 3, 5, 10, 20, 30}; `AUDIT_DAY_CAP` is 30)
- **Then** the spread of `energyOverlap − classicOverlap` is printed per n —
  standard deviation, and the median, 90th, 95th and max of its absolute value

### Claim — how often the printed sentence flips under behaviour that did not change

- **Given** those same neutral days, read as consecutive rolling windows
- **Then** the share of adjacent windows whose verdict changes is printed per n,
  over a grid of candidate widths that includes the shipped 0.05

### Claim — what recall error alone moves

- **Given** one set of days, its logged minutes perturbed by seeded recall error
  at ±5 and ±15 minutes (the 🪫 form takes whole minutes, 1–960, so both are
  reachable entries)
- **Then** the movement in the mean difference is printed per perturbation size
- **Then** the share of days whose verdict flips on the perturbation alone is
  printed per perturbation size

### Claim — whether a user who genuinely follows one planner can clear the band

- **Given** seeded days whose logged hours ARE one planner's allocation, carrying
  the same recall error as the arm above
- **Then** the mean difference a true follower produces is printed per planner
  and per recall-error size (corrected at build: it is one number over the whole
  day pool, and re-averaging it per n prints the same figure back)
- **Then** the share of runs whose mean difference clears each candidate band is
  printed per n, for each planner as the followed one

### Claim — the band is the value those four arms justify

`src/lib/presentation/utils/plan-audit-descriptor.test.ts`

- **Given** the printed distributions
- **Then** `ADHERENCE_TIE_BAND` equals a literal in the test, not the constant
  it is meant to bound
- **Then** the band is **0.2** — the smallest width the probe swept that never
  names a neutral 30-day window and still names a true follower from n = 10 up

### Claim (pin) — the three branches and both exclusive edges still hold

`src/lib/presentation/utils/plan-audit-descriptor.test.ts`

- **Given** an audit whose two overlaps differ by exactly the band
- **Then** the verdict is a tie with energy ahead
- **Then** the verdict is a tie with classic ahead
- **Then** a gap wider than the band names the leading planner, either way
- **Then** `usedCount === 0` still returns `null`

Green on its first run, which is the pass condition: these pin behaviour that
exists today. What changes is the surface — the two edge cases currently assert
against `ADHERENCE_TIE_BAND` itself, so they hold at any width and pin none
(`docs/testing.md`: _pin it against a literal, never against the constant it
bounds_).

## Out of scope

- **A band that narrows as days accumulate.** An n-aware width (a standard error
  over `usedCount`) is the statistically obvious answer and is deliberately not
  built: it makes the sentence depend on how much history exists, which nobody
  asked for (AGENTS.md §0). This change asks whether a fixed width can do both
  jobs. If the probe prints that no single width both survives the noise arm and
  lets a true follower clear it, that is a new roadmap item and the finding says
  so — not a scope expansion here.
- **Fit drift as a noise source.** Each day scores under its own recorded
  snapshot; what that alone moves is `fit-snapshot-drift.probe.ts`'s question
  already.
- **The spread reading.** `actualTaskSpread` / `classicTaskSpread` /
  `energyTaskSpread` print as three numbers with no verdict and no band. Untouched.
- **Moving the constant.** It stays in the presentation layer — band thresholds
  are presentation's by settled decision (AGENTS.md §4, UI).
- **The overlap metric, the day cap, and the audit's design.** Σ min(shares) as
  the composition measure, the inverse Herfindahl spread, and
  `AUDIT_DAY_CAP = 30` are inputs to this measurement, not its subject.
- **New copy.** The three verdict messages stay as they are; no locale file moves.

## Read before building

- `src/lib/presentation/utils/plan-audit-descriptor.ts` — the constant, the
  three branches, and the docblock whose "means over a handful of days, so a
  couple of points either way is noise" is the unmeasured claim this change
  removes. The card reads up to 30 days, not a handful.
- `src/lib/presentation/utils/plan-audit-descriptor.test.ts` — the two edge tests
  to re-pin against literals.
- `src/lib/business/model/plan-audit.ts` — `auditPlanAdherence`'s per-day loop,
  the `PlanAuditDay` input the probe builds, and the three private helpers the
  probe must NOT need exported.
- `src/lib/business/session-history.ts` — `toPlanAuditDays` and
  `readFinishedDays`: how a real audit day is assembled from a session plus its
  🪫 rows, which is the reachable surface the quoted arms have to sit on.
- `src/lib/business/store/analytics-store.svelte.ts` — `AUDIT_DAY_CAP = 30`, the
  n the card actually reads at.
- `src/lib/presentation/component/drain-log-form.svelte` — the 🪫 minutes input
  (whole minutes, 1–960), which fixes what a reachable recall perturbation is.
- `scripts/stop-inversion-margin.probe.ts` — the precedent: a shipped constant
  re-derived from a printed distribution, and how its header states the claims it
  found unbacked.
- `docs/testing.md`, _Writing a probe_ — seeding, the wall-clock-is-a-range rule,
  the reachability declaration, and pinning against a literal.
- `scripts/PROBES.md` — the registry row is mandatory; `probe-registry.mjs
--check` fails `npm run lint` without it.
- MATH.md §0 and §2 (the classic Σ P̄ objective's spread, every touched task
  collecting its ≈p₀ activation bonus) and §8.4 (the energy model's satiety-
  tempered concentration) — the structural disagreement the overlap measures, and
  the reason the two means differ at all.
- **MATH.md — a new §9** holds this derivation: the composition overlap and the
  inverse-Herfindahl spread stated once (they are currently authoritative only in
  a code docblock, which R7 makes MATH.md's job), then the verdict band — the
  width, why it has that shape, and why the n-aware alternative was rejected.
  `## 9. References` becomes `## 10.`; nothing in tracked source cites §9, so the
  renumber is free. Run `node scripts/math-index.mjs` after inserting it (R7),
  and cite the section from `plan-audit-descriptor.ts`.
- `src/lib/presentation/AGENTS.md` — one statement, only if the band moves: the
  verdict band's derivation is MATH.md §9's and its number is
  `adherence-tie-band.probe.ts`'s, which is what distinguishes it from
  `utils/band.ts`'s color-band policy in the same layer.
- `ROADMAP.md` item 29 — (g) is the last open residue. Mark it settled with a
  link to this file, the way (a)–(h) are. Do not renumber anything.

## Decisions

- **A fixed width, re-derived — not a band that narrows with n.** Item 29(g)
  asks whether 0.05 is defensible at both edges, and that is answerable with a
  measurement. Rejected: the n-aware standard-error band, because it adds a
  user-visible dependence on history length that the item does not ask for, and
  because it cannot be argued for before the noise it is meant to absorb has
  been printed once.
- **Both arms, not just the flipping one.** A very wide band passes a noise test
  by never deciding anything, so the probe also has to show a genuine follower
  clears it. Rejected: measuring only the week-to-week flip rate the roadmap
  names first, because that arm alone can only ever argue the band wider.
- **Between-day spread and recall error; not fit drift.** The first two are what
  the mean of a handful of daily overlaps is exposed to. Rejected: a fit-drift
  arm, because `fit-snapshot-drift.probe.ts` already owns as-of-day versus
  whole-history drift and a second instrument on it would be the mirror R3 bans.
- **The probe drives the public entry point.** Rejected: exporting `sharesOf`,
  `overlapOf` or `taskSpreadOf` to score compositions directly — three new
  exports priced for one caller (AGENTS.md §0), when `auditPlanAdherence` already
  returns exactly the two means the verdict reads.
- **The derivation goes to MATH.md even though the constant stays in
  presentation.** R7 binds the derivation, AGENTS.md §4 binds the location, and
  the two are not in conflict: `STOP_INVERSION_MARGIN` is the precedent, derived
  in §8.10 and defined in the model.
- **The docblock's premise is the defect, not its wording.** "Means over a
  handful of days" is the justification for the width, and the card reads up to
  `AUDIT_DAY_CAP = 30` — at which the noise is a different size than at three.
  The fix is a citation to the probe, not a rephrasing (AGENTS.md §0:
  documentation is fixed in the diff that found it).
- **The off-centre null is recorded, not corrected.** A band centred on the
  null's own offset rather than on zero would name a neutral logger less often
  still, and it is not what item 29 asks for; the width was the question. The
  geometry that produces the offset is stated in MATH.md §9 so the next reader
  does not rediscover it.
- **ROADMAP item 29's routing held.** The constant is where (g) says it is and
  the docblock says what (g) quotes. Noted because the plan phase is required to
  say so either way: some roadmap items assert mechanisms that have since moved,
  and this one has not.

## What the measurement said

Read off `scripts/adherence-tie-band.probe.ts`'s run of 2026-09-01, which is the
only place those figures are maintained — this section is the frozen record of
the decision, not a second home for them.

- **The null is not centred on zero, and that is the reason 0.05 was wrong.** A
  logger with no preference for either plan reads a mean difference of −0.1040,
  twice the shipped band, toward the classic plan. It is geometry rather than
  noise: a composition drawn at random spreads its hours over most of a day's
  tasks, and the classic plan spreads while the energy plan concentrates. So the
  band is not symmetric in what it protects — a neutral logger is at risk of
  being called a classic follower and essentially never an energy one. At 0.05
  every neutral 30-day window was named; at 0.2 none is.
- **The shipped 0.05 was under the wander at every day count the card reads at**,
  n = 30 included (sd of the 30-day mean 0.0357).
- **A true follower clears the new band with room.** With ±5 or ±15 minutes of
  recall error the mean difference reads 0.345–0.366, against |Δdiff| of 0.0049
  and 0.0145 for recall error alone.
- **The residue, named and not fixed:** below about five scored days no fixed
  width does both jobs — the neutral p95 at n = 3 is 0.3544, level with a true
  follower's own signal of 0.345–0.366. The card is at its least trustworthy in its first week,
  and this change does not repair that.

## Open questions

None.
