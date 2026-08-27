# The sweep that missed two generators

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** finding M49

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found

`EnergyTaskInput.difficulty` and its two demands are independent knobs of the
model's input type, but the app never sets them independently: `toEnergyTask`
derives all three from the three integer sliders, and `getEffectiveDifficulty`
couples difficulty to the demands as dominant + 0.3·secondary. A generator that
draws difficulty free of the demands therefore describes days no user can file.

M40 found five such generators in 2026-08-19…25 and put them all on the surface.
`scripts/stop-advisor.probe.ts` was not among them and holds **two more**:

- `randomDays`, which drew `difficulty`, `enjoyment`, `cognitiveDemand` and
  `physicalDemand` as four independent picks;
- `WARMUP_HEAVY`, four hand-written high-amplitude tasks — `difficulty: 9`
  beside demands `0.9/0.2`, which the sliders project to **9.6**, and demands
  like `0.85/0.25` that are not slider values at all.

They back §8.11's one-step-vs-session table — the whole justification for
`adviseStop` pricing sessions rather than §8.10's own one-step marginal — and
its candidate-filter arm, both of which quote rates. Neither generator declared
itself, which under the rule M48 landed in `docs/testing.md` is the actual
defect: a model-level extreme may sit off the surface, but a day whose numbers
get quoted, or that witnesses app-level behaviour, has to be one `toEnergyTask`
could produce.

Raised by M39, which needed a reachable population for its own arm and gave that
arm its own generator rather than move these — because moving them re-decides
the table rather than answering M39.

## What was done

Both generators now draw from the three integer sliders through the shipped
`toEnergyTask`. `randomDays` draws mental 0–10, physical 0–10, enjoyment 1–10
per task, 2–4 tasks, window 6–12 h on the quarter hour. `WARMUP_HEAVY` keeps its
intent — four fresh high-amplitude tasks with long ϕ, on demands heavy enough to
drain the day to a stop inside the window — expressed as sliders 9/2/10, 8/3/9,
8/2/10 and 7/4/8, which is where its 9.6, 8.9, 8.6 and 8.2 difficulties come
from. M39's arm folds back into the shared `randomDays`; its own figures are
unchanged, because that generator is what it was already drawing from.

Every rate in the file was then re-read from its own run, and every figure
quoted outside the file was re-read with it.

## Every figure moved and no verdict did

**The session arm still beats the one-step arm, by more.** Mid-day false stops,
one-step against session, off-surface → on:

| λ₀  | random days             | warm-up-heavy fixture   |
| --- | ----------------------- | ----------------------- |
| 0.3 | 0.0/0.0 → **0.0/0.0**   | 0.0/0.0 → **0.0/0.0**   |
| 0.5 | 1.2/0.7 → **0.4/0.3**   | 0.0/0.0 → **0.0/0.0**   |
| 0.9 | 11.0/0.7 → **14.2/1.3** | 0.6/0.0 → **0.0/0.0**   |
| 1.3 | 19.1/0.6 → **28.1/0.0** | 14.9/1.0 → **16.2/3.8** |

The headline pair — the two λ₀ quoted in `adviseStop`'s own docblock — moves
19.7% → 14.2% at λ₀ = 0.9 and 24.7% → 28.1% at 1.3, against the session arm's
6.6% → 1.3% and 6.2% → 0.0%. The gap the shipped decision rests on **widens** on
the reachable surface. §8.11's qualitative claim — that the one-step arm cries
stop exactly when λ₀ is high — survives with a cleaner gradient: 0.0% at λ₀ 0.3
rising to 28.1% at 1.3.

**At-stop agreement is still identical between the two arms**, in every one of
the eight rows (14/27, 40/49, 70/71, 72/72; 0/2, 0/5, 12/13, 13/13), and so is
max lateness. That was the other half of the table's claim and it is untouched.

**The day's own breaks still beat the summed reading everywhere.** M38's
evidence re-read: mid-day false stops summed against breaks are 0.2/0.0,
1.8/0.3, 5.3/1.3, 0.0/0.0 on random days, and its headline witness — the warm-up
fixture's at-stop agreement at λ₀ = 0.9 — moves **1/13 → 11/13** off-surface to
**2/13 → 12/13** on it. Same shape, same size, same verdict.

**The candidate filter still helps, in the same direction.** `stop→continue` is
0.0% in every row (the filter never turns a stop into a continue — the
structural claim), filtered at-stop agreement is ≥ unfiltered everywhere, and
filtered max lateness is 0 in every row against up to 1 unfiltered. The λ₀ = 0.3
row sharpens: at-stop agreement 15/18 → 18/18 off-surface becomes **6/15 →
15/15** on it.

**M39's censor verdict is unchanged.** Its random-day cells are literally the
same numbers; the warm-up cells moved and say the same thing — 0 mid-day false
stops of 16, 17, 27 and 16 in the inverted cell against 4 of 587 elsewhere.

The one-step replica agreed with `adviseStop`'s own `marginalValue` at every
checkpoint in every arm, **0 mismatches**, which is the gate that makes any of
the above believable.

## What was deliberately not done

- **`WARMUP_HEAVY` was moved onto the surface rather than declared off it.**
  M48's rule permits a deliberate extreme to stay off-surface with a sentence
  saying which extreme it is. That exemption is for model-level bounds; this
  fixture witnesses app-level advisor behaviour and quotes rates, so the
  exemption does not apply and an equivalent reachable fixture exists.
- **Nothing shipped moved.** `adviseStop` is unchanged. Only figures moved, in
  its docblock and in the one suite fixture that quoted a rate.
- **The pre-2026-08-27 figures were not erased where they are dated records.**
  `what-the-open-task-scope-is-worth.md` and the ROADMAP's M38/M40 entries keep
  the numbers they were written with; this file is where the re-reading lives.
- **No other probe was audited for the same fault.** M40 closed on
  `grep 'difficulty: Math.max' scripts/` coming back empty — one hand-built
  signature, which neither of these two matches. That the sweep's grep was too
  narrow is the reason seven is not safely the count either. Re-searching on
  what the fault actually is, rather than on how five instances happened to be
  spelled, is a search and not a fix, and it belongs in its own change.
