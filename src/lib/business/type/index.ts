/**
 * The business layer's public type surface for the presentation layer.
 *
 * Presentation code must not import from `$lib/data/*` — persisted entity
 * types are re-exported here so components depend on the business layer only.
 */

export type {
	Task,
	DailySession,
	SavedRoutine,
	FlowObservationRecord,
	DrainObservationRecord,
	RestObservationRecord
} from '$lib/data/type';
