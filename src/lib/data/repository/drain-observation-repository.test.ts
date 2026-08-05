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
			observation({
				date: '2026-01-05',
				mindDrain: 5,
			}),
		);

		const after = await $readAllDrainObservations();
		const edited = after.find((r) => r.id === target.id);

		expect(after).toHaveLength(before.length);
		expect(edited?.mindDrain).toBe(5);
		expect(edited?.createdAt).toBe(loggedAt);
	});

	it('ignores an edit to a row that is gone', async () => {
		const before = await $readAllDrainObservations();

		await $editDrainObservation(9999, observation());

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
