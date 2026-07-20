import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimeBudgetCard from './time-budget-card.svelte';

const props = {
	availableHours: 6,
	switchCost: 0.25,
	cognitivePool: 4,
	physicalPool: 3,
	remainingSuggestedHours: '3.50',
	planSlackHours: 0
};

describe('time-budget-card.svelte', () => {
	it('collapsed, shows the one-line summary', async () => {
		render(TimeBudgetCard, { ...props, planSlackHours: 1.25, startOpen: false });

		await expect
			.element(page.getByText('6h budget · 3.50h planned · 1.25h free'))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: /Time Budget/ }))
			.toHaveAttribute('aria-expanded', 'false');
	});

	it('omits the slack summary when the plan fills the budget', async () => {
		render(TimeBudgetCard, { ...props, startOpen: false });

		await expect.element(page.getByText('6h budget · 3.50h planned')).toBeInTheDocument();
	});

	it('expanded, shows all four inputs with switch cost in minutes', async () => {
		render(TimeBudgetCard, props);

		await expect.element(page.getByLabelText('Available Hours')).toHaveValue(6);
		await expect.element(page.getByLabelText('Switch Cost (per task change)')).toHaveValue(15);
		await expect.element(page.getByLabelText('Cognitive Capacity')).toHaveValue(4);
		await expect.element(page.getByLabelText('Physical Capacity')).toHaveValue(3);
		await expect.element(page.getByText('Allocated: 3.50h')).toBeInTheDocument();
	});

	it('stepping switch cost converts minutes back to hours', async () => {
		render(TimeBudgetCard, props);

		// second "Increase" stepper belongs to switch cost: 15 min → 20 min = 1/3 h
		await page.getByRole('button', { name: 'Increase' }).nth(1).click();

		await expect.element(page.getByLabelText('Switch Cost (per task change)')).toHaveValue(20);
	});
});
