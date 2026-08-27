# The witness read as a bound

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** finding M91

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

M55 replaced M48's pointwise claim with what the committed sweep shows, and
[`the-bound-that-only-held-past-nine-hours`](the-bound-that-only-held-past-nine-hours.md)
decided, in its "deliberately not done", that `business/model/AGENTS.md`'s five
quadrature figures stay: they are `FAST_TASK`'s readings, scoped "at the 0.1h ϕ
floor", and M55's counterexample task sits at ϕ = 0.500 h, outside that scope.

That reasoning is sound about the counterexample and leaves a hole. M55's own
new witness `BOX_CORNER` — difficulty 1 with demands 1.0/1.0, the corner of
`EnergyTaskInput`'s declared domain — sits **at** the floor, inside the scope,
and reads **6.3864e-5** in a 24 h block against the quoted 5.6e-5. Read as a
bound over floor tasks, the sentence is understated by 14%.

## What was found

The five figures are one witness's curve, and both sites present them as a
property of the regime: `business/model/AGENTS.md` says "at the 0.1h ϕ floor …
relative error **is** ~3e-7 up to 6h, 6.9e-7 at 8h, 1.7e-6 at 10h, 3.5e-6 at 12h
and 5.6e-5 in a 24h block", and `blockOutput`'s comment says "relative error
**grows** from ~3e-7 to 3.5e-6 at 12h and 5.6e-5 at 24h". Neither names a task,
so a model author reads them as what the quadrature does at the floor.

What is true of the regime splits two ways, and the split is the reason the
sentence needs one clause rather than a new figure:

- Over the MODEL's input box at the floor, the figures are not an upper bound:
  `BOX_CORNER` exceeds the 24 h cell by 14%, and the demands drive it — the
  error rises monotonically in both, so (1, 1) is the box maximum.
- Over what the APP can reach at the floor, they are: the worst reachable floor
  task reads 5.0015e-5 at 24 h, and below every one of the five at every other
  length. `BOX_CORNER` is unreachable because demands 1.0/1.0 come from sliders
  10/10, which `getEffectiveDifficulty` projects to difficulty 10, never 1 —
  which is the same coupling that made `FAST_TASK` off-surface in the first
  place.

So the figures are right about the app and wrong about the box, and nothing in
either sentence said which it meant. That is the M48 fault one level up: not a
false number, but a reading the number does not support, in a rules file where
the reader has no run to check it against.

## What was repaired

One clause at each site, naming the witness and the scope the figures do bound.
No figure changes, and no figure is added — the reachable maximum is a probe
reading, and `scripts/PROBES.md` is the rule that keeps it there.

## What was deliberately not done

- **`BOX_CORNER`'s 6.3864e-5 was not quoted into either file.** It would be a
  sixth measured number in a rules file, and it moves whenever the quadrature or
  `FLOOR_CONSTANTS` move. The probe prints it; the rules file points at the
  probe.
- **The figures were not re-read off `BOX_CORNER` instead.** They back a
  fixture and a design decision that are both `FAST_TASK`'s, so re-basing them
  would orphan those and answer a question nobody asked. What the box corner is
  for is the global claim, which M55 already rests on it.
- **MATH.md is untouched.** §8.1 states that the cap thins the node density past
  6.4 h and quotes no figure (R7).
- **The landed M55 spec is not edited.** Its "the five figures stay" bullet is
  the dated decision this finding reverses in part, and a frozen record is not
  rewritten when a later reading narrows it.

## Where it landed

- `src/lib/business/model/AGENTS.md` — the Cobb-Douglas / node-cap bullet
- `src/lib/business/model/zenith-energy.ts` — `blockOutput`'s node-count comment
- `ROADMAP.md`
