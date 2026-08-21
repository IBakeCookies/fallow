# The insertion witness, re-read on the day the suite declares

**Status:** landed 2026-08-20 · **Roadmap:** finding M43

Backfilled 2026-08-21 from ROADMAP.md's M43 entry, whose text was written at land, and
moved here verbatim so the roadmap can hold a line and a link. Not a
pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

**M43 — CLOSED 2026-08-20. The witness named a day it no longer measured, and
a second figure in the same section had rotted unnoticed.** §13.4 rested on
"§8.10's own fixture day … where inserting reads _higher_, midpoint 0.8894
against 0.8840. But the gap there is 0.005". The suite moved that day onto the
sliders on 2026-08-19 (guitar 0.4/0.3 → 0.6/0, reading 0.5/0.05 → 0.4/0,
difficulties held) while `rv13-stop-insertion.probe.ts:304` went on declaring
the old triple — so the probe still printed 0.8894/0.8840 and the section still
agreed with it, and both described a day the repo no longer had. Closed by
aligning that one M44 site and re-reading: **inserted 0.9135 against appended
0.9112, a gap of 0.0023** — the sign §13.4 needs survives, and the gap halves,
which makes the comparison against the retracted pair's implied 0.14 shift
stronger, not weaker. Its `lo` probes: boxing 0.9407/0.9361, guitar
0.8774/0.8612, reading 0.6126/0.6126 (unchanged, as the logged task must be).
§8.11's "the two agree to four decimals" re-checked on the aligned day and
holds on all seven uncensored cells. The 3182-day sweep is untouched: it draws
random tasks, not this day.
**Found while re-reading: §13.4's round-trip figure had drifted too, and
earlier.** "true 0.9 → 0.892 … (2026-08-06)" printed **0.7995** on the day the
probe still declared — it had been wrong since the timestamped-day rework of
2026-08-19, independently of the fixture question. Now **0.8387**, with true
0.5 → 0.5883 on its one usable day and 0.3 still fully censored. No new suite
pin: §13.4's property (the estimator is a function of the day, not of insertion
order) is already pinned, and what failed here is figure provenance, not
behaviour. The general guard is item 29's rule made mechanical — a check that
every figure MATH.md attributes to a probe still appears in that probe's
output — which nothing does yet.
