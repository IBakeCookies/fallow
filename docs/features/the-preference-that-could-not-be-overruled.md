# The preference that could not be overruled

**Kind:** feature · **Status:** landed 2026-08-27 · **Roadmap:** item `none`

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

A visitor whose OS asks for reduced motion can turn Fallow's animated theme
scenery **on**, and it stays on across reloads. Today the pause/resume control
is hidden from exactly those visitors, because the CSS freezes scenery with
`!important` whatever the cookie says — so the one preference the app records
about motion is the one it will not honour.

The OS setting keeps deciding the **first** visit. It stops deciding every
visit after the user has said otherwise.

## Scenarios

### Scenario — the motion control is offered on a reduced-motion browser

`e2e/scenery.e2e.ts`

- **Given** `emulateMedia({ reducedMotion: 'reduce' })` and no `sceneryMotion`
  cookie
- **When** they open the theme menu
- **Then** a menu item reads `Resume animations`

### Scenario — resuming stamps the override class

`e2e/scenery.e2e.ts`

- **Given** the theme menu open on a reduced-motion browser with no
  `sceneryMotion` cookie
- **When** they click `Resume animations`
- **Then** `html` carries `scenery-motion-on`

### Scenario — resuming records the choice

`e2e/scenery.e2e.ts`

- **Given** the theme menu open on a reduced-motion browser with no
  `sceneryMotion` cookie
- **When** they click `Resume animations`
- **Then** the `sceneryMotion` cookie reads `on`

### Scenario — a recorded resume actually animates the scenery

`e2e/scenery.e2e.ts`

- **Given** `theme=abyss` and `sceneryMotion=on` cookies on a reduced-motion
  browser
- **When** they load `/`
- **Then** the computed `animation-play-state` of
  `.theme-scenery .theme-helper-1` is `running`

### Scenario — pausing still works on a reduced-motion browser

`e2e/scenery.e2e.ts`

- **Given** a `sceneryMotion=on` cookie on a reduced-motion browser, theme menu
  open
- **When** they click `Pause animations`
- **Then** `html` carries `scenery-paused`

### Scenario (pin) — a first visit on a reduced-motion browser is still frozen

`e2e/scenery.e2e.ts`

- **Given** a `theme=abyss` cookie, no `sceneryMotion` cookie, on a
  reduced-motion browser
- **When** they load `/`
- **Then** the computed `animation-play-state` of
  `.theme-scenery .theme-helper-1` is `paused`

### Scenario (pin) — a first visit on an ordinary browser animates

`e2e/scenery.e2e.ts`

- **Given** a `theme=abyss` cookie, no `sceneryMotion` cookie, default media
- **When** they load `/`
- **Then** the computed `animation-play-state` of
  `.theme-scenery .theme-helper-1` is `running`

### Scenario (pin) — no stored choice reads as paused on a reduced-motion OS

`src/lib/business/store/theme-store.svelte.spec.ts`

- **Given** `matchMedia` stubbed so `(prefers-reduced-motion: reduce)` matches,
  both appearance snapshots empty
- **When** the store mounts
- **Then** `sceneryPaused` reads `true`

### Scenario — no stored choice stamps neither motion class

`src/lib/business/store/theme-store.svelte.spec.ts`

- **Given** `matchMedia` stubbed so `(prefers-reduced-motion: reduce)` matches,
  both appearance snapshots empty
- **When** the store mounts
- **Then** `document.documentElement` carries neither `scenery-paused` nor
  `scenery-motion-on`

### Scenario — the first toggle on a reduced-motion OS resumes rather than pauses

`src/lib/business/store/theme-store.svelte.spec.ts`

- **Given** `matchMedia` stubbed so `(prefers-reduced-motion: reduce)` matches,
  both appearance snapshots empty
- **When** `toggleSceneryMotion()` is called
- **Then** `document.documentElement` carries `scenery-motion-on`

## Out of scope

- **Every other kind of motion in the app.** The control governs the animated
  theme backdrops under `style/scenery/` and nothing else. Transitions, toasts
  and any other motion site keep whatever they do now; this is not a global
  motion override, and building one would need an audit of every such site plus
  a shared gate nobody has asked for.
- **A third "follow the OS" state on the control.** It stays two-state:
  pause / resume. Once a choice is recorded there is no path back to deferring
  to the OS short of clearing the cookie, and that is accepted — a tri-state
  control is a third label, a third icon and a third branch for a gesture
  nobody has asked for (AGENTS.md §0).
- **Letting a mid-session OS flip reclaim the decision from someone who chose
  motion on.** That is the whole point of the feature; an explicit choice is
  not provisional.
- **The other `prefers-*` media features.** Contrast, transparency and
  colour-scheme handling are untouched.
- **Moving the preference off cookies.** R4 puts pre-hydration SSR inputs in
  cookies, and this is one — the class has to be in the first paint.

## Read before building

- `src/lib/presentation/style/scenery/index.css` — the
  `@media (prefers-reduced-motion: reduce)` block that is the entire blocker,
  and the `.scenery-paused` triple beside it that it was modelled on
- `src/hooks.server.ts` — `handleSceneryMotion`, which fills the placeholder
  from `readRequestAppearance().sceneryPaused` and today emits one class or none
- `src/app.html` — the `%scenery-paused%` placeholder on `<html>`, and the
  second pre-paint `if` block (the `sceneryMotion`/reduced-motion one) that this
  change makes redundant. The theme `if` block above it is untouched, including
  its comment about not assigning `className`
- `src/lib/business/store/theme-store.svelte.ts` — `#sceneryPaused`,
  `#prefersReducedMotion`, the `scenery-paused` class `$effect`, the
  `sceneryPaused` and `sceneryMotionToggleable` getters, `toggleSceneryMotion`,
  and the `onMount` block whose seeding mutation this replaces with resolution
- `src/lib/business/model/theme.ts` — `getClassesToAdd` and `allThemeClasses`
  at the file's end are the shape the two new exports copy
- `src/routes/(app)/+layout.svelte` — the `{#if themeStore.sceneryMotionToggleable}`
  wrapper around the motion item, and the comment above it stating the
  rationale that this change removes
- `src/lib/business/appearance.ts` — `RequestAppearance.sceneryPaused` and
  `AppearanceSnapshot.sceneryPaused`; the doc comment "the client uses
  prefers-reduced-motion" is now only true of the first visit
- `src/lib/data/repository/appearance-repository.ts` — the `sceneryMotion`
  cookie's three states (`paused` / `on` / absent). No change here: the
  tri-state the feature needs is already what it parses
- `e2e/scenery.e2e.ts` — the existing `prefers-reduced-motion` test and the
  block comment above it, which both assert the behaviour being removed; the
  `seedTheme` and `openThemeMenu` helpers the new scenarios reuse
- `src/lib/business/store/theme-store.svelte.spec.ts` —
  `describe('ThemeStore reduced-motion seeding')`, whose
  `sceneryMotionToggleable` assertion goes with the getter
- `src/lib/presentation/style/STYLE.md` — the theme-and-scenery rules; the
  `scenery-motion-on` escape hatch is a new rule here, and STYLE.md is where
  AGENTS.md's doc table puts classes
- `src/lib/business/AGENTS.md` — the R5 passage on `ThemeStore` taking both
  appearance snapshots; it describes the reconciliation this change turns from a
  mutation into a resolution

No MATH.md section is touched.

## Decisions

- **The media query is guarded, not deleted.** It becomes
  `html:not(.scenery-motion-on) .theme-scenery *` (and the `::before` /
  `::after` twins), so it still freezes scenery for a visitor who has expressed
  no preference — live when the OS setting flips mid-session, and with
  JavaScript disabled, where nothing is stamped and no store mounts. Rejected:
  deleting the block outright and letting `.scenery-paused` be the only gate.
  It is a smaller diff and it is a real accessibility regression: motion would
  play for a reduced-motion visitor in both of those cases.
- **Flat selectors, not a nested `@media`.** The guarded rule repeats
  `html:not(.scenery-motion-on)` across the three selectors rather than nesting
  the media query inside a wrapper. It matches the `.scenery-paused` triple
  directly below it, and introduces no CSS-nesting question in the Tailwind
  pipeline.
- **The store holds the tri-state, and resolves for display.**
  `#sceneryPaused: boolean` becomes an explicit-choice field that may be
  `undefined`; the `sceneryPaused` getter returns
  `explicitChoice ?? #prefersReducedMotion`, and the class `$effect` stamps
  `scenery-paused` only when the choice is explicitly `true` and
  `scenery-motion-on` only when it is explicitly `false`. This deletes the
  `onMount` seeding mutation — resolution replaces it — and it is not
  optional: a store that collapses "no choice" to `false` would have its
  `$effect` add `scenery-motion-on` on hydration of a reduced-motion first
  visit, unfreezing the scenery for the moment before the seed corrects it.
  That flash is the exact thing the pre-paint script exists to prevent.
- **`#prefersReducedMotion` and its live `change` listener stay.** They stop
  feeding a visibility flag and start feeding the label: a reduced-motion
  visitor with no recorded choice must read `Resume animations`, because motion
  is in fact frozen for them.
- **`sceneryMotionToggleable` is deleted, not inverted.** With the control
  always shown there is no caller, and the `{#if}` in `+layout.svelte` goes with
  it. Rejected: keeping the getter as a disabled state on the item — a control
  that can now honour both directions has nothing to be disabled about.
- **`app.html`'s reduced-motion pre-paint block is deleted.** Its whole job was
  stamping `scenery-paused` before first paint for a reduced-motion first visit;
  the guarded media query does that with no cookie read and no script. Keeping
  both would mean the class and the query freezing the same scenery for the same
  reason, and the class would then be removed by the store's `$effect` a moment
  later — a mirror that disagrees with itself (R3).
- **The state-to-class mapping is exported once.** `getSceneryMotionClasses`
  and `allSceneryMotionClasses` join `getClassesToAdd` and `allThemeClasses` in
  `business/model/theme.ts`; `hooks.server.ts` joins the result into the
  placeholder and the store's `$effect` removes all of them and adds the current
  one. R3: the server stamp and the client toggle are two subsystems performing
  the same mapping, and a second copy is the defect the moment it exists.
- **The new export is priced in STYLE.md, not `business/model/AGENTS.md`.**
  AGENTS.md's doc table sends classes and themes to STYLE.md, and
  `business/model/AGENTS.md` is about model invariants and MATH.md; a
  class-name mapping is not one.
- **The placeholder is renamed `%scenery-motion%`.** It carries one of three
  values now, so `%scenery-paused%` names only one of them.
- **The pins are phrased through computed `animation-play-state`, not through
  the class.** The class on `<html>` for a reduced-motion first visit changes
  (today `scenery-paused`, after this neither), so a class assertion could not
  run against the old code. What must not change is whether the scenery moves,
  and that is what `getComputedStyle` reads.

## Open questions

None.
