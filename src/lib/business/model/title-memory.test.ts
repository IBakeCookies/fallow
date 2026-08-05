import { describe, it, expect } from 'vitest';
import {
	TITLE_QUERY_MIN,
	latestRatingsByTitle,
	normalizeTitle,
	suggestTitles,
	type TitleRating,
} from '$lib/business/model/title-memory';
import type { DailySession, Task } from '$lib/data/type';

const task = (
	title: string,
	physical: number,
	mental: number,
	enjoyment = 5,
	over: Partial<Task> = {},
): Task => ({
	id: 1,
	title,
	physicalDifficulty: physical,
	mentalDifficulty: mental,
	enjoyment,
	createdAt: '2026-08-01',
	completed: false,
	...over,
});

const session = (date: string, tasks: Task[]): DailySession => ({
	date,
	tasks,
	availableHours: 4,
	switchCost: 0.25,
	updatedAt: 0,
});

describe('normalizeTitle', () => {
	it('matches titles that differ only in case or spacing', () => {
		expect(normalizeTitle('  Gym   Session ')).toBe('gym session');
		expect(normalizeTitle('gym session')).toBe('gym session');
	});

	it('keeps titles that differ in their words apart', () => {
		expect(normalizeTitle('Gym')).not.toBe(normalizeTitle('Gymnastics'));
	});

	it('reduces a title of nothing but spaces to the empty key', () => {
		expect(normalizeTitle('   ')).toBe('');
	});
});

describe('latestRatingsByTitle', () => {
	it('keys a rating on the normalized title, not the typed one', () => {
		const ratings = latestRatingsByTitle([session('2026-08-01', [task('Gym  Session', 8, 2, 3)])]);

		expect(ratings.get('gym session')).toEqual({
			title: 'Gym  Session',
			physicalDifficulty: 8,
			mentalDifficulty: 2,
			enjoyment: 3,
		});
	});

	it('keeps the most recent rating, whatever order the days arrive in', () => {
		const ratings = latestRatingsByTitle([
			session('2026-08-03', [task('Gym', 9, 1, 2)]),
			session('2026-08-01', [task('Gym', 3, 7, 8)]),
		]);

		expect(ratings.get('gym')).toEqual({
			title: 'Gym',
			physicalDifficulty: 9,
			mentalDifficulty: 1,
			enjoyment: 2,
		});
	});

	/*
	 * In store order: a day's tasks are newest-first, because every writer in
	 * `SessionStore` prepends. So the rating the user gave second is the one at
	 * index 0, and reading the array forwards would answer with the one they had
	 * already replaced.
	 */
	it('keeps the last rating of a title repeated within one day', () => {
		const ratings = latestRatingsByTitle([
			session('2026-08-01', [task('Gym', 6, 4, 9), task('Gym', 3, 7, 8)]),
		]);

		expect(ratings.get('gym')).toEqual({
			title: 'Gym',
			physicalDifficulty: 6,
			mentalDifficulty: 4,
			enjoyment: 9,
		});
	});

	// A rating is a rating: the day it was worked is exactly when the user knew
	// what the task cost them.
	it('remembers a completed task', () => {
		const ratings = latestRatingsByTitle([
			session('2026-08-01', [
				task('Gym', 9, 2, 4, {
					completed: true,
				}),
			]),
		]);

		expect(ratings.get('gym')).toEqual({
			title: 'Gym',
			physicalDifficulty: 9,
			mentalDifficulty: 2,
			enjoyment: 4,
		});
	});

	// The floor of every slider is a real rating, and the value a truthiness test
	// would silently drop.
	it('remembers a rating of all zeroes', () => {
		const ratings = latestRatingsByTitle([session('2026-08-01', [task('Rest', 0, 0, 1)])]);

		expect(ratings.get('rest')).toEqual({
			title: 'Rest',
			physicalDifficulty: 0,
			mentalDifficulty: 0,
			enjoyment: 1,
		});
	});

	// A restored backup can hold one (sanitizeTask keeps the task and defaults
	// the title to ''), and an empty key would answer the empty draft field.
	it('never keys a rating on an untitled task', () => {
		const ratings = latestRatingsByTitle([session('2026-08-01', [task('   ', 9, 2)])]);

		expect(ratings.size).toBe(0);
	});

	// The suggestion list is what the user reads, so it has to offer the spelling
	// they last chose — the key is lowercased and space-collapsed and would be
	// wrong to show them.
	it('carries the spelling of the latest use, not of the first', () => {
		const ratings = latestRatingsByTitle([
			session('2026-08-01', [task('gym session', 3, 7)]),
			session('2026-08-03', [task('Gym Session', 9, 1)]),
		]);

		expect(ratings.get('gym session')?.title).toBe('Gym Session');
	});
});

describe('suggestTitles', () => {
	const rated = (titles: string[]): Map<string, TitleRating> =>
		latestRatingsByTitle([
			session(
				'2026-08-01',
				titles.map((title) => task(title, 8, 2, 3)),
			),
		]);

	it('says nothing until the query is long enough to be a query', () => {
		const ratings = rated(['Gym session']);

		expect(TITLE_QUERY_MIN).toBe(2);
		expect(suggestTitles(ratings, 'g')).toEqual([]);
		expect(suggestTitles(ratings, '')).toEqual([]);

		// One letter and a space is still one letter
		expect(suggestTitles(ratings, ' g ')).toEqual([]);
		expect(suggestTitles(ratings, 'gy')).toHaveLength(1);
	});

	it('matches anywhere in the title, in any case or spacing', () => {
		const ratings = rated(['Morning gym session']);

		expect(suggestTitles(ratings, 'GYM')[0].title).toBe('Morning gym session');
		expect(suggestTitles(ratings, 'gym   SESSION')[0].title).toBe('Morning gym session');
		expect(suggestTitles(ratings, 'pilates')).toEqual([]);
	});

	it('answers with the whole rating, so picking one needs no second lookup', () => {
		expect(suggestTitles(rated(['Gym session']), 'gym')).toEqual([
			{
				title: 'Gym session',
				physicalDifficulty: 8,
				mentalDifficulty: 2,
				enjoyment: 3,
			},
		]);
	});

	// Alphabetical and uncapped on purpose: any other order is a ranking with no
	// instrument behind it, and a cap silently hides titles the user rated.
	it('offers every match, in alphabetical order', () => {
		const ratings = rated([
			'Zone 2 run',
			'run errands',
			'Long run',
			'run club',
			'Recovery run',
			'run',
			'Interval run',
			'Trail run',
			'run to the shop',
			'Easy run',
			'Track run',
			'Tempo run',
		]);

		expect(suggestTitles(ratings, 'run').map((r) => r.title)).toEqual([
			'Easy run',
			'Interval run',
			'Long run',
			'Recovery run',
			'run',
			'run club',
			'run errands',
			'run to the shop',
			'Tempo run',
			'Track run',
			'Trail run',
			'Zone 2 run',
		]);
	});
});
