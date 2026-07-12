# Code conventions

Most of our code conventions are enforced using eslint and prettier.
For more details, take a look at the related configurations.

**All frontend code is organized in `src` folder.**

## Architecture

The app is split into three layers under `src/lib`, with a strict one-way
dependency direction:

```text
Presentation ──▶ Business ──▶ Data
```

- `src/lib/presentation` — everything UI: components (`component/`, including
  the vendored shadcn `component/ui/`), UI-only types (`type/`, e.g.
  `interface Metric`), and UI helpers (`utils/`, e.g. `cn`, status→Tailwind
  class mappings). Routes in `src/routes` count as presentation.
- `src/lib/business` — domain logic: the Zenith/energy models and metrics
  (`model/`), reactive stores (`store/`), app-wide reactive state (`state/`),
  shared helpers (`utils/`), and the type surface re-exported for the
  presentation layer (`type/`).
- `src/lib/data` — the frontend's "backend": storage models (`type/`),
  storage connections (`storage/` IndexedDB, `database/` Postgres),
  repositories with CRUD controllers (`repository/`), and migrations
  (`migration/`).

Rules (enforced via `no-restricted-imports` in `eslint.config.js`):

- Presentation (and routes) never import from `$lib/data/*`. If a page needs
  data, the business layer provides a store or facade function (e.g.
  `session-store.svelte.ts`, `session-history.ts`).
- Business never imports from `$lib/presentation/*` — no Tailwind classes or
  component concerns in domain code.
- Data never imports from `$lib/business/*` or `$lib/presentation/*`. Model
  defaults a migration needs are passed in as parameters.

`src/lib/paraglide` is generated i18n code and exempt from these rules.

## Naming

- avoid abbreviations
- folders and files must have singular, `start-kamel-case` names
  - only exceptions are config files where a conventional name is required by the relative tool (ie. `.prettierrc`)
- slot names and emitted events must be `kebab-case`
- function and method names must follow the format: `imperative verb + object [+ from|to|by + target]`:
  - `getUser()`
  - `addItemToCart()`
  - `sortCompaniesByName()`
  - `parseValueFromStringToNumber()`

## Data layer

- every controller method must start with `$` followed exclusively by any of the CRUD action verbs: `create`, `read`, `update` or `delete`:
  - `$createCollection()`
  - `$readCollection()`
  - `$updateCollection()`
  - `$deleteCollection()`
- caveat: inside `.svelte`/`.svelte.ts` files the `$` prefix is reserved for
  runes, so import repositories as a namespace and access the controllers as
  properties: `import * as sessionRepository from '$lib/data/repository/session-repository'`

## Coding

- exports must be named (ie. `export const something = ...`)
  - default exports must be used only for Svelte components
- use `const`, avoid `let`
- use early returns to avoid nested/complex/unreadable if statements
- separate methods by responsibility
  - a method that _performs something_ is called **action**
  - a method that _reacts to a change_ is called **handler**
    - handlers only handle
    - handlers are composed by actions
- handlers must begin with "on" prefix followed by the change name (ie. `onClick`, `onPropWatching`)
  - handlers may have a context indication in the name (ie. `onInputChange`)

## Style

- component use the helper `cn` function for the css class
- avoid using styles and rely on tailwind as much as possible
- `cn` is a combination of `tailwind-merge` and `CLSX`, which means it follows the same API CLSX does and you can do complex logic to add classes based on conditions

## Imports

To maintain readability as the codebase grows, we have a few rules for imports, in order of priority, from top to bottom:

- Types
- External / Libraries (ramda, tailwind, cn, etc)
- Internal libraries / helpers (vue, dataMap, etc)
- Data Layer functions ($readBranches, $useBranchesStorage, etc)
- Connection Layer functions (useBranches, useTopicsByBranch, etc)
- Presentation Layer from big/abstract to small/specific
  - Layout/Page (VHeader, VFooter, etc)
  - Organism/Molecule (VTopicBoxSlider, VArticleItemList, etc)
  - Atom (VButton, VInput, etc)
