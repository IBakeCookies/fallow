# Roadmap

Fallow sits at a stable V1: two peer planning modes (the default Zenith
Gradient allocator and the Energy Lab), a full calibration loop (⚡ time-to-flow,
☕ recovery, 🪫 drain, stop-time λ₀), plan advice, the analytics audit, offline
PWA, en/de.

The math behind every item lives in [MATH.md](MATH.md). Settled decisions are
in [AGENTS.md §5](AGENTS.md) — notably the two roads deliberately not taken:
the energy model stays a peer mode, never a replacement (MATH.md §15), and run
order stays the nature-alternation heuristic (§16). Do not re-open those here.

Phases are priority order, agreed 2026-08-03. Update this file when an item
ships or is rejected.

## Phase 1 — in-day companion

The model is strong at 8am and silent at 2pm; these close that gap.

1. ~~**Live stop advisor**~~ — SHIPPED 2026-08-03 (MATH.md §8.11): `adviseStop`
   prices the best next _session_ (max over open tasks × durations of average
   value/hour) from today's 🪫 logs against λ₀; card on `/energy`. Probed
   first, as planned: session-lookahead cut the one-step verdict's mid-day
   false stops from 16–25% to 5–6% at high λ₀, at-stop agreement within one
   45-min step throughout.
2. ~~**Interactive budget slider**~~ — SHIPPED 2026-08-03: a range input beside
   the Available Hours field in the day-constraints bar, sharing its bounds and
   its value. No new plumbing was needed — the whole plan is already one
   `$derived`, so a drag re-solves the day at the ~1–13 ms/solve of realistic
   task counts. Plan advice deliberately does **not** follow the drag: it stays
   on-demand behind `isAdviceStale` (MATH.md §14), because at 12 tasks the
   advice run is `activeTasks + 3` solves.
3. ~~**Marginal-of-budget diagnostic**~~ — SHIPPED 2026-08-03 (MATH.md §14.2):
   one extra solve at `budget + BLOCK_HOURS` prices the next 15 minutes and
   names the task that would get them; a line in the advice card. Open-scoped
   (§11.8) — review caught the plan-scoped reading naming an already-completed
   task as the recipient, worth up to +33.4%. Still a
   budget diagnostic rather than a per-task column, but **the reason planned
   here was wrong** — the probe found per-task marginals do _not_ equalize at
   the optimum (relative spread median 0.265, p90 0.803). What survives: the
   column prices no lever the user owns, and it ignores the pools and switch
   cost, overstating the budget's yield on 16% of days. The finding that
   justified shipping it: on **35%** of days another block buys nothing, and on
   every one of those the card was still offering "work an extra hour".

## Phase 2 — calibration trust

4. **Censored-likelihood stopping fit** — worked-to-edge, zero-work and
   inverted days currently drop out of the §8.10 fit; a one-sided likelihood
   term would use them. Build once real usage shows enough censored days.
5. ~~**Fit-snapshot persistence**~~ — SHIPPED 2026-08-03 (MATH.md §12.1): a
   `fitSnapshots` store keyed by date, holding only what a fit can move (the ϕ
   plane with its posterior, α_cog/α_phys/r, λ₀); the §12 audit scores each day
   under the fit recorded that day, and the "Your model" card draws each fit as a
   sparkline against its default. Only today's record is ever written, so a
   day's fit is immutable once the day passes; a day with no snapshot falls back
   to the live fit. **Probed first, and the gap was bigger than assumed**: on a
   drifting synthetic year, α_cog as of day 10 was 0.3069 against a
   whole-history 0.4973 — the early day had been audited against a drain rate
   62% too high. Recomputing the fit per day instead was rejected on cost, not
   on correctness: it would fix history retroactively (which storing cannot) but
   costs a whole-history fit per audited day — 19 ms/day, 570 ms per 30-day
   audit — so it grows with everything the user ever logs. The accepted cost is
   that the correction only accrues forward.
6. **Per-task ϕ offsets** — hierarchical partial pooling on top of the global
   c-plane, ridge toward 0 with the same MAP machinery as the α/r/λ₀ fits, so
   repeated ⚡ logs on one task sharpen that task without destabilizing the
   rest. Probe first: do offsets actually move plans on real logs?

## Phase 3 — multi-day horizon

7. **Satiety across days** — reservoirs already carry over overnight (§11.9);
   satiety still resets at midnight, so yesterday's 7 h of guitar doesn't
   temper today's κ.
8. **Priced defer destination** — §14 prices a defer's today side only; the
   "To tomorrow" button commits to a destination whose gain is unpriced.
   §11.9 already predicts tomorrow's morning reservoirs, so "tomorrow gains X"
   is one extra solve on the destination day.

## Phase 4 — product and reach

Only if Fallow grows users beyond its author.

9. **Weekly retrospective digest** — the §12 audit and the calibration
   snapshot, summarized per week in analytics.
10. **Sync** — default no (the no-server stance is a feature); revisit as
    file-based export/merge if a second device becomes a felt need.
