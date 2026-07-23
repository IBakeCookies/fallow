<script lang="ts" generics="T extends { id?: number }">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		/* toggle text, e.g. "Personalized from 7 flow logs" */
		label: string;
		title?: string;
		/* insertion order; rendered newest first */
		items: T[];
		/* full row content, including any per-row actions */
		row: Snippet<[T]>;
		confirmLabel: string;
		resetLabel: string;
		resetTitle?: string;
		/* omit to hide the reset row */
		onreset?: () => void;
	}

	let { label, title, items, row, confirmLabel, resetLabel, resetTitle, onreset }: Props =
		$props();

	// Expandable list of logged data points with per-row actions supplied by
	// the caller and a two-step reset.
	let open = $state(false);
	let confirmingReset = $state(false);
	const newestFirst = $derived([...items].reverse());
</script>

<button
	type="button"
	aria-expanded={open}
	class="flex w-full items-center justify-between gap-grid-xs text-left text-xs text-ty-silent transition hover:text-ty-secondary disabled:cursor-default disabled:hover:text-ty-silent"
	disabled={items.length === 0}
	{title}
	onclick={() => {
		open = !open;
		confirmingReset = false;
	}}
>
	<span>{label}</span>
	{#if items.length > 0}
		<span class="shrink-0 text-lg leading-none text-ty-silent">{open ? '▴' : '▾'}</span>
	{/if}
</button>

{#if open && items.length > 0}
	<ul class="mt-text-xs max-h-64 space-y-text-2xs overflow-y-auto">
		{#each newestFirst as item (item.id)}
			<li
				class="flex items-center justify-between gap-text-xs rounded bg-surface-card px-2 py-1 text-xs text-ty-secondary"
			>
				{@render row(item)}
			</li>
		{/each}
	</ul>
	{#if onreset}
		<div class="mt-text-xs flex justify-end">
			{#if confirmingReset}
				<span class="flex items-center gap-text-xs text-xs">
					<span class="text-ty-silent">{confirmLabel}</span>
					<button
						type="button"
						class="font-medium text-danger hover:text-danger-strong"
						onclick={() => {
							onreset?.();
							confirmingReset = false;
							open = false;
						}}
					>
						{m.common_reset()}
					</button>
					<button
						type="button"
						class="text-ty-silent hover:text-ty-secondary"
						onclick={() => (confirmingReset = false)}
					>
						{m.common_cancel()}
					</button>
				</span>
			{:else}
				<button
					type="button"
					class="text-xs text-ty-silent transition hover:text-danger"
					title={resetTitle}
					onclick={() => (confirmingReset = true)}
				>
					{resetLabel}
				</button>
			{/if}
		</div>
	{/if}
{/if}
