import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import {
	$createOrUpdateFlowObservation,
	$updateFlowObservation,
	$readAllFlowObservations,
	$deleteFlowObservation,
	$deleteAllFlowObservations,
} from '$lib/data/repository/flow-observation-repository';
import type { FlowObservationRecord } from '$lib/data/type';

function observation(
	overrides: Partial<FlowObservationRecord> = {},
): Omit<FlowObservationRecord, 'id' | 'createdAt'> {
	return {
		date: '2026-01-01',
		taskId: 1,
		taskTitle: 'Write tests',
		difficulty: 5,
		enjoyment: 6,
		E: 3,
		beta: 1.5,
		phiHours: 0.4,
		...overrides,
	};
}

describe('flow-observation-repository', () => {
	it('starts empty', async () => {
		expect(await $readAllFlowObservations()).toEqual([]);
	});

	it('creates a record with a generated id and createdAt', async () => {
		await $createOrUpdateFlowObservation(observation());
		const [record] = await $readAllFlowObservations();
		expect(record.id).toBeTypeOf('number');
		expect(record.createdAt).toBeGreaterThan(0);
	});

	it('upserts: same taskId + date replaces instead of appending', async () => {
		await $createOrUpdateFlowObservation(
			observation({
				phiHours: 0.9,
			}),
		);

		const all = await $readAllFlowObservations();
		expect(all).toHaveLength(1);
		expect(all[0].phiHours).toBe(0.9);
	});

	// The stamp says when the measurement was TAKEN, and a correction re-describes the
	// same one — the same rule 🪫 corrections follow (MATH.md §18), and what the analytics
	// history orders a day by. Reachable since ⚡ became correctable on a past day: a
	// re-stamped log would sort as the newest thing in a day years old.
	it('keeps the original stamp when a correction replaces a measurement', async () => {
		const [before] = await $readAllFlowObservations();

		await $createOrUpdateFlowObservation(
			observation({
				phiHours: 0.2,
			}),
		);

		const [after] = await $readAllFlowObservations();
		expect(after.phiHours).toBe(0.2);
		expect(after.createdAt).toBe(before.createdAt);
	});

	it('different taskId or date appends', async () => {
		await $createOrUpdateFlowObservation(
			observation({
				taskId: 2,
			}),
		);

		await $createOrUpdateFlowObservation(
			observation({
				date: '2026-01-02',
			}),
		);

		expect(await $readAllFlowObservations()).toHaveLength(3);
	});

	/* The by-id correction, for a caller with a record and no viewed day (the analytics
	   ✎). It exists BESIDE the upsert rather than reusing it, and these three tests are
	   why: the upsert addressed by (taskId, date) cannot tell "correct this" from "log
	   this", so handing it a deleted record's fields re-creates the record. A ✎ clicked
	   after another tab dropped the row would put the measurement back into the ϕ fit. */
	it('edits one record in place, keeping everything the measurement captured', async () => {
		const loggedAt = Date.parse('2026-02-01T18:30:00Z');

		vi.spyOn(Date, 'now').mockReturnValue(loggedAt);

		await $createOrUpdateFlowObservation(
			observation({
				date: '2026-02-01',
				taskId: 42,
				difficulty: 9,
				enjoyment: 2,
				E: 5,
				beta: 1.1,
				phiHours: 0.5,
			}),
		);

		vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-02-02T09:00:00Z'));

		const before = await $readAllFlowObservations();
		// `id!`: a repository read is unsanitized, and the key IndexedDB just assigned is
		// what an edit addresses.
		const target = before.find((r) => r.taskId === 42)!;

		await $updateFlowObservation(target.id!, {
			phiHours: 0.75,
		});

		vi.restoreAllMocks();

		const after = await $readAllFlowObservations();
		const edited = after.find((r) => r.id === target.id);

		expect(after).toHaveLength(before.length);
		expect(edited?.phiHours).toBe(0.75);
		// Everything a correction may not touch: the day, the task, the covariates the ϕ
		// fit reads (MATH.md §36), and the log moment.
		expect(edited?.date).toBe('2026-02-01');
		expect(edited?.taskId).toBe(42);
		expect(edited?.difficulty).toBe(9);
		expect(edited?.enjoyment).toBe(2);
		expect(edited?.E).toBe(5);
		expect(edited?.beta).toBe(1.1);
		expect(edited?.createdAt).toBe(loggedAt);
	});

	// The case the upsert cannot serve, and the reason this function exists.
	it('ignores an edit to a record that is gone, rather than re-creating it', async () => {
		await $createOrUpdateFlowObservation(
			observation({
				date: '2026-02-03',
				taskId: 43,
			}),
		);

		// `id!`: see above.
		const target = (await $readAllFlowObservations()).find((r) => r.taskId === 43)!;

		await $deleteFlowObservation(target.id!);

		const before = await $readAllFlowObservations();

		await $updateFlowObservation(target.id!, {
			phiHours: 0.9,
		});

		const after = await $readAllFlowObservations();

		expect(after).toHaveLength(before.length);
		expect(after.find((r) => r.id === target.id)).toBeUndefined();
	});

	it('deletes a single record by id', async () => {
		const all = await $readAllFlowObservations();
		await $deleteFlowObservation(all[0].id!);
		expect(await $readAllFlowObservations()).toHaveLength(all.length - 1);
	});

	it('deletes all records', async () => {
		await $deleteAllFlowObservations();
		expect(await $readAllFlowObservations()).toEqual([]);
	});
});
