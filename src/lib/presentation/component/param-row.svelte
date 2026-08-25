<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { NumberInput } from '$lib/presentation/component/ui/number-input';

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
		/** What the user's own logs fit, formatted; `null` when they carry no signal, absent when there are none */
		fit?: string | null;
	}

	let { id, label, hint, value, onchange, min, max, step, unit, accent, fit }: Props = $props();
</script>

<div>
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
		{#if fit !== undefined}
			<span
				id="{id}-fit"
				class={fit === null ? 'text-xs text-ty-silent' : 'text-xs tabular-nums text-info-strong'}
			>
				{fit ?? m.energy_fit_no_signal()}
			</span>
		{/if}
	</div>
	<NumberInput {id} {value} {onchange} {min} {max} {step} {unit} {accent} />
</div>
