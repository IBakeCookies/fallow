# The citations the section sign hid

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** findings M71–M74

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

M53 swept probe headers for stale MATH.md attributions and landed the rule that
explains why they rot: `math-citations.mjs` resolves `§N` to a heading, never to
what that heading still says, so a header saying "MATH.md claims X" outlives the
section it quotes and nothing sees it.

M53's own sweep could not see the worst instances of that. **Its population was
lines carrying `MATH.md` with no `§` anywhere on them.** A line with a NUMBERED
citation is excluded by construction — and a numbered citation is exactly the
kind the checker also passes, because the heading it names does exist. So the
sites the new rule describes most precisely were the ones the sweep was
structurally blind to.

## What was found

**Five survivors, each verified against MATH.md before anything was deleted.**
All five cite a section that exists; none of them says what that section says.
`math-citations.mjs --check` passes on all five, before and after.

- **`stop-inversion-margin.probe.ts`** — the decomposition arm's docblock
  asserted, in the present tense, that "the difference between the two is the
  '~+0.1' bias §8.10 claims". §8.10's loose-max bullet says only that it
  "biases midpoints up", with no figure; `grep '+0\.1' MATH.md` returns nothing.
  Worse, `STOP_INVERSION_MARGIN`'s own docblock in `zenith-energy.ts` records
  that decomposition as **measured wrong** — bias median 0.000 / mean 0.019,
  half-width median 0.125, summing to 0.125 and not to 0.25 — so the probe
  header asserted as a live claim the figure the shipped constant records as
  retracted. The same commit deleted "(MATH.md said ~+0.1 until 2026-08-06)"
  from this file's run log three printed lines away.
- **`pool-allocator.probe.ts`** — the sweep's docblock defined its `over2`
  counter as "§4:276's stated 'within 1–2%' being exceeded". `grep '1–2%'` and
  `grep 'brute-force block optima'` in MATH.md both return nothing, and
  MATH.md line 276 is inside §3 (the priority score), not §4. It is also a
  `file:line` citation, which AGENTS.md §0's last bullet forbids outright. The
  same commit had already deleted that phrase from this file's header, twenty
  lines up.
- **`stp-lattice.probe.ts`** — the header attributed five lettered figure
  groups to "MATH.md §8.8's 45-minute-lattice numbers". §8.8, read in full,
  carries no number beyond the lattice constants themselves. Three `it` titles
  then cited the letters back as "MATH.md §8.8 a/b/e", "§8.8 c" and "§8.8 d",
  naming items §8.8 does not have. All five groups were stale as well — see
  below.
- **`alloc-epsilon-methodology.probe.ts`** — "§4 quotes that lesson as
  '98/2400 non-exact, worst 49.72%'". §4's closing methodological note is real
  and keeps its citation; it carries no figure at all. `grep 49.72` and
  `grep 2400` in MATH.md return nothing.
- **`scripts/generate-fixture.mjs`** — "(MATH.md turns on real logs for exactly
  that reason)". `grep -i 'real logs' MATH.md` returns nothing; the sentence is
  ROADMAP.md's own paragraph about this script, and its §17 is a section MATH.md
  no longer has (its headings run §0–§9). This one carries no section sign, so
  it WAS in the 54-line population, and the commit did edit this file — twelve
  lines below it. A miss inside the population rather than outside it.

**A sixth, found on the way and the same shape.** `moodVariants`' docblock in
`stop-inversion-margin.probe.ts` said the ±1-lattice-step variants are "§8.10's
own phrase for a near-rational day, and the population the doc claims never
inverts". §8.10 uses "mood" once, as a component of σ₀ that no instrument
separates, and claims nothing about whether such days invert — and this probe's
own arm measures 47 of 926 mood days inverting. It now points at the header's
claim 2, where that claim is quoted as one of the three the probe exists to
answer.

## What was measured

Two wall-clock arms that the band rule
([docs/testing.md](../testing.md), "A wall clock is a range, not a figure")
governs and M53 did not reach. Both quoted single three-significant-digit
figures with no spread; neither printed reps or a half-range at all. Both now
compute a median over reps WITH the extremes it came from, and both were read
three times on one box.

**`fit-snapshot-drift.probe.ts`, the cost arm.** Not one of the six figures it
quoted reproduced:

| reading                   | header said | run 1     | run 2      | run 3     | quoted now |
| ------------------------- | ----------- | --------- | ---------- | --------- | ---------- |
| one whole-history fit, 1× | 18.6 ms     | 18.1 ±26% | 23.1 ±13%  | 19.6 ±17% | 18–23 ms   |
| 30-day per-day refit, 1×  | 500.1 ms    | 522.6 ±2% | 594.0 ±12% | 551.7 ±5% | 523–594 ms |
| per audited day, 1×       | 16.7 ms     | 17.4      | 19.8       | 18.4      | 17–20 ms   |
| that as ×the single fit   | 0.89×       | 0.96      | 0.86       | 0.94      | see below  |
| per audited day, 2×       | 33.8 ms     | 35.1      | 36.8       | 40.2      | 35–40 ms   |
| per audited day, 4×       | 73.6 ms     | 78.1      | 75.9       | 77.3      | 76–78 ms   |

The ratio is the figure the header told the reader to trust **instead** of the
milliseconds, and it is the least reproducible cell on the arm: across three
runs and three volumes it reads **0.81×–1.09×**, ±14% around its own centre,
where the 4× per-day cell holds to ±1.4%. The conclusion survives the whole
band — 0.81–1.09 is "one whole-history fit per audited day", which is what
O(auditDays × totalLogVolume) predicts — so the argument stands and only the
figures were wrong. The header now says that in the band's own words.

The drift arm is deterministic and reproduced byte-for-byte on all three runs
(day-10 fit 0.3447 against a whole-history 0.5240, 52% apart; 0.5075 → 0.5240
inside the audit window, 3.3%; 1% on a flat year). It is unchanged.

**`stp-lattice.probe.ts`, the speed arm.** Its mean-of-5 became a median with
its half-range:

| reading            | header said | run 1      | run 2      | run 3      | quoted now |
| ------------------ | ----------- | ---------- | ---------- | ---------- | ---------- |
| coarse, 3-task/8 h | ~55 ms      | 30.5 ±4%   | 28.4 ±2%   | 34.7 ±2%   | ~30 ms     |
| fine, same day     | ~330 ms     | 1252.8 ±8% | 1233.4 ±3% | 1346.2 ±7% | ~1.3 s     |
| fine ÷ coarse      | (unstated)  | 41.1×      | 43.5×      | 38.8×      | 39×–44×    |

The fine lattice is four times slower than the header's figure, in the
direction §8.6's pair seeds predict — the suite's own note on the matching
fixture records it going 813 ms → 1970 ms when they landed.

**And the four figures on that header that are not wall clocks were stale too**,
which is why the whole header was rewritten from the run rather than
de-attributed:

- the objective ratio was quoted as "0.9865 / 0.9979 / 0.9936 / 0.9886"; the
  sweep's floors are **0.9693** (3-task day at 4 h) and **0.9759** (mixed day
  at 12 h), and it is 1.0000 on both days at 6 h;
- the funded-set match was quoted as "all four cases" with an exception —
  "the probe day's coarse and fine funded sets diverge at 8 h" — that the
  suite's own comment contradicts. It matches in **all 12 cells**, both days,
  every window;
- the enumeration was quoted as "equals the search's 10.7331 exactly". The
  agreement holds and the value does not: 1,048,576 lattice plans, best
  **10.6274**, search 10.6274, gap 0;
- the rest confetti was quoted as "five 0.25 h rests across 12 h … at ~1%
  objective cost". Five is the **mixed** day at 12 h (the 3-task day gets
  three), and the cost is **2.4% / 1.9%**.

**`phi-error-price.probe.ts` (M73).** Its header retained the deleted
document's caption verbatim and in quotation marks — "Value lost to a per-task
ϕ error of size `s` (400 days, ΣT\* = 19.4 h, mean % below the oracle plan)" —
two figures standing in a header as a quotation from a document that no longer
exists. The probe re-derives its own ΣT\* from `findOptimalSingleTaskTime` over
the same 400 seeded days and prints **18.6 h**, so the retained figure was 4%
off a reading standing beside it. M53's repair of this file rewrote the run
log's "(MATH.md's grid says 19.4h)" to "(the original grid said 19.4h)", which
kept both the figure and the archaeology and only anonymised the claimant.
Both are now gone: the header quotes 18.6 h as its own reading, and the log
line prints its own ΣT\* with nothing to compare it against.

**A false claim in a frozen record.**
[`the-references-the-checker-could-not-see`](the-references-the-checker-could-not-see.md)
says, under "What was deliberately not done": _"Only the four above had the
deleted document's figures standing IN their headers."_ That is false —
`phi-error-price.probe.ts` is a fifth, and it carried two of them. That file is
frozen at land, so the correction is recorded here and in the ROADMAP row, not
in it.

**M53's describing sentence (M74).** M53's row said the scan was "every
`MATH.md` occurrence not followed by a `§`" and quoted 54 in 24 files. Those are
two different statistics. Reproduced at `f19dcad^` with a classifier over
`git ls-tree`:

| statistic                                      | `scripts/*.probe.ts` | every tracked `.ts/.mjs/.js/.svelte` |
| ---------------------------------------------- | -------------------- | ------------------------------------ |
| lines containing `MATH.md` with no `§` on them | **54 in 24**         | 83 in 41                             |
| occurrences of `MATH.md` not followed by a `§` | 55 in 25             | 90 in 43                             |

54/24 is the top-left cell exactly. The prose describes the bottom row, and
does not say the scan was probe-only. Both differences matter here: the line
filter is what hid the five numbered sites, and "probe files only" is what left
the same fault standing in `eslint.config.js`.

## What was deliberately not done

- **No checker, again.** M53 already argued this and the argument did not
  change: a regex over quoting verbs fires on the legitimate references and
  misses a paraphrase, and resolving a citation to what its section still
  _says_ is the thing no regex does. What the two sweeps have produced instead
  is a rule and two worked examples of it.
- **No repair of `eslint.config.js`.** Its "the scheduler's loops are nested the
  way MATH.md specifies them" is the same population — an unnumbered MATH.md
  attribution, invisible to the checker — and §4 makes it a defensible
  paraphrase rather than a false statement. It was reported for its owner to
  cut, because the sentence below it carries the exemption's whole
  justification and the attribution earns nothing.
- **`pool-allocator` and `stop-inversion-margin` were not re-run.** Their edits
  are comment-only and neither header quotes a figure this change touched.
  `stp-lattice`, `fit-snapshot-drift` (three runs each) and `phi-error-price`
  and `alloc-epsilon-methodology` (once each) were.
- **`alloc-epsilon-methodology`'s header was not given the probe's own
  figures.** Deleting the false attribution was the whole repair; the run
  prints 158 of 2400 cases non-exact under the hour rule, worst gap 49.3341%,
  all 158 inadmissible under the block rule, which is the note's point and
  needs no header copy of it.

## Where it landed

- `scripts/stop-inversion-margin.probe.ts` — the §8.10 "~+0.1" assertion and
  the `moodVariants` attribution, both deleted
- `scripts/pool-allocator.probe.ts` — the `§4:276` line citation deleted;
  `over2`/`over009` now say what they count
- `scripts/alloc-epsilon-methodology.probe.ts` — the "§4 quotes that lesson as"
  sentence and its two figures deleted; §4's real methodological note keeps its
  citation
- `scripts/generate-fixture.mjs` — the "MATH.md turns on real logs" parenthetical
  deleted
- `scripts/stp-lattice.probe.ts` — header rewritten from its own run, a
  median-with-half-range timing helper in place of a bare mean of 5, and the
  three `it` titles that cited lettered items of §8.8
- `scripts/fit-snapshot-drift.probe.ts` — the cost arm's `timeIt` returns a band
  and prints it; the header's six wall clocks replaced by the bands three runs
  read
- `scripts/phi-error-price.probe.ts` — the retained caption replaced by the
  probe's own ΣT\*, and "the original grid said 19.4h" out of the run log
- `ROADMAP.md`, `docs/features/the-citations-the-section-sign-hid.md`
