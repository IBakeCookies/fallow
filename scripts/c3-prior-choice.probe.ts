/* MATH.md §1 keeps `c₃ = 0.5` — an unmeasured prior, where the article runs 0 —
   on the grounds that a fitted c₃ from real ⚡ logs, not an argument, should
   choose between the two. But the fit's prior mean IS the number in question:
   `fitUserConstants`'s `fallback` is the ridge's c₀ as well as the zero-log
   fallback, so the statistic nominated as the decider is pulled toward whichever
   value is installed. Three numbers move: how much of a fitted ĉ₃ is the
   logger's own data at each log count, what the wrong prior costs out of sample
   and in the T* the user is shown, and whether one logger can tell from their
   own logs which of the two their history prefers.

   Tests: scripts/c3-prior-choice.probe.ts (this file — a probe, not a test; the
     self-check is its only assertion). Run:
     npm run probe -- scripts/c3-prior-choice.probe.ts
   Pins: none — nothing shipped moves
   Out of scope:
   - Any change under src/, and the flip itself. The 43 tests pinned at 0.5 are
     the switching cost, counted 2026-09-11 and not this probe's business: a
     price is paid after the reading says which prior, not before.
   - c₁ and c₂. They are the article's own coefficients and are not in question;
     here they are drawn from the model's prior so the intercept is read under a
     realistic plane, never swept as a decision.
   - λ = 4 (`RIDGE_PRIOR_STRENGTH`) and the §5.2 half-life. The prior's STRENGTH
     and its decay are separate settled choices; this reads the prior's MEAN at
     the shipped strength, and says so.
   - Per-task ϕ offsets, refused in src/lib/business/model/AGENTS.md's settled
     decisions. One shared intercept is exactly what that decision kept.
   - α, r and λ₀. The energy fits have their own prior means and their own
     instrument (scripts/energy-fit-recency.probe.ts); this is the ϕ plane's
     intercept only.
   - Real logs: probes read no user data (phi-prequential-skill.probe.ts).
   Read before building:
   - MATH.md §1 — the plane `ϕ = c₁E + c₂β + c₃`, the defaults, the 0.1 h floor,
     and the paragraph that keeps 0.5. That paragraph is where the reading lands,
     and R7 means it lands as prose routing to this header: the run figure it
     currently quotes for the fresh user's T* has its home here instead. Then
     `node scripts/math-index.mjs`.
   - MATH.md §5 — the posterior this reads through: c₀ = defaults, λ = 4,
     σ₀ = 0.25 h, ν₀ = 4, and `fitted`'s meaning. §5.2 for the recency weights
     the walk ages logs under (Σw is the data mass, not n).
   - src/lib/business/model/zenith.ts — `fitUserConstants(observations,
     fallback)`: `fallback` is the ridge's c₀ AND the zero-observation fallback,
     so passing `{...DEFAULT_USER_CONSTANTS, c3: 0}` is exactly the flip under
     test, with no patched module and no mock. Also `calculateFlowStateTime`
     (the floor), `findOptimalSingleTaskTime` (T* on the v2 curve),
     `calculateTaskAllocations` and `calculateTotalProductivity` (the plan arm),
     `mapEffort`/`mapEnjoyability`, `DEFAULT_USER_CONSTANTS`.
   - scripts/phi-prequential-skill.probe.ts — the causal walk (each fit reads
     only logs dated strictly BEFORE the held-out log's date, aged against it),
     the n binning, the seeded generator, the self-check convention. Read it as
     the model for this one; do NOT edit it, and do not import from it.
   - scripts/circadian-residual.probe.ts — the per-logger convention: a reading
     computed over an ensemble of users is not one a single logger can act on,
     so the share they could compute themselves is printed beside it.
   - docs/testing.md, Writing a probe — seeds, reachability, quote the number in
     the probe and not in prose. The PROBES.md row is already written.
   Decisions:
   - A new probe file, not a second arm inside phi-prequential-skill.probe.ts as
     the 2026-09-15 proposal said. That file's header is a dated 2026-08-30
     reading of five claims; a new arm re-runs and re-prices all of them, which
     is the one-instrument-per-commit rule read backwards. Its walk is copied in
     here instead — probes are self-contained.
   - The prior is switched through the shipped surface: the same fit, called
     twice per held-out log, once with each `fallback`. Rejected: a patched copy
     of zenith.ts (the recency probe's own lesson — patch nothing the app
     exports) and any module mock.
   - The truth per arm sets c₃ and draws c₁, c₂ from the model's own prior
     (σ₀/√λ = 0.125 per coefficient, the prequential probe's draw). True
     c₃ ∈ {0, 0.25, 0.5, 1.0}: both candidates, the midpoint between them, and
     one point past 0.5 so the 0-prior is read where it is the wrong one. The
     grid is a choice, not a finding, and the header says so.
   - The decision statistic is out-of-sample prediction, never the fitted
     coefficient. Reading 1 measures the coefficient precisely to show it cannot
     decide: it is a ridge blend of the logger's data and the installed prior,
     and the share the prior still holds at each n is what the run prints.
   - Both directions, always. Every cell is read for a 0.5 prior and for a
     0-prior on the same logs, because the truth is unknown and the choice is
     therefore the one that is never much worse, not the one that wins somewhere.
   - Reading 3 reads T* through the shipped `findOptimalSingleTaskTime` over all
     100 slider cells, on the v2 curve. Rejected: 1.7933·Δϕ, which is v1's
     multiplier and no longer what the app solves. §1's claim that the price is
     "hardest on easy tasks in relative terms" is a claim about a quantity, so
     the run prints it per cell and not as a sentence.
   - Reading 4 prices the choice where the user lives: a day solved under the
     constants the wrong prior fits, scored under the user's TRUE constants,
     against the same day solved under the truth. scripts/phi-error-price.probe.ts
     prices a per-task ϕ ERROR, which a global intercept shift is not — every
     task moves together — so the plan price is measured here, not read off it.
   - Every reading prints the per-logger share beside the ensemble mean: at each
     n, the share of users whose own out-of-sample comparison picks the prior
     matching their truth. That share, not the ensemble gap, is what a logger
     asking "have my logs decided this yet?" would be able to compute.
   - Sliders are integers 1–10 through `mapEffort`/`mapEnjoyability`, so every
     (E, β) is one the app can produce.
   - 500 users × 80 logs per arm (the prequential probe's scope), mulberry32,
     seeded per arm. The plan arm is the expensive one: 60 users at three log
     counts, one 5-task day each. If the whole run passes ~90 s, halve the users
     and print the count the header quotes.
   - Self-check, printed first and the only assertions: with the prior matched to
     the truth, the walk recovers σ₀ = 0.25 h as its settled residual scale and
     ĉ₃ recovers the arm's true c₃, both within a stated tolerance. If either
     misses, the generator and the fit disagree and no cell below means anything.
   Roadmap: none — proposed 2026-09-15 as one of three instruments; the reading's
     home is MATH.md §1 and this header, the same call the recency and circadian
     probes made. */
