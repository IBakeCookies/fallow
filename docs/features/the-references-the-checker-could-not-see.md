# The references the checker could not see

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** finding M53

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

M53 was filed as a count, not a check: probe headers referring to MATH.md
without naming a section, which `scripts/math-citations.mjs` structurally
cannot see — its regex needs a `§N` to resolve. After `e61d207` cut MATH.md to
derivations only, some of those references pointed at narrative that no longer
existed. The entry said explicitly that counting them was not checking them and
that the population was mixed.

## What was found

**The count was wrong and the population was worse.** M53 said 27 references in
19 files; scanning every `MATH.md` occurrence not followed by a `§` finds **54
in 24 files**. The filed number came from headers alone.

Two of the 54 are correct as written and stayed:
`curve-marginal-facts.probe.ts` (its constants are transcribed from §2's
derivation, not from `zenith.ts`, which is the point of the file) and
`energy-search-gap.probe.ts` ("never in MATH.md — which holds derivations
only"). **Every other one was stale**, in three kinds:

- **A claim attributed to a section that no longer exists.** "MATH.md reports
  'exact on 99.5%, p99 0.00%, worst 0.09%'", "MATH.md's table claims the gain
  read NEGATIVE on 4% to 19%", "MATH.md is the sole surviving justification for
  the cap", "MATH.md's whole case for the `fitSnapshots` store".
- **Archaeology printed into a run log.** `stop-inversion-margin.probe.ts`
  emitted "(MATH.md said zero until 2026-08-06)", "(MATH.md said ~+0.1 until
  2026-08-06)", "(MATH.md said ~0.15 until 2026-08-06)" and "(MATH.md said
  1.32 → 1.16 until this run)" beside its own numbers — a probe's OUTPUT
  asserting a document's state.
- **An instruction to follow a deleted rule.** `sat-gate-floor.probe.ts` still
  said the printed numbers "belong in MATH.md WITH THEIR DATE". This is an
  M52 survivor: that sweep grepped `WITH ITS DATE`, and this file wraps the
  same rule with a different pronoun.

The sweep also reached outside the probes, where the same fault sat in test
comments — five in `calculation.test.ts` ("the rate MATH.md quotes", "the exact
pair MATH.md quotes", "the constant MATH.md quotes", "the seam MATH.md
accepted"), one in `daily-metrics.test.ts`, and one in `generate-fixture.mjs`
that attributed a real figure to MATH.md when it lives in
`src/lib/business/model/AGENTS.md`'s per-task-ϕ decision, which now carries the
citation.

One dangling reference that DID name a section turned up on the way:
`hedged-stop-band.probe.ts` cited "§4's own rule" for what makes a number
unbacked. §4 is the allocator and says nothing of the kind; that rule is
`docs/testing.md`'s. It passed `math-citations.mjs` because §4 exists.

## What was measured

Four probes were re-run rather than de-attributed, because their headers'
figures were the deleted document's rather than their own. Every number below
is from this file's date.

- **`pool-allocator.probe.ts`** — the header asked whether the suboptimality has
  an envelope and answered by quoting two MATH.md figures. It does not: over
  five seeds of one generator, app-reachable days are exact on 93.6–94.5% and
  their worsts run [4.56%, 3.37%, 4.81%, 3.83%, 5.28%] — a **1.91% spread
  between seeds**, which is the answer and is why no single worst is a bound.
- **`fit-snapshot-drift.probe.ts`** — both numbers the `fitSnapshots` store
  rests on. Drift: the day-10 fit is 0.3447 against a whole-history 0.5240,
  **52% high**, and inside the 30-day audit window the same fit moves only 3.3%.
  Cost: one whole-history fit 18.6 ms, a 30-day refit 500.1 ms (16.7 ms/day),
  and the per-day cost tracks volume (33.8 at 2×, 73.6 at 4×) — the
  O(auditDays × totalLogVolume) claim.
- **`rv13-prior-posterior.probe.ts`** — the σ_ϕ ladder reads 0.410839 /
  0.191020 / 0.071920 / 0.022613 / 0.002473, each equal to its closed form. Two
  quoted figures do **not** hold: the prior's σ_ϕ is **24.0%** of the
  slider-centre ϕ̂, not 29%, and the plan differs from the certainty plan on
  **6.8%** of 1000 seeded days at n = 1, not 21.7%.
- **`rv13-naive-lattice.probe.ts`** — the before-fix negative-gain rate is a
  band, 7.8% / 3.8% / 5.0% / 4.5% / 4.3% / 6.8% at n = 2…8, **not the rising
  4% → 19% ladder** that was quoted. After the fix it is 0.0% at every task
  count, pooled included.

`gain-cap-trigger.probe.ts` was re-run too and its ladder held: the cap is first
reached at 4.25 / 8.5 / 13 / 17.25 / 21.75 h for n = 1–5 on the ϕ̂ = 0.1 h floor
and never within 24 h at n = 6. At the defaults it is not reached at all
(291.7% at n = 1, 41.6% pooled), and the 569% once quoted there reproduces from
no reading the file tries — which that file already measured and now states
without a claimant.

## What was deliberately not done

- **A checker.** `math-citations.mjs` resolves `§N` to a heading and can see
  neither what the heading still says nor an unnumbered sentence. A regex over
  quoting verbs would fire on the two legitimate references and miss a
  paraphrase. What went in instead is the rule, in the file that owns probe
  policy: `docs/testing.md` now says a header states the claim rather than
  describing what MATH.md says about it, and says why the checker cannot help.
- **Re-running the remaining probes.** Only the four above had the deleted
  document's figures standing IN their headers. The rest named a claim without
  quoting a figure, so removing the attribution was the whole repair — the same
  deletion-only rule M52 ran under.

## Where it landed

- 23 probe and test files under `scripts/` and
  `src/lib/business/model/metric/` — 52 references removed or restated, four
  headers rewritten from their own runs.
- `docs/testing.md` — the rule, in the probe-writing section.
