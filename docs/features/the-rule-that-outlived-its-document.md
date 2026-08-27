# The rule that outlived its document

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** finding M52

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

Found while closing M17. `e61d207` (2026-08-25) deleted the hand-dating policy
along with the document it governed: `docs/testing.md:302` now says "the dating
rule is gone with them", and `scripts/PROBES.md` says a probe's own header "is
the only home for a measured number: `MATH.md` holds derivations and quotes no
run output (R7), so there is no longer a back-reference to keep in step in
either direction."

That commit touched 44 files including `scripts/`. It removed **zero**
instances of the rule from the probes themselves.

## What was found

**34 of the 64 probes still instructed the reader to do the deleted thing** —
"Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
supports" — four of them adding "An undated number in that document is
unfalsifiable." A reader following that header today would violate R7, and it
is the header of the file whose whole job is to be the number's home.

The instruction was in two shapes, which is why the first count was 32 and the
true one is 34. Thirty-two carry it as its own paragraph; `adv2-budget-marginal`
and `prefix-replan` wrap it as a trailing clause on the "probe, not a test"
sentence, so a grep for the paragraph's first words missed both. Counting by
the phrase that cannot be re-wrapped away — `WITH ITS DATE` — finds all 34.

## What was repaired

Deletion only, per file. The paragraph goes and nothing replaces it: what it
should have said is already in `PROBES.md`'s header and `docs/testing.md`'s
"Quote the number in the probe, not in prose", and `AGENTS.md:62` is explicit
that a rule a rules file already holds gets a one-line citation or silence. The
two clause variants lose the clause and keep the sentence around it.

One more reference from the same cause, in the same file that now holds the
live rule: `docs/testing.md` cited "§14.1-2's 'the trim is free'", and §14 went
with §10-§37. The dead pointer is deleted and the sentence keeps its lesson.
`math-citations.mjs` could not have caught it — its regex reads a trailing
`-2` as a line range and skips the citation, which is the escape hatch the same
document describes at `:168`. Two of the four range-form citations in the tree
are that script's own examples; this was the only dangling one.

`plan-advice.probe.ts` lost the longest version, whose tail carried a real
lesson — the sweep behind "the trim is free" was thrown away, "which is exactly
how that claim stayed in the document while being false". That lesson is not
lost with it: `docs/testing.md:287-290` opens the probe-writing rules with it,
as the reason probes are committed at all.

## What was deliberately not done

- **The headers' other MATH.md references.** Filed as M53, unverified. Nineteen
  probe headers make 27 references to MATH.md that name no section, and after
  `e61d207` some of them point at narrative that no longer exists — but at
  least one (`energy-search-gap.probe.ts`, "MATH.md — which holds derivations
  only") is correct as written, so the population is mixed and every one needs
  reading against today's document. Counting them is not checking them.
- **A lint gate.** `math-citations.mjs` catches a `§N` that resolves to nothing;
  nothing catches an unnumbered sentence about MATH.md, or an instruction to
  follow a rule that was deleted. Both of this commit's findings are of that
  second kind. Naming the gate is not building it, and building it is a change
  to the lint contract.
