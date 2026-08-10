<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import type { LogHistoryRow, LogKind } from '$lib/presentation/utils/log-history';
	import FlowLogForm from '$lib/presentation/component/flow-log-form.svelte';
	import DrainLogForm from '$lib/presentation/component/drain-log-form.svelte';
	import RestLogForm from '$lib/presentation/component/rest-log-form.svelte';

	/* Every measurement in the analytics range, one row each. The three kinds print
	   as one shape — day and task on the left, reading on the right — which is what
	   makes a merged list readable; `logHistory` is what makes them one shape.

	   Both verbs a MEASUREMENT has, on every row: ✕ drops it and ✎ corrects it, each
	   addressed by (kind, id) alone. That is possible because a correction rewrites the
	   quantities the user rated and nothing else (MATH.md §36) — it re-derives nothing
	   from a task, so this list needs no day in view and no task in hand, which is what
	   it has: it shows every day at once and therefore views none of them. Until
	   2026-08-10 both writers re-read the live task, and the ✎ had to be a LINK to the
	   day instead. ☕ has no task and so no row on either screen, which makes this its
	   only editor.

	   The date is still a link for ⚡ and 🪫 — navigation to the day, not the way to
	   correct it, and worded as that.

	   The three calibration cards each printed their own kind until 2026-08-10, which
	   was three partial answers to one question; what stayed with each of them is the
	   fit's own two verbs (`fit-log-summary.svelte`). The row chrome is the `log-row`
	   utility, still shared with that card's ancestor. */

	interface Props {
		/** Already folded, filtered and ordered newest-first by `logHistory`. */
		rows: LogHistoryRow[];
		/** Whether `rows` is the whole history rather than the page's range. Only the
		 *  empty line reads it: "nothing in this range" and "nothing ever" are different
		 *  claims, and with none logged there is no other way to tell them apart. */
		allTime: boolean;
		/** Which row's correction is open, by `row.key`, or null for none. The PAGE's, not
		 *  this list's: the three saves land in two different stores, and the page is what
		 *  knows the events an open editor must not outlive — a drop, a range change, a
		 *  scope change, a save. */
		editingKey: string | null;
		/** Drop one measurement. Takes the kind as well as the id because the three
		 *  kinds are three stores with three id sequences — the number alone names a
		 *  different record in each. */
		ondelete: (kind: LogKind, id: number) => void;
		/** Ask for this row's correction. Same address as `ondelete` for the same reason. */
		onedit: (kind: LogKind, id: number) => void;
		oncancel: () => void;
		/** One per kind rather than one union, because the three measurements are three
		 *  different quantities: ⚡ is a duration, 🪫 a session with two ratings, ☕ a
		 *  break with four. Each takes the record id and the units its own fit reads. */
		onsaveflow: (id: number, minutes: number) => void;
		onsavedrain: (id: number, entry: { hours: number; mind: number; body: number }) => void;
		onsaverest: (
			id: number,
			entry: {
				hours: number;
				mindBefore: number;
				mindAfter: number;
				bodyBefore: number;
				bodyAfter: number;
			},
		) => void;
	}

	let {
		rows,
		allTime,
		editingKey,
		ondelete,
		onedit,
		oncancel,
		onsaveflow,
		onsavedrain,
		onsaverest,
	}: Props = $props();

	// Minutes is the unit every editor takes; `hours` is what the record and the fits
	// hold. The forms convert back on save, so this is the only direction spelled here.
	const toMinutes = (hours: number) => Math.round(hours * 60);

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
	<p class="mt-text-md text-sm text-ty-secondary">
		{allTime ? m.ana_logs_empty_all() : m.ana_logs_empty()}
	</p>
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
			<li>
				<div class="log-row">
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
						<!-- Both verbs named by kind and day rather than "correct"/"delete": a
						     screen reader listing a 40-row list's buttons would otherwise read the
						     same two phrases forty times. -->
						<button
							type="button"
							aria-label={m.ana_logs_edit_aria({
								kind: KIND[row.kind].name(),
								date: row.date,
							})}
							title={m.ana_logs_edit_title()}
							class="text-ty-silent transition hover:text-ty-secondary"
							onclick={() => (editingKey === row.key ? oncancel() : onedit(row.kind, row.id))}
						>
							✎
						</button>
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
				</div>

				<!-- Each opening is a fresh mount, which is what the three forms require: they
				     read their seed once and a re-seed without a remount would leave stale
				     numbers over a live save path. The `{#if}` is what gives it — no `{#key}`
				     needed, since `row.key` is this block's own `{#each}` key and cannot
				     change while the block lives. -->
				{#if editingKey === row.key}
					{#if row.kind === 'flow'}
						<FlowLogForm
							seed={toMinutes(row.hours)}
							focusMinutes
							onsave={(minutes) => onsaveflow(row.id, minutes)}
							{oncancel}
						/>
					{:else if row.kind === 'drain'}
						<DrainLogForm
							seed={{
								minutes: toMinutes(row.hours),
								mind: row.mind,
								body: row.body,
							}}
							focusMinutes
							onsave={(entry) => onsavedrain(row.id, entry)}
							{oncancel}
						/>
					{:else}
						<RestLogForm
							seed={{
								minutes: toMinutes(row.hours),
								mindBefore: row.mind,
								mindAfter: row.mindAfter,
								bodyBefore: row.body,
								bodyAfter: row.bodyAfter,
							}}
							onsave={(entry) => onsaverest(row.id, entry)}
							{oncancel}
						/>
					{/if}
				{/if}
			</li>
		{/each}
	</ul>
{/if}
