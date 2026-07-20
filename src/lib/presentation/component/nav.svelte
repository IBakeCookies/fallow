<script lang="ts">
	import { page } from '$app/state';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Zap from '@lucide/svelte/icons/zap';
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { locales } from '$lib/paraglide/runtime';
	import {
		activeLocale,
		switchLocale,
		getDateLocale
	} from '$lib/presentation/utils/locale.svelte';
	import { liveToday } from '$lib/business/state/today.svelte';

	interface Props {
		themeSwitcher?: Snippet;
	}

	let { themeSwitcher }: Props = $props();

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

	const links = $derived([
		{ href: '/', label: dayLabel, icon: ListTodo, mode: dayMode },
		{ href: '/calendar', label: m.nav_calendar(), icon: CalendarDays },
		{ href: '/analytics', label: m.nav_analytics(), icon: ChartColumn },
		{ href: '/energy', label: m.nav_energy_lab(), icon: Zap }
	]);

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<div class="mb-6 flex items-start justify-between gap-2">
<nav
	class="inline-flex items-center gap-1 rounded-xl border bg-surface-card p-1 backdrop-blur w-max"
>
	{#each links as link (link.href)}
		<a
			href={link.href}
			aria-current={isActive(link.href) ? 'page' : undefined}
			aria-label={link.mode ? m.nav_viewing_return({ label: link.label }) : link.label}
			title={link.mode ? m.nav_return_to_today() : undefined}
			class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors
			       {isActive(link.href)
				? link.mode === 'past'
					? 'bg-warning/10 text-warning-strong'
					: link.mode === 'future'
						? 'bg-info/10 text-info-strong'
						: 'bg-surface-hover text-ty-primary'
				: 'text-ty-secondary hover:bg-surface-card hover:text-ty-primary'}"
		>
			<link.icon class="h-4 w-4 shrink-0" />
			<span class="hidden sm:inline">{link.label}</span>
		</a>
	{/each}

	<div class="mx-1 h-4 w-px bg-border"></div>
	{#each locales as locale (locale)}
		<button
			type="button"
			aria-label="{m.nav_switch_language()}: {locale.toUpperCase()}"
			aria-current={activeLocale.value === locale ? 'true' : undefined}
			onclick={() => switchLocale(locale)}
			class="rounded-lg px-2 py-1.5 text-xs font-medium uppercase transition-colors
			       {activeLocale.value === locale
				? 'bg-surface-hover text-ty-primary'
				: 'text-ty-silent hover:bg-surface-card hover:text-ty-secondary'}"
		>
			{locale}
		</button>
	{/each}
</nav>

{@render themeSwitcher?.()}
</div>
