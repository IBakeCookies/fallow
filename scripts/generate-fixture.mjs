/**
 * Generate an importable Fallow backup with a year of plausible history, drawn
 * from KNOWN ground-truth model parameters.
 *
 * The point is parameter recovery, not realism for its own sake: because the
 * observations are simulated from true (c₁,c₂,c₃), (α_cog,α_phys), r and λ₀,
 * importing the file and reading the "Your model" card tells you whether the
 * fits recover the truth. That is a real test. It is NOT evidence about what a
 * user habitually does — a generator only ever replays its own assumptions, so
 * it can never gate an item whose question is "what does the user actually do"
 * (MATH.md turns on real logs for exactly that reason).
 *
 * Usage:
 *   node scripts/generate-fixture.mjs [--days 365] [--seed 42] [--out path.json]
 *
 * Then: Fallow -> ☰ data menu -> Import data. Import MERGES (put by key), so
 * import into an empty profile or expect existing days to be overwritten.
 */

import { writeFileSync } from 'node:fs';

// ---------------------------------------------------------------- arguments

const arg = (name, fallback) => {
	const index = process.argv.indexOf(`--${name}`);

	return index === -1 ? fallback : process.argv[index + 1];
};

const DAYS = Number(arg('days', 365));
const SEED = Number(arg('seed', 42));
const OUT = arg('out', 'fallow-fixture.json');
// The last day generated. Kept explicit rather than `new Date()` so a given
// seed always produces the same file.
const END_DATE = arg('end', '2026-08-04');

// ------------------------------------------------------------ ground truth

/**
 * What the generator "is". Every observation below is simulated from these, so
 * a fit that works must land near them. Deliberately off the app's defaults
 * (0.56 / −0.24 / 0.5, α 0.35 / 0.30, r 0.7, λ₀ 0.5) — a fit ridged toward the
 * defaults would otherwise score well by doing nothing.
 */
const TRUTH = {
	c1: 0.72,
	c2: -0.38,
	c3: 0.34,
	alphaCog: 0.52,
	alphaPhys: 0.24,
	recoveryRate: 0.95,
	stoppingValue: 0.8,
	// Measurement noise on a ⚡ log, in hours. σ₀² = 0.25 h is the fit's own
	// prior noise floor, so this sits just under it.
	phiNoiseHours: 0.18,
	// Drain ratings are integers on a 0–10 scale; this is the rating jitter.
	drainNoisePoints: 0.7,
};

// Model constants the simulation needs, mirroring zenith-energy.ts defaults.
const REST_RECOVERY_MULTIPLIER = 1.5;
const MICRO_RECOVERY_FRACTION = 0.05;

// -------------------------------------------------------------------- rng

/** Mulberry32 — small, seeded, good enough for fixtures and fully reproducible. */
function makeRandom(seed) {
	let state = seed >>> 0;

	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const random = makeRandom(SEED);
const between = (lo, hi) => lo + random() * (hi - lo);
const pick = (list) => list[Math.floor(random() * list.length)];
const chance = (p) => random() < p;

/** Box–Muller, so ratings and ϕ carry gaussian noise rather than uniform. */
const gauss = (sd) =>
	sd * Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const quarter = (x) => Math.round(x / 0.25) * 0.25;
// ------------------------------------------------------------------- dates
const toISO = (date) => date.toISOString().slice(0, 10);

const dates = (() => {
	const end = new Date(`${END_DATE}T00:00:00Z`);
	const list = [];

	for (let i = DAYS - 1; i >= 0; i--) {
		const day = new Date(end);
		day.setUTCDate(day.getUTCDate() - i);
		list.push(toISO(day));
	}

	return list;
})();

const epochOf = (iso) => new Date(`${iso}T09:00:00Z`).getTime();
const weekdayOf = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();

// ------------------------------------------------------------- task catalogue

/**
 * A realistic mix: a small recurring core (the routine), a mid-frequency set,
 * and a long tail of one-offs. 64–79% of logged titles carry a single log
 * (business/model/AGENTS.md's per-task-ϕ decision), so the tail matters — a generator with only recurring
 * titles would make per-task structure look far more learnable than it is.
 */
const CATALOGUE = [
	{
		title: 'network',
		physical: 0,
		mental: 5,
		enjoyment: 2,
		frequency: 0.85,
	},
	{
		title: 'guitar',
		physical: 1,
		mental: 4,
		enjoyment: 8,
		frequency: 0.7,
	},
	{
		title: 'Piano',
		physical: 1,
		mental: 5,
		enjoyment: 7,
		frequency: 0.5,
	},
	{
		title: 'deep work',
		physical: 0,
		mental: 9,
		enjoyment: 6,
		frequency: 0.45,
	},
	{
		title: 'gym',
		physical: 8,
		mental: 1,
		enjoyment: 5,
		frequency: 0.35,
	},
	{
		title: 'admin',
		physical: 1,
		mental: 3,
		enjoyment: 1,
		frequency: 0.3,
	},
	{
		title: 'reading',
		physical: 0,
		mental: 6,
		enjoyment: 8,
		frequency: 0.25,
	},
	{
		title: 'run',
		physical: 7,
		mental: 2,
		enjoyment: 6,
		frequency: 0.2,
	},
	{
		title: 'code review',
		physical: 0,
		mental: 7,
		enjoyment: 4,
		frequency: 0.18,
	},
	{
		title: 'garden',
		physical: 5,
		mental: 2,
		enjoyment: 7,
		frequency: 0.1,
	},
];

const ONE_OFFS = [
	'taxes',
	'call bank',
	'fix bike',
	'write letter',
	'plan trip',
	'sort photos',
	'clean desk',
	'renew passport',
	'meal prep',
	'patch server',
	'read paper',
	'draft proposal',
	'return parcel',
	'dentist forms',
	'back up laptop',
];

// -------------------------------------------------------------- the model

/** MATH.md §1 input mappings. */
const mapE = (difficulty) => (4 / 9) * difficulty + 5 / 9;
const mapBeta = (enjoyment) => (1 / 9) * enjoyment + 8 / 9;

/** Effective difficulty, mirroring `getEffectiveDifficulty` (spillover 0.5). */
const effectiveDifficulty = (physical, mental) =>
	clamp(Math.max(physical, mental) + 0.5 * Math.min(physical, mental), 1, 10);

/** True ϕ for a task, before measurement noise. */
const truePhi = (physical, mental, enjoyment) =>
	Math.max(
		0.1,
		TRUTH.c1 * mapE(effectiveDifficulty(physical, mental)) +
			TRUTH.c2 * mapBeta(enjoyment) +
			TRUTH.c3,
	);

/**
 * Reservoir level after `hours` of work at demand `w`, from level `c0`.
 * Closed form of dC/dτ = −α·w·C + r'·g·(1−C) with g = 1−(1−b)·w (MATH.md §8.5).
 *
 * `r'` carries `restRecoveryMultiplier` during WORK too, not only during rest —
 * that is what `fitDrainRate` passes into `reservoirLaw` in `zenith-energy.ts`,
 * and dropping it here made α̂ come back +13% with noise-free data, because the
 * fit then had to raise α to explain a drain the generator produced with less
 * recovery than the model assumes.
 */
function reservoirAfter(c0, hours, demand, alpha, recoveryRate) {
	const gate = 1 - (1 - MICRO_RECOVERY_FRACTION) * demand;
	const drainRate = alpha * demand;
	const recover = recoveryRate * REST_RECOVERY_MULTIPLIER * gate;
	const total = drainRate + recover;

	if (total <= 0) return c0;

	const equilibrium = recover / total;

	return equilibrium + (c0 - equilibrium) * Math.exp(-total * hours);
}

/** Pure rest: demand 0, so the level relaxes toward 1 at r·multiplier. */
const reservoirAfterRest = (c0, hours, recoveryRate) =>
	1 - (1 - c0) * Math.exp(-recoveryRate * REST_RECOVERY_MULTIPLIER * hours);

/** A 0–10 drain rating from a reservoir level, with rating jitter. */
const toRating = (level) =>
	clamp(Math.round((1 - level) * 10 + gauss(TRUTH.drainNoisePoints)), 0, 10);

// ---------------------------------------------------------------- generate

const sessions = [];
const flowObservations = [];
const drainObservations = [];
const restObservations = [];
let flowId = 1;
let drainId = 1;
let restId = 1;
// Which titles have ever been ⚡-logged. Once a title is measured the user
// rarely re-measures it, which is what produces the single-log majority.
const measuredTitles = new Set();

for (const date of dates) {
	const weekday = weekdayOf(date);
	const isWeekend = weekday === 0 || weekday === 6;

	// A skipped day: no session record at all, the way an unopened day looks.
	if (chance(isWeekend ? 0.35 : 0.12)) continue;

	const dayEpoch = epochOf(date);
	// Budget: weekday habit plus jitter, quantized to the quarter-hour the UI
	// actually produces. Weekends are longer and more variable.
	const budget = clamp(quarter(isWeekend ? between(1.5, 6) : between(1.5, 4.5)), 0.25, 12);
	const chosen = CATALOGUE.filter((entry) => chance(entry.frequency * (isWeekend ? 0.8 : 1)));

	if (chance(0.25)) {
		chosen.push({
			title: pick(ONE_OFFS),
			physical: Math.round(between(0, 6)),
			mental: Math.round(between(1, 8)),
			enjoyment: Math.round(between(1, 8)),
		});
	}

	if (chosen.length === 0) continue;

	const tasks = chosen.map((entry, index) => ({
		id: dayEpoch + index,
		title: entry.title,
		// Ratings wobble by a point day to day — a user re-rates by feel.
		physicalDifficulty: clamp(entry.physical + Math.round(gauss(0.4)), 0, 10),
		mentalDifficulty: clamp(entry.mental + Math.round(gauss(0.4)), 0, 10),
		enjoyment: clamp(entry.enjoyment + Math.round(gauss(0.5)), 1, 10),
		createdAt: date,
		completed: false,
	}));

	// --- simulate the day being worked -------------------------------------

	// Reservoirs start high but not always full (overnight carry-over).
	let cognitive = clamp(between(0.85, 1), 0, 1);
	let physical = clamp(between(0.85, 1), 0, 1);
	// The user works a share of the declared budget — over-declaring is the norm.
	let remaining = budget * clamp(between(0.55, 1.05), 0.1, 1.1);
	// Order: roughly by enjoyment, the way a person actually picks.
	const order = [...tasks].sort((a, b) => b.enjoyment - a.enjoyment);

	for (const task of order) {
		if (remaining < 0.25) break;

		const phi = truePhi(task.physicalDifficulty, task.mentalDifficulty, task.enjoyment);

		// A session runs toward the task's stopping scale, censored by what's
		// left. Higher λ₀ (impatience) shortens it.
		const wanted = quarter(
			clamp((phi * between(1.2, 1.9)) / (1 + TRUTH.stoppingValue * 0.4), 0.25, 6),
		);

		const hours = Math.min(wanted, quarter(remaining));

		if (hours < 0.25) break;

		const cognitiveDemand = task.mentalDifficulty / 10;
		const physicalDemand = task.physicalDifficulty / 10;

		cognitive = reservoirAfter(
			cognitive,
			hours,
			cognitiveDemand,
			TRUTH.alphaCog,
			TRUTH.recoveryRate,
		);

		physical = reservoirAfter(physical, hours, physicalDemand, TRUTH.alphaPhys, TRUTH.recoveryRate);

		remaining -= hours;
		task.completed = chance(0.65);

		// 🪫 end-of-session drain rating. Opt-in, so most sessions carry none —
		// and a demand of 0 carries no signal, which §8.7 drops anyway.
		if (chance(0.4) && (cognitiveDemand > 0 || physicalDemand > 0)) {
			drainObservations.push({
				id: drainId++,
				date,
				taskId: task.id,
				taskTitle: task.title,
				hours,
				cognitiveDemand,
				physicalDemand,
				mindDrain: toRating(cognitive),
				bodyDrain: toRating(physical),
				createdAt: dayEpoch + Math.round(hours * 3600000),
			});
		}

		// ⚡ time-to-flow, mostly on titles never measured before.
		const isNewTitle = !measuredTitles.has(task.title);

		if (chance(isNewTitle ? 0.3 : 0.06)) {
			measuredTitles.add(task.title);

			const measured = Math.max(0.05, phi + gauss(TRUTH.phiNoiseHours));
			const difficulty = effectiveDifficulty(task.physicalDifficulty, task.mentalDifficulty);

			flowObservations.push({
				id: flowId++,
				date,
				taskId: task.id,
				taskTitle: task.title,
				difficulty,
				enjoyment: task.enjoyment,
				E: mapE(difficulty),
				beta: mapBeta(task.enjoyment),
				phiHours: measured,
				createdAt: dayEpoch + Math.round(measured * 3600000),
			});
		}

		// ☕ a break, rated either side. This is what identifies r on its own.
		if (remaining >= 0.25 && chance(0.3)) {
			const breakHours = quarter(between(0.25, 1));
			const mindBefore = toRating(cognitive);
			const bodyBefore = toRating(physical);

			cognitive = reservoirAfterRest(cognitive, breakHours, TRUTH.recoveryRate);
			physical = reservoirAfterRest(physical, breakHours, TRUTH.recoveryRate);

			restObservations.push({
				id: restId++,
				date,
				hours: breakHours,
				mindBefore,
				mindAfter: toRating(cognitive),
				bodyBefore,
				bodyAfter: toRating(physical),
				createdAt: dayEpoch + Math.round(breakHours * 3600000),
			});
		}
	}

	sessions.push({
		date,
		tasks,
		availableHours: budget,
		switchCost: 0.25,
		cognitivePool: 4,
		physicalPool: 6,
		updatedAt: dayEpoch,
	});
}

// ------------------------------------------------------------------- output

const backup = {
	app: 'fallow',
	schemaVersion: 6,
	exportedAt: `${END_DATE}T12:00:00.000Z`,
	stores: {
		sessions,
		routines: [
			{
				id: 'fixture-daily',
				name: 'daily',
				tasks: [
					{
						title: 'network',
						physicalDifficulty: 0,
						mentalDifficulty: 5,
						enjoyment: 2,
					},
					{
						title: 'guitar',
						physicalDifficulty: 1,
						mentalDifficulty: 4,
						enjoyment: 8,
					},
				],
				createdAt: epochOf(dates[0]),
			},
		],
		flowObservations,
		drainObservations,
		restObservations,
		settings: [],
		// Left empty on purpose: only today's snapshot is ever written, so
		// fabricating a year of them would invent what the model "believed" on
		// days it never ran. A day with no snapshot correctly falls back to the
		// live fit.
		fitSnapshots: [],
	},
};

writeFileSync(OUT, JSON.stringify(backup));

const titleCounts = new Map();

for (const observation of flowObservations) {
	titleCounts.set(observation.taskTitle, (titleCounts.get(observation.taskTitle) ?? 0) + 1);
}

const singleLogTitles = [...titleCounts.values()].filter((n) => n === 1).length;
const budgets = sessions.map((s) => s.availableHours).sort((a, b) => a - b);
const median = budgets[Math.floor(budgets.length / 2)];

console.log(`wrote ${OUT}`);
console.log(`  seed ${SEED}, ${DAYS} days ending ${END_DATE}`);
console.log(`  sessions            ${sessions.length}`);
console.log(`  tasks               ${sessions.reduce((n, s) => n + s.tasks.length, 0)}`);

console.log(
	`  ⚡ flow             ${flowObservations.length} over ${titleCounts.size} titles ` +
		`(${titleCounts.size ? Math.round((100 * singleLogTitles) / titleCounts.size) : 0}% single-log)`,
);

console.log(`  🪫 drain            ${drainObservations.length}`);
console.log(`  ☕ rest             ${restObservations.length}`);
console.log(`  median budget       ${median} h`);
console.log('');
console.log('Ground truth the fits must recover:');

console.log(
	`  ϕ plane   c₁ ${TRUTH.c1}  c₂ ${TRUTH.c2}  c₃ ${TRUTH.c3}   (defaults 0.56 / −0.24 / 0.5)`,
);

console.log(
	`  drain     α_cog ${TRUTH.alphaCog}  α_phys ${TRUTH.alphaPhys}   (defaults 0.35 / 0.30)`,
);

console.log(`  recovery  r ${TRUTH.recoveryRate}                    (default 0.7)`);
console.log(`  stopping  λ₀ ${TRUTH.stoppingValue}                   (default 0.5)`);
console.log('');
console.log('Import: Fallow -> ☰ data menu -> Import data. Merges by key.');
