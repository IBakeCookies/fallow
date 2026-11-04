/* The day's axis and the rows' rails as one view model: geometry a test can assert,
   rather than a pile of `$derived` in markup (R2) — `completion-chart-points.ts` is
   the precedent. Blocks carry a `Band`, never a class string (presentation/AGENTS.md,
   "Metric color-band thresholds"). */

import type { SuggestedTask } from '$lib/business/model/metric/calculation';
import { clampSwitchCost } from '$lib/business/utils/switch-cost';
import { BAND_BAR_CLASS, type Band, getBandFlowReached } from '$lib/presentation/utils/band';

export type DayBlock = {
	id: number;
	hours: number;
	/** Hours from the day's start; `switchHours` follows the block. */
	startOffset: number;
	/** min(hours, ϕ) — drawn hatched. */
	warmupHours: number;
	/** max(0, hours − ϕ) — drawn solid. */
	inFlowHours: number;
	/** max(0, ϕ − hours) — the flow time the plan left unfunded, drawn dashed. */
	ghostHours: number;
	/** The switch cost after the block; 0 on the last block. */
	switchHours: number;
	band: Band;
	isCompleted: boolean;
};

export type DayTimeline = {
	/** The denominator of every width. */
	totalHours: number;
	blocks: DayBlock[];
};

export interface DayTimelineInput {
	suggestedTasks: Pick<SuggestedTask, 'id' | 'suggestedHours' | 'flowStateTime' | 'completed'>[];
	runOrder: Map<number, number>;
	switchCost: number;
	availableHours: number;
}

/** The PATTERN of each segment, shared by the rail and its legend so the two cannot
 *  drift (R3); pattern is what separates them without colour (WCAG 1.4.1). Ink is the
 *  caller's: a rail inks warm-up and ghost with its block's band (`BAND_HATCH_CLASS`,
 *  which the hatch and `border-current` both read as `currentColor`), and in flow is the
 *  success fill because only a block that reaches flow draws one. The switch is grey
 *  either way — it is not the task's time. The band's words are the row's verdict. */
export const RAIL_SEGMENT_CLASS = {
	warmup: 'hatch',
	inFlow: BAND_BAR_CLASS.success,
	ghost: 'border border-dashed border-current',
	switch: 'bg-ty-ghost',
} as const;

//
export function buildDayTimeline(input: DayTimelineInput): DayTimeline {
	const { runOrder } = input;

	// `runOrder` is keyed on exactly the funded tasks, so a task with a position IS
	// a funded task and one without gets no block.
	const ordered = input.suggestedTasks
		.filter((task) => runOrder.has(task.id))
		.sort((a, b) => runOrder.get(a.id)! - runOrder.get(b.id)!);

	const switchCost = clampSwitchCost(input.switchCost);
	let startOffset = 0;

	const blocks = ordered.map((task, index): DayBlock => {
		const hours = task.suggestedHours;

		const block: DayBlock = {
			id: task.id,
			hours,
			startOffset,
			warmupHours: Math.min(hours, task.flowStateTime),
			inFlowHours: Math.max(0, hours - task.flowStateTime),
			ghostHours: Math.max(0, task.flowStateTime - hours),
			switchHours: index === ordered.length - 1 ? 0 : switchCost,
			band: getBandFlowReached(hours, task.flowStateTime),
			isCompleted: task.completed,
		};

		startOffset += hours + switchCost;

		return block;
	});

	return {
		totalHours: input.availableHours,
		blocks,
	};
}
