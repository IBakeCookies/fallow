# Root-page redesign — answer first

An audit of the root page (`src/routes/(app)/+page.svelte`) as it ships on
2026-09-04, and a redesign drawn against it. Nothing here is wired to the app;
these are static artboards.

Published canvas: https://claude.ai/code/artifact/493d51a3-c77f-4be9-9d43-a55101a10242

This is a second canvas, not an edit of
[docs/redesign](../redesign/README.md): that one is the 2026-08-21 redesign
whose ledger, timeline and chrome shipped, and it stays frozen as the record of
what those shipped from. Two of its six items never shipped — the binding
constraint panel and the dense reading grid — and both come back here.

## The files

| file              | what it is                                               |
| ----------------- | -------------------------------------------------------- |
| `Main.dc.html`    | the redesign, on the shipped `.fallow` palette           |
| `Dark.dc.html`    | the same markup on `.fallow-dark`                        |
| `Current.dc.html` | the root page **as it ships on 2026-09-04**              |
| `OptionB.dc.html` | low-fi: focus mode, the page is one task                 |
| `OptionC.dc.html` | low-fi: the day is the instrument, readings on the spine |

`Dark.dc.html` is byte-identical to `Main.dc.html` except for its `:root` block
— the same constraint `docs/redesign` set and for the same reason: a design that
needs different markup per theme is not one design, and this app ships 46
palettes. That pairing is why both files are in `.prettierignore`.

`fallow-today-redesign.html` is the seeded canvas — the artboards above plus
Claude Design's editor, ~2 MB — and is gitignored. The `.dc.html` files and
`canvas.json` are the source; that file is the build of them.

## What the audit found

Four full-width cards in one column, every one of them the same `card-shell`:
same radius, same translucent fill, same shadow, same 12px uppercase heading.
Nothing on the page says which one holds the answer. In the order they read:

1. **The page opens on settings.** `day-constraints-bar.svelte` is four number
   steppers you set once a day, above everything the model computed.
2. **Nothing says next.** Position 1 of the mid-day re-plan is `NextUpLine`, a
   small grey line in the ledger card's header row.
3. **The verdict reads after the detail.** `metrics-dashboard.svelte`'s headline
   four sit _below_ the twelve-column ledger.
4. **The panel that says what to change starts empty.** `plan-advice-card.svelte`
   is the last card and its default state is "not run yet", behind a button.
5. **Twenty readings are behind an accordion**, and the four that are not carry
   no sentence — a 24px number and a 2px rule.
6. **The ledger side-scrolls** below ~1200px with `#` and `Task` pinned.
7. **Colour is spent thinly and unevenly**: the band hues reach the strip's
   bars, the `Prio` and `Flow at` cells, the Momentum badge and two of the four
   metric rules — the other two are `line-soft`. The domain hues never reach the
   ledger at all: `task-item.svelte:190-241` renders those cells as plain
   `ledger-cell ledger-numeric`, and `--mind` / `--body` live in the 🪫 editor
   and the add form's sliders.

## What the redesign changes

The page reads answer → plan → evidence, and the chrome weight follows.

1. **The verdict is page-level type, no card** — one sentence of what the model
   concluded, and the three readings that are the day beside it.
2. **Time Budget becomes one line** of readings you click to edit.
3. **Next is the one accented surface on the page.**
4. **The strip leaves the ledger card** and gets room: `h-24` → `h-36`.
5. **The ledger rests at five columns** — `#`, `Task`, `Logged`, `Planned`, the
   ✎/✕ strip. The seven instrument readings are behind the toggle and nowhere
   else on the row; the strip above already carries flow arrival. The add form
   is a row of the plan, not a dialog over it.
6. **The binding constraint is computed, not requested.** The panel beside it
   earns its place by ruling the levers _out_: on this day no task move and no
   budget change improves flow coverage, which is what makes the constraint
   cognitive rather than clock.
7. **All twenty-four readings, no accordion**, grouped by the question each
   answers: does the day fit, is the time well spent, what is it costing, can I
   keep doing this. The set is exactly the one `metric-descriptor.ts` defines —
   four of them are the dashboard's headline tiles, two of those four are the
   verdict at the top of the page.

## Provenance

The sample day is the one already checked in
[`docs/redesign/Main.dc.html`](../redesign/Main.dc.html) — same five tasks, same
allocations, same flow arrivals, priorities and efforts, and the same 8.25h
budget (7.25h planned + 1h switching) — so the audit artboard and the proposal
compare directly and no figure here was derived for the drawing. The
binding-constraint wording is that run's too, verbatim: "no task move or budget
change improves that". Palette, radius and spacing values are lifted from `tokens.css`,
`base.css` and `themes.css`; the artboards introduce no colour, radius or
spacing rung that those files do not define.

No time of day appears anywhere, for the reason `docs/redesign/README.md`
settles under **Settled**: Fallow allocates durations and has no day-start
anchor, so every duration on the strip is an offset from the day's own zero.

## Open

**The expanded ledger is unillustrated.** No artboard draws the instruments-on
state, and the toggle's worth turns on it: if pressing `+ Instruments 7` simply
restores the shipped twelve-column table, it has moved the sideways scroll
behind a click rather than removed it. Two of the seven hidden readings are also
carried nowhere else on the page once hidden — `Stop by`, and `Prio`, which is
the run order's own justification, so `#1` would be asserted without its
evidence. Both need settling before any of this is worth building.

`OptionB` and `OptionC` are directions to react to, not designs to ship — each
states what it buys and what it costs on the artboard itself. If neither is
wanted they can be deleted; if one is, it gets built out and `Main.dc.html`
holds it.
