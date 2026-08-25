<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { Button } from '$lib/presentation/component/ui/button';

	interface Props {
		isBusy: boolean;
		/** The last sweep failed and produced no curve — said here, since there is no
		 *  card yet to carry the banner. */
		hasError: boolean;
		oncheck: () => void;
	}

	let { isBusy, hasError, oncheck }: Props = $props();
</script>

<!-- A button and not a card until it is asked: a shell and a heading around a sweep
     nobody has run claim a reading the card does not have (presentation/AGENTS.md).
     It reads on the parameters card because the curve is what the Day window row's
     number should be — the same rule that puts each fit on the row it fits. -->
<div class="flex items-baseline gap-grid-xs">
	{#if hasError}
		<p class="text-xs text-danger">{m.energy_curve_error()}</p>
	{/if}
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline" size="sm" disabled={isBusy} onclick={oncheck}>
						{isBusy ? m.energy_curve_working() : m.energy_curve_check()}
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" align="end" class="max-w-md">
				<p>{m.energy_curve_desc()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</div>
