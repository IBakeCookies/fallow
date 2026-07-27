import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Metric } from '$lib/presentation/type';
import { STATUS } from '$lib/presentation/utils/status';
import MetricsDashboard from './metrics-dashboard.svelte';

const metric = (label: string, value: string): Metric => ({
	label,
	value,
	description: `${label} description`,
	valStyle: ''
});

describe('metrics-dashboard.svelte', () => {
	it('renders each metric label and value', async () => {
		render(MetricsDashboard, {
			metrics: [metric('Yield Index', '82%'), metric('Flow Coverage', '3/4')],
			momentum: null
		});

		await expect.element(page.getByText('Yield Index')).toBeInTheDocument();
		await expect.element(page.getByText('82%')).toBeInTheDocument();
		await expect.element(page.getByText('Flow Coverage')).toBeInTheDocument();
		await expect.element(page.getByText('3/4')).toBeInTheDocument();
	});

	it('carries a judged band in text as well as colour', async () => {
		render(MetricsDashboard, {
			metrics: [
				{ ...metric('Burnout Risk', '80%'), valStyle: STATUS.CRITICAL.color },
				{ ...metric('Yield Index', '60%'), valStyle: STATUS.NEUTRAL.color }
			],
			momentum: null
		});

		await expect.element(page.getByText('(Critical)')).toBeInTheDocument();
		// The neutral band is the default value colour and carries no judgement
		expect(page.getByText('(Nominal)').elements()).toHaveLength(0);
	});

	it.each([
		[null, 'N/A'],
		[0.5, 'Upward'],
		[-0.5, 'Reset Reqd'],
		[0, 'Stable']
	])('momentum %s shows badge "%s"', async (momentum, label) => {
		render(MetricsDashboard, { metrics: [], momentum });

		await expect.element(page.getByText(label, { exact: true })).toBeInTheDocument();
	});
});
