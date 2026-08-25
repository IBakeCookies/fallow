# Three explanations the code outgrew

**Status:** landed 2026-08-14 · **Roadmap:** item 31, findings M4, M5 and M6

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Nothing the user sees changes and no code executes differently. Three
explanations describe a state the code has since left: §2 says two curve
properties are untested when the suite asserts both, a `zenith-energy.ts`
docblock quotes a lever-arm range §8.9 retracted, and the enjoyment slider's
`min: 1` is justified by a division that does not exist. After this, each says
what the code does, and the two extra copies of the false claim that routing
turned up are corrected with them.

## Scenarios

**None, and that is the finding's shape, not an omission.** M4, M5 and M6 are
all one class: a sentence describing code, and the code moved. No formula,
constant, bound, fit or runtime value changes, and `min: 1` stays `min: 1`, so
R6 has no behaviour to fail a test for and no Claim has a number to reach.

The R6 obligation is discharged the other way round: **M4's correction is that
the tests already exist.** `zenith.test.ts:142` asserts `p″ < 0` over
`DOMAIN_GRID` up to `T*`, and `:161` asserts `p(200) < 1e-6` and a negative
marginal at 1.5/2/4/10 × `T*`. They pass today, and the document's claim that
they do not is the whole defect. Do not add a pin for something a committed
fixture already holds.

The acceptance criteria are therefore the six document corrections enumerated
in **Read before building**, and the diff is comments and markdown only — which
is `AGENTS.md` §3's stated exemption from the reviewer pass.

## Out of scope

- **Any executable change.** No `.ts` expression, no `.svelte` prop, no slider
  bound, no probe assertion. Six comment and prose edits, a MATH.md §10 entry,
  three ROADMAP lines and a regenerated section index. If a diff line changes
  what runs, it is not this spec.
- **A new probe or test for any of the three.** M4's numbers are reached by
  `curve-marginal-facts.probe.ts` and by the two fixtures above; M5's are
  reached by `stp-recovery-fit.probe.ts` and quoted at `MATH.md:1565-1568`;
  M6 has no number. The finding is that the prose disagrees with artefacts that
  already exist, so building a new one measures nothing.
- **The `0.263` ceiling as a committed assertion.** It is closed form (below),
  a reader checks it without running anything, and M5 asks for one comment edit.
- **§2's Properties list itself** — the five properties, their derivations and
  the three marginal facts are correct and untouched. Only the sentence about
  what is tested is wrong.
- **`curve-marginal-facts.probe.ts`'s reason for existing.** Its docblock at
  `:14-18` — a hand derivation that is wrong reads exactly like one that is
  right — still holds and stays. Only the false clause inside it goes.
- **M1's landing.** The subset-bound work is uncommitted in this tree and edits
  `MATH.md` and `ROADMAP.md`. This spec does not touch its lines or land on its
  behalf; see the last decision for what that means for the citations below.
- **M2, M3, M7–M13 and M22**, the other upheld item-31 findings, and all of
  M14–M36, which item 29's rule keeps unverified until each has had its own
  check.

## Read before building

Every `file:line` below was read on 2026-08-14 **against a tree carrying M1's
uncommitted edits**. `MATH.md` citations above §10 and every `.ts`/`.svelte`
citation are stable; `MATH.md:5171` and the three `ROADMAP.md` lines will shift
if M1 lands first, so each is quoted here well enough to grep.

The six edits:

- `MATH.md:204-209` — §2 "Properties". "Concavity on the working range and the
  decaying tail are **not** [asserted] — no suite fixture evaluates `p″` or `p`
  at large `t`". Both are, at `zenith.test.ts:142` and `:161`. The probe
  sentence and its three 2026-08-06 margins stay; what changes is that the probe
  measures the slider-grid margins rather than standing in for absent fixtures.
- `MATH.md:25` — §0's preamble, "…and it is why §2's concavity property reads
  the way it does". The premise it points at is the sentence above, so it goes
  with it. §2's concavity property is not an example of an unbacked number.
- `scripts/curve-marginal-facts.probe.ts:5-12` — the docblock's "two of the five
  properties — concavity on the working range and the decaying tail — are
  asserted by no test in `zenith.test.ts` (the suite checks p(0), the peak, the
  closed-form average, the derivative and the activation bonus only)". False,
  and it contradicts `:26-27` in the same docblock ("The invariants it
  establishes are pinned by cheap fixtures in `zenith.test.ts`"). Cut the clause;
  do not replace it with an account of when it stopped being true (`AGENTS.md`
  §0 bans archaeology in comments).
- `src/lib/business/model/zenith-energy.ts:1674-1684` — `RECOVERY_PRIOR_STRENGTH`'s
  docblock, "≈ 0.2–0.4 for typical 30–60 min breaks from half drain, roughly
  half the drain fit's lever arm". Retracted; see the next line. The `MATH.md
§8.9` back-reference at `:1683` and the λ profile (53%/71%/88%) stay.
- `MATH.md:1565-1568` — §8.9's retraction, the text the docblock must agree
  with: "dD/dr ≈ 0.22–0.26 here against the drain fit's dD/dα ≈ 0.6–0.9 —
  roughly a THIRD of its lever arm, not the half once claimed", re-measured
  2026-08-06 by `stp-recovery-fit.probe.ts`. Correct as written. **No edit** —
  it is the target the comment moves to.
- `src/lib/presentation/component/task-form-fields.svelte:24-25` — "Enjoyment's
  minimum is 1 because ϕ divides by enjoyment (MATH.md §2): a 0 there is not a
  rating, it is a division by zero." Both halves are false; the reason and the
  citation are §1's declared domain (first decision below).
- `MATH.md:5171` — §22, "unlike enjoyment, which starts at 1 because ϕ divides
  by it (§2)". The same false claim, the same wrong citation, in the document.
  Found by grepping `divides by` while routing M6; corrected here under
  `AGENTS.md` §0's documentation exception. §22's own argument — that a
  difficulty 0 is the absence of a dimension, not a low rating — is correct and
  is what the contrast should rest on.

The evidence and the landing chores:

- `src/lib/business/model/zenith.test.ts:138-176` — the two fixtures M4 is
  wrong about, and their own comment at `:138-141` explaining that they were
  added because §2 once claimed the opposite. That comment is why §2 was
  over-corrected; leave it alone, it is accurate.
- `MATH.md:158-175` — §1's parameter map. `βᵤ ∈ [1,10]` at `:158`;
  `ϕ = c₁E + c₂β + c₃` and `p₀ = β/E` at `:162-165`. This is the section M6's
  comment should cite.
- `src/lib/business/model/zenith.ts:154-199` — `mapEnjoyability`,
  `calculateFlowStateTime`, `calculateInitialProductivity`, `calculatePeakScaling`.
  The shipped mappings; nothing divides by `beta`.
- `MATH.md:2247-2255` — §10's preamble, and `:2371` — its most recent dated
  entry, which is M1's. R7 requires an entry for this change: it corrects the
  document's and three comments' account of the model without moving a formula,
  constant, bound or fit. Append a **second** 2026-08-14 heading with its own
  title; do not merge into M1's.
- `scripts/math-index.mjs` — run it. §10's index rows carry line ranges
  (`MATH.md:32-36`), so inserting an entry shifts every section below it.
- `AGENTS.md:236-240` — §3's reviewer rule and the "only … comments … or docs"
  exemption this diff falls under.
- `ROADMAP.md`, the three item-31 lines beginning `- **M4 §2**`, `- **M5 §8.9**`
  and `- **M6 §2**` (822, 827 and 832 in the current tree). Mark each closed
  with this spec's link in the landing commit. M4's line says the framing is
  "repeat[ed]" by the probe and M6's says the reason "belong[s] to §1's declared
  domain" — both are right and this spec keeps them; M6's line does not mention
  the §22 copy, so add it.

## Decisions

- **`min: 1` is §1's declared domain, not a guard against division by zero.**
  `ϕ = c₁E + c₂β + c₃` is linear in β and `p₀ = β/E`, `a = E·β` divide by `E`;
  nothing divides by β anywhere (`zenith.ts:154-199`, grep `beta`). At `βᵤ = 0`,
  `β = 8/9` — finite, and `r = p₀/a = 1/E²` does not move at all, so the curve
  is not even degenerate. What breaks is that `β` leaves `[1,2]`, the range §1
  declares and every fit was built on. Rejected: keeping the citation and
  softening the wording, because §2 is not where the constraint comes from and a
  wrong pointer costs the next reader the same search it cost this one.
- **The bound that makes 0.4 unreachable is stated in the comment, not
  measured.** `dD/dr = m·g·d_pre·e^(−r·m·g)`; with `x = r·m·g` that is
  `(d_pre/r)·x·e^(−x)`, and `x·e^(−x) ≤ 1/e`, so `dD/dr ≤ d_pre/(r·e)` — at half
  drain and the default `r`, `0.5/(0.7·e) = 0.263`. Closed form, one line,
  checkable by reading. Rejected: a probe assertion, which would ship an
  artefact to prove an inequality that has a proof.
- **The docblock defers to §8.9's range rather than restating it.** Same move
  `zenith-energy.ts:1298-1299` already made for §8.6's timing table under M22 —
  a second copy of a measured range is R3's defect in prose, and it is exactly
  how this one went stale while §8.9 was correctly re-measured on 2026-08-06.
  Rejected: pasting `0.22–0.26` into the comment.
- **§2 says the fixtures assert both properties and the probe measures the
  margins.** Not "verified in tests" — that was the 2026-08-06 wording the
  fixtures were written to make true, and its vagueness is why the correction
  overshot into "not". Name the two `it` blocks' scope (`DOMAIN_GRID` up to
  `T*`, and `p(200)` plus the marginal past `T*`) so the next auditor compares a
  claim against a file rather than against a mood. Rejected: deleting the
  sentence, which loses the reason the probe exists.
- **§22's copy is corrected here, not filed as M37.** `AGENTS.md` §0: a rule any
  documented file states falsely is fixed in the diff that finds it, never
  reported as a note. It is one clause, it is the same claim as M6, and routing
  found it — splitting it into its own finding would make the next reader pay
  the grep again. Rejected: reporting it, which §0 permits only for code.
- **Three findings, one spec.** They share a class and a landing chore (one §10
  entry, one index regeneration, one commit) and touch six files between them
  with no overlap. Rejected: three specs, whose §10 entries and index runs would
  cost more than the edits.
- **Citations are given with their text, because the tree is dirty.** M1's
  uncommitted edits already moved the ROADMAP lines this spec cites once during
  routing. Rejected: waiting for M1 to land before writing this, which would
  make the same spec cost a second full routing pass.

## Open questions

None.
