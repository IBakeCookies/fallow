# The extreme that had never declared itself

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** finding M48

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found

**M48 — `enb-simpson-error.probe.ts`'s `FAST_TASK` is unreachable, on purpose,
and said so nowhere.** It declares `difficulty: 1` beside demands `0.9/0.1`;
those demands come from sliders 9/1, which `getEffectiveDifficulty` projects to
`9 + 0.3·1 = 9.3`. Verified in the code. M40 had just finished fixing five probe
generators that DREW unreachable days one at a time, and this is the residue it
left: witnesses that are off the surface deliberately, in a repo that had never
written down when that is allowed.

M48 offered two closes — declare the extreme, or replace it with an on-surface
ϕ-floor witness "if one exists, which needs low difficulty AND low demands
together, an open question rather than a known substitution". **It exists**, and
that turned the choice into neither-or-both.

## The open question, answered by sweep

All 1,210 slider combinations — mental 0–10 × physical 0–10 × enjoyment 1–10 —
projected through `toEnergyTask` and run at `FLOOR_CONSTANTS`, worst relative
quadrature error over block lengths 8/12/16/24 h (2026-08-27):

- **the ϕ floor is reachable.** Minimum ϕ over the surface is **0.1000 h**, the
  floor itself, at mental 0 / physical 0 — which `getEffectiveDifficulty` clamps
  to difficulty 1 for the reason its own docblock gives, and which the task form
  admits directly (both difficulty sliders carry `min: 0`).
- **the worst reachable error is 5.001e-5**, at mental 2 / physical 0 /
  enjoyment 10 → difficulty 2, demands 0.2/0, at a 24 h block. Not at the
  lowest-ϕ task: demands `0/0` leave the reservoir still, and a still reservoir
  integrates more smoothly.
- **`FAST_TASK` bounds it**: 5.561e-5 against 5.001e-5.

## What changed

The probe now runs **both** witnesses over the same block sweep, so the
conservatism is measured rather than argued. It holds pointwise, not just at the
worst:

| block | `FAST_TASK` (off-surface) | worst reachable |
| ----- | ------------------------- | --------------- |
| 1 h   | 2.844e-7                  | 2.556e-7        |
| 8 h   | 6.936e-7                  | 6.235e-7        |
| 12 h  | 3.506e-6                  | 3.152e-6        |
| 16 h  | 1.106e-5                  | 9.939e-6        |
| 24 h  | 5.561e-5                  | 5.001e-5        |

`FAST_TASK` is kept rather than replaced. It is the model-level extreme — the
lowest difficulty the `[1,10]` domain admits against the demands that move the
reservoir fastest — and a bound measured on it bounds the shipped app, which is
now a row in the output instead of a claim. Its docblock declares the pairing,
in the shape M44 established for `energy-search-gap.probe.ts`. The suite fixture
that pins the same worst case says it too, in three lines.

## The rule, which was the more valuable half

`docs/testing.md`, "Writing a probe". `EnergyTaskInput.difficulty` and its two
demands are independent knobs of the MODEL's input type, and `toEnergyTask`
couples them; 64 of `zenith-energy.test.ts`'s 70 `makeTask` calls are off the
surface, and that is a convention, not 64 defects. So the rule is not "every
task must be reachable". It is:

> a day whose numbers get QUOTED, or that witnesses APP-level behaviour, has to
> be one `toEnergyTask` could produce; a model-level property or bound test may
> sit off the surface and often should, and then it says so in a sentence.

Nothing stated this, which is why M40's five generators were each found by the
fix before them.

## What was deliberately not done

- **No MATH.md change.** M48 says the five §8.1 figures are "read off"
  `FAST_TASK` and that finding an on-surface witness would move them. The
  2026-08-25 cut deleted them from §8.1 with every other measurement — the
  section now states only that the cap thins the node density past 6.4 h at the
  0.1 h floor, and that the default constants never reach it. Nothing there
  quotes a number that this sweep moves.
- **The suite fixture kept its task and its 8 h block.** It pins a bound; it now
  declares itself, which is exactly what the new rule asks of it. Its stale
  `probe 2026-07-23: rel. error 6.9e-7` parenthesis went instead of being
  re-dated — the probe prints 6.936e-7 on demand, and re-dating figures in prose
  is the practice the 2026-08-25 cut removed.
- **No `FLOOR_CONSTANTS` audit.** Whether `c1 = 0.1, c2 = −0.05, c3 = 0.05` is a
  posterior a real fit could return is a separate axis from the task surface,
  and the probe's DESIGN paragraph already declares the ϕ floor as its choice.

## Where it landed

- [`scripts/enb-simpson-error.probe.ts`](../../scripts/enb-simpson-error.probe.ts)
  — the declaration, `REACHABLE_WORST`, and the two-witness sweep.
- [`docs/testing.md`](../testing.md) — the reachability rule.
- [`src/lib/business/model/zenith-energy.test.ts`](../../src/lib/business/model/zenith-energy.test.ts)
  — the fixture's declaration.
- [ROADMAP.md](../../ROADMAP.md) — M48 closed.
