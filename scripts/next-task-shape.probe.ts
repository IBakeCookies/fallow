/**
 * Does "what kind of task should I add next" have a day-dependent answer?
 *
 * The gate before building a next-task recommender. The premise is a day with
 * unspent hours and room for one more task; the question is whether the best
 * draft to add is a property of THAT day, or the same corner of the slider box
 * every time. A constant answer is a sentence, not a feature — the outcome
 * ROADMAP.md's "considered and not proposed" list reached for three other ideas.
 *
 * Distinct from the settled refusal of "add a task" as an advice lever (0/600
 * days lowered Σ P̄, median +7.4%): there the question was WHETHER to add, and
 * the monotonicity is what killed it. Here adding is exogenous — the user is
 * already typing — and only the draft's shape is being chosen. The
 * monotonicity does not decide that; it is what makes some AXES of it
 * uninformative, which is arm A's business.
 *
 * Three arms, narrowing to the thing that would actually ship:
 *
 *   A — argmax over the whole reachable slider box (mental, physical,
 *       enjoyment, importance). Distinct argmax drafts across days, and how
 *       often each axis sits on its own boundary. An axis pinned to a boundary
 *       on every day is one the recommendation cannot mention: it says "make it
 *       more enjoyable / more important" whatever the day looks like.
 *   B — the same argmax with enjoyment and importance held at their defaults,
 *       so only the demand pair varies. This is the part a recommendation could
 *       honestly carry, and the arm that says whether it moves with the day's
 *       two pools.
 *   C — the shipping shape: rank a fixed menu of eight rated titles (what
 *       `title-memory.ts` holds) and take the winner. Two readings — how many
 *       distinct winners there are, and what per-day ranking BUYS over always
 *       naming the modal winner. The second is the gate: a recommender that
 *       beats its own constant by ~0% is that constant.
 *   D — what the shipped `suggestNextTasks` COSTS, once arm C had said the
 *       ranking was worth having: one full solve per capped candidate, priced
 *       against the per-candidate band `business/AGENTS.md` measures for
 *       `suggestPlanAdjustments`, at the task counts an add-task dialog can be
 *       open over. A wall clock, so it is a range and not a figure.
 *
 * Every candidate is scored by the day's own objective, `zenithGain.optimized`
 * (Σ v·P̄ over the funded tasks), through the real `calculateDailyMetrics` — the
 * same solve `draft-impact.ts` prices a typed draft with, and the draft is
 * prepended for the same reason it is there: `SessionStore.addTask` prepends,
 * and input position breaks the allocator's ties.
 *
 * Days are drawn on the app's surface: integer sliders, enjoyment from 1
 * (MATH.md §1's βᵤ ∈ [1,10]), 1–4 existing tasks so the premise is a day with
 * room rather than a full one.
 *
 * READ, from the run below. **Enjoyment and importance are degenerate and the
 * demand pair is not.** The argmax pins enjoyment at 10 and importance at
 * `high` on 100% of days — those two axes are the objective's monotonicity
 * showing through, they carry no information about any particular day, and a
 * recommendation that names them says "care more, enjoy it more" every morning.
 * The demand pair does move: 8 distinct pairs over 186 days, modal on only 40%
 * of them.
 *
 * **What moves it is which pool the day was GIVEN more of, not which one it has
 * spent.** Split by the drained pool the answer does not flip at all (modal
 * <0,10> in both cells). Split by pool SIZE it does: max-physical on the days
 * with the larger physical pool, max-mental on the days with the larger
 * cognitive pool. So the intuition this probe was written to check — "you have
 * cognitive headroom left, so do something mental" — is the wrong reading of the
 * right mechanism, and a recommendation phrased on saturation would be wrong on
 * half its days. The second axis is the leftover window: mean total demand of
 * the argmax rises 6.0 → 8.1 → 8.3 across slack tertiles, which is ϕ — a longer
 * window pays off a longer warm-up on a higher-peaked curve.
 *
 * **Ranking a menu per day is worth having.** Arm C's per-day winner beats
 * always naming the modal title on 87 of 186 days, p90 +26.46% of Σ P̄. The
 * menu is invented, so that figure sizes THIS spread of eight titles and not a
 * user's; a menu of near-identical titles gains proportionally less.
 *
 * FINDINGS — run 2026-09-03, seed 42, 300 days (figures reproduce byte-for-byte;
 * re-read them here after any allocator change):
 *
 *   [days] 300 drawn, 186 with slack ≥ 0.25 h, median slack 3.50 h
 *   [A full box] 186 days: 7 distinct argmax drafts, modal <0,10,10,high> on 96
 *       boundary share: mental min 60.2%, physical min 40.9%, enjoyment max
 *       100.0%, importance high 100.0%
 *   [B demand pair at β=5, normal] 186 days: 8 distinct pairs, modal <0,10> on 75
 *       cognitive pool drained harder (97 days): modal <0,10> on 42, 6 distinct,
 *           mean total demand 7.2
 *       physical pool drained harder (89 days): modal <0,10> on 33, 7 distinct,
 *           mean total demand 7.6
 *       slack ≤ 1.92 h (63 days): modal <0,10> on 25, 6 distinct, demand 6.0
 *       slack 1.92–4.58 h (62 days): modal <0,10> on 22, 6 distinct, demand 8.1
 *       slack > 4.58 h (61 days): modal <0,10> on 28, 7 distinct, demand 8.3
 *       physical pool larger (100 days): modal <0,10> on 70, 6 distinct, demand 8.1
 *       cognitive pool larger or equal (86 days): modal <10,0> on 44, 7 distinct,
 *           demand 6.7
 *   [C menu of 8] 186 days: 4 distinct winners, modal 'gym' on 99 (53.2%)
 *       winners: gym 99, deep write 44, guitar 37, plan next week 6
 *       per-day winner vs modal winner: mean +8.26%, median +0.00%, p90 +26.46%,
 *       max +82.97% of Σ P̄; 99 days gain exactly 0
 *
 * ARM D is a WALL CLOCK and reproduces nothing byte-for-byte. Read as a band
 * across whole runs, never as one cell. Three runs on an idle box, 2026-09-04:
 *
 *   [D cost] 4 tasks, 8 candidates: 0.2-0.9 / 0.2-0.8 / 0.2-0.8 ms per candidate
 *   [D cost] 8 tasks, 8 candidates: 7.3-8.9 / 7.4-9.0 / 7.3-9.0 ms per candidate
 *   [D cost] 12 tasks, 8 candidates: 0.9-1.0 / 0.9-1.0 / 0.9-1.0 ms per candidate
 *
 * So roughly 0.2-9 ms per candidate is the result and no cell is. The whole band
 * sits an order of magnitude or more below the 109-124 ms per candidate
 * `business/AGENTS.md` measures for `suggestPlanAdjustments`, and that is
 * structural rather than lucky: this solves the day ONCE per candidate where the
 * advisor enumerates funded subsets per candidate. So the ranking stays out of a
 * `$derived` for the reason that section gives — it is N solves — and not
 * because N solves here are slow.
 *
 * The 8-task day costing several times the 12-task one is not noise; it holds
 * across all three runs. Cost tracks how hard the pooled allocator has to search
 * a particular day, not the task count — the same reason `business/AGENTS.md`
 * calls 12 tasks the WORST case and not a floor.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateDailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import { suggestNextTasks } from '$lib/business/model/metric/next-task-suggestion';
import type { TitleRating } from '$lib/business/model/title-memory';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import type { Task, TaskImportance } from '$lib/data/type';

/** Seeded so a quoted number can be reproduced, not just re-rolled. */
function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

interface Draft {
	mentalDifficulty: number;
	physicalDifficulty: number;
	enjoyment: number;
	importance: TaskImportance;
}

const task = (
	id: number,
	mental: number,
	physical: number,
	enjoyment: number,
	importance: TaskImportance = 'normal',
): Task => ({
	id,
	title: `t${id}`,
	mentalDifficulty: mental,
	physicalDifficulty: physical,
	enjoyment,
	importance,
	createdAt: '2026-09-03',
	completed: false,
});

const day = (
	tasks: Task[],
	availableHours: number,
	switchCost: number,
	cognitiveHours: number,
	physicalHours: number,
): DailyMetricsInput => ({
	tasks,
	availableHours,
	switchCost,
	pools: {
		cognitiveHours,
		physicalHours,
	},
	constants: DEFAULT_USER_CONSTANTS,
	energyParams: DEFAULT_ENERGY_PARAMS,
});

/**
 * Days with room in them: 1–4 tasks against a budget wide enough that a fifth
 * can plausibly be funded. The feature never appears on a day with no slack, so
 * a sweep dominated by tight days would measure the wrong population.
 */
function randomDays(count: number, seed: number): DailyMetricsInput[] {
	const random = mulberry32(seed);

	const pick = (min: number, max: number, step: number) =>
		min + Math.round((random() * (max - min)) / step) * step;

	return Array.from(
		{
			length: count,
		},
		() => {
			const tasks = Array.from(
				{
					length: pick(1, 4, 1),
				},
				(_, index) => task(index + 1, pick(0, 10, 1), pick(0, 10, 1), pick(1, 10, 1)),
			);

			return day(tasks, pick(2, 12, 0.25), pick(5, 30, 5) / 60, pick(1, 6, 0.5), pick(1, 7, 0.5));
		},
	);
}

/** The draft prepended, exactly as `draft-impact.ts` and `addTask` place it. */
function scoreDraft(input: DailyMetricsInput, draft: Draft): number {
	const draftId = input.tasks.reduce((max, current) => Math.max(max, current.id), 0) + 1;

	return calculateDailyMetrics({
		...input,
		tasks: [
			{
				...draft,
				id: draftId,
				title: 'draft',
				createdAt: '2026-09-03',
				completed: false,
			},
			...input.tasks,
		],
	}).zenithGain.optimized;
}

function bestOf<T>(candidates: T[], score: (candidate: T) => number): { best: T; value: number } {
	let best = candidates[0];
	let value = score(best);

	for (const candidate of candidates.slice(1)) {
		const current = score(candidate);

		if (current > value) {
			best = candidate;
			value = current;
		}
	}

	return {
		best,
		value,
	};
}

function tally<T>(values: T[], key: (value: T) => string) {
	const counts = new Map<string, number>();

	for (const value of values) {
		const id = key(value);

		counts.set(id, (counts.get(id) ?? 0) + 1);
	}

	const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

	return {
		distinct: counts.size,
		modal: ranked[0][0],
		modalCount: ranked[0][1],
	};
}

const percent = (part: number, whole: number) => `${((part / whole) * 100).toFixed(1)}%`;

const quantile = (sorted: number[], q: number) =>
	sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

const DEMAND_LEVELS = [0, 3, 6, 10];
const ENJOYMENT_LEVELS = [1, 5, 10];
const IMPORTANCE_LEVELS: TaskImportance[] = ['low', 'normal', 'high'];

const FULL_BOX: Draft[] = DEMAND_LEVELS.flatMap((mental) =>
	DEMAND_LEVELS.flatMap((physical) =>
		ENJOYMENT_LEVELS.flatMap((enjoyment) =>
			IMPORTANCE_LEVELS.map((importance) => ({
				mentalDifficulty: mental,
				physicalDifficulty: physical,
				enjoyment,
				importance,
			})),
		),
	),
);

/** The same box with the two axes a user can simply raise held at their defaults. */
const DEMAND_ONLY: Draft[] = DEMAND_LEVELS.flatMap((mental) =>
	DEMAND_LEVELS.map((physical) => ({
		mentalDifficulty: mental,
		physicalDifficulty: physical,
		enjoyment: 5,
		importance: 'normal' as TaskImportance,
	})),
);

/**
 * Eight rated titles standing in for what `title-memory.ts` would hand a
 * recommender — spread across the demand plane so a day's pools have something
 * to prefer, and all at `normal` so the menu ranks the WORK, not its weight.
 */
const MENU: { title: string; draft: Draft }[] = [
	['deep write', 9, 1, 6],
	['code review', 7, 1, 5],
	['email triage', 4, 1, 3],
	['gym', 1, 9, 7],
	['grocery run', 2, 5, 4],
	['tidy desk', 1, 3, 5],
	['guitar', 3, 4, 9],
	['plan next week', 6, 1, 6],
].map(([title, mental, physical, enjoyment]) => ({
	title: title as string,
	draft: {
		mentalDifficulty: mental as number,
		physicalDifficulty: physical as number,
		enjoyment: enjoyment as number,
		importance: 'normal',
	},
}));

const DAYS = randomDays(300, 42);
/** A draft cannot be funded below one block, so a thinner day has no room at all. */
const MIN_SLACK_HOURS = 0.25;

describe('the next task to add — does the day decide its shape', () => {
	const withSlack = DAYS.map((input) => ({
		input,
		metrics: calculateDailyMetrics(input),
	})).filter(({ metrics }) => metrics.planSlackHours >= MIN_SLACK_HOURS);

	it('measures how much room the sweep actually found', () => {
		const slacks = withSlack.map(({ metrics }) => metrics.planSlackHours).sort((a, b) => a - b);

		console.log(
			`[days] ${DAYS.length} drawn, ${withSlack.length} with slack ≥ ${MIN_SLACK_HOURS} h, median slack ${quantile(slacks, 0.5).toFixed(2)} h`,
		);
	});

	it('measures the argmax over the whole slider box', () => {
		const winners = withSlack.map(
			({ input }) => bestOf(FULL_BOX, (draft) => scoreDraft(input, draft)).best,
		);

		const shape = tally(
			winners,
			(draft) =>
				`${draft.mentalDifficulty},${draft.physicalDifficulty},${draft.enjoyment},${draft.importance}`,
		);

		const share = (predicate: (draft: Draft) => boolean) =>
			percent(winners.filter(predicate).length, winners.length);

		console.log(
			`[A full box] ${winners.length} days: ${shape.distinct} distinct argmax drafts, modal <${shape.modal}> on ${shape.modalCount}`,
		);

		console.log(
			`    boundary share: mental min ${share((d) => d.mentalDifficulty === 0)}, physical min ${share((d) => d.physicalDifficulty === 0)}, enjoyment max ${share((d) => d.enjoyment === 10)}, importance high ${share((d) => d.importance === 'high')}`,
		);
	});

	it('measures the argmax demand pair with the free axes pinned', () => {
		const rows = withSlack.map(({ input, metrics }) => ({
			best: bestOf(DEMAND_ONLY, (draft) => scoreDraft(input, draft)).best,
			// Which pool the day has already spent hardest — the reading a
			// "do something physical" recommendation would have to come from.
			drained: metrics.cognitiveLoad >= metrics.physicalLoad ? 'cognitive' : 'physical',
			slack: metrics.planSlackHours,
			poolRatio: input.pools.physicalHours / input.pools.cognitiveHours,
		}));

		const pairOf = ({ best }: (typeof rows)[number]) =>
			`${best.mentalDifficulty},${best.physicalDifficulty}`;

		const pair = tally(rows, pairOf);

		console.log(
			`[B demand pair at β=5, normal] ${rows.length} days: ${pair.distinct} distinct pairs, modal <${pair.modal}> on ${pair.modalCount}`,
		);

		const cell = (label: string, subset: typeof rows) => {
			if (subset.length === 0) return;

			const cellPair = tally(subset, pairOf);

			const demand =
				subset.reduce(
					(total, row) => total + row.best.mentalDifficulty + row.best.physicalDifficulty,
					0,
				) / subset.length;

			console.log(
				`    ${label} (${subset.length} days): modal <${cellPair.modal}> on ${cellPair.modalCount}, ${cellPair.distinct} distinct, mean total demand ${demand.toFixed(1)}`,
			);
		};

		for (const drained of ['cognitive', 'physical'])
			cell(
				`${drained} pool drained harder`,
				rows.filter((row) => row.drained === drained),
			);

		// The two day-level readings a shape recommendation could name: how long
		// the leftover window is, and which pool the day was GIVEN more of.
		const slacks = rows.map((row) => row.slack).sort((a, b) => a - b);
		const low = quantile(slacks, 1 / 3);
		const high = quantile(slacks, 2 / 3);

		cell(
			`slack ≤ ${low.toFixed(2)} h`,
			rows.filter((row) => row.slack <= low),
		);

		cell(
			`slack ${low.toFixed(2)}–${high.toFixed(2)} h`,
			rows.filter((row) => row.slack > low && row.slack <= high),
		);

		cell(
			`slack > ${high.toFixed(2)} h`,
			rows.filter((row) => row.slack > high),
		);

		cell(
			'physical pool larger',
			rows.filter((row) => row.poolRatio > 1),
		);

		cell(
			'cognitive pool larger or equal',
			rows.filter((row) => row.poolRatio <= 1),
		);
	});

	// The cost the panel actually pays, against the reading that decided this had to
	// be a method and not a `$derived`. Timed on the shipped function, so a change
	// to the cap or to the solve moves this line.
	it('times the shipped ranking against the advice card’s per-candidate band', () => {
		const ratings = new Map<string, TitleRating>(
			MENU.map(({ title, draft }) => [
				title,
				{
					title,
					physicalDifficulty: draft.physicalDifficulty,
					mentalDifficulty: draft.mentalDifficulty,
					enjoyment: draft.enjoyment,
					lastUsedDate: '2026-09-03',
				},
			]),
		);

		const REPS = 5;

		for (const taskCount of [4, 8, 12]) {
			const input = day(
				Array.from(
					{
						length: taskCount,
					},
					(_, index) => task(index + 1, (index * 3) % 11, (index * 7) % 11, 1 + ((index * 5) % 10)),
				),
				8,
				0.25,
				4,
				5,
			);

			const perCandidate = Array.from(
				{
					length: REPS,
				},
				() => {
					const started = performance.now();

					suggestNextTasks(input, ratings);

					return (performance.now() - started) / MENU.length;
				},
			).sort((a, b) => a - b);

			console.log(
				`[D cost] ${taskCount} tasks, ${MENU.length} candidates: ${perCandidate[0].toFixed(1)}–${perCandidate[REPS - 1].toFixed(1)} ms per candidate over ${REPS} reps`,
			);
		}
	});

	it('measures what ranking a rated menu per day buys over naming one title', () => {
		const scored = withSlack.map(({ input }) => ({
			values: new Map(MENU.map(({ title, draft }) => [title, scoreDraft(input, draft)])),
		}));

		const winners = scored.map(
			({ values }) => [...values.entries()].sort((a, b) => b[1] - a[1])[0][0],
		);

		const winner = tally(winners, (title) => title);

		const counts = MENU.map(({ title }) => ({
			title,
			days: winners.filter((won) => won === title).length,
		}))
			.filter(({ days }) => days > 0)
			.sort((a, b) => b.days - a.days);

		console.log(
			`[C menu of ${MENU.length}] ${winners.length} days: ${winner.distinct} distinct winners, modal '${winner.modal}' on ${winner.modalCount} (${percent(winner.modalCount, winners.length)})`,
		);

		console.log(`    winners: ${counts.map(({ title, days }) => `${title} ${days}`).join(', ')}`);

		// What the recommendation is worth: the day's own best against the one
		// title a constant sentence would name. Zero here is the kill condition.
		const gains = scored
			.map(({ values }, index) => {
				const best = values.get(winners[index]) ?? 0;
				const constant = values.get(winner.modal) ?? 0;

				return constant > 0 ? ((best - constant) / constant) * 100 : 0;
			})
			.sort((a, b) => a - b);

		const mean = gains.reduce((total, gain) => total + gain, 0) / gains.length;

		console.log(
			`    per-day winner vs modal winner: mean +${mean.toFixed(2)}%, median +${quantile(gains, 0.5).toFixed(2)}%, p90 +${quantile(gains, 0.9).toFixed(2)}%, max +${gains[gains.length - 1].toFixed(2)}% of Σ P̄; ${gains.filter((gain) => gain === 0).length} days gain exactly 0`,
		);
	});
});
