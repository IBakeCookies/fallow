---
id: lab-optimal-time
class: single
rules: [R2]
touches: presentation
owns: [src/lib/presentation/AGENTS.md]
---

## Prompt

In the Energy Lab's task list, every row shows the hours the schedule gave that task. Add, beside that reading, how long the task would ideally run on its own in one unbroken sitting, so a user can see when the plan is cutting a task short.

## Traps

- R2 — the single-task optimum comes from `findOptimalSingleTaskTime` in `$lib/business/model/zenith`, and the naive answer imports it straight into `src/routes/(app)/energy/+page.svelte` or `energy-task-row.svelte` (or into a `presentation/utils` helper), instead of exposing the value from `EnergyLabStore` alongside `scheduledTasks`.

## Checks

### deterministic

- rule: R2
  run: npm run depcheck
  expect: exit 0

### judge

- rule: R2
  ask: Is the new per-task duration computed outside `src/routes/` and `src/lib/presentation/` — in a store or a model module — with the page and the row component only reading and formatting the value? Pass only if no route, component or presentation helper calls model code to derive it.
