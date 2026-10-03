// Why: presentation/AGENTS.md, "Both editors are open only while the PAGE holds a draft for that task"

import type { SessionStore } from '$lib/business/store/session-store.svelte';
import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
import type { SessionTimerStore } from '$lib/business/store/session-timer-store.svelte';
import type { DrainObservationRecord, Persisted } from '$lib/business/type';
import { getPendingMinutes } from '$lib/business/utils/session-timer';
import {
	claimPendingMinutes,
	drainDraftFromLog,
	newDrainDraft,
	newEditorDraft,
	spendsPendingMinutes,
	type DrainDraft,
	type EditorDraft,
	type EditorSource,
} from '$lib/presentation/utils/measurement-prompt';
import {
	removeFlowLogWithUndo,
	removeLogWithUndo,
} from '$lib/presentation/utils/remove-log-with-undo';

export class MeasurementEditors {
	#session: SessionStore;
	#observations: EnergyObservationStore;
	#timerStore: SessionTimerStore;
	#flowDrafts = $state<Record<number, EditorDraft>>({});
	#drainDrafts = $state<Record<number, DrainDraft>>({});

	constructor(
		session: SessionStore,
		observations: EnergyObservationStore,
		timerStore: SessionTimerStore,
	) {
		this.#session = session;
		this.#observations = observations;
		this.#timerStore = timerStore;
	}

	get flowDrafts(): Record<number, EditorDraft> {
		return this.#flowDrafts;
	}

	get drainDrafts(): Record<number, DrainDraft> {
		return this.#drainDrafts;
	}

	// The timer's minutes were counted today, so only today's 🪫 may take or spend them.
	get #pendingMinutes() {
		return this.#session.isViewingPast ? null : getPendingMinutes(this.#timerStore.timer);
	}

	openFlowLog = (taskId: number, source: EditorSource) => {
		this.#flowDrafts[taskId] = newEditorDraft(source);
	};

	closeFlowLog = (taskId: number) => {
		delete this.#flowDrafts[taskId];
	};

	saveFlowLog = (taskId: number, minutes: number) => {
		this.#session.logFlow(taskId, minutes);
		this.closeFlowLog(taskId);
	};

	clearFlowLog = (taskId: number) => {
		removeFlowLogWithUndo(this.#session, taskId);
		this.closeFlowLog(taskId);
	};

	openDrainLog = (taskId: number, source: EditorSource) => {
		this.#drainDrafts[taskId] = newDrainDraft(
			source,
			claimPendingMinutes(this.#drainDrafts, this.#pendingMinutes),
		);
	};

	editDrainLog = (taskId: number, log: Persisted<DrainObservationRecord>) => {
		this.#drainDrafts[taskId] = drainDraftFromLog(log);
	};

	closeDrainLog = (taskId: number) => {
		delete this.#drainDrafts[taskId];
	};

	// Re-logging a correction would count the session's hours twice.
	saveDrainLog = (taskId: number, entry: { hours: number; mind: number; body: number }) => {
		const draft = this.#drainDrafts[taskId];

		if (draft.recordId === undefined) {
			this.#observations.logDrain(taskId, entry.hours, entry.mind, entry.body);

			if (spendsPendingMinutes(draft, this.#pendingMinutes)) this.#timerStore.timer = null;
		} else {
			this.#observations.editDrainLog(draft.recordId, entry.hours, entry.mind, entry.body);
		}

		this.closeDrainLog(taskId);
	};

	deleteDrainLog = (taskId: number, recordId: number) => {
		removeLogWithUndo(this.#session, this.#observations, 'drain', recordId);
		this.closeDrainLog(taskId);
	};

	dropDrafts = (taskId: number) => {
		this.closeFlowLog(taskId);
		this.closeDrainLog(taskId);
	};
}
