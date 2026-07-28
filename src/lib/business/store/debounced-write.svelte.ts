/**
 * Trailing-debounced persistence, shared by every store that autosaves.
 *
 * Two stores had their own copy of this — the session's tasks/budget and the
 * Energy Lab's parameters — and the copies had already drifted apart on the
 * delay constant. The mechanism is small but every part of it is load-bearing,
 * which is the argument for having it once:
 *
 * - The flush is armed from `onDestroy`, NEVER from an `$effect` teardown. An
 *   effect's cleanup also runs before every re-run, so flushing there fires on
 *   each keystroke and defeats the debounce, while cancelling there (the
 *   original bug) silently drops the last edit when the user navigates away.
 * - It also flushes the moment the tab is hidden: the debounce may never fire
 *   at all if the tab is then discarded.
 * - The payload is a snapshot the CALLER takes, inside its own tracked effect —
 *   passing reactive state in would persist whatever it had become by the time
 *   the timer fired, not what was scheduled.
 */

import { onDestroy } from 'svelte';
import { browser } from '$app/environment';

/** Long enough that typing a number is one write, short enough to feel saved. */
export const AUTOSAVE_DEBOUNCE_MS = 500;

export interface DebouncedWrite<T> {
	/** Replace the pending payload and (re)start the timer. */
	schedule(payload: T): void;
	/** Persist the pending payload now, cancelling the timer. No-op when idle. */
	flush(): void;
	/** Whether a scheduled write is still waiting — nothing else may assume it landed. */
	readonly pending: boolean;
}

/**
 * @param write persists one payload; rejections are reported, never thrown.
 * @param onError has to raise the user-facing surface — a failed write has
 * already lost the edit, so swallowing it silently would be a lie.
 */
export function createDebouncedWrite<T>(
	write: (payload: T) => Promise<void>,
	onError: (error: unknown, payload: T) => void,
	delayMs: number = AUTOSAVE_DEBOUNCE_MS,
): DebouncedWrite<T> {
	let pendingPayload: T | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function flush() {
		if (pendingPayload === null) return;

		clearTimeout(timer);
		const payload = pendingPayload;
		// Cleared BEFORE the await: a second flush while this one is in flight must
		// not write the same payload twice.
		pendingPayload = null;

		write(payload).catch((error: unknown) => onError(error, payload));
	}

	onDestroy(flush);

	$effect(() => {
		if (!browser) return;

		const onVisibilityChange = () => {
			if (document.hidden) flush();
		};

		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => document.removeEventListener('visibilitychange', onVisibilityChange);
	});

	return {
		schedule(payload: T) {
			pendingPayload = payload;
			clearTimeout(timer);
			timer = setTimeout(flush, delayMs);
		},
		flush,
		get pending() {
			return pendingPayload !== null;
		},
	};
}
