import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PlanSummary from '$lib/presentation/component/plan-summary.svelte';

const props = {
	totalOutput: '12.4',
	endCog: 0.42,
	endPhys: 0.71,
	workHours: 5.25,
	outputVsClassic: 8,
};

describe('plan-summary.svelte', () => {
	it('reports the objective the plan was optimized for', async () => {
		render(PlanSummary, props);

		await expect.element(page.getByText('12.4')).toBeInTheDocument();
		await expect.element(page.getByText('42% / 71%')).toBeInTheDocument();
		await expect.element(page.getByText('5h 15m')).toBeInTheDocument();
	});

	// Beating the classic plan and losing to it are different readings, and the sign is
	// the fastest way to tell them apart — hence the colour and the explicit '+'.
	it.each([
		[8, '+8%', /text-success/],
		[-3, '-3%', /text-warning/],
	])('renders a %i%% difference as %s', async (outputVsClassic, label, ink) => {
		render(PlanSummary, {
			...props,
			outputVsClassic,
		});

		await expect.element(page.getByText(label)).toHaveClass(ink);
	});

	// No rival plan is not "0% better" — the classic allocator needs a plan of its own
	// before the comparison means anything.
	it('says there is nothing to compare against rather than showing a zero', async () => {
		render(PlanSummary, {
			...props,
			outputVsClassic: null,
		});

		await expect.element(page.getByText('—')).toBeInTheDocument();
		await expect.element(page.getByText('No classic plan to compare')).toBeInTheDocument();
	});

	/* The e2e reads this tile by preceding sibling, so the value must stay the label's
	   previous element — a wrapper around either one breaks it silently. */
	it('keeps the value directly before its label', async () => {
		render(PlanSummary, props);

		const label = page.getByText('Output vs the classic plan, judged by this model').element();

		expect(label.previousElementSibling?.textContent?.trim()).toBe('+8%');
	});
});
