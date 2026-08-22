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
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
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

	const weekday = $derived(
		fromISO(today).toLocaleDateString(getDateLocale(), {
			weekday: 'short',
		}),
	);
</script>

<header class="sticky top-0 z-20 border-b border-line-soft bg-surface-float backdrop-blur">
	<div
		class="mx-auto flex w-full max-w-layout items-center justify-between gap-grid-md px-page-sm py-box-md sm:px-page-md lg:px-page"
	>
		<div class="flex items-center gap-grid-sm sm:gap-grid-lg">
			<!-- The brand mark carries the tagline: it is on every route, so "what is
			     this app" is answered wherever the visitor landed. -->
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<a
								{...props}
								href={localizeHref(home)}
								aria-label={m.app_name()}
								class="flex items-center gap-text-xs"
							>
								<!-- static/favicon.svg drawn with tokens: the file's hardcoded greens
								     cannot follow a theme, and this mark sits on every palette -->
								<svg viewBox="0 0 64 64" class="h-6 w-6 shrink-0" aria-hidden="true">
									<rect width="64" height="64" rx="14" fill="var(--brand)" />
									<g stroke="var(--brand-ink)" stroke-linecap="round" stroke-width="7">
										<line x1="22" y1="22" x2="42" y2="22" />
										<line x1="22" y1="32" x2="33" y2="32" opacity="0.5" />
										<line x1="22" y1="42" x2="42" y2="42" />
									</g>
								</svg>
								<span class="hidden text-lg font-bold tracking-tight text-ty-primary sm:inline">
									{m.app_name()}
								</span>
							</a>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="bottom" align="start" class="max-w-md">
						<p>{m.header_tagline()}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>

			<nav class="flex items-center gap-text-3xs">
				{#each links as link (link.href)}
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
							'flex items-center rounded-md px-box-2xs py-box-3xs text-sm font-medium transition-colors sm:px-box-sm',
							isActive(link.href)
								? ACTIVE_CLASS[link.mode ?? 'today']
								: 'text-ty-secondary hover:bg-surface-hover hover:text-ty-primary',
						)}
					>
						<!-- the design is a text nav; the icon carries the item where a
						     narrow viewport has no room for four labels -->
						<link.icon class="h-4 w-4 shrink-0 sm:hidden" />
						<span class="hidden sm:inline">{link.label}</span>
					</a>
				{/each}
			</nav>
		</div>

		<div class="flex items-center gap-grid-xs">
			<span class="hidden text-xs tabular-nums text-ty-silent lg:inline">
				{today} &middot; {weekday}
			</span>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger variant="ghost" aria-label={m.nav_switch_language()}>
					<Languages class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">{localeLabel(activeLocale.value)}</span>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-max min-w-40">
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

			{@render actions?.()}
		</div>
	</div>
</header>
