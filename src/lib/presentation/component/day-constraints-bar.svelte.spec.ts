import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DayConstraintsBar from '$lib/presentation/component/day-constraints-bar.svelte';

// Everything else lives in day-constraints-bar.stories.svelte as play functions;
// this rerender-with-unchanged-props sequence cannot be expressed in a story.
describe('day-constraints-bar.svelte', () => {
	// `isOpen` is the day's default, set on the `<details>` at mount: the page re-renders
	// on every keystroke in the budget field — including the one that stops the hours
	// reading 0 — and none of those may move a disclosure the user has closed.
	it('keeps the state the user chose across parent re-renders', async () => {
		const props = {
			availableHours: 6,
			switchCost: 0.25,
			cognitivePool: 4,
			physicalPool: 3,
			fittedCognitivePool: null,
			fittedPhysicalPool: null,
			remainingSuggestedHours: 3.5,
			locale: 'en-US',
			planSlackHours: 0,
			planSwitchHours: 0,
		};

		const { rerender } = render(DayConstraintsBar, {
			...props,
			isOpen: true,
		});

		await page.getByText('Day Setup').click();

		await rerender({
			...props,
			isOpen: true,
		});

		// The header shows in both states, so the element's own attribute is the state.
		await expect
			.element(page.getByText('Day Setup').element().closest('details')!)
			.not.toHaveAttribute('open');
	});
});
