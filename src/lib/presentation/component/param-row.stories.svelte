<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import ParamRow from '$lib/presentation/component/param-row.svelte';

	const { Story } = defineMeta({
		title: 'Component/Param Row',
		component: ParamRow,
		tags: ['autodocs'],
		args: {
			id: 'alpha-cog',
			label: 'Cognitive Drain',
			hint: 'How fast focused work spends your mind — 0.5 means half a full tank per hour of hard thinking.',
			value: 0.4,
			min: 0.05,
			max: 2,
			step: 0.05,
			unit: '/h',
			onchange: fn(),
		},
	});
</script>

<!-- Hover the label: every parameter carries its hint, because none of the names mean
     anything on their own. The label names the stepper (screen reader and e2e), the
     help cursor advertises the hint, and the stepper reports in the parameter's own
     increments. -->
<Story
	name="Default"
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByLabelText(args.label)).toHaveValue(args.value);
		await expect(canvas.getByText(args.label)).toHaveClass('hint-underline');
		// No logs behind the parameter is not "no signal": the row carries no reading at all.
		await expect(canvas.queryByText('no informative ratings')).toBeNull();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Increase',
			}),
		);

		await expect(args.onchange).toHaveBeenCalledOnce();
		await expect(args.onchange).toHaveBeenCalledWith(0.45);
	}}
>
	{#snippet template(args)}
		<div class="max-w-xs"><ParamRow {...args} /></div>
	{/snippet}
</Story>

<!-- Parameters that belong to one capacity tint their focus ring to match -->
<Story
	name="Capacity accent"
	args={{
		id: 'alpha-phys',
		label: 'Physical Drain',
		hint: 'How fast physical work spends your body.',
		value: 0.6,
		accent: 'focus-within:border-body/50',
	}}
>
	{#snippet template(args)}
		<div class="max-w-xs"><ParamRow {...args} /></div>
	{/snippet}
</Story>

<!-- What the user's own logs fit, beside the stepper it would replace, so `Apply my
     fits` resolves a disagreement they can see -->
<Story
	name="With a fit"
	args={{
		fit: '≈ 1.21 ± 0.18 · n=18',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('≈ 1.21 ± 0.18 · n=18')).toHaveClass('text-info-strong');
	}}
>
	{#snippet template(args)}
		<div class="max-w-xs"><ParamRow {...args} /></div>
	{/snippet}
</Story>

<!-- Logged, but nothing in them separates this parameter from the default: a fit that
     failed is not a fit of zero, so no number is printed to invite applying it -->
<Story
	name="No signal"
	args={{
		fit: null,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('no informative ratings')).toHaveClass('text-ty-silent');
	}}
>
	{#snippet template(args)}
		<div class="max-w-xs"><ParamRow {...args} /></div>
	{/snippet}
</Story>
