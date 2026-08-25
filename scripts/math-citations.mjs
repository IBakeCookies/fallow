// Check that every §-citation in the tree resolves to a MATH.md section:
//   node scripts/math-citations.mjs           report the offenders
//   node scripts/math-citations.mjs --check   exit 1 when one exists (runs in `npm run lint`)
//
// scripts/math-index.mjs only reconciles MATH.md's index table against
// MATH.md's own headings — nothing checks that a citation scattered through a
// comment or a doc still resolves to a section that exists. A dangling one
// shipped in four code sites and `npm run lint` passed. This reuses
// math-index.mjs's heading regex and walks the tracked-and-untracked tree
// for citations to check against it.
//
// FROZEN is not scanned. `docs/features/` specs and ROADMAP.md record what was
// decided on a date and are never rewritten, so a section they cite is a fact
// about that day, not a promise about this one — policing them would mean
// editing the records to keep a checker quiet.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CHECK = process.argv.includes('--check');
const DIRS = ['src', 'scripts', 'docs', 'e2e', 'eval', '*.md'];
/** Dated records, never rewritten — see the note above. */
const FROZEN = [/^docs\/features\//, /^ROADMAP\.md$/];
/** `## 14. Title` and `### 8.11 Title` — numbered sections only, matches math-index.mjs. */
const HEADING = /^(#{2,3}) (\d+)(?:\.(\d+))?\.? (.*)$/;
/** A citation, optionally naming its document (`AGENTS.md §3`). A trailing `-\d+`
 *  makes it a line range like `§302-350`, not a section, so group 3 means "skip this
 *  one". An unnamed citation means MATH.md — that is the house convention. */
const CITATION = /(?:([A-Za-z0-9_/-]+\.md)\s+)?§(\d+(?:\.\d+)*)(-\d+)?/g;

function headingsOf(path) {
	return new Set(
		readFileSync(path, 'utf8')
			.split('\n')
			.map((line) => HEADING.exec(line))
			.filter(Boolean)
			.map((match) => (match[3] ? `${match[2]}.${match[3]}` : match[2])),
	);
}

// A citation naming AGENTS.md used to resolve against MATH.md's numbering, so four
// pointing past AGENTS.md's last numbered heading passed `--check`. A named document
// is checked against its own headings; only the nested AGENTS.md files have none, and
// a section citation against one of those has nothing to resolve to and should say so.
const headings = {
	'MATH.md': headingsOf('MATH.md'),
	'AGENTS.md': headingsOf('AGENTS.md'),
};

const files = execFileSync(
	'git',
	['ls-files', '--cached', '--others', '--exclude-standard', ...DIRS],
	{
		encoding: 'utf8',
	},
)
	.split('\n')
	.filter(Boolean)
	.filter((path) => !FROZEN.some((frozen) => frozen.test(path)));

let total = 0;
const offenders = [];

for (const path of files) {
	const lines = readFileSync(path, 'utf8').split('\n');

	lines.forEach((line, index) => {
		for (const match of line.matchAll(CITATION)) {
			if (match[3]) continue; // `§302-350` — a line range, not a citation

			const document = match[1]?.replace(/^.*\//, '') ?? 'MATH.md';
			const target = headings[document];

			total++;

			if (!target?.has(match[2]))
				offenders.push(`${path}:${index + 1}  ${match[1] ?? 'MATH.md'} §${match[2]}`);
		}
	});
}

offenders.sort();

if (offenders.length > 0) {
	console.error(offenders.join('\n'));

	if (CHECK) process.exit(1);
} else {
	console.log(
		`${total} §-citations verified against MATH.md's ${headings['MATH.md'].size} sections ` +
			`and AGENTS.md's ${headings['AGENTS.md'].size}`,
	);
}
