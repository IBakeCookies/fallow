<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TimeBudgetCard from '$lib/presentation/component/time-budget-card.svelte';

	const { Story } = defineMeta({
		title: 'Component/Time Budget Card',
		component: TimeBudgetCard,
		tags: ['autodocs'],
		args: {
			availableHours: 6,
			switchCost: 0.25,
			cognitivePool: 8,
			physicalPool: 4,
			remainingSuggestedHours: '5.25',
			planSlackHours: 0,
			startOpen: true,
		},
	});
</script>

<Story name="Open" />

<!-- Slack above 0.05 h adds the unplanned-time warning line -->
<Story
	name="With unplanned time"
	args={{
		remainingSuggestedHours: '4.00',
		planSlackHours: 2,
	}}
/>

<!-- Collapsed it is one summary line: budget · planned · slack -->
<Story
	name="Collapsed"
	args={{
		startOpen: false,
		remainingSuggestedHours: '4.00',
		planSlackHours: 2,
	}}
/>
