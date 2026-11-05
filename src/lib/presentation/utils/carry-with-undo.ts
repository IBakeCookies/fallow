import type { SessionStore } from '$lib/business/store/session-store.svelte';
import { showUndoToast } from '$lib/presentation/utils/toast';
import * as m from '$lib/paraglide/messages.js';

/**
 * The two tomorrow moves, each offered back while its toast lives —
 * `removeTaskWithUndo` for the carry control and for the advice card's lever.
 * The count is read before the carry empties it.
 */
export async function carryUnfinishedWithUndo(session: SessionStore) {
	const count = session.carryableCount;
	const undo = await session.carryUnfinishedToTomorrow();

	if (!undo) return;

	showUndoToast(
		m.carry_toast({
			count,
		}),
		m.common_undo(),
		undo,
	);
}

export async function moveTaskToTomorrowWithUndo(session: SessionStore, id: number) {
	const task = session.tasks.find((t) => t.id === id);

	if (!task) return;

	const undo = await session.moveTaskToTomorrow(id);

	if (!undo) return;

	showUndoToast(
		m.move_toast({
			title: task.title,
		}),
		m.common_undo(),
		undo,
	);
}
