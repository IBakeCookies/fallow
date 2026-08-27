# The third site, deleted with its section

**Kind:** audit · **Status:** landed 2026-08-27 · **Roadmap:** finding M17

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

M17 was raised against a retracted pair — "the same probe step scored 0.65
appended last vs 0.37 inserted first" — quoted in three places as live fact.
Two were fixed on 2026-08-19
([`what-the-retracted-step-still-said`](what-the-retracted-step-still-said.md)).
The third, §8.10's feasibility-2 paragraph, was **held** rather than fixed: its
reconstruction figures were under a maintainer ruling, and editing the pair out
of a held paragraph would have been editing the thing the hold protects. So the
entry stayed open with a dated note saying which site remained.

The hold has not been lifted. The question is whether the site still exists.

## What was checked

- **The pair, across every tracked file** (`git ls-files | xargs grep`, not a
  path-scoped grep — the previous M17 note's own citations had gone stale by
  line drift, so the search deliberately assumed nothing about where the text
  would be). Both figures, separately, on 27 files; every hit read.
- **The two surviving sentences that describe the convention**, re-derived from
  `rv13-stop-insertion.probe.ts` rather than trusted: §8.10's "inserted at its
  own canonical rank among the work blocks, not appended last", §8.11's
  "Appending does not measurably help", and `growBy`'s docblock claim that
  "block order changes the marginal through the reservoirs".
- **Whether the two fixed sites survived** the intervening rewrite.

## What was found

**The site is gone, and this commit did not remove it.** `e61d207`
(2026-08-25, "MATH.md holds derivations; the provenance machinery is gone") cut
MATH.md from 9,482 lines to 1,611 and deleted §10 through §37 wholesale. §13.4
went with them — the retraction, its bare 0.067, and the 2026-08-19 fix that
restated it — and so did the pair inside §8.10's paragraph, which now names the
convention without pricing it. MATH.md today contains neither figure, and
neither does any other live text.

**The one place either figure survives is archaeology, correctly labelled.**
`rv13-stop-insertion.probe.ts:8,15` quotes the pair twice, both times as what
"the record says", and states in the same breath that it "is from a day that was
never recorded, so it cannot be reproduced". That is the file that exists to
measure the sign and spread the pair claimed; quoting the claim it refutes is
the point of it.

**What replaced the pair is true today.** Re-run on 2026-08-27:

- §8.10's own fixture day reads **inserted 0.9135 against appended 0.9112**, a
  gap of 0.0023 — M43's pair, unmoved. The sign the section needs survives.
- Block order does move the marginal, so `growBy`'s docblock is not
  decoration: over 6,232 unlogged probes on 3,182 days, **appending reads higher
  on 19.7% of them**, worst |gap| 0.4113, and it shifts the day's indifference
  point on 552 of 2,258 two-sided days (median 0.0000, p99 0.0702, worst 0.1964
  — 79% of `STOP_INVERSION_MARGIN`).
- §8.11's "does not measurably help" holds on every uncensored cell of the
  timed arm: inserted and appended agree to four decimals at λ₀ 0.9 (0.9782 /
  0.8981 / 0.9785) and λ₀ 1.3 (1.3201 / 1.3213 / 1.3215).

**The 2026-08-19 fix to `growBy` survived; its citation did not.** The docblock
still drops the pair, but the `(MATH.md §13.4)` it was told to cite instead
went with §13.4. The paragraph now carries the mechanism alone, which is what
`AGENTS.md`'s archaeology rule asks of it anyway.

## What was repaired

`ROADMAP.md`'s M17 row, which is the only thing left that was wrong: it
described a held site that no longer exists and prescribed a substitution
(0.8894/0.8840) that three separate notes had already declared wrong. Closed
with the reason it closed — deletion by a commit that was not aiming at it.

## What was deliberately not done

- **The hold was not lifted, and §8.10 was not edited.** The paragraph that was
  held no longer contains the offending text; nothing about the ruling changed,
  and no part of this commit touches MATH.md.
- **`rv13-stop-insertion.probe.ts`'s quotes were left standing.** They are the
  record the probe measures against. Deleting them would leave a sweep with no
  stated claim to refute.
- **M17's stale citations were not repaired in place.** `math-citations.mjs`
  exempts `ROADMAP.md` by design — "a section they cite is a fact about that
  day, not a promise about this one" — so the row records what it recorded and
  the close says what is true now.
