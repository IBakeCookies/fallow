<script module lang="ts">
	import type { Task } from '$lib/business/type';

	/** `mustDoToday` is required here though optional on a stored task: absence there
	 *  means never flagged, while a checkbox always answers the question. */
	export type TaskEdit = Pick<
		Task,
		'title' | 'physicalDifficulty' | 'mentalDifficulty' | 'enjoyment'
	> & { mustDoToday: boolean };
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		draft: TaskEdit;
		withMustDoToday?: boolean;
		footer: Snippet;
	}

	let { draft = $bindable(), withMustDoToday = true, footer }: Props = $props();

	// Enjoyment's minimum is 1 because MATH.md §1 declares βᵤ ∈ [1,10]: a 0 puts β
	// outside [1,2], the range every fit was built on.
	const sliders = [
		{
			key: 'physicalDifficulty',
			label: m.form_physical_difficulty(),
			min: 0,
			accent: 'accent-body',
		},
		{
			key: 'mentalDifficulty',
			label: m.form_mental_difficulty(),
			min: 0,
			accent: 'accent-mind',
		},
		{
			key: 'enjoyment',
			label: m.form_enjoyment(),
			min: 1,
			accent: 'accent-brand',
		},
	] as const;
</script>

<div class="grid gap-grid-md sm:grid-cols-3">
	{#each sliders as slider (slider.key)}
		<!-- The wrapping label is what names the range input -->
		<label class="block space-y-text-xs">
			<span class="flex justify-between text-xs font-medium">
				<span class="text-ty-secondary">{slider.label}</span>
				<span class="text-ty-primary">{draft[slider.key]}</span>
			</span>
			<input
				type="range"
				min={slider.min}
				max="10"
				bind:value={draft[slider.key]}
				class="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-inset {slider.accent}"
			/>
		</label>
	{/each}
</div>

<!-- `justify-end` with the flag pushed out by its own margin, so the buttons keep their
     corner in the mode that has no flag to show. -->
<div class="flex flex-wrap items-center justify-end gap-grid-sm">
	{#if withMustDoToday}
		<label
			class="mr-auto flex items-center gap-text-xs text-xs font-medium text-ty-secondary"
			title={m.form_must_do_today_title()}
		>
			<input
				type="checkbox"
				bind:checked={draft.mustDoToday}
				class="size-4 appearance-auto accent-brand"
			/>
			{m.form_must_do_today()}
		</label>
	{/if}
	{@render footer()}
</div>
