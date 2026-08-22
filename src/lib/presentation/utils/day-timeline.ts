/* The day's strip as a view model: geometry a test can assert, rather than a pile
   of `$derived` in the component (R2) — `completion-chart-points.ts` is the
   precedent. Blocks carry a `Band`, never a class string (presentation/AGENTS.md,
   "Metric color-band thresholds"). */

import type { SuggestedTask } from '$lib/business/model/metric/calculation';
import type { Band } from '$lib/presentation/utils/band';

export type DayBlock = {
	id: number;
	title: string;
	/** 1-based position in the day's run order. */
	position: number;
	hours: number;
	/** Hours from the day's start; the switch cost is the gap it leaves. */
	startOffset: number;
	flowHours: number;
	band: Band;
};

export type DayTimeline = {
	/** The denominator of every width. */
	totalHours: number;
	/** The strip's floor, counted in minimum block widths: `totalHours` over the
	 *  shortest allocation, so scaling the strip up to it lifts the narrowest block
	 *  to legible while every width stays a share of the day. 0 on a day with none. */
	minimumBlockWidths: number;
	blocks: DayBlock[];
};

export interface DayTimelineInput {
	suggestedTasks: Pick<SuggestedTask, 'id' | 'title' | 'suggestedHours' | 'flowStateTime'>[];
	runOrder: Map<number, number>;
	switchCost: number;
	availableHours: number;
}

export function buildDayTimeline(input: DayTimelineInput): DayTimeline {
	const { runOrder } = input;

	// `runOrder` is keyed on exactly the funded tasks, so a task with a position IS
	// a funded task and one without gets no block.
	const ordered = input.suggestedTasks
		.filter((task) => runOrder.has(task.id))
		.sort((a, b) => runOrder.get(a.id)! - runOrder.get(b.id)!);

	let startOffset = 0;

	const blocks = ordered.map((task): DayBlock => {
		const block: DayBlock = {
			id: task.id,
			title: task.title,
			position: runOrder.get(task.id)!,
			hours: task.suggestedHours,
			startOffset,
			flowHours: task.flowStateTime,
			band: task.suggestedHours >= task.flowStateTime ? 'success' : 'warning',
		};

		startOffset += task.suggestedHours + input.switchCost;

		return block;
	});

	return {
		totalHours: input.availableHours,
		minimumBlockWidths:
			blocks.length === 0
				? 0
				: input.availableHours / Math.min(...blocks.map((block) => block.hours)),
		blocks,
	};
}
