/**
 * Test-only stand-ins for the two stores the Energy Lab reads, so a spec can
 * drive the logs and the day window directly. Reactive, so assigning a field
 * re-runs the Lab's deriveds. Lives in a `.svelte.ts` file because the spec
 * itself is not compiled with runes.
 */

import { SvelteMap } from 'svelte/reactivity';
import type { Task } from '$lib/business/type';
import type { DrainObservationRecord, RestObservationRecord } from '$lib/data/type';
import type { DeferDestination } from '$lib/business/model/metric/defer-destination';
import { addDays } from '$lib/business/utils/date';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	fitUserConstants,
} from '$lib/business/model/zenith';

class MockSession {
	tasks = $state<Task[]>([]);
	availableHours = $state(8);
	// Reactive because the remaining-day reading (MATH.md §35) is gated on the
	// viewed day BEING today, which a spec has to be able to drive. `today` stays
	// fixed: moving `selectedDate` off it is exactly how the real store reports a
	// past or future day.
	selectedDate = $state('2026-07-20');
	// The destination preview and the key it is held fresh by: the real store reads
	// tomorrow on demand and bumps the generation on every landed session write.
	deferDestination = $state<DeferDestination | null>(null);
	writeGenerations = new SvelteMap<string, number>();
	deferDestinationDate = $derived(addDays(this.selectedDate, 1));

	readonly today = '2026-07-20';
	readonly switchCost = DEFAULT_SWITCH_COST;
	readonly pools = DEFAULT_CAPACITY_POOLS;
	readonly constantsFit = fitUserConstants([]);
	readonly userConstants = this.constantsFit.constants;

	readDeferDestination = async () => this.deferDestination;

	writeGenerationFor = (date: string) => this.writeGenerations.get(date) ?? 0;

	reset() {
		this.tasks = [];
		this.availableHours = 8;
		this.selectedDate = '2026-07-20';
		this.deferDestination = null;
		this.writeGenerations.clear();
	}
}

class MockObservations {
	drainObservations = $state<DrainObservationRecord[]>([]);
	restObservations = $state<RestObservationRecord[]>([]);

	reset() {
		this.drainObservations = [];
		this.restObservations = [];
	}
}

export const mockSession = new MockSession();

export const mockObservations = new MockObservations();

export const drainRecord = (
	over: Partial<DrainObservationRecord> = {},
): DrainObservationRecord => ({
	date: '2026-07-19',
	taskId: 1,
	taskTitle: 'deep work',
	hours: 3,
	cognitiveDemand: 1,
	physicalDemand: 1,
	mindDrain: 9,
	bodyDrain: 9,
	createdAt: 0,
	...over,
});

export const restRecord = (over: Partial<RestObservationRecord> = {}): RestObservationRecord => ({
	date: '2026-07-19',
	hours: 0.5,
	mindBefore: 9,
	mindAfter: 2,
	bodyBefore: 8,
	bodyAfter: 1,
	createdAt: 0,
	...over,
});
