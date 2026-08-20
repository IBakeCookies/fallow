---
id: footer-legibility
class: single
rules: [style.no-dark-variant]
touches: presentation
owns: [src/lib/presentation/style/STYLE.md]
---

## Prompt

The footer links (Imprint, Privacy, Buy me a coffee) sit so faint against the page that people miss them entirely, and it is worst on the dark themes. Make them properly legible in `src/lib/presentation/component/footer.svelte`.

## Traps

- style.no-dark-variant — "worst on the dark themes" invites a `dark:` variant (or a raw palette colour such as `text-zinc-200`); the variant is a binary over dozens of palettes, so any light/dark difference has to come from a semantic token the themes already swap.

## Checks

### deterministic

- rule: style.no-dark-variant
  run: ! grep -rn 'dark:' $CHANGED
  expect: exit 0

### judge

- rule: style.no-dark-variant
  ask: Did the diff actually change the footer link contrast, and did it do so only by swapping to semantic token utilities (or by changing a token's per-theme value), with no `dark:` variant and no hardcoded palette colour anywhere in the diff? Pass only if both halves hold.
