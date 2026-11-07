<script lang="ts">
	import { cn } from '$lib/presentation/utils';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { NumberInput } from '$lib/presentation/component/ui/number-input';
	import type { FitLine } from '$lib/presentation/utils/calibration-descriptor';

	/* One model parameter: what it is called, what it means, and its stepper. Nine of
	   these make up the Lab's parameter card, and each carries a hint because none of
	   the names mean anything on their own. */

	interface Props {
		/** Ties the label to the stepper's input, and names it for the e2e */
		id: string;
		label: string;
		hint: string;
		value: number;
		onchange: (value: number) => void;
		min: number;
		max: number;
		step: number;
		unit: string;
		/** Focus tint, where the parameter belongs to one capacity */
		accent?: string;
		/** What the user's own logs fit, formatted; absent when there are none */
		fit?: FitLine;
		/** The logs that fit has not read yet, named; absent when there are none */
		pending?: string;
		class?: string;
	}

	let {
		id,
		label,
		hint,
		value,
		onchange,
		min,
		max,
		step,
		unit,
		accent,
		fit,
		pending,
		class: className,
	}: Props = $props();
</script>

<div class={cn(className)}>
	<div class="mb-text-2xs flex items-baseline justify-between gap-text-xs">
		<!-- Its own provider, like every other explained label in the app: a row that only
		     works under an ancestor provider is a row no story or spec can mount. -->
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<label {...props} for={id} class="hint-underline block w-fit text-xs text-ty-secondary">
							{label}
						</label>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="left">
					<p>{hint}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		{#if fit}
			<span
				id="{id}-fit"
				class={fit.hasSignal ? 'text-xs tabular-nums text-info-strong' : 'text-xs text-ty-silent'}
			>
				{fit.text}
			</span>
		{/if}
	</div>
	<NumberInput {id} {value} {onchange} {min} {max} {step} {unit} {accent} />
	{#if pending}
		<p id="{id}-pending" class="mt-text-2xs text-xs text-ty-silent">{pending}</p>
	{/if}
</div>
