import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ChartPoint } from '$lib/presentation/utils/completion-chart-points';
import CompletionBarChart from '$lib/presentation/component/completion-bar-chart.svelte';

const point = (label: string, value: number | null, showLabel = true): ChartPoint => ({
	label,
	full: `${label}, Jul`,
	value,
	sub: value === null ? 'no data' : '2/4 tasks done',
	showLabel,
});

const ariaLabel = 'Completion rate over the last 7 days';
const bars = () => document.querySelectorAll('path.fill-brand');
const slots = () => document.querySelectorAll('rect');

describe('completion-bar-chart.svelte', () => {
	it('names the plot, which an <svg role="img"> has no other way to do', async () => {
		render(CompletionBarChart, {
			points: [point('Mon', 60)],
			ariaLabel,
		});

		await expect
			.element(
				page.getByRole('img', {
					name: ariaLabel,
				}),
			)
			.toBeInTheDocument();
	});

	// The distinction the whole chart turns on: a planned day that went nowhere
	// keeps a 2px stub, an unrecorded day draws nothing at all.
	it('draws a bar for a 0% day and none for a day with no data', async () => {
		render(CompletionBarChart, {
			points: [point('Mon', 0), point('Tue', null)],
			ariaLabel,
		});

		expect(bars()).toHaveLength(1);

		// innerH is 202, so a 2px stub sits on a baseline at 12 + 202 = 214
		const baseline = bars()[0]
			.getAttribute('d')
			?.match(/^M[\d.]+,([\d.]+)/)?.[1];

		expect(Number(baseline)).toBeCloseTo(214, 0);
	});

	// Every slot is hoverable across the full plot height, so a 4px bar in the month
	// view still has a tooltip target — that rect exists even where the bar does not.
	it('gives every slot a full-height hover target, data or not', async () => {
		render(CompletionBarChart, {
			points: [point('Mon', 60), point('Tue', null), point('Wed', 30)],
			ariaLabel,
		});

		expect(slots()).toHaveLength(3);
		expect(slots()[0].getAttribute('height')).toBe('202');
	});

	it('says "no data" in the tooltip of an unrecorded slot, and the rate otherwise', async () => {
		render(CompletionBarChart, {
			points: [point('Mon', 60), point('Tue', null)],
			ariaLabel,
		});

		const titles = [...slots()].map((slot) => slot.querySelector('title')?.textContent);

		expect(titles[0]).toBe('Mon, Jul — 60% · 2/4 tasks done');
		expect(titles[1]).toBe('Tue, Jul — no data');
	});

	it('prints only the labels the axis asked for', async () => {
		render(CompletionBarChart, {
			points: [point('Mon', 60), point('Tue', 40, false), point('Wed', 30)],
			ariaLabel,
		});

		const labels = [...document.querySelectorAll('text')].map((node) => node.textContent?.trim());

		expect(labels).toContain('Mon');
		expect(labels).toContain('Wed');
		expect(labels).not.toContain('Tue');
	});

	// A range that has not resolved yet must read as an empty plot, not a broken
	// one: the percentage axis stays.
	it('keeps the axis with no slots at all', async () => {
		render(CompletionBarChart, {
			points: [],
			ariaLabel,
		});

		expect(bars()).toHaveLength(0);
		expect(slots()).toHaveLength(0);

		const ticks = [...document.querySelectorAll('text')].map((node) => node.textContent?.trim());

		expect(ticks).toEqual(['0', '25', '50', '75', '100']);
	});
});
