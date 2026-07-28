/**
 * Test-only stand-ins for the two stores the Energy Lab reads, so a spec can
 * drive the logs and the day window directly. Reactive, so assigning a field
 * re-runs the Lab's deriveds. Lives in a `.svelte.ts` file because the spec
 * itself is not compiled with runes.
 */

import type { Task } from '$lib/business/type';
import type { DrainObservationRecord, RestObservationRecord } from '$lib/data/type';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	fitUserConstants,
} from '$lib/business/model/zenith';

class MockSession {
	tasks = $state<Task[]>([]);
	availableHours = $state(8);

	readonly today = '2026-07-20';
	readonly switchCost = DEFAULT_SWITCH_COST;
	readonly pools = DEFAULT_CAPACITY_POOLS;
	readonly constantsFit = fitUserConstants([]);
	readonly userConstants = this.constantsFit.constants;

	reset() {
		this.tasks = [];
		this.availableHours = 8;
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
