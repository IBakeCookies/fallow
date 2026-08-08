<script lang="ts">
	import type { LayoutProps } from './$types';
	import '$lib/presentation/style/app.css';
	import { dev, browser } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { activeLocale } from '$lib/presentation/utils/locale.svelte';
	import { readClientAppearance } from '$lib/business/appearance';
	import { setThemeStore } from '$lib/business/store/theme-store.svelte';
	import { onMount } from 'svelte';
	import { sceneryStyle } from '$lib/presentation/utils/scenery-seed';
	import { dataSceneryStyle, nowInTimeZone } from '$lib/presentation/utils/scenery-time';

	let { children, data }: LayoutProps = $props();

	// Theme lives here, OUTSIDE the {#key} below — a language switch recreates
	// the keyed subtree, and a store owned by it would reset to the load-time
	// cookie snapshot. data.appearance is deliberately only init seeds.
	// The layout is the environment-dual module, so reading the live cookies is
	// its job: readClientAppearance() is empty under SSR and real after that.
	// svelte-ignore state_referenced_locally
	const themeStore = setThemeStore(data.appearance, readClientAppearance());

	// Not in dev: both inject a `script.debug.js` fetched from
	// va.vercel-scripts.com on every page load, which measures nothing locally
	// and sits on the critical path of an already slower dev load.
	// Only on Vercel: the /_vercel/* scripts 404 anywhere else (e2e preview).
	// svelte-ignore state_referenced_locally
	if (!dev && data.isVercel) {
		injectAnalytics();
		injectSpeedInsights();
	}

	// Clock-driven scenery state. SSR renders the request's IP-derived
	// timezone; hydration never re-patches the SSR'd style attribute, so
	// re-derive from the client's real clock once mounted (a state change
	// after hydration does update the DOM), then keep it ticking — the
	// scenery positions drift with the real clock, and a planner tab can
	// stay open all day. A minute is finer than any var's visible rate.
	// svelte-ignore state_referenced_locally
	let sceneryNow = $state(nowInTimeZone(data.timezone));

	onMount(() => {
		sceneryNow = nowInTimeZone();
		const id = setInterval(() => (sceneryNow = nowInTimeZone()), 60_000);

		return () => clearInterval(id);
	});

	// Separately derived, not inlined into the style attribute: one expression
	// there re-runs the whole seeded var table — and both of its SVG generators —
	// on every minute tick, though nothing but the clock has changed.
	const seedStyle = $derived(sceneryStyle(themeStore.scenerySeed));
	const clockStyle = $derived(dataSceneryStyle(sceneryNow));

	// A language switch is a client-side goto(), so the SSR'd <html lang> would
	// otherwise keep claiming the language the page was loaded in.
	$effect(() => {
		if (browser) document.documentElement.lang = activeLocale.value;
	});
</script>

<!-- Theme scenery: fixed decorative layers behind the app. display:none by
     default; a theme opts in by styling the helpers in style/scenery/. The seeded
     vars vary each theme's arrangement per user (see utils/scenery-seed.ts);
     the data vars set the clock-driven themes' state (utils/scenery-time.ts). -->
<div class="theme-scenery" aria-hidden="true" style="{seedStyle}; {clockStyle}">
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
