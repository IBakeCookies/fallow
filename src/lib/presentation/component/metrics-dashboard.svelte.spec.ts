import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Metric } from '$lib/presentation/type';
import { STATUS } from '$lib/presentation/utils/status';
import MetricsDashboard from '$lib/presentation/component/metrics-dashboard.svelte';

const metric = (label: string, value: string): Metric => ({
	label,
	value,
	description: `${label} description`,
	valStyle: '',
});

describe('metrics-dashboard.svelte', () => {
	// Headline readings are the four the app is for; the other nineteen are
	// reference. Twenty-three rows of equal weight buries the four.
	it('shows headline readings immediately and the rest behind the disclosure', async () => {
		render(MetricsDashboard, {
			metrics: [
				{
					...metric('Fallow Gain', '+18%'),
					headline: true,
				},
				metric('Yield Index', '82%'),
				metric('Flow Coverage', '3/4'),
			],
			momentum: null,
		});

		await expect.element(page.getByText('Fallow Gain')).toBeInTheDocument();
		await expect.element(page.getByText('+18%')).toBeInTheDocument();

		// closed: the reference rows are served (crawlable, findable) but not shown
		expect(document.querySelector('details')!.open).toBe(false);
		await expect.element(page.getByText('82%')).not.toBeVisible();

		await page
			.getByText('All 2 metrics', {
				exact: true,
			})
			.click();

		await expect.element(page.getByText('Yield Index')).toBeVisible();
		await expect.element(page.getByText('82%')).toBeVisible();
		await expect.element(page.getByText('Flow Coverage')).toBeVisible();
		await expect.element(page.getByText('3/4')).toBeVisible();
	});

	it('omits the disclosure entirely when every metric is a headline', async () => {
		render(MetricsDashboard, {
			metrics: [
				{
					...metric('Fallow Gain', '+18%'),
					headline: true,
				},
			],
			momentum: null,
		});

		await expect.element(page.getByText('+18%')).toBeInTheDocument();
		expect(document.querySelector('details')).toBeNull();
	});

	it('carries a judged band in text as well as colour', async () => {
		render(MetricsDashboard, {
			metrics: [
				{
					...metric('Burnout Risk', '80%'),
					headline: true,
					valStyle: STATUS.CRITICAL.color,
				},
				{
					...metric('Yield Index', '60%'),
					headline: true,
					valStyle: STATUS.NEUTRAL.color,
				},
			],
			momentum: null,
		});

		await expect.element(page.getByText('(Critical)')).toBeInTheDocument();
		// The neutral band is the default value colour and carries no judgement
		expect(page.getByText('(Nominal)').elements()).toHaveLength(0);
	});

	it.each([
		[null, 'N/A'],
		[0.5, 'Upward'],
		[-0.5, 'Reset Reqd'],
		[0, 'Stable'],
	])('momentum %s shows badge "%s"', async (momentum, label) => {
		render(MetricsDashboard, {
			metrics: [],
			momentum,
		});

		await expect
			.element(
				page.getByText(label, {
					exact: true,
				}),
			)
			.toBeInTheDocument();
	});
});
