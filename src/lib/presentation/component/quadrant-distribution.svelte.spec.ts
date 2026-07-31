import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QuadrantDistribution from '$lib/presentation/component/quadrant-distribution.svelte';

const segments = () => [...document.querySelectorAll<HTMLDivElement>('div[title]')];

describe('quadrant-distribution.svelte', () => {
	it('lists every profile in the legend, including the ones with no days', async () => {
		render(QuadrantDistribution, {
			counts: {
				flow: 7,
				cruise: 0,
				grind: 0,
				routine: 0,
			},
			total: 7,
		});

		for (const label of ['Flow Zone', 'Cruise', 'Grind Mode', 'Routine']) {
			await expect
				.element(
					page.getByText(label, {
						exact: true,
					}),
				)
				.toBeInTheDocument();
		}
	});

	// A zero-width segment is invisible but still a hover target, so the bar only
	// carries the profiles that actually happened.
	it('gives the bar a segment only for a profile with days', async () => {
		render(QuadrantDistribution, {
			counts: {
				flow: 6,
				cruise: 0,
				grind: 2,
				routine: 0,
			},
			total: 8,
		});

		expect(segments()).toHaveLength(2);
		expect(segments().map((segment) => segment.style.width)).toEqual(['75%', '25%']);
	});

	it('titles each segment with its share of the range', async () => {
		render(QuadrantDistribution, {
			counts: {
				flow: 3,
				cruise: 1,
				grind: 0,
				routine: 0,
			},
			total: 4,
		});

		expect(segments().map((segment) => segment.getAttribute('title'))).toEqual([
			'Flow Zone: 3 days',
			'Cruise: 1 day',
		]);
	});

	// Nothing profiled yet: no segment may reach the `/ total` division, which would
	// otherwise render `width: NaN%`.
	it('draws an empty bar rather than a NaN width when no day has a profile', async () => {
		render(QuadrantDistribution, {
			counts: {
				flow: 0,
				cruise: 0,
				grind: 0,
				routine: 0,
			},
			total: 0,
		});

		expect(segments()).toHaveLength(0);

		await expect
			.element(
				page.getByText('Flow Zone', {
					exact: true,
				}),
			)
			.toBeInTheDocument();
	});
});
