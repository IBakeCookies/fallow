# What the extraction was worth, in one measured arm

**Status:** landed 2026-08-20 · **Roadmap:** the 2026-08-20 rules eval

Backfilled 2026-08-21 from ROADMAP.md's rules-eval findings, whose text was written at land, and
moved here verbatim so the roadmap can hold a line and a link. Not a
pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

~~**`calendar/+page.svelte` holds the one `eslint-disable` for that rule, and
it is a true positive.**~~ Extracted to `CalendarStore` — the reads, the
version guard that drops a superseded month, the one-toast-per-outage policy
and the loaded flag, with the toast copy injected from the route (a business
module importing `showToast` would fail R1) and six specs behind it, two of
which were checked by mutation rather than by having been written first. The
page kept the grid, the labels and the locale's week start. Knowingly paid:
this is also the task `eval/cases/calendar-month-cache.md` sets, so its R1,
R2, `store.context-setter` and `store.loaded-flag` traps are now answered by
the surrounding code and the case is easier than the five sweeps behind it
measured. What it bought, measured on an 8-run
`none` arm before and after: **21% (SD 8) to 77% (SD 15)**, Welch t = 9.30,
df = 10.4. Per rule, `store.context-setter` 0 to 100% (partly a check
artefact — the grep for `setContext` matches the store file the agent now
edits), `store.loaded-flag` 13 to 88%, R2 0 to 75%, R1 56 to 94%. Part of
that is the task getting easier, since the traps are pre-answered; the part
that is not is R6, and it is the interesting half. **Before, 8 of 8 runs
added no spec at all** — one reasoned "No page components have tests in this
codebase, so I..." and stopped. **After, 8 of 8 added a spec** in the right
file with the right harness, and **1 of 8 wrote it before the
implementation.** Agents imitate artefacts they can see and do not infer
process from them. For scale: handing an agent all nine rules docs bought 44
points on the old base at $5.29 a run, and fixing one file bought 56 at
$1.02.

## Why one decision moved six scored rows

Moved here with the entry above, from the rules-eval finding it belonged to:

The eval's dominant failure was one decision — keep the read orchestration in
`+page.svelte` — and that single decision failed R2, R1, `store.loaded-flag`,
`store.context-setter` and R6 together, which is why six scored rows so often
moved as one.
