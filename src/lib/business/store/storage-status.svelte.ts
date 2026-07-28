/**
 * The app-wide persistence banner's state: whether a read or a write to
 * IndexedDB failed, and how to try the reads again.
 *
 * There is ONE banner for the whole app, and it used to live in `SessionStore`
 * because that store was the first thing that could fail. Every store added
 * since had to reach the banner through it: `EnergyObservationStore` imported a
 * type from it, `EnergyLabStore` holds a session store partly to report through
 * it, and the retry action was a hand-maintained list in the layout that a new
 * store's `retryLoad()` had to be remembered into. This owns the banner instead,
 * so those stores are peers of the session rather than dependents of it.
 *
 * `registerRetry` is what closes the hand-maintained list: a store that can fail
 * a READ registers itself, and the banner's retry re-runs every registration.
 */

import { getContext, setContext } from 'svelte';

const CONTEXT_KEY = Symbol();

/**
 * A storage failure the banner can show. 'load-failed' is the recoverable one;
 * 'save-failed' has already lost the edit.
 */
export type StorageErrorKind = 'save-failed' | 'load-failed';

export class StorageStatusStore {
	#error = $state<StorageErrorKind | null>(null);

	// Not reactive: nothing renders the registrations, they are only iterated.
	#retries: (() => void)[] = [];

	get error(): StorageErrorKind | null {
		return this.#error;
	}

	/** Raise the banner; the most recent failure is the one shown. */
	report(kind: StorageErrorKind) {
		this.#error = kind;
	}

	/** Dismiss — the banner's close button. */
	clear() {
		this.#error = null;
	}

	/**
	 * A read succeeded, so the data is reachable again: drop a 'load-failed' but
	 * never a 'save-failed', whose edit is gone whatever happens next. This is
	 * what makes a failed load recover on the next date change as well as on the
	 * banner's retry.
	 *
	 * Known limitation, unchanged from when the session store owned this flag: the
	 * banner is app-wide but this clear is not scoped to the store that raised it,
	 * so one store reading successfully hides another's still-unrecovered read
	 * failure. Fixing it means tracking the failure per store, which is its own
	 * change — not a side effect of moving the flag.
	 */
	clearLoadFailure() {
		if (this.#error === 'load-failed') this.#error = null;
	}

	/**
	 * Register a store's re-read. Registering is how a store gets covered by the
	 * banner's retry, instead of the layout naming each store it has to call.
	 *
	 * Only a store that lives as long as this one may register — in practice the
	 * layout-scoped ones, which is why there is no unregistration to call: a
	 * per-route store would leave a registration pointing at a store the user has
	 * navigated away from, and the one page-scoped store deliberately registers
	 * nothing (a failed params read is a toast, not this banner).
	 */
	registerRetry(retry: () => void) {
		this.#retries.push(retry);
	}

	/**
	 * The banner's retry action: any registered store could have been the one
	 * that failed, and none of them knows about the others, so all of them
	 * re-read. Clearing first means a re-failure raises the banner again rather
	 * than leaving it up from the previous attempt.
	 */
	retry() {
		this.#error = null;

		for (const retryOne of this.#retries) retryOne();
	}
}

export function setStorageStatusStore(): StorageStatusStore {
	return setContext<StorageStatusStore>(CONTEXT_KEY, new StorageStatusStore());
}

export function getStorageStatusStore(): StorageStatusStore {
	return getContext<StorageStatusStore>(CONTEXT_KEY);
}
