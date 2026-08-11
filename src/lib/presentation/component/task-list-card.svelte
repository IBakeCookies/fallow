<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		form?: Snippet;
		/** Null, not an empty snippet: an empty `<ul>` announces "list, 0 items" over the empty-state copy. */
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
