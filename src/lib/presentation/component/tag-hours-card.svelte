<script lang="ts">
	import type { TagHoursBreakdown } from '$lib/business/model/tags';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		breakdown: TagHoursBreakdown | null;
		hasFailed: boolean;
		locale: string;
	}

	let { breakdown, hasFailed, locale }: Props = $props();

	// Rounded here rather than in the fold, which has to stay exact: the parts add
	// up to the "Logged hours" tile this card breaks down.
	const hours = (value: number) => (Math.round(value * 10) / 10).toLocaleString(locale);

	// The untagged row last, and only when there is one: it is the coverage
	// disclosure, not a slot the card always keeps.
	const rows = $derived(
		breakdown === null
			? []
			: [
					...breakdown.tags.map((row) => ({
						label: row.tag,
						hours: row.hours,
					})),
					...(breakdown.untaggedHours > 0
						? [
								{
									label: m.ana_tag_hours_untagged(),
									hours: breakdown.untaggedHours,
								},
							]
						: []),
				],
	);
</script>

<div class="card-shell mt-grid-xl rounded-xl p-box-lg">
	<h2 class="text-sm font-medium text-ty-primary">{m.ana_tag_hours()}</h2>
	<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_tag_hours_hint()}</p>

	{#if hasFailed}
		<p class="mt-text-md text-sm text-danger-strong">{m.error_title()}</p>
	{:else if breakdown === null}
		<p class="mt-text-md text-sm text-ty-silent">{m.ana_loading()}</p>
	{:else if rows.length === 0}
		<p class="mt-text-md text-sm text-ty-secondary">{m.ana_tag_hours_empty()}</p>
	{:else}
		<ul class="mt-text-md grid gap-text-xs">
			{#each rows as row (row.label)}
				<li class="flex flex-wrap items-baseline justify-between gap-x-grid-xs">
					<span class="text-xs text-ty-silent">{row.label}</span>
					<span class="text-sm font-medium text-ty-primary">
						<span style="font-variant-numeric: tabular-nums">{hours(row.hours)}</span>
						{m.unit_hours()}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
