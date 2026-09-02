# The minutes the fit was closer

**Kind:** feature · **Status:** landed 2026-09-02 · **Roadmap:** item 34

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

On the analytics "Your model" card, I can see whether the app's fitted flow
time has actually predicted my ⚡ logs better than the defaults would have —
stated as minutes, over the logs it predicted. Today the card shows me the
fitted value and its history, but never whether trusting it has ever paid.

## Scenarios

### Scenario — the flow row says how much closer the fit has been

`src/lib/presentation/utils/calibration-descriptor.test.ts` (the sentence),
`e2e/analytics.e2e.ts` (visible on the card, seeded via the existing
back-dated-flow-log IDB helper)

- **Given** ⚡ logs on several past dates, at least 5 of them dated after the
  earliest log date, whose fitted predictions were closer than the defaults'
- **When** the user opens analytics
- **Then** the "Your model" flow row carries a sentence naming the mean
  minutes-per-log the fit was closer than the default, and the count of
  predicted logs it is measured over

### Scenario — a fit that has predicted worse says so

`src/lib/presentation/utils/calibration-descriptor.test.ts`

- **Given** a history whose fitted predictions were further from the ⚡ logs
  than the defaults'
- **When** the user opens analytics
- **Then** the sentence states the fit has been further, in the same
  minutes-and-count form — never hidden, never clamped to zero

### Scenario — too few predicted logs, no sentence

`src/lib/presentation/utils/calibration-descriptor.test.ts`

- **Given** ⚡ logs of which fewer than 5 are dated after the earliest log date
- **When** the user opens analytics
- **Then** the flow row renders exactly as it does today, with no skill
  sentence

### Scenario — fresh profile

`src/lib/presentation/utils/calibration-descriptor.test.ts`

- **Given** a fresh profile, no logs
- **When** the user opens analytics
- **Then** the flow row renders exactly as it does today, with no skill
  sentence

### Claim — the walk is MATH.md §5's prequential convention

`src/lib/business/session-history.test.ts`

- **Given** flow observations across several dates, today's included
- **Then** each scored log is predicted by the fit on logs dated strictly
  before its own date, aged against that date (same-date siblings excluded)
- **Then** a log whose fit had seen zero prior logs is not scored and not
  counted — at n = 0 both planes are the defaults and the gap is identically
  zero (MATH.md §5)
- **Then** logs dated today are scored: the fit that predicted them exists,
  even though no fit has read them (`pendingCount` names a different fact)
- **Then** the reported gap is mean|ϕ − ϕ̂_default| − mean|ϕ − ϕ̂_fitted| over
  all scored logs, positive when the fit was closer
- **Then** below 5 scored logs the snapshot field is `null`, so the descriptor
  never sees a number it must hide

## Out of scope

- **The MAE curve chart.** Item 34 names the curve; the shipped reading is the
  headline sentence (decided at planning, below). The per-n curves stay
  `scripts/phi-prequential-skill.probe.ts`'s output.
- **The coverage row and Σδ̂².** Item 34 itself rules both out — coverage is
  "already correct and unremarkable" (65.9–67.6% vs 68.3 nominal), Σδ̂² is
  item 6's probe reading and has no user.
- **The dashboard flow-calibration card.** No change to `/`'s card or its
  copy; the reading lands on analytics only.
- **Any change to the fit, the walk's inputs, or `phiPredictionStd`.** The
  reading consumes shipped functions.
- **Pricing the gap in plan value.** Unpriced by design (item 34): it is a
  prediction-accuracy reading, not an allocation-precision claim.

## Read before building

- ROADMAP.md item 34 — the item this ships; collapse it to date + link in the
  landing commit
- MATH.md §5, "Scoring convention" — the prequential walk this reading
  computes on real logs. **Gains the headline aggregation in the same commit
  (R7):** whole-walk MAE gap, the n ≥ 1 scored-block rule, and the ≥5 floor
- `src/lib/business/session-history.ts` — `fitFrom(observations, day)` is the
  walk's fit at every date (private, same file — the walk lands beside it);
  `readModelReport` already reads all sanitized ⚡ rows once, and
  `CalibrationSnapshot.flow` is where the new field goes (`skill: { gapHours,
scoredCount } | null`, null below the floor)
- `src/lib/business/session-history.test.ts` — the existing causal-window and
  aging pins; do not re-pin them, the Claim above asserts the walk only
- `src/lib/business/model/zenith.ts` — `fitUserConstants` returns the fallback
  as `constants` when not fitted, so scoring `fit.constants` is scoring what
  the app used that day; `calculateFlowStateTime` and the record's
  pre-mapped `E`/`beta` are the prediction
- `scripts/phi-prequential-skill.probe.ts` — the walk implemented once
  already, synthetic-side; the shipped walk mirrors its scoring, it does not
  import it
- `src/lib/presentation/utils/calibration-descriptor.ts` — the flow row this
  extends; the ≈/unit vocabulary the sentence must match
- `src/routes/(app)/analytics/+page.svelte` — the row markup the sentence
  renders in (R2: no logic here)
- `messages/en.json` (`ana_model_*`) — the new keys, closer/further/count
  variants, all five locales
- `e2e/analytics.e2e.ts` — the IDB helper that dates flow logs in the past;
  the e2e scenario seeds through it
- [src/lib/business/AGENTS.md](../../src/lib/business/AGENTS.md) — the
  snapshot gains a public field (the export-pricing half that outlives this
  spec)

## Decisions

- **Placement: the "Your model" flow row.** — Trust readings sit together, and
  the snapshot the sentence needs is already loaded there. Rejected: its own
  analytics card (a card's worth of chrome for one sentence); the dashboard
  flow-calibration card (more reach, no room, and its copy is about log
  counts, not skill). Decided with the user 2026-09-02.
- **Form: a headline sentence, not the curve.** — One number a user can act on
  ("the fit has earned trust" / "it has not"); the curve is diagnosis and
  stays in the probe. Rejected: the MAE curve chart and "both", as chart
  machinery for a reading whose verdict is one subtraction. Decided with the
  user 2026-09-02.
- **Statistic: whole-walk mean-absolute gap, default minus fitted, in
  minutes.** — Matches MATH.md §5's skill definition summed over the user's
  own history; positive means the fit was closer. Rejected: a trailing
  window, because it adds a constant nobody can justify yet — if staleness
  shows up in practice, that is a new item.
- **Blocks with n = 0 are not scored.** — There the fit IS the defaults; both
  predictions coincide and a zero-gap log would pad the count the sentence
  cites. "Predicted logs" means a fit existed that could differ.
- **Today's logs are scored.** — The fit on `date < today` predicted them;
  `pendingCount`'s "no fit has read them" is about fitting, not predicting.
  Both statements stay, they are about different verbs.
- **Gate at ≥5 scored logs, enforced in the business layer.** — Below it the
  snapshot field is `null` and the descriptor stays presentation-only; a
  2-log "18 min better" invites false trust. Decided with the user
  2026-09-02.
- **The walk refits via `fitFrom`, never via `fitSnapshots`.** — Snapshots
  exist only for days analytics was opened and cannot reproduce per-log
  aging; the walk is exact from the rows `readModelReport` already holds, no
  new store read. Item 5's cost rejection was per-day whole-history ENERGY
  fits; this is the ϕ ridge alone, linear per date.
- **A worse-than-default gap renders honestly.** — The reading exists to earn
  trust; a sentence that hides the losing sign is the calibration-theater the
  item was cut down to avoid.

## Open questions

None.
