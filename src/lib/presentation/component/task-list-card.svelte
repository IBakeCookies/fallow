<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		form?: Snippet;
		/** What the screen reads beside the heading — `/` puts its "Next" there and the
		 *  Lab nothing. A snippet, like `form`: this card is the two screens' shared
		 *  frame, so what only one of them says arrives from that one. */
		heading?: Snippet;
		/** Null, not an empty snippet: an empty `<ul>` announces "list, 0 items" over the empty-state copy. */
		rows: Snippet | null;
		/** Splits the list into two headed groups instead of one plain one — `/` reads the
		 *  tasks the plan funded nothing in the second. Both labels arrive with it: a
		 *  heading over the only group there is says nothing about it. */
		split?: {
			firstLabel: string;
			restLabel: string;
			rest: Snippet;
		};
	}

	let { form, heading, rows, split }: Props = $props();
</script>

{#snippet group(label: string, items: Snippet)}
	<div class="space-y-text-2xs">
		<h4 class="text-2xs font-semibold tracking-wider text-ty-silent uppercase">{label}</h4>
		<ul class="divide-y divide-line-soft">{@render items()}</ul>
	</div>
{/snippet}

<div class="card-shell space-y-text-xs p-box-md sm:p-box-xl">
	<div class="flex flex-wrap items-baseline justify-between gap-text-xs">
		<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
			{m.list_title()}
		</h3>
		{@render heading?.()}
	</div>
	{#if form}
		<div class="pb-text-md">{@render form()}</div>
	{/if}
	{#if rows && split}
		{@render group(split.firstLabel, rows)}
		{@render group(split.restLabel, split.rest)}
	{:else if rows}
		<ul class="divide-y divide-line-soft">{@render rows()}</ul>
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
