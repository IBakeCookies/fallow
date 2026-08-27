import { describe, expect, it } from 'vitest';
import { buildDayTimeline, type DayTimelineInput } from '$lib/presentation/utils/day-timeline';

const task = (id: number, suggestedHours: number, flowStateTime = 1) => ({
	id,
	title: `Task ${id}`,
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
			{
				...task(1, 2),
				title: 'Write the PDF',
			},
			{
				...task(2, 1.5),
				title: 'Boxing training',
				completed: true,
			},
			{
				...task(3, 1),
				title: 'Read the brief',
			},
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

	// The gap IS the reading: the strip states the switch cost by leaving room for
	// it rather than printing a second copy of the number.
	it('separates consecutive blocks by the switch cost', () => {
		const timeline = buildDayTimeline(
			input({
				suggestedTasks: [task(1, 2), task(2, 2)],
				runOrder: new Map([
					[1, 1],
					[2, 2],
				]),
				switchCost: 0.25,
				availableHours: 4.25,
			}),
		);

		expect(timeline.blocks[1].startOffset).toBe(2.25);
	});

	/* A 15-minute allocation in an 8h day is 3% of the strip — narrower on a phone
	   than the block's own padding — and it is BY CONSTRUCTION the block carrying
	   the "short of flow" reading. The floor is the strip's, not the block's: scaled
	   to this many minimum block widths the shortest allocation clears one of them,
	   and every width stays a share of the day. */
	it('counts the strip in minimum block widths off its shortest allocation', () => {
		const timeline = buildDayTimeline(
			input({
				suggestedTasks: [task(1, 2), task(2, 0.25)],
				runOrder: new Map([
					[1, 1],
					[2, 2],
				]),
				availableHours: 8,
			}),
		);

		expect(timeline.minimumBlockWidths).toBe(32);
	});

	it('counts a single block off its own allocation', () => {
		const timeline = buildDayTimeline(
			input({
				suggestedTasks: [task(1, 2)],
				runOrder: new Map([[1, 1]]),
				availableHours: 8,
			}),
		);

		expect(timeline.minimumBlockWidths).toBe(4);
	});

	it('asks for no width on a day that funded nothing', () => {
		expect(buildDayTimeline(input()).minimumBlockWidths).toBe(0);
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
