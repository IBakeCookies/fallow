import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	$addDrainObservation,
	$editDrainObservation,
	$readAllDrainObservations,
	$deleteDrainObservation,
	$deleteAllDrainObservations,
} from '$lib/data/repository/drain-observation-repository';
import type { DrainObservationRecord } from '$lib/data/type';

/** What a correction may set: the three numbers the user rated, and nothing else. Not
 *  the day, not the stamp, and since 2026-08-10 not the task or its demands either — those
 *  were captured when the session was rated so that a task edited afterwards cannot
 *  rewrite what it measured (MATH.md §36). Spelled as its own type so a payload that grows
 *  one of them is a type error here rather than a passing test of a call no caller can
 *  make. */
type DrainRating = Pick<DrainObservationRecord, 'hours' | 'mindDrain' | 'bodyDrain'>;

function rating(overrides: Partial<DrainRating> = {}): DrainRating {
	return {
		hours: 2,
		mindDrain: 6,
		bodyDrain: 2,
		...overrides,
	};
}

/** What a fresh LOG must set: everything, because it is the moment the session's
 *  covariates are observed. It stopped being `rating()` plus a date on 2026-08-10, when a
 *  correction narrowed to the rated numbers — the two payloads are two shapes now, and a
 *  helper spanning both would type neither. */
function observation(
	overrides: Partial<DrainObservationRecord> = {},
): Omit<DrainObservationRecord, 'id' | 'createdAt'> {
	return {
		date: '2026-01-01',
		taskId: 1,
		taskTitle: 'Write tests',
		hours: 2,
		cognitiveDemand: 0.7,
		physicalDemand: 0.1,
		mindDrain: 6,
		bodyDrain: 2,
		...overrides,
	};
}

describe('drain-observation-repository', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	// The load-bearing one: this was an upsert on (taskId, date) until 2026-08-05,
	// so a second session REPLACED the first and vanished from the day's worked
	// hours that §8.10/§8.11/§12 read back.
	it('appends: a second session on the same task and day is its own row', async () => {
		await $addDrainObservation(
			observation({
				hours: 3,
			}),
		);

		await $addDrainObservation(
			observation({
				hours: 1.5,
				mindDrain: 8,
			}),
		);

		const sameDay = (await $readAllDrainObservations()).filter(
			(r) => r.date === '2026-01-01' && r.taskId === 1,
		);

		expect(sameDay).toHaveLength(2);
		expect(sameDay.reduce((sum, r) => sum + r.hours, 0)).toBe(4.5);
	});

	// Each row is its own session, so each carries its own log moment — the
	// time-of-day signal a circadian drain fit would condition on.
	it('stamps every row with its own createdAt', async () => {
		const morning = Date.parse('2026-01-03T09:00:00Z');
		const evening = Date.parse('2026-01-03T18:30:00Z');

		vi.spyOn(Date, 'now').mockReturnValue(morning);

		await $addDrainObservation(
			observation({
				date: '2026-01-03',
			}),
		);

		vi.spyOn(Date, 'now').mockReturnValue(evening);

		await $addDrainObservation(
			observation({
				date: '2026-01-03',
			}),
		);

		const day = (await $readAllDrainObservations()).filter((r) => r.date === '2026-01-03');
		expect(day.map((r) => r.createdAt)).toEqual([morning, evening]);
	});

	// Correcting one session must not create a second one — and must not move the
	// log moment, which is the only time-of-day signal the drain data carries.
	it('edits one row in place, keeping its original createdAt', async () => {
		const loggedAt = Date.parse('2026-01-05T18:30:00Z');
		const fixedAt = Date.parse('2026-01-06T09:00:00Z');

		vi.spyOn(Date, 'now').mockReturnValue(loggedAt);

		await $addDrainObservation(
			observation({
				date: '2026-01-05',
				mindDrain: 4,
			}),
		);

		const before = await $readAllDrainObservations();
		// `id!`: a repository read is unsanitized, and the key IndexedDB just
		// assigned is what an edit addresses.
		const target = before.find((r) => r.date === '2026-01-05')!;

		vi.spyOn(Date, 'now').mockReturnValue(fixedAt);

		await $editDrainObservation(
			target.id!,
			rating({
				mindDrain: 5,
			}),
		);

		const after = await $readAllDrainObservations();
		const edited = after.find((r) => r.id === target.id);

		expect(after).toHaveLength(before.length);
		expect(edited?.mindDrain).toBe(5);
		expect(edited?.createdAt).toBe(loggedAt);
	});

	// The row's ✎ corrects a rating on whatever day it is showing, so `date` is not
	// the caller's to pass: restamping it would move a measurement onto a day the
	// user never worked that session, which every fit reads back per day (§8.7) and
	// the §33 causal window scopes plans by.
	it('keeps a corrected rating on its own day', async () => {
		await $addDrainObservation(
			observation({
				date: '2026-01-07',
				mindDrain: 3,
			}),
		);

		// `id!`: a repository read is unsanitized, and the key IndexedDB just
		// assigned is what an edit addresses.
		const target = (await $readAllDrainObservations()).find((r) => r.date === '2026-01-07')!;

		await $editDrainObservation(
			target.id!,
			rating({
				mindDrain: 7,
			}),
		);

		const edited = (await $readAllDrainObservations()).find((r) => r.id === target.id);

		expect(edited?.date).toBe('2026-01-07');
		expect(edited?.mindDrain).toBe(7);
	});

	it('ignores an edit to a row that is gone', async () => {
		const before = await $readAllDrainObservations();

		await $editDrainObservation(9999, rating());

		expect(await $readAllDrainObservations()).toHaveLength(before.length);
	});

	it('deletes a single record by id', async () => {
		const all = await $readAllDrainObservations();
		// `id!`: a repository read is unsanitized, and asserting the key IndexedDB
		// just assigned is this test's point.
		await $deleteDrainObservation(all[0].id!);
		expect(await $readAllDrainObservations()).toHaveLength(all.length - 1);
	});

	it('deletes all records', async () => {
		await $deleteAllDrainObservations();
		expect(await $readAllDrainObservations()).toEqual([]);
	});
});
