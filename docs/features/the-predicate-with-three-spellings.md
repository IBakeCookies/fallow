# The predicate with three spellings

**Kind:** repair · **Status:** landed 2026-08-31 · **Roadmap:** the 2026-08-25
`SessionStore` review, the residue of S1

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is the area `AGENTS.md`. When later work changes
the behaviour, it writes its own feature file; it does not edit this one.

## The question

S1 gave the store one `#canEditPlan` getter and refused the four structural
edits through it. Two more copies of the same test survived it, written out
inline: the auto-save `$effect`, in the positive form, and
`readDeferDestination`, where it is the same refusal the move makes. No bug —
the three agreed — but a rule that has to be changed in three places is a rule
that will be changed in two.

## What was decided

**One getter, all three callers.** The predicate moved up beside the other
viewed-day derivations, since it is no longer about task mutations alone, and
its comment now names the three: edits, the auto-save, the defer preview. The
auto-save keeps its own `!isLoading` term — that is a boot guard, not a claim
about the day.

No behaviour changed, and no test changed: the 66 `session-store.svelte.spec.ts`
cases, which include the mid-navigation and past-day refusals of all three
callers, pass as they stood.

## What was deliberately not done

- **`#isViewingPast` was not folded in with it.** It has readers of its own that
  are not about writing, and a predicate that answers two questions is the shape
  this repair exists to undo.
