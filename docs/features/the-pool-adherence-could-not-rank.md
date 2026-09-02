# The pool adherence could not rank

**Kind:** model · **Status:** landed 2026-09-03 · **Roadmap:** item 18 (its gate, second reading)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

[the-pool-the-drain-logs-might-know](the-pool-the-drain-logs-might-know.md)
left item 18's gate **void**: `classicOverlap` ranked the known-correct capacity
pool at or below declared 4/6 at three of four evaluable points, so no verdict
about the §8.13 map was readable from it in either direction. That closure named
what a re-opening needs — "a different reading than plan adherence" — and this
is that reading, built as a fourth arm on the probe that found the problem.

Nothing user-facing changes and no formula moves. The pools stay declared, no
allocation reads the map, and item 18 stays open.

## What was built

`scripts/capacity-from-drain.probe.ts` arm D, on arm A's own α grid: each day's
plan is solved under a declared pool, then **worked under the true one** — the
plan followed in its own priority order, each task floored to the block lattice,
until a reservoir is empty — and scored on the objective `Σ vᵢ·P̄ᵢ(tᵢ)` against
the plan that knew the truth. It scores the last 60 sessions, where the
adherence arms score the last 60 days carrying a 🪫 row, so the two arms read
comparable spans and not the same days.

The probe header carries every figure beside the run that produced it.

## Why this reading can rank a pool and adherence cannot

- **The reference is the right answer.** Planning under the true pool is what
  every other pool is scored against, so the pathology that voided the gate —
  the right answer scoring below a wrong one — is not something this reading is
  exposed to. It is a reference rather than a proven maximum: the pooled
  allocator is a greedy exact only to within a block (MATH.md §4), so a plan
  solved under another pool and then truncated could in principle score above
  it. The probe prints the best day as well as the worst, which is what makes
  that checkable rather than assumed.
- **It does not need the declared pool to bind.** `classicOverlap` compares two
  plans, so 4/6 binding on 9–16 of 60 days made the baseline nearly a no-op. A
  pool that is too generous is priced here by the hours the true day could not
  hold, which is exactly the failure a too-generous pool causes.
- **It is the SHAPE of reading Phase 2 was already quoting.** The pool figures
  that phase is framed on came from scoring a plan under θ̂ against the score
  under θ_true, and until now nothing committed did that. Arm D does not back
  those figures: it reads a derived pool against 4/6 on the drain fixture, not a
  2×-wrong pool on the 400-day one, so they stay un-re-derivable and item 29's
  rule still applies to them.

## What it found

Read the probe header, not this file. The shape of it: the derived pool roughly
halves the mean objective loss of the constants it would replace, the two are
not uniformly ordered, and α̂ comes back high at every point so the derived pool
is uniformly **small** — the cheap direction, because an under-declared pool
leaves value unspent while an over-declared one plots a day that cannot be
worked.

## Decisions

- **Arm D goes in the existing probe, not a new file.** It answers the same
  question on the same grid and reuses `generate`, `derive`, `truePoolsOf` and
  the ϕ-plane fit; a second file would have copied that scaffolding, which R3
  calls a defect the moment it exists. The grid itself is now one constant
  (`SELF_CONSISTENT_GRID`) rather than two copies, and the ϕ-plane fit one
  helper rather than two call sites.
- **Truncation in priority order, not re-planning.** A plan that overspends a
  pool the user does not have has to give somewhere, and re-solving under the
  true pool would score the map against an oracle nobody has. Following the
  plan until a reservoir empties is the least-arbitrary rule and the one the
  generator's own day simulation uses.
- **Arms A–C keep `classicOverlap`.** Their figures are the record of what that
  instrument does, which is the finding the previous spec landed; deleting them
  would delete the reason arm D exists.
- **No new suite fixture.** [docs/testing.md](../testing.md) says to pin what a
  probe found with one fixture. What arm D found is a comparison between two
  instruments, and it adds no `src` code — the reference, the truncation and the
  scoring live in the probe, and `capacityFromDrainRate`, the allocator and the
  objective are each pinned already. A fixture here would pin the probe's own
  helper against itself.
- **The gate is answered on one arm only.** Arm A's question — is the
  estimation chain worth it when the law holds — now has a readable answer. Arm
  B's — what it costs when the law is false — still returns no derived pool at
  any point, because §8.13's domain gate scales with the fitted recovery rate.
  That is the other half of the 2026-08-30 closure and this reading does not
  touch it.

## Out of scope

- **The per-day prefill and the apply button.** Unchanged from the previous
  spec: item 18's payload waits on a gate that is still half unanswered.
- **`DEFAULT_CAPACITY_POOLS` itself.** It stays 4/6, for the reason
  [data/AGENTS.md](../../src/lib/data/AGENTS.md) settles.
- **Arm B's domain problem.** Re-running it needs an α_phys inside §8.13's
  domain or a floor that does not put one there — a different question, and a
  MATH.md change rather than a probe arm.
- **Any reading on real logs.** One profile is n = 1 against a many-user
  question, declined for the same reason the previous spec declined it.

## Open questions

None. What is unanswered is arm B, and that is recorded as item 18's remaining
blocker rather than as a question about this reading.
