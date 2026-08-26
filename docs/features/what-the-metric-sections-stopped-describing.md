# What the metric sections stopped describing

**Kind:** repair · **Status:** landed 2026-08-18 · **Roadmap:** item 31, findings M18, M19, M20,
M21

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Close the four item-31 leads about the metric layer: two counts that have rotted
(§28, §31), two sections cited from nowhere in `src/` (§28, §32), and §16's
consumer count in code. Nothing the user sees changes and no shipped behaviour
moves.

**Four leads, one shape.** The metric layer's decisions live in `MATH.md` and are
cited from nowhere in `src/`, and the one `MATH.md` paragraph that _is_ specific
about code describes a `total` prop that 8babd94 deleted on 2026-08-12. A section
that names a prop is a section that goes stale the first time the prop moves; a
section that names a decision does not.

## Scenarios

- **§28 / §31 — the count.** `metric-descriptor.ts` ships 24 `label:` rows and 4
  `headline: true` flags. §28's "Twenty-three readings, four tiles. The other
  nineteen…" and §31's "Twenty-three readings exist for today" both become
  twenty-four / twenty. Capacity Left (§35, commit 0519c17) is the 24th, and it
  is a reference row — so §28's four tiles, its four-part test and its three
  demoted readings are all still what shipped.
- **§28 / §32 — the citations.** `metric-descriptor.ts`'s docblock paraphrases
  §28's four-headline decision including the Fallow Gain exclusion, and its
  `funded` gate is §32 defect 1 in prose; both now name the section.
  `quadrant-distribution.svelte`'s denominator comment is §32 defect 2's site
  today and cites `(§32)` beside the `(MATH.md §29)` it already carried.
- **§32 — the stale paragraph.** Defect 2's fix paragraph and the "Pinned in the
  suite" line both describe a caller passing `total`. That prop is gone. Both are
  rewritten to the shipped arrangement: the component derives the bar's 100% from
  the `counts` it already receives.
- **§16 — the consumer count.** `calculateInterleavedOrder`'s docstring said
  three consumers; there are four (`daily-metrics.ts:136`, `calculation.ts:612`,
  `remaining-day.ts:167`, `energy-lab-store.svelte.ts:373`).

One suite pin: `metric-descriptor.test.ts`'s empty-day test asserts
`toHaveLength(24)` and four headlines, so a 25th reading fails the suite and
forces §28 and §31 to move in the same commit.

## Out of scope

- **`MATH.md` §16 itself.** be1bc26 corrected it to four consumers earlier today;
  only the code docstring was behind.
- **Any shipped-code change.** Every formula, constant, bound and fit is
  untouched. The `src/` edits are comments, one docblock and one test.
- **The two premise "corrections" the audit prescribed for M19 and M20.** Both
  leads said _missing citations_; the audit read them as claiming the sections
  themselves were missing. The leads were right as written and are left as
  written.

## Read before building

- `ROADMAP.md` item 31 and its findings section — the list is a reading and not a
  measurement.
- `MATH.md` §28, §31, §32 — the decisions the metric layer implements, and the
  only place they are stated.

## Decisions

- **`metrics-dashboard.svelte` drops its literals rather than bumping them.**
  "23 equal rows is a spreadsheet" → "Every reading at equal weight is a
  spreadsheet", and "19 rows of equal weight" → "the rest at equal weight". This
  count has now rotted twice, and the component cannot know how many rows it is
  handed — it filters an array it is given. A numeral there is a claim it has no
  way to check, which is the argument for pinning the count once in the suite
  instead of writing it in three files.
- **`metric/history.ts:241-243` is declined out loud.** M20 asked for §32 on
  `countQuadrants`'s bare `(§29)`. §32's own defect-2 paragraph opens
  "`countQuadrants` skips a day whose quadrant is `null`, which is §29's rule
  working correctly" — so the bare `(§29)` is the citation `MATH.md` blesses.
  The bar-sizing decision is not made in `history.ts` at all; since 8babd94 it is
  made in `quadrant-distribution.svelte`, and that is where the `(§32)` went.
- **The docblock is where `metric-descriptor.ts` puts sections.** §28 is cited
  once, on the paragraph that paraphrases it. The four `headline: true` flags stay
  uncited: repeating the section four times restates it rather than locating it.
- **§32's defect description is kept verbatim, only its fix paragraph moves.**
  The `countQuadrants` / `total={summaries.length}` paragraph is history and is
  accurate history; the paragraph after it claimed a live arrangement that no
  longer ships.

## What execution turned up

- **M18's count had rotted twice, not once.** The lead reads as a one-time
  numeral bump. §28 and §31 were both written against a 23-row descriptor, and
  0519c17 made it 24 six days before the audit — with `metrics-dashboard.svelte`
  carrying the same two numerals independently. Four places, one fact, no check.
  That is what turned a numeral bump into a suite pin.
- **§32 was stale in a way the lead never mentioned.** M20 was filed as
  citation-only. Opening the section showed its fix paragraph and its "Pinned in
  the suite" line both describing a `total` prop deleted ten days earlier by a
  refactor whose own commit message says the bar's 100% is the counts it draws.
  `quadrant-distribution.stories.svelte:29-33` already said the post-refactor
  thing; `MATH.md` did not. Same failure mode as the counts: the section named a
  mechanism instead of a decision.

## Open questions

- **Nothing pins a `MATH.md` count to the thing it counts.** The suite now fails
  when the descriptor grows, which is a signal that _something_ must change — but
  it names the test, not §28 and §31. A reader who bumps the fixture and stops has
  left the sections wrong again.
