<script lang="ts">
	import { page } from '$app/state';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Zap from '@lucide/svelte/icons/zap';

	const links = [
		{ href: '/', label: 'Today', icon: ListTodo },
		{ href: '/calendar', label: 'Calendar', icon: CalendarDays },
		{ href: '/analytics', label: 'Analytics', icon: ChartColumn },
		{ href: '/energy', label: 'Energy Lab', icon: Zap }
	];

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
			class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors
			       {isActive(link.href)
				? 'bg-white/10 text-zinc-100'
				: 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}"
		>
			<link.icon class="h-4 w-4" />
			{link.label}
		</a>
	{/each}
</nav>
