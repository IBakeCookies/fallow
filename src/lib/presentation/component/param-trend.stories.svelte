<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import ParamTrend from '$lib/presentation/component/param-trend.svelte';

	const { Story } = defineMeta({
		title: 'Component/Param Trend',
		component: ParamTrend,
		tags: ['autodocs'],
	});
</script>

<Story
	name="Rising"
	args={{
		values: [0.3, 0.32, 0.31, 0.38, 0.44, 0.47],
		defaultValue: 0.35,
		ariaLabel: 'Cognitive drain rate over the last 6 recorded days: 0.30 /h to 0.47 /h',
	}}
	play={async ({ args, canvas }) => {
		// A drain rate climbing away from its default. The label is the only accessible name an <svg
		// role="img"> has, so the play function pins it.
		const plot = canvas.getByRole('img', {
			name: args.ariaLabel,
		});

		await expect(plot).toBeVisible();

		// Six recorded days join into five segments after the initial move
		await expect(plot.querySelector('path')?.getAttribute('d')).toMatch(
			/^M[\d.]+,[\d.]+(L[\d.]+,[\d.]+){5}$/,
		);
	}}
/>

<Story
	name="Never moved"
	args={{
		values: [0.35, 0.35, 0.35],
		defaultValue: 0.35,
		ariaLabel: 'Cognitive drain rate over the last 3 recorded days: 0.35 /h to 0.35 /h',
	}}
	play={async ({ args, canvas }) => {
		// The edge case that would otherwise divide by a zero range: a fit that has never moved off its
		// default. It must still draw a line, not `d="MNaN,NaN"`.
		const plot = canvas.getByRole('img', {
			name: args.ariaLabel,
		});

		await expect(plot.querySelector('path')?.getAttribute('d')).not.toMatch(/NaN/);
		await expect(plot.querySelector('line')?.getAttribute('y1')).not.toMatch(/NaN/);
	}}
/>

<Story
	name="Below the default"
	args={{
		values: [0.2, 0.18, 0.14],
		defaultValue: 0.7,
		ariaLabel: 'Recovery rate over the last 3 recorded days: 0.20 /h to 0.14 /h',
	}}
	play={async ({ args, canvas }) => {
		// Every measured value under the default, so the dashed reference must still sit inside the box
		// — that is what stops the line from reading as "on target".
		const plot = canvas.getByRole('img', {
			name: args.ariaLabel,
		});

		const y = Number(plot.querySelector('line')?.getAttribute('y1'));
		const height = Number(plot.getAttribute('viewBox')?.split(' ')[3]);

		await expect(y).toBeGreaterThanOrEqual(0);
		await expect(y).toBeLessThanOrEqual(height);
	}}
/>
