<script lang="ts">
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
	}

	let { id, label, hint, value, onchange, min, max, step, unit, accent }: Props = $props();
</script>

<div>
	<!-- Its own provider, like every other explained label in the app: a row that only
	     works under an ancestor provider is a row no story or spec can mount. -->
	<Tooltip.Provider delayDuration={150}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<label
						{...props}
						for={id}
						class="hint-underline mb-text-2xs block w-fit text-xs text-ty-secondary"
					>
						{label}
					</label>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="left">
				<p>{hint}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
	<NumberInput {id} {value} {onchange} {min} {max} {step} {unit} {accent} />
</div>
