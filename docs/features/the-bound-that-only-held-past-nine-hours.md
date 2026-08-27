# The bound that only held past nine hours

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** findings M55, M56,
M57, M58

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found

**M55 — `FAST_TASK` does not bound the reachable app pointwise, and
`enb-simpson-error.probe.ts` said it does.** Its docblock claimed "a bound
measured on it bounds the shipped app too" and that the worst reachable task
"comes in UNDER `FAST_TASK`". The counterexample needs no unreachable input at
all: sliders **mental 10 / physical 10 / enjoyment 1** — `getEffectiveDifficulty`
gives `min(10, 10 + 0.3·10) = 10`, `toEnergyTask` gives demands 1.0/1.0, and
ϕ = 0.500 h — beats `FAST_TASK` at every integer block length from 1 h to 8 h,
the 8 h block the suite fixture itself pins included:

| block | worst reachable | `FAST_TASK` | ratio |
| ----- | --------------- | ----------- | ----- |
| 1 h   | 1.0450e-6       | 2.8438e-7   | 3.67× |
| 2 h   | 8.0452e-7       | 2.8425e-7   | 2.83× |
| 4 h   | 7.7364e-7       | 2.8425e-7   | 2.72× |
| 7 h   | 7.7322e-7       | 4.0672e-7   | 1.90× |
| 8 h   | 7.7322e-7       | 6.9364e-7   | 1.11× |
| 9 h   | 9.9837e-7       | 1.1107e-6   | 0.90× |
| 24 h  | 5.0015e-5       | 5.5613e-5   | 0.90× |

`FAST_TASK` leads from 9 h on and nowhere below it. The GLOBAL form of the claim
is true — 5.0015e-5 over all cells and lengths against 5.5613e-5 — and that
global maximum is precisely what hid this: **a maximum over cells × lengths at
once cannot see a length where the surface wins.** A maximum per block length
finds it on the first run.

Nothing shipped is wrong. The suite fixture's `1e-4` literal holds by more than
two orders of magnitude at the 8 h block it pins, and by 2× at the worst reading
in the table.

## The instrument had been thrown away

The 1,210-cell sweep every M48 claim rests on was never committed — the commit
added the `REACHABLE_WORST` literal and a paragraph asserting what the sweep had
found, and the sweep itself existed only in the session that ran it. That is the
failure `docs/testing.md` gives as the whole reason probes are committed, and it
is how the false form got through: an uncommitted instrument cannot be re-run
against the claim it produced.

It is now the probe's second arm.

## Claims

Every figure below is `scripts/enb-simpson-error.probe.ts` → MATH.md §8, read off
the run that landed with it.

### Claim — the worst error the app can reach

- **Given** all 1,210 slider combinations (mental and physical 0–10, enjoyment
  1–10) through `toEnergyTask` at `FLOOR_CONSTANTS`, over 13 block lengths
- **Then** the worst relative quadrature error anywhere on the surface is
  **5.0015e-5**, at sliders mental 2 / physical 0 / enjoyment 10 in a 24 h block

### Claim — where `FAST_TASK` bounds that surface

- **Given** the same sweep, maximised per block length rather than globally
- **Then** the worst reachable task exceeds `FAST_TASK` at 1, 2, 3, 4, 5, 6, 7
  and 8 h, and `FAST_TASK` leads at 9, 10, 12, 16 and 24 h

### Claim — the model box's corner sits above both

- **Given** difficulty 1 at demands 1.0/1.0 — the corner of `EnergyTaskInput`'s
  domain at the ϕ floor, `BOX_CORNER`
- **Then** it reads **6.3864e-5** at 24 h, above `FAST_TASK` at every length
  beside it and above anything the reachable surface reaches

### Claim — the ϕ floor is a region, and the argmax is inside it

- **Given** the surface at `FLOOR_CONSTANTS`
- **Then** **39 of the 1,210 cells** sit on the 0.1 h ϕ floor, the 24 h argmax
  among them
- **Then** the still-reservoir cell beside it (demands 0/0) reads 4.9748e-5,
  0.53% under the argmax

**The arm sweeps in two passes**, because 1,210 cells × 13 lengths against the
validated 400k-interval reference is hours of work: it screens every cell at a
fixed step cheap enough to run 15,730 times, then re-measures each length's
argmax at 400k with the 800k convergence check asserted. The screen only has to
RANK, and its value is printed beside the re-measurement. Screening at 4× the
resolution moves no printed figure and swaps one cell — the 9 h argmax, between
two cells that agree to five digits, which is the only kind of mis-rank a coarse
screen can make and the kind that leaves the printed maximum alone.

## The stated reason for keeping `FAST_TASK` was false in both halves

**M56.** The docblock called it "the model-level extreme — the lowest difficulty
the model's [1,10] domain admits, paired with the demands that make the
reservoir move fastest".

- **The demands are not the fastest.**
  `ρ(w) = α·w + r'·(1 − 0.95·w) = r' + w·(α − 0.9975)` is strictly DECREASING in
  w at both `alphaCog` 0.35 and `alphaPhys` 0.3, so the fastest reservoirs are at
  demands 0/0: 1/ρ = 0.952 h, against 2.140 h / 1.020 h at 0.9/0.1. The probe
  printed those three numbers all along.
- **It is not the box's extreme either.** `BOX_CORNER` — the same difficulty at
  demands 1.0/1.0, equally inside `EnergyTaskInput`'s declared domain — reads
  6.3864e-5 at 24 h against 5.5613e-5, and higher at every other length in the
  arm.

Neither pairing reaches the node budget in the first place: `nodesUsed` takes
`min(ϕ, 1/ρ_cog, 1/ρ_phys, hours)` and the arm's own line says the minimum is ϕ.
The demands only shape the integrand.

**Decided: `FAST_TASK` stays, and the bound moves off it.** It is kept for the
reason that is actually true — `business/model/AGENTS.md`'s five quadrature
figures and the suite fixture are read off it, so removing it would orphan them
— and `BOX_CORNER` is now the point the global claim rests on. Rejected:
replacing `FAST_TASK` with the box corner, because that silently restates five
shipped figures as a different task's readings; and renaming it, because the
name is the only handle four other documents have on it and the pairing's
non-extremeness is a fact about the header, not the identifier.

## The header quoted a claim no document still makes

**M57.** The opening six lines attributed "relative error ~1e-6 even for
near-floor ϕ tasks in long blocks" to MATH.md §8 and `business/model/AGENTS.md`,
and said `zenith-energy.ts` calls the quadrature "probe-verified". The phrase is
in neither document — the 2026-08-25 cut took the figures out of §8.1, and
`zenith-energy.ts` says "probe-verified" only about satiety. The probe itself
prints 5.5613e-5, 56× the figure it was quoting.

Deleted, not qualified. The header now states its claim in its own voice and the
arms answer it, which is the rule `docs/testing.md` landed on this same branch:
a header that says "MATH.md claims X" outlives the section it quotes, and
`math-citations.mjs` resolves `§N` to a heading, never to what the heading still
says.

## What the landed M48 spec says that is now known false

**M58.** [`the-extreme-that-had-never-declared-itself`](the-extreme-that-had-never-declared-itself.md)
is frozen and is not edited, so its two false sentences are recorded here.

- **"It holds pointwise, not just at the worst"**, in _What changed_, over a
  table whose second column is labelled "worst reachable". That column is not the
  worst reachable at its own 1 h or 8 h row. The conservatism is global, not
  pointwise.
- **"Not at the lowest-ϕ task: demands 0/0 leave the reservoir still"**, in _The
  open question, answered by sweep_. The 24 h argmax sits exactly AT the 0.1 h
  floor — 39 of the 1,210 cells do, so the floor is a REGION and the argmax is
  inside it. The mechanism the sentence names is right (at demands 0/0 the gate
  factor is constant) but it is worth 0.53%: 4.9748e-5 against 5.0015e-5. The
  contrast is the demands, not ϕ.

- **"It is the model-level extreme — the lowest difficulty the `[1,10]` domain
  admits against the demands that move the reservoir fastest"**, in the same
  section. Neither half holds: see M56 above.

The rest of that spec survives, including the half worth keeping: the ϕ floor IS
reachable, the two global figures are right, and the reachability rule is the
durable result.

## What was deliberately not done

- **No MATH.md change.** §8.1 states that the cap thins the node density past
  6.4 h at the 0.1 h floor and quotes no figure this sweep moves (R7).
- **`business/model/AGENTS.md`'s five figures stay.** They are `FAST_TASK`'s
  readings, scoped "at the 0.1h ϕ floor"; the counterexample task sits at
  ϕ = 0.500 h, outside that scope, so the sweep does not touch them.
- **No new suite fixture.** The 1e-4 pin already holds for the block it pins, and
  a sweep is a probe's business, never the suite's (`docs/testing.md`).
- **The reachable maximum is not asserted anywhere.** It moves whenever the
  quadrature or the constants move, which is what makes it a probe reading.
- **No `FLOOR_CONSTANTS` audit.** Unchanged from M48: whether that plane is a
  posterior a real fit could return is a separate axis, and the DESIGN paragraph
  declares the ϕ floor as the probe's choice.

## Where it landed

- [`scripts/enb-simpson-error.probe.ts`](../../scripts/enb-simpson-error.probe.ts)
  — the per-block sweep over the 1,210 cells, `BOX_CORNER`, and a header that
  states its own claim.
- [`docs/testing.md`](../testing.md) — the reachability bullet's worked example.
- [`src/lib/business/model/zenith-energy.test.ts`](../../src/lib/business/model/zenith-energy.test.ts)
  — the fixture's "at every block length".
- [ROADMAP.md](../../ROADMAP.md) — M48's row corrected in place, M55–M58 closed.
