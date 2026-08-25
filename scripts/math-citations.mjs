// Check that every §-citation in the tree resolves to a MATH.md section:
//   node scripts/math-citations.mjs           report the offenders
//   node scripts/math-citations.mjs --check   exit 1 when one exists (runs in `npm run lint`)
//
// scripts/math-index.mjs only reconciles MATH.md's index table against
// MATH.md's own headings — nothing checks that a `§37` scattered through a
// comment or a doc still resolves to a section that exists. A dangling one
// shipped in four code sites and `npm run lint` passed. This reuses
// math-index.mjs's heading regex and walks the tracked-and-untracked tree
// for citations to check against it.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CHECK = process.argv.includes('--check');
const DIRS = ['src', 'scripts', 'docs', 'e2e', 'eval', '*.md'];
/** `## 14. Title` and `### 8.11 Title` — numbered sections only, matches math-index.mjs. */
const HEADING = /^(#{2,3}) (\d+)(?:\.(\d+))?\.? (.*)$/;
/** A citation, e.g. `§11.8`. A trailing `-\d+` makes it a line range like `§302-350`
 *  into AGENTS.md, not a section, so the second group means "skip this one". */
const CITATION = /§(\d+(?:\.\d+)*)(-\d+)?/g;

const headings = new Set(
	readFileSync('MATH.md', 'utf8')
		.split('\n')
		.map((line) => HEADING.exec(line))
		.filter(Boolean)
		.map((match) => (match[3] ? `${match[2]}.${match[3]}` : match[2])),
);

const files = execFileSync(
	'git',
	['ls-files', '--cached', '--others', '--exclude-standard', ...DIRS],
	{
		encoding: 'utf8',
	},
)
	.split('\n')
	.filter(Boolean);

let total = 0;
const offenders = [];

for (const path of files) {
	const lines = readFileSync(path, 'utf8').split('\n');

	lines.forEach((line, index) => {
		for (const match of line.matchAll(CITATION)) {
			if (match[2]) continue; // `§302-350` — a line range, not a citation

			total++;

			if (!headings.has(match[1])) offenders.push(`${path}:${index + 1}  §${match[1]}`);
		}
	});
}

offenders.sort();

if (offenders.length > 0) {
	console.error(offenders.join('\n'));

	if (CHECK) process.exit(1);
} else {
	console.log(`${total} §-citations verified against MATH.md's ${headings.size} sections`);
}
