# What the priority score actually prints

**Kind:** repair · **Status:** landed 2026-08-19 · **Roadmap:** item 31, findings M14, M15, M16,
M25, M26

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Close five item-31 leads that share one shape: a scale, a count or a section
number that `MATH.md` or a code comment named once, where the code beside it
ships something else. No formula, constant, bound or fit changes and no
executable line moves — R7 clause 3 throughout, logged as one shared `MATH.md`
§10 entry rather than five.

- **M14 / §3** — the priority score is defined on the model's scale; the metric
  layer ships two, and the printed one is `Number((P̄(T*)·10).toFixed(1))`.
- **M15 / §5** — the `phiPredictionStd` docblock says the allocator "currently
  consumes only the posterior mean". It has consumed the covariance since
  2026-07-18, through a different function.
- **M16 / §5.2** — "five rows (four fits)" against two source comments that say
  four rows and three whole counts. Five fits reach the card.
- **M25 / §1** — the parameter map ships from nine `zenith.ts` definitions with
  no section reference, and §1 carries no back-reference to what measures it.
- **M26 / §8.7** — the 🪫 form and its story cite §8.8, the 45-minute plan
  lattice, for the α fit.

## Scenarios

Nothing new is measured. Two committed probes were re-run and one of them was
widened:

- `rv13-prior-posterior.probe.ts` — σ_ϕ printed at 4 dp, which is how §13.1's
  n = 200 cell became **0.003** from a true **0.002473**: the probe's own 0.0025
  display, rounded a second time by the hand that transcribed it. The print is
  now 6 dp, so the same cell cannot be re-derived wrongly next time. The rest of
  the ladder (0.410839 / 0.191020 / 0.071920 / 0.022613), the 6.8%, the 26.3%
  and the 24% all reproduce, and `17.90 → 17.80` becomes `17.9 → 17.8` — what
  the probe prints and what a 1 dp score can carry.
- `curve-marginal-facts.probe.ts` — 1/√0.9 = **1.054093** → user difficulty
  **1.121708**, 1.35% of the slider range, now cited beside §1's cap paragraph
  along with the suite fixture that pins the maps.

## Out of scope

- **A `priority-scale` probe, and therefore every §3 percentage.** See the
  decision below.
- **`phiPredictionStd`'s production-deadness.** Reported in `ROADMAP.md`, not
  repaired: it has no caller outside tests, and the row that would print its
  band (`flow`) prints `≈ <minutes>` with no ± at all, while the other four rows
  get theirs from the `rate()` helper. Deleting an exported function is a code
  change, not a documentation fix.
- **§8.10's reconstruction guarantee.** Held for a maintainer ruling; the
  batch's one genuine model finding sits there and nothing in this commit
  touches it.
- **M33, M34, M35.** Never measured — a safety classifier stopped that agent —
  so they stay in "Raised and not verified" exactly as filed. Closing an
  unmeasured lead is the failure this round exists to purge.
- **`DEFAULT_SWITCH_COST`'s missing citation.** Uncited in the same file, but it
  is §4/§14, not §1.

## Read before building

- `AGENTS.md:62` — "a rule a rules file already holds: cite it in one line, or
  say nothing". This is the clause that lets a citation **replace** a
  restatement, and it is not the restatement clause at `:61`, which is scoped to
  what a signature or type already says.
- `scripts/PROBES.md`'s header — every `MATH.md` claim carries a dated
  back-reference to its probe; a closed form cites a fixture and gets no row.
- `MATH.md` §10's charter — it covers changes to this document and to code
  comments that changed no formula, constant, bound or fit, which is exactly R7
  clause 3.

## Decisions

- **§3 states both scales and no percentage.** The drafted paragraph's two
  headline claims are false about the shipped page: 2.76% measures
  `calculateSuggestedTasks`'s array, not the rendered list, which re-sorts the
  funded group by `#N` in `task-list.svelte`; and its "1,2,5,4,3" example day
  funds all five tasks, so the page prints 1,4,2,3,5. Landing it would put two
  false statements into the authoritative file — a worse defect than the hole
  being patched. The alternative was `scripts/priority-scale.probe.ts` in this
  same commit, and it was declined: measuring the _rendered_ order means
  re-implementing a presentation-layer sort inside `scripts/`, and §3 does not
  own that sort. So §3 names the two scales, says the ×10 is order-preserving
  where the 1 dp rounding is not, and says outright that how often the reader
  sees it is unmeasured.
- **A widened print, not a swapped numeral.** The n = 200 cell was the round's
  second transcribed catch. Editing 0.003 → 0.002473 without touching the probe
  leaves the next reader deriving 0.003 again from a 4 dp display, so the probe
  changed first and the cell quotes what it now prints.
- **M15's obvious repair was the wrong one.** `s/consumes only the posterior
mean/consumes the posterior/` on the `phiPredictionStd` docblock would install
  a new false claim: that function is deliberately never the allocator's input,
  because its σ̂² term is the user's own scatter rather than measurement debt.
  The docblock points at `phiParameterStd` instead, and the argument stays where
  it already lives, one function up.
- **§5.2 states the split, not a tally.** "(four fits)" is an undercount under
  every reading — §8.7 calls α_cog/α_phys two independent fits, and five
  `fitted` flags reach the card. The likeliest arithmetic behind it is §5.2's
  own "The three energy fits" eight lines above: ϕ plus three, λ₀ forgotten.
  A tally that needs a footnote is replaced by the thing it was reaching for:
  the recency-weighted ϕ row against four unweighted fits.
- **§1's citations go on interface docblocks, and one replaces its text.** Nine
  sites, following M13's idiom — per-field comments, `amplitudeRatio` and the
  `UserConstants` fields stay uncited. At `AMPLITUDE_RATIO_CAP` the docblock
  restated §1's cap paragraph almost verbatim (1/E², E < 1.054, difficulty
  ≈1.12), so the citation replaced the restatement rather than sitting on top of
  it.
- **§1's fixture is cited by test name, not by line.** The plan asked for
  `zenith.test.ts:93-118`; `MATH.md` cites this file by quoted test name
  everywhere else, and a line range in the authoritative document rots on the
  next insert. It reads `zenith.test.ts` ("Parameter Mappings", "Flow State
  Time").
- **Both §8.8 sites land together.** The story's comment repeats the form's
  claim; fixing one would leave the two files disagreeing about which section
  fits α.
- **The commit's own append point moves once.** The top-of-file work (§3, §1)
  landed last, and the §10 entry is one shared item rather than five, so every
  remaining target kept its position while the batch was edited descending.

## Open questions

- **Whether the 1 dp rounding is a defect or the contract.** §3 now documents
  that the printed score is coarser than the value it orders by. Nobody has
  ruled on whether the sort should read the un-rescaled value — that is a code
  question, and it needs the probe this commit declined to write.
- **What `phiPredictionStd` is for.** It is exported, tested, persisted-shape
  adjacent and called by nothing. Either the ϕ row grows a ± band or the
  function goes; the docblock now describes the first, honestly, as an intent.
- **`ROADMAP.md`'s running count of open leads.** It still said "the remaining
  thirteen" after three more batches had closed M24, M29 and M30. Corrected here
  to six, by hand — the same failure mode as an uncited figure: a number nothing
  recomputes.
