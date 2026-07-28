import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { EMPTY_PLAN_AUDIT, readDaySummaries, readModelReport } from '$lib/business/session-history';
import { $updateSession } from '$lib/data/repository/session-repository';
import { $updateDrainObservation } from '$lib/data/repository/drain-observation-repository';
import type { DailySession, Task } from '$lib/data/type';

const task = (id: number, over: Partial<Task> = {}): Task => ({
	id,
	title: `task ${id}`,
	physicalDifficulty: 3,
	mentalDifficulty: 8,
	enjoyment: 5,
	createdAt: '2026-07-20',
	completed: false,
	...over,
});

const session = (date: string, over: Partial<DailySession> = {}): DailySession => ({
	date,
	tasks: [
		task(1),
		task(2, {
			completed: true,
		}),
	],
	availableHours: 8,
	switchCost: 0.5,
	updatedAt: 0,
	...over,
});

describe('readDaySummaries', () => {
	it('summarizes the stored days in the range, skipping days with no tasks', async () => {
		await $updateSession(session('2026-06-01'));

		await $updateSession(
			session('2026-06-02', {
				tasks: [],
			}),
		);

		await $updateSession(session('2026-06-03'));
		await $updateSession(session('2026-06-09')); // outside the range

		const days = await readDaySummaries('2026-06-01', '2026-06-07');

		expect(days.map((d) => d.date)).toEqual(['2026-06-01', '2026-06-03']);
		expect(days[0].totalTasks).toBe(2);
		expect(days[0].completedTasks).toBe(1);
		// Priority-weighted, so a half-done day is not mechanically 50%
		expect(days[0].completionRate).toBeGreaterThan(0);
		expect(days[0].completionRate).toBeLessThan(100);
	});

	it('is empty when nothing is stored in the range', async () => {
		expect(await readDaySummaries('1999-01-01', '1999-12-31')).toEqual([]);
	});
});

describe('readModelReport', () => {
	it('reports an audit of no days when nothing has been worked', async () => {
		const report = await readModelReport('2026-06-10', 30);

		expect(report.audit).toEqual(EMPTY_PLAN_AUDIT);
		expect(report.audit.usedCount).toBe(0);
		// The "Your model" card needs a default beside every fitted row
		expect(report.calibration.defaults.recoveryRate).toBeGreaterThan(0);
		expect(report.calibration.flow.defaultPhiHours).toBeGreaterThan(0);
	});

	it('audits a finished day once its worked hours are logged', async () => {
		await $updateSession(session('2026-07-01'));

		await $updateDrainObservation({
			date: '2026-07-01',
			taskId: 1,
			taskTitle: 'task 1',
			hours: 3,
			cognitiveDemand: 0.8,
			physicalDemand: 0.3,
			mindDrain: 8,
			bodyDrain: 4,
		});

		const report = await readModelReport('2026-07-02', 30);

		expect(report.audit.usedCount).toBe(1);
		expect(report.audit.energyOverlap).toBeGreaterThanOrEqual(0);
		expect(report.audit.classicOverlap).toBeGreaterThanOrEqual(0);
	});

	// Both model cards derive from the same records, and every read is a full
	// store scan that grows with the user's whole history — so composing the two
	// derivations independently (three drain scans, two of everything else) is a
	// cost the analytics screen pays on every visit.
	it('reads each store once, whatever the report derives', async () => {
		const transactions = vi.spyOn(IDBDatabase.prototype, 'transaction');

		try {
			await readModelReport('2026-07-02', 30);

			// flowObservations, restObservations, drainObservations, sessions
			expect(transactions.mock.calls.length).toBeLessThanOrEqual(4);
		} finally {
			transactions.mockRestore();
		}
	});

	it('caps the audit lookback', async () => {
		for (const day of ['2026-08-01', '2026-08-02', '2026-08-03']) {
			await $updateSession(session(day));

			await $updateDrainObservation({
				date: day,
				taskId: 1,
				taskTitle: 'task 1',
				hours: 3,
				cognitiveDemand: 0.8,
				physicalDemand: 0.3,
				mindDrain: 8,
				bodyDrain: 4,
			});
		}

		expect((await readModelReport('2026-08-04', 2)).audit.usedCount).toBe(2);
	});
});
