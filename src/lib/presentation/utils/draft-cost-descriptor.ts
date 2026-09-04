/**
 * What a draft costs the day's other tasks → one line, for both add-task
 * panels.
 *
 * One line with three shapes: a name beats a total, and the empty case is said
 * rather than dropped. The two panels price different plans — `/` the classic
 * allocator, `/energy` the optimizer — but the displacement they read is the
 * same shape and reads the same sentence, so it is written once (AGENTS.md R3).
 * WHEN to print it is still each panel's: the reading is a cost row about a task
 * the plan funds, and each knows its own way of saying it funds none.
 */

import type { DraftDisplacement } from '$lib/business/model/metric/draft-impact';
import * as m from '$lib/paraglide/messages.js';
import { formatDuration } from '$lib/presentation/utils/duration-format';

export function describeDraftCost({ hoursTaken, taskCount, unfunded }: DraftDisplacement): string {
	if (unfunded.length > 0) {
		return m.form_impact_cost_unfunds({
			titles: unfunded.join(', '),
		});
	}

	if (taskCount === 0) return m.form_impact_cost_none();

	const hours = formatDuration(hoursTaken);

	return taskCount === 1
		? m.form_impact_cost_hours_one({
				hours,
			})
		: m.form_impact_cost_hours_other({
				hours,
				count: taskCount,
			});
}
