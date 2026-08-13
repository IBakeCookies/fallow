---
name: plan
description: Interview the user and write a Fallow feature spec to docs/features/<slug>.md — scenarios, out-of-scope, doc routing. Use when starting new work or fixing a known bug, before any code is written. Not about the app's own day planner.
---

# Planning a feature

Output is one file: `docs/features/<slug>.md`, from
[TEMPLATE.md](../../../docs/features/TEMPLATE.md). Nothing else. No code, no
subagents, no branch.

Read AGENTS.md's **doc table**, **§0** and **§4 settled decisions** — the map,
the scope rule the spec's out-of-scope section enforces, and the closed list.
Not §1–§3: those govern writing code, and this phase writes none. Never restate
a rule here; route to it.

The spec exists so the build phase can start cold. Assume its reader has none
of this conversation.

## Interview

Ask the user; do not infer. Batch questions with `AskUserQuestion` rather than
one at a time, and only for things that change what gets built — routine calls
are yours to make.

Worth asking about, in rough order:

- the observable outcome — what the user sees or can do that they cannot now
- the state it depends on: which day, which logs, which fits (almost nothing in
  Fallow is stateless — the §33 causal window alone means the same click gives
  different output on different data)
- the boundary — the nearby thing this is _not_
- empty, failed and first-run cases, which is where scenarios go missing

## A known bug is a one-scenario spec

Same file, same phases — R6 takes the failing test from the _reproduction_, and
a reproduction is already **Given / When / Then**. Interview for the exact
state it needs, write the one scenario, and let `/build` run unchanged.
**Goal** states the wrong behaviour and the right one; **Decisions** records the
cause. Restructuring with no behaviour change is neither — that is `/refactor`.

## Routing is yours, not the user's

Resolve **Read before building** by reading AGENTS.md's doc table and grepping
for the code that owns the behaviour. Cite files and MATH.md sections, not
areas. A spec that says "the model layer" has moved the search to the
implementer and spent its context there; that was the whole point of writing it
down.

## Scenarios

Write them with the user, in their words, then tighten:

- split every `and` into its own **Then**
- give every scenario a **Given**, even if it is "a fresh profile, no logs"
- pick the test level from `docs/testing.md`'s table and name the file
- math with no click gets a **Claim**, not a scenario — backed by a probe when
  the answer is a number that moves, by a test when it is a bound that holds

If a scenario cannot be phrased as something observable, it is not acceptance
criteria — it is implementation, and it belongs in **Decisions** or nowhere.

## Before finishing

- MATH.md changes? Name the section in **Read before building**.
- Does this re-open a settled decision (AGENTS.md §4, MATH.md §15/§16/§17, or
  ROADMAP's not-proposed list)? Say so to the user and stop — those are closed.
- On the roadmap already? Cite the item number; do not renumber anything.
- Leave **Open questions** empty by answering them, or stop and ask.

Then show the user the path and the scenario list, and say the build phase is
`/build <slug>`.
