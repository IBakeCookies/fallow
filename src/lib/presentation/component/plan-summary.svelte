<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { HINT_UNDERLINE_CLASS } from '$lib/presentation/component/hint-underline';
	import { formatDuration } from '$lib/presentation/utils/duration-format';

	interface Props {
		/** Σ of the plan's block outputs, already formatted in the reader's locale */
		totalOutput: string;
		/** Both capacities at the end of the day, as fractions of full */
		endCog: number;
		endPhys: number;
		workHours: number;
		/** How this plan compares with the classic allocator's, in per cent. Null when
		 *  there is no rival plan to compare against. */
		outputVsClassic: number | null;
	}

	let { totalOutput, endCog, endPhys, workHours, outputVsClassic }: Props = $props();
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
		<p class="text-lg font-semibold text-ty-primary">
			{Math.round(endCog * 100)}% / {Math.round(endPhys * 100)}%
		</p>
		<p class="text-xs text-ty-silent">{m.energy_end_energy()}</p>
	</div>
	<div>
		<p class="text-lg font-semibold text-ty-primary">{formatDuration(workHours)}</p>
		<p class="text-xs text-ty-silent">{m.energy_planned_work()}</p>
	</div>
	<div>
		{#if outputVsClassic === null}
			<p class="text-lg font-semibold text-ty-silent">—</p>
			<p class="text-xs text-ty-silent">{m.energy_no_classic()}</p>
		{:else}
			<p class="text-lg font-semibold {outputVsClassic >= 0 ? 'text-success' : 'text-warning'}">
				{outputVsClassic >= 0 ? '+' : ''}{outputVsClassic}%
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
							<p {...props} class="w-fit text-xs text-ty-silent {HINT_UNDERLINE_CLASS}">
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
