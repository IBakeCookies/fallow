---
id: drain-severity-chips
class: multi
rules: [R3, R6, style.color-role, presentation.band-view-model]
touches: presentation
owns: [src/lib/presentation/AGENTS.md, src/lib/presentation/style/STYLE.md, docs/testing.md]
---

## Prompt

In the analytics log history, the 🪫 rows print their M and B ratings as plain numbers, so a punishing session looks like an easy one while scrolling. Give each of those two ratings a filled pill coloured by how heavy the rating is — worst at 10, fine at 1 — so a hard day is visible at a glance.

## Traps

- R3 — the naive answer writes the rating thresholds into `log-history-list.svelte` (or into `log-history.ts`), giving the app a second copy of a banding policy `presentation/utils/band.ts` already owns.
- presentation.band-view-model — the row view model ends up carrying a Tailwind class string instead of a band name the component looks up.
- style.color-role — a solid pill gets `text-danger` or `text-danger-strong` (the same hue twice) instead of the `-ink` role, or a raw palette colour.
- R6 — the colouring ships with no story `play` assertion.

## Checks

### deterministic

- rule: R3
  run: printf '%s\n' $CHANGED | grep -qx src/lib/presentation/utils/band.ts
  expect: exit 0
- rule: style.color-role
  run: ! grep -rnE 'dark:|(text|bg|border)-(zinc|slate|gray|neutral|stone|red|orange|amber|yellow|green|emerald|blue|indigo)-[0-9]' $CHANGED
  expect: exit 0

### judge

- rule: R3
  ask: Are the numeric thresholds that map a rating to a colour defined in exactly one module (`src/lib/presentation/utils/band.ts`), with no second copy of those numbers in a component, a util or a store? Pass only if there is one definition.
- rule: presentation.band-view-model
  ask: Does the value handed to the component name a band (or an equivalent enum member) rather than a CSS class string, with the class looked up from a table beside the other band tables? Pass only if no class string is produced outside that table.
- rule: style.color-role
  ask: On every solid-filled pill this diff adds, is the label colour the `-ink` role of that fill (e.g. `text-danger-ink`) rather than the bare state colour or its `-strong` variant? Pass only if every solid fill pairs with an `-ink` label.
- rule: R6
  ask: Did the diff add a `play` assertion on the affected component's story for the new colouring, and does the transcript show it run and fail before the component was changed? Pass only if both hold.
