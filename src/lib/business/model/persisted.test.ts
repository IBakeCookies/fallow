import { describe, it, expect } from 'vitest';
import {
	sanitizeDrainObservations,
	sanitizeFitSnapshots,
	sanitizeFlowObservations,
	sanitizeRestObservations,
	sanitizeRoutines,
	sanitizeSession,
	sanitizeSessions,
	sanitizeTask,
} from '$lib/business/model/persisted';
import { DEFAULT_SWITCH_COST, mapEffort, mapEnjoyability } from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
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

const fitSnapshot = (over: Record<string, unknown> = {}) => ({
	date: '2026-07-01',
	c1: 0.6,
	c2: -0.2,
	c3: 0.4,
	covariance: [
		[1, 0, 0],
		[0, 2, 0],
		[0, 0, 3],
	],
	sigma2: 0.0625,
	alphaCog: 0.42,
	alphaPhys: 0.31,
	recoveryRate: 0.9,
	stoppingValue: 0.7,
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

	// The slide badge is the first reader that can print this corruption, and it would
	// print `DAY NaN`.
	it('reads a corrupt stored createdAt as the session’s own day', () => {
		const task = sanitizeTask(
			{
				id: 1,
				title: 'write',
				createdAt: 'banana',
			},
			'2026-07-01',
		);

		expect(task).toMatchObject({
			createdAt: '2026-07-01',
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

	it('keeps a real must-do flag', () => {
		const task = sanitizeTask(
			{
				id: 1,
				mustDoToday: true,
				completed: true,
			},
			'2026-07-01',
		);

		expect(task).toMatchObject({
			mustDoToday: true,
			completed: true,
		});
	});

	// Every session stored before 2026-08-10 carries `flowMinutes`: the ⚡ badge was a
	// field on the task as well as an observation, and a measurement in two places is
	// one the row could only correct in one of them. The observation is now the only
	// one, so the stored copy is read back as the unknown key it has become — kept out
	// rather than resurrected into a second answer the app no longer writes.
	it('drops the ⚡ minutes an older session stamped on the task', () => {
		const task = sanitizeTask(
			{
				id: 1,
				flowMinutes: 25,
			},
			'2026-07-01',
		);

		expect(task).not.toHaveProperty('flowMinutes');
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

	/* The day's start was persisted for one day and read by nothing but a label
	   (the-anchor-that-held-only-itself.md). Its removal needs no migration and this
	   is why: the sanitizer builds a session from a fixed field list, so a stored key
	   it no longer names is dropped on the way in — `flowMinutes` above is the same
	   argument, one level up. */
	it('drops the start hour a session stored while the strip had a clock', () => {
		const session = sanitizeSession({
			date: '2026-07-01',
			startHour: 7,
		});

		expect(session).not.toHaveProperty('startHour');
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

	// A rating no input can produce is corrupt in the same way a NaN one is, and the
	// same rule applies: drop it. The fits clamp such a value away, but the log list
	// prints what it is handed.
	it('drop a record with a measurement outside its range', () => {
		expect(
			sanitizeDrainObservations([
				drain({
					mindDrain: 42,
				}),
				drain({
					bodyDrain: -3,
				}),
				drain({
					cognitiveDemand: 8,
				}),
				drain({
					hours: -1,
				}),
			]),
		).toEqual([]);

		expect(
			sanitizeRestObservations([
				rest({
					mindAfter: 11,
				}),
			]),
		).toEqual([]);

		expect(
			sanitizeFlowObservations([
				flow({
					enjoyment: 0,
				}),
				flow({
					E: 9,
				}),
				flow({
					beta: 2.5,
				}),
			]),
		).toEqual([]);
	});

	// The ends of the sliders are measurements, not corruption.
	it('keep a record at the edges of every range', () => {
		const spent = drain({
			hours: 0,
			cognitiveDemand: 0,
			physicalDemand: 1,
			mindDrain: 0,
			bodyDrain: 10,
		});

		expect(sanitizeDrainObservations([spent])).toEqual([spent]);

		const hardest = flow({
			difficulty: 10,
			enjoyment: 10,
			E: mapEffort(10),
			beta: mapEnjoyability(10),
			phiHours: 0,
		});

		expect(sanitizeFlowObservations([hardest])).toEqual([hardest]);

		const easiest = flow({
			difficulty: 1,
			enjoyment: 1,
			E: mapEffort(1),
			beta: mapEnjoyability(1),
		});

		expect(sanitizeFlowObservations([easiest])).toEqual([easiest]);
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

	// A snapshot is a record of a past fit, so it is dropped rather than repaired
	// for the same reason an observation is: a default substituted for a corrupt
	// field would report the plan the user saw as a plan they never saw.
	describe('sanitizeFitSnapshots', () => {
		it('composes a well-formed record back into the fit the model consumes', () => {
			const [snapshot] = sanitizeFitSnapshots([fitSnapshot()]);

			expect(snapshot.date).toBe('2026-07-01');

			expect(snapshot.constants).toEqual({
				c1: 0.6,
				c2: -0.2,
				c3: 0.4,
			});

			expect(snapshot.posterior).toEqual({
				covariance: [
					[1, 0, 0],
					[0, 2, 0],
					[0, 0, 3],
				],
				sigma2: 0.0625,
			});

			expect(snapshot.stoppingValue).toBe(0.7);

			// The three fitted rates land on the params; every model constant keeps
			// its default, which is why they are not stored.
			expect(snapshot.params).toEqual({
				...DEFAULT_ENERGY_PARAMS,
				alphaCog: 0.42,
				alphaPhys: 0.31,
				recoveryRate: 0.9,
			});
		});

		it('drops a record with a non-finite fitted value or no ISO date', () => {
			expect(
				sanitizeFitSnapshots([
					fitSnapshot({
						alphaCog: null,
					}),
				]),
			).toEqual([]);

			expect(
				sanitizeFitSnapshots([
					fitSnapshot({
						stoppingValue: NaN,
					}),
				]),
			).toEqual([]);

			expect(
				sanitizeFitSnapshots([
					fitSnapshot({
						date: 'yesterday',
					}),
				]),
			).toEqual([]);

			expect(
				sanitizeFitSnapshots([
					fitSnapshot({}),
					fitSnapshot({
						c2: 'x',
					}),
				]),
			).toHaveLength(1);
		});

		// A negative rate is outside the reservoir law's domain: it drives the
		// level below zero and `level^wc` is NaN, which reaches the objective and
		// makes the optimizer return the do-nothing plan. Dropped, not clamped —
		// this file repairs by drop-or-keep, and a substituted rate would audit
		// the day under params the user never had.
		it('drops a record whose fitted rate is negative', () => {
			for (const field of ['alphaCog', 'alphaPhys', 'recoveryRate']) {
				expect(
					sanitizeFitSnapshots([
						fitSnapshot({
							[field]: -0.7,
						}),
					]),
				).toEqual([]);
			}

			// Zero is in the domain: a fitted rate can legitimately bottom out.
			expect(
				sanitizeFitSnapshots([
					fitSnapshot({
						recoveryRate: 0,
					}),
				]),
			).toHaveLength(1);
		});

		// A MISSING posterior means σ_ϕ = 0 downstream — the allocator treats the
		// user as perfectly certain — so a snapshot that lost its
		// covariance must leave the audit rather than silently harden the plan.
		it('drops a record whose posterior is not a 3×3 matrix of finite numbers', () => {
			expect(
				sanitizeFitSnapshots([
					fitSnapshot({
						covariance: undefined,
					}),
				]),
			).toEqual([]);

			expect(
				sanitizeFitSnapshots([
					fitSnapshot({
						covariance: [
							[1, 0],
							[0, 1],
						],
					}),
				]),
			).toEqual([]);

			expect(
				sanitizeFitSnapshots([
					fitSnapshot({
						covariance: [
							[1, 0, 0],
							[0, 'x', 0],
							[0, 0, 1],
						],
					}),
				]),
			).toEqual([]);

			expect(
				sanitizeFitSnapshots([
					fitSnapshot({
						sigma2: 'quite',
					}),
				]),
			).toEqual([]);
		});

		it('tolerates a non-array read', () => {
			expect(sanitizeFitSnapshots(null)).toEqual([]);
			expect(sanitizeFitSnapshots('nope')).toEqual([]);
		});
	});
});
