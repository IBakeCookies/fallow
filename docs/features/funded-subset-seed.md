# A funded-subset seed deeper than drop-one

**Kind:** model · **Status:** landed 2026-08-13 · **Roadmap:** item 30

Backfilled 2026-08-14 from ROADMAP item 30, whose text was written at land. Not
a pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

The search reaches funded subsets deeper than drop-one, via a seed per **pair**
of the three highest-amplitude tasks, round-robin over two and searched **within
the pair**.

## Scenarios

### Claim — a second proven funded-set defect exists

`scripts/energy-search-gap.probe.ts` → MATH.md §8.6

- **Given** the frontier tier widened from 3 days per size to 20 at 4 tasks and
  8 at 5
- **Then** a second proven defect appears at 5 tasks × 6 h, where search funds
  {2} at 9.344081 against the optimum's {2,5} at 9.392388, **0.5143%**
- **Then** 14 of those 20 four-task days have an optimum funding ≤ n − 2
- **Then** 8 of those 8 five-task days have an optimum funding ≤ n − 2

### Claim — both witnesses are suite fixtures

- **Given** the two proven witnesses
- **Then** both are suite fixtures
- **Then** both were watched failing first

### Claim — the pair seeds knock on to the 0.25 h-step search

MATH.md §8.8

- **Given** the probe day at 8 h
- **Then** the coarse and fine funded sets no longer agree
- **Then** the coarse plan is still the enumerated optimum of its own lattice
- **Then** the suite test says that is quantization

## Out of scope

- **The stated fix — a classic seed over the right subset.** It does not work.
  The search visits it today and it lands nowhere new, because its local search
  may still reach every task and the steepest first move re-funds a dropped one.
- **The amplitude-prefix pair** — measured and rejected at 5.399815 against
  6.159566 on the 4-task witness.
- **The pair-dropped classic seed over the whole task list** — measured and
  rejected: both witnesses unchanged.
- **The classic pair seed** — measured and rejected: it fixes the 4-task
  witness, not the 5-task one.
- **Unbounded `C(n,2)` pair seeds** — the cost gate is what capped the family at
  three tasks. Unbounded `C(n,2)` measured **12.5× / 13.1×** at 10 / 15 tasks ×
  12 h, while `C(3,2)` costs **~1.3×–2.3×**.
- **A single cell of the cost range as the number** — the ratio is
  composition-dependent, so the range **~1.3×–2.3×** is the number; no single
  cell of it is.

## Where it landed

- MATH.md §8.6 — the section the change ships under; it carries both cost
  tables, measured across two machines and two task compositions.
- MATH.md §8.8 — where the knock-on to the 0.25 h-step search is recorded.
- `scripts/energy-search-gap.probe.ts` — the probe whose widened frontier tier
  found the second witness.

## Decisions

- **Two witnesses, not one.** Widening the frontier tier from 3 days per size to
  20 at 4 tasks and 8 at 5 found a second proven defect: 5 tasks × 6 h, search
  funds {2} at 9.344081 against the optimum's {2,5} at 9.392388, **0.5143%**.
- **The case is no corner.** 14 of those 20 four-task days and 8 of those 8
  five-task days have an optimum funding ≤ n − 2.
- **Both witnesses became suite fixtures, watched failing first.**
- **The stated fix does not work, and the reason is worth keeping.** A classic
  seed over the right subset is visited by the search today and lands nowhere
  new, because its local search may still reach every task and the steepest
  first move re-funds a dropped one.
- **What ships is a seed per pair of the three highest-amplitude tasks,
  round-robin over two and searched within the pair.** Rejected: the
  amplitude-prefix pair (5.399815 against 6.159566 on the 4-task witness); the
  pair-dropped classic seed over the whole task list (both witnesses unchanged);
  the classic pair seed (fixes the 4-task witness, not the 5-task one).
- **The cost gate capped the family at three tasks.** Unbounded `C(n,2)`
  measured **12.5× / 13.1×** at 10 / 15 tasks × 12 h, while `C(3,2)` costs
  **~1.3×–2.3×**, measured across two machines and two task compositions
  (§8.6 carries both tables). The ratio is composition-dependent, so that range
  is the number — no single cell of it is.
- **One knock-on, recorded in §8.8.** The pair seeds also improve the 0.25 h-step
  search, so the probe day's coarse and fine funded sets no longer agree at 8 h.
  The coarse plan is still the enumerated optimum of its own lattice, so that is
  quantization, and the suite test says so now.

## Open questions

None — landed.
