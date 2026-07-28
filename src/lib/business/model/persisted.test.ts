import { describe, it, expect } from 'vitest';
import {
	sanitizeDrainObservations,
	sanitizeFlowObservations,
	sanitizeRestObservations,
	sanitizeRoutines,
	sanitizeSession,
	sanitizeSessions,
	sanitizeTask,
} from '$lib/business/model/persisted';
import { DEFAULT_SWITCH_COST } from '$lib/business/model/zenith';
import { getEffectiveDifficulty } from '$lib/business/model/metric/calculation';

const flow = (over: Record<string, unknown> = {}) => ({
	id: 1,
	date: '2026-07-01',
	taskId: 7,
	taskTitle: 'write',
	difficulty: 5,
	enjoyment: 6,
	E: 3,
	beta: 1.5,
	phiHours: 0.4,
	createdAt: 0,
	...over,
});

const drain = (over: Record<string, unknown> = {}) => ({
	id: 1,
	date: '2026-07-01',
	taskId: 7,
	taskTitle: 'write',
	hours: 2,
	cognitiveDemand: 0.8,
	physicalDemand: 0.3,
	mindDrain: 6,
	bodyDrain: 2,
	createdAt: 0,
	...over,
});

const rest = (over: Record<string, unknown> = {}) => ({
	id: 1,
	date: '2026-07-01',
	hours: 0.5,
	mindBefore: 7,
	mindAfter: 3,
	bodyBefore: 4,
	bodyAfter: 2,
	createdAt: 0,
	...over,
});

describe('sanitizeTask', () => {
	it('keeps the task and clamps a corrupt rating to the low end of its scale', () => {
		const task = sanitizeTask(
			{
				id: 1,
				title: 'write',
				physicalDifficulty: 'abc',
				mentalDifficulty: 99,
				enjoyment: null,
			},
			'2026-07-01',
		);

		// Losing the task would lose the user's writing; a corrupt rating must not
		// be able to inflate the plan, so it reads as the least-effort value.
		expect(task).toMatchObject({
			title: 'write',
			physicalDifficulty: 0,
			mentalDifficulty: 10,
			enjoyment: 1,
		});
	});

	it('never lets a corrupt rating reach the model as NaN', () => {
		const task = sanitizeTask(
			{
				id: 1,
				mentalDifficulty: 'abc',
			},
			'2026-07-01',
		);

		// The failure this exists for: Math.max('abc', 3) is NaN, and every metric
		// downstream of the difficulty is then NaN too.
		expect(getEffectiveDifficulty(task!)).not.toBeNaN();
	});

	it('drops a task with no usable id — it could never be completed or deleted', () => {
		expect(
			sanitizeTask(
				{
					id: 'x',
					title: 'write',
				},
				'2026-07-01',
			),
		).toBeNull();

		expect(
			sanitizeTask(
				{
					title: 'write',
				},
				'2026-07-01',
			),
		).toBeNull();

		expect(sanitizeTask(null, '2026-07-01')).toBeNull();
	});

	it('falls back to the session date and drops meaningless optional fields', () => {
		const task = sanitizeTask(
			{
				id: 1,
				createdAt: 42,
				completed: 'yes',
				flowMinutes: 'soon',
				mustDoToday: 'yes',
			},
			'2026-07-01',
		);

		expect(task).toEqual({
			id: 1,
			title: '',
			physicalDifficulty: 0,
			mentalDifficulty: 0,
			enjoyment: 1,
			createdAt: '2026-07-01',
			completed: false,
		});
	});

	it('keeps a real measurement and a real must-do flag', () => {
		const task = sanitizeTask(
			{
				id: 1,
				flowMinutes: 25,
				mustDoToday: true,
				completed: true,
			},
			'2026-07-01',
		);

		expect(task).toMatchObject({
			flowMinutes: 25,
			mustDoToday: true,
			completed: true,
		});
	});
});

describe('sanitizeSession', () => {
	it('repairs corrupt scalars and drops unusable tasks', () => {
		const session = sanitizeSession({
			date: '2026-07-01',
			tasks: [
				{
					id: 1,
				},
				{
					title: 'no id',
				},
			],
			availableHours: 'eight',
			switchCost: NaN,
			updatedAt: -5,
		});

		expect(session).toMatchObject({
			availableHours: 0,
			switchCost: DEFAULT_SWITCH_COST,
			updatedAt: 0,
		});

		expect(session!.tasks).toHaveLength(1);
	});

	it('drops a session whose date is not an ISO day — that field is its key', () => {
		expect(
			sanitizeSession({
				date: 'yesterday',
				tasks: [],
			}),
		).toBeNull();

		expect(
			sanitizeSession({
				tasks: [],
			}),
		).toBeNull();

		expect(sanitizeSession('nope')).toBeNull();
	});

	it('leaves corrupt pools unset so readers fall back to the defaults', () => {
		const session = sanitizeSession({
			date: '2026-07-01',
			cognitivePool: 'lots',
			physicalPool: 3,
		});

		expect(session!.cognitivePool).toBeUndefined();
		expect(session!.physicalPool).toBe(3);
	});

	it('tolerates a non-array tasks field', () => {
		expect(
			sanitizeSession({
				date: '2026-07-01',
				tasks: 'none',
			})!.tasks,
		).toEqual([]);
	});

	it('filters a range read down to the usable days', () => {
		const days = sanitizeSessions([
			{
				date: '2026-07-01',
			},
			{
				date: 'broken',
			},
			null,
		]);

		expect(days.map((d) => d.date)).toEqual(['2026-07-01']);
		expect(sanitizeSessions('not an array')).toEqual([]);
	});
});

describe('sanitizeRoutines', () => {
	it('clamps corrupt template numbers — imports feed the live plan directly', () => {
		const routines = sanitizeRoutines([
			{
				id: 'routine-1',
				name: 'Morning',
				tasks: [
					{
						title: 'write',
						physicalDifficulty: 'abc',
						mentalDifficulty: 99,
						enjoyment: null,
					},
					'not a task',
				],
				createdAt: 'never',
			},
		]);

		expect(routines).toEqual([
			{
				id: 'routine-1',
				name: 'Morning',
				tasks: [
					{
						title: 'write',
						physicalDifficulty: 0,
						mentalDifficulty: 10,
						enjoyment: 1,
					},
				],
				createdAt: 0,
			},
		]);
	});

	it('drops a routine without a string id — deletion is keyed on it', () => {
		expect(
			sanitizeRoutines([
				{
					id: 7,
					name: 'x',
					tasks: [],
				},
				null,
			]),
		).toEqual([]);

		expect(sanitizeRoutines('not an array')).toEqual([]);
	});
});

describe('observation sanitizers', () => {
	it('keep well-formed records untouched', () => {
		expect(sanitizeFlowObservations([flow()])).toEqual([flow()]);
		expect(sanitizeDrainObservations([drain()])).toEqual([drain()]);
		expect(sanitizeRestObservations([rest()])).toEqual([rest()]);
	});

	// A measurement cannot be repaired without inventing data, and one non-finite
	// value poisons a whole least-squares fit — so the record leaves the fit.
	it('drop a record with any non-finite measurement', () => {
		const corruptPhi = flow({
			phiHours: null,
		});

		expect(sanitizeFlowObservations([corruptPhi, flow()])).toHaveLength(1);

		expect(
			sanitizeFlowObservations([
				flow({
					beta: 'x',
				}),
			]),
		).toEqual([]);

		expect(
			sanitizeDrainObservations([
				drain({
					mindDrain: undefined,
				}),
			]),
		).toEqual([]);

		expect(
			sanitizeDrainObservations([
				drain({
					hours: NaN,
				}),
			]),
		).toEqual([]);

		expect(
			sanitizeRestObservations([
				rest({
					bodyAfter: 'lots',
				}),
			]),
		).toEqual([]);
	});

	it('drop a record with no date or no id', () => {
		// Without an ISO date it belongs to no day's join; without an id the user
		// could never delete it from the calibration list.
		expect(
			sanitizeFlowObservations([
				flow({
					date: 'sometime',
				}),
			]),
		).toEqual([]);

		expect(
			sanitizeDrainObservations([
				drain({
					id: undefined,
				}),
			]),
		).toEqual([]);

		expect(
			sanitizeRestObservations([
				rest({
					date: null,
				}),
			]),
		).toEqual([]);
	});

	it('tolerate a non-array read', () => {
		expect(sanitizeFlowObservations(null)).toEqual([]);
		expect(sanitizeDrainObservations({})).toEqual([]);
		expect(sanitizeRestObservations(undefined)).toEqual([]);
	});
});
