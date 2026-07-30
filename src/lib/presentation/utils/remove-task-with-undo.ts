import type { SessionStore } from '$lib/business/store/session-store.svelte';
import { showUndoToast } from '$lib/presentation/utils/toast';
import * as m from '$lib/paraglide/messages.js';

/**
 * Delete a task now and offer it back while the toast lives. Shared by the two
 * pages whose rows carry a ✕ (`/` and `/energy`), so the copy and the window cannot
 * drift apart. A confirmation step would sit on the common path instead — deleting a
 * task is frequent, and the row is gone either way if the user meant it.
 */
export function removeTaskWithUndo(session: SessionStore, id: number) {
	const removed = session.removeTask(id);

	if (!removed) return;

	showUndoToast(
		m.task_remove_toast({
			title: removed.task.title,
		}),
		m.common_undo(),
		removed.undo,
	);
}
