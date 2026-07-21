<script lang="ts">
	import type { LayoutProps } from './$types';
	import type { Pathname } from '$app/types';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { dev, browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import { activeLocale } from '$lib/presentation/utils/locale.svelte';
	import { setThemeStore } from '$lib/business/store/theme-store.svelte';
	import { sceneryStyle } from '$lib/presentation/utils/scenery-seed';

	let { children, data }: LayoutProps = $props();

	// Theme lives here, OUTSIDE the {#key} below — a language switch recreates
	// the keyed subtree, and a store owned by it would reset to the load-time
	// cookie snapshot. data.theme/scenerySeed are deliberately only init seeds.
	// svelte-ignore state_referenced_locally
	const themeStore = setThemeStore(data.theme, data.scenerySeed, data.sceneryPaused);

	injectAnalytics({ mode: dev ? 'development' : 'production' });
	injectSpeedInsights();

	// Reload-free language switching: setLocale() runs with reload:false, so
	// keep <html lang> in sync ourselves.
	$effect(() => {
		if (browser) document.documentElement.lang = activeLocale.value;
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<!-- Theme scenery: fixed decorative layers behind the app. display:none by
     default; a theme opts in by styling the helpers in layout.css. The seeded
     vars vary each theme's arrangement per user (see utils/scenery-seed.ts). -->
<div class="theme-scenery" aria-hidden="true" style={sceneryStyle(themeStore.scenerySeed)}>
	<div class="theme-helper-1"></div>
	<div class="theme-helper-2"></div>
	<div class="theme-helper-3"></div>
	<div class="theme-helper-4"></div>
</div>

<!-- Keyed on the locale so a language switch re-renders the app in place
     (m.*() messages resolve at render time) instead of reloading the page -->
{#key activeLocale.value}
	{@render children()}
{/key}

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}>
			{locale}
		</a>
	{/each}
</div>
