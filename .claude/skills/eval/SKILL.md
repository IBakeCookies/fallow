---
name: eval
description: Run the rules-adherence eval harness — how much of this repo's rules docs a coding agent actually follows, per condition.
---

# Running the rules-adherence eval

`eval/README.md` is the reference; this file is the short path.

## Prerequisite: the sandbox image

Every run happens in a Docker container, so the daemon must be up and the image
must exist. Build it once, and again whenever `package-lock.json` changes:

```sh
npx sandcastle docker build-image --image-name fallow-eval \
  --dockerfile .sandcastle/Dockerfile
```

~6 min, 4.2 GB — it bakes this repo's `node_modules` in. `run.mjs` preflights
both the daemon and the image and tells you this command if either is missing.
`--dry-run` needs neither.

## Commands

```sh
node eval/run.mjs --dry-run                              # prompts + token counts, invokes nothing
node eval/run.mjs --cases 'lab-optimal-time.md' --conditions targeted --reps 1
node eval/run.mjs --reps 2 --concurrency 5               # the full 48-run matrix
node eval/run.mjs --cases 'lab-*.md' --skip-canary       # rerun, isolation already proven this session
```

The staged sweep — two invocations, 24 runs, each answering one question:

```sh
# A — stacking: does adherence fall when the rules pile up?
node eval/run.mjs --concurrency 5 --reps 2 \
  --cases 'day-note-storage.md,drain-severity-chips.md,calendar-month-cache.md' \
  --conditions targeted,monolith

# B — necessity: which rules does the model follow with no rules at all?
node eval/run.mjs --concurrency 5 --reps 2 --conditions none --skip-canary
```

B is the delete test: a rule at ceiling under `none` is a rule describing the
model's own default back to it, and it can go. Run A first — it carries the
canary.

Needs an OAuth login (`~/.claude/.credentials.json`) — no API key. The driver
injects only the access token into the container, never the `~/.claude`
directory (that would re-import the memory the canary exists to exclude), and
reports how many hours the token has left. For a sweep longer than that, export
`CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`. The driver aborts loudly on
a missing image, a dead credential, or a context leak, rather than
half-measuring.

## Reading the results

`eval/results/<ISO-stamp>.json` is `{ base, canary, rows }`. Two scripts read
it, and both are cheap — run them before spending on more sweeps:

```sh
node eval/analyze.mjs eval/results/<file>.json         # rates, pairing, effort
node eval/coverage-check.mjs eval/results/<file>.json  # were rules even present?
```

`analyze.mjs` reports row-level rates, run-level rates paired by (case, rep),
and turns/cost per condition. `coverage-check.mjs` greps each condition's own
context for the rules that condition was scored on — a rule the context never
stated is a rule the agent could not have followed, and its rows have to come
out of the headline.

- **`canary` first.** It is the sweep's evidence that the withheld conditions
  were actually withheld. If it names `AGENTS.md`, `CLAUDE.md` or `MEMORY.md`
  the run aborts before any case, so a results file that exists has a clean
  canary — but it is a self-report, good for gross contamination only.
- **`rows`** is one row per (run, rule): `pass`, `source`
  (`deterministic` | `judge`), `evidence`, and `notes`. A non-empty `notes` means
  a tool was refused or the agent exited non-zero — that row failed for a
  harness reason, not a rule reason, so exclude it before comparing conditions.
  **Check what fraction of rows have empty `notes` before reading anything
  else.** The allowlist-era harness scored 0 of 72; if that number is low again,
  the sweep is measuring the harness, not the rules.
- The measurement is the **spread** between `none` / `targeted` / `routed` /
  `monolith` at their `context_tokens`, not any single pass rate. One rep is
  noise; compare only across equal reps.

## Never put the tool allowlist back

The agent under test gets an unrestricted shell
(`--dangerously-skip-permissions`, no `--allowedTools`) because it is inside a
container. The previous harness allowlisted tools and produced **zero usable
rows out of 72**: `AGENTS.md` §3 tells the agent to run `npx prettier --write`
on touched files, the allowlist denied it, and so only the conditions that were
given the rules were ever penalised — `none` had no reason to run the command at
all. The bias pointed at the thing being measured.

An allowlist would have to enumerate "whatever the rules tell the agent to do",
which changes whenever a rules doc does. If a run needs to be made safer, tighten
the container, not the tool list. See `eval/README.md`, "What the agent under
test may do".

## Do not re-plan the sweep here

Orchestration lives in `run.mjs` on purpose. A sweep re-derived from prose each
time is not comparable to the last one, and non-comparable numbers are not a
measurement. If the harness needs to do something new, change `run.mjs` and
`eval/README.md` — never work around it by driving the runs by hand.
