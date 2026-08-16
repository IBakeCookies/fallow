# What still reaches the gain cap

**Status:** landed 2026-08-17 · **Roadmap:** item 31, finding M7

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Nothing the user sees changes unless the measurement forces it. MATH.md §19.4
states a 999% gain ladder — the sole surviving justification for
`GAIN_PERCENT_CAP` — that no committed probe reaches, and asserts the user who
triggers it exists without ever fitting one. After this, a probe backs both
halves, §19.4 and its verbatim mirror in `zenith.ts` state what was measured,
and if the cap turns out to have no reachable trigger at all, `gainPercentOf`
loses the branch that cannot fire.

## Scenarios

The four Claims below are the measurement. The single Scenario is **gated on
what they find** and does not get written until they have run — see the gate in
**Decisions**, which is the one place this spec deviates from R6's
failing-test-first order and says why.

**The figures quoted inside the Claims are §19.4's, not results** — they are what
the probe was built to confirm or refute, and two of them did not survive it.
Landed 2026-08-17: the 569% of Claim 3 is **291.7%**, and Claim 1's "default
sliders" is a difficulty-5 cell (the form's 5/5 draft is effective difficulty
6.5). Claim 2's answer is that the rungs **do** move under σ > 0 — one to four
budget steps later. MATH.md §19.4 is the current truth; this file is not.

### Claim — the 999% ladder at a fitted short-ϕ user _(pin, if it reproduces)_

`scripts/gain-cap-trigger.probe.ts` → MATH.md §19.4

- **Given** the single-budget path (`productivityGain`), a user whose fitted
  constants put ϕ̂ at the `PHI_FLOOR_HOURS = 0.1` clamp, tasks at the default
  sliders, and the app's own budget lattice swept 0.25–24 h in 0.25 h steps
- **Then** the first budget at which `gainPercent` reads `GAIN_PERCENT_CAP` is
  4.25 h at n = 1, 8.5 h at n = 2, 13 h at n = 3 and 17.25 h at n = 4
- **Then** n = 6 never reaches it within 24 h, and its 24 h maximum is 912%
- **Then** n = 5 is reported, which §19.4 skips without saying why
- **Then** at ϕ̂ = 0.17 h the n = 1 rung moves to 7 h

### Claim — the ladder's σ is stated, not left to the reader

`scripts/gain-cap-trigger.probe.ts` → MATH.md §19.4

§19.4 says "fitted" and never says σ. At ϕ̂ = 0.1 h a non-zero σ_ϕ can fire
§5.1's monotone-prefix cut and truncate the optimizer's menu, so the ladder is
σ-dependent and the document's silence is itself the defect.

- **Given** the same sweep run twice — once at σ = 0, once at the σ_ϕ the fit
  actually produces (`phiParameterStd`)
- **Then** both ladders are printed, and the rungs are reported as equal or as
  differing by a stated number of budget steps
- **Then** §19.4 names which arm its figures came from

### Claim — at default constants the cap is out of reach

`scripts/gain-cap-trigger.probe.ts` → MATH.md §19.4

- **Given** `DEFAULT_USER_CONSTANTS` and the same 0.25–24 h sweep
- **Then** the single-budget 24 h maximum is 569% at n = 1
- **Then** the pooled path (`pooledProductivityGain`) maxes at 41.6%

### Claim — can a real ⚡ history put a user at the ϕ floor?

`scripts/gain-cap-trigger.probe.ts` → MATH.md §19.4

The half §19.4 asserts and never measures: "a fast-flow user logging 15–30m
everywhere". A grid can hold ϕ̂ at 0.1 h by construction; the question is whether
`fitUserConstants` ever gets there from logs a person could produce.

- **Given** seeded synthetic `FlowObservation` histories at 15–30 min durations
  across the log counts and coverage shapes
  `phi-cap-reachability.probe.ts` already sweeps, fitted through
  `fitUserConstants`
- **Then** the share of fitted users whose `calculateFlowStateTime` hits
  `PHI_FLOOR_HOURS` on the 1–10 × 1–10 slider grid is reported, with the
  smallest ϕ̂ reached when it is not the floor
- **Then** every history that reaches the floor is reported with its
  `fitted` flag true — a fit that fell back to the defaults is not a fitted user

### Claim — is the `naive = 0` arm dead code?

`scripts/gain-cap-trigger.probe.ts` → MATH.md §19.1, §19.4

§19.4 retires the cap's original trigger with an argument, not a sweep: the
`naive = 0` arm "now requires a budget under one whole block, where the
optimizer scores 0 too and the function returns 0". If that holds,
`optimized > 0` at [`zenith.ts:1588`](../../src/lib/business/model/zenith.ts#L1588)
is unreachable, which AGENTS.md §0 says is a lie about what can happen.

- **Given** the same sweep plus the pool-starved and short-budget days
  `rv14-naive-switch-bill.probe.ts` already generates
- **Then** the count of `(naive = 0, optimized > 0)` days is reported, with a
  witness day if it is not zero

## Out of scope

- **Changing `PHI_UNCERTAINTY_RELATIVE_CAP`.** Settled at 0.5 (AGENTS.md §4,
  MATH.md §5.1). The σ arm above reads the cap; it does not re-open it.
- **M8 (§19.3), M2 (§21.4) and the other item 31 findings.** M8 shares this
  spec's fitted-posterior harness and is the natural next item, but item 29's
  rule is one check per finding.
- **Re-measuring §19.1–19.3.** Only §19.4's figures and the `naive = 0` arm's
  reachability are in question here.
- **`GAIN_PERCENT_CAP`'s value.** If the gate below fires, the branch goes; the
  spec does not propose a different saturation number. 999 as "≥ 10× reads as
  capped" is a display choice with no measurement behind it either way.
- **The gain's display.** No component, view model or band changes.

## Read before building

Line numbers are as of planning. Sections and symbols are the durable address.

- `MATH.md:4889-4912` — §19.4, the ladder (`:4898-4905`) and the "so the honest
  statement is" paragraph (`:4907-4912`), which is where the `naive = 0` arm's
  retirement is argued. The section under test.
- `MATH.md:2244` — §10, the doc-only revision log. R7 requires a dated entry
  when the correction is explanation-only; if the gate fires it is **not**
  explanation-only and §19.4 changes on its own terms instead.
- `src/lib/business/model/zenith.ts:1405-1423` — `GAIN_PERCENT_CAP` and the
  docblock that mirrors §19.4's ladder verbatim. Both halves move together, or
  the next audit raises M7 again.
- `src/lib/business/model/zenith.ts:1583-1589` — `gainPercentOf`, the two cap
  sites: the ratio guard at `:1585` and the `naive = 0` arm at `:1588`. Not
  exported; reach it through `productivityGain` and `pooledProductivityGain`.
- `src/lib/business/model/zenith.ts:164`, `:173` — `PHI_FLOOR_HOURS` and the
  clamp in `calculateFlowStateTime`. "ϕ̂ at the floor" means this clamp is active.
- `src/lib/business/model/zenith.ts:1853-1861` — `fitUserConstants`' signature:
  `{ constants, fitted, posterior, effectiveCount }`. `fitted` is the flag the
  fourth Claim checks.
- `scripts/phi-cap-reachability.probe.ts:205-243` — `drawUser` and `logAt`, the
  synthetic-history generator to lift. **`drawUser`'s ranges are inverted for
  this spec**: it draws `c1: 0.3 + rand() * 1.1` deliberately wide toward SLOW
  users because §5.1's corner needs ϕ̂ > 3.06 h. This spec needs the other end.
- `scripts/phi-cap-reachability.probe.ts:395-412` — `sweepHistory`, the
  `fitUserConstants(logs)` → `phiParameterStd` call shape, and its `max-depth`
  note: `scripts/**` gets no exemption from that rule.
- `scripts/rv14-naive-switch-bill.probe.ts:80-95`, `:150-160` — the day
  generator and `seatedCount`. Its budget draw stops at **8.25 h**, which is why
  it cannot see this ladder. Item 31's M7 entry says 10 h; correct that line too.
- `scripts/PROBES.md` — the new row. `node scripts/probe-registry.mjs --check`
  fails `npm run lint` without it.
- `docs/testing.md:233-250` — probe policy: seed the randomness, date the number
  where it is quoted, and pin what the probe found with **one** suite fixture,
  never the sweep.
- `ROADMAP.md:496-500` — item 31's claim that "**nothing runs a fitted
  posterior** at σ_ϕ > 0 (M7 and M8 both rest on it)". **False, and correcting
  it is part of this change**: `phi-cap-reachability.probe.ts` imports
  `fitUserConstants` and `phiParameterStd` and fits synthetic histories at two
  noise arms. `rv15-gain-headroom.probe.ts:51` fits too, but only
  `fitUserConstants([])`, which returns the defaults — that one is not a
  counter-example and the corrected line should say so.
- `src/lib/business/model/AGENTS.md` — only if the gate fires and a public
  export's behaviour changes.

## Decisions

- **The probe answers reachability, not just the ladder.** §19.4's figures and
  §19.4's claim about who can trigger them are separate assertions, and only the
  second decides whether the cap guards anything real. Rejected: reproducing the
  quoted numbers alone, which is M7 as literally worded — it would close the
  finding and leave the assertion standing for the next audit to raise.
- **One probe, five arms, not five probes.** All five Claims share one fitted
  user and one budget sweep; splitting them would re-fit the same histories four
  times and give the registry four rows for one question.
- **The σ arm exists because §19.4 does not say.** Rejected: assuming σ = 0
  because the figures look like grid numbers, and assuming σ > 0 because the
  text says "fitted". M1 is the precedent — that entry's prescribed fix was
  wrong for exactly this class of unstated-quantifier reading, and it only
  surfaced under execution.
- **The gate, and why it inverts R6.** The behaviour half of this spec is
  conditional on a measurement, so its failing test cannot be written first.
  Land the probe and its Claims, then evaluate: **if** no fitted history reaches
  the ϕ floor (Claim 4) **and** the ladder is therefore unreachable from the
  product **and** the `naive = 0` arm never fires (Claim 5), then
  `GAIN_PERCENT_CAP` has no reachable trigger and `gainPercentOf` collapses to
  the plain ratio — one scenario, `zenith.test.ts`, written at that point
  against the measured witness. **Report the numbers before landing that half.**
  If any one of the three fails to hold, the cap keeps a trigger, the gate does
  not fire, and the change is the probe plus the corrected §19.4, its mirror,
  the registry row and the ROADMAP line.
- **Item 31's structural-hole claim is corrected here, not reported.** AGENTS.md
  §0's documentation exception: the sentence sent this spec looking for
  infrastructure that already exists, and it names M8 too, so it will misroute
  the next item as well. Rejected: leaving it and noting it, which is what §0
  exists to stop.
- **`GAIN_PERCENT_CAP`'s value stays 999 either way.** The ladder establishes
  reachability, not calibration; nothing measures what a good saturation point
  would be, and inventing one would be a second unbacked number in the place
  this spec exists to remove one.

## Open questions

None.
