/* Whether drift in a user's true recovery rate r and drain rates α_cog/α_phys
   dominates the noise of their unweighted whole-history fits (§8.9, §8.7) — the
   reading MATH.md §5.2 says has to exist before the three energy fits are
   recency-weighted, together or not at all. Two numbers move: the smallest
   drift, as a share of the starting rate, that a year of ☕/🪫 logs reads above
   a stationary logger's noise ceiling; and the drift past which fitting only
   the late half of the history beats fitting all of it, against the truth at
   the history's end.

   Tests: scripts/energy-fit-recency.probe.ts (this file — a probe, not a test;
     the self-check is its only assertion). Run: npm run probe -- scripts/energy-fit-recency.probe.ts
   Pins: none — nothing shipped moves
   Out of scope:
   - λ₀ (§8.10): its fit reads finished days with tasks, which this generator
     does not write. Same instrument, a second probe, once these two show
     structure.
   - Any weighted estimator, an `ageDays` on an energy fit, or any change under
     src/: the probe reads the fits that exist, on halves of the history.
   - Real logs: probes read no user data (phi-prequential-skill.probe.ts).
   - The fresh-start bias §8.7 accepts: each 🪫 row is drawn from a full
     reservoir, as the fit assumes, so the run measures the estimator and not
     the model's approximation.
   Read before building:
   - MATH.md §5.2 — the deferral and its three reasons. The paragraph naming
     this instrument lands at the end of that section, before "Consequence to
     keep in mind": derivation only, no figure from the run (R7), then
     `node scripts/math-index.mjs`.
   - MATH.md §8.7, §8.9 — the two closed forms the generator draws from and the
     fits read. `reservoirLaw`/`reservoirAt` are private to zenith-energy.ts,
     so the generator writes the §8.7 form itself, as generate-fixture.mjs does.
   - src/lib/business/model/energy-calibration.ts — `calibrateEnergyParams`,
     the one call that fits r then α conditioned on it, and the record →
     observation mappings; `fitDrainRate` in zenith-energy.ts for reading 3.
   - src/lib/data/type.ts — `RestObservationRecord`, `DrainObservationRecord`.
   - scripts/fit-snapshot-drift.probe.ts — the nearest generator; not lifted,
     see Decisions.
   - scripts/phi-prequential-skill.probe.ts — the self-check convention, and a
     header that quotes every figure from its own run.
   - docs/testing.md, Writing a probe — seeds, quote in the probe not in prose.
     The PROBES.md row is already written.
   Decisions:
   - Generator = the model's own two laws at the day's true rates, ratings
     quantized to 0–10 notches as the app stores them, seeded (mulberry32, the
     repo's probe convention). Demands come from the ten slider notches
     0.1…1.0, 🪫 hours from the 45-min lattice 0.75…3 h, ☕ breaks from
     0.25…2 h in quarter hours — rows the app could hold. Truth starts AT the
     defaults (r 0.7, α_cog 0.35, α_phys 0.3), so the ridge prior sits on the
     start of the drift: the case in which a whole-history fit hides it best.
   - Drift: θ(t) = θ₀·(1 + δ·s(t)), the same share δ on all three rates,
     δ ∈ {0, 0.1, 0.25, 0.5, 1}; s(t) linear over 365 days, and a step at the
     midpoint (§5.2 names both: ageing, and a new job). Rejected a per-rate δ:
     a person who drifts, drifts, and the cells would triple.
   - Volume: a light logger at 2 ☕ + 3 🪫 a week and a heavy one at four times
     that, drawn per day.
   - Halves split at the date midpoint, each through `calibrateEnergyParams`
     on its own, so α conditions on its own half's r and the split never
     crosses §5.2's third reason.
   - Readings per cell (shape × δ × volume), over 40 seeds:
     1. the split reading z = |θ̂_late − θ̂_early| / √(s²_early + s²_late) per
        rate, from `rateStd`/`alphaStd`. The δ = 0 cells' max over seeds is
        the noise ceiling; every δ > 0 cell prints its median z and the share
        of its seeds above that ceiling.
     2. error against the truth at day 365: median |θ̂_whole − θ(end)| and
        |θ̂_late − θ(end)| per rate, and their ratio — under 1 is where
        halving the history pays.
     3. §5.2's third reason priced: α_cog on the late half conditioned on the
        WHOLE history's r, against on the late half's own r; median error
        against α_cog(end).
   - Self-check, the only assertions: at δ = 0 and the heavy volume the
     whole-history fit recovers each of the three rates within 10% of the
     truth. If it does not, the generator and the fit disagree and every cell
     is noise — stop and report rather than widening the tolerance.
   - The header quotes every figure from the run and ends with the rule for a
     user's own logs: revisit the deferral when their split reading clears the
     ceiling at their volume AND the drift it implies is past the crossover.
   - Rejected lifting fit-snapshot-drift's generator: it drifts α_cog alone,
     hard-codes the rest law, and its header is a dated record whose figures
     would move.
   - Rejected a ROADMAP item: the reading's home is §5.2 and this header,
     where the deferral it prices lives.
   Roadmap: none */
