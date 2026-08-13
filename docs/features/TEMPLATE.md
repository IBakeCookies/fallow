# <Feature name>

**Status:** planning · **Roadmap:** item N (or `none`)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

One or two sentences: what the user can do after this that they cannot now.

## Scenarios

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
