# Title suggestions as you type

**Status:** landed 2026-08-05 · **Roadmap:** item 24

Backfilled 2026-08-14 from ROADMAP item 24, whose text was written at land. Not
a pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

A part-typed title in the add-task form answers with every rated title it could
be naming, shown under the field. Picking one fills the title and moves all
three sliders to what that title was last rated, and the user can then drag any
of them.

## Scenarios

### Scenario — picking a suggestion carries its rating

- **Given** a rated title in history
- **When** the user types two characters of it and picks the suggestion
- **Then** the title field holds the picked title
- **Then** all three sliders move to what that title was last rated
- **Then** dragging any slider afterwards is allowed

### Scenario — typing past the list rates by hand

- **Given** an open suggestion list
- **When** the user types past it and picks nothing
- **Then** the sliders stay where they are

### Scenario — clearing a picked title resets the sliders

- **Given** a pick put the three numbers on screen
- **When** the field is emptied
- **Then** the sliders return to 5/5/5

### Scenario — clearing a hand-rated title keeps the drags

- **Given** the user dragged the sliders themselves, with no pick
- **When** the field is emptied
- **Then** the sliders stay where the user dragged them

### Scenario — editing short of empty keeps the pick

- **Given** a picked title with its rating on screen
- **When** the user edits the title without emptying the field
- **Then** the sliders keep the picked rating

### Scenario — submit clears the pick

- **Given** a picked title
- **When** the task is submitted
- **Then** the next task's own drags survive emptying the field

### Scenario — the list reopens from the keyboard

- **Given** a list that Escape or a blur closed
- **When** the user presses an arrow key
- **Then** the list reopens
- **Then** the highlight lands on the end it was opened from

### Scenario — the highlight dies with its list

- **Given** a list with a highlighted row
- **When** Escape, a pick or a blur closes it
- **Then** the highlight drops

### Scenario — the highlight stays visible

- **Given** more matches than the box shows
- **When** the highlight moves below the fold
- **Then** the highlighted row is scrolled into view

### Scenario — clicking a row does not lose the field

- **Given** an open suggestion list
- **When** the user presses the mouse on a row
- **Then** the field is not blurred before the pick lands

### Scenario — a late read reaches an open list

- **Given** the banner's Retry landing a second read behind an open form
- **When** the read arrives
- **Then** the list already asked shows the arriving titles
- **Then** the list does not wait for the next keystroke

### Claim — two characters, substring, alphabetical, uncapped

- **Given** a part-typed title of at least two characters
- **Then** every rated title containing it as a substring is offered
- **Then** the order is alphabetical
- **Then** the list is not capped

## Out of scope

- **One character.** The match is a substring, so one character finds most of a
  history and the list would cover the sliders on every new task. Two is the
  first length that discriminates and is shorter than the shortest titles
  anyone writes (`Gym`, `Run`).
- **Ranking, and a cap.** Any ranking would be invented, and a cap would hide
  rated titles with no way to know.
- **Prefix matching.** The word the user reaches for is often not the first one.
- **Guarding the whole-field replacement.** Selecting the whole field and
  typing over it never passes through empty, so a pick's rating survives the
  replacement. It is knowingly unguarded: it is rare, and every rule that would
  catch it — reset when the field diverges from the picked title, or stops
  being a prefix of it — breaks appending to a picked title, which is the
  ordinary reason to keep typing after a pick. If it shows up in real use the
  fix is to make the carried rating legible ("recalled from _Gym_" until a
  drag), not to guess harder.
- **Item 15's first two mechanisms.** This replaced them rather than adding to
  them. The recall fires on one explicit action instead of on every keystroke,
  so there is no prefix to walk through, nothing to withdraw, and no per-slider
  ownership flag; the form lost both, and the two stories that existed only to
  pin them.
- **`bits-ui`'s combobox.** Read before it was refused — see Decisions.

## Where it landed

- `business/model/title-memory.ts` — `suggestTitles` answers a part-typed title
  with every rated title it could be naming.
- `SessionStore.suggestTitles` — hands that to the add-task form, which shows
  the titles under the field.
- `task-form.svelte` — the ARIA 1.2 combobox pattern inline, and the `fromPick`
  flag.

## Decisions

- **It replaced item 15's first two mechanisms rather than adding to them** —
  and it is smaller than what it replaced. The recall fires on one explicit
  action instead of on every keystroke. Rejected: keeping the per-keystroke
  machinery, which needed a prefix to walk through, a withdrawal path and a
  per-slider ownership flag.
- **The Map the suggestions land in is `$state`** — so a list that has already
  asked sees a later read arrive rather than showing nothing until the next
  keystroke. The reason for that changed on 2026-08-12 with item 16: the boot
  read now feeds the day's own hours, so it is awaited before the day is
  presented and the form is no longer on screen while the first one is in
  flight. What needs the reactivity is the banner's Retry landing a second read
  behind an open form, which is what the spec stages.
- **Emptying the field returns the sliders to 5/5/5, but only when a pick put
  the numbers there** (`fromPick`) — one rule that survived contact with its own
  story. Both halves are a failure somebody hit: without the reset, clearing a
  picked title and typing an unrelated task deploys it wearing the picked
  rating; without the guard, a typo in a hand-rated title costs the user the
  drags they made themselves. The flag has to clear on submit or the _next_
  task's drags are lost the same way. Editing short of empty keeps a pick on
  purpose — a renamed task is still that task, and its three numbers are on
  screen.
- **Hand-rolled, and the library was read before it was refused.** `bits-ui` is
  already a dependency and has a combobox, and the repo's `ui/` directory is
  shadcn-svelte ports of exactly those primitives — but its combobox is
  Select-shaped and this field is a free-text input that sometimes matches.
  `Combobox.Input` strips `value` from its own attributes and drives it from
  the root's `inputValue`, so `draft.title` would have two owners (R3); its
  `onkeydown` calls `preventDefault()` on Enter and opens the menu instead,
  which takes the form's only keyboard submit; and its `oninput` does not open
  the menu at all, so `open` had to be driven here regardless. What shipped is
  the ARIA 1.2 combobox pattern inline in `task-form.svelte` —
  `role="combobox"` with `aria-expanded`/`aria-controls`/`aria-activedescendant`
  over a `role="listbox"` of `role="option"` rows, arrow keys and Enter and
  Escape on the input, and `mousedown` prevented so a click does not blur the
  field before it picks.
- **Three of the pattern's details were missing until a review asked for
  them.** An arrow key reopens a list that Escape or a blur closed and
  highlights the end it was opened from — otherwise editing the field is the
  only way back, and reaching a suggestion cost two keystrokes. Escape, a pick
  and a blur all drop the highlight with the list it names — otherwise
  `aria-activedescendant` outlives its element. The highlighted row is scrolled
  into view — the list is uncapped, so it can be taller than the box that shows
  it, and a highlight below the fold is one nobody can see.
- **The scroll is an `$effect` on `active`** — rather than a call beside each
  assignment, because a reopen highlights a row whose `<li>` does not exist
  until the DOM has been patched.
- **Two characters, not three, and it is a judgement.** The match is a
  substring, so one character finds most of a history and the list would cover
  the sliders on every new task; two is the first length that discriminates and
  is shorter than the shortest titles anyone writes (`Gym`, `Run`). Matching is
  substring rather than prefix because the word the user reaches for is often
  not the first one, ordering is alphabetical, and the list is uncapped: any
  ranking would be invented and a cap would hide rated titles with no way to
  know.

## Open questions

- **Item 15's gate still has not been run** (no exported history exists), and it
  now gates both: if recurring titles turn out to be hand-rated already, this
  goes with it. The one question this item adds — whether a real history holds
  so many titles that alphabetical is unreadable — is answerable at the same
  moment, from the same backup.
