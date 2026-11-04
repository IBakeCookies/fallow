import { describe, expect, it } from 'vitest';
import { buildDayTimeline, type DayTimelineInput } from '$lib/presentation/utils/day-timeline';

const task = (id: number, suggestedHours: number, flowStateTime = 1) => ({
	id,
	suggestedHours,
	flowStateTime,
	completed: false,
});

/* A ticked-off task in the middle of a funded day. The allocator is blind to
   `completed` (business/model/AGENTS.md), so the day around it is what the plan
   already said. */
const dayWithCompleted = () =>
	input({
		suggestedTasks: [
			task(1, 2),
			{
				...task(2, 1.5),
				completed: true,
			},
			task(3, 1),
		],
		runOrder: new Map([
			[1, 1],
			[2, 2],
			[3, 3],
		]),
		switchCost: 0.25,
	});

const input = (over: Partial<DayTimelineInput> = {}): DayTimelineInput => ({
	suggestedTasks: [],
	runOrder: new Map(),
	switchCost: 0,
	availableHours: 8,
	...over,
});

describe('buildDayTimeline', () => {
	it('reads the blocks in run order, each offset by the ones before it', () => {
		const timeline = buildDayTimeline(
			input({
				suggestedTasks: [task(1, 2), task(2, 1), task(3, 1)],
				runOrder: new Map([
					[2, 1],
					[3, 2],
					[1, 3],
				]),
				availableHours: 4,
			}),
		);

		expect(timeline.blocks.map((block) => block.id)).toEqual([2, 3, 1]);
		expect(timeline.blocks.map((block) => block.startOffset)).toEqual([0, 1, 2]);
	});

	it('separates consecutive blocks by the switch cost', () => {
		const timeline = buildDayTimeline(
			input({
				suggestedTasks: [task(1, 1), task(2, 2)],
				runOrder: new Map([
					[1, 1],
					[2, 2],
				]),
				switchCost: 0.25,
				availableHours: 4,
			}),
		);

		expect(timeline.blocks[1].startOffset).toBe(1.25);
	});

	// ROADMAP M118, brief in zenith.test.ts "Switch Overhead".
	it('draws no switch gap under a negative switch cost', () => {
		const timelineAt = (switchCost: number) =>
			buildDayTimeline(
				input({
					suggestedTasks: [task(1, 1), task(2, 2)],
					runOrder: new Map([
						[1, 1],
						[2, 2],
					]),
					switchCost,
					availableHours: 4,
				}),
			);

		expect(timelineAt(-0.25)).toEqual(timelineAt(0));
	});

	/* The rail draws the allocation in two patterns — hatched while the task warms up
	   toward flow, solid once it is in flow — and dashes the hours flow would still
	   have needed. The three are the block's own arithmetic on ϕ. */
	it('splits a block short of flow into warm-up and the flow hours it still needed', () => {
		const timeline = buildDayTimeline(
			input({
				suggestedTasks: [task(1, 1, 1.1)],
				runOrder: new Map([[1, 1]]),
			}),
		);

		const [block] = timeline.blocks;

		expect(block.warmupHours).toBe(1);
		expect(block.inFlowHours).toBe(0);
		expect(block.ghostHours).toBeCloseTo(0.1, 2);
	});

	it('splits a block past flow into warm-up and in-flow hours, with no ghost', () => {
		const timeline = buildDayTimeline(
			input({
				suggestedTasks: [task(1, 1.5, 1)],
				runOrder: new Map([[1, 1]]),
			}),
		);

		const [block] = timeline.blocks;

		expect(block.warmupHours).toBe(1);
		expect(block.inFlowHours).toBe(0.5);
		expect(block.ghostHours).toBe(0);
	});

	// The last block's switch leads nowhere, so it is not drawn.
	it('charges every block but the last its switch cost', () => {
		const timeline = buildDayTimeline(
			input({
				suggestedTasks: [task(1, 1), task(2, 1), task(3, 1)],
				runOrder: new Map([
					[1, 1],
					[2, 2],
					[3, 3],
				]),
				switchCost: 0.25,
			}),
		);

		expect(timeline.blocks.map((block) => block.switchHours)).toEqual([0.25, 0.25, 0]);
	});

	it('bands a block by whether its allocation reaches flow', () => {
		const timeline = buildDayTimeline(
			input({
				suggestedTasks: [task(1, 2.5, 2.25), task(2, 1, 1.5)],
				runOrder: new Map([
					[1, 1],
					[2, 2],
				]),
				availableHours: 3.5,
			}),
		);

		expect(timeline.blocks[0].band).toBe('success');
		expect(timeline.blocks[1].band).toBe('warning');
	});

	it('gives an unfunded task no block', () => {
		const timeline = buildDayTimeline(
			input({
				suggestedTasks: [task(1, 2), task(2, 0)],
				runOrder: new Map([[1, 1]]),
			}),
		);

		expect(timeline.blocks).toHaveLength(1);
	});

	it('marks the block of a task the day has finished', () => {
		const timeline = buildDayTimeline(dayWithCompleted());

		expect(timeline.blocks.map((block) => block.isCompleted)).toEqual([false, true, false]);
	});

	it('keeps a finished block at the width the plan gave it', () => {
		const timeline = buildDayTimeline(dayWithCompleted());

		expect(timeline.blocks[1].hours).toBe(1.5);
	});

	it('leaves the block after a finished one where the plan put it', () => {
		const timeline = buildDayTimeline(dayWithCompleted());

		expect(timeline.blocks[2].startOffset).toBe(4);
	});
});
