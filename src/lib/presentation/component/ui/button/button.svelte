<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/presentation/utils';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { type VariantProps, tv } from 'tailwind-variants';

	export const buttonVariants = tv({
		// `dark:` only matches .dark — 1 of the 31 dark themes in the catalogue — so
		// it is never used here. Every light/dark difference comes from a token the
		// themes already swap (--input, --surface-hover, --card-shadow).
		base: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive rounded-md border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-3 active:not-aria-[haspopup]:translate-y-px aria-invalid:ring-3 [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
				// bg-control, not bg-background: --surface-page is opaque, and these sit
				// on a translucent glass card in most themes. --control is the per-theme
				// "control on this surface" tint, so it reads correctly on all of them.
				// backdrop-blur because it IS translucent: these buttons sit straight
				// on the page (toolbar, calendar arrows), so without it the background
				// image shows through unblurred, unlike every card around them.
				outline:
					'border-border bg-control backdrop-blur hover:bg-control-hover hover:text-foreground aria-expanded:bg-control-hover aria-expanded:text-foreground',
				secondary:
					'backdrop-blur bg-secondary text-secondary-foreground hover:bg-secondary-hover aria-expanded:bg-secondary-hover aria-expanded:text-secondary-foreground',
				ghost:
					'hover:bg-surface-hover hover:text-foreground aria-expanded:bg-surface-hover aria-expanded:text-foreground',
				// The tinted-danger recipe, per STYLE.md: `-strong` text on a faint fill
				// of the bare colour. Two fixes over what shadcn ships: `text-destructive`
				// on that fill measured 1.97–3.42:1 (red ink on a red
				// wash, the mush the colour-role rule warns about), and `bg-destructive/8`
				// let the backdrop through, so the pairing depended on the wallpaper —
				// `destructive-soft` is opaque, which is also why no backdrop-blur here.
				destructive:
					'bg-destructive-soft hover:bg-destructive-soft-hover focus-visible:ring-destructive/20 text-destructive-foreground focus-visible:border-destructive/40',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default:
					'h-9 gap-1.5 px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
				xs: "h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: 'h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5',
				lg: 'h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
				icon: 'size-9',
				'icon-xs':
					"size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
				'icon-sm':
					'size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md',
				'icon-lg': 'size-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<!-- generic wrapper: href is caller-supplied, so callers are responsible for resolve() -->
	<a
		href={disabled ? undefined : href}
		bind:this={ref}
		data-slot="button"
		class={cn(
			buttonVariants({
				variant,
				size,
			}),
			className,
		)}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(
			buttonVariants({
				variant,
				size,
			}),
			className,
		)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
