import type { SessionStore } from '$lib/business/store/session-store.svelte';
import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
import type { LogKind } from '$lib/presentation/utils/log-history';
import { showUndoToast } from '$lib/presentation/utils/toast';
import * as m from '$lib/paraglide/messages.js';

/**
 * Drop one measurement now and offer it back while the toast lives — the ✕ on the
 * analytics history, the counterpart of `removeTaskWithUndo` for the three logs.
 * No confirmation step, for the same reason: one point out of a fit is not the
 * wholesale reset (which keeps its two-step), and the row is gone either way if the
 * user meant it.
 *
 * The kind is half the address: the three kinds live in two stores with three
 * independent id sequences, so the number alone names a different record in each.
 * Which store owns which is this function's whole reason to exist — the page would
 * otherwise hold the routing, the copy and the toast window (R2).
 *
 * The toast names no measurement, where a deleted task's names its title: the three
 * kinds read as three different quantities, and the row that says which is on screen
 * beside the toast until the moment undo becomes pointless.
 */
export async function removeLogWithUndo(
	session: SessionStore,
	observations: EnergyObservationStore,
	kind: LogKind,
	id: number,
) {
	offerBack(
		kind === 'flow'
			? await session.deleteFlowLog(id)
			: kind === 'drain'
				? await observations.deleteDrainLog(id)
				: await observations.deleteRestLog(id),
	);
}

/**
 * The same drop, addressed the way a task ROW can address its ⚡ — by task, since a row
 * holds no record id. Two functions rather than a kind that means a different id per
 * caller: the list drops the record it printed and a row drops the reading it shows, and
 * a single `id` parameter standing for either is how the wrong record gets deleted.
 *
 * The window is the same one, which is the point. Dropping a measurement from the 🗑 in
 * the row's own editor and from the list's ✕ are the same verb on the same record, and
 * only one of them being reversible is the kind of thing the two screens were free to
 * disagree about until someone noticed (R3).
 *
 * 🪫 needs no counterpart: its editor is opened BY a stored rating, so the row has that
 * record's id and calls the function above with it.
 */
export async function removeFlowLogWithUndo(session: SessionStore, taskId: number) {
	offerBack(await session.clearFlowLog(taskId));
}

/**
 * Nothing to offer back: a second click on a ✕ whose row is already gone, or a delete
 * the storage refused (the banner says so). Neither has anything to restore, and a
 * button claiming otherwise would write the record back on top of itself.
 */
function offerBack(undo: (() => Promise<void>) | undefined) {
	if (!undo) return;

	showUndoToast(m.ana_logs_remove_toast(), m.common_undo(), undo);
}
