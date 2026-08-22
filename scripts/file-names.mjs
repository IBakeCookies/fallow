// Files and folders are kebab-case (AGENTS.md §2):
//   node scripts/file-names.mjs           report the offenders
//   node scripts/file-names.mjs --check   exit 1 when one is off (runs in `npm run lint`)
//
// The rule was written and never checked, so it held only as long as everyone
// remembered it. "Singular" stays a judgement call — a count cannot tell a
// plural from a word that ends in s.
import { execFileSync } from 'node:child_process';

// `.sandcastle` is deliberately absent: `Dockerfile` and its `.dockerignore`
// are names Docker dictates, which is the same exemption the tool-dictated
// names below get.
const DIRS = ['src', 'e2e', 'scripts', '.storybook', 'docs', 'eval'];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Names a tool dictates: SvelteKit's `+page` and `(app)` route syntax, dot
// files and dot directories, the uppercase `.md` rule files, and `.dc.html`
// design artboards — the design tool derives an artboard's name from the
// filename and looks for `Main.dc.html` by name, so kebab-casing one renames
// the artboard and loses the entry point.
const isExempt = (name) => /^[+(.]/.test(name) || name.endsWith('.md') || name.endsWith('.dc.html');
const CHECK = process.argv.includes('--check');

// Untracked-but-not-ignored too: a new file is the case this exists for.
const names = new Set(
	execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', ...DIRS], {
		encoding: 'utf8',
	})
		.split('\n')
		.filter(Boolean)
		.flatMap((path) => path.split('/')),
);

const offenders = [...names]
	.filter((name) => !isExempt(name) && !name.split('.').every((part) => KEBAB.test(part)))
	.sort();

if (offenders.length > 0) {
	console.error(`Not kebab-case: ${offenders.join(', ')}`);

	if (CHECK) process.exit(1);
} else {
	console.log(`${names.size} file and folder names are kebab-case`);
}
