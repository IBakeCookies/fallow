<script lang="ts">
	import { page } from '$app/state';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Zap from '@lucide/svelte/icons/zap';
	import { liveToday } from '$lib/today.svelte';

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
			? new Date(viewedDate + 'T12:00:00').toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric'
				})
			: 'Today'
	);

	const links = $derived([
		{ href: '/', label: dayLabel, icon: ListTodo, mode: dayMode },
		{ href: '/calendar', label: 'Calendar', icon: CalendarDays },
		{ href: '/analytics', label: 'Analytics', icon: ChartColumn },
		{ href: '/energy', label: 'Energy Lab', icon: Zap }
	]);

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<nav
	class="mb-6 inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/3 p-1 backdrop-blur-xl w-max"
>
	{#each links as link (link.href)}
		<a
			href={link.href}
			aria-current={isActive(link.href) ? 'page' : undefined}
			aria-label={link.mode ? `Viewing ${link.label} — return to today` : link.label}
			title={link.mode ? 'Return to today' : undefined}
			class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors
			       {isActive(link.href)
				? link.mode === 'past'
					? 'bg-amber-500/10 text-amber-300'
					: link.mode === 'future'
						? 'bg-sky-500/10 text-sky-300'
						: 'bg-white/10 text-zinc-100'
				: 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}"
		>
			<link.icon class="h-4 w-4 shrink-0" />
			<span class="hidden sm:inline">{link.label}</span>
		</a>
	{/each}
</nav>
