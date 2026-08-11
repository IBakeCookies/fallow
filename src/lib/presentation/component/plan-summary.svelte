<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { BAND_TEXT_CLASS } from '$lib/presentation/utils/band';
	import { formatDuration } from '$lib/presentation/utils/duration-format';

	interface Props {
		totalOutput: string;
		/** Fractions of full as the last worked block leaves them, before the evening's
		 *  recovery (MATH.md §13.6) */
		endCog: number;
		endPhys: number;
		workHours: number;
		/** This plan against the classic allocator's, under the model's own objective, in per cent */
		valueVsClassic: number | null;
	}

	let { totalOutput, endCog, endPhys, workHours, valueVsClassic }: Props = $props();
</script>

<div
	class="mt-text-lg grid grid-cols-2 gap-grid-md border-t border-line-soft pt-box-md sm:grid-cols-4"
>
	<div>
		<p class="text-lg font-semibold text-ty-primary">{totalOutput}</p>
		<p class="text-xs text-ty-silent">{m.energy_total_output()}</p>
	</div>
	<div>
		<!-- Floor, not round: 100% has to mean untouched, and rounding printed it from
		     99.5% up. Erring down is the honest direction for a depletion reading. -->
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
			<!-- Three readings, not two: a rounded small LOSS arrives as -0, which `>= 0`
			     reads as a win — the tile signed a beaten plan green. A tie is neither. -->
			<p
				class="text-lg font-semibold {BAND_TEXT_CLASS[
					valueVsClassic > 0 ? 'success' : valueVsClassic < 0 ? 'warning' : 'neutral'
				]}"
			>
				{valueVsClassic > 0 ? '+' : ''}{valueVsClassic}%
			</p>
			<!-- Switch cost and the capacity pools reach this number and nothing else on
			     the page, so it moves when they are edited elsewhere — hence the tooltip.
			     `child` keeps the tile's <p>value</p><p>label</p> shape, which the e2e
			     reads by preceding sibling. -->
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
