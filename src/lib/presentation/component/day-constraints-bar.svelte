<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { BUDGET_BOUNDS } from '$lib/presentation/utils/budget-bounds';
	import { NumberInput } from '$lib/presentation/component/ui/number-input';

	interface Props {
		availableHours: number;
		switchCost: number;
		cognitivePool: number;
		physicalPool: number;
		remainingSuggestedHours: string;
		planSlackHours: number;
		// Sampled at mount and then the user's to control: the caller re-asks by
		// remounting the bar (`{#key}` on the loaded day), because a live value would
		// slam the panel shut the moment its own hours field stops reading 0.
		isOpen?: boolean;
	}

	let {
		availableHours = $bindable(),
		switchCost = $bindable(),
		cognitivePool = $bindable(),
		physicalPool = $bindable(),
		remainingSuggestedHours,
		planSlackHours,
		isOpen = false,
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

	const summary = $derived(
		[
			m.budget_summary({
				hours: availableHours,
				planned: remainingSuggestedHours,
			}),
			...(hasSlack
				? [
						m.budget_summary_free({
							slack: planSlackHours.toFixed(2),
						}),
					]
				: []),
			m.budget_summary_pools({
				mind: cognitivePool,
				body: physicalPool,
				switchMinutes: switchCostMinutes,
			}),
		].join(' · '),
	);

	function updateSwitchCost(minutes: number) {
		switchCost = minutes / 60;
	}
</script>

<div class="card-shell px-box-md py-box-sm sm:px-box-xl">
	<button
		type="button"
		aria-expanded={open}
		onclick={() => (open = !open)}
		class="flex w-full items-baseline justify-between gap-grid-xs text-left"
	>
		<!-- A span, not a heading: a heading is flow content, which a button may not
		     contain, and its text lands in the button's accessible name anyway. -->
		<span class="shrink-0 text-xs font-semibold text-ty-secondary uppercase tracking-wider">
			{m.budget_title()}
		</span>
		<span class="flex min-w-0 items-baseline gap-grid-xs text-xs text-ty-silent">
			{#if !open}
				<span class="truncate">{summary}</span>
			{/if}
			<span class="shrink-0 text-lg leading-none">{open ? '▴' : '▾'}</span>
		</span>
	</button>

	{#if open}
		<!-- The bar spans both page columns, so all five fit on one row from lg up. -->
		<div class="mt-text-md grid gap-x-grid-xl gap-y-text-lg sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<label for="available-hours" class="mb-text-2xs block text-xs text-ty-silent">
					{m.budget_available_hours()}
				</label>
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
					type="range"
					aria-label={m.budget_hours_slider()}
					min={BUDGET_BOUNDS.min}
					max={BUDGET_BOUNDS.max}
					step="any"
					value={availableHours}
					oninput={(e) => (availableHours = snapToStep(e.currentTarget.valueAsNumber))}
					class="mt-text-xs h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-inset accent-brand"
				/>
				<p class="mt-text-xs text-xs text-ty-silent">
					{m.budget_allocated({
						hours: remainingSuggestedHours,
					})}
				</p>
				{#if hasSlack}
					<p class="mt-text-2xs text-xs text-warning-strong" title={m.budget_unplanned_title()}>
						{m.budget_unplanned({
							hours: planSlackHours.toFixed(2),
						})}
					</p>
				{/if}
			</div>

			<div>
				<label for="switch-cost" class="mb-text-2xs block text-xs text-ty-silent">
					{m.budget_switch_cost()}
				</label>
				<NumberInput
					id="switch-cost"
					value={switchCostMinutes}
					onchange={updateSwitchCost}
					min={0}
					max={60}
					step={5}
					unit={m.unit_minutes()}
				/>
				<p class="mt-text-xs text-xs text-ty-silent">{m.budget_switch_cost_hint()}</p>
			</div>

			<div>
				<label for="cognitive-pool" class="mb-text-2xs block text-xs text-ty-silent">
					{m.budget_cognitive_capacity()}
				</label>
				<NumberInput
					id="cognitive-pool"
					value={cognitivePool}
					onchange={(v) => (cognitivePool = v)}
					min={0}
					max={16}
					step={0.5}
					unit={m.unit_hours()}
					accent="focus-within:border-mind/50"
				/>
				<p class="mt-text-xs text-xs text-ty-silent">{m.budget_cognitive_hint()}</p>
			</div>

			<div>
				<label for="physical-pool" class="mb-text-2xs block text-xs text-ty-silent">
					{m.budget_physical_capacity()}
				</label>
				<NumberInput
					id="physical-pool"
					value={physicalPool}
					onchange={(v) => (physicalPool = v)}
					min={0}
					max={16}
					step={0.5}
					unit={m.unit_hours()}
					accent="focus-within:border-body/50"
				/>
				<p class="mt-text-xs text-xs text-ty-silent">{m.budget_physical_hint()}</p>
			</div>
		</div>
	{/if}
</div>
