<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import type { LogHistoryRow, LogKind } from '$lib/presentation/utils/log-history';
	import FlowLogForm from '$lib/presentation/component/flow-log-form.svelte';
	import DrainLogForm from '$lib/presentation/component/drain-log-form.svelte';
	import RestLogForm from '$lib/presentation/component/rest-log-form.svelte';

	interface Props {
		/** Already folded, filtered and ordered newest-first by `logHistory`. */
		rows: LogHistoryRow[];
		allTime: boolean;
		/** The PAGE's, not this list's: the page is what knows the events an open editor
		 *  must not outlive — a drop, a range change, a scope change, a save. */
		editingKey: string | null;
		ondelete: (kind: LogKind, id: number) => void;
		onedit: (kind: LogKind, id: number) => void;
		oncancel: () => void;
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

	// Minutes is the unit every editor takes, `hours` what the record and the fits
	// hold; the forms convert back on save, so only this direction is spelled here.
	const toMinutes = (hours: number) => Math.round(hours * 60);

	// The emoji is the fast read; the name is the only read for a screen reader.
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
	<ul class="nice-scrollbar mt-text-xs max-h-64 space-y-text-2xs overflow-y-auto">
		{#each rows as row (row.key)}
			<li>
				<div class="log-row">
					<span class="truncate">
						{#if row.taskTitle}
							{@const dayLabel = m.ana_logs_open_day({
								date: row.date,
							})}
							<!-- Labelled as well as titled: the visible text is a bare date, which
							     says nothing to a screen reader out of the row's context. -->
							<a
								href={localizeHref(`${resolve('/')}?date=${row.date}`)}
								aria-label={dayLabel}
								title={dayLabel}
								class="hint-underline text-ty-silent transition hover:text-ty-secondary"
							>
								{row.date}
							</a>
							<span class="capitalize"> · {row.taskTitle}</span>
						{:else}
							<!-- A ☕ has no task, so the kind fills the slot a task would; `aria-hidden`
							     because the ✕/✎ labels already say ☕ to a screen reader. -->
							<span class="text-ty-silent">{row.date}</span>
							<span aria-hidden="true" class="text-ty-silent">
								· {KIND[row.kind].name()}
							</span>
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
						<!-- Named by kind and day: a screen reader listing a 40-row list's buttons
						     would otherwise read the same two phrases forty times. -->
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

				<!-- The forms read their seed once, so each opening must be a fresh mount: this
				     `{#if}` is what gives it, and re-seeding a live one would leave stale numbers. -->
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
