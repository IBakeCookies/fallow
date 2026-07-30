<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { AdviceDisplay } from '$lib/presentation/utils/plan-advice-descriptor';
	import PlanAdviceCard from '$lib/presentation/component/plan-advice-card.svelte';

	/* Shaped exactly as `buildAdviceDisplay` returns it: the bands are the
	   presentation policy's output (utils/band.ts), and every number is one the
	   model would have produced by re-solving the day. */
	const advice: AdviceDisplay = {
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

	const { Story } = defineMeta({
		title: 'Component/Plan Advice Card',
		component: PlanAdviceCard,
		tags: ['autodocs'],
		args: {
			advice,
			isBusy: false,
			isStale: false,
			hasError: false,
			oncheck: () => {},
		},
	});
</script>

<!-- Before the user asks: the search costs a full solve per candidate. -->
<Story
	name="Not calculated yet"
	args={{
		advice: null,
	}}
/>

<Story name="Findings" />

<Story
	name="Solving"
	args={{
		advice: null,
		isBusy: true,
	}}
/>

<!-- The day was edited after the advice was calculated. -->
<Story
	name="Stale"
	args={{
		isStale: true,
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
		},
	}}
/>
