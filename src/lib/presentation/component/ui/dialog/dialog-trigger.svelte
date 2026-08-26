<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { Button, type ButtonSize, type ButtonVariant } from '../button/index.js';
	import { cn } from '$lib/presentation/utils';

	// Same shape as `dropdown-menu-trigger`, and for the same reason: every trigger
	// in the app is a Button, so `child` is spent here rather than forwarded.
	let {
		ref = $bindable(null),
		class: className,
		variant = 'outline',
		size = 'sm',
		children,
		...restProps
	}: Omit<DialogPrimitive.TriggerProps, 'child'> & {
		variant?: ButtonVariant;
		size?: ButtonSize;
	} = $props();
</script>

<DialogPrimitive.Trigger bind:ref {...restProps}>
	{#snippet child({ props })}
		<Button {...props} {variant} {size} data-slot="dialog-trigger" class={cn(className)}>
			{@render children?.()}
		</Button>
	{/snippet}
</DialogPrimitive.Trigger>
