// The execution layer for the eval: one containerised git worktree per run,
// with an *unrestricted* shell inside it.
//
// The shell has to be unrestricted. The previous harness allowlisted tools and
// produced zero usable rows, because AGENTS.md §3 tells the agent to run
// `npx prettier --write` on touched files and the allowlist denied it — so the
// conditions that were given the rules got penalised for obeying them while
// `none` sailed past. The command set an agent needs is "whatever the rules
// tell it to do", which no allowlist can enumerate ahead of time. Safety comes
// from the container boundary instead: see `isolationProbe` below for what that
// boundary is, and eval/README.md for what it deliberately is not.

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createSandbox } from '@ai-hero/sandcastle';
import { docker } from '@ai-hero/sandcastle/sandboxes/docker';
import { REPO_ROOT } from './conditions.mjs';

export const IMAGE_NAME = 'fallow-eval';

// Baked into the image at a path the worktree bind-mount cannot shadow.
const DEPS = '/home/agent/deps/node_modules';
const configDir = () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');

// Only the bearer token crosses into the container. Mounting `~/.claude` would
// carry the global CLAUDE.md and the whole `projects/*/memory/` tree in with
// it, which is precisely the context the withheld conditions must not have.
// `claude setup-token` mints a long-lived token; the interactive login's access
// token is good for hours, so its expiry is reported rather than assumed.
export const readOauthToken = async () => {
	if (process.env.CLAUDE_CODE_OAUTH_TOKEN)
		return {
			token: process.env.CLAUDE_CODE_OAUTH_TOKEN,
			expiresAt: null,
		};

	const file = path.join(configDir(), '.credentials.json');

	if (!existsSync(file))
		throw new Error(
			`no OAuth credentials at ${file} — log in once with \`claude\`, or set ` +
				'CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`) for a token that outlives a sweep.',
		);

	const { claudeAiOauth } = JSON.parse(await readFile(file, 'utf8'));

	if (!claudeAiOauth?.accessToken) throw new Error(`${file} has no claudeAiOauth.accessToken`);

	if (claudeAiOauth.expiresAt <= Date.now())
		throw new Error(
			`the OAuth token in ${file} expired at ${new Date(claudeAiOauth.expiresAt).toISOString()} — ` +
				'refresh it by running `claude`, or set CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`.',
		);

	return {
		token: claudeAiOauth.accessToken,
		expiresAt: claudeAiOauth.expiresAt,
	};
};

// The rules docs, all of them: with an unrestricted shell a `none` agent can
// `cat docs/testing.md` and read R6 in full, which makes `none` not none and
// narrows the very spread between conditions the sweep measures. MATH.md and
// scripts/PROBES.md deliberately stay — they are reference and registry, code
// comments cite `MATH.md §N` by name, and no case touches them.
const STRIPPED = [
	"'*AGENTS.md'",
	'CLAUDE.md',
	"'*STYLE.md'",
	'docs/testing.md',
	'docs/design.md',
	'docs/deployment.md',
].join(' ');

// Every path a fresh container could still be carrying project context on, plus
// the worktree's own after the strip below. Checked per run rather than once
// per sweep: it costs one exec, and a silent leak invalidates `none` and
// `targeted` retroactively.
const isolationProbe = [
	'ls -d /home/agent/.claude/CLAUDE.md /home/agent/.claude/projects /etc/claude-code/CLAUDE.md',
	'/home/CLAUDE.md /CLAUDE.md .claude 2>/dev/null',
	`; git ls-files ${STRIPPED}`,
].join(' ');

// Ordered, and every step matters:
//  - the dependency tree is copied in, not symlinked. A symlink is cheaper and
//    was the first design, but it puts the real tree outside vite's root, and
//    vitest's `storybook` project loads its setup file from `node_modules` by
//    absolute path with no `/@fs/` prefix — so the dev server does not own that
//    path, SvelteKit's catch-all answers 404, and every story file dies at
//    import while the `client` project (setup files in the repo) passes. That
//    made R6 unprovable on every presentation case. 22 s and 422 MB per run.
//    The copy is the container's own filesystem, so it is still not a write
//    path back to the host checkout.
//  - the context strip is what makes `none` and `targeted` mean anything.
//  - `prepare` regenerates the gitignored trees (paraglide, .svelte-kit) that a
//    bare checkout lacks and every deterministic check needs.
//  - the strip is then committed, so the run's diff is the agent's work rather
//    than the removal of nine rules files. The previous harness skipped this
//    and fed deleted paths into `$CHANGED`, where `eslint` exited 2 on them.
const setup = [
	`cp -a ${DEPS} node_modules`,
	`git ls-files -z ${STRIPPED} | xargs -0 -r rm -f`,
	'rm -rf .claude',
	'npm run --silent prepare >/dev/null',
	'git add -A',
	'git -c user.email=eval@fallow.invalid -c user.name=eval commit -q --allow-empty -m eval-base',
	'git rev-parse HEAD',
].join(' && ');

// `Sandbox.exec` returns a non-zero exit rather than throwing, so the steps
// whose failure would silently produce a wrong row check it themselves.
export const must = (label, result) => {
	if (result.exitCode !== 0)
		throw new Error(`${label} failed (exit ${result.exitCode}): ${result.stderr.trim()}`);

	return result.stdout.trim();
};

// A sandbox is a git worktree cut from `base` on its own branch, bind-mounted
// into a container off `IMAGE_NAME`. `body` gets the handle and the sha the
// agent starts from — the strip commit, not `base`.
export const withSandbox = async (label, base, token, body) => {
	const branch = `eval/${label}-${randomUUID().slice(0, 8)}`;

	const sandbox = await createSandbox({
		branch,
		baseBranch: base,
		cwd: REPO_ROOT,
		sandbox: docker({
			imageName: IMAGE_NAME,
			// `~/.claude/projects/<project>/memory/MEMORY.md` loads independently of
			// every file the strip removes, so it is switched off explicitly even
			// though a fresh container has no such directory.
			env: {
				CLAUDE_CODE_OAUTH_TOKEN: token,
				CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
			},
		}),
	});

	try {
		// Last line only: the generators above are chatty on stdout, and the sha is
		// what the run's diff is taken against.
		const from = must('setup', await sandbox.exec(setup))
			.split('\n')
			.at(-1)
			.trim();

		const leaks = (await sandbox.exec(isolationProbe)).stdout.trim();

		if (leaks)
			throw new Error(
				`project context is reachable from inside the container, so the withheld ` +
					`conditions would measure nothing:\n${leaks}`,
			);

		return await body(sandbox, from);
	} finally {
		// Leave the worktree clean so `close()` removes it instead of preserving
		// it, then drop the branch, or a sweep leaves dozens of both behind.
		await sandbox.exec('git reset -q --hard && git clean -qfdx').catch(() => {});
		await sandbox.close().catch(() => {});

		await promisify(execFile)('git', ['branch', '-D', branch], {
			cwd: REPO_ROOT,
		}).catch(() => {});
	}
};

// stdin, not argv: `monolith` is ~160 KB of concatenated docs, past Linux's
// 128 KB limit on a single argument. `--dangerously-skip-permissions` is the
// point of the container — see the header.
export const invokeAgent = (sandbox, prompt, maxTurns) =>
	sandbox.exec(
		'claude -p --dangerously-skip-permissions --output-format stream-json --verbose ' +
			`--max-turns ${maxTurns}`,
		{
			stdin: prompt,
		},
	);
