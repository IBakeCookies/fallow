<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { describeDrainPending } from '$lib/presentation/utils/calibration-descriptor';
	import CalibrationCard from '$lib/presentation/component/calibration-card.svelte';

	interface Props {
		/** Every 🪫 rating, which is what the headline counts */
		logCount: number;
		/** Ratings dated on or after today: α reads days strictly before it */
		pendingLogs?: number;
		/** Whether either α moved off its default; null until the fit has answered */
		ratesFitted: boolean | null;
		class?: string;
	}

	let { logCount, pendingLogs = 0, ratesFitted, class: className }: Props = $props();

	const fitCountedLogs = $derived(logCount - pendingLogs);

	// The fit's answer about the ratings it read: nothing before it answers, and
	// nothing where it had no rating to answer about.
	const fitStatus = $derived(
		ratesFitted === null || fitCountedLogs === 0
			? null
			: ratesFitted
				? fitCountedLogs === 1
					? m.drain_status_personalized_one()
					: m.drain_status_personalized({
							count: fitCountedLogs,
						})
				: fitCountedLogs === 1
					? m.drain_status_no_signal_one()
					: m.drain_status_no_signal({
							count: fitCountedLogs,
						}),
	);
</script>

<CalibrationCard
	title={m.energy_calibration()}
	hint={m.energy_calibration_hint()}
	class={className}
>
	<!-- The headline counts every rating, including the ones α has not read yet; the
	     status says what α made of the ones it did, and the line below names the rest.
	     How a rating is made is the empty state's sentence alone. -->
	<div class="mt-text-sm flex items-baseline gap-text-xs">
		<span class="text-2xl leading-none font-medium tabular-nums text-ty-primary">{logCount}</span>
		<span class="text-xs text-ty-silent">
			{logCount === 1 ? m.drain_calibration_logs_one() : m.drain_calibration_logs()}
		</span>
	</div>

	{#if fitStatus}
		<p class="mt-text-sm text-xs text-ty-silent">{fitStatus}</p>
	{/if}

	{#if pendingLogs > 0}
		<p class="mt-text-sm text-xs text-ty-silent">
			{describeDrainPending(pendingLogs)}
		</p>
	{/if}

	{#if logCount === 0}
		<p class="mt-text-sm text-xs text-ty-silent">
			{m.energy_calibration_empty()}
		</p>
	{/if}
</CalibrationCard>
