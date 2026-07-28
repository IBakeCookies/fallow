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
	FlowObservationRecord,
	RestObservationRecord,
	SavedRoutine,
	Task,
} from '$lib/data/type';
import { DEFAULT_SWITCH_COST } from '$lib/business/model/zenith';
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

	// Both optional flags stay absent unless they are meaningfully present: a
	// non-positive flowMinutes is not a measurement, and mustDoToday is a
	// statement about today that only `true` makes.
	const flowMinutes = finite(source.flowMinutes);

	if (flowMinutes !== null && flowMinutes > 0) task.flowMinutes = flowMinutes;

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

export function sanitizeFlowObservations(raw: unknown): FlowObservationRecord[] {
	return sanitizeObservations<FlowObservationRecord>(raw, FLOW_NUMBERS);
}

export function sanitizeDrainObservations(raw: unknown): DrainObservationRecord[] {
	return sanitizeObservations<DrainObservationRecord>(raw, DRAIN_NUMBERS);
}

export function sanitizeRestObservations(raw: unknown): RestObservationRecord[] {
	return sanitizeObservations<RestObservationRecord>(raw, REST_NUMBERS);
}
