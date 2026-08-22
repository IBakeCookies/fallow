# Root-page redesign — artboards

A dark redesign of the root page (`src/routes/(app)/+page.svelte`), drawn
2026-08-21. Its first section — the ledger — shipped the same day
([docs/features/the-row-that-became-a-table.md](../features/the-row-that-became-a-table.md)),
and so did the chrome (item 6 below); the rest of the layout is not wired to the
app, and these stay static artboards.
Its palette is: `Main.dc.html`'s `:root` ships as the `fallow-dark` theme
(catalogue in `business/model/theme.ts`, palette in `presentation/style/themes.css`).

Published canvas: https://claude.ai/code/artifact/cd3a737b-cd23-48b9-aa17-572ff4e6a06c

## The files

Each `.dc.html` is one artboard — a standalone HTML page, 1440px wide, opens in
a browser on its own. `canvas.json` is only the layout manifest (positions,
pages) for the published canvas; it carries no design.

| file                                  | what it is                                            |
| ------------------------------------- | ----------------------------------------------------- |
| `Main.dc.html`                        | the redesign, dark                                    |
| `Light.dc.html`                       | the same design on a paper palette                    |
| `Shipped.dc.html`                     | the root page **as it ships today**, for comparison   |
| `directions/Direction{A,B,C}.dc.html` | low-fi wireframes explored first, not carried forward |

`Light.dc.html` is byte-identical to `Main.dc.html` except for its `:root`
block. That is the point: the redesign is a palette swap away from working in
all 44 palettes in `src/lib/presentation/style/themes.css`, so it needs no
per-theme markup.

## What the redesign changes

1. **The ledger is a real `<table>`** — ten columns, run order first. The
   per-row flex layout and its `opacity-0` hover strip (which reserved 114px
   permanently) are gone. **Shipped 2026-08-21**, with twelve columns rather than
   ten: `Logged` and the ✎/✕ strip, which the artboards left out.
2. **A to-scale day timeline** is the centrepiece, one block per task, each
   with a bar showing how far its allocation gets toward flow arrival.
   **Shipped 2026-08-22**
   ([docs/features/the-plan-that-had-no-clock.md](../features/the-plan-that-had-no-clock.md)),
   with three of the artboards' readings left out: the hour axis, since the
   block widths and each block's own duration already carry the scale; the footer's
   flow-coverage sentence, which is the metrics grid's own tile and so R3 in the
   UI; and `16m of it left` on a block that overshoots, a third number on a
   block that has two.
3. **A "binding constraint" panel** promotes what `plan-advice-card.svelte`
   already computes (MATH.md §14) out of small grey text.
4. **The twenty non-headline readings** become a dense four-column grid instead
   of an accordion.
5. Instrument Sans for text, IBM Plex Mono + `tabular-nums` for every number.
6. **The chrome is a bar, not a floating pill** — a full-bleed sticky header
   with a bottom rule, the wordmark on the left, text nav links (no icons), and
   the day on the right. **Shipped 2026-08-21** in `nav.svelte`, with five
   deviations. The artboards' `offline · IndexedDB` is not there: it reads
   nothing — neither `navigator.onLine` nor the storage status the layout
   already surfaces on failure — so it was a hardcoded claim about the app in
   the one place that should only carry readings. The data menu (☰) stays,
   because the artboards left it out and export/import/delete has nowhere else
   to live. The bar is `surface-float` + `backdrop-blur` rather than the
   artboards' transparent ground, since a sticky bar has page text passing under
   it (STYLE.md, floating chrome). Below `sm` each link falls back to its icon
   and the wordmark hides — four labels do not fit a phone. And the artboards drop
   the `Fallow` h1 from the page body, which shipped in
   [the-header-that-only-held-a-title](../features/the-header-that-only-held-a-title.md):
   the h1 is `sr-only` on `/` now, so the wordmark reads once and the tagline
   tooltip it carried moved onto this bar's brand mark.

## Settled

**The clock the timeline needed is a label, not model work.** `09:00 → 17:15`
was invented — Fallow allocates _durations_ and had no day-start anchor. The day
carries one now, per day and persisted beside its budget, and no formula, fit or
metric reads it: the plan is identical with and without it. The strip prints that
start and nothing else: the artboards' finish was `start + availableHours`, and
`availableHours` is the hours the user intends to _work_ (MATH.md §11.3), so a
clock time read off it omits every break and is a figure nobody computed. A day
that stored no start prints no clock at all, rather than labelling itself with a
default it never carried. That is what leaves
MATH.md §8.3's circadian boundary settled, rejected until there is an
instrument, and the only time-of-day instrument the data carries is the
`createdAt` stamp on 🪫 logs (§36).

**The table's two additions:** the artboards' table had no completion cell and no
⚡/🪫 affordance, and both mattered — completion is what opens the two
measurement prompts, and `src/lib/presentation/utils/measurement-prompt.ts` has
them _stack_. What shipped is a spanning editor row (`<tr><td colspan>`) with one
`<tbody>` per task and ✎/✕ in a narrow always-visible trailing column. The
triggers went into one `Logged` cell rather than into `Flow @` and `Hours` as
proposed here: 🪫's chip list is unbounded (MATH.md §8.7), so a fixed-width
column would re-break the alignment the table exists for.

## Everything else on the artboards is real

Values were lifted from component source, `tokens.css` and `themes.css`, and
every derived figure was checked against the model rather than invented — e.g.
only task #1 is allocated past its flow arrival (2h30m vs 2h14m), which is what
`Flow Coverage 1/5` reports independently.

`Shipped.dc.html` draws the metrics accordion **open**; its real default is
closed behind "20 more metrics".
