import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { EvaluatedBlock } from '$lib/business/model/zenith-energy';
import PlanScheduleList from '$lib/presentation/component/plan-schedule-list.svelte';
import { seriesColors } from '$lib/presentation/utils/series-color';

const block = (
	taskId: number | null,
	title: string,
	start: number,
	hours: number,
	output = 0,
): EvaluatedBlock => ({
	taskId,
	title,
	start,
	hours,
	output,
	cogAfter: 0.6,
	physAfter: 0.7,
});

const props = {
	blocks: [
		block(1, 'boxing', 0, 3, 4.5),
		block(null, 'rest', 3, 1),
		block(2, 'writing', 4, 4, 6.25),
	],
	windowHours: 8,
	trailingFreeHours: 0,
	plannedHours: 8,
	colors: seriesColors([1, 2]),
	locale: 'en-US',
};

describe('plan-schedule-list.svelte', () => {
	// Offsets, not wall-clock times: the model has no notion of when the day begins
	it('lists every block with its offsets and length', async () => {
		render(PlanScheduleList, props);

		await expect.element(page.getByText('0h–3h')).toBeInTheDocument();
		await expect.element(page.getByText('4h–8h')).toBeInTheDocument();

		await expect
			.element(
				page.getByText('3h', {
					exact: true,
				}),
			)
			.toBeInTheDocument();
	});

	it('reports each task block’s output to two places', async () => {
		render(PlanScheduleList, props);

		await expect.element(page.getByText('4.50 out')).toBeInTheDocument();
		await expect.element(page.getByText('6.25 out')).toBeInTheDocument();
	});

	// The decimal separator follows the reader, like every date beside it
	it('formats the output for a German reader with a decimal comma', async () => {
		render(PlanScheduleList, {
			...props,
			locale: 'de-DE',
		});

		await expect.element(page.getByText('4,50 out')).toBeInTheDocument();
	});

	// Rest earns no output: it is what makes the next block's output possible, which the
	// column cannot say as a number.
	it('names rest instead of printing an output for it', async () => {
		render(PlanScheduleList, props);

		await expect.element(page.getByText('recovery')).toBeInTheDocument();
	});

	// The tail starts where the plan stopped, not where the last block ended — the two
	// differ whenever the optimizer leaves a gap it did not schedule rest into.
	it('closes the day with the free time the plan left', async () => {
		render(PlanScheduleList, {
			...props,
			blocks: [block(1, 'boxing', 0, 5, 7)],
			plannedHours: 5,
			trailingFreeHours: 3,
		});

		await expect.element(page.getByText('5h–8h')).toBeInTheDocument();
		await expect.element(page.getByText('Free time')).toBeInTheDocument();
	});

	it('ignores a floating-point sliver of free time', async () => {
		render(PlanScheduleList, {
			...props,
			trailingFreeHours: 1e-9,
		});

		expect(page.getByText('Free time').elements()).toHaveLength(0);
	});

	/* An empty plan is a statement about the parameters, not an empty list: with free
	   time valued above every task's output, the optimizer schedules nothing at all. */
	it('explains an empty plan instead of rendering an empty list', async () => {
		render(PlanScheduleList, {
			...props,
			blocks: [],
		});

		await expect.element(page.getByText(/Nothing scheduled/)).toBeInTheDocument();
		expect(page.getByRole('listitem').elements()).toHaveLength(0);
	});
});
