<script lang="ts">
	import type { TaskImportance } from '$lib/business/type';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/presentation/utils';
	import { buttonVariants } from '$lib/presentation/component/ui/button';

	interface Props {
		importance: TaskImportance;
	}

	let { importance = $bindable() }: Props = $props();

	// `$props.id()`, because both forms can be mounted at once (the add dialog and a
	// row's editor) and one shared name would make them a single radio group.
	const name = $props.id();

	const levels = [
		{
			value: 'low',
			label: m.form_importance_low(),
		},
		{
			value: 'normal',
			label: m.form_importance_normal(),
		},
		{
			value: 'high',
			label: m.form_importance_high(),
		},
	] as const;
</script>

<!-- The `must-do-toggle.svelte` carve-out, three times: a real radio keeps the group's
     roving tabindex and its arrow keys, while the label around it carries the button
     recipe. A `<fieldset>`/`<legend>` is what names the group.

     The legend is VISIBLE and sits ABOVE the three options, reading like the slider
     labels beside it — three bare buttons in a form say nothing about what they set.
     Above rather than beside because `<legend>` is not a flex item in its own
     fieldset, and because that is how the sliders label themselves. -->
<fieldset title={m.form_importance_title()} class="block space-y-text-xs">
	<legend class="text-xs font-medium text-ty-secondary">{m.form_importance()}</legend>
	<div class="flex flex-wrap items-center gap-grid-2xs">
		{#each levels as level (level.value)}
			<label
				class={cn(
					buttonVariants({
						variant: importance === level.value ? 'secondary' : 'outline',
					}),
					'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/50 relative has-[:focus-visible]:ring-3',
				)}
			>
				<input
					type="radio"
					{name}
					value={level.value}
					bind:group={importance}
					class="absolute inset-0 cursor-pointer appearance-none opacity-0"
				/>
				{level.label}
			</label>
		{/each}
	</div>
</fieldset>
