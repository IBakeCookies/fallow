# The default nobody had measured

**Status:** landed 2026-08-20 · **Roadmap:** finding M46

Backfilled 2026-08-21 from ROADMAP.md's M46 entry, whose text was written at land, and
moved here verbatim so the roadmap can hold a line and a link. Not a
pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

**M46 — CLOSED 2026-08-20. §8.3's open question was not a defaults question,
and no instrument had measured the default.** §8.3 carried "a humane default
day needs a structural change… Defaults were deliberately left alone pending
that decision", then a 2026-07-19 note declaring it "Resolved by §8.4". §8.4
resolved the response's SHAPE (W\*(λ₀) graded, not bang-bang) and the section
said so; the level half it left dangling, and the heading still advertised an
open question. Checked: the ladder in
`scripts/enb-break-economics.probe.ts` sampled λ₀ ∈ {0.2, 0.4, 0.8, 1.0, 1.2,
1.5} and the suite fixture {0.4, 0.8, 1.2, 1.5}, so **0.5, the value the app
ships, was in neither**. It reads **11.25 h of a 12-hour window**, on a flat
step spanning λ₀ 0.4–0.6, and both declarations of that day (M44) agree on the
figure. Four tests were already incidentally sensitive to the default and none
said what it plans. What the default means turns out to be a property of the
day, not of λ₀: 0.94 of the window on the demanding three-task day, 0.69 on a
cognitive desk pair at 12 h, 0.38 on a pair of errands, where it stops at 4.5 h
whether the window is 8 hours or 14. And it cannot be raised — one slider notch
to λ₀ = 1 empties the plan on both light portfolios (desk pair at 12 h scores
13.5000 idle against 11.3880 for the 8.25 h the default plans, so the empty day
is the true optimum, not a search failure). The level question was already
settled, in **§15**: peer modes, the energy objective plans a larger share of
the budget than the classic allocator by construction, and the energy model
carries no capacity-pool constraint at all. Closed by adding 0.5 to the probe
ladder, two suite fixtures, and the §8.3 paragraph that points at §15 — no
model change.
