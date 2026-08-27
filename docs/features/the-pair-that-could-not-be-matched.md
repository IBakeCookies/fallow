# The pair that could not be matched

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** finding M51

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

The second of two residuals from M50's surface search, and the one that is not
a wrong number. `rv13-terminal-timing.probe.ts` builds its fixture with a local
`task()` that pins `difficulty: 8` and takes the two demands as arguments, then
calls it with 1/0 and 0/1. Sliders 10/0 and 0/10 both derive difficulty **10**,
so all four of its call sites are off the surface.

Its comment gave a reason — "matched across the pair, and the values that
reproduce the table" — but not the sentence M48's rule asks for: which extreme
this is, and why the reading survives it.

## What was decided

**It stays off the surface, and now says why.** The record's own fixture spec is
"one pure-cognitive and one pure-physical task at MATCHED difficulty/enjoyment",
and matched difficulty across that pair is unreachable **by construction**: pure
cognitive and pure physical are sliders 10/0 and 0/10, both of which
`getEffectiveDifficulty` sends to 10, so the only such pair the sliders admit
differs in nothing but the axis label. Holding difficulty at 8 is what isolates
the demand axis, which is the claim the probe exists to reproduce.

Nothing app-level is read off it. The numbers it prints are objectives of the
model, re-derived so the record's avg-vs-min table can be checked; no rate, no
user-facing behaviour.

That argument is now the helper's docblock. **Nothing else moved** — all three
arms still pass and print what they printed.

## What was deliberately not done

- **The pair was not redrawn onto the sliders.** It would have to become two
  tasks at difficulty 10, which is a different fixture answering a different
  question, and the table it reproduces would no longer be the record's.
- **The named-day arm was not touched.** Its copy of the boxing/guitar/reading
  triple was already aligned by M44 and is on the surface.
- **The other nine mirrored fixtures found by the same search were left as
  they are** — see M50 for why a per-copy sentence adds nothing where a class
  declaration already covers them.
