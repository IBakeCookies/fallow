<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/presentation/utils';
	import {
		PINNED_LEDGER_COLUMN_COUNT,
		type LedgerColumn,
	} from '$lib/presentation/utils/ledger-column';

	interface Props {
		form?: Snippet;
		/** Between the heading and the ledger — `/` its day strip, the Lab its ☕ editor. */
		strip?: Snippet;
		/** What the screen reads beside the heading — both screens put the day's Load/Save
		 *  there, and `/` its "Next" too. A snippet, like `form`: this card is the two
		 *  screens' shared frame, so what only one of them says arrives from that one. */
		heading?: Snippet;
		/** Null, not an empty snippet: an empty `<table>` announces a grid of nothing over the empty-state copy. */
		rows: Snippet | null;
		/** The caller's own column list, headed here and spanned by the row's editors. */
		columns: LedgerColumn[];
		/** Splits the list into two headed groups instead of one plain one — `/` reads
		 *  the tasks the plan funded nothing in the second. Both labels arrive with it: a
		 *  heading over the only group there is says nothing about it. */
		split?: {
			firstLabel: string;
			restLabel: string;
			rest: Snippet;
		};
	}

	let { form, strip, heading, rows, columns, split }: Props = $props();
</script>

{#snippet groupHeading(label: string)}
	<!-- No `scope`: every task row is its own `<tbody>` (the shell), so `rowgroup` would
	     head a row group that holds nothing. Left implicit, a header row of one spanning
	     cell heads the cells beneath it instead, down to the next such row. -->
	<tbody>
		<tr>
			<th
				colspan={columns.length}
				class="ledger-cell text-left text-2xs font-semibold tracking-wider text-ty-silent uppercase"
			>
				{label}
			</th>
		</tr>
	</tbody>
{/snippet}

<div class="card-shell space-y-text-xs p-box-sm sm:p-box-xl">
	<div class="flex flex-wrap items-center justify-between gap-text-xs">
		<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
			{m.list_title()}
		</h3>
		{@render heading?.()}
	</div>
	{@render strip?.()}
	{#if rows}
		<!-- The table's DIRECT parent: below `sm` the ledger scrolls sideways in here and
		     the document does not, so no reading is unreachable on a phone. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -- a scrollable region has to be
		     scrollable by keyboard, and a row's own buttons are not always tabbable -->
		<div class="nice-scrollbar overflow-x-auto" tabindex="0">
			<table class="w-full">
				<thead>
					<tr>
						{#each columns as column, index (index)}
							{@const isPinned = index < PINNED_LEDGER_COLUMN_COUNT}
							<th
								scope="col"
								class={cn(
									'ledger-cell text-2xs font-semibold tracking-wider whitespace-nowrap text-ty-silent uppercase',
									column.isNumeric ? 'ledger-numeric' : 'text-left',
									column.isWideOnly && 'ledger-wide',
									// The header pins the same columns the row does, or it stops naming what
									// is under it as soon as the ledger is scrolled.
									isPinned && 'ledger-pin',
									// `sr-only` is absolutely positioned, and an absolute box is clipped by
									// the ledger's `overflow-x` only while its containing block is inside
									// it — unpositioned, the name landed past the viewport and the DOCUMENT
									// scrolled (`e2e/tasks.e2e.ts`). A pinned cell is positioned already.
									column.isLabelHidden && !isPinned && 'relative',
								)}
							>
								<!-- The two columns that show no heading still name themselves for a
								     screen reader (`isLabelHidden`), or the reader announces an
								     anonymous column. -->
								{#if column.isLabelHidden}
									<span class="sr-only">{column.label}</span>
								{:else}
									{column.label}
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				{#if split}
					{@render groupHeading(split.firstLabel)}
					{@render rows()}
					{@render groupHeading(split.restLabel)}
					{@render split.rest()}
				{:else}
					{@render rows()}
				{/if}
			</table>
		</div>
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
	{#if form}
		<div class="pt-text-md">{@render form()}</div>
	{/if}
</div>
