import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import {
	EMPTY_PLAN_AUDIT,
	readDaySummaries,
	readModelReport,
	readTitleRatings,
} from '$lib/business/session-history';
import { $updateSession } from '$lib/data/repository/session-repository';
import { $addDrainObservation } from '$lib/data/repository/drain-observation-repository';
import { $updateFitSnapshot } from '$lib/data/repository/fit-snapshot-repository';
import { $updateFlowObservation } from '$lib/data/repository/flow-observation-repository';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import type { DailySession, FitSnapshotRecord, Task } from '$lib/data/type';

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

const fitSnapshot = (
	date: string,
	overrides: Partial<FitSnapshotRecord> = {},
): Omit<FitSnapshotRecord, 'createdAt'> => ({
	date,
	c1: DEFAULT_USER_CONSTANTS.c1,
	c2: DEFAULT_USER_CONSTANTS.c2,
	c3: DEFAULT_USER_CONSTANTS.c3,
	covariance: [
		[1, 0, 0],
		[0, 1, 0],
		[0, 0, 1],
	],
	sigma2: 0.0625,
	alphaCog: DEFAULT_ENERGY_PARAMS.alphaCog,
	alphaPhys: DEFAULT_ENERGY_PARAMS.alphaPhys,
	recoveryRate: DEFAULT_ENERGY_PARAMS.recoveryRate,
	stoppingValue: DEFAULT_ENERGY_PARAMS.freeTimeValue,
	...overrides,
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

describe('readTitleRatings', () => {
	it('reads every stored day up to today, so an old title is still recalled', async () => {
		await $updateSession(
			session('2020-03-04', {
				tasks: [
					task(1, {
						title: 'Deep work',
						physicalDifficulty: 1,
						mentalDifficulty: 9,
						enjoyment: 7,
					}),
				],
			}),
		);

		const ratings = await readTitleRatings('2026-06-10');

		expect(ratings.get('deep work')).toEqual({
			title: 'Deep work',
			physicalDifficulty: 1,
			mentalDifficulty: 9,
			enjoyment: 7,
		});
	});

	// A day planned ahead usually carries ratings imported from an older day, so
	// letting it win would answer with a rating the user has since replaced.
	it('ignores days after today', async () => {
		await $updateSession(
			session('2026-06-09', {
				tasks: [
					task(1, {
						title: 'Gym',
						physicalDifficulty: 8,
						mentalDifficulty: 2,
						enjoyment: 6,
					}),
				],
			}),
		);

		await $updateSession(
			session('2026-06-11', {
				tasks: [
					task(1, {
						title: 'Gym',
						physicalDifficulty: 5,
						mentalDifficulty: 5,
					}),
				],
			}),
		);

		expect((await readTitleRatings('2026-06-10')).get('gym')).toEqual({
			title: 'Gym',
			physicalDifficulty: 8,
			mentalDifficulty: 2,
			enjoyment: 6,
		});
	});

	it('is empty when nothing has ever been stored', async () => {
		expect((await readTitleRatings('1999-12-31')).size).toBe(0);
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

	// The §5.2 weights are only real if the facade dates them: passing no
	// ageDays silently restores the unweighted fit, and nothing above would
	// notice — the fit still succeeds, just over the wrong person.
	it('ages ⚡ logs against the report date (§5.2)', async () => {
		await $updateFlowObservation({
			date: '2016-03-04',
			taskId: 900,
			taskTitle: 'a decade ago',
			difficulty: 5,
			enjoyment: 5,
			E: 3,
			beta: 1.5,
			phiHours: 4,
		});

		const sameDay = await readModelReport('2016-03-04', 30);
		const decadeLater = await readModelReport('2026-03-04', 30);

		// The card's count is Σw — one fresh log is worth 1, the same log a decade
		// later ≈ 2⁻¹⁰ of one (a hair under, since ten years is 3652 days).
		expect(sameDay.calibration.flow.usedCount).toBeCloseTo(1, 9);
		expect(decadeLater.calibration.flow.usedCount).toBeCloseTo(2 ** -10, 4);

		// One 4h log pulls ϕ up while it is fresh; ten half-lives on, what is left
		// of that pull is a twentieth of it — the fit has returned to the prior.
		const fresh = sameDay.calibration.flow;
		const stale = decadeLater.calibration.flow;
		expect(fresh.phiHours).toBeGreaterThan(stale.phiHours);

		expect(Math.abs(stale.phiHours - stale.defaultPhiHours)).toBeLessThan(
			Math.abs(fresh.phiHours - fresh.defaultPhiHours) / 20,
		);
	});

	it('audits a finished day once its worked hours are logged', async () => {
		await $updateSession(session('2026-07-01'));

		await $addDrainObservation({
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

			// flowObservations, restObservations, drainObservations, sessions, fitSnapshots
			expect(transactions.mock.calls.length).toBeLessThanOrEqual(5);
		} finally {
			transactions.mockRestore();
		}
	});

	it('caps the audit lookback', async () => {
		for (const day of ['2026-08-01', '2026-08-02', '2026-08-03']) {
			await $updateSession(session(day));

			await $addDrainObservation({
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

// MATH.md §12: the audit scores a finished day against the fit recorded on that
// day, so the report hands back today's fit for the caller to record.
describe('readModelReport fit snapshots', () => {
	/** Two tasks the planners must rank differently, or a re-fit changes no share. */
	const lopsided = (date: string): DailySession => ({
		date,
		tasks: [
			task(1, {
				mentalDifficulty: 9,
				physicalDifficulty: 1,
				enjoyment: 3,
			}),
			task(2, {
				mentalDifficulty: 2,
				physicalDifficulty: 9,
				enjoyment: 9,
			}),
		],
		availableHours: 8,
		switchCost: 0.5,
		updatedAt: 0,
	});

	const logWork = (date: string) =>
		$addDrainObservation({
			date,
			taskId: 1,
			taskTitle: 'task 1',
			hours: 3,
			cognitiveDemand: 0.9,
			physicalDemand: 0.1,
			mindDrain: 7,
			bodyDrain: 2,
		});

	it("hands back today's fit, matching the numbers the card reports", async () => {
		const report = await readModelReport('2026-09-10', 30);
		const { todaysFit, calibration } = report;

		expect(todaysFit.date).toBe('2026-09-10');
		expect(todaysFit.alphaCog).toBe(calibration.energy.params.alphaCog);
		expect(todaysFit.alphaPhys).toBe(calibration.energy.params.alphaPhys);
		expect(todaysFit.recoveryRate).toBe(calibration.energy.params.recoveryRate);
		expect(todaysFit.stoppingValue).toBe(calibration.stopping.value);
		// The posterior travels whole: without it σ_ϕ is 0 downstream (§13.1).
		expect(todaysFit.covariance).toHaveLength(3);
		expect(todaysFit.covariance.every((row) => row.length === 3)).toBe(true);
		expect(Number.isFinite(todaysFit.sigma2)).toBe(true);
	});

	// The audit reports days ascending, so the day under test is the last one — the
	// count itself is not the assertion (this file shares one database).
	it('scores a finished day under the fit recorded that day, leaving the others alone', async () => {
		await $updateSession(lopsided('2026-09-01'));
		await logWork('2026-09-01');

		const live = await readModelReport('2026-09-02', 30);

		await $updateFitSnapshot(
			fitSnapshot('2026-09-01', {
				// A plane that inverts which task reaches flow first, and rates that
				// drain the day flat — nothing the live fit could coincide with.
				c1: -0.3,
				c2: 0.8,
				c3: 0.4,
				alphaCog: 1.9,
				alphaPhys: 1.9,
				recoveryRate: 0.1,
			}),
		);

		const recorded = await readModelReport('2026-09-02', 30);

		expect(recorded.audit.usedCount).toBe(live.audit.usedCount);
		expect(recorded.audit.days.at(-1)).not.toEqual(live.audit.days.at(-1));
		// Only the day that has a snapshot moves; the rest keep the live fit.
		expect(recorded.audit.days.slice(0, -1)).toEqual(live.audit.days.slice(0, -1));
	});

	// A day whose snapshot is unreadable must fall back to the live fit rather than
	// drop out of the audit — the day was still worked.
	it('ignores a corrupt snapshot and audits the day on the live fit', async () => {
		await $updateSession(lopsided('2026-09-05'));
		await logWork('2026-09-05');

		const live = await readModelReport('2026-09-06', 30);

		await $updateFitSnapshot(
			fitSnapshot('2026-09-05', {
				alphaCog: NaN,
			}),
		);

		const report = await readModelReport('2026-09-06', 30);

		expect(report.audit.usedCount).toBe(live.audit.usedCount);
		expect(report.audit.days.at(-1)).toEqual(live.audit.days.at(-1));
	});

	it("ends the trend in today's fit, before anything is recorded", async () => {
		const { calibration } = await readModelReport('2026-10-05', 30);
		const { trend } = calibration;

		expect(trend.alphaCog.at(-1)).toBe(calibration.energy.params.alphaCog);
		expect(trend.recoveryRate.at(-1)).toBe(calibration.energy.params.recoveryRate);
		expect(trend.stoppingValue.at(-1)).toBe(calibration.stopping.value);
		expect(trend.phiHours.at(-1)).toBe(calibration.flow.phiHours);
	});

	// The audit keeps the last `auditDayCap` days that were WORKED, which for
	// anyone who skips days reaches further back than `auditDayCap` CALENDAR days
	// — the trend's window. The snapshot read is widened to cover them, and
	// without that widening this day's recorded fit is silently ignored and the
	// §12.1 correction is lost for exactly the sporadic loggers it matters most
	// for. Nothing else in this suite audits a day outside the trend window.
	it('applies the recorded fit of a worked day older than the trend window', async () => {
		await $updateSession(lopsided('2026-10-01'));
		await logWork('2026-10-01');

		// Three months on: 2026-10-01 is far outside today − 29, but it is still one
		// of the last 30 worked days, so the audit still scores it.
		const live = await readModelReport('2027-01-01', 30);

		await $updateFitSnapshot(
			fitSnapshot('2026-10-01', {
				c1: -0.3,
				c2: 0.8,
				c3: 0.4,
				alphaCog: 1.9,
				alphaPhys: 1.9,
				recoveryRate: 0.1,
			}),
		);

		const recorded = await readModelReport('2027-01-01', 30);

		expect(recorded.audit.usedCount).toBe(live.audit.usedCount);
		expect(recorded.audit.days.at(-1)).not.toEqual(live.audit.days.at(-1));
		// …and it is outside the trend window, so the sparkline never sees it.
		expect(recorded.calibration.trend.alphaCog).toHaveLength(1);
	});

	it('plots the recorded days ascending, with today fitted fresh rather than read back', async () => {
		await $updateFitSnapshot(
			fitSnapshot('2026-11-02', {
				alphaCog: 0.11,
			}),
		);

		await $updateFitSnapshot(
			fitSnapshot('2026-11-03', {
				alphaCog: 0.22,
			}),
		);

		// A stale record for today: the card's number comes from the live fit, so the
		// last point must too, or the sparkline contradicts the value beside it.
		await $updateFitSnapshot(
			fitSnapshot('2026-11-04', {
				alphaCog: 1.99,
			}),
		);

		const { calibration } = await readModelReport('2026-11-04', 30);

		expect(calibration.trend.alphaCog).toEqual([0.11, 0.22, calibration.energy.params.alphaCog]);
	});
});
