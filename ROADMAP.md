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
2. **Interactive budget slider** — the classic model solves in ~1–13 ms at
   realistic task counts, fast enough to re-solve live while dragging
   `availableHours`. Makes the advice card's budget levers explorable.
3. **Marginal-of-budget diagnostic** — show the budget's shadow price: what
   the next block would be worth and which task gets it. A budget diagnostic,
   not a per-task priority column (marginals equalize at the optimum, so a
   column degenerates — MATH.md §14.1).

## Phase 2 — calibration trust

4. **Censored-likelihood stopping fit** — worked-to-edge, zero-work and
   inverted days currently drop out of the §8.10 fit; a one-sided likelihood
   term would use them. Build once real usage shows enough censored days.
5. **Fit-snapshot persistence** — append-only store of per-day fitted params
   (an R8 five-step schema change). Closes two documented gaps at once: the
   §12 audit compares against the fit as of the audited day instead of the
   current one, and the calibration card gets a params-over-time chart.
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
