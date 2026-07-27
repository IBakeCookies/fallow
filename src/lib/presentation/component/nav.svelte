<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Zap from '@lucide/svelte/icons/zap';
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { locales, localizeHref, deLocalizeHref } from '$lib/paraglide/runtime';
	import { segmentedToggleVariants } from '$lib/presentation/component/segmented-toggle-variants';
	import { activeLocale, switchLocale, getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import { liveToday } from '$lib/business/state/today.svelte';

	interface Props {
		// Right-side controls (theme switcher, data menu) — wired by the layout
		actions?: Snippet;
	}

	let { actions }: Props = $props();

	const today = $derived(liveToday.value);

	// When the main page is showing another day (/?date=...), the first nav
	// item stops claiming "Today": it shows the viewed date instead — amber
	// for the past, sky for a future plan — and clicking it (href stays /)
	// returns to today.
	const dateParam = $derived(page.url.searchParams.get('date'));
	const viewedDate = $derived(
		page.url.pathname === '/' &&
			dateParam &&
			/^\d{4}-\d{2}-\d{2}$/.test(dateParam) &&
			dateParam !== today
			? dateParam
			: null
	);
	const dayMode = $derived(viewedDate ? (viewedDate < today ? 'past' : 'future') : null);
	const dayLabel = $derived(
		viewedDate
			? new Date(viewedDate + 'T12:00:00').toLocaleDateString(getDateLocale(), {
					month: 'short',
					day: 'numeric'
				})
			: m.nav_today()
	);

	// Links carry the locale: on /de/* an unprefixed href would silently drop the
	// visitor back to English. Matching goes the other way — de-localize the
	// current path and compare against the canonical one, so `aria-current` is
	// right in both locales.
	const home = resolve('/');
	const links = $derived([
		{ href: home, label: dayLabel, icon: ListTodo, mode: dayMode },
		{ href: resolve('/calendar'), label: m.nav_calendar(), icon: CalendarDays },
		{ href: resolve('/analytics'), label: m.nav_analytics(), icon: ChartColumn },
		{ href: resolve('/energy'), label: m.nav_energy_lab(), icon: Zap }
	]);

	const currentPath = $derived(deLocalizeHref(page.url.pathname));
	const isActive = (href: string) =>
		href === home ? currentPath === home : currentPath.startsWith(href);
</script>

<div class="sticky top-4 z-20 mb-text-xl flex items-start justify-between gap-grid-xs">
	<nav
		class="inline-flex items-center gap-text-2xs rounded-xl border bg-surface-card p-text-2xs backdrop-blur w-max"
	>
		{#each links as link (link.href)}
			<!-- hrefs are resolve()d in the links array; the rule can't trace through it -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a
				href={localizeHref(link.href)}
				aria-current={isActive(link.href) ? 'page' : undefined}
				aria-label={link.mode ? m.nav_viewing_return({ label: link.label }) : link.label}
				title={link.mode ? m.nav_return_to_today() : undefined}
				class="flex items-center gap-text-xs rounded-lg px-box-sm py-box-3xs text-sm transition-colors
			       {isActive(link.href)
					? link.mode === 'past'
						? 'bg-warning/10 text-warning-strong'
						: link.mode === 'future'
							? 'bg-info/10 text-info-strong'
							: 'bg-surface-hover text-ty-primary'
					: 'text-ty-secondary hover:bg-surface-hover hover:text-ty-primary'}"
			>
				<link.icon class="h-4 w-4 shrink-0" />
				<span class="hidden sm:inline">{link.label}</span>
			</a>
		{/each}

		<div class="mx-text-2xs h-4 w-px bg-line-soft"></div>
		{#each locales as locale (locale)}
			<button
				type="button"
				aria-label="{m.nav_switch_language()}: {locale.toUpperCase()}"
				aria-current={activeLocale.value === locale ? 'true' : undefined}
				onclick={() => switchLocale(locale)}
				class={segmentedToggleVariants({ tone: 'nav', active: activeLocale.value === locale })}
			>
				{locale}
			</button>
		{/each}
	</nav>

	{@render actions?.()}
</div>
