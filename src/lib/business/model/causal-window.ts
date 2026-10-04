import type { FlowObservationRecord } from '$lib/data/type';
import { daysBetween } from '$lib/business/utils/date';
import {
	fitUserConstants,
	type FitPosterior,
	type UserConstants,
} from '$lib/business/model/zenith';

/** business/model/AGENTS.md, "A plan for day D is fitted from logs dated strictly BEFORE D". */
export function applyCausalWindow<T extends { date: string }>(
	rows: T[],
	day: string,
): { counted: T[]; pendingCount: number } {
	const counted = rows.filter((row) => row.date < day);

	return {
		counted,
		pendingCount: rows.length - counted.length,
	};
}

/**
 * The personalized model fit: ridge least-squares of the logged time-to-flow
 * measurements, anchored to the article defaults, plus the Bayesian posterior
 * the allocator consumes (MATH.md §5.1). The main dashboard plans under it and
 * the calendar/analytics pages read a day through it, so their per-day
 * completion rates match — which requires the posterior too, not just the point
 * estimate.
 */
export interface UserFit {
	constants: UserConstants;
	/** Never absent: every `fitUserConstants` path returns one. */
	posterior: FitPosterior;
	fitted: boolean;
	/** Σw: what the ⚡ history is worth in fresh logs, not its row count (§5.2). */
	usedCount: number;
	/** Logs dated on or after `day`, which this fit therefore did not read. Every
	 *  surface that prints a log count owes the user this one too. */
	pendingCount: number;
}

/**
 * The fit **as of** `day`: logs dated strictly before it, aged against it.
 * Causal rather than whole-history, which is what makes the fit this returns
 * the one that day actually planned under — and what stops a ⚡ logged this
 * afternoon from re-scoring a day the user finished in March.
 */
export function fitFrom(observations: FlowObservationRecord[], day: string): UserFit {
	const { counted, pendingCount } = applyCausalWindow(observations, day);

	const fit = fitUserConstants(
		counted.map((o) => ({
			E: o.E,
			beta: o.beta,
			phi: o.phiHours,
			ageDays: daysBetween(o.date, day),
		})),
	);

	return {
		constants: fit.constants,
		posterior: fit.posterior,
		fitted: fit.fitted,
		usedCount: fit.effectiveCount,
		pendingCount,
	};
}
