# The sentence the narrow block drops

**Status:** landed 2026-08-22 · **Roadmap:** item `none`

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

The day strip stops scrolling on days it has no reason to.
[the-plan-that-had-no-clock.md](the-plan-that-had-no-clock.md) gave the strip a
floor and let its track grow past the card so the shortest allocation stays
legible. The floor it took was the width of the widest line a block stacks —
the flow sentence — so **every** block was held as wide as its wordiest line,
and a phone scrolled the strip on almost any day.

A block now decides for itself what it has room to print. Above
`--container-day-flow` it keeps the sentence; below it, it drops the sentence
from the screen and keeps the two lines the ledger cannot replace — the run
position and the duration — plus the flow bar. The floor falls to what those
need, which halves the track a crowded day scrolls.

## Scenarios

The acceptance criteria, and the R6 tests — written here _before_ the
implementation, so the implementer transcribes them rather than inventing them
after the fact ([docs/testing.md](../testing.md)).

One observable per line, no `and` — a line with a conjunction cannot come back
half-true. Every scenario names the file its test lands in, at the level
`docs/testing.md`'s table picks.

### Scenario — the narrowest block still reads its position and its hours

`src/lib/presentation/component/day-timeline.stories.svelte`

- **Given** twelve funded tasks in an 8 h day, the shortest a 15-minute
  allocation
- **When** the strip renders
- **Then** the shortest block measures at least 64px

### Scenario — a block too narrow for the sentence does not print it

`src/lib/presentation/component/day-timeline.stories.svelte`

The sentence is the one line carrying a duration the block did not print
elsewhere, so truncating it renders a number nothing computed — `short of flow
by 1h 4…` off `1h 45m`. Dropping the line is the honest failure.

- **Given** that same day, whose shortest block is 64px wide
- **When** the strip renders
- **Then** that block's flow sentence measures no more than 1px on screen

### Scenario — the sentence a block drops is still read aloud

`src/lib/presentation/component/day-timeline.stories.svelte`

- **Given** that same shortest block
- **When** the strip renders
- **Then** its flow sentence still reads `short of flow by 45m` in the document

### Scenario — a block with room keeps its sentence

`src/lib/presentation/component/day-timeline.stories.svelte`

- **Given** that same day, whose longest block is five times the shortest
- **When** the strip renders
- **Then** that block's flow sentence measures more than 100px on screen

### Scenario — the bars read against each other across the strip

`src/lib/presentation/component/day-timeline.stories.svelte`

The bar is the comparative reading, so it cannot sit at a different height on
the blocks that dropped a line than on the blocks that kept one.

- **Given** that same day, holding blocks on both sides of the threshold
- **When** the strip renders
- **Then** the shortest block's bar and the longest block's bar share one top
  edge

### Claim — the floor never costs the strip its scale

`src/lib/presentation/component/day-timeline.stories.svelte`

Already pinned by
[the-plan-that-had-no-clock.md](the-plan-that-had-no-clock.md) and restated
here because lowering the floor is the change most likely to break it: the
floor scales the **track**, so a block's width stays its share of the day at
any floor.

- **Given** a 1.25 h block and a 0.25 h block in the same day
- **Then** the first measures five times the second

## Out of scope

- **The strip's own scroll.** It stays, and stays the answer for a genuinely
  lopsided day: no design that keeps a block's width proportional can render 3%
  of a day legibly inside a card. This change moves the width at which the
  scroll starts; it does not remove it.
- **A compact spelling of the sentence.** `−45m` in place of `short of flow by
45m` would keep a visible reading at 64px, at the cost of a sixth message key
  per locale for a line the ledger already prints in full.
- **The empty tail of an underfunded day.** The floor is counted against
  `availableHours`, so a day that funds 3 h of 8 h scales its track against the
  whole 8 h and most of it is empty. That emptiness is the unfunded-hours
  reading; scaling against the funded span instead would delete it.

## Read before building

- `src/lib/presentation/component/day-timeline.svelte` — the block markup, and
  the `max(100%, …)` track the floor feeds
- `src/lib/presentation/utils/day-timeline.ts` — `minimumBlockWidths`, the
  floor count the track multiplies; unchanged by this work
- `src/lib/presentation/style/base.css` — `--spacer-day-block`, the floor
- `src/lib/presentation/style/tokens.css` — `--container-day-flow`, and the
  `@theme inline` header on why a token here cannot name another token
- `src/lib/presentation/style/STYLE.md` — the rule that a repeated class
  cluster becomes a `@utility`, which is why one variant on one element is the
  whole change
- `src/lib/presentation/utils/ledger-column.ts` — `Flow at` and `Planned`, the
  columns that make the dropped sentence recoverable

## Decisions

- **The block queries its own width, not the day's shape.** A container query
  reads what the block actually got, which is the only quantity that decides
  whether a line fits. Rejected: deriving it in `buildDayTimeline` from
  `hours / shortest` — exact in the overflowing case and a **lower bound** in
  the fitting one, so it would hide the sentence on blocks that had room, which
  is the common case and the one worth protecting.
- **The threshold is a literal in `@theme inline`, not a `--spacer-*`
  reference.** A custom property is not valid inside an `@container` condition,
  and `@theme inline` substitutes a token's text rather than emitting `var()`,
  so `var(--spacer-day-flow)` would land verbatim in the condition and be
  discarded. `--container-layout` is the standing precedent for a literal in
  this namespace.
- **The threshold is measured on the content box.** An `inline-size` query
  reads the content box, so the block's 14px inset is already outside the
  number — the floor and the threshold are therefore measured against different
  boxes, which is why they are 64px and 136px rather than one figure and an
  offset. Both were read off a run: the app at 1440×900, Inter Variable at
  `--text-2xs`, each line cloned to `width: max-content` and measured.
- **A block drops the sentence rather than truncating it.** `short of flow by
1h 45m` clipped to the width of a 64px block reads `short of flow by 1h 4…` —
  a duration the optimizer never produced, printed by the one layer that is
  supposed to only display readings. Rejected: `title` tooltips to recover it,
  which do not exist on touch; rejected: leaving the truncation, which is what
  the change is about.
- **Dropped on screen, kept for a screen reader.** The constraint is horizontal
  space, which is not a constraint assistive technology has, so `sr-only` is
  the honest variant and `hidden` is not. That the sentence is also the ledger's
  `Flow at` column two cards down is what makes the visual loss recoverable
  rather than absolute.
- **The bar is pinned to the block's floor with `mt-auto`.** With the sentence
  conditional, `justify-between` distributed three children on some blocks and
  four on others, so the bars stepped up and down across the strip — and the
  bar is what blocks are compared on. Rejected: reserving the sentence's row
  with `invisible`, which keeps the geometry but takes the sentence out of the
  accessibility tree for a purely visual reason.
- **Wrapping, grouping and a vertical Gantt were all rejected before the
  scroll.** Wrapping the track breaks the left-to-right reading the start
  offsets are drawn against. Collapsing the short tail into one `+4 more` block
  deletes exactly the blocks the strip exists to diagnose, since an allocation
  short of flow is by construction a short one. A row-per-task Gantt reads
  well and duplicates the shape of the ledger sitting directly above it. And
  clamping each block's width while letting the widths sum past 100% would
  print positions no optimizer computed.

## Open questions

None.
