/**
 * Validation of persisted records on the way IN (AGENTS.md R4: the data layer
 * parses and stores, the business layer decides what a valid value means).
 *
 * The repositories' return types describe what a WELL-FORMED record looks like;
 * they are not a guarantee. Stored JSON is user-reachable — hand-edited in
 * devtools, restored from a backup file someone edited, or written by a build
 * that has since been deployed over — and nothing downstream defends itself:
 * `Math.max('abc', 5)` is NaN, one NaN observation makes an entire least-squares
 * fit NaN, and a NaN task in the daily session is written straight back by the
 * auto-save. So every read of a persisted record passes through here first.
 *
 * Two different repairs, because the records mean different things:
 * - Sessions and tasks are the user's OWN content: keep them and clamp the
 *   numbers, defaulting a non-number to the least-effort end of its scale so a
 *   corrupt field can never inflate a plan. Losing a task would lose writing.
 * - Observations are MEASUREMENTS: a corrupt number cannot be repaired without
 *   inventing data, so the record is dropped from the fit entirely.
 */

import type {
	DailySession,
	DrainObservationRecord,
	FitSnapshotRecord,
	FlowObservationRecord,
	Persisted,
	RestObservationRecord,
	SavedRoutine,
	Task,
} from '$lib/data/type';
import {
	DEFAULT_SWITCH_COST,
	type FitPosterior,
	type UserConstants,
} from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS, type EnergyParams } from '$lib/business/model/zenith-energy';
import { isISODate } from '$lib/business/utils/date';

/** The sliders' ranges (`task-form.svelte`): difficulties from 0, enjoyment from 1. */
const DIFFICULTY_MIN = 0;
const ENJOYMENT_MIN = 1;
const RATING_MAX = 10;

function fields(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function finite(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamped(value: unknown, min: number, max: number): number {
	return Math.min(max, Math.max(min, finite(value) ?? min));
}

/** Non-negative, defaulting a missing or corrupt value to `fallback`. */
function atLeastZero(value: unknown, fallback: number): number {
	const parsed = finite(value);

	return parsed === null ? fallback : Math.max(0, parsed);
}

function isoDate(value: unknown): string | null {
	return isISODate(value) ? value : null;
}

/** The keep-and-clamp core shared by session tasks and routine templates. */
function taskCore(source: Record<string, unknown>) {
	return {
		title: typeof source.title === 'string' ? source.title : '',
		physicalDifficulty: clamped(source.physicalDifficulty, DIFFICULTY_MIN, RATING_MAX),
		mentalDifficulty: clamped(source.mentalDifficulty, DIFFICULTY_MIN, RATING_MAX),
		enjoyment: clamped(source.enjoyment, ENJOYMENT_MIN, RATING_MAX),
	};
}

/**
 * One task, or null when it has no usable id: an unaddressable task cannot be
 * completed, edited or deleted, so keeping it would show the user a row they
 * can never get rid of. `createdAt` falls back to the session's own date.
 */
export function sanitizeTask(raw: unknown, fallbackDate: string): Task | null {
	const source = fields(raw);
	const id = finite(source?.id);

	if (!source || id === null) return null;

	const task: Task = {
		...taskCore(source),
		id,
		createdAt: typeof source.createdAt === 'string' ? source.createdAt : fallbackDate,
		completed: source.completed === true,
	};

	// The flag stays absent unless it is meaningfully present: mustDoToday is a
	// statement about today that only `true` makes. A stored `flowMinutes` is read
	// past, not repaired — the ⚡ badge is the day's observation since 2026-08-10.
	if (source.mustDoToday === true) task.mustDoToday = true;

	return task;
}

/**
 * One stored day, or null when its `date` is not an ISO day — that field is the
 * store's key and every read, range query and join is keyed on it, so a record
 * without one belongs to no day at all. Treat it as an absent session: the day
 * then loads empty and the next edit overwrites the broken record.
 */
export function sanitizeSession(raw: unknown): DailySession | null {
	const source = fields(raw);
	const date = isoDate(source?.date);

	if (!source || date === null) return null;

	const session: DailySession = {
		date,
		tasks: Array.isArray(source.tasks)
			? source.tasks
					.map((task) => sanitizeTask(task, date))
					.filter((task): task is Task => task !== null)
			: [],
		availableHours: atLeastZero(source.availableHours, 0),
		switchCost: atLeastZero(source.switchCost, DEFAULT_SWITCH_COST),
		updatedAt: atLeastZero(source.updatedAt, 0),
	};

	// Pools stay optional: a session saved before they were configurable has
	// none, and readers already fall back to DEFAULT_CAPACITY_POOLS — so a
	// corrupt pool becomes "unset" rather than a fabricated capacity.
	const cognitivePool = finite(source.cognitivePool);
	const physicalPool = finite(source.physicalPool);

	if (cognitivePool !== null) session.cognitivePool = Math.max(0, cognitivePool);

	if (physicalPool !== null) session.physicalPool = Math.max(0, physicalPool);

	return session;
}

export function sanitizeSessions(raw: unknown): DailySession[] {
	if (!Array.isArray(raw)) return [];

	return raw.map(sanitizeSession).filter((session): session is DailySession => session !== null);
}

/**
 * One saved routine, or null when its `id` is not a string — deletion is keyed
 * on it, so a routine without one could never be removed. Its tasks are
 * templates the header imports straight into the live plan, so their numbers
 * get the same keep-and-clamp as session tasks; rows that aren't objects are
 * dropped (a template has no id to address them by).
 */
export function sanitizeRoutine(raw: unknown): SavedRoutine | null {
	const source = fields(raw);

	if (!source || typeof source.id !== 'string') return null;

	return {
		id: source.id,
		name: typeof source.name === 'string' ? source.name : '',
		tasks: Array.isArray(source.tasks)
			? source.tasks
					.map(fields)
					.filter((task): task is Record<string, unknown> => task !== null)
					.map(taskCore)
			: [],
		createdAt: atLeastZero(source.createdAt, 0),
	};
}

export function sanitizeRoutines(raw: unknown): SavedRoutine[] {
	if (!Array.isArray(raw)) return [];

	return raw.map(sanitizeRoutine).filter((routine): routine is SavedRoutine => routine !== null);
}

/**
 * Drop-or-keep for measurements: every listed field must be a finite number and
 * `date` an ISO day, and `id` must be usable or the user could never delete the
 * record from the calibration list.
 */
function sanitizeObservations<T>(raw: unknown, numberFields: readonly string[]): T[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter((record) => {
		const source = fields(record);

		if (!source || isoDate(source.date) === null || finite(source.id) === null) return false;

		return numberFields.every((field) => finite(source[field]) !== null);
	}) as T[];
}

const FLOW_NUMBERS = ['taskId', 'difficulty', 'enjoyment', 'E', 'beta', 'phiHours'] as const;

const DRAIN_NUMBERS = [
	'taskId',
	'hours',
	'cognitiveDemand',
	'physicalDemand',
	'mindDrain',
	'bodyDrain',
] as const;

const REST_NUMBERS = ['hours', 'mindBefore', 'mindAfter', 'bodyBefore', 'bodyAfter'] as const;

// `Persisted<…>` rather than the bare record, and the only place that upgrade is
// made: the id filter above is what earns it, so the callers keying a list or
// deleting a row need no `id!`.
export function sanitizeFlowObservations(raw: unknown): Persisted<FlowObservationRecord>[] {
	return sanitizeObservations<Persisted<FlowObservationRecord>>(raw, FLOW_NUMBERS);
}

export function sanitizeDrainObservations(raw: unknown): Persisted<DrainObservationRecord>[] {
	return sanitizeObservations<Persisted<DrainObservationRecord>>(raw, DRAIN_NUMBERS);
}

export function sanitizeRestObservations(raw: unknown): Persisted<RestObservationRecord>[] {
	return sanitizeObservations<Persisted<RestObservationRecord>>(raw, REST_NUMBERS);
}

/**
 * One day's recorded fit, composed back into the shapes the two planners take.
 * `params` is the defaults with the three fitted rates applied — the record
 * stores only what a fit can move (see `FitSnapshotRecord`).
 */
export interface FitSnapshot {
	date: string;
	constants: UserConstants;
	posterior: FitPosterior;
	params: EnergyParams;
	/** Fitted λ₀ (§8.10), which `params.freeTimeValue` deliberately does not carry */
	stoppingValue: number;
}

const SNAPSHOT_NUMBERS = [
	'c1',
	'c2',
	'c3',
	'sigma2',
	'alphaCog',
	'alphaPhys',
	'recoveryRate',
	'stoppingValue',
] as const;

/** A 3×3 matrix of finite numbers, or null — the shape σ_ϕ = √(xᵀΣx) indexes. */
function covarianceOf(value: unknown): number[][] | null {
	if (!Array.isArray(value) || value.length !== 3) return null;

	const rows = value.map((row) =>
		Array.isArray(row) && row.length === 3 && row.every((cell) => finite(cell) !== null)
			? (row as number[])
			: null,
	);

	return rows.every((row) => row !== null) ? (rows as number[][]) : null;
}

/**
 * Drop-or-keep, like the observation sanitizers and for the same reason: a
 * snapshot records what the model believed on a past day, and a default
 * substituted for a corrupt field would report a plan the user never saw as the
 * plan they did. The posterior must survive whole — a snapshot missing its
 * covariance would leave σ_ϕ = 0 (MATH.md §13.1), i.e. an early day audited as
 * though the user had been perfectly certain, which is the bias this fixes.
 */
export function sanitizeFitSnapshots(raw: unknown): FitSnapshot[] {
	if (!Array.isArray(raw)) return [];

	const snapshots: FitSnapshot[] = [];

	for (const record of raw as FitSnapshotRecord[]) {
		const source = fields(record);
		const date = isoDate(source?.date);
		const covariance = covarianceOf(source?.covariance);

		if (!source || date === null || covariance === null) continue;

		if (SNAPSHOT_NUMBERS.some((field) => finite(source[field]) === null)) continue;

		snapshots.push({
			date,
			constants: {
				c1: source.c1 as number,
				c2: source.c2 as number,
				c3: source.c3 as number,
			},
			posterior: {
				covariance,
				sigma2: source.sigma2 as number,
			},
			params: {
				...DEFAULT_ENERGY_PARAMS,
				alphaCog: source.alphaCog as number,
				alphaPhys: source.alphaPhys as number,
				recoveryRate: source.recoveryRate as number,
			},
			stoppingValue: source.stoppingValue as number,
		});
	}

	return snapshots;
}
