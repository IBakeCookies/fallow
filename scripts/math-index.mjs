// Rewrite MATH.md's section index from the document's own headings:
//   node scripts/math-index.mjs           rewrite the index in place
//   node scripts/math-index.mjs --check   exit 1 if it is stale (runs in `npm run lint`)
//
// The index was hand-maintained, and every agent that touched it had to
// reverse-engineer the table's rules from the table. Three of them are easy to
// get wrong and none of them are visible in the output:
//
//   - `**bold**` and backticks are stripped from titles, but a bare `*` is NOT
//     (§11.3's `T*` is part of the name, not markup)
//   - a parent's range ends where its last SUBSECTION ends, not where its own
//     prose does
//   - the ranges are a FIXED POINT: the index sits above everything it indexes,
//     so adding a row shifts every number it contains, its own included.
//     Computing against the pre-splice file yields a silent off-by-one on every
//     row — numbers that look right and are uniformly wrong. Hence the loop.
import { readFileSync, writeFileSync } from 'fs';

const FILE = 'MATH.md';
const CHECK = process.argv.includes('--check');
const START = '<!-- section-index:start -->';
const END = '<!-- section-index:end -->';
/** Widest title the table shows; longer ones cut to WIDTH-1 and take an ellipsis. */
const WIDTH = 57;
/** Columns the label and the range share; the range is right-aligned within them. */
const LABEL_RANGE_WIDTH = 19;
/** `## 14. Title` and `### 8.11 Title` — numbered sections only, not `### Properties`. */
const HEADING = /^(#{2,3}) (\d+)(?:\.(\d+))?\.? (.*)$/;

function rowsFor(lines, eof) {
	const heads = [];

	lines.forEach((line, index) => {
		const match = HEADING.exec(line);

		if (match)
			heads.push({
				line: index + 1,
				depth: match[1].length,
				number: match[3] ? `${match[2]}.${match[3]}` : match[2],
				title: match[4].replaceAll('**', '').replaceAll('`', ''),
			});
	});

	// Every section ends two lines before the next heading (one blank line between).
	heads.forEach((head, index) => {
		head.end = index + 1 < heads.length ? heads[index + 1].line - 2 : eof;
	});

	// ...except a parent, which swallows its children.
	heads.forEach((head, index) => {
		if (head.depth !== 2) return;

		for (let next = index + 1; next < heads.length && heads[next].depth === 3; next++)
			head.end = heads[next].end;
	});

	return heads.map((head) => {
		const label = `${head.depth === 3 ? '  ' : ''}§${head.number}`;
		const range = `${head.line}-${head.end}`;
		const title = head.title.length > WIDTH ? `${head.title.slice(0, WIDTH - 1)}…` : head.title;

		return `${label.padEnd(LABEL_RANGE_WIDTH - range.length) + range}  ${title}`;
	});
}

/** The index with `rows` in its fence and its own row count in the prose above. */
function spliced(lines, rows) {
	const open = lines.indexOf('```text', lines.indexOf(START));
	const close = lines.indexOf('```', open + 1);

	if (open === -1 || close === -1 || close > lines.indexOf(END))
		throw new Error(`no \`\`\`text fence between ${START} and ${END}`);

	return [
		...lines
			.slice(0, open + 1)
			.map((line) => line.replace(/\b\d+ rows below\b/, `${rows.length} rows below`)),
		...rows,
		...lines.slice(close),
	];
}

const original = readFileSync(FILE, 'utf8');
let current = original;

// Iterate to the fixed point: splicing changes the line numbers being spliced.
for (let pass = 0; ; pass++) {
	const lines = current.split('\n');

	const next = spliced(
		lines,
		rowsFor(lines, current.endsWith('\n') ? lines.length - 1 : lines.length),
	).join('\n');

	if (next === current) break;

	if (pass > 10) throw new Error('section index did not converge');

	current = next;
}

if (current === original) {
	console.log(`${FILE} section index is up to date`);
} else if (CHECK) {
	console.error(`${FILE} section index is stale — run \`node scripts/math-index.mjs\``);
	process.exit(1);
} else {
	writeFileSync(FILE, current);
	console.log(`${FILE} section index rewritten`);
}
