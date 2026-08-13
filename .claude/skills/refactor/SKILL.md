---
name: refactor
description: Consolidate or restructure shipped Fallow code with no behaviour change — pin, price, dispatch, review, land. Use for merging a mirrored definition, splitting or joining a module, or moving logic across layers.
---

# Refactoring shipped code

For code that already works. Read AGENTS.md §0–§2 and **§4**, plus
[docs/design.md](../../../docs/design.md) — this skill is that vocabulary
applied — and the area `AGENTS.md` for what you are moving.

§4 is not optional here. It is where this repo has already closed several of
the splits this skill exists to make, and the verdicts were measured rather
than asserted.

`/simplify` and `/code-review` cover the diff you just wrote. This covers code
that shipped some time ago, which is a different question.

## 1. Is this a refactor?

**If behaviour changes, it is not.** A rename that alters what the user sees, a
"cleanup" that fixes a bug on the way, an extraction that adds a guard — all
features. Stop and use `/plan`. Doing both at once means neither the tests nor
the reviewer can tell which change broke what.

## 2. Price it before touching it

Say what it costs and what it buys in the repo's own terms — **interface
arithmetic, never line count** ([docs/design.md](../../../docs/design.md)):

- public exports before → after
- callers touched
- what the change removes: a mirror (R3), a leak, a pass-through, an unknown
  unknown

**"It does not pay" is a valid, expected outcome.** Report it and stop: that
costs a paragraph, where doing it costs a review, a regression risk and a diff
over code that was fine. If §4 already settled this particular split, re-opening
it needs the evidence in the linked file, not an opinion.

## 3. Pin the behaviour first

The inverse of R6, and the reason this is its own skill: write the tests
against the **old** code and watch them **pass** — the refactor row in
[docs/testing.md](../../../docs/testing.md).

Cover what the move puts at risk, not the whole module. Logic crossing a layer
takes its coverage with it.

## 4. Dispatch

One subagent. Give it the pinned test command, the exact file list, the
arithmetic from step 2, and this line verbatim:

> **Do not edit a test.** If a pinned test has to change to pass, the behaviour
> moved — stop and report it rather than adjusting the assertion.

That is the sharpest guard here and it is mechanically checkable, so check it:
`git diff --stat` over the test files must be empty.

Paste the worker directive from `honey:honey-superpowers` — subagents do not
inherit this session's Honey hook.

## 5. Review

Follow **The reviewer pass** in [docs/testing.md](../../../docs/testing.md),
including giving the reviewer the root `AGENTS.md` and the layer file. One
addition: the finding that matters most here is **a behaviour the diff
changes**, which is the whole contract of this skill. One pass, then the same
triage — fix bugs, decline the rest out loud.

## 6. Land

- pinned tests green **and unmodified**; `npm run depcheck` if anything crossed
  a layer
- the area's `AGENTS.md` updated when a module boundary or a convention moved —
  that is the durable half, and it moves in this commit
- MATH.md untouched: a formula that changed means step 1 was answered wrong
- no feature file — nothing shipped to the user
- `npx prettier --write` on touched files only

Report: the arithmetic, what moved, what you ran and what you did not.
