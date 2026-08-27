# The sites the sweeps walked past

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** findings
M75–M84

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

M17, M34, M35, M47–M54 were each a sweep: find every site carrying one claim,
repair them together. A review of the twelve commits that closed them asked the
question a sweep cannot ask itself — what did each one walk past? Ten single
sites, in nine live files, each holding a claim that was false or that could not
be kept true. Nothing the user sees moves; no shipped behaviour moves.

They are one commit because they share a cause, not a subject: every one is a
claim about the tree written where nothing can re-derive it.

## What was found

**M75 — `docs/testing.md` pointed at a failure MATH.md no longer shows.** The
probe-writing rules opened with "the alternative is the failure `MATH.md`
already shows: the sweep behind 'the trim is free' was thrown away". M52 had
already deleted the dangling `§14.1-2` citation from that sentence and recorded
that "the sentence keeps its lesson" — but the lesson was stated as a place to
look, and `grep -i trim MATH.md` returns only §8.12's `trimRest`, a different
quantity. Present tense, no surviving referent.

**M76 — the reachability rule's own call count could not be kept true.** The
rule read "64 of `zenith-energy.test.ts`'s 72 `makeTask` calls are" off the
surface. At HEAD the file has 80 call sites: 72 off the surface, 7 reachable,
1 built from loop variables. The count was correct when M48 landed it (70) and
when M49 updated it (72); M47 and M54 then added eight calls without touching
the sentence, neither of them a change to that rule.

Nothing in `npm run lint` can re-derive that number, and this document's own
next-but-one bullet says why that matters: **quote the number in the probe, not
in prose.** A hand-maintained census in a rules file rots by construction, and
it had already rotted twice on one branch.

**M77 — a pre-cut MATH.md size that no revision ever had.** R7 and MATH.md's
own header both said the discarded-measurement habit "grew the file to 9,482
lines". `git show e61d207^:MATH.md | wc -l` is **9,431**, the file ends with a
newline, and 9,431 is the maximum over every one of the last eighty revisions
that touched it. The `numstat` reconciles exactly (9,431 − 8,339 + 519 =
1,611), so the "1,611" half was always right. The figure entered in
`e61d207`'s own commit message and was copied forward.

**M78 — §8.12 credited the copy with naming what it checked.** The section said
a knee beyond `BUDGET_CURVE_MAX_HOURS` "is reported as no recommendation rather
than as 12 h … and the copy names the cap it checked". `budget-curve-card.svelte`
passes `curve.maxBudgetHours` into both messages, and that is
`options.maxBudgetHours ?? BUDGET_CURVE_MAX_HOURS` — the cap, not the largest
budget the sweep reached. The very next paragraph, added by M33 two lines above,
exists to say those two part whenever the cap is not a whole number of steps: at
a 5 h cap the sweep tops out at 4.5 h while the copy would say 5 h.
Unreachable in production — nothing passes options and 12 h is 16 whole steps —
so this is the block M33 rewrote disagreeing with itself, not a shipped defect.

**M79 — the rejected seeding, in the tense M34 removed.** M34 re-tensed four
sites that stated the `-Infinity` seeding's behaviour as fact. The fifth,
`budget-curve-card.stories.svelte`, said "seeded from -Infinity this branch
**used to** come back recommending 45 minutes that book 0h of work" — the one
remaining site with an assertion and no probe citation, in the past tense
`AGENTS.md` §0 names outright, about a seeding that was never shipped. The
counterfactual was being stated as history, which is exactly why M34 re-tensed
the other four.

**M80 — the docblock M47 cleaned, dirty again two commits later.** M47's own
spec lists the pre-M47 `PAIR_SEED_TASKS` docblock as one of six sites carrying a
measured figure and a date, and `5dbe0b3` cleaned it to a bare pointer at the
probe. `8ac490c` put both back: "Was 3 until ROADMAP M54 measured what the third
task left on the table — on 6 of 7 days in 2000 a cap of 4 changes the funded
SET, not the hours." Archaeology (§0) and a measured number outside a probe
header (`PROBES.md`), and the sentence above it already says what the constant
means.

**M81 — a credit for eight alignments given as nine, on two wrong dates.** The
comment M50 shipped on `plan-audit.test.ts` said "M44 aligned the other nine
declarations on 2026-08-21". M44 aligned eight; one of the nine
(`energy-search-gap`'s) is deliberately unaligned and says so; and two of the
eight were aligned by `519c90f` on 2026-08-19 and `340d64f` on 2026-08-20. The
same commit's own spec says eight.

**M82 — a completeness claim about off-default constants, one short.**
`advisor-curve-agreement.probe.ts` declared "DELIBERATELY NOT the defaults —
alphaCog, alphaPhys and recoveryRate are the reporter's". Four fields differ
from `DEFAULT_ENERGY_PARAMS`: those three and `freeTimeValue`, 1.2 against 0.5 —
a 2.4× change in the λ₀ both halves of the agreement are scored against. Ranked
low because the file's opening docblock states λ₀ = 1.2 as the reported day's
value, so no reader is misled about the number; the declaration's claim about
what differs was still wrong.

**M83 — a percentage of a constant the code did not read.**
`rv13-stop-insertion.probe.ts` printed "worst shift as a fraction of
STOP_INVERSION_MARGIN: 79%" against a hardcoded `0.25`, and the constant's name
appeared nowhere else in the file. Its inversion replica carried the same
literal, silently. The value agrees today, so the 79% M17 quotes is correct;
moving the constant would have left both the label and the replica wrong with
nothing to catch it. The repo's deliberate convention that probe arms hold
constants as literals covers a **swept independent variable**, not a label
naming the shipped constant it divides by.

**M84 — the seventh of M50's eight excluded call sites.** M50 set aside eight
generators as "built from loop variables and not statically decidable" and never
resolved them. `rv13-stop-insertion.probe.ts`'s 4,000-day sweep is one, and it
is the fault the sweep exists to find: difficulty drawn `1 + floor(rnd()*10)`
independently of the demands, with no declaring sentence — in an arm whose worst
case M17's ledger row quotes. Two more of the eight were resolved elsewhere on
this branch; `stp-stopping-identifiability.probe.ts` turned out to be a false
member, since its generator computes `getEffectiveDifficulty`'s formula inline
and its declaration at `:117` already says so.

## What was repaired

Deletion where a claim could go, correction where the sentence carried
something.

- **M75** — the sentence names the failure without naming a document that would
  have to still show it.
- **M76** — the census goes. The rule reads "most of `zenith-energy.test.ts`'s
  `makeTask` calls are", which is what the rule needs and what stays true. The
  count at the time of this repair — 80 sites, 72 off the surface, 7 reachable,
  1 non-literal — is recorded here, in a dated file, which is where a figure
  nothing can re-derive belongs.
- **M77** — 9,482 → 9,431 in R7 and in MATH.md's header, the two live sites.
- **M78** — "the copy names the cap it checked" → "the copy names the cap".
- **M79** — re-tensed onto the phrasing M34 used in `zenith-energy.ts`
  ("is recommended 45 minutes that book 0h of work, on every such day
  measured"), with `curve-shape.probe.ts` cited beside §8.12.
- **M80** — the date, the "Was 3 until" and the figure go; the probe pointer
  stays, widened to "costs, saves and forfeits", which is what the probe now
  measures.
- **M81** — the attribution goes with the rest of the archaeology. What a reader
  needs is that this declaration matches the suite's, and that nothing here is
  quoted.
- **M82** — the declaration names four constants and the four defaults they
  differ from, and says λ₀ = 1.2 is the value both halves are scored at.
- **M83** — the probe imports `STOP_INVERSION_MARGIN` and reads it at both
  sites. Re-run: 79%, and all five arms pass, so the import is behaviour-neutral
  as intended.
- **M84** — a declaring sentence: the population is a strict superset of the
  surface, the arm reports a worst case and a sign, and a superset's worst
  bounds the reachable worst.

## What was deliberately not done

- **The generator at M84 was not realigned onto the sliders.** Realigning it
  moves every figure the arm prints, including the 79% M17's closed row quotes
  as of its date. A bound measured over a superset is the case
  `docs/testing.md`'s reachability rule permits off the surface, so the
  declaration is the whole repair.
- **The three frozen specs keep 9,482.** `the-cap-the-sweep-never-reached`,
  `the-third-site-deleted-with-its-section` and
  `the-witness-that-outlived-its-section` each restate it. They are dated
  records of what was believed that day and are not edited; this file is the
  correction.
- **No lint script was added for any of these.** Every one is a claim about the
  tree in prose, and the reason they rotted is that nothing can re-derive them —
  which is an argument for not writing them, not for building a checker per
  sentence.
- **M82's `freeTimeValue` was not moved to the default.** The panel is quoted
  "exactly as reported"; changing it would answer a different question, which is
  what the declaration already says about the other three.

## Where it landed

- `docs/testing.md` — M75, M76
- `MATH.md` — M77 (header), M78 (§8.12)
- `AGENTS.md` — M77 (R7)
- `src/lib/presentation/component/budget-curve-card.stories.svelte` — M79
- `src/lib/business/model/zenith-energy.ts` — M80 (the `PAIR_SEED_TASKS`
  docblock only)
- `src/lib/business/model/plan-audit.test.ts` — M81
- `scripts/advisor-curve-agreement.probe.ts` — M82
- `scripts/rv13-stop-insertion.probe.ts` — M83, M84
- `ROADMAP.md`
