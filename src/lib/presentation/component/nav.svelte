<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Zap from '@lucide/svelte/icons/zap';
	import Languages from '@lucide/svelte/icons/languages';
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { locales, localizeHref, deLocalizeUrl, type Locale } from '$lib/paraglide/runtime';
	import * as DropdownMenu from '$lib/presentation/component/ui/dropdown-menu';
	import { cn } from '$lib/presentation/utils';
	import {
		activeLocale,
		switchLocale,
		localeLabel,
		getDateLocale,
	} from '$lib/presentation/utils/locale.svelte';
	import { liveToday } from '$lib/business/state/today.svelte';
	import { fromISO, isISODate } from '$lib/business/utils/date';

	interface Props {
		// Right-side controls (theme switcher, data menu) — wired by the layout
		actions?: Snippet;
	}

	let { actions }: Props = $props();

	const today = $derived(liveToday.value);

	// Links carry the locale: on /de/* an unprefixed href would silently drop the
	// visitor back to English. Matching goes the other way — de-localize the
	// current URL and compare its path against the canonical one, so `aria-current`
	// and the viewed-day label below are right in both locales. `deLocalizeUrl`
	// (not `deLocalizeHref`) because during SSR the href form returns an absolute
	// URL, which matches no route path — the whole nav then renders inactive on
	// first paint and hydration has to repair it.
	const home = resolve('/');
	const currentPath = $derived(deLocalizeUrl(page.url).pathname);

	// When the main page is showing another day (/?date=...), the first nav
	// item stops claiming "Today": it shows the viewed date instead — amber
	// for the past, sky for a future plan — and clicking it (href stays /)
	// returns to today.
	const dateParam = $derived(page.url.searchParams.get('date'));
	const viewedDate = $derived(
		currentPath === home && isISODate(dateParam) && dateParam !== today ? dateParam : null,
	);
	const dayMode: 'past' | 'future' | null = $derived(
		viewedDate ? (viewedDate < today ? 'past' : 'future') : null,
	);
	const dayLabel = $derived(
		viewedDate
			? fromISO(viewedDate).toLocaleDateString(getDateLocale(), {
					month: 'short',
					day: 'numeric',
				})
			: m.nav_today(),
	);

	const links = $derived([
		{
			href: home,
			label: dayLabel,
			icon: ListTodo,
			mode: dayMode,
		},
		{
			href: resolve('/calendar'),
			label: m.nav_calendar(),
			icon: CalendarDays,
		},
		{
			href: resolve('/analytics'),
			label: m.nav_analytics(),
			icon: ChartColumn,
		},
		{
			href: resolve('/energy'),
			label: m.nav_energy_lab(),
			icon: Zap,
		},
	]);

	const isActive = (href: string) =>
		href === home ? currentPath === home : currentPath.startsWith(href);

	const ACTIVE_CLASS = {
		past: 'bg-warning/10 text-warning-strong',
		future: 'bg-info/10 text-info-strong',
		today: 'bg-surface-hover text-ty-primary',
	} as const;
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
				aria-label={link.mode
					? m.nav_viewing_return({
							label: link.label,
						})
					: link.label}
				title={link.mode ? m.nav_return_to_today() : undefined}
				class={cn(
					'flex items-center gap-text-xs rounded-lg px-box-sm py-box-3xs text-sm transition-colors',
					isActive(link.href)
						? ACTIVE_CLASS[link.mode ?? 'today']
						: 'text-ty-secondary hover:bg-surface-hover hover:text-ty-primary',
				)}
			>
				<link.icon class="h-4 w-4 shrink-0" />
				<span class="hidden sm:inline">{link.label}</span>
			</a>
		{/each}

		<div class="mx-text-2xs h-4 w-px bg-line-soft"></div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger variant="ghost" aria-label={m.nav_switch_language()}>
				<Languages class="h-4 w-4 shrink-0" />
				<span class="hidden sm:inline">{localeLabel(activeLocale.value)}</span>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="start" class="w-max min-w-40">
				<DropdownMenu.RadioGroup
					value={activeLocale.value}
					onValueChange={(v) => switchLocale(v as Locale)}
				>
					{#each locales as locale (locale)}
						<DropdownMenu.RadioItem value={locale} class="cursor-pointer">
							{localeLabel(locale)}
						</DropdownMenu.RadioItem>
					{/each}
				</DropdownMenu.RadioGroup>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</nav>

	{@render actions?.()}
</div>
