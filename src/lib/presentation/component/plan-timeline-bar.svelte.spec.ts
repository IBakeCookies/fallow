import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { EvaluatedBlock } from '$lib/business/model/zenith-energy';
import PlanTimelineBar from '$lib/presentation/component/plan-timeline-bar.svelte';
import { seriesColors } from '$lib/presentation/utils/series-color';

const block = (
	taskId: number | null,
	title: string,
	start: number,
	hours: number,
): EvaluatedBlock => ({
	taskId,
	title,
	start,
	hours,
	output: 1,
	cogAfter: 0.6,
	physAfter: 0.7,
});

const props = {
	blocks: [block(1, 'boxing', 0, 3), block(null, 'rest', 3, 1), block(2, 'writing', 4, 4)],
	windowHours: 8,
	trailingFreeHours: 0,
	colors: seriesColors([1, 2]),
};

describe('plan-timeline-bar.svelte', () => {
	// The bar is the plan to scale, so a block's width IS its share of the day. Widths
	// that ignore the window are a bar that fills regardless of how much is planned.
	it('sizes every block as its share of the day window', async () => {
		render(PlanTimelineBar, props);

		await expect
			.element(page.getByTitle(/boxing/))
			.toHaveAttribute('style', expect.stringContaining('width: 37.5%'));

		await expect
			.element(page.getByTitle(/writing/))
			.toHaveAttribute('style', expect.stringContaining('width: 50%'));
	});

	// Offsets, not wall-clock times, and the duration is spelled out: the tooltip is
	// the only place a block under 7% of the day says what it is.
	it('names each block with its offsets and duration', async () => {
		render(PlanTimelineBar, props);

		await expect.element(page.getByTitle('boxing — 0h–3h (3h)')).toBeInTheDocument();
		await expect.element(page.getByTitle('writing — 4h–8h (4h)')).toBeInTheDocument();
	});

	// A label narrower than ~7% renders as an ellipsis, which reads as breakage
	it('drops the label on a block too narrow to hold one, keeping its tooltip', async () => {
		render(PlanTimelineBar, {
			...props,
			blocks: [block(1, 'boxing', 0, 7.7), block(2, 'inbox', 7.7, 0.3)],
		});

		expect(page.getByText('inbox').elements()).toHaveLength(0);
		await expect.element(page.getByTitle(/inbox/)).toBeInTheDocument();
		await expect.element(page.getByText('boxing')).toBeInTheDocument();
	});

	// Rest is not one of the tasks: it takes the rest colour, and a lighter fill than
	// worked time so the plan reads as work against pauses.
	it('paints rest in the rest colour, more transparent than work', async () => {
		render(PlanTimelineBar, props);

		await expect
			.element(page.getByTitle(/^rest/))
			.toHaveAttribute(
				'style',
				expect.stringContaining('color-mix(in oklch, var(--series-rest) 40%, transparent)'),
			);

		await expect
			.element(page.getByTitle(/boxing/))
			.toHaveAttribute(
				'style',
				expect.stringContaining('color-mix(in oklch, var(--series-1) 70%, transparent)'),
			);
	});

	it('shows the unplanned tail of the window as free time', async () => {
		render(PlanTimelineBar, {
			...props,
			blocks: [block(1, 'boxing', 0, 6)],
			trailingFreeHours: 2,
		});

		await expect.element(page.getByTitle('Free time — 2h')).toBeInTheDocument();
		await expect.element(page.getByText('free')).toBeInTheDocument();
	});

	// The optimizer's hours rarely sum to the window exactly, and a 1e-12 sliver of
	// "free time" is a segment nobody can see and a tooltip nobody can hit.
	it('ignores a floating-point sliver of free time', async () => {
		render(PlanTimelineBar, {
			...props,
			blocks: [block(1, 'boxing', 0, 8)],
			trailingFreeHours: 1e-9,
		});

		expect(page.getByTitle(/Free time/).elements()).toHaveLength(0);
	});

	// The axis is elapsed hours from the start of the window — "0:00"–"10:00" read as
	// midnight to breakfast, which is not what the model says.
	it('labels the axis with the window as elapsed hours', async () => {
		render(PlanTimelineBar, props);

		await expect
			.element(
				page.getByText('0h', {
					exact: true,
				}),
			)
			.toBeInTheDocument();

		await expect
			.element(
				page.getByText('8h', {
					exact: true,
				}),
			)
			.toBeInTheDocument();
	});
});
