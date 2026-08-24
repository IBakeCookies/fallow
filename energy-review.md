# Review: EnergyLab time-allocation math

Reviewed 2026-08-22. Scope: `src/lib/business/model/zenith-energy.ts` as consumed by
`src/lib/business/store/energy-lab-store.svelte.ts` — reservoir dynamics, block output
quadrature, objective/satiety, the multi-seed optimizer, the budget curve, and the stop
advisor/fit that price the margins. Checked against MATH.md §8.2, §8.4, §8.5, §8.6,
§8.8, §8.10–§8.12. Review only; no code changed.

## Findings

### 1. Parameter domain hole → silent NaN plans (substantive)

`sanitizeEnergyParams`
(`src/lib/business/store/energy-lab-store.svelte.ts:52`) enforces _finiteness only_,
but the math is only well-posed on sub-domains the sliders enforce. Persisted params are
explicitly user-reachable JSON ("edited by hand, or restored from an older backup", same
file :47-51). Concretely: a negative `recoveryRate` (or `restRecoveryMultiplier`) with
`microRecoveryFraction > 0` makes `rec·gate < 0`; when `α·w > |rec·gate|` you get
`rho > 0, eq < 0` in `reservoirLaw`
(`src/lib/business/model/zenith-energy.ts:320-337`), so `reservoirAt` drives the level
**negative** on a long enough block, and `Math.pow(negativeLevel, wc)` in `blockOutput`
(:450-452) is **NaN** for fractional exponents.

NaN propagates to the objective; every strict-improvement comparison in the search is
then false, and `optimizeSchedule` quietly returns the do-nothing plan.

Side effect: the comment at :331-332 ("ρ = 0 only when both terms vanish") is false off
the valid domain.

Fix is one line of domain clamping at sanitize — rates ≥ 0,
`microRecoveryFraction ∈ [0,1]`, λ₀ and V_T ≥ 0 — the same pattern the fit bounds
(`ALPHA_FIT_MIN`/`MAX`, etc.) already use. Initial levels and demands are already
clamped; rates are the gap.

### 2. Stale `p₀` labeling (doc-only, but a trap)

The header (`zenith-energy.ts:19`) writes `p(s) = (a+p₀)·k·s·e^(−ks)` and
`TaskCurve.amp` is commented `// a + p₀` (:220), but this model structurally has
**p₀ = 0**: `amp = E·β + β/E` is the classic `a` alone (:261), so `p(0) = 0`, peak
`a/e` at `s = ϕ` (:448, :827-832). The label is inherited from `zenith.ts`'s
`(a·kt + p₀)` family.

Someone "completing" it would reintroduce the activation jump whose absence is
load-bearing here — §8.4's winner-take-all analysis and the 1.7933ϕ `refOutput` both
assume the pure hump. Should read `p(s) = a·k·s·e^(−ks)`.

## Verified sound (spot-checked, not taken on trust)

- **Reservoir closed form**: `C_eq = r′g/ρ`, floor `b·r′/(α+b·r′)` at w=1, w=0 →
  recover-to-full, ρ=0 → hold level. Algebra checks; default-param floors
  (0.13 cog / 0.15 phys) recompute correctly.
- **Quadrature**: composite Simpson weights, even-n forcing, timescale-adaptive node
  density, 1024 cap — correct, and the cap is unreachable at 45-minute blocks under
  default constants.
- **Satiety**: V properties (V(0)=0, V′(0)=1, V′(κ)=½) check; the cumulative-output
  accumulator sits outside the dynamics, so gap-laundering is structurally impossible,
  matching §8.4's probe.
- **Lattice invariant**: walked every neighbor family — grow/shrink/transfer (multiples
  of step), odd-step half-reassign (`Math.round` half-up gives larger-first, both parts
  ≥ 1 step), T\*-insert (snapped, min'd with floored avail), rest-split (room-gated).
  Invariant holds; `normalizeSchedule`'s clip therefore never fires mid-search, as
  §8.8 claims.
- **Termination/determinism**: strict improvement (1e-9) on a finite lattice plus the
  300-iteration cap; stable sorts and insertion-ordered Maps keep seeds reproducible.
- **Budget curve**: the common-horizon trick does net λ₀ exactly (the free-time term
  telescopes to a constant − λ₀·work, so break-even 0 is right and the "don't draw a
  λ₀ line" warning is mathematically justified); `concaveMajorantSlopes` is a true
  upper hull, non-increasing on the running-max input, telescopes exactly, and degrades
  to all-zero slopes on the never-beats-do-nothing day, which is what the card's
  two-nulls branch reads. Knee/`recommendedHours` semantics match §8.12 including the
  top-of-range null.
- **Stop bracket/advisor**: extraction is genuinely λ₀-free; `hi`/`lo` marginals are
  net of displaced trailing recovery, consistent with the objective's own accounting;
  the worked-vs-span split (M42) is implemented where specified; the closed-form ridge
  posterior (identity prediction, sensitivity = n) is exact.
- **refOutput yardstick**: 1.7933ϕ is the r→0 optimum, which is the correct limit for
  this p₀=0 curve family — not a misapplied classic constant.
- **Store wiring**: plan/classic-eval/fingerprint/staleness all read coherently; the
  curve sweep reads tasks, the params snapshot and the fingerprint in one post-yield
  tick, so it cannot mix versions.

## Minor notes (no action implied)

- `roundRobinOver`'s 24-block cap (`zenith-energy.ts:890`) only binds under non-default
  `stepHours` (probe territory); at 0.75 h it covers the full 12 h sweep.
- Mid-window rest earns λ₀ **and** recovery in the objective — intentional (it is the
  stopping incentive §8.8/§8.12 rely on), and the classic-vs-energy comparison charges
  it symmetrically, but worth remembering it is a double payment by design.
- `plannedHours`/`trailingFreeHours` count booked rest as planned, while the model's
  `leisureHours` counts it as leisure — two different labels, both internally
  consistent; not a conflict.

## Bottom line

The allocation math itself — dynamics, objective, search, hull, brackets — is correct
and unusually well pinned to spec. The one thing worth actually fixing is the
parameter-domain clamp (finding 1); finding 2 is a two-line comment correction under
the same R7 hygiene rule.

## Appendix — selected excerpt, `src/lib/presentation/AGENTS.md:418-436`

> ### One screen lists logs: `/analytics`
>
> It prints every ⚡, 🪫 and ☕ — the range it is viewed under, or all of them
> (`log-history.ts` folds the three stores, `log-history-list.svelte` prints
> them). The range can be dropped because this list is the only surface some
> measurements have: nothing older than the widest range (a year) is reachable
> from anywhere else, so a bound that always held would put an old typo
> permanently beyond both correcting and dropping while it still fed a fit.
>
> Three cards each listing their own kind was three partial answers to "what have
> I logged" — none could show a neighbouring kind or a day outside its own fit —
> so what stays with each card is the two verbs a FIT has rather than a
> measurement: read what it was fitted from, and un-personalize it
> (`fit-log-summary.svelte`, which is `log-list.svelte` narrowed to those two,
> keeping its two-step reset and that reset's focus handling).
>
> The history both **drops and corrects**: ✕ and ✎ on every row, each addressed by
> `(kind, id)` and not `id` alone — three kinds are three stores with three id
