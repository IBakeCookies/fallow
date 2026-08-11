<script lang="ts" generics="T extends string">
	/* `onchange` rather than `bind:value`: a caller may persist its choice on the
	   way through, so the write is not always a plain assignment. */

	import { cn } from '$lib/presentation/utils';
	import {
		segmentedToggleGroupVariants,
		segmentedToggleVariants,
		type SegmentedToggleTone,
	} from '$lib/presentation/component/segmented-toggle-variants';

	interface Props {
		items: { value: T; label: string }[];
		value: T;
		onchange: (value: T) => void;
		/** Names the group; each item's label says what it switches TO */
		label: string;
		tone?: SegmentedToggleTone;
		class?: string;
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
