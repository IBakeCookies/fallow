<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fireEvent, within } from 'storybook/test';
	import DayConstraintsBar from '$lib/presentation/component/day-constraints-bar.svelte';

	const { Story } = defineMeta({
		title: 'Component/Day Constraints Bar',
		component: DayConstraintsBar,
		tags: ['autodocs'],
		args: {
			locale: 'en-US',
			availableHours: 6,
			switchCost: 0.25,
			cognitivePool: 8,
			physicalPool: 4,
			remainingSuggestedHours: 5.25,
			planSlackHours: 0,
			planSwitchHours: 0.5,
			fittedCognitivePool: null,
			fittedPhysicalPool: null,
			isOpen: true,
		},
	});
</script>

<Story
	name="Open"
	play={async ({ canvas, userEvent }) => {
		// Expanded: all four inputs with switch cost in minutes.
		await expect(canvas.getByLabelText('Available Hours')).toHaveValue(6);
		await expect(canvas.getByLabelText('Switch Cost (per task change)')).toHaveValue(15);
		await expect(canvas.getByLabelText('Cognitive Capacity')).toHaveValue(8);
		await expect(canvas.getByLabelText('Physical Capacity')).toHaveValue(4);

		// No fit, no offer: a fresh profile sees no button.
		expect(
			canvas.queryByRole('button', {
				name: /^Use fitted/,
			}),
		).toBeNull();

		await expect(
			canvas.getByText(/5\.25 h planned \+ 0\.50 h switching · fully committed/),
		).toBeVisible();

		// The slider and the field are two views of one budget, so dragging the
		// slider is what the field then shows. Dragging re-solves the plan live —
		// the reason the budget got a slider at all (ROADMAP phase 1).
		await fireEvent.input(canvas.getByRole('slider'), {
			target: {
				value: '7.5',
			},
		});

		await expect(canvas.getByLabelText('Available Hours')).toHaveValue(7.5);

		// And the other direction: the thumb follows the field's own stepper.
		await userEvent.click(
			canvas.getAllByRole('button', {
				name: 'Increase',
			})[0],
		);

		await expect(canvas.getByRole('slider')).toHaveValue('7.75');

		// Stepping switch cost converts minutes back to hours: 15 min → 20 min.
		await userEvent.click(
			canvas.getAllByRole('button', {
				name: 'Increase',
			})[3],
		);

		await expect(canvas.getByLabelText('Switch Cost (per task change)')).toHaveValue(20);
	}}
/>

<Story
	name="Off-quarter budget"
	args={{
		availableHours: 6.4,
	}}
	play={async ({ canvas }) => {
		// A budget the quarter step does not land on. Legitimate: typed in the field, and what a plan-
		// advice `set-budget` lever applies. A range sanitizes its DOM value to its own step, so with
		// `step="0.25"` the thumb read 6.5 beside a field reading 6.4 — two controls over one value
		// disagreeing.
		await expect(canvas.getByLabelText('Available Hours')).toHaveValue(6.4);
		await expect(canvas.getByRole('slider')).toHaveValue('6.4');

		// A drag still lands on a quarter — that is what `step` was there for, and it
		// now happens on the way in rather than by the input sanitizing what it shows.
		await fireEvent.input(canvas.getByRole('slider'), {
			target: {
				value: '6.43',
			},
		});

		await expect(canvas.getByLabelText('Available Hours')).toHaveValue(6.5);
		await expect(canvas.getByRole('slider')).toHaveValue('6.5');
	}}
/>

<Story
	name="With a fitted offer"
	args={{
		fittedCognitivePool: 4.4,
	}}
	play={async ({ canvas, userEvent }) => {
		// The offer sits on the hint line of the field it is for, and only that one:
		// the gate is per reservoir (docs/features/the-pool-the-drain-logs-offer.md).
		const cognitiveHint = within(canvas.getByText('Cognitive Capacity').closest('p')!);
		const physicalHint = within(canvas.getByText('Physical Capacity').closest('p')!);

		const offer = cognitiveHint.getByRole('button', {
			name: 'Use fitted 4.4 h',
		});

		await expect(offer).toBeVisible();

		expect(
			physicalHint.queryByRole('button', {
				name: /^Use fitted/,
			}),
		).toBeNull();

		// Pressing declares the number the button showed; equal, there is nothing
		// left to adopt, so the button goes.
		await userEvent.click(offer);

		await expect(canvas.getByLabelText('Cognitive Capacity')).toHaveValue(4.4);

		expect(
			canvas.queryByRole('button', {
				name: /^Use fitted/,
			}),
		).toBeNull();
	}}
/>

<Story
	name="Pool already at the fit"
	args={{
		cognitivePool: 4.4,
		fittedCognitivePool: 4.4,
	}}
	play={async ({ canvas }) => {
		// A field already reading the fitted value — pressed earlier, or typed by
		// hand — has nothing to adopt.
		await expect(canvas.getByLabelText('Cognitive Capacity')).toHaveValue(4.4);

		expect(
			canvas.queryByRole('button', {
				name: /^Use fitted/,
			}),
		).toBeNull();
	}}
/>

<Story
	name="With unplanned time"
	args={{
		// Slack above 0.05 h adds the unplanned-time warning line
		remainingSuggestedHours: 4,
		planSlackHours: 2,
	}}
/>

<Story
	name="With a decimal comma"
	args={{
		locale: 'de-DE',
		remainingSuggestedHours: 5.25,
		planSlackHours: 2,
	}}
	play={async ({ canvas }) => {
		const header = canvas.getByText('Day Setup').closest('summary')!;
		await expect(header).toHaveTextContent(/5,25 h planned/);
		await expect(header).toHaveTextContent(/2,00 h free/);
		await expect(canvas.getByText(/\+ 0,50 h switching/)).toBeVisible();
		await expect(canvas.getByText(/^2,00h left unplanned/)).toBeVisible();
	}}
/>

<Story
	name="Fractional figures with a decimal comma"
	args={{
		locale: 'de-DE',
		availableHours: 7.5,
		cognitivePool: 6.5,
		physicalPool: 3.5,
		fittedCognitivePool: 4.4,
		fittedPhysicalPool: 2.6,
	}}
	play={async ({ canvas }) => {
		/* A German reader reads the Day Setup bar's budget, mind and body figures and
		   both "Use fitted X h" offers with a decimal comma ("7,5h budget", "Use fitted
		   4,4 h"), as the planned and free hours beside them already do; and a budget
		   the advice card's trim lever set prints at most two digits ("6.42h budget").

		   Tests: the "Fractional figures with a decimal comma" and "Budget from the
		   trim lever" stories in day-constraints-bar.stories.svelte.
		   Pins: Day Constraints Bar "Collapsed" ("6h budget", "8h mind", "4h body":
		   whole hours stay unpadded), "With a fitted offer" ("Use fitted 4.4 h"),
		   "With a decimal comma", "Open", "Off-quarter budget", "Pool already at the
		   fit"; day-constraints-bar.svelte.spec.ts; plan-advice-descriptor.test.ts
		   (the advice card's hours keep their spelling when `formatHours` moves).
		   Out of scope:
		   - `NumberInput`'s value: the field shows the trim lever's budget unrounded.
		     Not prose, the line M129 drew.
		   - Rounding the lever's hours: unrounded on purpose (plan-advice.ts, the
		     `trimmed` comment); only the label rounds.
		   - tag-hours-card.svelte's one-digit `hours` and /analytics' bare
		     `toLocaleString`: other digit counts, already localized.
		   - The per-switch minutes: already a whole number.
		   Read before building:
		   - src/lib/presentation/utils/plan-advice-descriptor.ts: `formatHours`, the
		     unpadded two-digit spelling; its docblock says why not `formatDecimals`.
		   - src/lib/presentation/utils/number-format.ts: where it moves.
		   - src/lib/presentation/AGENTS.md: a public export joins presentation utils.
		   - src/routes/(app)/+page.svelte: `onapplybudget` sets
		     `session.availableHours` to the lever's hours as they are.
		   Decisions:
		   - `formatHours(hours, locale)` moves from plan-advice-descriptor.ts to
		     number-format.ts as an export, unchanged, and the bar prints all five
		     figures with it. Rejected `formatDecimals(…, 2)`, because it pads: "6h
		     budget" would read "6.00h". Rejected a `toLocaleString` call in the
		     component, because it would be a second copy of `formatHours` (R3).
		     Rejected a digits parameter, because both callers pass 2.
		   - Two digits for all five: the budget steps in quarters and the trim lever
		     leaves it off them; the pools step in halves; `offerFittedPools` rounds a
		     fit to a tenth, so two never cuts an offer.
		   - The trim lever's unrounded budget was not in M130 as raised; folded in
		     because the same formatter fixes it, at the user's call.
		   Roadmap: M130 */
		const header = canvas.getByText('Day Setup').closest('summary')!;
		await expect(header).toHaveTextContent(/7,5h\s*budget/);
		await expect(header).toHaveTextContent(/6,5h\s*mind/);
		await expect(header).toHaveTextContent(/3,5h\s*body/);

		await expect(
			canvas.getByRole('button', {
				name: 'Use fitted 4,4 h',
			}),
		).toBeVisible();

		await expect(
			canvas.getByRole('button', {
				name: 'Use fitted 2,6 h',
			}),
		).toBeVisible();
	}}
/>

<Story
	name="Budget from the trim lever"
	args={{
		// What the advice card's trim lever applies: the budget less the slack, unrounded.
		availableHours: 6.416666666666667,
	}}
	play={async ({ canvas }) => {
		const header = canvas.getByText('Day Setup').closest('summary')!;
		await expect(header).toHaveTextContent(/6\.42h\s*budget/);
	}}
/>

<Story
	name="Collapsed"
	args={{
		isOpen: false,
		remainingSuggestedHours: 4,
		planSlackHours: 2,
	}}
	play={async ({ canvas }) => {
		// The header is four figure cells in both states; budget carries planned and
		// slack beside it, and mind/body carry their domain dot.
		const header = canvas.getByText('Day Setup').closest('summary')!;
		await expect(header).toHaveTextContent(/6h\s*budget\s*4\.00 h planned\s*2\.00 h free/);
		await expect(header).toHaveTextContent(/8h\s*mind/);
		await expect(header).toHaveTextContent(/4h\s*body/);
		await expect(header).toHaveTextContent(/15min\s*per switch/);
		expect(header.querySelector('.bg-mind')).not.toBeNull();
		expect(header.querySelector('.bg-body')).not.toBeNull();

		// Closed by the `<details>` itself, not by an `{#if}`: the fields below stay in
		// the DOM, and the element's own attribute is the state nothing else can move.
		await expect(canvas.getByText('Day Setup').closest('details')).not.toHaveAttribute('open');
	}}
/>
