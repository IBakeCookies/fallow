import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import {
	$createRestObservation,
	$updateRestObservation,
	$readAllRestObservations,
	$deleteRestObservation,
	$deleteAllRestObservations,
	$restoreRestObservation,
} from '$lib/data/repository/rest-observation-repository';
import type { RestObservationRecord, Persisted } from '$lib/data/type';

function observation(
	overrides: Partial<RestObservationRecord> = {},
): Omit<RestObservationRecord, 'id' | 'createdAt'> {
	return {
		date: '2026-01-01',
		hours: 0.5,
		mindBefore: 7,
		mindAfter: 3,
		bodyBefore: 4,
		bodyAfter: 2,
		...overrides,
	};
}

/** What a correction may set: the five numbers the user rated, and nothing that
 *  identifies the break. Its own type, so a payload growing a `date` or a
 *  stamp is a type error here and not a passing test of an impossible call. */
function pair(
	overrides: Partial<Omit<RestObservationRecord, 'id' | 'createdAt' | 'date'>> = {},
): Omit<RestObservationRecord, 'id' | 'createdAt' | 'date'> {
	return {
		hours: 0.25,
		mindBefore: 8,
		mindAfter: 2,
		bodyBefore: 6,
		bodyAfter: 1,
		...overrides,
	};
}

describe('rest-observation-repository', () => {
	it('appends: identical same-day records do NOT upsert', async () => {
		await $createRestObservation(observation());
		await $createRestObservation(observation());
		const all = await $readAllRestObservations();
		expect(all).toHaveLength(2);
		expect(all[0].id).not.toBe(all[1].id);
	});

	it('stamps createdAt', async () => {
		const [record] = await $readAllRestObservations();
		expect(record.createdAt).toBeGreaterThan(0);
	});

	/* ☕'s correction arrived with the analytics ✎ (2026-08-10), which is its only editor:
	   a break belongs to no task, so neither screen's task list can carry one. Same
	   contract as the drain twin — one row corrected in place, its day and its log moment
	   untouched, a missing id a no-op. The stamp matters here for the reason it does
	   there: it is the only time-of-day signal a break carries, and it orders the
	   analytics list. */
	it('edits one pair in place, keeping its original createdAt', async () => {
		const loggedAt = Date.parse('2026-01-05T18:30:00Z');
		const fixedAt = Date.parse('2026-01-06T09:00:00Z');

		vi.spyOn(Date, 'now').mockReturnValue(loggedAt);

		await $createRestObservation(
			observation({
				date: '2026-01-05',
				mindAfter: 5,
			}),
		);

		const before = await $readAllRestObservations();
		// `id!`: a repository read is unsanitized, and the key IndexedDB just assigned is
		// what an edit addresses.
		const target = before.find((r) => r.date === '2026-01-05')!;

		vi.spyOn(Date, 'now').mockReturnValue(fixedAt);

		await $updateRestObservation(
			target.id!,
			pair({
				mindAfter: 1,
			}),
		);

		vi.restoreAllMocks();

		const after = await $readAllRestObservations();
		const edited = after.find((r) => r.id === target.id);

		expect(after).toHaveLength(before.length);
		expect(edited?.mindAfter).toBe(1);
		expect(edited?.hours).toBe(0.25);
		expect(edited?.createdAt).toBe(loggedAt);
		// The day it was taken. Restamping it would move a recovery onto a day it did not
		// happen on, which §8.9's fit and the causal window both read back per day.
		expect(edited?.date).toBe('2026-01-05');
	});

	it('ignores an edit to a pair that is gone', async () => {
		const before = await $readAllRestObservations();

		await $updateRestObservation(9999, pair());

		expect(await $readAllRestObservations()).toHaveLength(before.length);
	});

	it('deletes a single record by id', async () => {
		const all = await $readAllRestObservations();
		await $deleteRestObservation(all[0].id!);
		expect(await $readAllRestObservations()).toHaveLength(all.length - 1);
	});

	// Undo of a ✕: the dropped break comes back as itself, id and stamp included. A
	// re-log would be a second recovery for §8.9 to fit r against, and the analytics
	// list is the only place a ☕ can be dropped from at all.
	it('restores a dropped record under its own id and stamp', async () => {
		const loggedAt = Date.parse('2026-01-09T13:00:00Z');

		vi.spyOn(Date, 'now').mockReturnValue(loggedAt);

		await $createRestObservation(
			observation({
				date: '2026-01-09',
			}),
		);

		// `id!`: a repository read is unsanitized, and the assigned key is what the
		// restore has to come back under.
		const dropped = (await $readAllRestObservations()).find((r) => r.date === '2026-01-09')!;

		await $deleteRestObservation(dropped.id!);

		vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-01-10T09:00:00Z'));

		await $restoreRestObservation(dropped as Persisted<RestObservationRecord>);

		expect((await $readAllRestObservations()).find((r) => r.id === dropped.id)).toEqual(dropped);
	});

	it('deletes all records', async () => {
		await $deleteAllRestObservations();
		expect(await $readAllRestObservations()).toEqual([]);
	});
});
