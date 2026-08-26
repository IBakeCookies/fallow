# The seeding the probe never re-ran

**Kind:** repair · **Status:** landed 2026-08-26 · **Roadmap:** finding M34

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

**M34 — §8.12's rejected seeding was asserted in a comment and measured
nowhere.** `suggestBudgetCurve` seeds the day-value level from the do-nothing
day; the alternative — seeding from `-Infinity`, so the first swept budget always
"rises" — is the reason that baseline exists, and every site that names it said
what it would recommend as a matter of record rather than of measurement:
`curve-shape.probe.ts` counted the days that book no work at any budget and then
asserted, in the comment above the counter, that "every one of these days used to
come back recommending the first swept step with 0 h of work on it". The RAW arm
one screen up reconstructs the marginal the majorant replaced, off the same
sweep, which is precisely the treatment the seeding never got.

**The claim was true, and it is now a printed figure.** The probe gained a
SENTINEL arm: the same lattice and the same common-horizon scoring, seeded from
`-Infinity`, run per λ₀ over the same 60 days.

The entry's `MATH.md:2058-2060` address was dead — the sentence it quoted went
with the 2026-08-25 cut that took MATH.md to its derivations (R7), and the
surviving §8.12 paragraph says only that a sweep starting at `step` "has to
invent an answer". That paragraph now says what the invention is.

## Claim — what the rejected seeding costs

`scripts/curve-shape.probe.ts` → MATH.md §8.12

- **Given** 60 seeded days at each λ₀ of {0.2, 0.5, 0.75, 1, 1.25, 1.5, 2, 3},
  the shipped 12 h cap, and the `-Infinity`-seeded level reconstructed off its own
  sweep
- **Then** on every day whose level never leaves the do-nothing floor — 0, 0, 0,
  9, 29, 57, 60 and 60 of 60 up the λ₀ ladder, 215 in all — it names the first
  swept step, 45 minutes, booking 0 h of work: 215/215 on both counts
- **And** on the other 265 days it names the shipped knee exactly, 265/265, so
  the seeding buys nothing anywhere else and costs only that branch

The flat days and the days the card calls "no window is worth working"
(`workHours === 0` at every budget) came out the same set at every λ₀ measured,
which is why the shipped rule can branch on the second and still be talking about
the first.

## What was deliberately not done

- **No production change.** The shipped seeding was already the right one; this
  entry was about what backs the claim, not about what the code does. Nothing in
  `zenith-energy.ts` moved but a comment's tense and its probe citation.

- **The reconstruction was not read back off `dayValue`.** The RAW arm needs no
  solves because the step difference is recoverable from the shipped level; the
  seeding is not, since `dayValue` floors at the do-nothing day and the flat days
  are exactly where the floor hides what the raw sweep did. The arm takes its own
  16 solves per day, and the probe went from 346 s to 663 s for them.

- **No λ₀ was skipped to buy that time back.** The arm runs the full ladder,
  including the three λ₀ where no day is flat — those are where the
  agrees-everywhere-else control is measured, and a control run only where the
  rules already agree would establish nothing.

## Where it landed

- [`scripts/curve-shape.probe.ts`](../../scripts/curve-shape.probe.ts) — the
  SENTINEL arm and the header that names it.
- [`scripts/PROBES.md`](../../scripts/PROBES.md) — the row, which named two arms.
- [MATH.md](../../MATH.md) §8.12 — the do-nothing paragraph names the answer the
  `-Infinity` seeding invents.
- [`src/lib/business/model/zenith-energy.ts`](../../src/lib/business/model/zenith-energy.ts)
  — `suggestBudgetCurve`'s do-nothing comment, now present tense and citing the
  probe.
- [`src/lib/business/model/zenith-energy.test.ts`](../../src/lib/business/model/zenith-energy.test.ts)
  — "recommends nothing when no window beats not working at all", same tense fix.
