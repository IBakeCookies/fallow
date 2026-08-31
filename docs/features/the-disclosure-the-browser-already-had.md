# The disclosure the browser already had

**Kind:** repair · **Status:** landed 2026-08-31 · **Roadmap:** the 2026-08-31
audit of the app against native HTML

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is the area `AGENTS.md`. When later work changes
the behaviour, it writes its own feature file; it does not edit this one.

## The question

The Time Budget bar opened and closed through a `<button aria-expanded>`, a
`$state` flag, an `{#if}` and a `▴`/`▾` ternary. The metrics card's own fold, two
components away, is a `<details>` — the same disclosure, spelled twice, one of
the two spellings maintaining by hand what the element does for free.

## What was decided

**`<details>` with `bind:open`.** The summary is the control, so the button, the
click handler, the `aria-expanded` and the `{#if}` are all gone; the collapsed
one-line summary hides through `group-open:hidden` rather than an `{#if}`, and
the fields below stay in the DOM when shut.

**`bind:open`, not a one-way `open={…}`.** A one-way attribute is re-applied on
every re-render, and the plan re-renders whenever a task lands — which shut the
panel under the caret the first time one did. Two-way, the click lands in the
state and the re-render agrees with it. `isOpen` stays a mount-time default for
the same reason it always was one: the caller re-asks per day by remounting the
bar, because a live value would shut the panel the moment the hours field it
exists to fill stops reading 0.

**What the tests assert changed with it.** `<summary>` has no `button` role, so
the e2e and the story reach it by text; the collapsed state is read off the
element's own `open` attribute or off the summary line's visibility, never off an
attribute we maintain. Playwright and Vitest disagree on whether a closed
disclosure's fields are "visible" — closed `<details>` content keeps a box in
Chromium — so no test asserts that.

## What was deliberately not done

- **The suggestion list did not become a `<datalist>`.** Picking a title also
  writes three slider ratings, and a datalist option carries no payload and fires
  no pick event.
- **The add-task dialog did not become a native `<dialog>`.** It would still need
  the portal, the scroll lock and the animations bits-ui already gives it, and
  `task-form.svelte` deliberately stops Escape at bits-ui's escape layer.
- **The day strip's flow bar did not become a `<meter>`.** Per-band fill colour
  costs more through `::-webkit-meter-*` than through the two divs, and the
  reading already has its own `sr-only` sentence.
