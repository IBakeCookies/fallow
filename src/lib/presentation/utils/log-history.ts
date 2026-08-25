/* Every measurement the user has made, in one dated list. The three kinds live in
   three stores and were readable in three different places — ⚡ inside the main
   page's day-constraints bar, 🪫 and ☕ inside two Energy Lab cards — so "what
   have I logged this month" had no answer anywhere.

   A fold and not a store: the records are already loaded (the session store's ⚡,
   the observation store's 🪫/☕), and merging them is a view of those two, not a
   fourth source of truth. It stays out of `business/` for the same reason nothing
   in the model reads it — no fit, bound or plan is computed from this shape.

   The row carries numbers, not worded readings: the "M"/"B" letters and the
   durations are what the three calibration cards printed in markup until this list
   took over from them (2026-08-10), and re-wording them here would have made the
   same reading read differently on two screens — R3's mirrors case. */

import type {
	DrainObservationRecord,
	FlowObservationRecord,
	Persisted,
	RestObservationRecord,
} from '$lib/business/type';

/** ⚡ time to flow, 🪫 end-of-session rating, ☕ a break rated on both sides. */
export type LogKind = 'flow' | 'drain' | 'rest';

export interface LogHistoryRow {
	/** Unique across kinds: the three stores autoincrement independently, so the
	 *  ids collide, and a colliding `{#each}` key silently drops rows. */
	key: string;
	/** The record's id in its own store — what a delete is addressed to. Kept
	 *  beside `key` rather than parsed back out of it: the key is a render
	 *  detail, and a store call reading one would depend on how rows are keyed. */
	id: number;
	kind: LogKind;
	date: string;
	/** The task measured, by its CURRENT name where the app still holds one; null for
	 *  ☕, which is not worked on anything. */
	taskTitle: string | null;
	/** ⚡ is the measured time to flow, the other two the length of what was rated. */
	hours: number;
	/** Cognitive rating: after the session for 🪫, going into the break for ☕. */
	mind: number | null;
	/** Coming out of the break — null for the two kinds that rate one moment. */
	mindAfter: number | null;
	body: number | null;
	bodyAfter: number | null;
}

export interface LogHistoryInput {
	flow: Persisted<FlowObservationRecord>[];
	drain: Persisted<DrainObservationRecord>[];
	rest: Persisted<RestObservationRecord>[];
	/** First day of the viewed analytics range, inclusive. Left off for "all time",
	 *  which the card offers because this list is the only surface some measurements
	 *  have: a ☕ belongs to no task's row, and nothing older than the widest range (a
	 *  year) appears anywhere else — so a range that always bounded it would put a
	 *  two-year-old typo permanently beyond correcting. */
	rangeStart?: string;
	/** What each task is called NOW, by id. ⚡ and 🪫 records also carry the title
	 *  they were logged under, which a rename leaves stale — so the live name wins
	 *  wherever there is one, and the record's copy is the fallback for a task that
	 *  has been deleted or has aged out of the loaded history. Left off entirely by a
	 *  caller that holds no tasks; then every row reads its record. */
	taskTitles?: ReadonlyMap<number, string>;
}

/**
 * The range's measurements — or all of them, with no `rangeStart` — newest first:
 * the order the list prints, so nothing downstream re-sorts what a test has
 * already pinned.
 *
 * Ordered by date and then by when each was logged, not by date alone: a day
 * holds several 🪫 sessions and several ☕ breaks, and their order is the only
 * thing that says which came first. Two keys rather than `createdAt` alone
 * because an imported backup can carry a stamp that disagrees with its day, and
 * the day is what the row prints.
 */
export function logHistory(input: LogHistoryInput): LogHistoryRow[] {
	// The stamp orders the list but is not part of a row: it says when a measurement
	// was logged, and every row prints the DAY it belongs to instead (a corrected 🪫
	// rating keeps its original stamp, so the two can disagree).
	const dated: { row: LogHistoryRow; createdAt: number }[] = [];

	// The task's name today, or the one the record froze at logging time. Not a
	// measurement — the covariates a fit reads are frozen, and a title is a LABEL, so
	// nothing is protected by printing a name the task no longer has.
	//
	// `||`, not `??`: `sanitizeTask` keeps a task whose stored title is not a string as
	// `''` (R4 — persisted data is hand-editable and restorable from old backups), and
	// an empty live name is worse than a stale one. It would also take the row's day
	// link with it, since an unnamed row is how a ☕ is drawn.
	const titleOf = (log: { taskId: number; taskTitle: string }) =>
		input.taskTitles?.get(log.taskId) || log.taskTitle;

	for (const log of input.flow) {
		if (input.rangeStart !== undefined && log.date < input.rangeStart) continue;

		dated.push({
			row: {
				key: `flow-${log.id}`,
				id: log.id,
				kind: 'flow',
				date: log.date,
				taskTitle: titleOf(log),
				hours: log.phiHours,
				mind: null,
				mindAfter: null,
				body: null,
				bodyAfter: null,
			},
			createdAt: log.createdAt,
		});
	}

	for (const log of input.drain) {
		if (input.rangeStart !== undefined && log.date < input.rangeStart) continue;

		dated.push({
			row: {
				key: `drain-${log.id}`,
				id: log.id,
				kind: 'drain',
				date: log.date,
				taskTitle: titleOf(log),
				hours: log.hours,
				mind: log.mindDrain,
				mindAfter: null,
				body: log.bodyDrain,
				bodyAfter: null,
			},
			createdAt: log.createdAt,
		});
	}

	for (const log of input.rest) {
		if (input.rangeStart !== undefined && log.date < input.rangeStart) continue;

		dated.push({
			row: {
				key: `rest-${log.id}`,
				id: log.id,
				kind: 'rest',
				date: log.date,
				taskTitle: null,
				hours: log.hours,
				mind: log.mindBefore,
				mindAfter: log.mindAfter,
				body: log.bodyBefore,
				bodyAfter: log.bodyAfter,
			},
			createdAt: log.createdAt,
		});
	}

	dated.sort((a, b) => b.row.date.localeCompare(a.row.date) || b.createdAt - a.createdAt);

	return dated.map((entry) => entry.row);
}
