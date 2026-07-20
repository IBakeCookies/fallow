<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	export const dropdownMenuTriggerVariants = tv({
		variants: {
			variant: {
				default: '',
				pill: 'inline-flex items-center gap-2 rounded-xl border bg-surface-card px-3 py-2 text-sm text-ty-secondary backdrop-blur transition-colors hover:bg-surface-hover hover:text-ty-primary'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	export type DropdownMenuTriggerVariant = VariantProps<
		typeof dropdownMenuTriggerVariants
	>['variant'];
</script>

<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '$lib/presentation/utils';

	let {
		ref = $bindable(null),
		class: className,
		variant = 'default',
		...restProps
	}: DropdownMenuPrimitive.TriggerProps & {
		variant?: DropdownMenuTriggerVariant;
	} = $props();
</script>

<DropdownMenuPrimitive.Trigger
	bind:ref
	data-slot="dropdown-menu-trigger"
	class={cn(dropdownMenuTriggerVariants({ variant }), className)}
	{...restProps}
/>
