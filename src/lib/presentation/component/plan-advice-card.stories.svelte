<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import type { AdviceDisplay } from '$lib/presentation/utils/plan-advice-descriptor';
	import PlanAdviceCard from '$lib/presentation/component/plan-advice-card.svelte';

	/* Shaped exactly as `buildAdviceDisplay` returns it: the bands are the
	   presentation policy's output (utils/band.ts), and every number is one the
	   model would have produced by re-solving the day. */
	const advice: AdviceDisplay = {
		unfunded: [
			'“Inbox zero” gets no hours — dropping “Tax return” would fund it.',
			'“Repaint the shed” gets no hours — your Physical pool is full.',
		],
		unfundedMustDo: ['“Renew the passport” gets no hours, and nothing on offer today reaches it.'],
		marginal: 'The next 15 minutes would go to “Tax return” · +2.4% plan value',
		switchCost:
			'Switching reserves 30m of today, 6% of the budget, at 15m a switch. Re-solved with no switch cost, your day comes out at +10.4% plan value; at 30m a switch, −8.7% plan value.',
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
						applyLabel: null,
						isUnpriced: false,
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
						applyLabel: 'Set 6.5h',
						isUnpriced: false,
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
						applyLabel: null,
						isUnpriced: false,
					},
					/* The unpriced lever, always last and costed in hours rather than in
					   plan value: Σ P̄ rises with the budget, so a percentage here would
					   read as the extra hour being free. */
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
						applyLabel: 'Add the hour',
						isUnpriced: true,
					},
				],
			},
		],
	};

	/* Two tasks may share a title, so an option's own words are not an identity —
	   the card has to render both defer levers, and both unfunded lines. */
	const sharedTitle: AdviceDisplay = {
		unfunded: [
			'“Email” gets no hours, and nothing on offer today reaches it.',
			'“Email” gets no hours, and nothing on offer today reaches it.',
		],
		unfundedMustDo: [],
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
						applyLabel: null,
						isUnpriced: false,
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
						applyLabel: null,
						isUnpriced: false,
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
			/* One reading for the card, not one per lever: every defer below sends the
			   task to the same day (ROADMAP item 21). */
			destination: 'Tomorrow: 4 tasks, 6h to spend — 3 of them funded.',
			isBusy: false,
			isStale: false,
			hasError: false,
			oncheck: fn(),
			onapply: fn(),
			onapplybudget: fn(),
		},
	});
</script>

<Story
	name="Not calculated yet"
	args={{
		advice: null,
	}}
	play={async ({ args, canvas, userEvent }) => {
		// The search costs a full solve per candidate, so the reading waits, not the card.
		await expect(canvas.getByText('Adjust the plan')).toBeVisible();
		await expect(canvas.getByText('Nothing has been priced for this day yet.')).toBeVisible();

		await expect(canvas.queryByText('Burnout Risk')).not.toBeInTheDocument();

		const check = canvas.getByRole('button', {
			name: 'Check my day',
		});

		await expect(check).toBeEnabled();
		await userEvent.click(check);

		await expect(args.oncheck).toHaveBeenCalledOnce();
	}}
/>

<Story
	name="Findings"
	play={async ({ args, canvas, userEvent }) => {
		// Every option must show the reading it produces AND what it costs — an improvement with its
		// price hidden is the advice this feature exists to avoid.
		await expect(canvas.getByText('Burnout Risk')).toBeVisible();
		await expect(canvas.getByText('82%')).toBeVisible();
		await expect(canvas.getByText('Move “Tax return” off today')).toBeVisible();
		await expect(canvas.getByText('· −6.2% plan value')).toBeVisible();
		await expect(canvas.getByText('Day Profile → Cruise')).toBeVisible();
		await expect(canvas.getByText('Set the budget to 6.5h')).toBeVisible();
		await expect(canvas.getByText('· costs no plan value')).toBeVisible();

		// The budget's shadow price: the yield side of the same statement the
		// unpriced "+1h" lever below makes only the cost of.
		await expect(
			canvas.getByText('The next 15 minutes would go to “Tax return” · +2.4% plan value'),
		).toBeVisible();

		// The switch cost's price sits in the same quiet register as the marginal and
		// NOT as a menu row: it is a measurement of the user, so it must never render
		// as something to apply. The lever count below is what pins that it added
		// none.
		await expect(
			canvas.getByText(
				'Switching reserves 30m of today, 6% of the budget, at 15m a switch. Re-solved with no switch cost, your day comes out at +10.4% plan value; at 30m a switch, −8.7% plan value.',
			),
		).toHaveClass('text-ty-silent');

		// Where the defer buttons send a task, in the same quiet register as the readings
		// above it — never a claim about what the moved task would get there (item 21).
		await expect(
			canvas.getByText('Tomorrow: 4 tasks, 6h to spend — 3 of them funded.'),
		).toHaveClass('text-ty-silent');

		// A band is otherwise carried by colour alone (WCAG 1.4.1): both readings
		// are critical, and three of the four afters read caution.
		expect(canvas.getAllByText('(Critical)')).toHaveLength(2);
		expect(canvas.getAllByText('(Caution)')).toHaveLength(3);

		await expect(
			canvas.getByText('“Inbox zero” gets no hours — dropping “Tax return” would fund it.'),
		).toHaveClass('text-ty-secondary');

		await expect(
			canvas.getByText('“Repaint the shed” gets no hours — your Physical pool is full.'),
		).toHaveClass('text-ty-secondary');

		// Louder than the two above: the flag left that task no per-task lever.
		await expect(
			canvas.getByText(
				'“Renew the passport” gets no hours, and nothing on offer today reaches it.',
			),
		).toHaveClass('text-warning-strong');

		// Both lever kinds are performable (the budget is a choice about the day),
		// and each button must say what it does: which task it moves, or which
		// budget it sets.
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

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Set 6.5h',
			}),
		);

		// The lever's hours, not the label's: applying is the only way to reach the
		// budget the model actually priced.
		await expect(args.onapplybudget).toHaveBeenCalledOnce();
		await expect(args.onapplybudget).toHaveBeenCalledWith(6.5);

		// The unpriced increase is performable too — refusing to apply an option the
		// card shows is worse — but it never reads as one more priced option: its own
		// words, and a rule above it.
		const hour = canvas.getByRole('button', {
			name: 'Add the hour',
		});

		await expect(hour.closest('li')).toHaveClass('border-t');

		await userEvent.click(hour);
		await expect(args.onapplybudget).toHaveBeenCalledTimes(2);
		await expect(args.onapplybudget).toHaveBeenLastCalledWith(9);
	}}
/>

<Story
	name="Solving"
	args={{
		advice: null,
		isBusy: true,
	}}
	play={async ({ canvas }) => {
		// A second request is blocked while the search is running.
		await expect(
			canvas.getByRole('button', {
				name: 'Solving…',
			}),
		).toBeDisabled();

		await expect(canvas.getByText('Nothing has been priced for this day yet.')).toBeVisible();
	}}
/>

<Story
	name="First check failed"
	args={{
		advice: null,
		hasError: true,
	}}
	play={async ({ canvas }) => {
		// The first check threw: the banner reads inside the card, with no reading behind it.
		const banner = canvas.getByText('The check failed. Try again.');

		await expect(banner).toBeVisible();
		expect(banner.closest('.card-shell')).not.toBeNull();

		await expect(
			canvas.getByRole('button', {
				name: 'Check my day',
			}),
		).toBeEnabled();
	}}
/>

<Story
	name="Stale"
	args={{
		isStale: true,
	}}
	play={async ({ canvas }) => {
		// The day was edited after the advice was calculated.
		await expect(canvas.getByText('Your day has changed since this was calculated.')).toBeVisible();

		// The numbers stay; the levers do not. Each option is priced as the ONE next
		// move on the day that was solved, so on any other day they are wrong
		// together — including the budget lever, which is priced the same way.
		await expect(canvas.getByText('Move “Migrate the database” off today')).toBeVisible();

		await expect(
			canvas.getByRole('button', {
				name: 'Move “Migrate the database” to tomorrow',
			}),
		).toBeDisabled();

		await expect(
			canvas.getByRole('button', {
				name: 'Add the hour',
			}),
		).toBeDisabled();

		// Recheck is the way out of stale, so it is the one button that stays live.
		await expect(
			canvas.getByRole('button', {
				name: 'Recheck',
			}),
		).toBeEnabled();
	}}
/>

<Story
	name="Error"
	args={{
		// The last check threw; the advice shown predates the failure.
		hasError: true,
	}}
/>

<Story
	name="Nothing to fix"
	args={{
		advice: {
			rows: [],
			unfunded: [],
			unfundedMustDo: [],
			marginal: 'Another 15 minutes would get nothing more done.',
			switchCost: 'At 15m a switch, this plan pays for no switching.',
		},
		destination: null,
	}}
	play={async ({ canvas }) => {
		// A destination read that answered nothing (refused, or failed) prints no line at all — the
		// advice beside it is priced on today and still correct.
		await expect(
			canvas.getByText('Nothing reads badly enough to act on. This day is fine.'),
		).toBeVisible();

		await expect(canvas.queryByText(/^Tomorrow:/)).not.toBeInTheDocument();

		// The shadow price is a reading, not a finding: a day with nothing to fix
		// still answers what the next block would buy.
		await expect(canvas.getByText('Another 15 minutes would get nothing more done.')).toBeVisible();
	}}
/>

<Story
	name="An axis nothing can improve"
	args={{
		advice: {
			rows: [
				{
					axis: 'energyBalance',
					label: 'Energy Balance',
					before: 'Cognitive Heavy 100%',
					beforeBand: 'warning',
					options: [],
				},
			],
			unfunded: [],
			unfundedMustDo: [],
			marginal: 'The next 15 minutes would go to “Tax return” · +2.4% plan value',
			switchCost: 'At 15m a switch, this plan pays for no switching.',
		},
	}}
	play={async ({ canvas }) => {
		// A day of nothing but cognitive tasks: Energy Balance reads 100% and no lever moves it, since
		// the share is invariant under both. The row has to appear anyway — silence here is what let
		// the card call such a day fine while the dashboard banded the same reading Caution.
		await expect(canvas.getByText('Cognitive Heavy 100%')).toBeVisible();
		await expect(canvas.getByText('(Caution)')).toBeInTheDocument();

		// Why the menu is empty, said out loud: an axis with a reading and no rows
		// under it otherwise reads as a rendering failure.
		await expect(
			canvas.getByText('No task move and no budget change improves this.'),
		).toBeVisible();

		await expect(
			canvas.queryByText(/Nothing reads badly enough to act on/),
		).not.toBeInTheDocument();

		expect(
			canvas.queryAllByRole('button', {
				name: /to tomorrow|Set |Add the hour/,
			}),
		).toEqual([]);
	}}
/>

<Story
	name="Two tasks share a title"
	args={{
		advice: sharedTitle,
	}}
	play={async ({ args, canvas, userEvent }) => {
		// Two unfunded tasks on one branch spell one sentence twice.
		expect(
			canvas.getAllByText('“Email” gets no hours, and nothing on offer today reaches it.'),
		).toHaveLength(2);

		// Identical words, distinct levers: the card renders both and applies each by its task id.
		const applies = canvas.getAllByRole('button', {
			name: 'Move “Email” to tomorrow',
		});

		expect(applies).toHaveLength(2);

		await userEvent.click(applies[1]);
		await expect(args.onapply).toHaveBeenCalledOnce();
		await expect(args.onapply).toHaveBeenCalledWith(2);
	}}
/>

<Story
	name="Only an unfunded read"
	args={{
		advice: {
			rows: [],
			unfunded: [
				'“Inbox zero” gets no hours — dropping “Tax return” would fund it.',
				'“Repaint the shed” gets no hours — your Physical pool is full.',
			],
			unfundedMustDo: [],
			marginal: 'The next 15 minutes would go to “Tax return” · +2.4% plan value',
			switchCost:
				'Switching reserves 30m of today, 6% of the budget, at 15m a switch. Re-solved with no switch cost, your day comes out at +10.4% plan value; at 30m a switch, −8.7% plan value.',
		},
	}}
	play={async ({ canvas }) => {
		// Unfunded is a read, not a band: every axis can be in band (`rows: []`) while work still gets
		// no hours — and "this day is fine" printed under that negates it.
		await expect(
			canvas.getByText('“Inbox zero” gets no hours — dropping “Tax return” would fund it.'),
		).toBeVisible();

		await expect(
			canvas.queryByText(/Nothing reads badly enough to act on/),
		).not.toBeInTheDocument();
	}}
/>

<Story
	name="Only a pinned unfunded read"
	args={{
		advice: {
			rows: [],
			unfunded: [],
			unfundedMustDo: [
				'“Renew the passport” gets no hours, and nothing on offer today reaches it.',
			],
			marginal: 'The next 15 minutes would go to “Tax return” · +2.4% plan value',
			switchCost:
				'Switching reserves 30m of today, 6% of the budget, at 15m a switch. Re-solved with no switch cost, your day comes out at +10.4% plan value; at 30m a switch, −8.7% plan value.',
		},
	}}
	play={async ({ canvas }) => {
		// Each read alone, because the gate must check both: a day whose only unfunded task is pinned
		// reports nothing in `unfunded`.
		await expect(
			canvas.getByText(
				'“Renew the passport” gets no hours, and nothing on offer today reaches it.',
			),
		).toBeVisible();

		await expect(
			canvas.queryByText(/Nothing reads badly enough to act on/),
		).not.toBeInTheDocument();
	}}
/>

<Story
	name="An unfunded task names the one to drop"
	args={{
		advice: {
			rows: [],
			unfunded: [
				'“Renew the passport” gets no hours — dropping “Inbox” would fund it.',
				'“Read the report” gets no hours — a budget of 9h would fund it.',
			],
			unfundedMustDo: [],
			marginal: 'The next 15 minutes would go to “Tax return” · +2.4% plan value',
			switchCost: 'At 15m a switch, this plan pays for no switching.',
		},
	}}
	play={async ({ canvas }) => {
		// Queried by exact text, which is what pins one line per task: two reasons
		// run together in one paragraph would still contain both sentences.
		const line = canvas.getByText(
			'“Renew the passport” gets no hours — dropping “Inbox” would fund it.',
		);

		await expect(line).toHaveTextContent('“Renew the passport”');
		await expect(line).toHaveTextContent('dropping “Inbox”');
	}}
/>

<Story
	name="A must-do unfunded task keeps its own line"
	args={{
		advice: {
			rows: [],
			unfunded: [
				'“Inbox zero” gets no hours, and nothing on offer today reaches it.',
				'“Read the report” gets no hours — a budget of 9h would fund it.',
			],
			unfundedMustDo: ['“Renew the passport” gets no hours — your Cognitive pool is full.'],
			marginal: 'The next 15 minutes would go to “Tax return” · +2.4% plan value',
			switchCost: 'At 15m a switch, this plan pays for no switching.',
		},
	}}
	play={async ({ canvas }) => {
		// The flag promises the day, not the hours — the reason it now carries does
		// not change that.
		await expect(
			canvas.getByText('“Renew the passport” gets no hours — your Cognitive pool is full.'),
		).toHaveClass('text-warning-strong');

		await expect(
			canvas.getByText('“Inbox zero” gets no hours, and nothing on offer today reaches it.'),
		).toHaveClass('text-ty-secondary');

		await expect(
			canvas.getByText('“Read the report” gets no hours — a budget of 9h would fund it.'),
		).toHaveClass('text-ty-secondary');
	}}
/>

<Story
	name="Flow coverage"
	args={{
		advice: {
			rows: [
				{
					axis: 'flowCoverage',
					label: 'Flow Coverage',
					before: '60%',
					beforeBand: 'warning',
					options: [
						{
							lever: {
								kind: 'defer-task',
								taskId: 1,
								title: 'Design error boundary',
							},
							action: 'Move “Design error boundary” off today',
							after: '100%',
							afterBand: 'success',
							cost: '−26.4% plan value',
							profileFlip: null,
							applyLabel: null,
							isUnpriced: false,
						},
					],
				},
			],
			unfunded: [],
			unfundedMustDo: [],
			marginal: 'Another 15 minutes would get nothing more done.',
			switchCost: 'At 15m a switch, this plan pays for no switching.',
		},
	}}
	play={async ({ args, canvas, userEvent }) => {
		// A ninth axis, and no markup of its own.
		await expect(canvas.getByText('Flow Coverage')).toBeVisible();
		await expect(canvas.getByText('60%')).toBeVisible();
		await expect(canvas.getByText('Move “Design error boundary” off today')).toBeVisible();
		await expect(canvas.getByText('100%')).toBeVisible();
		await expect(canvas.getByText('· −26.4% plan value')).toBeVisible();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Move “Design error boundary” to tomorrow',
			}),
		);

		await expect(args.onapply).toHaveBeenCalledOnce();
		await expect(args.onapply).toHaveBeenCalledWith(1);
	}}
/>
