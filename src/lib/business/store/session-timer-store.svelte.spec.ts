import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Harness from '$lib/business/store/session-timer-store.test-harness.svelte';
import { toISODate } from '$lib/business/utils/date';
import type { SessionTimer } from '$lib/business/utils/session-timer';
import type { SessionTimerStore } from '$lib/business/store/session-timer-store.svelte';

const running = (startedOn: string): SessionTimer => ({
	phase: 'running',
	startedOn,
	runningSince: 1_800_000_000_000,
	accumulatedMs: 0,
});

function mount(stored: SessionTimer | null) {
	const persist = vi.fn();
	let store!: SessionTimerStore;

	render(Harness, {
		stored,
		persist,
		onstore: (created: SessionTimerStore) => (store = created),
	});

	return {
		store,
		persist,
	};
}

/* The layout reads storage and hands the value in; what this class owns is the day
   gate and the write-through, which is all two screens share. */
describe('SessionTimerStore', () => {
	it('hands back the timer it was seeded with', () => {
		const stored = running(toISODate());

		expect(mount(stored).store.timer).toEqual(stored);
	});

	// The getter, not an effect: a page left open crosses midnight, and minutes
	// counted yesterday cannot fill today's 🪫 log.
	it('reads a timer that did not start today as no timer', () => {
		expect(mount(running('2026-08-21')).store.timer).toBeNull();
	});

	it('persists every write', () => {
		const { store, persist } = mount(null);
		const timer = running(toISODate());

		store.timer = timer;

		expect(persist).toHaveBeenCalledWith(timer);
	});
});
