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
	/** The task measured; null for ☕, which is not worked on anything. */
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
	/** First day of the viewed analytics range, inclusive. */
	rangeStart: string;
}

/**
 * The range's measurements, newest first — the order the list prints, so nothing
 * downstream re-sorts what a test has already pinned.
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

	for (const log of input.flow) {
		if (log.date < input.rangeStart) continue;

		dated.push({
			row: {
				key: `flow-${log.id}`,
				id: log.id,
				kind: 'flow',
				date: log.date,
				taskTitle: log.taskTitle,
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
		if (log.date < input.rangeStart) continue;

		dated.push({
			row: {
				key: `drain-${log.id}`,
				id: log.id,
				kind: 'drain',
				date: log.date,
				taskTitle: log.taskTitle,
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
		if (log.date < input.rangeStart) continue;

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
