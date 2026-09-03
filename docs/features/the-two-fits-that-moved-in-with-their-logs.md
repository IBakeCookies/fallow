# The two fits that moved in with their logs

**Kind:** feature · **Status:** landed 2026-09-03 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

The user reads what the ⚡ fit and the 🪫 fit were each made from on **one**
screen, side by side, on the same page as the logs themselves. Flow Calibration
leaves `/`, Drain Calibration leaves `/energy`, and both land on `/analytics` as
a two-card grid above the log history. Neither moved card offers "In your logs
→" any more (it would point at the page it is drawn on) and neither offers a
reset (the log-history card's foot already holds one per kind, and two "reset ⚡
logs" buttons on one screen is the thing that card's foot exists to avoid).

## Scenarios

### Scenario — Both fits read side by side on `/analytics`

`e2e/analytics.e2e.ts`

- **Given** a profile with one ⚡ log and one 🪫 rating, both made before today
- **When** the user opens `/analytics`
- **Then** a card headed `Flow Calibration` is visible
- **Then** a card headed `Drain Calibration` is visible
- **Then** the Drain Calibration card prints `1` as its headline count
- **Then** both cards sit above the `Your logs` heading

### Scenario — Neither moved card offers a reset or a link to the logs

`e2e/analytics.e2e.ts`

- **Given** the same profile, on `/analytics`
- **When** the user reads the Flow Calibration card
- **Then** it contains no `Reset personalization` button
- **Then** it contains no `In your logs →` link
- **When** the user reads the Drain Calibration card
- **Then** it contains no `Delete all ratings` button
- **Then** it contains no `In your logs →` link

### Scenario — The drain card reads on a day with no tasks

`e2e/analytics.e2e.ts`

- **Given** a profile with one 🪫 rating from a past day, and no task today
- **When** the user opens `/analytics`
- **Then** the Drain Calibration card is visible

`/energy` drew it behind `hasTasks`; `/analytics` has no notion of a task, so
the gate does not come with it.

### Scenario — A rating logged today is named as deferred on `/analytics`

`e2e/analytics.e2e.ts`

- **Given** a profile whose only 🪫 rating was logged today
- **When** the user opens `/analytics`
- **Then** the Drain Calibration card prints `1` as its headline count
- **Then** the Drain Calibration card shows `1 rating logged today, counted from tomorrow`

### Scenario — `/energy` keeps Recovery and Stopping, and loses Drain

`e2e/energy-lab.e2e.ts`

- **Given** a profile with one task today and one 🪫 rating
- **When** the user opens `/energy`
- **Then** no card headed `Drain Calibration` is present
- **Then** a card headed `Recovery Calibration` is present
- **Then** a card headed `Stopping Calibration` is present

### Scenario — α's fit still reads on the parameter row it fits (pin)

`e2e/energy-lab.e2e.ts`

- **Given** a profile with one 🪫 rating dated before today, and a task today
- **When** the user opens `/energy`
- **Then** `#alpha-cog-fit` reads `≈ <value> ± <std> · n=1`

Pinned through the surface that exists today: the fit never lived on the drain
card (AGENTS.md §4, UI — "a fit reads on the parameter row it fits"), so moving
the card must not move the reading. Green on its first run.

### Scenario — The recovery card's link still scrolls to the log list

`e2e/analytics.e2e.ts`

- **Given** a profile with one ☕ rest pair logged, on `/energy`
- **When** the user clicks `In your logs →`
- **Then** the `Your logs` heading is in the viewport

The existing test drove this through the Lab's drain card because it was the
cheapest of the three to give a row to. The drain card is gone, so ☕ is the one
card in the app that still carries the link, and the test drives it.

### Scenario — `/` shows the plan advice full width and no fit card

`e2e/plan-advice.e2e.ts`

- **Given** a profile with tasks today and at least one ⚡ log
- **When** the user opens `/`
- **Then** no card headed `Flow Calibration` is present
- **Then** the plan advice card's width matches the Tasks card's width

### Scenario — The drain card's states

`src/lib/presentation/component/drain-calibration-card.stories.svelte`

A `play` function per state (`docs/testing.md`'s table — component).

- **Given** `logCount: 0`
- **Then** the headline reads `0`
- **Then** the sentence beneath opens with "No ratings yet"
- **Given** `logCount: 1`
- **Then** the headline label reads singular
- **Then** the sentence beneath no longer opens with "No ratings yet"
- **Given** `logCount: 4, pendingLogs: 1`
- **Then** the headline reads `4`
- **Then** the deferral line names `1`

### Scenario — The flow card keeps its states without its two verbs

`src/lib/presentation/component/flow-calibration-card.stories.svelte`

- **Given** the fitted story
- **Then** no `link` role and no `button` role is in the card
- **Given** each of the card's six existing stories
- **Then** the fitted, singular, rejected, default, deferred and all-deferred
  sentences each still render as they do today

## Out of scope

- **Recovery (☕) and Stopping (λ₀) stay on `/energy`.** Moving Drain out
  splits the Lab's three cards, and that is accepted: 🪫 is the one of the
  three whose rows the history already lists, and λ₀ has no log store at all.
  Neither of the two is restyled, regated or touched.
- **The log-history card is not touched** — its list, its ranged/all-time
  toggle, its three reset rows and its `id="log-history"` anchor all stay
  exactly as they are.
- **No shared card body.** AGENTS.md §4 (UI) settles that the calibration cards
  share a shell and not a body; the two moved cards end up looking alike and
  stay two components.
- **No new reading.** Neither card gains a number it does not print today; the
  drain card's `Drain ratings · N` line is respelled as a headline count, not
  supplemented.
- **`/`'s budget bar, metrics dashboard and plan advice card are unchanged**
  apart from the grid wrapper the departing card leaves behind.

## Read before building

- `src/routes/(app)/+page.svelte` — the `lg:grid-cols-2` wrapper at the foot
  holding `FlowCalibrationCard` and `PlanAdviceCard`, and the comment above it
  ("Half each") that goes with the card
- `src/routes/(app)/energy/+page.svelte` — the Drain Calibration block inside
  `{#if hasTasks}`, and `pendingDrainLogs` at the top of the script
- `src/routes/(app)/analytics/+page.svelte` — the load gate, the `Your model`
  card, and the `id="log-history"` card that already sits outside the gate
- `src/lib/presentation/component/flow-calibration-card.svelte` — loses
  `onresetlogs` and its `FitLogSummary`
- `src/lib/presentation/component/calibration-card.svelte` — the shell both
  cards keep
- `src/lib/presentation/component/fit-log-summary.svelte` — `withHistoryLink`
  stays: the ☕ card is still a caller
- `src/lib/business/store/energy-lab-store.svelte.ts` — `pendingDrainLogCount`
  and the comment it shares with `pendingRestLogCount`
- `src/lib/business/store/energy-lab-store.svelte.spec.ts` — the assertion that
  goes with it
- `src/lib/business/store/session-store.svelte.ts` — `pendingFlowLogCount`, the
  shape the drain count is derived to match
- `src/lib/business/AGENTS.md` — a public export is removed; that is where this
  repo prices its interfaces
- `src/lib/presentation/AGENTS.md` — four statements this change makes false, or
  finds already false; see **Decisions**
- `messages/{en,de,es,fr,zh}.json` — two keys out, two in
- `e2e/analytics.e2e.ts`, `e2e/energy-lab.e2e.ts`, `e2e/task-editing.e2e.ts` —
  the tests and comments that name the drain card's page
- `docs/testing.md` — the level table, and the rule that coverage moves with the
  logic it asserts

No MATH.md section changes: no formula, constant, bound or fit moves.

## Decisions

- **The reset stays once per page, at the log-history card's foot** — that card
  already draws one per kind, and `presentation/AGENTS.md` gives the reason:
  a bulk delete must not be the most prominent control on a card opened to read
  a list. Rejected: keeping the reset on the moved cards, because `/analytics`
  would then show two "reset ⚡ logs" and two "delete all ratings" controls a
  scroll apart.
- **Both moved cards drop `FitLogSummary` outright** — with no link and no
  reset it renders a `<p>` and nothing else, and a component wrapper around one
  paragraph is the thing AGENTS.md §0 bans. Rejected: passing
  `withHistoryLink={false}` and no `onreset`, because it keeps a two-step
  confirm-and-focus machine alive on a card that can no longer delete anything.
- **The drain card becomes its own component, mirroring the flow card's shape**
  (headline count, label, sentence beneath) — the shell stays shared, the
  bodies stay separate, so AGENTS.md §4 (UI) is honoured rather than re-opened.
  Rejected: one card component with a kind flag, which is the config blob that
  decision already refused.
- **The deferred-🪫 count is derived on `/analytics`** from
  `observations.drainObservations` and `session.today`, both of which the page
  already holds. Rejected: instantiating `EnergyLabStore` on `/analytics` to
  read one number off it; rejected: moving the count onto
  `EnergyObservationStore`, whose own doc comment says it has no notion of a
  day and must not grow one.
- **`EnergyLabStore.pendingDrainLogCount` is deleted** — its only caller was the
  card that left, and an export with no caller is one AGENTS.md §0 does not
  keep. `pendingRestLogCount` stays; ☕'s card did not move.
- **The two cards render outside the analytics load gate**, above the
  log-history card — the same reason that card is outside it: the gate's
  `{:else if}` is `hasData`, which is about day summaries, and a profile with
  measurements and no summaries would be told the app was never used.
- **The drain card loses its `hasTasks` gate** rather than gaining an
  equivalent. Rejected: gating it on the range having data, which would hide a
  fit's provenance on exactly the profile most likely to be checking it.
- **Message keys** — `energy_drain_log_count` and `budget_reset_personalization`
  lose their last callers and are deleted in all five locales;
  `drain_calibration_logs` / `drain_calibration_logs_one` are added to match
  `flow_calibration_logs` / `_one`. `budget_reset_confirm`,
  `budget_reset_title`, `energy_reset_drain_*` and `fit_logs_open_history` all
  keep callers and stay.
- **The drain card has no empty STATE, only an empty reading** (decided during
  the build, seeing the two side by side): the headline prints every count
  including `0`, and a sentence always follows it, so the pair reads as one kind
  of card rather than two. Only the sentence switches —
  `energy_calibration_empty` at zero, and `energy_calibration_rated` above it,
  which is the same prompt minus the "No ratings yet" the headline already says.
  Rejected: hiding the headline at zero, which is what `/energy` did and what
  made the empty pair look mismatched.

**Four documentation statements this change must correct in the same commit**
(AGENTS.md §0 — documentation is fixed, not reported):

- `presentation/AGENTS.md`, "One screen lists logs: `/analytics`" — "what stays
  with each card is the two verbs a FIT has" and "⚡'s on `/`'s calibration
  card, 🪫 and ☕ behind the Lab's folds" are both false afterwards: ⚡ and 🪫
  keep one verb, and only ☕ is behind a Lab fold.
- `presentation/AGENTS.md`, "The range readings are one card" — "Plan adherence
  and Your model sit half-and-half under the three full-width cards" is
  **already false today**: both are full-width siblings in
  `analytics/+page.svelte`, with no grid between them. It is corrected, and the
  same paragraph gains the new two-card grid.
- `presentation/AGENTS.md`, "The calibration cards share a shell, not a body" —
  "on the Lab all three cards are read-outs" becomes two, and the argument
  gains the pair now standing on `/analytics`.
- `e2e/analytics.e2e.ts` ("The three calibration cards link to this list"),
  `e2e/energy-lab.e2e.ts` ("both cards render the same shell" — already stale at
  three) and `e2e/task-editing.e2e.ts` ("three calibration cards each listed
  their own kind") each name a count that this change moves.

## Open questions

None.
