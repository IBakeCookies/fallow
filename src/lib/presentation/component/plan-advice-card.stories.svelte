<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import type { AdviceDisplay } from '$lib/presentation/utils/plan-advice-descriptor';
	import PlanAdviceCard from '$lib/presentation/component/plan-advice-card.svelte';

	/* Shaped exactly as `buildAdviceDisplay` returns it: the bands are the
	   presentation policy's output (utils/band.ts), and every number is one the
	   model would have produced by re-solving the day. */
	const advice: AdviceDisplay = {
		unfunded: '2 tasks get no hours in this plan.',
		unfundedMustDo: '1 task stays today but gets no hours — add hours or let it move.',
		marginal: 'The next 15 minutes would go to “Tax return” · +2.4% plan value',
		switchCost:
			'Switching reserves 30m of today, 6% of the budget, at 15m a switch. At no switch cost this plan reads +10.4% plan value; at 30m a switch, −8.7% plan value.',
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
			{
				axis: 'cognitiveLoad',
				label: 'Cognitive Load',
				before: '88%',
				beforeBand: 'critical',
				options: [
					{
						lever: {
							kind: 'defer-task',
							taskId: 2,
							title: 'Migrate the database',
						},
						action: 'Move “Migrate the database” off today',
						after: '41%',
						afterBand: 'success',
						cost: '−18.4% plan value',
						profileFlip: null,
					},
					/* The unpriced lever, always last and costed in hours rather than in
					   plan value: Σ P̄ rises with the budget, so a percentage here would
					   read as the extra hour being free (MATH.md §14.1). */
					{
						lever: {
							kind: 'set-budget',
							hours: 9,
						},
						action: 'Set the budget to 9h',
						after: '78%',
						afterBand: 'warning',
						cost: 'costs an extra hour of your day',
						profileFlip: null,
					},
				],
			},
		],
	};

	/* Two tasks may share a title, so an option's own words are not an identity —
	   two defer levers then read identically and the card has to render both. */
	const sharedTitle: AdviceDisplay = {
		unfunded: null,
		unfundedMustDo: null,
		marginal: 'Another 15 minutes would get nothing more done.',
		switchCost: 'At 15m a switch, this plan pays for no switching.',
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
							title: 'Email',
						},
						action: 'Move “Email” off today',
						after: '54%',
						afterBand: 'warning',
						cost: '−6.2% plan value',
						profileFlip: null,
					},
					{
						lever: {
							kind: 'defer-task',
							taskId: 2,
							title: 'Email',
						},
						action: 'Move “Email” off today',
						after: '61%',
						afterBand: 'warning',
						cost: '−4.1% plan value',
						profileFlip: null,
					},
				],
			},
		],
	};

	const { Story } = defineMeta({
		title: 'Component/Plan Advice Card',
		component: PlanAdviceCard,
		tags: ['autodocs'],
		args: {
			advice,
			isBusy: false,
			isStale: false,
			hasError: false,
			oncheck: fn(),
			onapply: fn(),
		},
	});
</script>

<!-- Before the user asks: the search costs a full solve per candidate, so this
     is one button and no card — a heading over an empty panel is pure vertical
     cost above the plan. -->
<Story
	name="Not calculated yet"
	args={{
		advice: null,
	}}
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.queryByText('Burnout Risk')).not.toBeInTheDocument();
		await expect(canvas.queryByText('Adjust the plan')).not.toBeInTheDocument();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Check my day',
			}),
		);

		await expect(args.oncheck).toHaveBeenCalledOnce();
	}}
/>

<!-- Every option must show the reading it produces AND what it costs — an
     improvement with its price hidden is the advice this feature exists to avoid. -->
<Story
	name="Findings"
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByText('Burnout Risk')).toBeVisible();
		await expect(canvas.getByText('82%')).toBeVisible();
		await expect(canvas.getByText('Move “Tax return” off today')).toBeVisible();
		await expect(canvas.getByText('· −6.2% plan value')).toBeVisible();
		await expect(canvas.getByText('Day Profile → Cruise')).toBeVisible();
		await expect(canvas.getByText('Set the budget to 6.5h')).toBeVisible();
		await expect(canvas.getByText('· costs no plan value')).toBeVisible();

		// The budget's shadow price: the yield side of the same statement the
		// unpriced "+1h" lever below makes only the cost of (MATH.md §14.2).
		await expect(
			canvas.getByText('The next 15 minutes would go to “Tax return” · +2.4% plan value'),
		).toBeVisible();

		// The switch cost's price sits in the same quiet register as the marginal and
		// NOT as a menu row: §14 rules it a measurement of the user, so it must never
		// render as something to apply (MATH.md §14.3). The lever count below is what
		// pins that it added none.
		await expect(
			canvas.getByText(
				'Switching reserves 30m of today, 6% of the budget, at 15m a switch. At no switch cost this plan reads +10.4% plan value; at 30m a switch, −8.7% plan value.',
			),
		).toHaveClass('text-ty-silent');

		// A band is otherwise carried by colour alone (WCAG 1.4.1): both readings
		// are critical, and three of the four afters read caution.
		expect(canvas.getAllByText('(Critical)')).toHaveLength(2);
		expect(canvas.getAllByText('(Caution)')).toHaveLength(3);

		// The must-do line is louder than the plain unfunded one on purpose: the
		// flag removed that task's only per-task lever, so the menu below cannot
		// offer to resolve it and the user has to.
		await expect(canvas.getByText('2 tasks get no hours in this plan.')).toHaveClass(
			'text-ty-secondary',
		);

		await expect(
			canvas.getByText('1 task stays today but gets no hours — add hours or let it move.'),
		).toHaveClass('text-warning-strong');

		// Only a deferral is performable — the budget lever is a slider the user
		// already owns — and the button must say which task it moves.
		expect(
			canvas.getAllByRole('button', {
				name: /to tomorrow/i,
			}),
		).toHaveLength(2);

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Move “Tax return” to tomorrow',
			}),
		);

		await expect(args.onapply).toHaveBeenCalledOnce();
		await expect(args.onapply).toHaveBeenCalledWith(1);
	}}
/>

<!-- A second request is blocked while the search is running. -->
<Story
	name="Solving"
	args={{
		advice: null,
		isBusy: true,
	}}
	play={async ({ canvas }) => {
		await expect(
			canvas.getByRole('button', {
				name: 'Solving…',
			}),
		).toBeDisabled();
	}}
/>

<!-- The day was edited after the advice was calculated. -->
<Story
	name="Stale"
	args={{
		isStale: true,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('Your day has changed since this was calculated.')).toBeVisible();

		await expect(
			canvas.getByRole('button', {
				name: 'Recheck',
			}),
		).toBeEnabled();
	}}
/>

<!-- The last check threw; the advice shown predates the failure. -->
<Story
	name="Error"
	args={{
		hasError: true,
	}}
/>

<Story
	name="Nothing to fix"
	args={{
		advice: {
			rows: [],
			unfunded: null,
			unfundedMustDo: null,
			marginal: 'Another 15 minutes would get nothing more done.',
			switchCost: 'At 15m a switch, this plan pays for no switching.',
		},
	}}
	play={async ({ canvas }) => {
		await expect(
			canvas.getByText('Nothing reads badly enough to act on. This day is fine.'),
		).toBeVisible();

		// The shadow price is a reading, not a finding: a day with nothing to fix
		// still answers what the next block would buy (MATH.md §14.2).
		await expect(canvas.getByText('Another 15 minutes would get nothing more done.')).toBeVisible();
	}}
/>

<!-- Identical words, distinct levers: the card renders both and applies each by
     its task id. -->
<Story
	name="Two tasks share a title"
	args={{
		advice: sharedTitle,
	}}
	play={async ({ args, canvas, userEvent }) => {
		const applies = canvas.getAllByRole('button', {
			name: 'Move “Email” to tomorrow',
		});

		expect(applies).toHaveLength(2);

		await userEvent.click(applies[1]);
		await expect(args.onapply).toHaveBeenCalledOnce();
		await expect(args.onapply).toHaveBeenCalledWith(2);
	}}
/>

<!-- Unfunded is a read, not a band: every axis can be in band (`rows: []`) while
     work still gets no hours — and "this day is fine" printed under that negates it. -->
<Story
	name="Only an unfunded read"
	args={{
		advice: {
			rows: [],
			unfunded: '2 tasks get no hours in this plan.',
			unfundedMustDo: null,
			marginal: 'The next 15 minutes would go to “Tax return” · +2.4% plan value',
			switchCost:
				'Switching reserves 30m of today, 6% of the budget, at 15m a switch. At no switch cost this plan reads +10.4% plan value; at 30m a switch, −8.7% plan value.',
		},
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('2 tasks get no hours in this plan.')).toBeVisible();

		await expect(
			canvas.queryByText(/Nothing reads badly enough to act on/),
		).not.toBeInTheDocument();
	}}
/>

<!-- Each read alone, because the gate must check both: a day whose only unfunded
     task is pinned reports nothing in `unfunded`. -->
<Story
	name="Only a pinned unfunded read"
	args={{
		advice: {
			rows: [],
			unfunded: null,
			unfundedMustDo: '1 task stays today but gets no hours — add hours or let it move.',
			marginal: 'The next 15 minutes would go to “Tax return” · +2.4% plan value',
			switchCost:
				'Switching reserves 30m of today, 6% of the budget, at 15m a switch. At no switch cost this plan reads +10.4% plan value; at 30m a switch, −8.7% plan value.',
		},
	}}
	play={async ({ canvas }) => {
		await expect(
			canvas.getByText('1 task stays today but gets no hours — add hours or let it move.'),
		).toBeVisible();

		await expect(
			canvas.queryByText(/Nothing reads badly enough to act on/),
		).not.toBeInTheDocument();
	}}
/>
