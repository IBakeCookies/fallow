import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ParamRow from '$lib/presentation/component/param-row.svelte';

const props = {
	id: 'alpha-cog',
	label: 'Cognitive Drain',
	hint: 'How fast focused work spends your mind',
	value: 0.4,
	min: 0.05,
	max: 2,
	step: 0.05,
	unit: '/h',
	onchange: vi.fn(),
};

describe('param-row.svelte', () => {
	// The label names the stepper, which is how both the e2e and a screen reader find a
	// parameter — none of these names mean anything on their own.
	it('ties its label to the stepper', async () => {
		render(ParamRow, props);

		await expect.element(page.getByLabelText('Cognitive Drain')).toHaveValue(0.4);
	});

	// The hint is the whole reason the row exists rather than a bare number field, and
	// the dotted underline is what says it is there.
	it('advertises the explanation on the label', async () => {
		render(ParamRow, props);

		await expect.element(page.getByText('Cognitive Drain')).toHaveClass(/cursor-help/);
	});

	it('reports a stepped value in the parameter’s own increments', async () => {
		const onchange = vi.fn();

		render(ParamRow, {
			...props,
			onchange,
		});

		await page
			.getByRole('button', {
				name: 'Increase',
			})
			.click();

		expect(onchange).toHaveBeenCalledExactlyOnceWith(0.45);
	});
});
