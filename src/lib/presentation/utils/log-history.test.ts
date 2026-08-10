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

	// The list is the only place a ☕ can be corrected or dropped at all, and the only
	// place any measurement older than the widest range (a year) can be reached — so it
	// has to be able to stop bounding itself. No `rangeStart` is that: every measurement
	// ever logged, which is what the card's "all time" reads.
	//
	// A CONTRACT pin, not a repaired defect: `date < undefined` is already false, so the
	// bounded loops happened to pass everything through before the guard was explicit.
	// What changed is that the type permits the call — this is what stops a later
	// "simplification" back to `input.rangeStart!` or a `?? ''` sentinel.
	it('reads every day when the range is left off', () => {
		const rows = logHistory({
			flow: [flow(1, '2019-01-01')],
			drain: [drain(1, '2026-08-03')],
			rest: [rest(1, '2020-06-15')],
		});

		expect(rows.map((r) => r.key)).toEqual(['drain-1', 'rest-1', 'flow-1']);
	});

	// The record's own `taskTitle` is the name the task had when it was logged, so a
	// rename left every earlier measurement of it printing the old one — two names for
	// one task with nothing on the page to connect them.
	it('names a measurement by what its task is called now', () => {
		const rows = logHistory(
			input({
				flow: [
					flow(1, '2026-08-02', {
						taskId: 4,
						taskTitle: 'writing',
					}),
				],
				drain: [
					drain(1, '2026-08-02', {
						taskId: 4,
						taskTitle: 'writing',
					}),
				],
				taskTitles: new Map([[4, 'the chapter']]),
			}),
		);

		expect(rows.map((r) => r.taskTitle)).toEqual(['the chapter', 'the chapter']);
	});

	// Deleted, or older than the loaded year: the frozen title is the only name the
	// measurement has left, which is why the record still carries one.
	it('falls back to the logged name for a task it can no longer find', () => {
		const rows = logHistory(
			input({
				flow: [
					flow(1, '2026-08-02', {
						taskId: 4,
						taskTitle: 'writing',
					}),
				],
				rest: [rest(1, '2026-08-02')],
				taskTitles: new Map([[99, 'some other task']]),
			}),
		);

		// And a ☕ has no task to name either way.
		expect(rows.map((r) => r.taskTitle)).toEqual(['writing', null]);
	});

	// `sanitizeTask` keeps a task whose stored title is not a string as `''` (R4), and a
	// blank live name is worse than a stale one — it would also draw the row as a ☕,
	// which is what an unnamed row means here, and drop its link to the day.
	it('keeps the logged name when the live one is blank', () => {
		const rows = logHistory(
			input({
				flow: [
					flow(1, '2026-08-02', {
						taskId: 4,
						taskTitle: 'writing',
					}),
				],
				taskTitles: new Map([[4, '']]),
			}),
		);

		expect(rows[0].taskTitle).toBe('writing');
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
