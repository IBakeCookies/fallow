/**
 * The business layer's public type surface for the presentation layer.
 *
 * Presentation code must not import from `$lib/data/*` — persisted entity
 * types are re-exported here so components depend on the business layer only.
 * Types several stores hand to presentation are declared here, so no store
 * imports another's.
 */

export type {
	Persisted,
	Task,
	TaskImportance,
	DailySession,
	SavedRoutine,
	FlowObservationRecord,
	DrainObservationRecord,
	RestObservationRecord,
} from '$lib/data/type';

export type Undo = () => Promise<void>;
