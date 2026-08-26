<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/presentation/utils';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DialogPrimitive.OverlayProps = $props();
</script>

<!-- `bg-scrim`, not a `--ty-primary` wash: a scrim dims toward black on light and
     dark themes alike, so an ink-derived one would BRIGHTEN the 31 dark ones. -->
<DialogPrimitive.Overlay
	bind:ref
	data-slot="dialog-overlay"
	class={cn(
		'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 z-50 bg-scrim backdrop-blur-sm',
		className,
	)}
	{...restProps}
/>
