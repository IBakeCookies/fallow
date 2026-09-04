/**
 * Of the titles the user already works on, which ones would make today's plan
 * worth the most — the question the empty add-task form cannot answer from the
 * draft, because there is no draft yet. Ranked on the day's Σ P̄ with the title
 * added, not on the hours it is given: the hours are shown alongside, but a task
 * the plan buys many hours of is not the same as one the day gains most from.
 *
 * One full solve per candidate, which is why the candidates are capped: the
 * ranking is the day re-planned with each title prepended, and nothing cheaper
 * reads the objective the plan is actually sorted by.
 */

import type { TitleRating } from '$lib/business/model/title-memory';
import { normalizeTitle } from '$lib/business/model/title-memory';
import { prependDraft } from '$lib/business/model/metric/draft-impact';
import {
	calculateDailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';

export interface NextTaskSuggestion {
	rating: TitleRating;
	suggestedHours: number;
}

/**
 * Candidates scored, most recently used first. One solve each, against the
 * 109-124 ms per-candidate worst case `business/AGENTS.md` measures.
 */
export const NEXT_TASK_CANDIDATE_LIMIT = 8;

export const NEXT_TASK_COUNT = 3;

export function suggestNextTasks(
	input: DailyMetricsInput,
	ratings: Map<string, TitleRating>,
): NextTaskSuggestion[] {
	const onToday = new Set(input.tasks.map((task) => normalizeTitle(task.title)));

	// Filtered BEFORE the cap, so the eight are eight titles the user can act on
	// rather than eight of which some are already on the day.
	return (
		[...ratings]
			.filter(([key]) => !onToday.has(key))
			.sort(([, a], [, b]) => b.lastUsedDate.localeCompare(a.lastUsedDate))
			.slice(0, NEXT_TASK_CANDIDATE_LIMIT)
			.map(([, rating]) => {
				const { tasks, draftId } = prependDraft(input.tasks, rating);

				const metrics = calculateDailyMetrics({
					...input,
					tasks,
				});

				return {
					rating,
					suggestedHours: metrics.suggestedTasks.find((task) => task.id === draftId)!
						.suggestedHours,
					gain: metrics.zenithGain.optimized,
				};
			})
			// Stable, so a tie on the objective keeps the recency order above — and two
			// titles last used on the same day keep the memory's own.
			.sort((a, b) => b.gain - a.gain)
			.slice(0, NEXT_TASK_COUNT)
			.map(({ rating, suggestedHours }) => ({
				rating,
				suggestedHours,
			}))
	);
}
