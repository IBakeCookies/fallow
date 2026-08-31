# The absence a rewrite declared

**Kind:** repair · **Status:** landed 2026-08-31 · **Roadmap:** the 2026-08-25
`SessionStore` review, the residue of S5

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is the area `AGENTS.md`. When later work changes
the behaviour, it writes its own feature file; it does not edit this one.

## The question

A stored day with no pool fields — every record written before pools were
configurable — loaded with `DEFAULT_CAPACITY_POOLS` in raw state, deliberately,
so the store agreed with `metric/history.ts` and `session-history.ts` about what
such a day ran on. But the next write of that day then recorded 4/6 as explicit
numbers, and `constraint-memory.ts` takes the latest day carrying both fields as
the standing declaration. So a rewritten legacy day dated after the user's last
real declaration outranked it and pinned every untouched future day to the
constants.

Bounded on both sides: autosave refuses past days, so the rewritten day must be
today or later, and every day written since pools shipped already carries them,
so only legacy records enter this path. Unmeasured — no probe has counted how
many such records a real profile holds, and the answer may be zero.

## What was decided

**Absence is a statement, and it survives a write.** The load keeps the field
`null`; a new `#openingPools` answers for it with the constants on a stored day
and with the carry-over on a day with no session at all, so what the panel shows
and what a blur compares against did not move. `#declaredPools` is what a write
records: nothing for a stored day that never declared them, both fields
otherwise.

This settles the "a stored day keeps its own" decision rather than re-opening
it: absence still reads as the constants everywhere it is read. What changed is
that the app no longer answers, on the user's behalf, a question the day never
answered.

**A day the write CREATES still records the pools it opens on**, the rule its
hours already follow (item 16). The alternative — omitting them there too — would
store a day planned on the carried pools and score it later on the constants.

**The defer destination is the same write through another door**, so it moved
with it: `#readDestination` now resolves a stored day's absent pools to the
constants (its preview read the carry-over before, which was the same defect one
step earlier) and hands the move a separate `declaredPools` to write.

## What was deliberately not done

- **The three copies of "absent pools are the constants" were not merged.**
  `metric/history.ts`, `session-history.ts` and the store each spell the same
  fallback. It is R3-shaped and was left alone: the mirror is not what broke,
  and merging it is a refactor across two layers.
- **No probe counted the legacy records.** The fix is cheaper than the
  measurement and correct at a count of zero.
