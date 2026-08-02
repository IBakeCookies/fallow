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
		await expect(canvas.getByText(args.label)).toHaveClass('cursor-help');

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
