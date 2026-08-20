// A Stop hook: refuse to finish while the changed files fail checks the repo
// already has.
//
// The eval that motivated this measured 294 scored rule-outcomes across five
// sweeps. Rules eslint already enforces were still broken about a third of the
// time — `convention.no-relative-import` 6/10, R1 37/57 — and an agent that had
// run the linter could not have failed either. So the gap was never the wording
// of the rule; it was that nothing made the check run. Prose competes for
// attention, a hook does not.
//
// Scoped to changed files on purpose: a pre-existing error somewhere untouched
// must not block a finish, or the hook trains people to disable it.
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

const changed = execFileSync('git', ['status', '--porcelain'], {
	encoding: 'utf8',
})
	.split('\n')
	.filter(Boolean)
	.map((line) => line.slice(3).trim())
	.filter((path) => existsSync(path));

if (!changed.length) process.exit(0);

const failures = [
	run('npx', ['prettier', '--check', ...changed]),
	changed.some((path) => LINTABLE.test(path))
		? run('npx', ['eslint', '--no-warn-ignored', ...changed.filter((p) => LINTABLE.test(p))])
		: null,
	...['math-index', 'probe-registry', 'brief-size', 'comment-density', 'file-names'].map((script) =>
		run('node', [`scripts/${script}.mjs`, '--check']),
	),
].filter(Boolean);

if (!failures.length) process.exit(0);

console.error(
	`AGENTS.md §3 is not satisfied — these checks fail on the files you changed. ` +
		`Fix them, do not describe them:\n\n${failures.join('\n\n')}`,
);

process.exit(2);
