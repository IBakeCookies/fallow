<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import NumberInput from './number-input.svelte';

	const { Story } = defineMeta({
		title: 'UI/Number Input',
		component: NumberInput,
		tags: ['autodocs'],
		args: {
			min: 0,
			max: 24,
			step: 0.25,
			unit: 'hrs',
			accent: 'focus-within:border-brand/50',
			ariaLabel: 'Available hours',
		},
	});
</script>

<script lang="ts">
	// The component is controlled (value + onchange), so the story owns the value
	let hours = $state(6);
	let minutes = $state(0);
</script>

<Story name="Hours">
	{#snippet template(args)}
		<div class="max-w-48">
			<NumberInput {...args} value={hours} onchange={(next) => (hours = next)} />
		</div>
	{/snippet}
</Story>

<!-- The steppers report in the field's own increments; the component is controlled,
     so with nothing writing the value back both steps start from the same 6 -->
<Story
	name="Stepping"
	args={{
		value: 6,
		step: 0.5,
		onchange: fn(),
	}}
	play={async ({ args, canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Increase',
			}),
		);

		await expect(args.onchange).toHaveBeenCalledOnce();
		await expect(args.onchange).toHaveBeenCalledWith(6.5);

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Decrease',
			}),
		);

		await expect(args.onchange).toHaveBeenLastCalledWith(5.5);
	}}
/>

<!-- At the minimum the − stepper disables; the field itself stays editable -->
<Story
	name="At minimum"
	args={{
		min: 0,
		max: 60,
		step: 5,
		unit: 'min',
		ariaLabel: 'Switch cost',
	}}
>
	{#snippet template(args)}
		<div class="max-w-48">
			<NumberInput {...args} value={minutes} onchange={(next) => (minutes = next)} />
		</div>
	{/snippet}
</Story>

<Story name="Accents" asChild>
	<div class="flex flex-wrap gap-grid-sm">
		<div class="max-w-40">
			<NumberInput
				value={8}
				onchange={() => {}}
				min={0}
				max={16}
				step={0.5}
				unit="hrs"
				ariaLabel="Cognitive pool"
				accent="focus-within:border-mind/50"
			/>
		</div>
		<div class="max-w-40">
			<NumberInput
				value={4}
				onchange={() => {}}
				min={0}
				max={16}
				step={0.5}
				unit="hrs"
				ariaLabel="Physical pool"
				accent="focus-within:border-body/50"
			/>
		</div>
	</div>
</Story>
