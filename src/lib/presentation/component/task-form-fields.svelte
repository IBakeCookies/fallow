<script module lang="ts">
	import type { Task } from '$lib/business/type';

	/** The fields a form sets by hand — everything about a task that is not the model's
	 *  own conclusion. Adding a task and re-tuning one set the same five, which is why
	 *  both forms emit this. `mustDoToday` is not optional here as it is on a stored
	 *  task: absence there means never flagged, while a checkbox always answers the
	 *  question. */
	export type TaskEdit = Pick<
		Task,
		'title' | 'physicalDifficulty' | 'mentalDifficulty' | 'enjoyment'
	> & { mustDoToday: boolean };
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';

	/* The part of a task form that is the same whether the task is new or being re-tuned:
	   the three model inputs, the one flag, and the row the submit buttons sit in.

	   Not the title field, and so not a shell: the add form's title is a full ARIA
	   combobox over rated history and the editor's is a plain input, and slotting that
	   difference would take more props (role, four aria-*, three handlers, placeholder,
	   label, a sibling listbox, the collapse button) than the two inputs cost. The
	   frames stay with the callers for the same reason — one is a card's panel, the
	   other is indented under a row's checkbox — so each is defined once, whole. */

	interface Props {
		/** One bound object rather than a bindable per field, which is what
		 *  day-constraints-bar.svelte does with its four: those are four independent
		 *  params, while these three are one draft, and binding them separately would
		 *  mean naming each in its own `bind:value` — which is the loop below unrolled
		 *  again. Bound rather than reported through a callback because the caller's
		 *  draft is the only copy; the caller may also replace it wholesale (the add
		 *  form does, after every submit) and `bind:` is what carries that back in.
		 *  This reads `title` only to leave it alone. */
		draft: TaskEdit;
		/** Off in the Energy Lab. The flag is read by the plan advisor and by nothing else
		 *  (`isPinned`, MATH.md §14), so in a mode that never advises it is a control with
		 *  no consequence on screen. The draft keeps whatever value it arrived with:
		 *  hiding the checkbox must not clear a flag set on the other screen. */
		showMustDoToday?: boolean;
		/** What this form submits with — one Deploy, or a Cancel beside a Save. No
		 *  default: the two share neither size, and only Save can be disabled. */
		footer: Snippet;
	}

	let { draft = $bindable(), showMustDoToday = true, footer }: Props = $props();

	// The three model inputs, in the order a task is defined. Enjoyment starts at 1 and
	// the other two at 0 because ϕ divides by enjoyment (MATH.md §2): a 0 there is not a
	// rating, it is a division by zero.
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

<!-- One gap for both forms, at the narrower of the two they used to have: these three
     columns also have to fit the ✎ editor, which is indented under a row's checkbox. A
     prop for it would put half of each form's layout back in the callers. -->
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
	{#if showMustDoToday}
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
