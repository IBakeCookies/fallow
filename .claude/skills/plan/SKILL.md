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

## Kind is the first decision

TEMPLATE.md opens with four. Pick one, put it in the header: it decides whose
language **Goal** is written in and whether **Scenarios** are required.

`/plan` writes `feature`, `model` and `repair`. An `audit` records an
investigation that already happened — no interview, no build phase.

The test, applied to the Goal once it is written: **if it cannot be said in the
user's own words, it is not a `feature`.** Do not stretch one. A `repair`
dressed as a feature invents a user the change does not have, and every scenario
under it is fiction. Most of this directory is `model` and `repair` — that is
the honest count, not a gap to close.

## Interview

Ask the user; do not infer. Batch questions with `AskUserQuestion` rather than
one at a time, and only for things that change what gets built — routine calls
are yours to make.

Worth asking about, in rough order:

- the observable outcome — what the user sees or can do that they cannot now
- the state it depends on: which day, which logs, which fits (almost nothing in
  Fallow is stateless — the causal fit window alone means the same click gives
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

Cite the area `AGENTS.md` when the change adds or moves a **public export** —
that is where this repo prices its interfaces, and it is the half that outlives
the spec.

**A roadmap item is a want, not a record of how the code works.** Some are years
of edits old and assert mechanisms that have since moved. If routing disproves
one, say so in **Decisions** and put the ROADMAP line in **Read before
building** so `/build` corrects it in the landing commit. Do not quietly plan
around it — the next reader believes it.

## Scenarios

A `feature`'s section, and required there. A `model` or `repair` has no click:
it writes Claims, and only the Claim bullets below apply.

Write them with the user, in their words, then tighten:

- split every `and` into its own **Then**
- give every scenario a **Given**, even if it is "a fresh profile, no logs"
- pick the test level from `docs/testing.md`'s table and name the file
- math with no click gets a **Claim**, not a scenario — backed by a probe when
  the answer is a number that moves, by a test when it is a bound that holds
- **mark a Claim that pins existing behaviour `(pin)`.** It goes green on its
  first run, which is its pass condition and not a failure of R6 — `/build`
  knows the rule and cannot be left guessing which ones they are. A pin is
  phrased through the surface that exists TODAY, or it cannot run against the
  old code at all

If a scenario cannot be phrased as something observable, it is not acceptance
criteria — it is implementation, and it belongs in **Decisions** or nowhere.

## Before finishing

- Kind set, and **Goal** written in that kind's voice?
- MATH.md changes? Name the section in **Read before building**.
- Does this re-open a settled decision (AGENTS.md §4, the model rules, or
  ROADMAP's not-proposed list)? Say so to the user and stop — those are closed.
- On the roadmap already? Cite the item number; do not renumber anything.
- Leave **Open questions** empty by answering them, or stop and ask.

Then show the user the path and the scenario list, and say the build phase is
`/build <slug>`.
