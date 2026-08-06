<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';

	/* The day's task list, as a card: heading, the add-task form, and either the rows
	   or the empty state. Both screens mount this one — the main page's plan and the
	   Energy Lab's schedule are two readings of the same list, and everything the two
	   were free to disagree about (where the form sits, what the empty day says, the
	   heading) lives here now. What each screen puts IN a row stays its own; the rows
	   arrive as a snippet. */

	interface Props {
		/** The add-task form. At the top in both modes: it is the one control that must
		 *  not move between two screens showing the same list. */
		form?: Snippet;
		/** The `<li>` rows, or null on a day with no tasks — an empty `<ul>` would
		 *  announce "list, 0 items" over the empty-state copy. */
		rows: Snippet | null;
	}

	let { form, rows }: Props = $props();
</script>

<div class="card-shell space-y-text-xs p-box-md sm:p-box-xl">
	<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
		{m.list_title()}
	</h3>
	{#if form}
		<div class="pb-text-md">{@render form()}</div>
	{/if}
	{#if rows}
		<!-- The rule between rows is the list's, not the row's: `divide-y` draws it
		     above every row but the first, so neither screen gets to decide how its
		     own list is separated. -->
		<ul class="space-y-text-xs divide-y divide-line-soft">{@render rows()}</ul>
	{:else}
		<div class="flex flex-col items-center justify-center py-empty-state text-center">
			<div class="text-ty-silent mb-text-xs">
				<svg class="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
					/>
				</svg>
			</div>
			<p class="text-sm text-ty-secondary">{m.list_empty()}</p>
			<p class="text-xs text-ty-silent mt-text-2xs">{m.list_empty_hint()}</p>
		</div>
	{/if}
</div>
