<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';

	/* "You are here": position 1 of the mid-day re-plan's run order. It rides the
	   list card's header row, not the rows themselves, because the list's own `#N`
	   badges are the whole-day plan's order and stay the 8am answer as the day is
	   worked. It never says "stop for the day" — the classic objective prices no
	   leisure, so day-ending belongs to λ₀ and the Energy Lab's stop advisor
	   (§8.11). */

	interface Props {
		/** The task to pick up now. The caller renders nothing when there is none. */
		title: string;
	}

	let { title }: Props = $props();
</script>

<!-- `min-w-0`: as a flex item of the header row this would otherwise refuse to
     shrink below its content, and the title's `truncate` would never fire. -->
<p class="min-w-0 inline-flex items-baseline gap-text-2xs text-sm">
	<!-- The badge is the trigger and the title is not, as in the metrics card: what
	     wants explaining is the reading, not the task it happens to name. -->
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger class="order-badge uppercase tracking-wide">
				{m.next_up_label()}
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.next_up_tooltip()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
	<span class="truncate font-semibold text-ty-primary">{title}</span>
</p>
