import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionStore } from '$lib/business/store/session-store.svelte';
import { removeTaskWithUndo } from '$lib/presentation/utils/remove-task-with-undo';
import { showUndoToast } from '$lib/presentation/utils/toast';

vi.mock('$lib/presentation/utils/toast', () => ({
	showUndoToast: vi.fn(),
}));

/** Only what removeTaskWithUndo touches; the real store is exercised in its own tests. */
function sessionRemoving(result: ReturnType<SessionStore['removeTask']>) {
	return {
		removeTask: vi.fn(() => result),
	} as unknown as SessionStore;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('removeTaskWithUndo', () => {
	it('deletes through the store and hands its undo to the toast', () => {
		const undo = vi.fn();
		const session = sessionRemoving({
			task: {
				title: 'Boxing training',
			} as never,
			undo,
		});

		removeTaskWithUndo(session, 7);

		expect(session.removeTask).toHaveBeenCalledExactlyOnceWith(7);
		// The exact resolved copy: the toast text is what tells the user there is
		// anything to undo, so a broken interpolation is a silent delete.
		expect(showUndoToast).toHaveBeenCalledExactlyOnceWith(
			'Deleted “Boxing training”.',
			'Undo',
			undo,
		);
	});

	// An id the store no longer knows (a double-click on ✕) must not raise a toast
	// offering to restore nothing.
	it('stays quiet when the store removed nothing', () => {
		const session = sessionRemoving(undefined);

		removeTaskWithUndo(session, 7);

		expect(showUndoToast).not.toHaveBeenCalled();
	});
});
