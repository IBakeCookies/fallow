<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { Button, type ButtonSize, type ButtonVariant } from '../button/index.js';
	import { cn } from '$lib/presentation/utils';

	// Every trigger in the app is a Button — one styling path, no bespoke
	// trigger variants. Button's base already excludes `aria-haspopup` from the
	// press-down nudge, i.e. it was written expecting this use.
	let {
		ref = $bindable(null),
		class: className,
		variant = 'outline',
		size = 'sm',
		children,
		...restProps
	}: DropdownMenuPrimitive.TriggerProps & {
		variant?: ButtonVariant;
		size?: ButtonSize;
	} = $props();
</script>

<DropdownMenuPrimitive.Trigger bind:ref {...restProps}>
	{#snippet child({ props })}
		<!-- gap-text-xs, not the size variant's gap: triggers pair an icon with a
		     label and 4px reads as one glyph -->
		<Button
			{...props}
			{variant}
			{size}
			data-slot="dropdown-menu-trigger"
			class={cn('gap-text-xs', className)}
		>
			{@render children?.()}
		</Button>
	{/snippet}
</DropdownMenuPrimitive.Trigger>
