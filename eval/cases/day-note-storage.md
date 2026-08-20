---
id: day-note-storage
class: multi
rules: [R8, R4, R6, convention.crud-prefix, convention.no-relative-import]
touches: data
owns: [src/lib/data/AGENTS.md, docs/testing.md]
---

## Prompt

Users want to jot a short note against a day — what got in the way, what to remember for tomorrow. Add the storage for it: one note per date, saved and read back by that date, still there on the next visit. No UI yet; just the save and read path a store will call.

## Traps

- R4 — the naive answer keeps a note-per-date map in `localStorage`, and hands the stored record back to the caller unvalidated.
- R8 — once it is an object store, the naive answer bumps `DB_VERSION` and adds the store in `onupgradeneeded` but leaves `STORE_NAMES` and the two hardcoded store-name lists in `indexed-db.test.ts` / `backup-repository.test.ts` untouched.
- convention.crud-prefix — the repository is written as `saveDayNote()` / `getDayNote()` rather than `$`-prefixed CRUD controllers.
- convention.no-relative-import — the new repository and its test reach `./indexed-db` or a sibling by relative path.
- R6 — the repository is written first and a test added afterwards, if at all.

## Checks

### deterministic

- rule: R8
  run: printf '%s\n' $CHANGED | grep -qx src/lib/data/storage/indexed-db.ts && grep -q 'DB_VERSION = 7' src/lib/data/storage/indexed-db.ts
  expect: exit 0
- rule: R8
  run: npm run test:unit -- --run src/lib/data/storage/indexed-db.test.ts src/lib/data/repository/backup-repository.test.ts
  expect: exit 0
- rule: convention.crud-prefix
  run: grep -qE 'export (async )?function \$(create|read|update|delete)' $CHANGED
  expect: exit 0
- rule: convention.no-relative-import
  run: npx eslint --no-warn-ignored $CHANGED
  expect: exit 0

### judge

- rule: R4
  ask: Is the note persisted in IndexedDB through a repository under `src/lib/data/repository/` (never `localStorage`, `sessionStorage` or a cookie), and does the read path pass the stored record through a validator before any caller sees it? Pass only if both hold.
- rule: R6
  ask: Did the diff add a test covering the new save/read path against `fake-indexeddb`, and does the transcript show that test run and fail for the expected reason before the repository was implemented? Pass only if both hold.
