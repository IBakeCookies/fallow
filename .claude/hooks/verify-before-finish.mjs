// A Stop hook: refuse to finish while the working tree fails checks the repo
// already has.
//
// The eval that motivated this measured 294 scored rule-outcomes across five
// sweeps. Rules eslint already enforces were still broken about a third of the
// time — `convention.no-relative-import` 6/10, R1 37/57 — and an agent that had
// run the linter could not have failed either. So the gap was never the wording
// of the rule; it was that nothing made the check run. Prose competes for
// attention, a hook does not.
//
// Prettier and eslint are scoped to the changed files on purpose: a
// pre-existing error somewhere untouched must not block a finish, or the hook
// trains people to disable it. `check` and the doc scripts take no paths and
// cannot be — `check` only skips the stops where nothing but `.md` changed, so
// a docs-only finish does not pay 13 s to type-check prose.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const LINTABLE = /\.(m?js|ts|svelte)$/u;

const run = (file, args) => {
	try {
		execFileSync(file, args, {
			encoding: 'utf8',
			stdio: 'pipe',
		});

		return null;
	} catch (error) {
		return `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
	}
};

// `stop_hook_active` is true when this hook already blocked once and the model
// is stopping again. Blocking twice on the same turn is how a Stop hook turns
// into a loop, so the second stop is always allowed through.
const input = JSON.parse(readFileSync(0, 'utf8') || '{}');

if (input.stop_hook_active) process.exit(0);

// Re-checked immediately before each command that takes paths, not once here:
// the repo is edited in parallel, and a scratch file deleted between the two
// makes eslint exit on ENOENT — a failure with no fix, reported as one to fix.
// Adding `check` took this hook from about a second to sixteen, so the window
// is wide enough to have happened on the first run after it.
const present = (paths) => paths.filter((path) => existsSync(path));

const changed = present(
	execFileSync('git', ['status', '--porcelain'], {
		encoding: 'utf8',
	})
		.split('\n')
		.filter(Boolean)
		.map((line) => line.slice(3).trim()),
);

if (!changed.length) process.exit(0);

const code = changed.filter((path) => LINTABLE.test(path));
// The one stop `check` sits out. Not eslint's file list: a `messages/*.json`
// value ending in `@` fails `check` inside generated code with no source file
// changed at all (docs/testing.md), so anything that is not prose has to run it.
const proseOnly = changed.every((path) => path.endsWith('.md'));

const failures = [
	// `--ignore-unknown`: `npm run lint` passes prettier a directory and it skips
	// files it has no parser for; passing paths explicitly makes those a hard
	// error instead, so a touched Dockerfile would block finishing on nothing.
	run('npx', ['prettier', '--check', '--ignore-unknown', ...present(changed)]),
	code.length ? run('npx', ['eslint', '--no-warn-ignored', ...present(code)]) : null,
	// The only type check the repo has — eslint enables no type-checked rule set,
	// so a type error is invisible to everything above it here. It reads the
	// project, not a file list, so it runs whole-tree or not at all.
	proseOnly ? null : run('npm', ['run', 'check']),
	// The same six `npm run lint` holds. These take no paths, so each one reads
	// the whole tree rather than the changed files — the scoping above is
	// prettier's and eslint's alone.
	...[
		'math-index',
		'math-citations',
		'probe-registry',
		'brief-size',
		'comment-density',
		'file-names',
	].map((script) => run('node', [`scripts/${script}.mjs`, '--check'])),
].filter(Boolean);

if (!failures.length) process.exit(0);

console.error(
	`AGENTS.md §3 is not satisfied — these checks fail on your working tree. ` +
		`Fix them, do not describe them:\n\n${failures.join('\n\n')}`,
);

process.exit(2);
