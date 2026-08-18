# Probe registry

**Probes are committed, and they are not tests.** A test asks _does this still
hold_ — binary, fast, green or red. A probe asks _what is true of the model over
a large input space_ and answers with a number, which legitimately moves
whenever the allocator changes. In the suite that is a red build carrying no
regression, so probes live in `scripts/*.probe.ts` behind their own config
(`vitest.probe.config.ts`, `npm run probe`) and never run in `npm test`. The
policy that governs writing one is in [docs/testing.md](../docs/testing.md).

**Which probe backs what.** Each file's header names its claim; each claim in
`MATH.md` carries a dated back-reference to its probe. A `MATH.md` number with
neither a probe nor a suite-fixture citation beside it is unbacked — that is the
list to work down; a closed form has nothing to sweep, so it cites a fixture and
gets no row here (§8.2, §11.5). Adding
a probe means adding its row: `node scripts/probe-registry.mjs --check` fails
`npm run lint` when a committed probe has no row or a row has no file, which is
how `adv3-advice-display-resolution` sat unlisted until 2026-08-10.

<!-- probe-registry:start -->

| Probe (`scripts/`)                        | Backs                                                                                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan-advice.probe.ts`                    | §14, §14.1-2 — priced-lever signs, the pure budget trim, and the advisor's wall clock: the per-solve ladder, the whole run, §34's fallback past n = 12, §14.3's two extra solves |
| `pool-allocator.probe.ts`                 | §13.3, §4 — pooled suboptimality: there is no envelope to quote                                                                                                                  |
| `energy-search-gap.probe.ts`              | §8.6 — the search's residual gap against the enumerated optimum, out to the enumerable frontier, and the uphill audit of the candidates it never generates                       |
| `stop-advisor.probe.ts`                   | §8.11 — session lookahead vs. the one-step marginal, and what the open-task candidate filter moves in the verdict, the named task and the at-stop reading                        |
| `burnout-risk.probe.ts`                   | §11.6 — the 87% ceiling, the plateau, the resolution ladder                                                                                                                      |
| `phi-uncertainty-cap.probe.ts`            | §5.1 — the σ ≤ 0.5·ϕ̂ cap and monotone-prefix truncation                                                                                                                          |
| `phi-cap-reachability.probe.ts`           | §5.1 — whether a real fit can reach the region that cap misses                                                                                                                   |
| `allocator-exactness.probe.ts`            | §4 — the n ≤ 12 exactness claim; §5.1 guard 2 at plan level                                                                                                                      |
| `subset-search-bound.probe.ts`            | §34, §7 — what the funded-subset search forfeits past n = 12, by budget band, the monotonicity violations and bounded share, the wall clock, and where the bounded path ends     |
| `hedged-stop-band.probe.ts`               | §3, §10 — where the hedged stop time lands against the closed form's band, how far σ̂ falls, and `expectedOptimalTime` vs a grid argmax                                           |
| `satiety-gaming.probe.ts`                 | §8.4 — the monotone accumulator, and what a laundering one costs                                                                                                                 |
| `stop-inversion-margin.probe.ts`          | §8.10 — inversion rates, the `STOP_INVERSION_MARGIN` split, and the open-task scope: the witness pair, how far the filter moves a day, what the fifth category discards          |
| `stop-margin-fit-error.probe.ts`          | §8.10 — λ₀ fit error vs the inversion margin, why censoring cannot price the contamination, and the corrected open-task scope against the pre-2026-08-12 one                     |
| `fit-snapshot-drift.probe.ts`             | §12.1 — as-of-day vs whole-history fit drift, and refit cost                                                                                                                     |
| `phi-error-price.probe.ts`                | §17 — the per-task-ϕ error pricing table                                                                                                                                         |
| `curve-marginal-facts.probe.ts`           | §1, §2 — the r-cap boundary, the five curve properties, the three N facts                                                                                                        |
| `alloc-epsilon-methodology.probe.ts`      | §4 — block-rule vs hour-rule admissibility, the 49% artefact                                                                                                                     |
| `post-recency-weighting.probe.ts`         | §5.2 — the recency weights, Σw vs n_eff, the ten-year logger                                                                                                                     |
| `causal-fit-window.probe.ts`              | §33 — how far one ⚡ moves an unlogged task, and what a one-day deferral costs                                                                                                   |
| `post-monotone-prefix-cost.probe.ts`      | §5.1 guard 2 — violation size, blocks dropped, which cut lost the value                                                                                                          |
| `post-quadrature-floor.probe.ts`          | §5.1 — GH moment exactness and the ϕ-floor mean shift                                                                                                                            |
| `enb-simpson-error.probe.ts`              | §8.1 / model AGENTS.md — Simpson error under the 1024-node cap                                                                                                                   |
| `enb-break-economics.probe.ts`            | §8 intro, §8.3–8.4, §13.5 — break economics pre/post fix, fragmentation cost, chunk sweep                                                                                        |
| `sat-gate-floor.probe.ts`                 | §8.5 — the w = 1 floor identity and 8 h endpoint, the rejected (1−w^q) gate, the demand sweep                                                                                    |
| `sat-drain-identifiability.probe.ts`      | §8.7 — what ratings identify (r vs α), λ tuning, saturation                                                                                                                      |
| `stp-lattice.probe.ts`                    | §8.8 — the 45-min lattice's quantization loss and enumerated optimum                                                                                                             |
| `stp-recovery-fit.probe.ts`               | §8.9 — the recovery fit's λ profile, range and identifiability limits; §8.7's ν₀ ≠ λ effect on the reported ±                                                                    |
| `stp-stopping-identifiability.probe.ts`   | §8.10 — V_T identifiability and the reconstruction's bracket                                                                                                                     |
| `budget-advisor.probe.ts`                 | §8.12 — why maximizing `valueVsClassic` or `objective` over the budget is ill-posed                                                                                              |
| `budget-knee.probe.ts`                    | §8.12 — the three candidate scorings, the knee across λ₀, and the running max's dip rate                                                                                         |
| `curve-shape.probe.ts`                    | §8.12 — the raw difference's spike train, and the majorant's non-increasing / last-positive / telescoping properties                                                             |
| `advisor-curve-agreement.probe.ts`        | §8.12 — the stop advisor (§8.11) and the curve priced on one day, and where they agree                                                                                           |
| `mtr2-carry-over.probe.ts`                | §11.6 demand arm, §11.9 carry-over levels and the one-mechanism order/break bound, §12's Σ P̄ spread premise                                                                      |
| `rv13-prior-posterior.probe.ts`           | §13.1 — the σ_ϕ ladder and what the n = 0 posterior moves                                                                                                                        |
| `rv13-naive-lattice.probe.ts`             | §13.2 — the naive baseline's lattice handicap, before and after                                                                                                                  |
| `session-row-truncation.probe.ts`         | §18 — the three marginals of the session-row inversion through the shipped advisor, what truncation was worth at every split, and whether the verdict flip is app-reachable      |
| `rv14-naive-switch-bill.probe.ts`         | §19 — the naive baseline's switch bill and order dependence, before and after; the ≥ 0 arms and the pool-starved regressions; §19.3's rotation gap and its wall clock            |
| `naive-menu-cut-corner.probe.ts`          | §19.3, §5.1 — the −0.5% σ_ϕ witness, how often the monotonicity cut fires by slider regime and what it costs, and whether a fit reaches the corner                               |
| `rv15-gain-headroom.probe.ts`             | §21 — why an honest gain still reads ~3%: selection vs shape, the activation-bonus ceiling, what binds on a real day, the shipped rotation baseline against one equal split      |
| `rv13-stop-insertion.probe.ts`            | §13.4 — insertion convention: size and sign of the error                                                                                                                         |
| `rv13-terminal-timing.probe.ts`           | §13.6 — mean-vs-min re-scoring, the timing difference, and the Lab tile before and after the `workEndCog` fix: the forced worked-hours ladder and what the shipped optimum reads |
| `adv1-plan-advice-frontier.probe.ts`      | §14, §14.1 — the Σ P̄ identity, budget monotonicity, rounding, frontier widths, the budget-0 grind day                                                                            |
| `adv2-budget-marginal.probe.ts`           | §14.2 — the budget marginal, zero-marginal days, per-task spread                                                                                                                 |
| `adv2-switch-cost-price.probe.ts`         | §14.3 — the fixture table, the inversion grid, m(s) and the bracket, and the suppressed bracket read off the shipped `switchCostPrice`                                           |
| `mode-cross-scoring.probe.ts`             | §15 — both plans scored under both objectives                                                                                                                                    |
| `mode-run-order.probe.ts`                 | §16 — the order-only gain and the burnout noise it would buy                                                                                                                     |
| `mtr-human-capacity.probe.ts`             | §20 — the reading-is-the-constraint identity, what the band's >100 and Infinity arms can reach, the pool the row names                                                           |
| `mtr-load-rounding.probe.ts`              | §25 — the Load clamp's slack, what rounding the two loads cost Energy Balance's classification and the advisor's ordering                                                        |
| `mtr-grind-density.probe.ts`              | §11.10 — the 100/m quantization against the band ladder, what unfunded tasks voted, §11.4's boundary as a hard count; §11.11 question 6 — count vs hour-weighted share           |
| `mtr-day-profile.probe.ts`                | §29 — the saturated difficulty axis under the old cut, what hour-weighting moved, the flip gate, history vs the dashboard                                                        |
| `mtr-metric-trend.probe.ts`               | §31 — which readings survive the switch-cost-free solve, the exact solve's cost by n, why the gain cannot be plotted                                                             |
| `rv16-output-vs-classic.probe.ts`         | §30 — the Lab comparison tile under raw output vs the objective, and the rival plan's exact fit to the window                                                                    |
| `mtr-friction-index.probe.ts`             | §11.4 — the Friction Index's interior, which its two pinned endpoints say nothing about                                                                                          |
| `mtr-task-nature.probe.ts`                | §22 — the four pairs the zero gate moves, the balanced rate before and after it, and how far the rejected demand-share rule lands from both                                      |
| `mtr-bottleneck-strain.probe.ts`          | §23 — why Primary Bottleneck stopped reading E/β, and what the binding-pool draw reads instead                                                                                   |
| `mtr-deep-work.probe.ts`                  | §26 — the hard `mentalDifficulty >= 7` cut, and the band that called a three-quarters-deep day optimal                                                                           |
| `mtr-sustainable-work.probe.ts`           | §27 — the budget denominator against Σh, the grind-free day, and whether the fixed row restates Grind Density                                                                    |
| `prefix-replan.probe.ts`                  | §35 — the mid-day re-plan vs a cold re-solve and the morning plan, the on-plan control, the switch convention, the second solve's wall clock                                     |
| `adv3-advice-display-resolution.probe.ts` | §25 — how much of an advice option's improvement the card's rounding cannot show, and what suppressing a word-identical option would cost                                        |
| `gain-cap-trigger.probe.ts`               | §19.4 — the 999% ladder at ϕ̂ on the ϕ floor and its σ arm, the default-constants maxima, whether a fit reaches the floor, and the `naive = 0` arm's reachability                 |

<!-- probe-registry:end -->
