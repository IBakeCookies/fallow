import { describe, expect, it } from 'vitest';
import type {
	DrainObservationRecord,
	FlowObservationRecord,
	Persisted,
	RestObservationRecord,
} from '$lib/business/type';
import { logHistory, type LogHistoryInput } from '$lib/presentation/utils/log-history';

const flow = (
	id: number,
	date: string,
	over: Partial<FlowObservationRecord> = {},
): Persisted<FlowObservationRecord> => ({
	id,
	date,
	taskId: 1,
	taskTitle: 'writing',
	difficulty: 6,
	enjoyment: 5,
	E: 3,
	beta: 1.5,
	phiHours: 0.5,
	createdAt: 1,
	...over,
});

const drain = (
	id: number,
	date: string,
	over: Partial<DrainObservationRecord> = {},
): Persisted<DrainObservationRecord> => ({
	id,
	date,
	taskId: 1,
	taskTitle: 'writing',
	hours: 1.5,
	cognitiveDemand: 0.6,
	physicalDemand: 0.2,
	mindDrain: 6,
	bodyDrain: 2,
	createdAt: 1,
	...over,
});

const rest = (
	id: number,
	date: string,
	over: Partial<RestObservationRecord> = {},
): Persisted<RestObservationRecord> => ({
	id,
	date,
	hours: 0.5,
	mindBefore: 7,
	mindAfter: 3,
	bodyBefore: 4,
	bodyAfter: 2,
	createdAt: 1,
	...over,
});

const input = (over: Partial<LogHistoryInput> = {}): LogHistoryInput => ({
	flow: [],
	drain: [],
	rest: [],
	rangeStart: '2026-08-01',
	...over,
});

describe('logHistory', () => {
	it('reads each kind of measurement into one row', () => {
		const rows = logHistory(
			input({
				flow: [flow(1, '2026-08-02')],
				drain: [drain(1, '2026-08-03')],
				rest: [rest(1, '2026-08-04')],
			}),
		);

		expect(rows).toEqual([
			{
				// A break is not worked on anything, so there is no task to name.
				key: 'rest-1',
				id: 1,
				kind: 'rest',
				date: '2026-08-04',
				taskTitle: null,
				hours: 0.5,
				mind: 7,
				mindAfter: 3,
				body: 4,
				bodyAfter: 2,
			},
			{
				key: 'drain-1',
				id: 1,
				kind: 'drain',
				date: '2026-08-03',
				taskTitle: 'writing',
				hours: 1.5,
				mind: 6,
				mindAfter: null,
				body: 2,
				bodyAfter: null,
			},
			{
				key: 'flow-1',
				id: 1,
				kind: 'flow',
				date: '2026-08-02',
				taskTitle: 'writing',
				hours: 0.5,
				mind: null,
				mindAfter: null,
				body: null,
				bodyAfter: null,
			},
		]);
	});

	// The three stores autoincrement independently, so ids collide across kinds —
	// and a colliding `{#each}` key drops rows.
	it('keys rows uniquely across kinds sharing an id', () => {
		const rows = logHistory(
			input({
				flow: [flow(7, '2026-08-02')],
				drain: [drain(7, '2026-08-02')],
				rest: [rest(7, '2026-08-02')],
			}),
		);

		expect(new Set(rows.map((r) => r.key)).size).toBe(3);
		// And each keeps its OWN record id, which is what a delete is addressed to —
		// the key disambiguates the render, the id names the record in its store.
		expect(rows.map((r) => r.id)).toEqual([7, 7, 7]);
	});

	it('reads no day before the range', () => {
		const rows = logHistory(
			input({
				rangeStart: '2026-08-03',
				flow: [flow(1, '2026-08-02')],
				drain: [drain(1, '2026-08-03')],
				rest: [rest(1, '2026-07-31')],
			}),
		);

		expect(rows.map((r) => r.key)).toEqual(['drain-1']);
	});

	it('orders a day by when each measurement was logged, newest first', () => {
		const rows = logHistory(
			input({
				flow: [
					flow(1, '2026-08-02', {
						createdAt: 300,
					}),
				],
				drain: [
					drain(1, '2026-08-02', {
						createdAt: 200,
					}),
					drain(2, '2026-08-01', {
						createdAt: 900,
					}),
				],
				rest: [
					rest(1, '2026-08-02', {
						createdAt: 100,
					}),
				],
			}),
		);

		expect(rows.map((r) => r.key)).toEqual(['flow-1', 'drain-1', 'rest-1', 'drain-2']);
	});
});
