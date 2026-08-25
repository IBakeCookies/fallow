// Rewrite MATH.md's section index from the document's own headings:
//   node scripts/math-index.mjs           rewrite the index in place
//   node scripts/math-index.mjs --check   exit 1 if it is stale (runs in `npm run lint`)
//
// The index was hand-maintained, and every agent that touched it had to
// reverse-engineer the table's rules from the table. Three of them are easy to
// get wrong and none of them are visible in the output:
//
//   - `**bold**` and backticks are stripped from titles, but a bare `*` is NOT
//     (`T*` is part of the name, not markup)
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
/** The ratio the preamble states and every figure below is computed at. */
const CHARS_PER_TOKEN = 4;
const thousandTokens = (chars) => `~${Math.round(chars / CHARS_PER_TOKEN / 1000)}k`;

/** Replace one preamble figure, or throw.
 *
 *  The preamble's numbers rot the moment their anchor stops matching, and that is
 *  silent: a whole-document token figure written when the file was 257k chars
 *  survived four hand-edits of the sentence around it while the document grew past
 *  590k. So a miss is a build failure, not a no-op — and the patterns take `\s+`
 *  between words so re-wrapping the paragraph moves a figure rather than freezing it. */
function substitute(text, pattern, replacement) {
	if (!pattern.test(text)) throw new Error(`section-index preamble no longer matches ${pattern}`);

	return text.replace(pattern, replacement);
}

function headsFor(lines, eof) {
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

	heads.forEach((head) => {
		head.chars = lines.slice(head.line - 1, head.end).join('\n').length;
	});

	return heads;
}

function rowsFor(heads) {
	return heads.map((head) => {
		const label = `${head.depth === 3 ? '  ' : ''}§${head.number}`;
		const range = `${head.line}-${head.end}`;
		const title = head.title.length > WIDTH ? `${head.title.slice(0, WIDTH - 1)}…` : head.title;

		return `${label.padEnd(LABEL_RANGE_WIDTH - range.length) + range}  ${title}`;
	});
}

/** The index with `rows` in its fence, and the row count and token figures above it. */
function spliced(lines, rows, heads) {
	const open = lines.indexOf('```text', lines.indexOf(START));
	const close = lines.indexOf('```', open + 1);

	if (open === -1 || close === -1 || close > lines.indexOf(END))
		throw new Error(`no \`\`\`text fence between ${START} and ${END}`);

	// Rank top-level sections only: a subsection sits inside its parent, so
	// "§8 at ~13k (§8.10 is ~4k)" would price the same prose twice.
	const [largest, second] = heads
		.filter((head) => head.depth === 2)
		.sort((a, b) => b.chars - a.chars);

	let preamble = lines.slice(0, open + 1).join('\n');

	preamble = substitute(preamble, /\b\d+\s+rows\s+below\b/, `${rows.length} rows below`);

	preamble = substitute(
		preamble,
		/document\s+is\s+~\d+k\s+tokens/,
		`document is ${thousandTokens(lines.join('\n').length)} tokens`,
	);

	preamble = substitute(
		preamble,
		/single\s+section\s+is\s+§[\d.]+\s+at\s+~\d+k/,
		`single section is §${largest.number} at ${thousandTokens(largest.chars)}`,
	);

	preamble = substitute(
		preamble,
		/\(§[\d.]+\s+is\s+~\d+k\)/,
		`(§${second.number} is ${thousandTokens(second.chars)})`,
	);

	return [...preamble.split('\n'), ...rows, ...lines.slice(close)];
}

const original = readFileSync(FILE, 'utf8');
let current = original;

// Iterate to the fixed point: splicing changes the line numbers being spliced.
for (let pass = 0; ; pass++) {
	const lines = current.split('\n');
	const heads = headsFor(lines, current.endsWith('\n') ? lines.length - 1 : lines.length);
	const next = spliced(lines, rowsFor(heads), heads).join('\n');

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
