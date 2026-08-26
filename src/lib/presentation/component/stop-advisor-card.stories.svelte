<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import StopAdvisorCard from '$lib/presentation/component/stop-advisor-card.svelte';

	const { Story } = defineMeta({
		title: 'Component/Stop Advisor Card',
		component: StopAdvisorCard,
		tags: ['autodocs'],
		args: {
			advice: {
				verdict: 'continue',
				taskId: 1,
				sessionHours: 1.5,
				marginalValue: 1.238,
			},
			taskTitle: 'Guitar practice',
			freeTimeValue: 0.5,
			locale: 'en',
		},
	});
</script>

<Story
	name="Worth continuing"
	play={async ({ canvas }) => {
		// The live verdict on the day so far: one more session, or call it a day
		await expect(canvas.getByText('Worth continuing')).toBeInTheDocument();

		// The priced recommendation: duration, task, both sides of the comparison
		const detail = canvas.getByText(/1h 30m of Guitar practice/);
		await expect(detail).toHaveTextContent('1.24');
		await expect(detail).toHaveTextContent('0.50');
	}}
/>

<Story
	name="A good place to stop"
	args={{
		advice: {
			verdict: 'stop',
			taskId: 1,
			sessionHours: 0.75,
			marginalValue: 0.31,
		},
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('A good place to stop')).toBeInTheDocument();

		// Stopping is priced, not commanded: the beaten session is still shown
		const detail = canvas.getByText(/45m of Guitar practice/);
		await expect(detail).toHaveTextContent('0.31');
	}}
/>

<Story
	name="Window full"
	args={{
		advice: {
			verdict: 'window-full',
		},
		taskTitle: '',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText(/No whole work session fits/)).toBeInTheDocument();
	}}
/>
