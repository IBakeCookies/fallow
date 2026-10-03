import { describe, expect, it, vi } from 'vitest';
import type { SessionStore } from '$lib/business/store/session-store.svelte';
import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
import type { SessionTimerStore } from '$lib/business/store/session-timer-store.svelte';
import type { DrainObservationRecord, Persisted } from '$lib/business/type';
import type { SessionTimer } from '$lib/business/utils/session-timer';
import { MeasurementEditors } from '$lib/presentation/utils/measurement-editor.svelte';

/* The ⚡/🪫 editor lifecycle both task screens run (presentation/AGENTS.md, "Each
   measurement is read, corrected and dropped on the row it belongs to"): its transitions,
   and which store write each one picks. The prompt policy's and the claim rule's cases
   are `measurement-prompt.test.ts`'s; this pins which drafts and reading it hands them. */

const stoppedTimer = (): SessionTimer => ({
	phase: 'stopped',
	startedOn: '2026-10-03',
	runningSince: null,
	accumulatedMs: 45 * 60_000,
	targetMs: null,
});

const storedRating: Persisted<DrainObservationRecord> = {
	id: 11,
	date: '2026-10-03',
	taskId: 3,
	taskTitle: 'Deep work',
	hours: 1.5,
	cognitiveDemand: 0.8,
	physicalDemand: 0.2,
	mindDrain: 6,
	bodyDrain: 2,
	createdAt: 1_790_000_000_000,
};

/* Only what the editors touch, held in `$state` so the spec stands whether the module
   reads the stopped reading when an editor opens or derives it. Both undo helpers run for
   real: the fakes resolve `undefined`, which is nothing to offer back, so no toast. */
function setup({ isViewingPast = false } = {}) {
	const session = $state({
		isViewingPast,
		logFlow: vi.fn(),
		clearFlowLog: vi.fn(async () => undefined),
	});

	const observations = $state({
		logDrain: vi.fn(),
		editDrainLog: vi.fn(),
		deleteDrainLog: vi.fn(async () => undefined),
	});

	const timerStore = $state({
		timer: stoppedTimer() as SessionTimer | null,
	});

	return {
		editors: new MeasurementEditors(
			session as unknown as SessionStore,
			observations as unknown as EnergyObservationStore,
			timerStore as unknown as SessionTimerStore,
		),
		session,
		observations,
		timerStore,
	};
}

/* The handlers are destructured before they are called: a page hands them to its rows
   as props, unbound. */
describe('MeasurementEditors', () => {
	it('logs a ⚡ under its task and closes that editor', () => {
		const { editors, session } = setup();
		const { openFlowLog, saveFlowLog } = editors;

		openFlowLog(7, 'button');

		expect(editors.flowDrafts[7]).toBeDefined();

		saveFlowLog(7, 25);

		expect(session.logFlow).toHaveBeenCalledExactlyOnceWith(7, 25);
		expect(editors.flowDrafts[7]).toBeUndefined();
	});

	it('drops a ⚡ through the store and closes that editor', () => {
		const { editors, session } = setup();
		const { openFlowLog, clearFlowLog } = editors;

		openFlowLog(7, 'button');

		expect(editors.flowDrafts[7]).toBeDefined();

		clearFlowLog(7);

		expect(session.clearFlowLog).toHaveBeenCalledExactlyOnceWith(7);
		expect(editors.flowDrafts[7]).toBeUndefined();
	});

	// One stop funds one log: the editor opened first takes the reading, one opened
	// meanwhile starts empty, and only the first one's save spends it.
	it('lets the first 🪫 append take the stopped reading and only its save spend it', () => {
		const { editors, observations, timerStore } = setup();
		const { openDrainLog, saveDrainLog } = editors;

		openDrainLog(1, 'button');
		openDrainLog(2, 'button');

		expect(editors.drainDrafts[1].minutes).toBe(45);
		expect(editors.drainDrafts[2].minutes).toBeNull();

		saveDrainLog(2, {
			hours: 0.5,
			mind: 4,
			body: 2,
		});

		expect(observations.logDrain).toHaveBeenCalledExactlyOnceWith(2, 0.5, 4, 2);
		expect(timerStore.timer).toEqual(stoppedTimer());

		saveDrainLog(1, {
			hours: 0.75,
			mind: 5,
			body: 3,
		});

		expect(observations.logDrain).toHaveBeenCalledTimes(2);
		expect(observations.logDrain).toHaveBeenLastCalledWith(1, 0.75, 5, 3);
		expect(timerStore.timer).toBeNull();
		expect(editors.drainDrafts[1]).toBeUndefined();
		expect(editors.drainDrafts[2]).toBeUndefined();
	});

	// Re-logging a correction would count the session's hours twice, and a correction
	// spends nothing: the reading belongs to the log that was timed.
	it('rewrites the record a correction opened on and never logs a new one', () => {
		const { editors, observations, timerStore } = setup();
		const { editDrainLog, saveDrainLog } = editors;

		editDrainLog(3, storedRating);

		expect(editors.drainDrafts[3].recordId).toBe(11);

		saveDrainLog(3, {
			hours: 2,
			mind: 7,
			body: 2,
		});

		expect(observations.editDrainLog).toHaveBeenCalledExactlyOnceWith(11, 2, 7, 2);
		expect(observations.logDrain).not.toHaveBeenCalled();
		expect(timerStore.timer).toEqual(stoppedTimer());
		expect(editors.drainDrafts[3]).toBeUndefined();
	});

	it('drops the record a correction opened on and closes that editor', () => {
		const { editors, observations } = setup();
		const { editDrainLog, deleteDrainLog } = editors;

		editDrainLog(3, storedRating);

		expect(editors.drainDrafts[3]).toBeDefined();

		deleteDrainLog(3, 11);

		expect(observations.deleteDrainLog).toHaveBeenCalledExactlyOnceWith(11);
		expect(editors.drainDrafts[3]).toBeUndefined();
	});

	// The timer's minutes were counted today, so only today's 🪫 may take or spend them.
	it('opens a past day’s append empty and spends nothing on saving it', () => {
		const { editors, observations, timerStore } = setup({
			isViewingPast: true,
		});

		const { openDrainLog, saveDrainLog } = editors;

		openDrainLog(1, 'button');

		expect(editors.drainDrafts[1].minutes).toBeNull();

		saveDrainLog(1, {
			hours: 0.5,
			mind: 4,
			body: 2,
		});

		expect(observations.logDrain).toHaveBeenCalledExactlyOnceWith(1, 0.5, 4, 2);
		expect(timerStore.timer).toEqual(stoppedTimer());
	});

	// The ✕ and the advisor's move both call it: a draft left behind would keep the
	// reading claimed for a row that is gone, and no other editor could ever take it.
	it('drops both editors of a task and releases the reading its 🪫 editor held', () => {
		const { editors } = setup();
		const { openFlowLog, openDrainLog, dropDrafts } = editors;

		openFlowLog(1, 'button');
		openDrainLog(1, 'button');

		expect(editors.drainDrafts[1].minutes).toBe(45);

		dropDrafts(1);

		expect(editors.flowDrafts[1]).toBeUndefined();
		expect(editors.drainDrafts[1]).toBeUndefined();

		openDrainLog(2, 'button');

		expect(editors.drainDrafts[2].minutes).toBe(45);
	});
});
