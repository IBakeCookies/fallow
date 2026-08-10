<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	/* "You are here": position 1 of the mid-day re-plan's run order (MATH.md §35).
	   One line above the list, because the list's own `#N` badges are the whole-day
	   plan's order and stay the 8am answer as the day is worked (§11.8). It never
	   says "stop for the day" — the classic objective prices no leisure (§14.1), so
	   day-ending belongs to λ₀ and the Energy Lab's stop advisor (§8.11). */

	interface Props {
		/** The task to pick up now. The caller renders nothing when there is none. */
		title: string;
	}

	let { title }: Props = $props();
</script>

<p class="flex items-baseline gap-text-2xs text-sm" title={m.next_up_tooltip()}>
	<span
		class="rounded-sm bg-flow/15 px-box-3xs py-text-3xs text-xs font-semibold text-flow uppercase tracking-wide"
	>
		{m.next_up_label()}
	</span>
	<span class="min-w-0 truncate font-semibold text-ty-primary">{title}</span>
</p>
