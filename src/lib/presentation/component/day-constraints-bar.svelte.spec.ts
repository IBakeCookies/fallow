import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DayConstraintsBar from '$lib/presentation/component/day-constraints-bar.svelte';

// Everything else lives in day-constraints-bar.stories.svelte as play functions;
// this rerender-with-unchanged-props sequence cannot be expressed in a story.
describe('day-constraints-bar.svelte', () => {
	// `isOpen` is the day's default, sampled at mount: the page re-renders on every
	// keystroke in the budget field — including the one that stops the hours reading 0 —
	// and none of those may move a disclosure the user has set.
	it('keeps the state the user chose across parent re-renders', async () => {
		const props = {
			availableHours: 6,
			switchCost: 0.25,
			cognitivePool: 4,
			physicalPool: 3,
			remainingSuggestedHours: '3.50',
			planSlackHours: 0,
		};

		const { rerender } = render(DayConstraintsBar, {
			...props,
			isOpen: true,
		});

		await page
			.getByRole('button', {
				name: /Time Budget/,
			})
			.click();

		await rerender({
			...props,
			isOpen: true,
		});

		await expect
			.element(
				page.getByRole('button', {
					name: /Time Budget/,
				}),
			)
			.toHaveAttribute('aria-expanded', 'false');
	});
});
