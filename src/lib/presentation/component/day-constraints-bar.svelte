<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/presentation/utils';
	import { CAPACITY_POOL_MAX_HOURS } from '$lib/business/utils/capacity-pool-bounds';
	import { BUDGET_BOUNDS } from '$lib/presentation/utils/budget-bounds';
	import { formatDecimals } from '$lib/presentation/utils/number-format';
	import { NumberInput } from '$lib/presentation/component/ui/number-input';

	interface Props {
		availableHours: number;
		switchCost: number;
		cognitivePool: number;
		physicalPool: number;
		fittedCognitivePool: number | null;
		fittedPhysicalPool: number | null;
		remainingSuggestedHours: number;
		planSlackHours: number;
		planSwitchHours: number;
		locale: string;
		// Set at mount and then the user's to control — the browser owns the state from
		// there. The caller re-asks by remounting the bar (`{#key}` on the loaded day),
		// because a live value would slam the panel shut the moment its own hours field
		// stops reading 0.
		isOpen?: boolean;
		class?: string;
	}

	let {
		availableHours = $bindable(),
		switchCost = $bindable(),
		cognitivePool = $bindable(),
		physicalPool = $bindable(),
		fittedCognitivePool,
		fittedPhysicalPool,
		remainingSuggestedHours,
		planSlackHours,
		planSwitchHours,
		locale,
		isOpen = false,
		class: className,
	}: Props = $props();

	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let open = $state(isOpen);

	const switchCostMinutes = $derived(Math.round(switchCost * 60));

	// What the slider's `step` used to do, moved to the drag: see the range input below.
	const snapToStep = (hours: number) => Math.round(hours / BUDGET_BOUNDS.step) * BUDGET_BOUNDS.step;

	// Below this, the slack is rounding noise from the 15-minute blocks rather than
	// an hour anyone could spend — the summary and the warning must agree on it.
	const MINIMUM_REPORTED_SLACK_HOURS = 0.05;
	const hasSlack = $derived(planSlackHours > MINIMUM_REPORTED_SLACK_HOURS);

	// One template for the header and the controls, so each figure sits over its own
	// control from lg up: title column, four cells, the chevron's column.
	const COLUMNS = 'lg:grid-cols-[8rem_repeat(4,minmax(0,1fr))_1rem]';

	function updateSwitchCost(minutes: number) {
		switchCost = minutes / 60;
	}
</script>

<!-- A native disclosure: the summary is the control, so there is no button, no click
     handler and no `aria-expanded` to keep true. `bind:open` rather than a one-way
     attribute — a plain `open={…}` is re-applied on every re-render of the plan, which
     would shut the panel under the caret the first time a task landed; bound, the click
     goes into the state and the re-render agrees with it. `list-none` for the marker
     Safari draws even with a flex summary; the chevron below is this design's own. -->
<details class={cn('card-shell group px-box-md py-box-sm sm:px-box-xl', className)} bind:open>
	<summary
		class={cn(
			'grid list-none cursor-pointer grid-cols-[minmax(0,1fr)_1rem] items-baseline gap-x-grid-xl gap-y-text-xs',
			COLUMNS,
		)}
	>
		<span class="shrink-0 text-xs font-semibold text-ty-secondary uppercase tracking-wider">
			{m.budget_title()}
		</span>
		<span aria-hidden="true" class="col-start-2 row-start-1 text-lg leading-none lg:col-start-6">
			<span class="group-open:hidden">▾</span><span class="hidden group-open:inline">▴</span>
		</span>
		<!-- `lg:contents` lifts the four cells into the template's own columns; below lg
		     they wrap under the title as one row. -->
		<div class="col-span-full flex flex-wrap gap-x-grid-xl gap-y-text-2xs lg:contents">
			<span class="figure-cell">
				<span class="figure"
					>{availableHours}<span class="figure-unit">{m.unit_hour_symbol()}</span></span
				>
				{m.budget_figure_budget()}
				<span class="text-ty-secondary tabular-nums"
					>{formatDecimals(remainingSuggestedHours, 2, locale)} {m.unit_hour_symbol()}</span
				>
				{m.budget_figure_planned()}
				{#if hasSlack}
					<span class="text-warning-strong tabular-nums">
						{formatDecimals(planSlackHours, 2, locale)}
						{m.unit_hour_symbol()}
						{m.budget_figure_free()}
					</span>
				{/if}
			</span>
			<span class="figure-cell">
				<span class="figure"
					>{cognitivePool}<span class="figure-unit">{m.unit_hour_symbol()}</span></span
				>
				<span class="figure-dot bg-mind"></span>{m.budget_figure_mind()}
			</span>
			<span class="figure-cell">
				<span class="figure"
					>{physicalPool}<span class="figure-unit">{m.unit_hour_symbol()}</span></span
				>
				<span class="figure-dot bg-body"></span>{m.budget_figure_body()}
			</span>
			<span class="figure-cell">
				<span class="figure"
					>{switchCostMinutes}<span class="figure-unit">{m.unit_minutes()}</span></span
				>
				{m.budget_figure_per_switch()}
			</span>
		</div>
	</summary>

	<div class={cn('mt-text-md grid gap-x-grid-xl gap-y-text-lg sm:grid-cols-2', COLUMNS)}>
		<span class="hidden lg:block"></span>
		<div>
			<NumberInput
				id="available-hours"
				value={availableHours}
				onchange={(v) => (availableHours = v)}
				min={BUDGET_BOUNDS.min}
				max={BUDGET_BOUNDS.max}
				step={BUDGET_BOUNDS.step}
				unit={m.unit_hours()}
			/>
			<!-- Dragging re-solves the whole plan live (~1–13 ms at realistic task counts).
			     `step="any"` with the quarter applied on the way IN, not by the input: a
			     range sanitizes its DOM value to the nearest step, so a budget that is
			     legitimately off-quarter — typed here, or applied from a plan-advice
			     lever — left the thumb reading a value the field beside it disagreed
			     with. Snapping the drag keeps the quarters `step` was there for. -->
			<input
				id="available-hours-slider"
				type="range"
				aria-label={m.budget_hours_slider()}
				min={BUDGET_BOUNDS.min}
				max={BUDGET_BOUNDS.max}
				step="any"
				value={availableHours}
				oninput={(e) => (availableHours = snapToStep(e.currentTarget.valueAsNumber))}
				class="range-track mt-text-xs accent-brand"
			/>
			<p class="mt-text-xs text-xs text-ty-silent">
				<label for="available-hours" class="text-ty-secondary">{m.budget_available_hours()}</label>
				·
				{m.budget_allocated({
					planned: formatDecimals(remainingSuggestedHours, 2, locale),
					switching: formatDecimals(planSwitchHours, 2, locale),
				})}
				{#if !hasSlack}
					· {m.budget_fully_committed()}
				{/if}
			</p>
			{#if hasSlack}
				<p class="mt-text-2xs text-xs text-warning-strong" title={m.budget_unplanned_title()}>
					{m.budget_unplanned({
						hours: formatDecimals(planSlackHours, 2, locale),
					})}
				</p>
			{/if}
		</div>

		<div>
			<NumberInput
				id="cognitive-pool"
				value={cognitivePool}
				onchange={(v) => (cognitivePool = v)}
				min={0}
				max={CAPACITY_POOL_MAX_HOURS}
				step={0.5}
				unit={m.unit_hours()}
				accent="focus-within:border-mind-line"
			/>
			<p class="mt-text-xs text-xs text-ty-silent">
				<label for="cognitive-pool" class="text-ty-secondary">{m.budget_cognitive_capacity()}</label
				>
				· {m.budget_cognitive_hint()}
				{#if fittedCognitivePool !== null && fittedCognitivePool !== cognitivePool}
					·
					<button
						type="button"
						class="text-xs text-brand transition hover:text-brand-strong"
						onclick={() => (cognitivePool = fittedCognitivePool)}
					>
						{m.budget_use_fitted_pool({
							hours: String(fittedCognitivePool),
						})}
					</button>
				{/if}
			</p>
		</div>

		<div>
			<NumberInput
				id="physical-pool"
				value={physicalPool}
				onchange={(v) => (physicalPool = v)}
				min={0}
				max={CAPACITY_POOL_MAX_HOURS}
				step={0.5}
				unit={m.unit_hours()}
				accent="focus-within:border-body-line"
			/>
			<p class="mt-text-xs text-xs text-ty-silent">
				<label for="physical-pool" class="text-ty-secondary">{m.budget_physical_capacity()}</label>
				· {m.budget_physical_hint()}
				{#if fittedPhysicalPool !== null && fittedPhysicalPool !== physicalPool}
					·
					<button
						type="button"
						class="text-xs text-brand transition hover:text-brand-strong"
						onclick={() => (physicalPool = fittedPhysicalPool)}
					>
						{m.budget_use_fitted_pool({
							hours: String(fittedPhysicalPool),
						})}
					</button>
				{/if}
			</p>
		</div>
		<div>
			<NumberInput
				id="switch-cost"
				value={switchCostMinutes}
				onchange={updateSwitchCost}
				min={0}
				max={60}
				step={5}
				unit={m.unit_minutes()}
			/>
			<p class="mt-text-xs text-xs text-ty-silent">
				<label for="switch-cost" class="text-ty-secondary">{m.budget_switch_cost()}</label>
				· {m.budget_switch_cost_hint()}
			</p>
		</div>
	</div>
</details>
