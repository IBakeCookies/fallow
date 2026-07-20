<script lang="ts">
	import type { LayoutProps } from './$types';
	import { page } from '$app/state';
	import Nav from '$lib/presentation/component/nav.svelte';
	import Palette from '@lucide/svelte/icons/palette';
	import * as DropdownMenu from '$lib/presentation/component/ui/dropdown-menu';
	import * as m from '$lib/paraglide/messages.js';
	import type { ThemeName } from '$lib/business/store/theme-store.svelte';
	import Footer from '$lib/presentation/component/footer.svelte';
	import { setSessionStore } from '$lib/business/store/session-store.svelte';
	import { getThemeStore } from '$lib/business/store/theme-store.svelte';

	let { children }: LayoutProps = $props();

	const themeStore = getThemeStore();

	// The shared daily session (tasks, budget, pools + persistence) lives in
	// context, created per component tree — never at module scope, so nothing
	// can leak across SSR requests. Pages grab it with getSessionStore().
	setSessionStore();

	// Calendar is the one full-viewport page: it must never scroll, so its grid
	// rows split the leftover height instead of growing the page.
	const fullViewport = $derived(page.route.id?.endsWith('/calendar') ?? false);
</script>

<main
	class="text-ty-secondary antialiased selection:bg-success/30 selection:text-success-strong font-sans flex flex-col
	       {fullViewport ? 'h-dvh overflow-hidden' : 'min-h-screen'}"
>
	<div class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex min-h-0 flex-1 flex-col">
		<Nav>
			{#snippet themeSwitcher()}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						aria-label={m.nav_switch_theme()}
						class="inline-flex items-center gap-2 rounded-xl border bg-surface-card px-3 py-2 text-sm text-ty-secondary backdrop-blur transition-colors hover:bg-surface-hover hover:text-ty-primary"
					>
						<Palette class="h-4 w-4 shrink-0" />
						<span class="hidden sm:inline">{themeStore.label}</span>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-max min-w-40">
						<DropdownMenu.RadioGroup
							value={themeStore.theme}
							onValueChange={(v) => themeStore.switchTheme(v as ThemeName)}
						>
							{#each themeStore.themes as theme (theme.name)}
								<DropdownMenu.RadioItem value={theme.name} class="cursor-pointer">
									{theme.label}
								</DropdownMenu.RadioItem>
							{/each}
						</DropdownMenu.RadioGroup>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/snippet}
		</Nav>
		{@render children()}
		<Footer />
	</div>
</main>
