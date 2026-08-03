<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { Persisted, FlowObservationRecord } from '$lib/business/type';
	import { cn } from '$lib/presentation/utils';
	import { NumberInput } from '$lib/presentation/component/ui/number-input';
	import LogList from '$lib/presentation/component/log-list.svelte';

	interface Props {
		availableHours: number;
		switchCost: number;
		cognitivePool: number;
		physicalPool: number;
		remainingSuggestedHours: string;
		planSlackHours: number;
		/** whether the personalized ϕ fit was accepted (implausible fits are not) */
		constantsFitted: boolean;
		flowLogs?: Persisted<FlowObservationRecord>[];
		/** whether the viewed day's tasks can be ⚡-logged at all — false off today,
		 *  where the prompt would point at a button no task renders */
		canLogFlow?: boolean;
		ondeletelog?: (id: number) => void;
		onresetlogs?: () => void;
		// Collapsed, the whole bar is one line carrying every constraint the plan
		// reads. These are occasional-use inputs and the plan below them is what
		// the page is for, so expanding is opt-in. Sampled at mount and then the
		// user's to control: the caller re-asks by remounting the bar (`{#key}` on
		// the loaded day), because a live value would slam the panel shut the
		// moment its own hours field stops reading 0.
		isOpen?: boolean;
	}

	let {
		availableHours = $bindable(),
		switchCost = $bindable(),
		cognitivePool = $bindable(),
		physicalPool = $bindable(),
		remainingSuggestedHours,
		planSlackHours,
		constantsFitted,
		flowLogs = [],
		canLogFlow = true,
		ondeletelog,
		onresetlogs,
		isOpen = false,
	}: Props = $props();

	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let open = $state(isOpen);

	// Display switch cost in minutes but store in hours
	const switchCostMinutes = $derived(Math.round(switchCost * 60));

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

	const modelStatus = $derived(
		constantsFitted
			? flowLogs.length === 1
				? m.model_status_personalized_one()
				: m.model_status_personalized({
						count: flowLogs.length,
					})
			: flowLogs.length > 0
				? flowLogs.length === 1
					? m.model_status_implausible_one()
					: m.model_status_implausible({
							count: flowLogs.length,
						})
				: m.model_status_default(),
	);

	// Two model states earn a line while collapsed: a rejected fit (a mistyped log to
	// go fix) and no logs at all — `model_status_default` is the only sentence in the
	// app that says ⚡ exists. A healthy fit is reassurance and stays inside; a future
	// day gets neither, since no task there offers a ⚡ button.
	const modelWarning = $derived(!constantsFitted && flowLogs.length > 0);
	const modelPrompt = $derived(canLogFlow && flowLogs.length === 0);

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

	{#if !open && (modelWarning || modelPrompt)}
		<p class={cn('mt-text-2xs text-xs', modelWarning ? 'text-warning-strong' : 'text-ty-silent')}>
			{modelStatus}
		</p>
	{/if}

	{#if open}
		<!-- The bar spans both page columns, so all four fit on one row from lg up. -->
		<div class="mt-text-md grid gap-x-grid-xl gap-y-text-lg sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<label for="available-hours" class="mb-text-2xs block text-xs text-ty-silent">
					{m.budget_available_hours()}
				</label>
				<NumberInput
					id="available-hours"
					value={availableHours}
					onchange={(v) => (availableHours = v)}
					min={0}
					max={24}
					step={0.25}
					unit={m.unit_hours()}
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

		<div class="mt-text-lg border-t border-line-soft pt-box-sm">
			<LogList
				label={modelStatus}
				title={m.budget_model_tooltip()}
				items={flowLogs}
				confirmLabel={m.budget_reset_confirm({
					count: flowLogs.length,
				})}
				resetLabel={m.budget_reset_personalization()}
				resetTitle={m.budget_reset_title()}
				onreset={onresetlogs}
			>
				{#snippet row(log)}
					<span class="truncate">
						<span class="text-ty-silent">{log.date}</span>
						<span class="capitalize"> · {log.taskTitle}</span>
					</span>
					<span class="flex shrink-0 items-center gap-text-xs">
						<span class="font-medium text-flow/90">⚡ {Math.round(log.phiHours * 60)}m</span>
						{#if ondeletelog}
							<button
								type="button"
								aria-label={m.budget_delete_log_aria()}
								title={m.budget_delete_log_title()}
								class="text-ty-silent transition hover:text-danger"
								onclick={() => ondeletelog(log.id)}
							>
								✕
							</button>
						{/if}
					</span>
				{/snippet}
			</LogList>
		</div>
	{/if}
</div>
