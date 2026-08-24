/**
 * What the last day that declared them says the switch cost and the capacity
 * pools are, so a day with no stored session opens on the way the user actually
 * works rather than on the two invented constants (ROADMAP item 32).
 *
 * Last declared, not `budget-memory.ts`'s weekday median: hours are
 * weekday-shaped — a Saturday is a different day — while a switch cost and a
 * capacity are properties of the person and their tooling, which the calendar
 * says nothing about.
 *
 * Each field answers from its own latest day, because pools are optional in
 * storage and the newest day may have none. `switchCost` is not optional there,
 * so a stored day always declares one: what carries is the cost the last stored
 * day ran with, which is the only declaration that exists.
 */

import type { DailySession } from '$lib/data/type';
import {
	DEFAULT_SWITCH_COST,
	DEFAULT_CAPACITY_POOLS,
	type CapacityPools,
} from '$lib/business/model/zenith';

export interface DeclaredConstraints {
	switchCost: number;
	pools: CapacityPools;
}

export function summarizeDeclaredConstraints(sessions: DailySession[]): DeclaredConstraints {
	// ISO dates sort lexicographically and '' is below all of them, so the empty
	// date is "nothing declared this yet" without a second flag.
	let switchCost = {
		date: '',
		value: DEFAULT_SWITCH_COST,
	};
	let pools = {
		date: '',
		value: DEFAULT_CAPACITY_POOLS,
	};

	for (const session of sessions) {
		if (session.date > switchCost.date)
			switchCost = {
				date: session.date,
				value: session.switchCost,
			};

		// The pair or nothing: every writer writes both, so half a pair is a
		// corrupt record rather than a statement about either capacity.
		if (
			session.cognitivePool !== undefined &&
			session.physicalPool !== undefined &&
			session.date > pools.date
		)
			pools = {
				date: session.date,
				value: {
					cognitiveHours: session.cognitivePool,
					physicalHours: session.physicalPool,
				},
			};
	}

	return {
		switchCost: switchCost.value,
		pools: pools.value,
	};
}
