<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import CalibrationCard from '$lib/presentation/component/calibration-card.svelte';

	interface Props {
		/** Every 🪫 rating, which is what the headline counts */
		logCount: number;
		/** Ratings dated on or after today: α reads days strictly before it */
		pendingLogs?: number;
	}

	let { logCount, pendingLogs = 0 }: Props = $props();
</script>

<CalibrationCard title={m.energy_calibration()} hint={m.energy_calibration_hint()}>
	<!-- The headline counts every rating, including the ones α has not read yet; the
	     line below names those, and the sentence under it is how a rating is made. -->
	<div class="mt-text-sm flex items-baseline gap-text-xs">
		<span class="text-2xl leading-none font-medium tabular-nums text-ty-primary">{logCount}</span>
		<span class="text-xs text-ty-silent">
			{logCount === 1 ? m.drain_calibration_logs_one() : m.drain_calibration_logs()}
		</span>
	</div>

	{#if pendingLogs > 0}
		<p class="mt-text-sm text-xs text-ty-silent">
			{pendingLogs === 1
				? m.energy_drain_pending_one()
				: m.energy_drain_pending({
						count: pendingLogs,
					})}
		</p>
	{/if}

	<p class="mt-text-sm text-xs text-ty-silent">
		{logCount === 0 ? m.energy_calibration_empty() : m.energy_calibration_rated()}
	</p>
</CalibrationCard>
