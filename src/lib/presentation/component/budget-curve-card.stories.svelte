<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, userEvent } from 'storybook/test';
	import BudgetCurveCard from '$lib/presentation/component/budget-curve-card.svelte';
	import type { BudgetCurve, BudgetCurvePoint } from '$lib/business/model/zenith-energy';

	const point = (
		budgetHours: number,
		workHours: number,
		dayValue: number,
		valuePerHour: number,
	): BudgetCurvePoint => ({
		budgetHours,
		workHours,
		dayValue,
		valuePerHour,
	});

	/** A declining curve that reaches break-even (zero) at 3h45 and stays there. The
	 *  first point carries a marginal like every other: its predecessor is the
	 *  do-nothing day, not nothing at all (MATH.md §8.12). */
	const crossing: BudgetCurve = {
		points: [
			point(0.75, 0.75, 2.1, 1.4),
			point(1.5, 1.5, 3.0, 1.2),
			point(2.25, 2.25, 3.75, 1.0),
			point(3, 3, 4.2, 0.6),
			point(3.75, 3.75, 4.425, 0.3),
			point(4.5, 3.75, 4.425, 0),
			point(5.25, 3.75, 4.425, 0),
			point(6, 3.75, 4.425, 0),
		],
		recommendedHours: 3.75,
		freeTimeValue: 0.5,
		maxBudgetHours: 6,
	};

	/** Still climbing when the sweep runs out — the common reading at the default λ₀. */
	const noCrossing: BudgetCurve = {
		points: crossing.points.map((p, i) => point(p.budgetHours, p.budgetHours, 2.1 + i * 0.6, 0.8)),
		recommendedHours: null,
		freeTimeValue: 0.5,
		maxBudgetHours: 6,
	};

	/** λ₀ high enough that no budget is worth working: the day value never leaves the
	 *  do-nothing level, so nothing is booked at any length. The SAME null as
	 *  `noCrossing` and the opposite reading, told apart by the zero work (§8.12). */
	const noWork: BudgetCurve = {
		points: crossing.points.map((p) => point(p.budgetHours, 0, 10.5, 0)),
		recommendedHours: null,
		freeTimeValue: 3,
		maxBudgetHours: 6,
	};

	const { Story } = defineMeta({
		title: 'Component/Budget Curve Card',
		component: BudgetCurveCard,
		tags: ['autodocs'],
		args: {
			curve: crossing,
			isBusy: false,
			isStale: false,
			hasError: false,
			// Inside every fixture's 6 h sweep, and clear of the 3h 45m recommendation:
			// at 8 the `currentBudget <= maxBudgetHours` guard was false, so no story
			// rendered the "your window now" rule or its legend entry at all.
			currentBudget: 4.5,
			locale: 'en',
			oncheck: fn(),
			onapply: fn(),
		},
	});
</script>

<!-- Before the user asks: one button, no card. The sweep costs a solve per step. -->
<Story
	name="Unasked"
	args={{
		curve: null,
	}}
	play={async ({ canvas, args }) => {
		const button = canvas.getByRole('button', {
			name: 'How long should today be?',
		});

		await userEvent.click(button);
		await expect(args.oncheck).toHaveBeenCalledOnce();

		// No card until there is a curve to put in it
		await expect(canvas.queryByText(/re-solved by the same optimizer/)).not.toBeInTheDocument();
	}}
/>

<Story
	name="Solving"
	args={{
		curve: null,
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

<!-- The curve reaches break-even: there is a window to recommend, and it is applyable. -->
<Story
	name="Reaches break-even"
	play={async ({ canvas, canvasElement, args }) => {
		await expect(
			canvas.getByText(/Past 3h 45m another hour of your day adds nothing/),
		).toBeInTheDocument();

		// The recommendation names what that window books, not just its length
		await expect(canvas.getByText(/books 3h 45m of work/)).toBeInTheDocument();
		// The legend only claims a suggested window when there is one
		await expect(canvas.getByText('Suggested window')).toBeInTheDocument();
		// The reader's own window is marked and named. Pinned because it was not:
		// every fixture sweeps to 6h and the default arg used to be 8, so the guard
		// silently dropped both the rule and this legend entry in all six stories.
		await expect(canvas.getByText('Your window now (4h 30m)')).toBeInTheDocument();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Set the day window to 3h 45m',
			}),
		);

		await expect(args.onapply).toHaveBeenCalledExactlyOnceWith(3.75);

		const lineDashes = [...canvasElement.querySelectorAll('svg [stroke-dasharray]')]
			.map((line) => Number(line.getAttribute('stroke-dasharray')?.split(' ')[0]))
			.sort((a, b) => a - b);

		const swatchDashes = [...canvasElement.querySelectorAll('[style*="repeating-linear-gradient"]')]
			.map((swatch) => Number(swatch.getAttribute('style')?.match(/(\d+)px/)?.[1]))
			.sort((a, b) => a - b);

		await expect(lineDashes).toHaveLength(3);
		await expect(swatchDashes).toEqual(lineDashes);
	}}
/>

<!-- The honest branch, and the common one at an uncalibrated λ₀: break-even is never
     reached inside the swept range, and the hint names the parameter that moves it. -->
<Story
	name="Never reaches break-even"
	args={{
		curve: noCrossing,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText(/would use every hour you give it/)).toBeInTheDocument();
		// λ₀ is reported as a price the curve already charges — never as a line to
		// read the curve against, which would charge it twice (MATH.md §8.12).
		await expect(canvas.getByText(/priced at 0.50 output an hour/)).toBeInTheDocument();
		await expect(canvas.getByText(/already charges it/)).toBeInTheDocument();

		// No window to apply, and no suggested-window guide to explain
		await expect(
			canvas.queryByRole('button', {
				name: /Set the day window/,
			}),
		).not.toBeInTheDocument();

		await expect(canvas.queryByText('Suggested window')).not.toBeInTheDocument();
	}}
/>

<!-- The other null, and the exact inverse reading of the one above: at this λ₀ the
     model books nothing at any length. Told apart from "still climbing" by the zero
     work, never by the null alone — seeded from -Infinity this branch used to come
     back recommending 45 minutes that book 0h of work (MATH.md §8.12). -->
<Story
	name="No window is worth working"
	args={{
		curve: noWork,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText(/no day window is worth working/)).toBeInTheDocument();
		await expect(canvas.getByText(/books nothing at any length/)).toBeInTheDocument();

		// The opposite branch's copy must NOT appear: it says the model would use
		// every hour offered, which is precisely wrong here.
		await expect(canvas.queryByText(/would use every hour you give it/)).not.toBeInTheDocument();

		// Nothing to apply, nothing to guide to, and the chart must not tell a screen
		// reader to look for a point above zero on a series that is flat at zero.
		await expect(
			canvas.queryByRole('button', {
				name: /Set the day window/,
			}),
		).not.toBeInTheDocument();

		await expect(canvas.queryByText('Suggested window')).not.toBeInTheDocument();

		await expect(
			canvas.getByRole('img', {
				name: /never rises as the window grows/,
			}),
		).not.toHaveAccessibleName(/suggested one/);
	}}
/>

<!-- The reader's window past the swept cap: there is no honest place to draw the
     locator, so the legend names the window and the cap in words rather than going
     silently missing (docs/testing.md). -->
<Story
	name="Window past the cap"
	args={{
		currentBudget: 9,
	}}
	play={async ({ canvas }) => {
		await expect(
			canvas.getByText('Your window now is 9h, past the 6h checked here'),
		).toBeInTheDocument();

		await expect(canvas.queryByText(/Your window now \(/)).not.toBeInTheDocument();
	}}
/>

<Story
	name="Stale"
	args={{
		isStale: true,
	}}
	play={async ({ canvas }) => {
		await expect(
			canvas.getByText('Your day has changed since this was calculated.'),
		).toBeInTheDocument();

		// Stale is a warning about the numbers, not a reason to hide them
		await expect(canvas.getByText(/Past 3h 45m/)).toBeInTheDocument();
	}}
/>

<Story
	name="Failed"
	args={{
		hasError: true,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('The sweep failed. Try again.')).toBeInTheDocument();
	}}
/>
