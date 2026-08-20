---
id: edit-form-focus
class: buried
rules: [presentation.attach-focus, R6]
touches: presentation
owns: [src/lib/presentation/AGENTS.md, docs/testing.md]
---

## Prompt

Opening a task's ✎ editor leaves the caret nowhere: you have to click into the title field before you can rename anything, on both the main page and the Energy Lab. Put the cursor in that title field as soon as the editor opens.

## Traps

- presentation.attach-focus — the obvious answer is the `autofocus` attribute, which is inert on any node inserted after load (the document's autofocus-processed flag) and silently never focuses; the editors here focus with `{@attach (node) => node.focus()}`. A `bind:this` plus an `$effect` or an action is the same miss by another route.
- R6 — a focus change is a behaviour change and ships with a story `play` assertion.

## Checks

### deterministic

- rule: presentation.attach-focus
  run: ! grep -rn 'autofocus' $CHANGED
  expect: exit 0
- rule: presentation.attach-focus
  run: grep -rq '@attach' $CHANGED
  expect: exit 0

### judge

- rule: R6
  ask: Did the diff add a `play` assertion on the edit form's story that the title field holds focus once the editor is rendered, and does the transcript show it run and fail before the component was changed? Pass only if both hold.
