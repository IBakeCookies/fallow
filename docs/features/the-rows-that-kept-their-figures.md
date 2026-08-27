# The rows that kept their figures

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** findings
M85–M90

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

`ROADMAP.md`'s own preamble says it in three sentences: **a shipped item or a
closed finding collapses to its date and a link**; what was decided, what was
rejected and what the review caught go to `docs/features/<slug>.md`; and **an
entry here never describes how the code works today**, because a claim about
current behaviour written here is the one that rots. It puts a number on the
last part — a 2026-08-13 sweep found 14 of 161 such claims stale — and dates the
consequence: on 2026-08-21 the file was 1,650 lines, half of them closed
records, and six of those became the feature files they should have had at land.

Twelve rows closed on this branch did not collapse. Their lengths: M17 17 lines,
M34 8, M35 5, M39 21, M47 17, M48 7, M49 22, M50 24, M51 10, M52 16, M53 22,
M54 24 — against M33's 2-line row beside them and the single-line M14–M16,
M18–M21 and M41–M46 rows above.

## What was found

**M85 — the rot is not hypothetical, and it had already happened three ways.**

_A row contradicting its own probe._ `8ac490c` moved `PAIR_SEED_TASKS` from 3 to
4, which changed every plan `optimizeSchedule` returns and therefore every rate
the censor arm walks. The probe header was re-read; the row was not. At the time
of this repair the two sat in one tree saying different things — 8.3–16.4%
against 7.8–16.2%, 118/110/88/23 against 119/111/88/23, 8 of 1,811 against 8 of
1,809, 339 + 76 against 341 + 76 — and, on the residual the row's headline
rests on, the probe now reads that the inverted cell at the stop moment is
**empty in all eight rows** where the row asserts 8 of 20. One date, two live
texts.

_Two rows asserting two values for one measurement._ M47's row quoted
`C(n,2)` at 13.84× at 15 tasks (4,147 ms against 300) sixteen lines above M54's
"quadratic 14×–15×" for the same statistic. Each is a defensible dated reading
in its own spec and probe header — different arms, and the band was re-read
under the wall-clock rule the same branch landed — but only this file put them
side by side as one live fact.

_A `file:line` citation that went stale inside its own branch._ AGENTS.md §0's
last bullet says to cite a document by section, never by line, because a line
address is stale the next time anything is inserted above it, and silently. M52's
row cited `docs/testing.md:302`. At `a7a9bd2`, where the row was written, line
302 was "MATH.md now holds derivations only (R7) and the dating rule is gone with
them". At the time of this repair that sentence is line 321 and line 302 is a
different rule's worked example. Four days, one branch.

**Four claims inside the rows were also wrong**, and each is closed here because
the collapse deletes rather than corrects it.

**M86 — a quotation attributed to a section that never held it.** M17's row read
`§8.11's "agree to four decimals" holds on every uncensored timed cell`.
`grep -n "four decimal" MATH.md` returns nothing; §8.11's only appending
sentence is "Appending does not measurably help." The phrase was §8.11's before
the 2026-08-25 cut and survives in the frozen record
[`the-insertion-witness-re-read`](the-insertion-witness-re-read.md). The
measured substance is true, and M17's own spec states it correctly — only the
row put a deleted section's words in quotation marks in the present tense.

**M87 — a control read as 265 named knees.** M34's row read "on the other 265 it
names the shipped knee". `curve-shape.probe.ts` sets `agrees` when
`sentinel === curve.recommendedHours`, and both sides are `null` at the top of
the lattice, so an agreement on **no knee** counts. A recount of the same 480
cells gives 215 flat and 265 non-flat, of which 96 carry a knee and 169 are that
null-against-null. The agreement is also forced off the flat branch — the
probe's own comment says "everywhere else the two must agree" — and its printed
line claims only agreement, not named knees. The commit's conclusion survives
untouched: an independent level-by-level comparison found 0 of 480 differences.

**M88 — a completeness claim that was false when made.** M52's row said that
grepping `WITH ITS DATE` — "the phrase re-wrapping cannot hide" — "finds all
34". Enumerating all 64 probe files at `a7a9bd2^` gives 34 carrying
`WITH ITS DATE` and one more, `sat-gate-floor`, carrying `WITH THEIR DATE`: the
union is **35**, and no file carries both. M53 caught the 35th 41 minutes later
and filed it as an M52 survivor, which is the same fact from the other side.

**M89 — a scan described as something it was not.** M53's row said "scanning
every `MATH.md` occurrence not followed by a `§` finds 54 in 24 files". Neither
half of that describes the filter that reproduces the figure. At `f19dcad^`,
**lines** mentioning `MATH.md` with no `§` anywhere on them number 54 in 24
files in `scripts/*.probe.ts` — an exact match — while **occurrences** not
followed by a `§` in the same files number 55 in 25, and the same line filter
over every tracked `.ts`/`.mjs`/`.js`/`.svelte` gives 83 lines in 41 files. The
number was right for a statistic the sentence did not describe, and the
difference is exactly the population the sweep did not scan.

**M90** is the M47/M54 contradiction above, filed separately because it is the
only one of the four that is two rows disagreeing rather than one row being
wrong.

## What was repaired

All twelve rows collapse to the one-line form the preamble prescribes and
M41–M46 already use: **1,016 lines → 811**. Every disposition survives — M17
"not fixed", M54 "DECIDED FOR", M49/M50/M51 "raised and closed … by …", M52
"raised and closed … while closing M17", M39's intermediate "half-closed
2026-08-19", and M34's 2026-08-26 rather than -27.

Nothing measured is lost, checked claim by claim against each linked spec: M17's
gap and 79%, M34's 215/265 ladder, M39's rates and witness, M47's six sites and
1.28×–2.40×, M48's 1,210 combinations and 5.001e-5 against 5.561e-5, M49's eight
at-stop rows, M50's 9 + 113 sites, M51's four claims, M52's 32-against-34 census,
M53's four re-run headers, M54's five-seed table and funded sets. Two sentences
existed only in a row, and both are recoverable: M39's "mid-day false stops under
1% at every λ₀" from its spec's own table, and M54's absolute-ms and ratio bands
from `energy-search-gap.probe.ts`'s header and from `docs/testing.md`'s
"A wall clock is a range, not a figure" worked example.

The collapse also deletes, rather than preserving, the present-tense claims about
the current tree that every one of the twelve rows carried — "neither figure
survives as live text", "no product caller sets either", "all three arms still
pass", "`PAIR_SEED_TASKS` is 4". The preamble forbids those outright, and three
had already been overtaken: M35's "the probe's off-default constants are now
declared there instead" was one short (M82), M50's "M44 aligned eight of the
nine" credited two commits' work to M44 (M81), and M17's "This entry's
prescription stays wrong" is a verdict, not a record.

## What was deliberately not done

- **M40's row stays at 25 lines.** Same shape, but dated 2026-08-25 and landed
  before this branch, so it is outside the diff that found this. Its five
  generators and its "every figure moved and no verdict did" belong to a
  different sweep's record.
- **No lint script counts row length.** `brief-size.mjs` holds `AGENTS.md`
  because that file has a ceiling worth defending mechanically; a ledger row's
  length is a judgement about whether a claim belongs in a spec, and a checker
  that counted lines would pass a two-line row asserting a stale figure.
- **The three frozen specs keep the claims M87, M88 and M89 correct.**
  [`the-seeding-the-probe-never-re-ran`](the-seeding-the-probe-never-re-ran.md)
  says "on the other 265 days it names the shipped knee exactly, 265/265, so the
  seeding buys nothing anywhere else";
  [`the-rule-that-outlived-its-document`](the-rule-that-outlived-its-document.md)
  says `WITH ITS DATE` "finds all 34" and reads `e61d207`'s 44 `scripts/` files
  as a total where the commit touched 143; and
  [`the-references-the-checker-could-not-see`](the-references-the-checker-could-not-see.md)
  carries the same scan description as M89's row. They are dated records of what
  was believed that day and are not edited. This file is the correction.
- **M39's disposition was not rewritten as DECIDED AGAINST**, which its spec's
  `model` kind would support. The row's literal disposition is kept rather than
  improved: a collapse that re-decides what it collapses is not a collapse.

## Where it landed

- `ROADMAP.md` — twelve rows, 1,016 lines to 811
