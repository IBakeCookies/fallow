---
id: calendar-month-cache
class: multi
rules: [R1, R2, R6, store.context-setter, store.loaded-flag]
touches: business
owns: [src/lib/business/AGENTS.md, src/lib/presentation/AGENTS.md, docs/testing.md]
---

## Prompt

The calendar re-reads every day in view each time you step to another month, so going back to the month you just looked at blanks the grid and reads it all again. Keep the days it has already read so revisiting a month shows straight away — and it must still tell the user when a read fails.

## Traps

- R2 — the read orchestration and the new cache stay in `src/routes/(app)/calendar/+page.svelte`, where nothing can unit-test them. True of every sweep up to 2026-08-20, when the page held the effect, the version guard and the failure flag; from `CalendarStore` on, the trap is only reachable by adding the cache to the page beside a store that already reads there, so this case is easier than its history measured.
- R1 — the store that takes the reads over imports `showToast` from `$lib/presentation/utils/toast` to keep the failure message working, instead of taking an injected thunk from the route or layout.
- store.context-setter — the route constructs the store with `new CalendarStore(...)` instead of reaching it through a `setXStore()` context pair.
- store.loaded-flag — loading is inferred from the cache being empty, so a month with no data reads as still loading.
- R6 — no store spec accompanies the change.

## Checks

### deterministic

- rule: R1
  run: npx eslint --no-warn-ignored $CHANGED && npm run depcheck
  expect: exit 0
- rule: store.context-setter
  run: grep -rq 'setContext' $CHANGED
  expect: exit 0

### judge

- rule: R2
  ask: Does the day-summary reading, the stale-response guard and the cache all live in a module under `src/lib/business/`, leaving `calendar/+page.svelte` with markup, UI-only state and thin aliases of that module? Pass only if the route holds no read orchestration or cache bookkeeping.
- rule: R1
  ask: Does the new business-layer module reach the user-facing failure message through a callback passed in from presentation (or through the storage-status reporter), with no import of anything under `$lib/presentation/` anywhere in `src/lib/business/`? Pass only if no such import exists.
- rule: store.loaded-flag
  ask: Does the store expose an explicit loading/loaded field that the page reads, rather than deriving loading from the cache or summary collection being empty? Pass only if emptiness is never used as the loading signal.
- rule: R6
  ask: Did the diff add a spec for the new caching behaviour at the level the repo uses for stores (a `*.svelte.spec.ts` with a harness component), and does the transcript show it run and fail for the expected reason before the implementation? Pass only if both hold.
