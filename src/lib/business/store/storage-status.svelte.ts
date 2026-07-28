/**
 * The app-wide persistence banner's state: which stores currently have a failed
 * read or a failed write, and how to try the reads again.
 *
 * There is ONE banner for the whole app, and it used to be a single field on
 * `SessionStore` because that store was the first thing that could fail. Every
 * store added since had to reach it through that one: `EnergyObservationStore`
 * imported a type from it, `EnergyLabStore` held a session store partly to report
 * through it, and the retry action was a hand-maintained list in the layout that
 * a new store's `retryLoad()` had to be remembered into.
 *
 * The failure is tracked **per reporting store**, not as one flag, because the
 * stores fail independently. One flag meant one store's success cleared another's
 * unrecovered failure — sharpest on the retry path, where the observation store's
 * two reads normally settle before the session's migration-plus-three, so a
 * re-failure there was wiped by the session's later success: the user pressed
 * Retry, the banner vanished, and the drain/rest logs were still unreadable with
 * Burnout Risk quietly running on defaults.
 *
 * A store gets a `StorageReporter` and nothing more — it can speak for itself, and
 * cannot dismiss the banner, trigger the retry, or clear another store's failure.
 */

import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

const CONTEXT_KEY = Symbol();

/**
 * A storage failure the banner can show. 'load-failed' is the recoverable one;
 * 'save-failed' has already lost the edit.
 */
export type StorageErrorKind = 'save-failed' | 'load-failed';

/** One store's channel into the banner. Speaks only for that store. */
export interface StorageReporter {
	report(kind: StorageErrorKind): void;
	/**
	 * This store's read worked again, so its data is reachable: drops ITS
	 * 'load-failed'. Never a 'save-failed' — that edit is gone whatever happens
	 * next — and never another store's anything. This is what lets a transient
	 * read failure heal on the next successful read instead of leaving a banner up
	 * over an app that has already recovered.
	 */
	clearLoadFailure(): void;
}

export class StorageStatusStore {
	// Keyed by reporter name so each store's failure is its own. SvelteMap rather
	// than a plain Map: the getters below are read from the layout's markup.
	#failures = new SvelteMap<string, StorageErrorKind>();

	// Not reactive: nothing renders the registrations, they are only iterated.
	#retries: (() => void)[] = [];

	/**
	 * A store's channel into the banner. `retryLoad` is for a store that can fail
	 * a **read**; registering it is what puts the store behind the banner's retry,
	 * instead of the layout naming each store it has to call.
	 *
	 * Pass one only from a store that lives as long as this one — the layout-scoped
	 * ones. There is no unregistration, so a per-route store would leave a callback
	 * pointing at a store the user has navigated away from. Reporting is safe from
	 * anywhere: `EnergyLabStore` registers without a `retryLoad` (a failed params
	 * read is a toast, not this banner) and only ever reports a lost write, which
	 * nothing but a dismissal clears anyway.
	 */
	register(name: string, retryLoad?: () => void): StorageReporter {
		if (retryLoad) this.#retries.push(retryLoad);

		return {
			report: (kind) => this.#failures.set(name, kind),
			clearLoadFailure: () => {
				if (this.#failures.get(name) === 'load-failed') this.#failures.delete(name);
			},
		};
	}

	/**
	 * Which message the banner shows, or null for no banner. A lost write outranks
	 * a failed read: a read failure is already visible as a wrong or empty screen,
	 * whereas an unsurfaced lost edit reads as success. The read is not stranded by
	 * that — `canRetry` is what offers the action, and it is independent.
	 */
	get error(): StorageErrorKind | null {
		const kinds = [...this.#failures.values()];

		if (kinds.includes('save-failed')) return 'save-failed';

		return kinds.length > 0 ? 'load-failed' : null;
	}

	/**
	 * Whether to offer Retry: any outstanding failed read, whichever message is
	 * showing. Keying the button off `error` instead would hide the only recovery
	 * affordance whenever a write had also failed.
	 */
	get canRetry(): boolean {
		return [...this.#failures.values()].includes('load-failed');
	}

	/** Dismiss — the banner's close button. The user has seen all of it. */
	clear() {
		this.#failures.clear();
	}

	/**
	 * The banner's retry action: any registered store could have been the one that
	 * failed and none knows about the others, so all of them re-read. Their load
	 * failures are dropped first, so a re-failure raises the banner again instead
	 * of leaving the previous attempt's up — but a `'save-failed'` survives,
	 * because re-reading does not un-lose a write.
	 */
	retry() {
		for (const [name, kind] of [...this.#failures]) {
			if (kind === 'load-failed') this.#failures.delete(name);
		}

		for (const retryOne of this.#retries) retryOne();
	}
}

export function setStorageStatusStore(): StorageStatusStore {
	return setContext<StorageStatusStore>(CONTEXT_KEY, new StorageStatusStore());
}

export function getStorageStatusStore(): StorageStatusStore {
	return getContext<StorageStatusStore>(CONTEXT_KEY);
}
