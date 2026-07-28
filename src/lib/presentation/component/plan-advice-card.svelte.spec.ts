import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { AdviceDisplay } from '$lib/presentation/utils/plan-advice-descriptor';
import PlanAdviceCard from '$lib/presentation/component/plan-advice-card.svelte';

const display: AdviceDisplay = {
	unfunded: '2 tasks get no hours in this plan.',
	rows: [
		{
			axis: 'burnoutRisk',
			label: 'Burnout Risk',
			before: '82%',
			beforeBand: 'critical',
			options: [
				{
					lever: {
						kind: 'defer-task',
						taskId: 1,
						title: 'Tax return',
					},
					action: 'Move “Tax return” off today',
					after: '54%',
					afterBand: 'warning',
					cost: '−6.2% plan value',
					profileFlip: 'Day Profile → Cruise',
				},
				{
					lever: {
						kind: 'set-budget',
						hours: 6.5,
					},
					action: 'Set the budget to 6.5h',
					after: '71%',
					afterBand: 'warning',
					cost: 'costs no plan value',
					profileFlip: null,
				},
			],
		},
	],
};

describe('plan-advice-card.svelte', () => {
	it('offers to check the day and reports nothing until asked', async () => {
		const oncheck = vi.fn();

		render(PlanAdviceCard, {
			advice: null,
			busy: false,
			stale: false,
			oncheck,
		});

		expect(document.body.textContent).not.toContain('Burnout Risk');
		// Until it has run, this is one button and no card: a heading and a
		// description advertising an empty panel is pure vertical cost above the plan.
		expect(document.body.textContent).not.toContain('Adjust the plan');

		await page
			.getByRole('button', {
				name: 'Check my day',
			})
			.click();

		expect(oncheck).toHaveBeenCalledOnce();
	});

	it('blocks a second request while the search is running', async () => {
		render(PlanAdviceCard, {
			advice: null,
			busy: true,
			stale: false,
			oncheck: () => {},
		});

		await expect
			.element(
				page.getByRole('button', {
					name: 'Solving…',
				}),
			)
			.toBeDisabled();
	});

	// Each option must show the reading it produces AND what it costs: an
	// improvement with its price hidden is the advice this feature exists to avoid.
	it('shows every option with its resulting reading and its cost', async () => {
		render(PlanAdviceCard, {
			advice: display,
			busy: false,
			stale: false,
			oncheck: () => {},
		});

		await expect.element(page.getByText('Burnout Risk')).toBeInTheDocument();
		await expect.element(page.getByText('82%')).toBeInTheDocument();
		await expect.element(page.getByText('Move “Tax return” off today')).toBeInTheDocument();
		await expect.element(page.getByText('· −6.2% plan value')).toBeInTheDocument();
		await expect.element(page.getByText('Day Profile → Cruise')).toBeInTheDocument();
		await expect.element(page.getByText('Set the budget to 6.5h')).toBeInTheDocument();
		await expect.element(page.getByText('· costs no plan value')).toBeInTheDocument();
		await expect.element(page.getByText('2 tasks get no hours in this plan.')).toBeInTheDocument();
	});

	// A band is otherwise carried by colour alone (WCAG 1.4.1) — the same reason
	// the metrics dashboard renders this text.
	it('carries every reading’s band in text as well as colour', async () => {
		render(PlanAdviceCard, {
			advice: display,
			busy: false,
			stale: false,
			oncheck: () => {},
		});

		// The row's own reading, plus one per option: 82% critical, both afters caution.
		await expect.element(page.getByText('(Critical)')).toBeInTheDocument();
		expect(page.getByText('(Caution)').elements()).toHaveLength(2);
	});

	it('warns that the advice describes an older version of the day', async () => {
		render(PlanAdviceCard, {
			advice: display,
			busy: false,
			stale: true,
			oncheck: () => {},
		});

		await expect
			.element(page.getByText('Your day has changed since this was calculated.'))
			.toBeInTheDocument();

		await expect
			.element(
				page.getByRole('button', {
					name: 'Recheck',
				}),
			)
			.toBeEnabled();
	});

	it('says so plainly when nothing is out of band', async () => {
		render(PlanAdviceCard, {
			advice: {
				rows: [],
				unfunded: null,
			},
			busy: false,
			stale: false,
			oncheck: () => {},
		});

		await expect
			.element(page.getByText('Nothing reads badly enough to act on. This day is fine.'))
			.toBeInTheDocument();
	});
});
