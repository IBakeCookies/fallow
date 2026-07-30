import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { TrajectoryPoint } from '$lib/business/model/zenith-energy';
import EnergyChart from '$lib/presentation/component/energy-chart.svelte';

const trajectory = (windowHours: number): TrajectoryPoint[] =>
	Array.from(
		{
			length: windowHours * 4 + 1,
		},
		(_, index) => {
			const t = index / 4;

			return {
				t,
				cog: 1 - t / (windowHours * 2),
				phys: 1 - t / (windowHours * 4),
				rate: 0.5,
				taskId: 1,
			};
		},
	);

const props = {
	trajectory: trajectory(10),
	windowHours: 10,
};

const chart = (container: HTMLElement) => container.querySelector('svg')!;

describe('energy-chart.svelte', () => {
	// Both reservoirs are fractions of capacity, so a line's height is a
	// percentage — unlabelled, the only readable axis was time.
	it('labels the energy axis', async () => {
		render(EnergyChart, props);

		for (const label of ['0%', '50%', '100%']) {
			await expect
				.element(
					page.getByText(label, {
						exact: true,
					}),
				)
				.toBeInTheDocument();
		}
	});

	// Hue alone does not separate the two lines on every theme: `terminal` maps
	// --mind and --body to two greens of the same lightness (and --brand, the
	// output fill, to the second of them) because a phosphor CRT is green. The
	// dash is what survives that.
	it('separates the two energy lines by dash as well as colour', () => {
		const { container } = render(EnergyChart, props);

		expect(chart(container).querySelectorAll('path[stroke-dasharray]')).toHaveLength(1);
	});

	// The viewBox is measured in CSS pixels for this: scaling a fixed one to the
	// element width squashed the plot to ~90px tall on a phone, with 4px axis type.
	// Asserting the height alone cannot catch that — 180px is the clamp floor, so it
	// holds either way. The viewBox tracking the rendered width is the fix itself.
	it('keeps one viewBox unit per CSS pixel at a phone width', async () => {
		const { container } = render(EnergyChart, props);

		container.style.width = '360px';

		await vi.waitFor(() => {
			const svg = chart(container);
			const [, , viewBoxWidth] = svg.getAttribute('viewBox')!.split(' ').map(Number);

			expect(viewBoxWidth).toBeCloseTo(svg.getBoundingClientRect().width, 0);
			// The 9px axis type renders at 9px, not at 4.5.
			expect(svg.querySelector('text')!.getBoundingClientRect().height).toBeGreaterThan(7);
		});
	});
});
