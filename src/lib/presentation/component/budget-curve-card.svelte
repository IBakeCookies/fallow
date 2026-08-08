<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { BudgetCurve } from '$lib/business/model/zenith-energy';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import { formatDecimals } from '$lib/presentation/utils/number-format';
	import BudgetCurveChart from '$lib/presentation/component/budget-curve-chart.svelte';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { Button } from '$lib/presentation/component/ui/button';

	interface Props {
		/** Null until the user asks: the sweep costs a full solve per step. */
		curve: BudgetCurve | null;
		isBusy: boolean;
		/** The day changed after this curve was calculated. */
		isStale: boolean;
		/** The last sweep failed; the curve shown (if any) predates the failure. */
		hasError: boolean;
		/** The window the day is set to now. */
		currentBudget: number;
		/** For λ₀, which the stop advisor beside this card also prints locale-formatted. */
		locale: string;
		oncheck: () => void;
		/** Adopt the recommended window — writes the day's budget. */
		onapply: (hours: number) => void;
	}

	let { curve, isBusy, isStale, hasError, currentBudget, locale, oncheck, onapply }: Props =
		$props();

	const recommended = $derived(
		curve === null || curve.recommendedHours === null
			? null
			: (curve.points.find((p) => p.budgetHours === curve.recommendedHours) ?? null),
	);

	// The other reason there is no recommendation: not that the sweep ran out, but
	// that no window was worth working at this λ₀ (MATH.md §8.12). Same null,
	// opposite reading — "it would use every hour you give it" is the exact
	// inverse of the truth here, so the branch is on the points, not on the null.
	const booksNoWork = $derived(curve !== null && curve.points.every((p) => p.workHours === 0));
</script>

<!-- Until the user asks, this is one button and nothing else: a card advertising
     a feature it has not run yet is pure vertical cost above the plan. -->
{#if !curve}
	<div class="flex items-baseline justify-end gap-grid-xs">
		{#if hasError}
			<p class="text-xs text-danger">{m.energy_curve_error()}</p>
		{/if}
		<!-- The same tooltip the rest of the app uses, not `title=`: what this
		     button costs and what it does is two sentences, which a native tooltip
		     truncates and touch never shows at all. `child` keeps the Button. -->
		<Tooltip.Provider delayDuration={150}>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="outline" size="sm" disabled={isBusy} onclick={oncheck}>
							{isBusy ? m.energy_curve_working() : m.energy_curve_check()}
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom" align="end" class="max-w-md">
					<p>{m.energy_curve_desc()}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	</div>
{:else}
	<div class="card-shell p-box-md sm:p-box-xl">
		<div class="flex items-start justify-between gap-grid-xs">
			<div class="min-w-0">
				<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
					{m.energy_curve_title()}
				</h3>
				<p class="mt-text-xs text-xs text-ty-silent">{m.energy_curve_desc()}</p>
			</div>
			<Button variant="outline" size="sm" disabled={isBusy} onclick={oncheck}>
				{isBusy ? m.energy_curve_working() : m.energy_curve_recheck()}
			</Button>
		</div>

		{#if hasError}
			<p
				class="mt-grid-sm rounded-lg border border-danger/20 bg-danger/5 p-box-sm text-xs text-danger-strong"
			>
				{m.energy_curve_error()}
			</p>
		{/if}

		{#if isStale}
			<p
				class="mt-grid-sm rounded-lg border border-warning/20 bg-warning/5 p-box-sm text-xs text-warning-strong"
			>
				{m.energy_curve_stale()}
			</p>
		{/if}

		<!-- No empty-curve branch: `suggestBudgetCurve` returns no points only for an
		     empty task list, and this card is mounted inside the page's `hasTasks`
		     gate — so is the button that runs the sweep. -->
		<BudgetCurveChart {curve} {currentBudget} />

		<!-- The verdict, in the three shapes the model can actually produce. The last
		     two are both "no recommendation" and read in opposite directions — the
		     sweep ran out, or free time outbid every window — and neither is a
		     failure to report. The hint they share names the one parameter that
		     moves either of them (MATH.md §8.12). -->
		<div class="mt-grid-sm border-t border-line-soft pt-box-sm">
			{#if recommended !== null}
				<div class="flex flex-wrap items-baseline justify-between gap-grid-xs">
					<p class="text-sm text-ty-secondary">
						{m.energy_curve_recommendation({
							hours: formatDuration(recommended.budgetHours),
							work: formatDuration(recommended.workHours),
						})}
					</p>
					<Button
						variant="outline"
						size="sm"
						onclick={() => onapply(recommended.budgetHours)}
						aria-label={m.energy_curve_apply_label({
							hours: formatDuration(recommended.budgetHours),
						})}
					>
						{m.energy_curve_apply()}
					</Button>
				</div>
			{:else}
				<p class="text-sm text-ty-secondary">
					{#if booksNoWork}
						{m.energy_curve_no_work({
							max: formatDuration(curve.maxBudgetHours),
						})}
					{:else}
						{m.energy_curve_no_crossing({
							max: formatDuration(curve.maxBudgetHours),
						})}
					{/if}
				</p>
				<p class="mt-text-2xs text-xs text-ty-silent">
					{m.energy_curve_no_crossing_hint({
						value: formatDecimals(curve.freeTimeValue, 2, locale),
					})}
				</p>
			{/if}
		</div>
	</div>
{/if}
