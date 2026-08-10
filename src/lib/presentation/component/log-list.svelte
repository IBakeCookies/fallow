<script lang="ts" generics="T extends { id: number }">
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

	let { label, title, items, row, confirmLabel, resetLabel, resetTitle, onreset }: Props = $props();

	// Expandable list of logged data points with per-row actions supplied by
	// the caller and a two-step reset.
	let open = $state(false);
	let confirmingReset = $state(false);
	// Deleting the last row empties the list under an open panel, so expansion is
	// derived rather than stored: the toggle never claims aria-expanded over
	// content it no longer renders, and the next log logged doesn't arrive
	// pre-expanded.
	const expanded = $derived(open && items.length > 0);
	const newestFirst = $derived([...items].reverse());

	// Focus follows the two-step swap, which unmounts whichever button was
	// focused: entering confirm focuses Cancel — the safe half, so a second
	// stray Enter cannot wipe the logs — and cancelling hands focus back to the
	// trigger. A plain `let`, not `$state`: the attachment reads it once when
	// the trigger mounts and must not re-run when it flips back.
	let returningFromCancel = false;
</script>

{#if items.length === 0}
	<!-- Nothing to expand. A paragraph, not a disabled button: `disabled` takes
	     the row out of the tab order, and with it any `title` the caller passed
	     to explain why the list is empty. -->
	<p class="text-xs text-ty-silent" {title}>{label}</p>
{:else}
	<button
		type="button"
		aria-expanded={expanded}
		class="flex w-full items-center justify-between gap-grid-xs text-left text-xs text-ty-silent transition hover:text-ty-secondary"
		{title}
		onclick={() => {
			open = !open;
			confirmingReset = false;
		}}
	>
		<span>{label}</span>
		<span class="shrink-0 text-lg leading-none text-ty-silent">{expanded ? '▴' : '▾'}</span>
	</button>
{/if}

{#if expanded}
	<ul class="mt-text-xs max-h-64 space-y-text-2xs overflow-y-auto">
		{#each newestFirst as item (item.id)}
			<li class="log-row">
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
						{@attach (node) => node.focus()}
						onclick={() => {
							returningFromCancel = true;
							confirmingReset = false;
						}}
					>
						{m.common_cancel()}
					</button>
				</span>
			{:else}
				<button
					type="button"
					class="text-xs text-ty-silent transition hover:text-danger"
					title={resetTitle}
					{@attach (node) => {
						if (returningFromCancel) {
							returningFromCancel = false;
							node.focus();
						}
					}}
					onclick={() => (confirmingReset = true)}
				>
					{resetLabel}
				</button>
			{/if}
		</div>
	{/if}
{/if}
