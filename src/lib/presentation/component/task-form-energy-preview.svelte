<script lang="ts">
	/* The Lab's add-task form second column: what the task being typed would do to
	   the OPTIMIZED day. `EnergyLabStore` solves it on a button press (R2) — this
	   only labels it.

	   A sibling of `task-form-preview.svelte`, not a mode of it: a different plan
	   under the same draft. No bands and no bars — `AXIS_BAND` has no axis for end
	   energy and `PlanSummary` prints it unbanded, so a threshold invented here
	   would be a judgement the page above the form does not make. */

	import * as m from '$lib/paraglide/messages.js';
	import type { EnergyDraftImpact } from '$lib/business/model/metric/energy-draft-impact';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import { formatDecimals } from '$lib/presentation/utils/number-format';
	import { formatDuration, formatOffset } from '$lib/presentation/utils/duration-format';
	import StatTile from '$lib/presentation/component/stat-tile.svelte';

	interface Props {
		/** `null` until the button asks — the reading costs a full solve. */
		impact: EnergyDraftImpact | null;
		isBusy: boolean;
		hasWindow: boolean;
	}

	let { impact, isBusy, hasWindow }: Props = $props();

	const decimal = (value: number) => formatDecimals(value, 1, getDateLocale());
	/** Floored, like `PlanSummary`: 100% has to mean untouched. */
	const percent = (value: number) => Math.floor(value * 100);

	// One line with three shapes: a name beats a total, and the empty case is
	// said rather than dropped. `null` when the day funds the draft nothing — a
	// cost row about a task that is not in the plan.
	const cost = $derived.by(() => {
		if (impact === null || impact.startHour === null) return null;

		const { hoursTaken, taskCount, unfunded } = impact.displaced;

		if (unfunded.length > 0) {
			return m.form_impact_cost_unfunds({
				titles: unfunded.join(', '),
			});
		}

		if (taskCount === 0) return m.form_impact_cost_none();

		const hours = formatDuration(hoursTaken);

		return taskCount === 1
			? m.form_impact_cost_hours_one({
					hours,
				})
			: m.form_impact_cost_hours_other({
					hours,
					count: taskCount,
				});
	});
</script>

<!-- `whitespace-nowrap` on the value and not the label: these labels are long
     enough to wrap in a 1fr column, and the one thing that must not break
     across two lines is the before→after pair itself. -->
{#snippet changeRow(label: string, value: string)}
	<p class="flex items-baseline justify-between gap-grid-xs text-xs">
		<span class="text-ty-secondary">{label}</span>
		<span class="font-semibold whitespace-nowrap text-ty-primary tabular-nums">{value}</span>
	</p>
{/snippet}

<section class="space-y-grid-md">
	<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
		{m.form_impact_heading()}
	</h3>
	{#if !hasWindow}
		<!-- The page refuses to draw a plan without a window; the panel agrees with
		     it rather than printing figures off a plan that was never made. -->
		<p class="text-xs text-ty-silent">{m.energy_set_window()}</p>
	{:else if impact === null && isBusy}
		<p class="text-xs text-ty-silent">{m.form_impact_pricing()}</p>
	{:else if impact === null}
		<!-- The prompt line a reading that costs a solve renders in place of its
		     numbers (presentation/AGENTS.md). -->
		<p class="text-xs text-ty-silent">{m.form_impact_price_prompt()}</p>
	{:else}
		<!-- `surface-inset` and not `surface-card`: this sits INSIDE the reading
		     panel, which is itself a card, and card-on-card separates only by
		     compositing the same alpha twice — nothing on the opaque themes
		     (STYLE.md). -->
		<div class="rounded-xl border border-line-soft bg-surface-inset p-box-sm">
			<StatTile
				label={m.form_impact_hours()}
				value={formatDuration(impact.suggestedHours)}
				muted={impact.startHour === null}
			>
				{#snippet note()}
					{impact.startHour === null
						? m.form_impact_unfunded()
						: m.form_impact_starts_at({
								offset: formatOffset(impact.startHour),
							})}
				{/snippet}
			</StatTile>
		</div>

		{@render changeRow(
			m.energy_total_output(),
			m.form_impact_hours_change({
				before: decimal(impact.totalOutput.before),
				after: decimal(impact.totalOutput.after),
			}),
		)}

		{@render changeRow(
			m.form_impact_end_cognitive(),
			m.form_impact_percent_change({
				before: percent(impact.endCog.before),
				after: percent(impact.endCog.after),
			}),
		)}

		{@render changeRow(
			m.form_impact_end_physical(),
			m.form_impact_percent_change({
				before: percent(impact.endPhys.before),
				after: percent(impact.endPhys.after),
			}),
		)}

		{#if cost !== null}
			<p class="text-xs">
				<span class="block text-ty-secondary">{m.form_impact_cost()}</span>
				<span class="font-semibold text-ty-primary tabular-nums">{cost}</span>
			</p>
		{/if}
	{/if}
</section>
