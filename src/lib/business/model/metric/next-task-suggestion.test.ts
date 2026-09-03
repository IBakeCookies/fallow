import { describe, it, expect } from 'vitest';
import {
	NEXT_TASK_CANDIDATE_LIMIT,
	NEXT_TASK_COUNT,
	suggestNextTasks,
} from '$lib/business/model/metric/next-task-suggestion';
import {
	calculateDailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import { normalizeTitle, type TitleRating } from '$lib/business/model/title-memory';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import type { Task } from '$lib/data/type';

const task = (id: number, title: string, physical: number, mental: number): Task => ({
	id,
	title,
	physicalDifficulty: physical,
	mentalDifficulty: mental,
	enjoyment: 5,
	createdAt: '2026-09-01',
	completed: false,
});

/** A day with room in it: one task against a budget that can fund a second. */
const day = (tasks: Task[] = [task(1, 'inbox sweep', 1, 4)]): DailyMetricsInput => ({
	tasks,
	availableHours: 8,
	switchCost: 0.25,
	pools: {
		cognitiveHours: 4,
		physicalHours: 5,
	},
	constants: DEFAULT_USER_CONSTANTS,
	energyParams: DEFAULT_ENERGY_PARAMS,
});

const rating = (
	title: string,
	physical: number,
	mental: number,
	lastUsedDate = '2026-09-01',
): TitleRating => ({
	title,
	physicalDifficulty: physical,
	mentalDifficulty: mental,
	enjoyment: 5,
	lastUsedDate,
});

/** In the order given, keyed the way `latestRatingsByTitle` keys them. */
const memory = (ratings: TitleRating[]): Map<string, TitleRating> =>
	new Map(ratings.map((r) => [normalizeTitle(r.title), r]));

/**
 * The objective the ranking claims to sort by, derived here independently of the
 * module under test: the day's Σ v·P̄ with the candidate PREPENDED, which is
 * where `addTask` puts it and where the allocator's ties are broken.
 */
function gainWith(input: DailyMetricsInput, candidate: TitleRating): number {
	const id = input.tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;

	return calculateDailyMetrics({
		...input,
		tasks: [
			{
				id,
				title: candidate.title,
				physicalDifficulty: candidate.physicalDifficulty,
				mentalDifficulty: candidate.mentalDifficulty,
				enjoyment: candidate.enjoyment,
				createdAt: '2026-09-03',
				completed: false,
			},
			...input.tasks,
		],
	}).zenithGain.optimized;
}

describe('suggestNextTasks', () => {
	// Claim — the order is the objective's, not the memory's.
	it('ranks the candidates by what the day gains from each', () => {
		const input = day();

		const ratings = memory([
			rating('email triage', 1, 4),
			rating('gym', 9, 1),
			rating('deep write', 1, 9),
			rating('tidy desk', 3, 1),
			rating('guitar', 4, 3),
		]);

		const ranked = [...ratings.values()]
			.map((r) => ({
				title: r.title,
				gain: gainWith(input, r),
			}))
			.sort((a, b) => b.gain - a.gain)
			.map(({ title }) => title);

		// The fixture has to discriminate, or the assertion below would hold on a
		// function that just handed the memory back.
		expect(ranked.slice(0, 3)).not.toEqual([...ratings.values()].slice(0, 3).map((r) => r.title));

		expect(suggestNextTasks(input, ratings).map((s) => s.rating.title)).toEqual(ranked.slice(0, 3));
	});

	// The recency sort runs before the scoring one and both are stable, so a tie on
	// the objective falls through to the most recently used — and only titles used
	// on the SAME day fall through again to the memory's own order.
	it('breaks a tie on recency, then on the memory’s own order', () => {
		const ratings = memory([
			rating('run', 6, 2, '2026-01-01'),
			rating('swim', 6, 2, '2026-03-01'),
			rating('row', 6, 2, '2026-03-01'),
		]);

		expect(suggestNextTasks(day(), ratings).map((s) => s.rating.title)).toEqual([
			'swim',
			'row',
			'run',
		]);
	});

	it('says what the day would give each suggestion', () => {
		const input = day();
		const ratings = memory([rating('gym', 9, 1)]);
		const [suggestion] = suggestNextTasks(input, ratings);

		const planned = calculateDailyMetrics({
			...input,
			tasks: [
				{
					id: 2,
					title: 'gym',
					physicalDifficulty: 9,
					mentalDifficulty: 1,
					enjoyment: 5,
					createdAt: '2026-09-03',
					completed: false,
				},
				...input.tasks,
			],
		}).suggestedTasks.find((t) => t.id === 2)!;

		expect(suggestion.suggestedHours).toBe(planned.suggestedHours);
	});

	// Scenario — today's own tasks are not offered back.
	it('never offers a title the day already holds', () => {
		const input = day([task(1, 'Gym  Session', 9, 1)]);
		// Highest-scoring by a distance, and on today's list under another spelling:
		// the key is normalized, so the filter has to be too.
		const ratings = memory([rating('gym session', 9, 1), rating('email triage', 1, 4)]);

		expect(suggestNextTasks(input, ratings).map((s) => s.rating.title)).toEqual(['email triage']);
	});

	// Scenario — a first profile has nothing to rank.
	it('answers nothing on an empty title memory', () => {
		expect(suggestNextTasks(day(), memory([]))).toEqual([]);
	});

	// The cap is by RECENCY, and the map's own iteration order is first-seen — so a
	// long-lived profile would otherwise be ranked on its oldest titles forever.
	it('scores only the most recently used candidates', () => {
		const input = day();
		const stale = rating('gym', 9, 1, '2024-01-01');

		const ratings = memory([
			stale,
			...Array.from(
				{
					length: NEXT_TASK_CANDIDATE_LIMIT,
				},
				(_, index) => rating(`filler ${index}`, 1, 4, '2026-09-02'),
			),
		]);

		// It would win the ranking outright on this day, so its absence is the cap.
		expect(gainWith(input, stale)).toBeGreaterThan(
			gainWith(input, rating('filler 0', 1, 4, '2026-09-02')),
		);

		const titles = suggestNextTasks(input, ratings).map((s) => s.rating.title);

		expect(titles).toHaveLength(NEXT_TASK_COUNT);
		expect(titles).not.toContain('gym');
	});
});
