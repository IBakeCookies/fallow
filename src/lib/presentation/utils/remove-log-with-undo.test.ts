import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionStore } from '$lib/business/store/session-store.svelte';
import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
import {
	removeFlowLogWithUndo,
	removeLogWithUndo,
} from '$lib/presentation/utils/remove-log-with-undo';
import { showUndoToast } from '$lib/presentation/utils/toast';

vi.mock('$lib/presentation/utils/toast', () => ({
	showUndoToast: vi.fn(),
}));

/** Only the three deletes this routes to; the real stores are exercised in their own
 *  specs. Each returns the same undo, so a test can assert which one was asked. */
function storesDropping(undo: (() => Promise<void>) | undefined) {
	return {
		session: {
			deleteFlowLog: vi.fn(async () => undo),
			clearFlowLog: vi.fn(async () => undo),
		} as unknown as SessionStore,
		observations: {
			deleteDrainLog: vi.fn(async () => undo),
			deleteRestLog: vi.fn(async () => undo),
		} as unknown as EnergyObservationStore,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('removeLogWithUndo', () => {
	it('drops a ⚡ through the session store and hands its undo to the toast', async () => {
		const undo = vi.fn(async () => {});
		const { session, observations } = storesDropping(undo);

		await removeLogWithUndo(session, observations, 'flow', 7);

		expect(session.deleteFlowLog).toHaveBeenCalledExactlyOnceWith(7);

		// The exact resolved copy: the toast is what tells the user there is anything to
		// undo, so a broken key is a silently permanent delete.
		expect(showUndoToast).toHaveBeenCalledExactlyOnceWith('Measurement dropped.', 'Undo', undo);
	});

	// The kind is half the address: the three kinds are three stores with three id
	// sequences, so the same number names a different record in each.
	it('routes 🪫 and ☕ to the measurement store by kind', async () => {
		const undo = vi.fn(async () => {});
		const { session, observations } = storesDropping(undo);

		await removeLogWithUndo(session, observations, 'drain', 3);
		await removeLogWithUndo(session, observations, 'rest', 3);

		expect(observations.deleteDrainLog).toHaveBeenCalledExactlyOnceWith(3);
		expect(observations.deleteRestLog).toHaveBeenCalledExactlyOnceWith(3);
		expect(session.deleteFlowLog).not.toHaveBeenCalled();
	});

	// Nothing was dropped — a second click on a ✕ whose row is already gone, or a delete
	// the storage refused. Neither may raise a toast offering to restore nothing.
	it('stays quiet when the store dropped nothing', async () => {
		const { session, observations } = storesDropping(undefined);

		await removeLogWithUndo(session, observations, 'drain', 7);

		expect(observations.deleteDrainLog).toHaveBeenCalledOnce();
		expect(showUndoToast).not.toHaveBeenCalled();
	});
});

/* The 🗑 inside a row's ⚡ editor drops the same measurement the analytics ✕ does, so it
   offers the same window — the two disagreeing about whether a drop is reversible is the
   defect. It takes the TASK's id because a row has no record id to pass: the store's
   `clearFlowLog` is what turns (task, viewed day) into the record. */
describe('removeFlowLogWithUndo', () => {
	it('drops the row’s ⚡ by task and hands its undo to the toast', async () => {
		const undo = vi.fn(async () => {});
		const { session } = storesDropping(undo);

		await removeFlowLogWithUndo(session, 5);

		expect(session.clearFlowLog).toHaveBeenCalledExactlyOnceWith(5);
		expect(showUndoToast).toHaveBeenCalledExactlyOnceWith('Measurement dropped.', 'Undo', undo);

		// Not the by-record-id delete: that one is the list's address, and handing it a
		// task id would drop whatever record happens to carry that number.
		expect(session.deleteFlowLog).not.toHaveBeenCalled();
	});

	it('stays quiet when the row held no measurement', async () => {
		const { session } = storesDropping(undefined);

		await removeFlowLogWithUndo(session, 5);

		expect(showUndoToast).not.toHaveBeenCalled();
	});
});
