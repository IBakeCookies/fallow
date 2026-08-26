# <Feature name>

**Kind:** feature · **Status:** planning · **Roadmap:** item N (or `none`)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Kind

One of four. It decides whose language **Goal** is written in, and which of the
sections below are required. Delete this section when filling the template in —
the field at the top is what survives.

| kind      | what changes                                                                            | **Goal** speaks for                     | requires                                                             |
| --------- | --------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| `feature` | something the user can see or do                                                        | the user                                | Scenarios                                                            |
| `model`   | what the solver computes — the outcome reaches the user, the change has no click        | the user, through the number that moves | Claims                                                               |
| `repair`  | a figure, constant, comment or doc that disagreed with the code — nothing shipped moves | nobody; say so outright                 | Claims, or neither                                                   |
| `audit`   | nothing was planned — an investigation, and what closed it                              | nobody                                  | _What was found, and what closed it_, in place of Goal and Scenarios |

`/plan` writes the first three. An `audit` is written after the fact and has no
build phase, so it reaches this directory without one.

A `feature` whose Goal cannot be said in the user's own words is one of the
other three wearing the wrong kind. That is the check this field exists for.

## Goal

One or two sentences, in the voice the kind picks:

- `feature` — what the user can do after this that they cannot now.
- `model` — the outcome that reaches the user, and the quantity that moves.
- `repair` — what disagreed with what, and that nothing the user sees changes.

## Scenarios

Required for a `feature`. A `model` or `repair` has no click and writes Claims
instead; an `audit` has neither.

The acceptance criteria, and the R6 tests — written here _before_ the
implementation, so the implementer transcribes them rather than inventing them
after the fact ([docs/testing.md](../testing.md)).

One observable per line, no `and` — a line with a conjunction cannot come back
half-true. Every scenario names the file its test lands in, at the level
`docs/testing.md`'s table picks.

### Scenario — <what the user can see or do>

`e2e/<name>.e2e.ts`

- **Given** <the state: which day, which logs, which fits>
- **When** <one action>
- **Then** <one observable>

### Claim — <what holds over the input space>

Model and math work, which has no click. Backed by a probe when the answer is a
number that moves, by a test when it is a bound that must hold
([scripts/PROBES.md](../../scripts/PROBES.md)).

`scripts/<name>.probe.ts` → MATH.md §N

- **Given** <the input space>
- **Then** <the identity, bound or number>

## Out of scope

What was considered and deliberately left out. This is the section that stops
the implementer helpfully building more than was asked (AGENTS.md §0).

## Read before building

Every kind carries this, including the ones with no user in them — it is the
build phase's input, not the reader's.

The routing — the exact files and sections, not the areas. This is what keeps
the implementer's context small: it reads these and nothing else.

- `<path>` — <why it matters here>
- MATH.md §N — <the formula this touches>

## Decisions

Each one: what was decided, why, and what was rejected. The rejected half is
the part git cannot reconstruct.

- **<decision>** — <why>. Rejected: <alternative>, because <reason>.

## Open questions

Blocking questions for the user. Empty at land.
