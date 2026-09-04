// Keep the rules docs readable:
//   node scripts/brief-size.mjs           report every file against its budget
//   node scripts/brief-size.mjs --check   exit 1 when one is over (runs in `npm run lint`)
//
// AGENTS.md was 1816 lines before it was split, so every agent paid ~26k tokens
// to change a translation. The split only holds if the brief stays one: the
// rule it encodes is AGENTS.md's own — statements there, the "because" in the
// topic file. A line count cannot tell prose from argument, but it does catch
// the way this actually regrows, which is a paragraph at a time.
//
// EVERY file the routing table names is budgeted, not the brief alone. Capping
// only the brief measured the one file that was not growing: between the split
// and 2026-09-04 the brief went 440 → 274 while presentation went 337 → 821,
// model 371 → 635, business 343 → 594 and testing 233 → 415, so the corpus
// passed the monolith the cap exists to prevent and the cap never fired. What
// an agent pays is its whole read path — the brief plus the layer file plus
// STYLE.md — and only a per-file budget prices that.
//
// Raising a budget is a decision, not a fix. Move the argument to the file that
// owns it, or cut it; if a file genuinely needs more room after that, raise its
// number in the same commit that spends it.
import { readFileSync } from 'fs';

const BUDGETS = {
	'AGENTS.md': 340,
	'src/lib/data/AGENTS.md': 240,
	'src/lib/business/AGENTS.md': 620,
	'src/lib/business/model/AGENTS.md': 660,
	'src/lib/presentation/AGENTS.md': 850,
	'src/lib/presentation/style/STYLE.md': 490,
	'docs/testing.md': 460,
	'docs/design.md': 175,
	'docs/deployment.md': 125,
};

const CHECK = process.argv.includes('--check');

const measured = Object.entries(BUDGETS).map(([file, limit]) => ({
	file,
	limit,
	lines: readFileSync(file, 'utf8').split('\n').length,
}));

const over = measured.filter(({ lines, limit }) => lines > limit);

if (over.length) {
	const listed = over.map(({ file, lines, limit }) => ` ${lines} of ${limit}   ${file}`).join('\n');

	console.error(
		`${over.length} rules file(s) over budget — move the argument to the file that owns it, or cut it:\n\n${listed}`,
	);

	if (CHECK) process.exit(1);
} else {
	const total = measured.reduce((sum, { lines }) => sum + lines, 0);
	const budget = measured.reduce((sum, { limit }) => sum + limit, 0);

	const tightest = [...measured]
		.sort((a, b) => a.limit - a.lines - (b.limit - b.lines))
		.slice(0, 3)
		.map(({ file, lines, limit }) => `${lines}/${limit} ${file}`)
		.join(', ');

	console.log(
		`${measured.length} rules files, ${total} lines of ${budget} — tightest: ${tightest}`,
	);
}
