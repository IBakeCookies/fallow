<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import type { Persisted, FlowObservationRecord } from '$lib/business/type';
	import DayConstraintsBar from '$lib/presentation/component/day-constraints-bar.svelte';

	const log = (id: number, date: string, taskTitle: string, phiHours: number) =>
		({
			id,
			date,
			taskId: id,
			taskTitle,
			difficulty: 7,
			enjoyment: 6,
			E: 4,
			beta: 1.5,
			phiHours,
			createdAt: id,
		}) satisfies Persisted<FlowObservationRecord>;

	const flowLogs: Persisted<FlowObservationRecord>[] = [
		log(1, '2026-07-18', 'boxing', 0.5),
		log(2, '2026-07-19', 'writing', 0.75),
		log(3, '2026-07-20', 'inbox', 0.25),
	];

	const { Story } = defineMeta({
		title: 'Component/Day Constraints Bar',
		component: DayConstraintsBar,
		tags: ['autodocs'],
		args: {
			availableHours: 6,
			switchCost: 0.25,
			cognitivePool: 8,
			physicalPool: 4,
			remainingSuggestedHours: '5.25',
			planSlackHours: 0,
			constantsFitted: true,
			flowLogs,
			ondeletelog: fn(),
			onresetlogs: fn(),
			isOpen: true,
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

<!-- Collapsed it is one line: budget · planned · slack · pools · switch -->
<Story
	name="Collapsed"
	args={{
		isOpen: false,
		remainingSuggestedHours: '4.00',
		planSlackHours: 2,
	}}
/>

<!-- Logs present but the fit was rejected: one of the two model states that
     surface while collapsed, and the loud one -->
<Story
	name="Collapsed with a rejected fit"
	args={{
		isOpen: false,
		constantsFitted: false,
	}}
/>

<!-- The other one, and the quiet one: nothing is wrong, there is just nothing
     logged. This line is the only place in the app that says ⚡ exists, so it has
     to be legible at `text-ty-silent` on a card in every theme — which is what the
     a11y addon checks here and cannot check while it is collapsed out of view. -->
<Story
	name="Collapsed, nothing logged"
	args={{
		isOpen: false,
		constantsFitted: false,
		flowLogs: [],
		onresetlogs: undefined,
	}}
/>

<Story
	name="No logs yet"
	args={{
		constantsFitted: false,
		flowLogs: [],
		onresetlogs: undefined,
	}}
/>
