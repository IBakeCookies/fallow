# The arm wide enough to size the next

**Kind:** audit · **Status:** planning · **Roadmap:** the 2026-08-20 rules eval
("no arm has been widened")

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

[`the-sweep-that-could-not-have-decided`](the-sweep-that-could-not-have-decided.md)
made the harness state its own price and left the finding open in one sentence:
no arm has been widened, so no `targeted`-vs-`monolith` comparison has been
decided. That spec also recorded why not — 60 runs an arm is a decision about
spending, and the user's to make. It was made on 2026-09-02, and not for the
n = 60 the finding quoted.

**The arms go to n = 30, not 60, and the reason is the number itself.** The
three existing sweeps ask for n = 60, 23 and 42, and every one of those figures
is computed from a within-arm SD estimated on **six** runs. Buying 120 runs to
satisfy an n derived from n = 6 sizes the sweep on the least reliable quantity
in it. Thirty runs an arm pins the SD on five times the data, resolves a
difference in its own right, and prices the second half honestly if it is still
wanted.

## The sweep

`node eval/run.mjs --cases '*.md' --conditions targeted,monolith --reps 5`

Six cases × two conditions × five reps = **60 runs**, against base `4316e36`.
`runKey` is `case|rep`, so that is n = 30 per arm. Three departures from the
three sweeps it supersedes, each deliberate:

- **All six cases, not three.** The earlier sweeps used
  `calendar-month-cache`, `day-note-storage` and `drain-severity-chips`;
  `edit-form-focus`, `footer-legibility` and `lab-optimal-time` were never in a
  condition comparison. An arm sized on three cases is sized on a third of the
  case-to-case variance it will meet.
- **Concurrency 3, the default.** The box has four cores and every run does an
  `npm run prepare`, an eslint pass, a depcheck and a browser-mode vitest run.
  At concurrency 5 the deterministic checks compete for the cores they are
  scored on, and a starved vitest run is a false rule failure — it would
  contaminate the measurement in the direction of "the rules were not
  followed". Two hours of wall clock is the price of not doing that.
- **A fresh base, pooling with nothing.** The three earlier sweeps sit on
  `f845c87`, `3fa78c9` and `8b24a75`. Pooling across those is refused by
  `analyze.mjs` now and was wrong before it: several cases score a rule by
  running eslint over the whole changed file, so a commit that adds a rule
  makes the same check stricter.

## What the harness needed first

Neither was a finding on the roadmap; both were found while sizing the sweep,
and both make a wide arm possible rather than merely tidier.

- **Results were written once, after the whole pool finished.** A two-hour
  sweep that died on run 58 of 60 lost all 60. `eval/run.mjs` now rewrites the
  file as each run lands, serialised against the concurrent pool, so a partial
  results file is a valid one and the row count is the progress bar. `pool`
  stopped collecting return values it no longer has a reader for.
- **`analyze.mjs` read one file, and pooling two silently erased the
  widening.** Run identity was `condition|case|rep`, and `rep` restarts at 1 in
  every invocation — so two runs of the same arm from two sweeps, one passing
  and one failing, pooled to `n=1 per-run [0.50] SD n/a at n=1`, with effort
  reporting one run's cost for two. Identity is now `run_id`, the sign test's
  pair key is scoped per file, and a mixed-`base` pool is **refused** rather
  than warned about.

## Where it stopped, and how to finish it

Stopped on 2026-09-02 at **15 of 60 runs** against a usage limit, not a fault —
`eval/results/2026-09-02T09-22-24.494Z.json`, base `4316e36`, canary
`{"files": []}`, and `notes` empty on all fifteen. The incremental write is what
makes that a resumable state rather than a lost sweep; it was the first thing
the change bought.

Scored: `targeted` × `calendar-month-cache`, `day-note-storage` (reps 1–5 each),
and `monolith` × `calendar-month-cache` (reps 1–5). **45 runs remain**, and they
are asymmetric between the arms, so finishing takes two invocations — `--cases`
and `--conditions` are a cross product:

```sh
node eval/run.mjs --base 4316e365c8f353fb6b4420fcbf4cdf0a5f8e4201 \
  --cases 'drain-severity-chips.md,edit-form-focus.md,footer-legibility.md,lab-optimal-time.md' \
  --conditions targeted,monolith --reps 5 --concurrency 3 --skip-canary
node eval/run.mjs --base 4316e365c8f353fb6b4420fcbf4cdf0a5f8e4201 \
  --cases 'day-note-storage.md' \
  --conditions monolith --reps 5 --concurrency 3 --skip-canary
```

`--base` is not optional: the analyzer refuses to pool a different one, which is
the whole reason the flag exists. `--skip-canary` is earned rather than assumed
— the canary passed on this base, on this machine, on this date. Then pool all
three files in one call:

```sh
node eval/analyze.mjs eval/results/2026-09-02T09-22-24.494Z.json <the two new files>
```

Two operational figures for whoever resumes, both read off the stopped sweep
rather than the README's estimate: a run took **nearer 9 minutes than 6**, so 45
runs at concurrency 3 is about **2¼ hours**; and killing the driver leaks one
git worktree per in-flight run (three here, 1.3 GB on
`eval/day-note-storage-*` branches), which `git worktree remove --force` plus
`git branch -D` clears.

## Claims

Every figure is read off `node eval/analyze.mjs`, never computed by hand beside
it. The sweep did **not** finish, so the arms are not sized and the finding
stays open — but the attempt found something larger than what it was sent for.

- **`n = 60` was never a measurement.** It was read off
  `2026-08-19T19-48-11.317Z`, and **all 12 of that sweep's runs carry `notes`** —
  zero usable rows. Its notes are `denied Bash: npx prettier --write …`,
  `denied Bash: npx svelte-kit sync …` and `agent exited 1`: it is the
  pre-container allowlisted sweep `eval/README.md` already condemns in
  "What the agent under test may do" — _"of 72 rows, 60 carried a tool denial
  and the other 12 a non-zero exit — zero usable rows"_ — and it has exactly 72
  rows. The README also names the bias: the allowlist denied the
  `prettier --write` that AGENTS.md §3 demands, so `targeted` and `monolith`
  were the only arms that would attempt it and the only ones penalised, with a
  sign favouring rule-ignorance. **The largest of the three asks came from the
  sweep that measured the permission layer**, and "size on the largest" pointed
  at it.
- **A second historical figure moves, for the same reason.**
  `2026-08-20T12-31-25.374Z` has 2 contaminated runs of 12. Dropping them takes
  `targeted` to n = 4, pooled SD 34, and the ask from **n = 42 to n = 46** —
  and its pairing collapses from 6 pairs to **0**, because both dropped runs
  were `targeted`.
- **One of the three was always clean.** `2026-08-19T22-08-29.542Z` has no
  contaminated runs; its n = 23 stands exactly as the earlier spec recorded it.
- **The contamination was invisible because the analyzer scored it as
  disobedience.** Nothing filtered `notes`, so a refused tool or a dead agent
  counted as a broken rule. That is fixed here: a run with any noted row is
  dropped whole and the count is printed.

What today's own runs bought, and the reason they are not the answer:

- **40 runs attempted, 27 clean, 13 contaminated, $130.35.** Clean coverage is
  `calendar-month-cache` 5/5, `day-note-storage` 5/5,
  `drain-severity-chips` 5 `targeted` / 2 `monolith`, and **nothing at all** for
  `edit-form-focus`, `footer-legibility` or `lab-optimal-time`.
- **Pooled clean: `targeted` n = 15 at SD 11, `monolith` n = 12 at SD 13**,
  pooled SD 12 — resolving 14 points, and asking only n = 6 per arm for 20.
  **This is not the sizing answer.** Half the cases are missing, case-to-case
  variance is the term the arms are fighting, and an SD read off the cases that
  happened to run first is the same error as sizing off six runs, in better
  numbers. Recording it as a result is what this whole item exists to refuse.
- **The 13 contaminated runs were not a rule the agent broke.** Eight ran at
  turns = 1 and **$0.00** with empty stderr — the agent never executed — and
  three `drain-severity-chips` runs exited 1 after real work. They arrived in
  time order, not case order, and the harness's own `--cases` queueing makes
  those two indistinguishable in this data.

`eval/results/` is gitignored, so a results file is local evidence and a
`git clean -xdf` deletes it. The stopped sweep's 15 runs live on this machine
only; back the file up before any clean, or they are 15 runs to buy again.

## What was deliberately not done

- **n = 60 was not bought.** Sizing on a six-run SD is the thing this sweep
  exists to stop doing. What the pooled 30-run SD asks for is a claim above,
  and buying it is a second decision.
- **`none` and `routed` were not widened.** The open comparison is
  `targeted`-vs-`monolith` — the one the "do not trim the brief for tokens"
  finding rests on. Four arms at n = 30 is 120 runs for two comparisons nobody
  has asked to decide.
- **No case was added or edited.** A case changed mid-programme is a different
  measurement wearing the same id, and six cases were already more than any
  condition comparison had used.
- **`run.mjs` got no resume flag.** Incremental writes plus a poolable analyzer
  already let a dead sweep be finished by a second invocation on the same
  `--base`; a `--resume` that reads a partial file and diffs the task list is
  code for a failure that has not happened yet (§0).
