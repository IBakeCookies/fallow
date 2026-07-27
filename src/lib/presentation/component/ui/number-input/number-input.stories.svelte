<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
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
			ariaLabel: 'Available hours'
		}
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

<!-- At the minimum the − stepper disables; the field itself stays editable -->
<Story name="At minimum" args={{ min: 0, max: 60, step: 5, unit: 'min', ariaLabel: 'Switch cost' }}>
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
