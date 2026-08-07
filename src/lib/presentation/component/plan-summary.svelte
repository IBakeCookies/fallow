<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { formatDuration } from '$lib/presentation/utils/duration-format';

	interface Props {
		/** Σ of the plan's block outputs, already formatted in the reader's locale */
		totalOutput: string;
		/** Both capacities as the last worked block leaves them, as fractions of full
		 *  — before the evening's recovery, which is what the reader is asking about
		 *  (MATH.md §13.6) */
		endCog: number;
		endPhys: number;
		workHours: number;
		/** How this plan compares with the classic allocator's under the model's own
		 *  objective, in per cent. Null when there is no rival plan to compare against. */
		valueVsClassic: number | null;
	}

	let { totalOutput, endCog, endPhys, workHours, valueVsClassic }: Props = $props();
</script>

<!-- The objective readout, visible under both the chart and the schedule -->
<div
	class="mt-text-lg grid grid-cols-2 gap-grid-md border-t border-line-soft pt-box-md sm:grid-cols-4"
>
	<div>
		<p class="text-lg font-semibold text-ty-primary">{totalOutput}</p>
		<p class="text-xs text-ty-silent">{m.energy_total_output()}</p>
	</div>
	<div>
		<!-- Floor, not round: 100% has to mean untouched. Rounding printed it for
		     anything from 99.5% up, so a day that had visibly drained you read as
		     completely fresh. Erring down is the honest direction for a depletion
		     reading. -->
		<p class="text-lg font-semibold text-ty-primary">
			{Math.floor(endCog * 100)}% / {Math.floor(endPhys * 100)}%
		</p>
		<p class="text-xs text-ty-silent">{m.energy_end_energy()}</p>
	</div>
	<div>
		<p class="text-lg font-semibold text-ty-primary">{formatDuration(workHours)}</p>
		<p class="text-xs text-ty-silent">{m.energy_planned_work()}</p>
	</div>
	<div>
		{#if valueVsClassic === null}
			<p class="text-lg font-semibold text-ty-silent">—</p>
			<p class="text-xs text-ty-silent">{m.energy_no_classic()}</p>
		{:else}
			<!-- Three readings, not two: a gap under half a point rounds to 0, and
			     `Math.round` returns -0 for a small LOSS, which `>= 0` reads as a win —
			     the tile signed a beaten plan green. A tie is neither. -->
			<p
				class="text-lg font-semibold {valueVsClassic > 0
					? 'text-success'
					: valueVsClassic < 0
						? 'text-warning'
						: 'text-ty-primary'}"
			>
				{valueVsClassic > 0 ? '+' : ''}{valueVsClassic}%
			</p>
			<!-- The only reading on this page that switch cost and the capacity pools reach
			     at all: they constrain the rival plan, never the schedule above. Said out
			     loud, or the number moves for no visible reason when those are edited on the
			     main page.

			     A tooltip and not `title=`: two sentences is past what a native tooltip
			     shows, and touch shows one never. `child` keeps the tile's
			     <p>value</p><p>label</p> shape, which the e2e reads by preceding sibling. -->
			<Tooltip.Provider delayDuration={150}>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<p {...props} class="hint-underline w-fit text-xs text-ty-silent">
								{m.energy_vs_classic()}
							</p>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content class="max-w-md">
						<p>{m.energy_vs_classic_title()}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}
	</div>
</div>
