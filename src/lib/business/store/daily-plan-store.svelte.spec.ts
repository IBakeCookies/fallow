import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import Harness from '$lib/business/store/daily-plan-store.test-harness.svelte';
import {
	drainRecord,
	mockObservations,
	mockSession,
	restRecord,
} from '$lib/business/store/energy-lab-store.test-utils.svelte';
import type { DailyPlanStore } from '$lib/business/store/daily-plan-store.svelte';
import type { Task } from '$lib/business/type';

const task = (id: number, title: string, over: Partial<Task> = {}): Task => ({
	id,
	title,
	physicalDifficulty: 3,
	mentalDifficulty: 8,
	enjoyment: 5,
	createdAt: '2026-07-20',
	completed: false,
	...over,
});

function setup(): DailyPlanStore {
	let store!: DailyPlanStore;

	render(Harness, {
		onstore: (s: DailyPlanStore) => (store = s),
	});

	return store;
}

describe('DailyPlanStore', () => {
	beforeEach(() => {
		mockSession.reset();
		mockObservations.reset();
	});

	it('plans the session tasks and reacts to the session changing', () => {
		const store = setup();
		expect(store.daily.totalTasks).toBe(0);

		mockSession.tasks = [
			task(1, 'deep work'),
			task(2, 'boxing', {
				physicalDifficulty: 9,
				mentalDifficulty: 2,
			}),
		];

		flushSync();

		expect(store.daily.totalTasks).toBe(2);
		expect(store.daily.suggestedTasks.map((t) => t.id).sort()).toEqual([1, 2]);
		// Priority-sorted, so the run order covers every planned task
		expect(store.daily.runOrder.size).toBe(2);
	});

	// The wiring this store exists for: Burnout Risk must read the user's own
	// drain/rest fits, not the model defaults (MATH.md §8.7/§8.9). A squeezed day
	// (2 demanding tasks into 4h) is where the fitted α and r stop cancelling.
	it('refits the energy params from the calibration logs', () => {
		const store = setup();
		mockSession.tasks = [task(1, 'deep work'), task(2, 'more deep work')];
		mockSession.availableHours = 4;
		flushSync();
		const onDefaults = store.daily.burnoutRisk;
		expect(onDefaults).toBeGreaterThan(0);

		// Same records the Energy Lab's spec uses to move the α and r fits
		mockObservations.drainObservations = [
			drainRecord(),
			drainRecord({
				hours: 2,
				mindDrain: 8,
			}),
		];

		mockObservations.restObservations = [restRecord()];
		flushSync();

		expect(store.daily.burnoutRisk).not.toBe(onDefaults);
	});
});
