// Keep comments in components a note, not an essay:
//   node scripts/comment-density.mjs           report the densest files
//   node scripts/comment-density.mjs --check   exit 1 when one is over budget (runs in `npm run lint`)
//
// `task-row-shell.svelte` was 148 comment lines in 482 before this existed, and
// the prose rule against it was already written. It did not hold because "match
// the density of the file you are in" ratchets — at 31% it licenses the next
// 31%. So the anchor here is absolute, and it is two numbers, because the two
// ways this regrows do not look alike: RATIO catches a dense file, TOTAL catches
// a big file hiding a big essay (93 comment lines in 535 is only 17%).
//
// FLOOR exists for `routes/+layout.svelte` — 17 lines in 66, every one flagging
// a framework trap that makes correct code look deletable. Small and dense is
// how a good file reads; only volume is evidence of a habit.
//
// A count cannot tell an earned why from archaeology. AGENTS.md §0 names the
// three kinds that never earn their line; those stay a judgement call. Raising a
// limit is a decision, not a fix — cut first, and if a file genuinely needs the
// room, raise it in the commit that spends it and say which file made you.
import { readFileSync, readdirSync } from 'fs';

const RATIO = 0.2; // share of lines that may be comment, once past FLOOR
const FLOOR = 25; // comment lines below which RATIO is not enforced at all
const TOTAL = 60; // comment lines that are too many at any file size
const MIN_LINES = 40; // files shorter than this are not measured
// `component/ui/` is vendored by `shadcn add` and rewritten on update; the
// paraglide directory is generated on every build.
const SKIP = ['/component/ui/', '/paraglide/'];
const CHECK = process.argv.includes('--check');

const countComments = (src) => {
	let inBlock = false;
	let comment = 0;
	const lines = src.split('\n');

	for (const line of lines) {
		const text = line.trim();

		if (inBlock) {
			comment++;

			if (text.includes('*/') || text.includes('-->')) inBlock = false;

			continue;
		}

		if (text.startsWith('//')) {
			comment++;
		} else if (text.startsWith('/*') || text.startsWith('<!--')) {
			comment++;

			if (!(text.includes('*/') || text.includes('-->'))) inBlock = true;
		}
	}

	return {
		comment,
		total: lines.length,
	};
};

const measured = readdirSync('src', {
	recursive: true,
	encoding: 'utf8',
})
	.filter((name) => name.endsWith('.svelte'))
	.map((name) => `src/${name.split('\\').join('/')}`)
	.filter((file) => !SKIP.some((skip) => file.includes(skip)))
	.map((file) => ({
		file,
		...countComments(readFileSync(file, 'utf8')),
	}))
	.filter(({ total }) => total >= MIN_LINES)
	.map((row) => ({
		...row,
		ratio: row.comment / row.total,
	}))
	.sort((a, b) => b.ratio - a.ratio);

const over = measured.filter(
	({ comment, ratio }) => comment > TOTAL || (comment >= FLOOR && ratio > RATIO),
);

const say = ({ file, comment, total, ratio }) =>
	`${String(Math.round(ratio * 100)).padStart(3)}%  ${String(comment).padStart(3)}/${String(total).padEnd(4)}  ${file}`;

if (over.length > 0) {
	console.error(
		`${over.length} file(s) over the comment budget — ${Math.round(RATIO * 100)}% once past ${FLOOR} comment lines, ${TOTAL} at any size:\n`,
	);

	for (const row of over) console.error(say(row));

	console.error(
		'\nCut archaeology, restatement, and rules that a rules file already holds (AGENTS.md §0).',
	);

	if (CHECK) process.exit(1);
} else {
	const median = measured[Math.floor(measured.length / 2)];

	console.log(
		`${measured.length} components measured, none over budget (median ${Math.round(median.ratio * 100)}%, densest ${say(measured[0]).trim()})`,
	);
}
