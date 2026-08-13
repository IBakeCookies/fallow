---
name: build
description: Implement a Fallow feature spec from docs/features/<slug>.md — failing tests, dispatch, review, land. Use after /plan, or when asked to implement an existing feature spec. Not for `npm run build`.
---

# Building a planned feature

Takes a slug. Reads AGENTS.md §0–§4, `docs/features/<slug>.md`, and **only the
files its "Read before building" section names**. If that section is thin, the
spec is not ready — go back to `/plan` rather than starting a search here.

If the spec has **Open questions**, answer them with the user before step 1.

## 1. Failing tests first, and they are yours to write

Transcribe each scenario into the test file it names, run it, and read the
failure. R6 in full — including what a wrong failure looks like — is
[docs/testing.md](../../../docs/testing.md).

Do this yourself. It is transcription, not design (the assertions are already
written), and a subagent that writes the test and the code in one pass cannot
prove it ever saw red.

A **Claim** backed by a test is R6 like any other: red first. Only a
probe-backed Claim is written afterwards, because a probe reports a number and
there is no red to watch — add its `scripts/PROBES.md` row in the same change.

## 2. Dispatch

One implementer subagent. Give it the spec path, the test command, the routing
list, and the **Out of scope** section verbatim. Not this conversation.

Its job is to make the failing tests green without touching anything the spec
did not name. It reports a change manifest — files and what changed — not a
narrated diff.

Subagents do not inherit this session's Honey hook, so paste the worker
directive from `honey:honey-superpowers` into the prompt.

## 3. Review

Follow **The reviewer pass** in [docs/testing.md](../../../docs/testing.md):
the blast-radius table, the brief that stops a reviewer padding, giving it the
root `AGENTS.md` plus the layer file for what the diff touches, and the triage
on the way back — verify every claim against the code, fix bugs, decline the
rest out loud in one line each.

Two things this phase adds:

- give the reviewer the spec's scenario list, so it can report a scenario the
  diff does not actually satisfy
- **one pass, as testing.md says.** If it shows the spec was wrong rather than
  the code, stop and surface that — no amount of code review fixes a spec.

## 4. Land

Nothing here is optional, and the docs move in the same commit as the code:

- the test files you touched pass, and `npx prettier --write` on touched files
  only — never the tree
- whatever the change itself puts in doubt: `npm run check` after a type-level
  change, `npm run depcheck` after crossing a layer
- a user-visible change is driven in a browser — the `verify` skill
- MATH.md updated in **this** commit if a formula, constant, bound or fit moved
- `scripts/PROBES.md` row added for any new probe
- a changed convention written into the area's `AGENTS.md`, not left in the
  feature file — the feature file is not where anyone looks it up
- ROADMAP.md: mark the item shipped and link the feature file; never renumber,
  and re-run `npx prettier --write ROADMAP.md` after (it renumbers lists)
- the spec's **Status** set to `landed <date>`, **Open questions** emptied

The five-command gate is the user's to run, not yours. Report what shipped,
which scenarios are green, and **what you ran and what you did not**.
