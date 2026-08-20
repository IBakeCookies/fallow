# Rule-adherence eval

Measures whether a coding agent follows this repo's rules docs, and how that
changes with how much rule context it is given. Output is a per-rule
adherence-vs-tokens table.

## Run

**Docker must be running, and the sandbox image must exist.** Build it once:

```sh
npx sandcastle docker build-image --image-name fallow-eval \
  --dockerfile .sandcastle/Dockerfile
```

Rebuild it whenever `package-lock.json` changes — the dependency tree is baked
in. Roughly six minutes and 4.2 GB. (On WSL with Docker Desktop, a
`credsStore: desktop.exe` in `~/.docker/config.json` makes `docker build` fail
with `exec format error`; build with `DOCKER_CONFIG` pointed at a directory
holding a `config.json` of `{}`. Only the build is affected — `docker run` and
`docker exec` are not.)

```sh
node eval/run.mjs --dry-run                       # resolve prompts + token counts, invoke nothing
node eval/run.mjs --cases 'defer-*.md' --reps 3
node eval/run.mjs --conditions none,routed --concurrency 5
node eval/run.mjs --cases 'defer-*.md' --skip-canary   # rerun; isolation already proven
```

Flags: `--cases <glob>` (default `*.md`, relative to `eval/cases/`),
`--conditions <csv>`, `--reps <n>`, `--concurrency <n>` (default 3),
`--dry-run`, `--skip-canary`, `--max-turns <n>`. `--dry-run` resolves prompts
and token counts without touching Docker, so it works with no daemon.

Each run gets a fresh `git worktree` off the commit at `HEAD` when the driver
starts, bind-mounted into its own container. The agent under test is the
`claude` CLI in print mode inside that container.

## Credentials

`ANTHROPIC_API_KEY` is not obtainable on this org, so the agent runs on the same
OAuth login as an interactive session. The driver reads
`claudeAiOauth.accessToken` out of `~/.claude/.credentials.json` (or
`$CLAUDE_CONFIG_DIR/.credentials.json`) and injects **only that string** into
the container as `CLAUDE_CODE_OAUTH_TOKEN`, via sandcastle's provider `env`
option. Nothing is written to disk: `.sandcastle/.env` — sandcastle's normal
home for this — is never created, and `.sandcastle/.gitignore` ignores it
anyway if a future change starts using it.

Mounting `~/.claude` instead would be much easier and is exactly wrong: it would
carry `~/.claude/CLAUDE.md` and the whole `projects/*/memory/` tree into the
container, which is the context the canary exists to exclude.

That access token is good for hours. `--dry-run` aside, the driver prints how
long it has left and refuses to start a sweep on an expired one; for a sweep
that will outlast it, run `claude setup-token` and export the long-lived token
as `CLAUDE_CODE_OAUTH_TOKEN`, which the driver prefers when set.

## Context isolation

The only rules the agent may see are the ones its condition hands it, or `none`
and `targeted` measure nothing. `--bare` would guarantee that — it is the only
flag that suppresses `CLAUDE.md` loading — but it accepts no credential except
`ANTHROPIC_API_KEY`, which is not obtainable here. So isolation is built out of
the container instead, in three layers:

1. **Construction.** The agent's cwd is `/home/agent/workspace` inside a fresh
   container, so the directories `CLAUDE.md` discovery walks up into are
   `/home/agent` and `/` — not the host's. The image has no `~/.claude` beyond
   what the CLI creates for itself, and the host's is not mounted. Before the
   run, the worktree is stripped of `CLAUDE.md`, every tracked `AGENTS.md` at
   any depth, and `.claude/`. (Checked: stripping those does not affect
   `npm run depcheck`, `npx eslint` or the vitest runs.)
   `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` is set in the container environment,
   because `~/.claude/projects/<project>/memory/MEMORY.md` loads independently
   of any of the above.
2. **Per-run assertions.** After the strip and before the agent starts, the
   driver aborts — not warns — if the container can see
   `/home/agent/.claude/CLAUDE.md`, `/home/agent/.claude/projects`,
   `/etc/claude-code/CLAUDE.md`, `/CLAUDE.md`, `/home/CLAUDE.md`, a surviving
   `.claude/`, or a surviving tracked `AGENTS.md` / `CLAUDE.md`. This runs on
   **every** run rather than once per sweep: it costs one `exec`, and a silent
   leak would invalidate `none` and `targeted` retroactively.
3. **The canary.** One extra run, before the real ones, in a stripped worktree
   with zero injected context: it asks the agent to write `canary.json` naming
   every project instruction, rules or memory file in its context and the first
   line of each. If that file names `AGENTS.md`, `CLAUDE.md`, `MEMORY.md`, or
   any Fallow-specific rule content, the sweep aborts and prints what leaked.
   Its verdict is stored in the results file, so every sweep carries its own
   evidence. `--skip-canary` skips it for reruns where it already passed.

Not stripped, and worth knowing: `src/lib/presentation/style/STYLE.md` stays in
the worktree under every condition, including `none`. Only `AGENTS.md` and
`CLAUDE.md` are removed. That is unchanged from the pre-container harness.

Be clear about what the canary is worth: it is the agent's **self-report**. It
catches gross contamination — a whole rules file sitting in context — and it
does not catch subtle priming, an agent that misreports, or context the model
has absorbed some other way. Layers 1 and 2 are the actual guarantee; the canary
is the check that they were configured correctly on this machine, today.

The judge (`eval/judge.mjs`) still runs on the host, not in a container — it
never touches the worktree, only the diff and transcript text. It is spawned
from the OS temp dir with auto-memory off, so no `CLAUDE.md` above its cwd can
reach it either, and its prompt goes over stdin because a real diff plus
transcript is past the exec argument limit (`E2BIG`).

## What the agent under test may do

**Anything.** The shell inside the container is unrestricted:
`--dangerously-skip-permissions`, no `--allowedTools`, no allowlist.

This is not a convenience. The harness used to allowlist tools, and the sweep it
produced was worthless: of 72 rows, 60 carried a tool denial and the other 12 a
non-zero exit — **zero usable rows**. The reason is structural.
[AGENTS.md](../AGENTS.md) §3 requires the agent to run `npx prettier --write` on
the files it touched, and the allowlist denied it. Agents also reached for
`npx svelte-kit sync`, `rm` and `git clean`. So the conditions that were _given_
the rules (`targeted`, `monolith`) were the only ones that would ever attempt
the commands the rules demand — and they were the only ones penalised for it,
while `none` sailed through. The harness was measuring its own permission layer,
with a sign that favoured rule-ignorance.

An allowlist cannot be repaired here, only enumerated, and the set it would have
to enumerate is "whatever the rules tell the agent to do" — which changes every
time a rules doc does. **Do not reintroduce one.** If a future run needs to be
made safer, tighten the container (drop its network, cap its CPU via
`docker({ cpus })`), not the tool list.

Safety comes from the boundary instead, and the boundary is worth stating
exactly. The container mounts, read-write:

- the run's own throwaway git worktree, at `/home/agent/workspace`;
- the repo's `.git` directory, at its host path — sandcastle needs it because a
  worktree is not a standalone repository.

That is all. The host's `node_modules`, `src`, and `~/.claude` are not mounted
and are unreachable from inside (verified: `ls` on the host `node_modules` path
returns "No such file or directory"). The old `find -newermt` integrity walk
over `node_modules` is therefore gone — there is no longer a write path to
detect. The residual is `.git`: an agent inside the container could in principle
move a branch ref in the real repository. Nothing observed does, the worktree's
own `HEAD` is separate, and the mount is not optional.

`--max-turns` defaults to **100**. At 40 the agent exhausted the budget and
exited 1 on a single-rule `targeted` case, which measures how fast it works
rather than which rules it follows.

`notes` on a result row is now an alarm rather than an expectation: with no
allowlist, a `permission_denials` entry means something blocked a command the
rules asked for, which is a harness bug and not a rule failure. An empty `notes`
is what a usable row looks like.

## node_modules

The deterministic checks are `npx eslint`, `npm run depcheck` and
`npm run test:unit`, so the installed tree has to be there or nothing can be
scored. Three options, decided on per-run cost, because runs are ~6 min and
there are dozens of them:

| option                           | per-run cost      | host `node_modules` writable from container |
| -------------------------------- | ----------------- | ------------------------------------------- |
| mount the host tree              | ~0                | yes — the failure mode being designed out   |
| `npm ci` per run                 | 1–2 min           | no                                          |
| **bake into the image** (chosen) | one `cp -a`, 22 s | no — it is never mounted                    |

The image runs `npm ci` at `/home/agent/deps`, **outside** the worktree mount
point so the bind-mount cannot shadow it, and each run copies it in as
`./node_modules`. The copy is the container's own filesystem, so it is not a
write path back to the host the way the old harness's was. `.gitignore` already
covers `node_modules`, so it never reaches the diff.

The cost is that the image must be rebuilt when `package-lock.json` changes.
That is a once-per-dependency-change six minutes against a saving on every one
of dozens of runs, and — unlike mounting — it is what makes the integrity
assertion unnecessary rather than merely unlikely to fire.

A symlink would be cheaper than the 22 s copy, and was the first design. It
cost R6 every presentation case. `node_modules` pointing out of the worktree
puts the real tree outside vite's root, and vitest's `storybook` project loads
its setup file from `node_modules` by absolute path with no `/@fs/` prefix — so
the dev server does not own that path, SvelteKit's catch-all answers 404, and
every story file fails at import before a single `play` runs. The `client`
project is browser-mode too and passed throughout, because its setup files live
in the repo; that asymmetry is why the fault read as "storybook is broken" for
several sweeps rather than as a harness bug.

The image also carries Playwright's chromium, because vitest's `client` and
`storybook` projects are browser projects. The gitignored generated trees
(`src/lib/paraglide`, `.svelte-kit`) are regenerated per run by `npm run
prepare` rather than copied in.

## The diff

Stripping the rules docs is itself a change to the worktree, so the strip is
committed before the agent starts and the run's diff is taken against **that**
commit, not against `HEAD`. The previous harness skipped this, which is why its
rows carry evidence like `No files matching the pattern ".claude/settings.json"`
— eslint was being handed paths the harness itself had deleted.

`git add -A` then `git diff --cached <strip-sha>` also means work the agent
committed on its own counts, which an unrestricted shell makes possible for the
first time. `$CHANGED` uses `--diff-filter=d`: the checks feed those paths to
linters, and a linter exits non-zero on a file that is not there.

## Conditions

| condition  | context                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| `none`     | nothing — the floor                                                     |
| `targeted` | only the file(s) that own the case's rules (case `owns`)                |
| `routed`   | `AGENTS.md` + the layer file(s) for `touches` — today's design          |
| `monolith` | all nine docs concatenated — the ceiling, and the token-cost worst case |

`routed` adds `docs/testing.md` when the case's rules include R6.

## Case format

`eval/cases/<id>.md`:

```markdown
---
id: defer-button
class: multi # single | multi | buried
rules: [R2, R3, R6]
touches: presentation # presentation | business | model | data
owns: [src/lib/presentation/AGENTS.md] # for the `targeted` condition
---

## Prompt

<verbatim task text handed to the agent under test>

## Traps

- R2 — the naive answer computes the defer target in the component

## Checks

### deterministic

- rule: R2
  run: npx eslint --no-warn-ignored $CHANGED
  expect: exit 0

### judge

- rule: R6
  ask: Did the diff add a test for the new behaviour, and does the transcript show it run and fail before the implementation was written?
```

`$CHANGED` expands to the space-separated changed file paths, deletions
excluded; the command runs inside the run's container, with the worktree as its
cwd. `Traps` is for case authors —
the harness never shows it to the agent or to the judge.

## Result schema

`eval/results/<ISO-stamp>.json` is `{ base, canary, rows }`: the commit every
worktree was cut from (each run then adds a strip commit on top, and its diff is
taken against that), the canary's verdict for the sweep (`"skipped"` under
`--skip-canary`, otherwise `{ report, cost_usd }` where `report` is the
`canary.json` the agent wrote), and one row per (run, rule):

```json
{
	"run_id": "...",
	"case": "defer-button",
	"class": "multi",
	"condition": "monolith",
	"rep": 1,
	"context_tokens": 33800,
	"rule": "R2",
	"pass": false,
	"source": "deterministic",
	"evidence": "eslint: presentation-not-to-business-model at src/routes/+page.svelte:42",
	"notes": ""
}
```

`source` is `"deterministic"` or `"judge"`. `context_tokens` estimates the
concatenated rule context only (words × 4/3 — no tokenizer dependency), not the
case prompt. `notes` is empty on a clean run — which, with an unrestricted
shell, is the normal case. It carries any tool the permission layer refused and
a non-zero agent exit, so a row that failed for a harness reason stays
distinguishable from one that failed on the rule. A sweep where `notes` is
widely non-empty is not a measurement; that is what the pre-container harness
produced, and why it was replaced.
