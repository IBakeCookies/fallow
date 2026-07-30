import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { AdviceDisplay } from '$lib/presentation/utils/plan-advice-descriptor';
import PlanAdviceCard from '$lib/presentation/component/plan-advice-card.svelte';

const UNFUNDED = '3 tasks get no hours in this plan.';
const UNFUNDED_MUST_DO = '1 task stays today but gets no hours — add hours or let it move.';

const display: AdviceDisplay = {
	unfunded: '2 tasks get no hours in this plan.',
	unfundedMustDo: '1 task stays today but gets no hours — add hours or let it move.',
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
			isBusy: false,
			isStale: false,
			hasError: false,
			oncheck,
			onapply: () => {},
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
			isBusy: true,
			isStale: false,
			hasError: false,
			oncheck: () => {},
			onapply: () => {},
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
			isBusy: false,
			isStale: false,
			hasError: false,
			oncheck: () => {},
			onapply: () => {},
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
			isBusy: false,
			isStale: false,
			hasError: false,
			oncheck: () => {},
			onapply: () => {},
		});

		// The row's own reading, plus one per option: 82% critical, both afters caution.
		await expect.element(page.getByText('(Critical)')).toBeInTheDocument();
		expect(page.getByText('(Caution)').elements()).toHaveLength(2);
	});

	it('warns that the advice describes an older version of the day', async () => {
		render(PlanAdviceCard, {
			advice: display,
			isBusy: false,
			isStale: true,
			hasError: false,
			oncheck: () => {},
			onapply: () => {},
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

	// Only a deferral is performable: the budget lever is a slider the user
	// already owns, and the button must say which task it moves (the visible
	// "To tomorrow" alone would leave N identical buttons).
	it('applies a deferral with its task id, and only offers apply for deferrals', async () => {
		const onapply = vi.fn();

		render(PlanAdviceCard, {
			advice: display,
			isBusy: false,
			isStale: false,
			hasError: false,
			oncheck: () => {},
			onapply,
		});

		expect(
			page
				.getByRole('button', {
					name: /to tomorrow/i,
				})
				.elements(),
		).toHaveLength(1);

		await page
			.getByRole('button', {
				name: 'Move “Tax return” to tomorrow',
			})
			.click();

		expect(onapply).toHaveBeenCalledExactlyOnceWith(1);
	});

	// Two tasks may share a title, so an option's own words are not an identity —
	// two defer levers then read identically and the card has to render both.
	it('renders both options when two tasks share a title', async () => {
		const onapply = vi.fn();
		const [row] = display.rows;
		const [defer] = row.options;

		render(PlanAdviceCard, {
			advice: {
				rows: [
					{
						...row,
						options: [1, 2].map((taskId) => ({
							...defer,
							lever: {
								kind: 'defer-task' as const,
								taskId,
								title: 'Email',
							},
							action: 'Move “Email” off today',
						})),
					},
				],
				unfunded: null,
				unfundedMustDo: null,
			},
			isBusy: false,
			isStale: false,
			hasError: false,
			oncheck: () => {},
			onapply,
		});

		const applies = page.getByRole('button', {
			name: 'Move “Email” to tomorrow',
		});

		expect(applies.elements()).toHaveLength(2);

		await applies.nth(1).click();

		expect(onapply).toHaveBeenCalledExactlyOnceWith(2);
	});

	// The must-do line is louder than the plain unfunded one above it on purpose:
	// the flag removed that task's only per-task lever, so the menu below cannot
	// offer to resolve it and the user has to.
	it('renders an unfunded must-do louder than a plain unfunded read', async () => {
		render(PlanAdviceCard, {
			advice: {
				rows: [],
				unfunded: UNFUNDED,
				unfundedMustDo: UNFUNDED_MUST_DO,
			},
			isBusy: false,
			isStale: false,
			hasError: false,
			oncheck: () => {},
			onapply: () => {},
		});

		await expect.element(page.getByText(UNFUNDED_MUST_DO)).toHaveClass(/text-warning-strong/);
		await expect.element(page.getByText(UNFUNDED)).toHaveClass(/text-ty-secondary/);
	});

	// Unfunded is a read, not a band, so every axis can be in band (`rows: []`)
	// while work still gets no hours — and "this day is fine" printed under that
	// negates it. Each read ALONE, because the gate must check both: a day whose
	// only unfunded task is pinned reports nothing in `unfunded`.
	it.each([
		{
			label: 'a plain unfunded read',
			text: UNFUNDED,
			advice: {
				rows: [],
				unfunded: UNFUNDED,
				unfundedMustDo: null,
			},
		},
		{
			label: 'a pinned one',
			text: UNFUNDED_MUST_DO,
			advice: {
				rows: [],
				unfunded: null,
				unfundedMustDo: UNFUNDED_MUST_DO,
			},
		},
	])('never calls the day fine under $label', ({ text, advice }) => {
		render(PlanAdviceCard, {
			advice,
			isBusy: false,
			isStale: false,
			hasError: false,
			oncheck: () => {},
			onapply: () => {},
		});

		expect(document.body.textContent).toContain(text);
		expect(document.body.textContent).not.toContain('Nothing reads badly enough to act on');
	});

	it('says so plainly when nothing is out of band', async () => {
		render(PlanAdviceCard, {
			advice: {
				rows: [],
				unfunded: null,
				unfundedMustDo: null,
			},
			isBusy: false,
			isStale: false,
			hasError: false,
			oncheck: () => {},
			onapply: () => {},
		});

		await expect
			.element(page.getByText('Nothing reads badly enough to act on. This day is fine.'))
			.toBeInTheDocument();
	});
});
