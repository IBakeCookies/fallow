// Reads a results file and reports the four things a sweep is run to learn:
// whether the conditions differ, whether the difference survives pairing,
// whether the sweep was wide enough to have decided that at all, and whether an
// arm won by working harder rather than by following rules better.
//
//   node eval/analyze.mjs eval/results/<file>.json

import { readFileSync } from 'node:fs';

const [file] = process.argv.slice(2);

if (!file) {
	console.error('usage: node eval/analyze.mjs <results.json>');
	process.exit(1);
}

const { rows } = JSON.parse(readFileSync(file, 'utf8'));
const conditions = [...new Set(rows.map((r) => r.condition))];

// --- rates -----------------------------------------------------------------

const rate = (subset) => ({
	pass: subset.filter((r) => r.pass).length,
	total: subset.length,
});

const fmt = ({ pass, total }) =>
	`${pass}/${total} = ${total ? ((100 * pass) / total).toFixed(0) : '--'}%`;

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

// Sample SD, in the unit its input carries — per-run adherence rates, so a
// spread of 0.39 is 39 points of adherence. Undefined on one run, and every
// caller says so rather than printing the 0 a guard here would invent.
const spread = (xs) => {
	const centre = mean(xs);

	return Math.sqrt(xs.reduce((sum, x) => sum + (x - centre) ** 2, 0) / (xs.length - 1));
};

console.log(`\n${file}\n${rows.length} rows, ${conditions.length} conditions\n`);
console.log('ROW LEVEL');

for (const condition of conditions)
	console.log(
		`  ${condition.padEnd(10)} ${fmt(rate(rows.filter((r) => r.condition === condition)))}`,
	);

// --- run level -------------------------------------------------------------
//
// A run contributes many rows, so row-level counts overstate the evidence: the
// rows within one run share an agent, a prompt and a context. Pairing by
// (case, rep) is what the conditions were actually varied across.

const runKey = (row) => `${row.case}|${row.rep}`;
const runs = new Map();

for (const row of rows) {
	const key = `${row.condition}|${runKey(row)}`;

	const run = runs.get(key) ?? {
		condition: row.condition,
		pair: runKey(row),
		pass: 0,
		total: 0,
		turns: row.turns ?? null,
		cost_usd: row.cost_usd ?? null,
	};

	run.pass += row.pass ? 1 : 0;
	run.total += 1;
	runs.set(key, run);
}

const byCondition = (condition) => [...runs.values()].filter((r) => r.condition === condition);

console.log('\nRUN LEVEL');

for (const condition of conditions) {
	const list = byCondition(condition);
	const rates = list.map((r) => r.pass / r.total);

	console.log(
		`  ${condition.padEnd(10)} n=${list.length} ` +
			`per-run [${rates.map((r) => r.toFixed(2)).join(', ')}] ` +
			`mean ${mean(rates).toFixed(2)} ` +
			`SD ${rates.length > 1 ? `${(100 * spread(rates)).toFixed(0)} points` : 'n/a at n=1'}`,
	);
}

// A sign test rather than a t-test: n is small, the per-run rates are bounded
// and lumpy, and the only claim worth making from six pairs is a direction.
//
// Beside it, what the sweep could have seen. A direction that came out tied, or
// a difference that came out small, means nothing until the arms are wide enough
// to resolve it, and these arms are a handful of runs against a within-arm SD in
// the tens of points. Both figures are read off this sweep's own spread: the
// difference it can resolve at the n it ran, and the n it would take to resolve
// TARGET_DELTA. Pairing by case is reported second and planned on last — it has
// cut the spread to a fifth on one sweep and raised it on another, so the
// unpaired figure is the one a sweep should be sized by.

const TARGET_DELTA = 0.2; // the difference a condition comparison is run to see
const Z_SQUARED = 7.849; // (z₀.₉₇₅ + z₀.₈₀)², two-sided α = 0.05 at 80% power

for (const [i, a] of conditions.entries())
	for (const b of conditions.slice(i + 1)) {
		const pairs = [...new Set(byCondition(a).map((r) => r.pair))]
			.map((pair) => [
				byCondition(a).find((r) => r.pair === pair),
				byCondition(b).find((r) => r.pair === pair),
			])
			.filter(([x, y]) => x && y);

		if (!pairs.length) continue;

		const better = pairs.filter(([x, y]) => y.pass / y.total > x.pass / x.total).length;
		const worse = pairs.filter(([x, y]) => y.pass / y.total < x.pass / x.total).length;
		// Two-sided exact p for the all-one-direction case, which is the only
		// case a handful of pairs can produce: every non-tied pair had to land
		// the same way. Ties carry no signal and leave the test.
		const decided = better + worse;
		const p = decided && (better === 0 || worse === 0) ? 2 * 0.5 ** decided : null;

		console.log(
			`\n  ${b} vs ${a}: better in ${better}, worse in ${worse}, ` +
				`tied in ${pairs.length - better - worse} of ${pairs.length}${
					p === null ? '' : `, sign test p=${p.toFixed(3)}`
				}`,
		);

		if (pairs.length < 2) continue;

		const arms = [a, b].map((condition) => byCondition(condition).map((r) => r.pass / r.total));
		const armSize = Math.min(...arms.map((rates) => rates.length));
		const pooled = Math.sqrt(mean(arms.map((rates) => spread(rates) ** 2)));
		const paired = spread(pairs.map(([x, y]) => y.pass / y.total - x.pass / x.total));
		const needed = (sd, perArm) => Math.ceil((perArm * Z_SQUARED * sd ** 2) / TARGET_DELTA ** 2);
		const resolvable = (sd, perArm, n) => 100 * sd * Math.sqrt((perArm * Z_SQUARED) / n);
		const points = (x) => x.toFixed(0);

		console.log(
			`    SD ${points(100 * pooled)} points per arm at n=${armSize}, ` +
				`${points(100 * paired)} paired over ${pairs.length}: ` +
				`resolves ${points(resolvable(pooled, 2, armSize))} points ` +
				`(${points(resolvable(paired, 1, pairs.length))} paired); ` +
				`${(100 * TARGET_DELTA).toFixed(0)} points needs n=${needed(pooled, 2)} per arm ` +
				`(paired n=${needed(paired, 1)})`,
		);
	}

// --- effort ----------------------------------------------------------------
//
// The confound this exists for: an arm with more context may score higher
// because it spent more turns, not because the rules reached it. Rows written
// before the harness recorded effort carry null, and saying so beats reporting
// a zero.

console.log('\nEFFORT');

const missing = [...runs.values()].filter((r) => r.turns === null);

if (missing.length === runs.size) {
	console.log('  turns/cost absent from every row — sweep predates the effort fields, UNTESTABLE');
} else {
	if (missing.length) console.log(`  ! ${missing.length} of ${runs.size} runs lack effort data`);

	for (const condition of conditions) {
		const list = byCondition(condition).filter((r) => r.turns !== null);

		if (!list.length) continue;

		const total = (pick) => list.reduce((sum, r) => sum + (pick(r) ?? 0), 0);
		const turns = total((r) => r.turns) / list.length;
		const cost = total((r) => r.cost_usd) / list.length;
		const perTurn = list.reduce((sum, r) => sum + r.pass / r.total, 0) / total((r) => r.turns);

		console.log(
			`  ${condition.padEnd(10)} ${turns.toFixed(1)} turns, $${cost.toFixed(2)} per run, ` +
				`${(100 * perTurn).toFixed(1)}% adherence per turn`,
		);
	}
}

console.log();
