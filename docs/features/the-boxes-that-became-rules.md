# The boxes that became rules

**Status:** landed 2026-08-22 · **Roadmap:** item `none`

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

`/`'s readings card stops drawing boxes and draws rules. The four headline
readings lose their bordered tiles — `rounded-xl border border-line-soft
px-box-sm py-box-xs` — and become bare, each marked by a 2px rule down its left
in its own band colour, four across the card at `lg` instead of two-by-two. The
rule is the reading a user takes without reading a number: an amber or red edge
says which of the four is out of the ordinary. The value grows from `text-lg
font-semibold` to `text-2xl font-medium` and gains `tabular-nums`.

The twenty reference readings behind **20 more metrics** stop being one stacked
list of hover-highlighted rounded rows and become a dense multi-column block:
`columns-1 gap-grid-lg sm:columns-2 lg:columns-4`, each row a label and a
right-aligned `tabular-nums` value over a `border-b border-line-soft`, with
`break-inside-avoid` so no row is split down a column edge. The whole reference
set is then one screenful instead of twenty scrolled lines.

Drawn 2026-08-21 as [docs/redesign/Main.dc.html](../redesign/Main.dc.html), item
4 of [docs/redesign/README.md](../redesign/README.md) ("**The twenty
non-headline readings** become a dense four-column grid instead of an
accordion"). The disclosure the artboards drop is kept — see **Decisions**.

## Scenarios

Written after the fact: the restyle shipped inside another change (see
**Decisions**), so this section records what the suite already covers and, where
it covers nothing, says so instead of naming a test that does not.

### Scenario — a headline reading is on screen without opening anything

`e2e/time-budget.e2e.ts:12-26` — covers it, and was written for exactly this
property ("it is one of the four headline tiles, so it is on screen without
opening anything").

- **Given** today, a fresh profile, one task, an 8 h budget
- **When** the page loads
- **Then** Human Capacity's reading matches `/^\d+%$/` and is visible

### Scenario — the reference block holds only what is not already a tile

`src/lib/presentation/component/metrics-dashboard.stories.svelte:82-103`
("Upward momentum") — covers it.

- **Given** eight metrics, four of them `headline`
- **When** `4 more metrics` is clicked
- **Then** `Yield Index` is visible
- **Then** `82%` is visible
- **Then** `Fallow Gain` is visible

### Scenario — a card whose every reading is a headline has no reference block

`src/lib/presentation/component/metrics-dashboard.stories.svelte:145-154`
("Headlines only") — covers the observable, more weakly than it did. It asserted
`canvasElement.querySelector('details')` was `null`; it now asserts
`canvas.queryByText('Yield Index')` is `null`. A card that rendered an empty
`<details>` would pass the new form.

- **Given** only the four `headline` metrics
- **When** the card renders
- **Then** no reference label is in the document

### Scenario — a closed disclosure still serves its readings

`e2e/tasks.e2e.ts:329-372` ("capacity left reads N/A until a session is rated,
then names what is spent") — covers it incidentally: `Capacity Left` is a
reference reading and the test reads it with `toContainText`, never opening the
disclosure, so it passes only while a closed `<details>` keeps its rows in the
DOM.

- **Given** today, one task, a 6 h budget
- **When** the page loads
- **Then** the `Capacity Left` row contains `N/A`

### Gap — nothing asserts the band rule on a tile

`BAND_BORDER_CLASS` has no test. No story or e2e reads `border-l-2` or any
`border-*` band token, so a tile losing its rule, or `neutral` acquiring a hue
the table forbids, fails nothing. The accessible half of the same reading **is**
pinned — `metrics-dashboard.stories.svelte:93-94`'s `getByText('(Critical)')`
and `querySelectorAll('.sr-only')` length of 5 are the band words a screen
reader hears, and they are unchanged by this
restyle.

### Gap — nothing asserts four-across, or four columns

No test reads `lg:grid-cols-4` or `lg:columns-4`, and none measures the card at a
width. Two page-wide pins constrain the block by accident rather than by design,
both at 390×900 with the card on the page: `e2e/tasks.e2e.ts:262-323`
(`document.body.scrollWidth - window.innerWidth <= 0`, at `:306-307`) and
`e2e/tasks.e2e.ts:379-413` (`documentElement.scrollWidth` equals its
`clientWidth`). They are what keep `columns-1` at the base width honest; neither
would notice a wrong column count above `sm`.

### Gap — the disclosure's closed default is no longer pinned anywhere

`metrics-dashboard.stories.svelte` asserted `querySelector('details')!.open` was
`false` and that `82%` was `not.toBeVisible()`; this change deleted both rather
than porting them. `docs/redesign/canvas.json:50` still states the default in
prose ("its real default is closed"). Nothing executable does.

## Out of scope

- **The artboards' "binding constraint" panel.** Item 3 of
  `docs/redesign/README.md` — promoting what `plan-advice-card.svelte` already
  computes (MATH.md §14) out of small grey text. It did not ship: outside
  `docs/redesign/` and one out-of-scope line in
  [the-row-that-became-a-table](the-row-that-became-a-table.md), the phrase
  appears nowhere in `src/`. Both artboard items sat in the same out-of-scope
  sentence; only this one came with it.
- **Instrument Sans / IBM Plex Mono.** Item 5 of the same file did not ship
  either: `src/lib/presentation/style/tokens.css:69` still sets `--font-sans` to
  `'Inter Variable'`. The `tabular-nums` half of that item **is** in
  this change, on the tile values and the reference values, for the reason it
  was in the ledger's: a column of numbers that cannot be compared down its own
  length is not worth putting in a column.
- **Dropping the disclosure.** The artboards draw the twenty always open under a
  "The other twenty" kicker. The `<details>` stays — see **Decisions**.
- **The artboards' third line per tile.** Each drawn tile carries a caption
  under its value ("cognitive pool binds first", "only #1 runs long enough").
  `Metric` has `label`, `value`, `description` and `band`, and `description` is
  already the tooltip; a second sentence per tile is a new descriptor field and
  new copy in five locales.
- **Which four readings are headlines.** MATH.md §28's four-part test, its four
  tiles and its three demoted readings are untouched. This change restyles the
  four; it does not re-pick them.
- **Any band threshold, gate or formula.** `AXIS_BAND`, `getBandBiggerBetter`,
  `gated` and every value in `metric-descriptor.ts` are unchanged. No reading
  moved, so no MATH.md section moved.
- **Re-grouping the twenty into named families.** `Metric.section` is deleted,
  not replaced — see **Decisions** for what that cost.
- **The `Capacity Left` / `Human Capacity` overlap.**
  [the-header-that-only-held-a-title](the-header-that-only-held-a-title.md) put
  it out of scope as "a separate question about what the grid should read", and
  it still is: this change is layout, not the reading list.

## Read before building

- `src/lib/presentation/component/metrics-dashboard.svelte:55-72` — the tile
  block, and the comment stating why the rule exists ("the rule is what makes an
  out-of-the-ordinary reading findable without reading any of the numbers").
  `:74-103` is the reference block and the `columns`-not-a-grid comment, which
  is the one claim in the file this change makes false (**Decisions**).
- `src/lib/presentation/utils/band.ts:31-41` — `BAND_BORDER_CLASS` and its
  docblock's rule: `neutral` is `border-line-strong`, not a hue, because a rule
  that every tile carries in colour marks nothing.
- `src/lib/presentation/AGENTS.md:494-509` — "Metric color-band thresholds live
  in the presentation layer". It names `BAND_TEXT_CLASS` / `BAND_BAR_CLASS` as
  the tables a component looks a `Band` up in; `BAND_BORDER_CLASS` is the third
  and is not there yet.
- `src/lib/presentation/type/index.ts:8-17` — `Metric` after the deletion. Four
  required fields and one flag; `headline` is the only display marker left.
- `src/lib/presentation/utils/metric-descriptor.ts:10-15` — the docblock's
  four-headline paragraph, which cites MATH.md §28 and is still accurate.
- `src/lib/presentation/utils/metric-descriptor.test.ts:104-107` — the 24-row /
  4-headline count pin, which is what makes MATH.md §28's and §31's numerals
  fail loudly when the descriptor grows.
- `MATH.md:7369-7423` — §28, "Which four readings are headlines". Its opening
  ("Twenty-four readings, four tiles. The other twenty sit behind a disclosure")
  is still what ships. Its closing sentence is not — see **Decisions**.
- `src/lib/presentation/style/STYLE.md:146-154` — the "borderless panel nested
  inside a card" bullet, which already carries this change's rule as its third
  way out ("drop the fill … there is no second surface to separate").
- `src/routes/(app)/+page.svelte:269-274` — the full-width block the card now
  sits in, and the comment saying why. Four tiles across need it; at HEAD the
  card was the `lg:sticky lg:top-page` third of a `lg:grid-cols-3`.
- `docs/redesign/README.md:48-49` and `docs/redesign/canvas.json:50` — item 4,
  and the artboard note that the accordion is drawn open with its real default
  closed.
- `docs/testing.md:26-34` — the level table. A restyle with no behaviour change
  takes no new test by R6's own line ("renaming a token is not [a behaviour
  change], and takes none"), which is why the gaps above are recorded rather
  than filled.

## Decisions

- **This file exists because the restyle shipped inside another change's diff.**
  [the-row-that-became-a-table](the-row-that-became-a-table.md) listed it under
  Out of scope: "**The artboards' 'binding constraint' panel** (promoting
  `plan-advice-card`'s reading) and **the four-column metrics grid** (replacing
  the accordion). Both are on the same artboards; neither is this change." The
  grid shipped anyway, in the same working tree, once that change moved the
  metrics out of a one-third column and gave them the page's full width, which
  is the only place four tiles across fit. The code is kept and this file owns
  it, which is the precedent the day timeline set: it was the bullet immediately
  above this one in that same list, and then got its own spec,
  [the-plan-that-had-no-clock](the-plan-that-had-no-clock.md). Rejected:
  reverting the restyle to make the older file's scope line true again, which
  buys a correct record by throwing away shipped work; rejected: editing that
  file's out-of-scope list, which `docs/features/*` forbids once a file is dated
  — the cross-link runs one way, from here.
- **`Metric.section` is deleted, and the family seams go with it.** The flag
  drew a `border-t border-line-soft` above four of the twenty reference
  readings, splitting them into families of 6 / 3 / 2 / 2 / 7: the plan-quality
  group (Fallow Gain … Longest Warm-Up), the energy group (Cognitive Load,
  Physical Load, Energy Balance), Schedule Integrity with Friction Index, Deep
  Work with Quick Wins, and the density-and-averages tail from Grind Density on.
  Nothing replaces them, so the twenty now read as one undifferentiated set, and
  a reader cannot see where "how good is this plan" stops and "what kind of day
  is it" starts. Accepted because a four-column block has nowhere to put a
  full-width rule: a seam drawn inside one column is a rule between two rows that
  are not adjacent on screen. Rejected: a per-column heading, which needs the
  descriptor to name its five families in five locales — new copy for a change
  that was meant to be layout. No test noticed: nothing ever asserted a seam, so
  the deletion broke nothing and proved nothing.
- **Known follow-up: the component still claims the grouping survived.**
  `metrics-dashboard.svelte:76-77` reads "`columns` not a grid — filling down a
  column keeps the descriptor's grouping (energy readings together, and so on)
  intact." Half of that is true and half is not. Multi-column flow does fill
  down one column before starting the next, so the descriptor's order — and with
  it the adjacency of the energy readings — is preserved, which a row-first
  `grid` would have destroyed. But there is no grouping left to keep
  intact: the seams were `section`'s and `section` is gone in the same diff.
  Worse, the arithmetic forbids it — the four seams fell after readings 6, 9, 11
  and 13 of the twenty, and four columns of five break after 5, 10 and 15, so no
  column edge can land on a family edge. The comment is left as found; fixing
  it is a documentation change under AGENTS.md:74-79 and belongs to whoever
  touches the file next.
- **Known follow-up: MATH.md §28's closing sentence names a flag that no longer
  exists.** `MATH.md:7422-7423` — "One knock-on: `section` is a list-only
  marker, so Burnout Risk's promotion moved the energy group's separator to
  Cognitive Load." Accurate history of §28's own decision, false as a statement
  about the code. The rest of §28 — the four-part test, the four tiles, the three
  demoted readings, the twenty behind a disclosure — is unaffected, and no
  formula, constant, bound or fit moved, so R7 is not what is owed here;
  AGENTS.md §0's documentation clause is.
- **The disclosure stays, against the artboards.** The artboards show the twenty
  always open, and MATH.md §28's whole argument is that "the choice of four is
  the whole of what a returning user sees" — twenty readings on the page at
  equal weight is the spreadsheet the four tiles exist to escape, and the card
  already sits above the day strip and the ledger on a page that is long enough.
  What the artboards actually win is density once opened, and that is what
  shipped. Rejected: opening by default, which is the same thing with an extra
  click to undo it.
- **The rule replaces the border, not the fill.** A borderless bare tile inside
  a card is what STYLE.md's nested-panel rule permits as its third way out: no
  second surface, so nothing to separate, and no card-on-card compositing to go
  flat on an opaque theme. Rejected: keeping the border and colouring it by band
  on all four sides, which reads as an alert box on a card that holds four of
  them; rejected: `surface-inset` per tile, which is a second surface for a
  reading, not a panel.
- **The tile order stays the descriptor's.** Completion Rate, Flow Coverage,
  Human Capacity, Burnout Risk — the array order in `metric-descriptor.ts`. The
  artboards put Completion last. Rejected: matching the drawing, because the
  order would then be a display decision made in the component about rows it
  filters rather than owns, and MATH.md §28 lists the four in the descriptor's
  order when it names them.

## Open questions

- **Do the twenty want their families back, and in what form?** The seams are
  gone and nothing replaces them. A four-column block cannot carry a full-width
  rule, so the answer is either per-column headings (new copy in five locales,
  and a descriptor that names its families) or nothing. Left open rather than
  decided: it is a copy-and-information-design question, not a layout one.
