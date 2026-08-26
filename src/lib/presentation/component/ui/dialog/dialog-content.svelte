<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import type { ComponentProps } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { cn, type WithoutChildrenOrChild } from '$lib/presentation/utils';
	import DialogOverlay from './dialog-overlay.svelte';
	import DialogPortal from './dialog-portal.svelte';

	let {
		ref = $bindable(null),
		class: className,
		children,
		portalProps,
		...restProps
	}: DialogPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>;
	} = $props();
</script>

<DialogPortal {...portalProps}>
	<DialogOverlay />
	<!-- `bg-popover` (→ `--surface-page`), never `surface-card`: the same rule the
	     toast follows — a floating panel over arbitrary content cannot use the fill
	     that carries alpha, or the page reads through it on the blur-0 themes.
	     `max-h`/`overflow-y-auto` because the content is a form: on a short phone
	     the fields scroll INSIDE the panel, since the document behind it is
	     scroll-locked while this is open. -->
	<DialogPrimitive.Content
		bind:ref
		data-slot="dialog-content"
		class={cn(
			'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 nice-scrollbar fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line-strong bg-popover p-box-lg text-popover-foreground shadow-card duration-100',
			className,
		)}
		{...restProps}
	>
		{@render children?.()}
		<DialogPrimitive.Close
			aria-label={m.common_close()}
			class="absolute top-box-sm right-box-sm rounded-md text-lg leading-none text-ty-silent transition hover:text-ty-secondary focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
		>
			✕
		</DialogPrimitive.Close>
	</DialogPrimitive.Content>
</DialogPortal>
