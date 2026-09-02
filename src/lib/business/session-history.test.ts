import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import {
	EMPTY_PLAN_AUDIT,
	readDaySummaries,
	readHistoryPrefills,
	readModelReport,
	readStopObservations,
} from '$lib/business/session-history';
import { $updateSession } from '$lib/data/repository/session-repository';
import { $createDrainObservation } from '$lib/data/repository/drain-observation-repository';
import { $createRestObservation } from '$lib/data/repository/rest-observation-repository';
import { $updateFitSnapshot } from '$lib/data/repository/fit-snapshot-repository';
import { $createOrUpdateFlowObservation } from '$lib/data/repository/flow-observation-repository';
import { prefillBudgetFor } from '$lib/business/model/budget-memory';
import { daysBetween } from '$lib/business/utils/date';
import {
	calculateFlowStateTime,
	DEFAULT_USER_CONSTANTS,
	fitUserConstants,
} from '$lib/business/model/zenith';
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

	/* Each day is scored under the fit RECORDED on it, not one whole-history fit
	   spread across the range. Before this, logging a single ⚡ today silently
	   rewrote the completion rate of every day the calendar shows — the same
	   defect as the mid-day re-plan, at the scale of the user's whole history. */
	it('scores each day under its own recorded fit, and only that day', async () => {
		await $updateSession(session('2026-02-10'));
		await $updateSession(session('2026-02-11'));

		const live = await readDaySummaries('2026-02-10', '2026-02-16');

		await $updateFitSnapshot(
			fitSnapshot('2026-02-10', {
				// A plane no live fit could coincide with, so the day visibly reads
				// through its own model rather than through today's.
				c1: -0.3,
				c2: 0.8,
				c3: 0.4,
			}),
		);

		const recorded = await readDaySummaries('2026-02-10', '2026-02-16');

		expect(recorded.map((d) => d.date)).toEqual(live.map((d) => d.date));
		expect(recorded[0]).not.toEqual(live[0]);
		// The day with no snapshot still falls back to the live fit, unchanged.
		expect(recorded[1]).toEqual(live[1]);
	});
});

describe('readHistoryPrefills', () => {
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

		const { titleRatings } = await readHistoryPrefills('2026-06-10');

		expect(titleRatings.get('deep work')).toEqual({
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

		expect((await readHistoryPrefills('2026-06-10')).titleRatings.get('gym')).toEqual({
			title: 'Gym',
			physicalDifficulty: 8,
			mentalDifficulty: 2,
			enjoyment: 6,
		});
	});

	it('is empty when nothing has ever been stored', async () => {
		expect((await readHistoryPrefills('1999-12-31')).titleRatings.size).toBe(0);
	});

	// This reads all of history in one range query, so one unreadable day is the
	// whole map's blast radius: without the sanitizer a restored backup's bad row
	// throws, and the user loses every title they ever rated rather than one day.
	it('recalls the readable days when a stored day is corrupt', async () => {
		await $updateSession({
			...session('2019-01-01'),
			tasks: 'not an array',
		} as unknown as DailySession);

		await $updateSession(
			session('2019-01-02', {
				tasks: [
					task(1, {
						title: 'Stretch',
						physicalDifficulty: 2,
						mentalDifficulty: 1,
						enjoyment: 8,
					}),
				],
			}),
		);

		expect((await readHistoryPrefills('2026-06-10')).titleRatings.get('stretch')).toEqual({
			title: 'Stretch',
			physicalDifficulty: 2,
			mentalDifficulty: 1,
			enjoyment: 8,
		});
	});

	// Both derivations fold the same whole-history scan, which grows with the
	// user's every stored day — a second range read for the budgets would double
	// the one read `#boot` deliberately does not wait for.
	it('derives the budget prefill from the same scan as the titles', async () => {
		await $updateSession(
			session('2026-06-03', {
				availableHours: 5,
				tasks: [
					task(1, {
						title: 'Deep work',
					}),
				],
			}),
		);

		const transactions = vi.spyOn(IDBDatabase.prototype, 'transaction');

		try {
			const { titleRatings, budgets } = await readHistoryPrefills('2026-06-10');

			expect(titleRatings.size).toBeGreaterThan(0);
			expect(prefillBudgetFor(budgets, '2026-06-10')).toBeGreaterThan(0);
			expect(transactions.mock.calls.length).toBe(1);
		} finally {
			transactions.mockRestore();
		}
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

	// The report reads the rest store for the r fit, and the analytics screen's
	// break totals fold the same rows — surfacing them costs no second read.
	it('surfaces the ☕ rows it already read for the fit', async () => {
		await $createRestObservation({
			date: '2026-06-02',
			hours: 0.5,
			mindBefore: 8,
			mindAfter: 5,
			bodyBefore: 6,
			bodyAfter: 4,
		});

		const report = await readModelReport('2026-06-10', 30);

		expect(report.rest).toHaveLength(1);

		expect(report.rest[0]).toMatchObject({
			date: '2026-06-02',
			mindAfter: 5,
		});
	});

	// The §5.2 weights are only real if the facade dates them: passing no
	// ageDays silently restores the unweighted fit, and nothing above would
	// notice — the fit still succeeds, just over the wrong person.
	it('ages ⚡ logs against the report date (§5.2)', async () => {
		await $createOrUpdateFlowObservation({
			date: '2016-03-04',
			taskId: 900,
			taskTitle: 'a decade ago',
			difficulty: 5,
			enjoyment: 5,
			E: 3,
			beta: 1.5,
			phiHours: 4,
		});

		// The day after is the freshest a counted log can be: the log's own day
		// reads none of it, which the case below this one pins.
		const nextDay = await readModelReport('2016-03-05', 30);
		const decadeLater = await readModelReport('2026-03-04', 30);

		// The card's count is Σw — a one-day-old log is worth 2^(−1/365), the same
		// log a decade later ≈ 2⁻¹⁰ of one.
		expect(nextDay.calibration.flow.usedCount).toBeCloseTo(2 ** (-1 / 365), 9);
		expect(decadeLater.calibration.flow.usedCount).toBeCloseTo(2 ** -10, 4);

		// One 4h log pulls ϕ up while it is fresh; ten half-lives on, what is left
		// of that pull is a twentieth of it — the fit has returned to the prior.
		const fresh = nextDay.calibration.flow;
		const stale = decadeLater.calibration.flow;
		expect(fresh.phiHours).toBeGreaterThan(stale.phiHours);

		expect(Math.abs(stale.phiHours - stale.defaultPhiHours)).toBeLessThan(
			Math.abs(fresh.phiHours - fresh.defaultPhiHours) / 20,
		);
	});

	/* The report is the model the day is PLANNING under, so it reads the same
	   window the dashboard does — logs strictly before the report date. Without
	   this the analytics card would print a ϕ moved by a log the main page's plan
	   had not yet counted, which is the same dishonesty on a second screen. The
	   deferred rows are reported rather than dropped, so the card can say
	   "logged today" instead of appearing to have lost them. */
	it('excludes the report date’s own ⚡ logs, and reports them as pending', async () => {
		// Measured against this store's own baseline rather than against zero: the
		// suite shares a database, so what matters is that the NEW log changes
		// nothing on its own day and everything on the next.
		const before = (await readModelReport('2026-05-01', 30)).calibration.flow;

		await $createOrUpdateFlowObservation({
			date: '2026-05-01',
			taskId: 901,
			taskTitle: 'logged this morning',
			difficulty: 5,
			enjoyment: 5,
			E: 3,
			beta: 1.5,
			phiHours: 4,
		});

		const sameDay = (await readModelReport('2026-05-01', 30)).calibration.flow;

		expect(sameDay.usedCount).toBe(before.usedCount);
		expect(sameDay.phiHours).toBe(before.phiHours);
		expect(sameDay.pendingCount).toBe(1);

		const nextDay = (await readModelReport('2026-05-02', 30)).calibration.flow;

		expect(nextDay.pendingCount).toBe(0);
		expect(nextDay.usedCount).toBeGreaterThan(before.usedCount + 0.9);
		// A 4h log on a mid-scale task pulls the reference ϕ up, so the deferral is
		// suppressing a real move rather than a no-op.
		expect(nextDay.phiHours).toBeGreaterThan(before.phiHours);
	});

	it('audits a finished day once its worked hours are logged', async () => {
		await $updateSession(session('2026-07-01'));

		await $createDrainObservation({
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

	/* The other three fits defer today's rows on the same rule the ϕ fit does, so
	   the report names them too — a ☕ logged this morning otherwise leaves the
	   Recovery row's count unmoved, which reads as a log that was dropped. */
	it('defers a ☕ logged today, and counts it from tomorrow', async () => {
		await $createRestObservation({
			date: '2027-02-01',
			hours: 0.5,
			mindBefore: 8,
			mindAfter: 5,
			bodyBefore: 6,
			bodyAfter: 4,
		});

		await $createRestObservation({
			date: '2027-02-02',
			hours: 0.5,
			mindBefore: 7,
			mindAfter: 4,
			bodyBefore: 5,
			bodyAfter: 3,
		});

		expect((await readModelReport('2027-02-02', 30)).calibration.energy.pendingRestCount).toBe(1);
		expect((await readModelReport('2027-02-03', 30)).calibration.energy.pendingRestCount).toBe(0);
	});

	// Both α fits read the same 🪫 rows, so there is one count for the two rows.
	it('defers the 🪫 logged today', async () => {
		const drain = (date: string, taskId: number) =>
			$createDrainObservation({
				date,
				taskId,
				taskTitle: `task ${taskId}`,
				hours: 2,
				cognitiveDemand: 0.8,
				physicalDemand: 0.3,
				mindDrain: 8,
				bodyDrain: 4,
			});

		await drain('2027-02-04', 1);
		await drain('2027-02-05', 1);
		await drain('2027-02-05', 2);

		expect((await readModelReport('2027-02-05', 30)).calibration.energy.pendingDrainCount).toBe(2);
	});

	// λ₀ reads whole DAYS, so the promise is only honest if today would actually
	// pass the finished-day join — a stored session with tasks and hours.
	it('promises today to the λ₀ fit once the day would qualify', async () => {
		await $updateSession(session('2027-02-10'));

		await $createDrainObservation({
			date: '2027-02-10',
			taskId: 1,
			taskTitle: 'task 1',
			hours: 2,
			cognitiveDemand: 0.8,
			physicalDemand: 0.3,
			mindDrain: 8,
			bodyDrain: 4,
		});

		expect((await readModelReport('2027-02-10', 30)).calibration.stopping.todayPending).toBe(true);
	});

	it('promises nothing for a 🪫 logged against no stored day', async () => {
		await $createDrainObservation({
			date: '2027-02-15',
			taskId: 1,
			taskTitle: 'task 1',
			hours: 2,
			cognitiveDemand: 0.8,
			physicalDemand: 0.3,
			mindDrain: 8,
			bodyDrain: 4,
		});

		expect((await readModelReport('2027-02-15', 30)).calibration.stopping.todayPending).toBe(false);
	});

	// A pin: the finished-day read is widened by a day to see whether today would
	// qualify, and the fit must still read none of it.
	it('leaves the λ₀ fit reading no day dated today', async () => {
		const before = (await readModelReport('2027-02-20', 30)).calibration.stopping;

		await $updateSession(session('2027-02-20'));

		await $createDrainObservation({
			date: '2027-02-20',
			taskId: 1,
			taskTitle: 'task 1',
			hours: 2,
			cognitiveDemand: 0.8,
			physicalDemand: 0.3,
			mindDrain: 8,
			bodyDrain: 4,
		});

		const after = (await readModelReport('2027-02-20', 30)).calibration.stopping;

		expect(after.usedCount).toBe(before.usedCount);
		expect(after.value).toBe(before.value);
	});

	it('caps the audit lookback', async () => {
		for (const day of ['2026-08-01', '2026-08-02', '2026-08-03']) {
			await $updateSession(session(day));

			await $createDrainObservation({
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

// The audit scores a finished day against the fit recorded on that
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
		$createDrainObservation({
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
		// The posterior travels whole: without it σ_ϕ is 0 downstream.
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
	// correction is lost for exactly the sporadic loggers it matters most
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

describe('readStopObservations', () => {
	it('carries the day’s open tasks, so a finished one is no forgone step (MATH.md §8.10)', async () => {
		await $updateSession(session('2026-03-02'));

		await $createDrainObservation({
			date: '2026-03-02',
			taskId: 1,
			taskTitle: 'task 1',
			hours: 3,
			cognitiveDemand: 0.8,
			physicalDemand: 0.3,
			mindDrain: 8,
			bodyDrain: 4,
		});

		const [day] = await readStopObservations('2026-03-03');

		expect([...day.openTaskIds!]).toEqual([1]);
	});

	// One row per SESSION, not one per task: summing them here is what
	// destroyed the day's breaks before §8.10's estimator could read them, so the
	// join must carry each row's own log moment through (MATH.md §8.10).
	it('carries one row per session with the moment it was logged (MATH.md §8.10)', async () => {
		await $updateSession(session('2026-03-04'));

		const row = (hours: number) => ({
			date: '2026-03-04',
			taskId: 1,
			taskTitle: 'task 1',
			hours,
			cognitiveDemand: 0.8,
			physicalDemand: 0.3,
			mindDrain: 8,
			bodyDrain: 4,
		});

		// `$createDrainObservation` stamps `Date.now()`; fake timers would stall the
		// IndexedDB round trip, so only the clock it reads is replaced.
		const now = vi.spyOn(Date, 'now');
		now.mockReturnValue(Date.parse('2026-03-04T10:00:00.000Z'));
		await $createDrainObservation(row(2));
		now.mockReturnValue(Date.parse('2026-03-04T13:00:00.000Z'));
		await $createDrainObservation(row(1.5));
		now.mockRestore();

		const days = await readStopObservations('2026-03-05');
		const day = days[days.length - 1];

		expect(day.workedHours).toEqual([
			{
				taskId: 1,
				hours: 2,
				endedAt: Date.parse('2026-03-04T10:00:00.000Z'),
			},
			{
				taskId: 1,
				hours: 1.5,
				endedAt: Date.parse('2026-03-04T13:00:00.000Z'),
			},
		]);
	});
});

/* The ϕ skill reading (MATH.md §5, scoring convention): the report grades the
   fit prequentially over the user's own ⚡ history — each date block predicted
   by the fit on logs dated strictly before it, aged against it — and states the
   whole-walk mean-absolute gap, default minus fitted. The expected value below
   is that walk written out longhand, so a fit that leaked a same-date sibling,
   skipped the aging, or read a log dated past the report date cannot match it. */
describe('readModelReport ϕ skill', () => {
	// A consistent +1h offset from the default plane, no noise — learnable from
	// the first log, so the fitted plane is strictly closer on every scored one.
	const phi = (E: number, beta: number) =>
		DEFAULT_USER_CONSTANTS.c1 * E +
		DEFAULT_USER_CONSTANTS.c2 * beta +
		DEFAULT_USER_CONSTANTS.c3 +
		1;

	// Dated before every other ⚡ row this suite seeds, so rows from the tests
	// above sit past the report date and the walk below owns its whole window.
	const logs = [
		{
			date: '2015-05-01',
			taskId: 801,
			E: 3,
			beta: 1.5,
		},
		{
			date: '2015-05-01',
			taskId: 802,
			E: 5,
			beta: 1.8,
		},
		{
			date: '2015-05-05',
			taskId: 803,
			E: 2,
			beta: 1,
		},
		{
			date: '2015-05-10',
			taskId: 804,
			E: 4,
			beta: 1.7,
		},
		{
			date: '2015-05-15',
			taskId: 805,
			E: 3.5,
			beta: 2,
		},
		{
			date: '2015-05-20',
			taskId: 806,
			E: 1.5,
			beta: 1.2,
		},
	];

	const todaysLog = {
		date: '2015-05-25',
		taskId: 807,
		E: 4.5,
		beta: 1.8,
	};

	const today = todaysLog.date;

	const seed = (log: (typeof logs)[number]) =>
		$createOrUpdateFlowObservation({
			date: log.date,
			taskId: log.taskId,
			taskTitle: `skill ${log.taskId}`,
			difficulty: 5,
			enjoyment: 5,
			E: log.E,
			beta: log.beta,
			phiHours: phi(log.E, log.beta),
		});

	// Five past dates give four scored blocks: the earliest block's fit had seen
	// nothing, so both planes are the defaults and it is not a prediction.
	it('stays null below 5 scored logs, not counting the n = 0 block', async () => {
		for (const log of logs) await seed(log);

		expect((await readModelReport(today, 30)).calibration.flow.skill).toBeNull();
	});

	it('scores today’s logs and reports the §5 walk’s mean-absolute gap', async () => {
		await seed(todaysLog);

		const all = [...logs, todaysLog];
		const scoringDates = ['2015-05-05', '2015-05-10', '2015-05-15', '2015-05-20', today];
		let defaultError = 0;
		let fittedError = 0;
		let scored = 0;

		for (const day of scoringDates) {
			const fit = fitUserConstants(
				all
					.filter((log) => log.date < day)
					.map((log) => ({
						E: log.E,
						beta: log.beta,
						phi: phi(log.E, log.beta),
						ageDays: daysBetween(log.date, day),
					})),
			);

			for (const log of all.filter((entry) => entry.date === day)) {
				const observed = phi(log.E, log.beta);

				defaultError += Math.abs(
					observed - calculateFlowStateTime(log.E, log.beta, DEFAULT_USER_CONSTANTS),
				);

				fittedError += Math.abs(observed - calculateFlowStateTime(log.E, log.beta, fit.constants));

				scored += 1;
			}
		}

		const skill = (await readModelReport(today, 30)).calibration.flow.skill;

		// Today's log is the fifth scored one: the fit on `date < today` predicted
		// it, even though no fit has read it (`pendingCount` is about fitting).
		expect(skill).not.toBeNull();
		expect(skill!.scoredCount).toBe(5);
		expect(scored).toBe(5);
		expect(skill!.gapHours).toBeCloseTo((defaultError - fittedError) / scored, 10);
		// Positive when the fit was closer — the offset above makes it so.
		expect(skill!.gapHours).toBeGreaterThan(0);
	});
});
