# The pool the drain logs might know

**Kind:** model · **Status:** landed 2026-08-30 · **Roadmap:** item 18 (its gate only)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

`DEFAULT_CAPACITY_POOLS` is two invented constants — 4 h cognitive, 6 h
physical — and §8.7 already fits a per-user drain rate α from the 🪫 logs. The
reservoir law run backwards turns α into hours: the pool becomes the point where
a full-demand day drains the reservoir to a shared floor. Two invented constants
collapse into one floor plus a fitted parameter.

This spec builds **only the map and the gate**: the closed-form inversion, its
validity domain, MATH.md §8.13, and the probe that decides whether the derived
pool is worth preferring over 4/6. The quantity that would move for the user is
`CapacityPools`, and it moves in a **later** spec — nothing the user sees
changes here. If the probe fails, item 18 becomes a not-proposed entry and the
map is deleted in the same commit that records why.

## Claims

### Claim — the map inverts the reservoir law at the floor

`src/lib/business/model/zenith-energy.test.ts`

- **Given** default recovery params (`r` 0.7, `m` 1.5, `b` 0.05) and floor
  `CAPACITY_FLOOR`
- **Then** `capacityFromDrainRate(0.35, …)` returns 4.373 h
- **Then** `capacityFromDrainRate(0.30, …)` returns 5.307 h
- **Then** `capacityFromDrainRate(0.70, …)` returns 1.976 h

A closed form has nothing to sweep, so it is pinned by a suite fixture and gets
no probe row ([scripts/PROBES.md](../../scripts/PROBES.md)). The three figures
are item 18's, recorded there before this spec; the test asserts them to 1e-3,
and if a run disagrees the **run** is what gets written down.

### Claim — below the pole the map returns no number at all

`src/lib/business/model/zenith-energy.test.ts`

- **Given** α = `ALPHA_FIT_MIN` (0.05), a value a real fit can reach
- **Then** `capacityFromDrainRate` returns `null`, not a finite pool
- **Given** α just below `CAPACITY_MAP_POLE_MARGIN` × the params' own pole
- **Then** it returns `null`
- **Given** α just above it, at any recovery rate
- **Then** it returns a number

`C_eq = b·r′/(α + b·r′)` reaches the 0.28 floor at α = 0.135 under the default
recovery parameters, and the neighbourhood above it explodes — item 18 records
0.20 → 9.49 h and 0.15 → 17.7 h against 0.35 → 4.37 h. `ALPHA_FIT_MIN` sits
inside that region, so the domain is a **gate, not a clamp**: a clamped α would
hand back a wrong-but-plausible pool, which is worse than handing back nothing.

**The gate is a multiple of the pole, not a fixed α** — a correction this
build's own reviewer caught. The pole is at `r′·b·(1 − C*)/C*`, so it moves
with the recovery parameters the fit conditions on: a fixed floor of α = 0.2
bounds H only at r = 0.7. At r = 1.0057, the recovery arm A actually fits, it
lets 17.33 h through.

### Claim — the map is decreasing in α over its valid domain

`src/lib/business/model/zenith-energy.test.ts`

- **Given** any two α in `[CAPACITY_MAP_ALPHA_MIN, ALPHA_FIT_MAX]`
- **Then** the larger α maps to the smaller or equal pool

This is the property that makes the §8.7 logs-per-day bias readable: α̂ drifts
**upward** with the 🪫 opt-in rate, so the derived capacity **shrinks the more
diligently the user logs**. The claim pins the direction; the probe below sizes
it.

### Claim — the derived pool beats declared 4/6 when the law is true

`scripts/capacity-from-drain.probe.ts` → MATH.md §8.13

- **Given** the committed generator run with `--true-pools` set from
  `capacityFromDrainRate` at the run's own `--alpha-cog`/`--alpha-phys`, over a
  grid of α whose derived pools straddle 4/6
- **Then** report `|derived − truth|` against `|declared 4/6 − truth|`, per grid
  point, where `derived` comes from the real `fitDrainRate` over the generated
  🪫 rows and not from the truth
- **Then** report mean `classicOverlap` (`plan-audit.ts`) over the generated
  finished days under `pools = derived` against `pools = 4/6`

**Kill the item if the derived pool does not raise `classicOverlap` here.** This
is the arm where the reservoir law generates capacity by construction; a map
that cannot win on its own generator can never win anywhere, and what would have
beaten it is fit noise, the logs-per-day bias, or proximity to the pole.

**Outcome: the criterion above could not be applied.** The arm was run with a
control it did not originally carry — `classicOverlap` scored under the pool
that GENERATED the days. That control ranks the known-correct pool at or below
declared 4/6 at three of the four evaluable grid points (Δ +0.0000, −0.0035,
−0.0024, +0.0116), including the two where the correct pool binds on most of
the scored days (43/60 and 47/60). An instrument that scores the right answer
below a wrong one cannot decide between two wrong-ish ones, so the gate is
**void, not failed**: no verdict about the map is readable from it, in either
direction. At the one point where the control does see the pool (α 0.95/0.6,
truth binding 60/60) the derived pool beats both 4/6 (+0.0341) and the truth
itself (+0.0116) — one favourable reading, on one point, from an instrument
shown unreliable on the other three.

The cause is structural rather than a fixture accident: a pool of P hours
cannot bind on a day shorter than P hours, the fixture's days run to a median
3.25 h against a 6 h declared physical pool, and 4/6 binds on at most 16 of 60
scored days, so the baseline is close to a no-op. See Decisions.

### Claim — bound the loss when capacity is not the reservoir floor

`scripts/capacity-from-drain.probe.ts` → MATH.md §8.13

- **Given** the same generator with `--true-pools` swept **independently of α**,
  so the map is wrong by construction
- **Then** report the worst and mean `classicOverlap` loss against declared 4/6
  across the grid

**Kill the item if the map is worse than 4/6 over most of the grid.** A user
whose capacity is not what their drain rate says is the user this map hurts, and
this is the only arm that prices that.

**Outcome: this arm produced no derived pool at any point, and that is the
second finding.** Its α is the generator's own (0.52 / 0.24), and the fitted
α̂_phys lands at 0.261–0.267 — below §8.13's gate at the r̂ ≈ 1.0 the fixture
fits, because the gate is proportional to the fitted recovery rate (α ≥ 0.2025
at r = 0.7, α ≥ 0.2893 at r = 1.0). So the arm now measures the map's domain
rather than its misspecification loss. That is worth more than what it was
built to measure: **the map declines to answer for the physical reservoir
across this entire regime**, and for three of the five logging-rate rows below.
Six of its nine grid points are additionally degenerate — their pools never
bound, so the generator emitted a day-for-day copy of an earlier point.
Re-running this arm usefully needs an α_phys inside §8.13's domain, which is a
different question from the one it was written to ask.

### Claim — what the 🪫 opt-in rate costs the derived pool

`scripts/capacity-from-drain.probe.ts` → MATH.md §8.13

- **Given** one fixed truth and the generator's per-session 🪫 opt-in rate swept
  over 0.10, 0.25, 0.50, 0.75 and 1.00
- **Then** report the realised logs per day, α̂ and the derived pool at each rate

The committed measurement the ROADMAP's uncommitted variant could not emit. Its
output sets `CAPACITY_MAP_MIN_HOURS` / `CAPACITY_MAP_MAX_HOURS` below — the band
is read off this run, never chosen.

### Claim — the derived pool is bounded to a stated band

`src/lib/business/model/zenith-energy.test.ts`

- **Given** any α in the valid domain
- **Then** the returned pool lies within `[CAPACITY_MAP_MIN_HOURS,
CAPACITY_MAP_MAX_HOURS]`

**Not delivered, deliberately.** Its two constants were to be read off a gate
that turned out unrunnable, and a clamp exists to keep a shipped number
survivable — but nothing ships: no allocation reads the map, so there is no
consumer for a band to protect. Building one anyway is the speculative
generality AGENTS.md §0 refuses. The bias itself is real and measured (the
claim below stands); bounding it belongs to whatever change first gives the map
a reader.

### Claim — the generator's existing output does not move (pin)

`scripts/adv2-switch-cost-price.probe.ts` re-run, its header figures unchanged

- **Given** `node scripts/generate-fixture.mjs --seed 42 --days 365` with no new
  flags
- **Then** the emitted backup is byte-identical to today's

The pool constraint and the α overrides are **opt-in flags defaulting to today's
behaviour**. `adv2-switch-cost-price.probe.ts` hard-codes "298 days" in its
header and is the generator's only code consumer; a changed default would go
stale silently. This claim passes on the first run against the old code, which
is its pass condition.

## Out of scope

- **The per-day prefill and the apply button.** Item 18's payload — writing the
  derived pool into the day's `cognitivePool`/`physicalPool` slot (which item 32
  already built) behind a text button beside the inputs at
  `day-constraints-bar.svelte:151-183`. It gets its own spec once this gate is
  survived. Acceptance criteria cannot be written for a button whose number may
  not exist.
- **`capacityPoolsFromDrainRates`**, the pair-level wrapper. Only the prefill
  needs it, and `constraint-memory.ts`'s "the pair or nothing" invariant is a
  decision that belongs to the spec that writes the pair. This one exports the
  single-reservoir function and nothing else.
- **A button on the switch-cost input.** Settled: "the switch cost is
  instrumented but never advised" (AGENTS.md §4).
- **`DEFAULT_CAPACITY_POOLS` itself.** It stays 4/6. It is the fallback for
  every stored day with no pools (`session-history.ts:327-328`,
  `metric/history.ts`), so changing it re-scores history against
  [data/AGENTS.md](../../src/lib/data/AGENTS.md)'s settled "a past day's fit is
  what the user had".
- **Fitting the floor `C*` per user.** Choosing it to maximize
  `classicOverlap` is adherence-fitting, which ROADMAP's not-proposed list
  refuses by name: it is self-confirming and destroys the only audit there is.
  The floor is one constant, set once in MATH.md.
- **A probe arm on the user's own exported backup.** Considered and declined:
  the app targets many people, so one real profile is n = 1 and gates nothing
  a generator cannot.

## Read before building

- ROADMAP item 18 ([ROADMAP.md:146-190](../../ROADMAP.md)) — the item. **Two of
  its lines are corrected by this spec's landing commit**, see Decisions: its
  probe reads "on real finished days", which is not what gets built, and its
  "MATH.md section required" resolves to §8.13. The item stays **open** after
  this lands unless the probe kills it.
- MATH.md §8.7 (lines 909-1006) — the reservoir law
  `C(H) = C_eq + (1−C_eq)e^(−ρH)`, `ρ = α·w + r′·g`, `C_eq = r′·g/ρ`,
  `g = 1 − (1−b)·w`. The map is this at `w = 1` solved for `H`. **New section
  §8.13 lands with the map (R7)**, and `node scripts/math-index.mjs` regenerates
  the index or `npm run lint` fails.
- `src/lib/business/model/zenith-energy.ts:1470-1530` — `ALPHA_FIT_MIN`,
  `ALPHA_FIT_MAX`, `fitDrainRate`, and `reservoirLaw`/`reservoirAt`, which the
  map inverts. The new export goes beside them: this file already imports from
  `zenith.ts`, so `CapacityPools` is reachable and the reverse is not.
- `src/lib/business/model/AGENTS.md` — the area brief. **A new public export
  belongs in its interface list**; that is the half of this change that outlives
  the spec.
- `src/lib/business/model/zenith.ts:1298-1340` — `CapacityPools` and the pool
  constraint `Σ wᵢ·tᵢ ≤ pool`, which is what the generator's new constraint must
  mirror exactly, or the probe recovers a different quantity than the one the
  planner spends.
- `src/lib/business/model/plan-audit.ts:120-200` — `auditPlanAdherence`, its
  `PlanAuditDay.pools` input, and `classicOverlap`. Its header note that cost is
  ~60 ms per day matters: the probe's grid must cap days per point (~60), not
  run 365 × the grid.
- `scripts/generate-fixture.mjs:307-420` — the day simulation. It hard-codes
  `cognitivePool: 4, physicalPool: 6` on the session and its simulated user has
  **no capacity constraint at all**; the new `--true-pools` flag adds one
  (`Σ demand·hours ≤ pool`, truncating the session) while the **stored** pools
  stay 4/6, which is the truth-≠-declared setup the probe needs. Its header also
  disclaims gating "what does the user actually do" — read it before writing the
  probe's own header.
- `scripts/adv2-switch-cost-price.probe.ts:23-75` — how a probe spawns the
  generator into a temp dir and reads the backup, and the "298 days" figure the
  pin above protects.
- `scripts/PROBES.md` — a new probe needs its registry row or
  `scripts/probe-registry.mjs --check` fails `npm run lint`.

## Decisions

- **The gate runs on the committed generator, not on real days.** Item 18's
  probe sentence says "real finished days"; that is corrected in the landing
  commit. One real profile is n = 1 against a many-user question, and the
  generator's own header refuses to gate "what a user habitually does" — so this
  spec claims neither. What the generator **can** decide is whether the
  estimation chain survives its own law (Claim 4) and how badly it fails when it
  does not (Claim 5), which is enough to kill the item and not enough to confirm
  it. A surviving map therefore ships as a **prefill the user overrides**, never
  a silent replacement. Rejected: probing the user's own export, because it
  would answer for one person and read as if it answered for everyone.
- **The true pool in Claim 4 is derived from the truth α, not chosen.** Capacity
  leaves no signature in a 🪫 rating — the rating reads the reservoir, and the
  pool only truncates hours. A generator whose true pool were independent of its
  true α would fail the map by construction and prove only that the generator
  disagrees with it. So the two arms are split: self-consistent to test the
  estimator, misspecified to bound the damage.
- **`classicOverlap` scores the map; it never trains it.** The derived pool is
  fitted to 🪫 ratings, an instrument independent of the audit, and the audit is
  used once, offline, as the evaluation metric. Sweeping the pool to the
  overlap-maximizing value and shipping that argmax would be the
  "adherence as an objective term" ROADMAP already refused; the sweep may be
  **reported** as a diagnostic and its argmax may not ship.
- **The floor `C*` = 0.28 is a stated constant, not a fit.** It sits between the
  two default-α readings (`C_cog(4 h)` = 0.3042, `C_phys(6 h)` = 0.2516), so at
  defaults the map reproduces roughly the pools the app already had — 4.373 h
  and 5.307 h. That is the whole net reduction being claimed: one floor plus one
  fitted parameter in place of two invented numbers.
- **The map's valid domain is proportional to the fitted recovery rate, and
  that is what actually closed the attempt.** The pole sits at
  `r′·b·(1 − C*)/C*`, so the gate scales with r̂: the fixture fits r̂ ≈ 1.0
  against a default 0.7, which lifts the gate 43% to α ≥ 0.2893 and puts the
  physical reservoir's fitted drain rates underneath it. This finding does not
  depend on the audit instrument at all, which is why it survives the void
  gate. It was reachable only because the reviewer caught that a fixed
  `CAPACITY_MAP_ALPHA_MIN` bounds H at the default recovery and nowhere else —
  at r = 1.0057 it passed 17.33 h through.
- **The gate is void, and the map lands as an instrument rather than being
  deleted.** The spec anticipated two endings — the probe passes and the map
  goes on to a prefill, or it fails and the map is deleted with the record. The
  third happened: `classicOverlap` cannot identify a capacity pool on days
  shorter than the pool, so it ranks the correct answer below the wrong one and
  decides nothing. Deleting the map on a void gate would destroy the only
  finding the exercise produced; promoting it would ship a number nothing
  established. So `capacityFromDrainRate`, §8.13 and the probe land, no
  allocation reads them, the pools stay declared, and ROADMAP item 18 stays
  open with its probe sentence corrected: **plan adherence is not a reading
  that can gate a capacity pool.** Rejected: re-running against a fixture with
  long enough days to make pools bind, because choosing the day length that
  makes the instrument responsive is choosing the answer.
- **Out of domain returns `null`, not a clamped α.** See Claim 2.
- **The bias is measured, not bounded.** See Claim 7.
- **The generator's new behaviour is opt-in.** See Claim 8.

## Open questions

None.
