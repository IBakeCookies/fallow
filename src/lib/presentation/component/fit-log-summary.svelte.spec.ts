import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FitLogSummary from '$lib/presentation/component/fit-log-summary.svelte';

describe('fit-log-summary.svelte', () => {
	const props = {
		label: 'Personalized from 3 flow logs',
		count: 3,
		confirmLabel: 'Delete all 3 logs?',
		resetLabel: 'Reset personalization',
		onreset: () => {},
	};

	it('closes an open confirm when the last log goes, so the next log arrives on the trigger', async () => {
		const { rerender } = render(FitLogSummary, props);

		await page
			.getByRole('button', {
				name: 'Reset personalization',
			})
			.click();

		await expect.element(page.getByText('Delete all 3 logs?')).toBeVisible();

		await rerender({
			...props,
			label: 'Model uses default constants',
			count: 0,
		});

		await expect.element(page.getByText('Delete all 3 logs?')).not.toBeInTheDocument();

		await rerender(props);

		await expect.element(page.getByText('Delete all 3 logs?')).not.toBeInTheDocument();

		await expect
			.element(
				page.getByRole('button', {
					name: 'Reset personalization',
				}),
			)
			.toBeVisible();
	});
});
