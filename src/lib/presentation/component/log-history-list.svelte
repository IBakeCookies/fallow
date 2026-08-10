<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import type { LogHistoryRow, LogKind } from '$lib/presentation/utils/log-history';

	/* Every measurement in the analytics range, one row each. The three kinds print
	   as one shape — day and task on the left, reading on the right — which is what
	   makes a merged list readable; `logHistory` is what makes them one shape.

	   Drops a measurement but never corrects one — it LINKS to the correction instead.
	   A correction has to say which SESSION it re-rates, and re-reads that day's task
	   for the demands it captures, so only the row on the day in question can make one;
	   the day of a ⚡ or 🪫 row is therefore a link to that day on `/`, where the badge
	   and the chips open it prefilled. Dropping needs none of that — a record id is the
	   whole address — which is why the ✕ is here and the ✎ is not. ☕ belongs to no
	   task's row and so gets no link.

	   The three calibration cards each printed their own kind until 2026-08-10, which
	   was three partial answers to one question; what stayed with each of them is the
	   fit's own two verbs (`fit-log-summary.svelte`). The row chrome is the `log-row`
	   utility, still shared with that card's ancestor. */

	interface Props {
		/** Already folded, filtered and ordered newest-first by `logHistory`. */
		rows: LogHistoryRow[];
		/** Drop one measurement. Takes the kind as well as the id because the three
		 *  kinds are three stores with three id sequences — the number alone names a
		 *  different record in each. */
		ondelete: (kind: LogKind, id: number) => void;
	}

	let { rows, ondelete }: Props = $props();

	// The emoji is the fast read and the name is the only read for a screen
	// reader — in a list of one kind an icon can carry it alone, in a merged one it
	// is the column that says what the numbers beside it mean.
	const KIND: Record<LogKind, { icon: string; name: () => string }> = {
		flow: {
			icon: '⚡',
			name: () => m.ana_logs_kind_flow(),
		},
		drain: {
			icon: '🪫',
			name: () => m.ana_logs_kind_drain(),
		},
		rest: {
			icon: '☕',
			name: () => m.ana_logs_kind_rest(),
		},
	};
</script>

{#if rows.length === 0}
	<p class="mt-text-md text-sm text-ty-secondary">{m.ana_logs_empty()}</p>
{:else}
	<p class="mt-text-md text-xs text-ty-silent">
		{rows.length === 1
			? m.ana_logs_count_one()
			: m.ana_logs_count_other({
					count: rows.length,
				})}
	</p>
	<!-- Capped: a year holds hundreds of rows, and a card that grows with the history
	     pushes every reading below it off the page. -->
	<ul class="mt-text-xs max-h-64 space-y-text-2xs overflow-y-auto">
		{#each rows as row (row.key)}
			<li class="log-row">
				<span class="truncate">
					{#if row.taskTitle}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<!-- Labelled as well as titled: the visible text is a bare date, which
						     names the link for the eye and says nothing to a screen reader
						     reading it out of the row's context. -->
						<a
							href={localizeHref(`${resolve('/')}?date=${row.date}`)}
							aria-label={m.ana_logs_open_day({
								date: row.date,
							})}
							title={m.ana_logs_open_day({
								date: row.date,
							})}
							class="hint-underline text-ty-silent transition hover:text-ty-secondary"
						>
							{row.date}
						</a>
						<span class="capitalize"> · {row.taskTitle}</span>
					{:else}
						<span class="text-ty-silent">{row.date}</span>
					{/if}
				</span>
				<span class="flex shrink-0 items-center gap-text-xs tabular-nums">
					<span aria-hidden="true">{KIND[row.kind].icon}</span>
					<span class="sr-only">{KIND[row.kind].name()}</span>
					<span class="text-ty-silent">{formatDuration(row.hours)}</span>
					{#if row.mind !== null}
						<span class="font-medium text-mind/90">
							M{row.mind}{#if row.mindAfter !== null}→{row.mindAfter}{/if}
						</span>
					{/if}
					{#if row.body !== null}
						<span class="font-medium text-body/90">
							B{row.body}{#if row.bodyAfter !== null}→{row.bodyAfter}{/if}
						</span>
					{/if}
					<button
						type="button"
						aria-label={m.ana_logs_delete_aria({
							kind: KIND[row.kind].name(),
							date: row.date,
						})}
						title={m.ana_logs_delete_title()}
						class="text-ty-silent transition hover:text-danger"
						onclick={() => ondelete(row.kind, row.id)}
					>
						✕
					</button>
				</span>
			</li>
		{/each}
	</ul>
{/if}
