<script lang="ts" generics="T extends string">
	/* The app's segmented switch: the analytics range, the calendar's month/week,
	   the Energy Lab's chart/schedule. `segmented-toggle-variants.ts` already shared
	   the button classes, but the strip around them, the `#each` and `aria-pressed`
	   were written out three times — and no story rendered any of them, so axe had
	   never seen the active pill's contrast on any of the 37 themes. (Its HOVER
	   fills still are not measured: `scripts/hover-contrast.mjs` drives one story,
	   `ui-button--variants`, over a hardcoded variant list.)

	   The calendar's copy was the reason to do this rather than leave it: those two
	   buttons had no `aria-pressed` at all, so the selected view was carried by a
	   fill alone.

	   `onchange` rather than `bind:value`: the Lab persists its choice on the way
	   through, so the write is not always a plain assignment. */

	import { cn } from '$lib/presentation/utils';
	import {
		segmentedToggleGroupVariants,
		segmentedToggleVariants,
		type SegmentedToggleTone,
	} from '$lib/presentation/component/segmented-toggle-variants';

	interface Props {
		/** The options, in the order they are shown */
		items: { value: T; label: string }[];
		value: T;
		onchange: (value: T) => void;
		/** Names the group: each button says what it switches TO, never what it
		 *  switches. */
		label: string;
		tone?: SegmentedToggleTone;
		class?: string;
		/** Per-button additions — the calendar's view names are lowercase copy */
		itemClass?: string;
	}

	let {
		items,
		value,
		onchange,
		label,
		tone = 'segment',
		class: className,
		itemClass,
	}: Props = $props();
</script>

<div
	role="group"
	aria-label={label}
	class={cn(
		segmentedToggleGroupVariants({
			tone,
		}),
		className,
	)}
>
	{#each items as item (item.value)}
		<button
			type="button"
			aria-pressed={value === item.value}
			class={cn(
				segmentedToggleVariants({
					tone,
					active: value === item.value,
				}),
				itemClass,
			)}
			onclick={() => onchange(item.value)}
		>
			{item.label}
		</button>
	{/each}
</div>
