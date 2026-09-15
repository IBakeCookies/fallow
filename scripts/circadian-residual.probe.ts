/* Whether an hour-of-day term in the drain rates (§8.7) could be read off 🪫
   logs at all, or whether §8.7's own fresh-start approximation manufactures the
   structure such a term would claim. Two numbers move: the apparent hour-of-day
   modulation a year of logs shows when the truth has NONE — the ceiling — and
   the smallest true modulation that clears it, read on the residuals as the app
   stores them and again under each correction the stored rows themselves allow.

   Tests: scripts/circadian-residual.probe.ts (this file — a probe, not a test;
     the self-check is its only assertion). Run:
     npm run probe -- scripts/circadian-residual.probe.ts
   Pins: none — nothing shipped moves
   Out of scope:
   - Any change under src/, any new stored field, any Lab or card surface:
     nothing ships until the reading says the term can be read.
   - r (§8.9) and λ₀ (§8.10): one fit at a time, and α is the one whose rows
     carry the log moment `DrainObservationRecord.createdAt` was kept for.
   - Overnight carry-over (`seedMorningReservoirs`): every synthetic day starts
     at full reservoirs, so the artifact measured is the one that accumulates
     WITHIN a day. Carry-over adds a second confound of the same sign, which
     would flatter the ceiling rather than test it.
   - The per-title ranking (§8.14): it already handles this confound with a
     filter. Reading 3 prices that filter; it does not change it.
   - Real logs: probes read no user data (phi-prequential-skill.probe.ts).
   Read before building:
   - MATH.md §8.7 — the drain law, the fit, and the fresh-start bullet under
     Known approximations ("a mid-day session that starts drained rates higher
     than the model predicts and biases α upward"). That bullet IS the artifact
     this probe measures. The new paragraph lands at the end of §8.7, after the
     Known approximations list and before "**UI.**" — derivation only, no figure
     from the run (R7), then `node scripts/math-index.mjs`.
   - MATH.md §8.14 — the same confound, already priced by a filter (only each
     day's earliest 🪫 row is eligible, and it says outright that a row's
     calendar day differing from `date` "is how a time-of-day reading would
     exclude it"). Reading 3(a) prices what that filter costs THIS reading.
   - MATH.md §8.5 — the micro-recovery gate g = 1 − (1−b)·w the law carries.
   - src/lib/business/model/zenith-energy.ts — `simulateReservoirs` (the
     generator), `fitDrainRate`, `DEFAULT_ENERGY_PARAMS`,
     `DRAIN_NOISE_PRIOR_STD`. `reservoirLaw`/`reservoirAt` are private, and the
     probe never re-writes the law: it calls the simulator.
   - src/lib/business/model/energy-calibration.ts — `toCognitiveDrainObservations`
     and `toPhysicalDrainObservations` (the 0–10 → fraction mapping the fit
     reads), and `rankDrainByTask`'s day-first filter, which reading 3(a)
     re-reads on a different axis.
   - src/lib/data/type/index.ts — `DrainObservationRecord`, whose `createdAt`
     comment already calls it "the time-of-day instrument a future circadian
     drain fit would need".
   - scripts/energy-fit-recency.probe.ts — the ceiling-over-seeds construction,
     the self-check convention, and a header that quotes every figure from its
     own run and derives none.
   - docs/testing.md, Writing a probe — seeds, and quote in the probe not in
     prose. The PROBES.md row is already written.
   Decisions:
   - The artifact is measured FIRST and it is the ceiling. §8.7's fresh-start
     bullet predicts a residual that grows with the work already done that day,
     and a day's work accumulates with the clock — so the approximation alone
     produces hour-of-day structure, with the afternoon sign a circadian term
     would want. Rejected: reading residual structure against zero and calling
     it significant, which confirms a new parameter off a known approximation.
   - Generator = the shipped `simulateReservoirs`, one block at a time with each
     block's end levels carried into the next block's `initialCog`/`initialPhys`,
     and α for that block taken from the circadian law at the block's midpoint
     clock hour. Rejected: writing the §8.7 closed form in the probe as
     energy-fit-recency.probe.ts does — the whole subject here is a chained day,
     and the shipped simulator is what chains it.
   - Truth: α(h) = α₀·(1 + a·cos(2π(h − 16)/24)), the same amplitude and phase
     on both reservoirs, a ∈ {0, 0.1, 0.2, 0.35, 0.5} as a share of the default
     rate. A 16:00 peak in drain rate is the afternoon dip; it is a choice, not
     a finding, so the run prints the recovered phase and the artifact's own
     peak beside it. Rejected: a per-reservoir phase — two more axes, and the
     question is visibility, not shape.
   - Two routines: a fixed 09:00 start, and a start drawn 06:00–12:00. Under a
     fixed routine, clock hour and position-in-day are the SAME variable and no
     estimator can separate them; the jitter is the only identification the data
     could ever have. Both print, because a real user is closer to the first.
   - One generous volume — 260 logged days, 2–4 sessions each, ≈ 780 rows — not
     a light/heavy sweep: this reading is a feasibility ceiling, and a signal
     invisible at a volume no user reaches is invisible everywhere. The header
     says it is a best case.
   - Rows are ones the app could hold: session hours on the 45-min lattice
     0.75–3 h, gaps 0.25–2 h in quarter hours, demands on the ten slider notches
     0.1–1.0, ratings carrying §8.7's own `DRAIN_NOISE_PRIOR_STD` = 0.15
     self-report noise and then quantized to the 0–10 notches stored, and
     `createdAt` stamped at the session's END, which is what the app records.
     Rejected: a noiseless generator (its ceiling would be the quantizer's, not
     a rating's) and any invented per-user noise (0.15 is the model's own prior).
   - The estimator, used identically in every reading: least squares of the row
     residual on [1, cos(2πh/24), sin(2πh/24)] at h = the row's `createdAt`
     hour, reported as amplitude √(b_c² + b_s²) and the peak hour the two
     coefficients put it at. The intercept is what makes reading 3 honest — a
     constant bias in α̂ lands there and never in the amplitude.
   - Reading 3 prices the two corrections the stored rows already allow, and
     changes neither: (a) §8.14's earliest-row-per-day filter, whose every row
     satisfies the assumption the fit makes about it but which sits at one end
     of the clock — the run prints how many distinct hours it can still see;
     (b) chaining each row onto the previous row's OWN rating (1 − d_prev/10)
     recovered over the idle hours between the two `createdAt`s, the only
     chained start level a 🪫 row can supply. Both read residuals at the app's
     own whole-log α̂. Rejected: a chained refit — a second estimator in the
     probe, and the intercept already absorbs the α̂ bias it would move.
   - A control at a = 0: correction (b) with 30% of each day's worked sessions
     never logged — the truth still drains through them and no row exists. A
     correction that holds only for a perfect logger is not one.
   - Self-check, printed first and the only assertions: at a = 0, one session
     per day from a full reservoir and no rating noise, the fit recovers α_cog
     0.35 and α_phys 0.3 within 10% and the recovered amplitude sits under the
     ceiling. If they miss, the generator and the fit disagree and every cell
     below is noise.
   - 40 seeds per cell (mulberry32, the repo's probe convention). If the whole
     run passes ~90 s, halve the seeds and print the count the header quotes.
   Roadmap: none — proposed 2026-09-15 as an instrument, and the reading's home
     is MATH.md §8.7 plus this header, the same call the recency probe made. */
