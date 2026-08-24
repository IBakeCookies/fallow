<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import CalibrationCard from '$lib/presentation/component/calibration-card.svelte';
	import FitLogSummary from '$lib/presentation/component/fit-log-summary.svelte';

	interface Props {
		constantsFitted: boolean;
		/** Every ⚡ log, which is what a reset deletes */
		logCount: number;
		/** Logs dated on or after the planned day: no fit has counted them (MATH.md §33) */
		pendingLogs?: number;
		onresetlogs?: () => void;
	}

	let { constantsFitted, logCount, pendingLogs = 0, onresetlogs }: Props = $props();

	const fitCountedLogs = $derived(logCount - pendingLogs);

	const fitStatus = $derived(
		constantsFitted
			? fitCountedLogs === 1
				? m.model_status_personalized_one()
				: m.model_status_personalized({
						count: fitCountedLogs,
					})
			: fitCountedLogs > 0
				? fitCountedLogs === 1
					? m.model_status_implausible_one()
					: m.model_status_implausible({
							count: fitCountedLogs,
						})
				: m.model_status_default(),
	);

	const pendingStatus = $derived(
		pendingLogs === 1
			? m.model_status_pending_one()
			: m.model_status_pending({
					count: pendingLogs,
				}),
	);

	// With nothing counted yet, `model_status_default` would tell the user to go log
	// the ⚡ they have just logged.
	const modelStatus = $derived(
		pendingLogs === 0
			? fitStatus
			: fitCountedLogs === 0
				? pendingStatus
				: `${fitStatus} · ${pendingStatus}`,
	);
</script>

<CalibrationCard title={m.flow_calibration()} hint={m.budget_model_tooltip()}>
	<!-- The headline counts every log; the sentence below says how many the fit used,
	     which MATH.md §33 makes a different number on the day a log is made. -->
	<div class="mt-text-sm flex items-baseline gap-text-xs">
		<span class="text-2xl leading-none font-medium tabular-nums text-ty-primary">{logCount}</span>
		<span class="text-xs text-ty-silent">
			{logCount === 1 ? m.flow_calibration_logs_one() : m.flow_calibration_logs()}
		</span>
	</div>

	<div class="mt-text-sm">
		<FitLogSummary
			label={modelStatus}
			count={logCount}
			confirmLabel={m.budget_reset_confirm({
				count: logCount,
			})}
			resetLabel={m.budget_reset_personalization()}
			resetTitle={m.budget_reset_title()}
			onreset={onresetlogs}
		/>
	</div>
</CalibrationCard>
