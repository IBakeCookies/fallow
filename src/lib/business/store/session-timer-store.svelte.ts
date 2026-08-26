/**
 * The day's session clock, shared by the two screens that offer its controls —
 * `/` and the Energy Lab — so a session started on one is still counting on the
 * other and one stop leaves one reading either can spend.
 *
 * Storage is the layout's: it hands in the value it read and the thunk that
 * persists (R4, "no store talks to a storage API directly"). Nothing is
 * reported when that write fails — a lost reading costs a typed number, which is
 * R4's `localStorage` tier.
 */

import { getContext, setContext } from 'svelte';
import { liveToday } from '$lib/business/state/today.svelte';
import type { SessionTimer } from '$lib/business/utils/session-timer';

const CONTEXT_KEY = Symbol();

export class SessionTimerStore {
	#timer = $state<SessionTimer | null>(null);
	#persist: (timer: SessionTimer | null) => void;

	constructor(stored: SessionTimer | null, persist: (timer: SessionTimer | null) => void) {
		this.#timer = stored;
		this.#persist = persist;
	}

	/** Gated on the day rather than by an effect: a page left open crosses midnight,
	 *  and minutes counted yesterday cannot fill today's 🪫 log. The stale entry stays
	 *  in storage — `sanitizeSessionTimer` drops it on any later day, and clearing it
	 *  here would make a read a write. */
	get timer(): SessionTimer | null {
		const timer = this.#timer;

		return timer !== null && timer.startedOn === liveToday.value ? timer : null;
	}

	set timer(timer: SessionTimer | null) {
		this.#timer = timer;
		this.#persist(timer);
	}
}

export function setSessionTimerStore(
	stored: SessionTimer | null,
	persist: (timer: SessionTimer | null) => void,
): SessionTimerStore {
	return setContext<SessionTimerStore>(CONTEXT_KEY, new SessionTimerStore(stored, persist));
}

export function getSessionTimerStore(): SessionTimerStore {
	return getContext<SessionTimerStore>(CONTEXT_KEY);
}
