import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FitRow from '$lib/presentation/component/fit-row.svelte';

describe('fit-row.svelte', () => {
	it('states the fit against the parameter it would replace', async () => {
		render(FitRow, {
			label: 'Cognitive Drain',
			value: '0.42 ± 0.08 (n=7)',
			tone: 'mind',
		});

		await expect.element(page.getByText('Cognitive Drain')).toBeInTheDocument();
		await expect.element(page.getByText('0.42 ± 0.08 (n=7)')).toHaveClass(/text-mind-strong/);
	});

	/* A fit that failed is not a fit of zero: the logs exist but carry no signal for
	   this constant, and printing "0.00" would invite applying it. */
	it('says there is no signal rather than printing a number', async () => {
		render(FitRow, {
			label: 'Recovery Rate',
			value: null,
			tone: 'info',
		});

		await expect.element(page.getByText('no informative ratings')).toHaveClass(/text-ty-silent/);
	});

	// Each capacity keeps its own ink across the app — mind, body, and the neutral one
	it.each([
		['mind', /text-mind-strong/],
		['body', /text-body\/90/],
		['info', /text-info-strong/],
	] as const)('renders the %s tone in its own ink', async (tone, ink) => {
		render(FitRow, {
			label: 'Fitted',
			value: '1.00',
			tone,
		});

		await expect.element(page.getByText('1.00')).toHaveClass(ink);
	});
});
