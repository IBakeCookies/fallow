import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NumberInput from './number-input.svelte';

describe('number-input.svelte', () => {
	it('steps the value through named stepper buttons', async () => {
		const onchange = vi.fn();

		render(NumberInput, {
			value: 6,
			onchange,
			min: 0,
			max: 24,
			step: 0.5,
		});

		// The component is controlled, so both steps start from the same value
		await page
			.getByRole('button', {
				name: 'Increase',
			})
			.click();

		expect(onchange).toHaveBeenCalledExactlyOnceWith(6.5);

		await page
			.getByRole('button', {
				name: 'Decrease',
			})
			.click();

		expect(onchange).toHaveBeenLastCalledWith(5.5);
	});
});
