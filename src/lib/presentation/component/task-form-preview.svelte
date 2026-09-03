<script lang="ts">
	/* The add-task form's second column: what the task being typed would do to
	   today. `DailyPlanStore` solves it (R2) — this only labels and bands it.

	   A reading over a plan nobody deployed, so it offers no lever: the way to
	   act on it is the form beside it. */

	import * as m from '$lib/paraglide/messages.js';
	import type { DraftChange, DraftImpact } from '$lib/business/model/metric/draft-impact';
	import {
		AXIS_BAND,
		BAND_BAR_CLASS,
		BAND_TEXT_CLASS,
		bandLabel,
	} from '$lib/presentation/utils/band';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import StatTile from '$lib/presentation/component/stat-tile.svelte';

	interface Props {
		/** `null` while the draft is unnamed — an unnamed task is not priced. */
		impact: DraftImpact | null;
	}

	let { impact }: Props = $props();

	// A pool of 0 hours saturates to Infinity, so its row is dropped rather than
	// printed as "Infinity%" (`metric-descriptor` gates the same reading).
	const pools = $derived(
		impact === null
			? []
			: [
					{
						label: m.form_impact_physical_pool(),
						change: impact.physicalPercent,
					},
					{
						label: m.form_impact_cognitive_pool(),
						change: impact.cognitivePercent,
					},
				].filter((row) => Number.isFinite(row.change.before) && Number.isFinite(row.change.after)),
	);
</script>

{#snippet poolRow(label: string, change: DraftChange)}
	{@const band = AXIS_BAND.humanCapacity(change.after)}
	<div>
		<p class="flex items-baseline justify-between gap-grid-xs text-xs">
			<span class="text-ty-secondary">{label}</span>
			<span class="font-semibold tabular-nums {BAND_TEXT_CLASS[band]}">
				{m.form_impact_percent_change({
					before: Math.round(change.before),
					after: Math.round(change.after),
				})}
				<!-- Colour is otherwise the only carrier of the band (WCAG 1.4.1). -->
				{#if bandLabel(band)}
					<span class="sr-only">{bandLabel(band)}</span>
				{/if}
			</span>
		</p>
		<div class="mt-text-2xs h-1 w-full rounded-full bg-surface-inset">
			<div
				class="h-full rounded-full {BAND_BAR_CLASS[band]}"
				style="width: {Math.min(100, Math.max(0, change.after))}%"
			></div>
		</div>
	</div>
{/snippet}

<section class="space-y-grid-md">
	<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
		{m.form_impact_heading()}
	</h3>
	{#if impact === null}
		<!-- The prompt line a reading that costs a solve renders in place of its
		     numbers (presentation/AGENTS.md), and here also the honest answer: an
		     unnamed task is not a task the day can be priced with. -->
		<p class="text-xs text-ty-silent">{m.form_impact_prompt()}</p>
	{:else}
		<!-- `surface-inset` and not `surface-card`: this sits INSIDE the reading
		     panel, which is itself a card, and card-on-card separates only by
		     compositing the same alpha twice — nothing on the opaque themes
		     (STYLE.md). -->
		<div class="rounded-xl border border-line-soft bg-surface-inset p-box-sm">
			<StatTile
				label={m.form_impact_hours()}
				value={formatDuration(impact.suggestedHours)}
				muted={impact.position === null}
			>
				{#snippet note()}
					{impact.position === null
						? m.form_impact_unfunded()
						: m.form_impact_position({
								position: impact.position,
								count: impact.fundedCount,
							})}
				{/snippet}
			</StatTile>
		</div>
		<p class="flex items-baseline justify-between gap-grid-xs text-xs">
			<span class="text-ty-secondary">{m.form_impact_priority()}</span>
			<span class="font-semibold text-ty-primary tabular-nums"
				>{impact.priorityScore.toFixed(1)}</span
			>
		</p>
		{#each pools as row (row.label)}
			{@render poolRow(row.label, row.change)}
		{/each}
		<p class="flex items-baseline justify-between gap-grid-xs text-xs">
			<span class="text-ty-secondary">{m.form_impact_slack()}</span>
			<span class="font-semibold text-ty-primary tabular-nums">
				{m.form_impact_hours_change({
					before: formatDuration(impact.slackHours.before),
					after: formatDuration(impact.slackHours.after),
				})}
			</span>
		</p>
	{/if}
</section>
