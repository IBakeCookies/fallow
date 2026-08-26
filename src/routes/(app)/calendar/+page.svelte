<script lang="ts">
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import * as m from '$lib/paraglide/messages.js';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import SegmentedToggle from '$lib/presentation/component/segmented-toggle.svelte';
	import { getDateLocale, getWeekStartsOn } from '$lib/presentation/utils/locale.svelte';
	import { Button } from '$lib/presentation/component/ui/button';
	import {
		BAND_BAR_CLASS,
		BAND_TEXT_CLASS,
		getBandBiggerBetter,
	} from '$lib/presentation/utils/band';
	import { showToast } from '$lib/presentation/utils/toast';
	import { monthGrid, startOfWeek, addDays, fromISO, toISODate } from '$lib/business/utils/date';
	import { setCalendarStore } from '$lib/business/store/calendar-store.svelte';
	import { liveToday } from '$lib/business/state/today.svelte';

	const today = $derived(liveToday.value);

	// Mon-first, then rotated to the locale's first day — the column headers and
	// the grid share one week start or every cell sits under the wrong name.
	const WEEKDAY_LABELS = [
		m.weekday_mon(),
		m.weekday_tue(),
		m.weekday_wed(),
		m.weekday_thu(),
		m.weekday_fri(),
		m.weekday_sat(),
		m.weekday_sun(),
	];
	const weekStartsOn = $derived(getWeekStartsOn());
	const WEEKDAYS = $derived([
		...WEEKDAY_LABELS.slice(weekStartsOn - 1),
		...WEEKDAY_LABELS.slice(0, weekStartsOn - 1),
	]);
	const VIEWS = ['month', 'week'] as const;
	const viewLabelOf = (view: (typeof VIEWS)[number]) =>
		view === 'month' ? m.cal_view_month() : m.cal_view_week();

	let view = $state<'month' | 'week'>('month');
	let anchor = $state(toISODate()); // any date inside the visible month/week
	const viewLabel = $derived(viewLabelOf(view));
	const viewItems = $derived(
		VIEWS.map((value) => ({
			value,
			label: viewLabelOf(value),
		})),
	);
	const anchorDate = $derived(fromISO(anchor));
	const weeks = $derived(
		view === 'month'
			? monthGrid(anchorDate.getFullYear(), anchorDate.getMonth(), weekStartsOn)
			: [
					Array.from(
						{
							length: 7,
						},
						(_, i) => addDays(startOfWeek(anchor, weekStartsOn), i),
					),
				],
	);
	const rangeStart = $derived(weeks[0][0]);
	const rangeEnd = $derived(weeks[weeks.length - 1][6]);

	// The grid is this page's; every read of it is the store's.
	const calendar = setCalendarStore(
		() => [rangeStart, rangeEnd],
		() => showToast.danger(m.calendar_load_failed()),
	);

	const rangeLabel = $derived.by(() => {
		if (view === 'month') {
			return anchorDate.toLocaleDateString(getDateLocale(), {
				month: 'long',
				year: 'numeric',
			});
		}

		const start = fromISO(rangeStart);
		const end = fromISO(rangeEnd);

		const startFmt = start.toLocaleDateString(getDateLocale(), {
			month: 'short',
			day: 'numeric',
		});

		const endFmt = end.toLocaleDateString(getDateLocale(), {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});

		return `${startFmt} – ${endFmt}`;
	});

	function shiftMonth(iso: string, n: number): string {
		const d = fromISO(iso);

		return toISODate(new Date(d.getFullYear(), d.getMonth() + n, 1));
	}

	function goPrev() {
		anchor =
			view === 'month' ? shiftMonth(anchor, -1) : addDays(startOfWeek(anchor, weekStartsOn), -7);
	}

	function goNext() {
		anchor =
			view === 'month' ? shiftMonth(anchor, 1) : addDays(startOfWeek(anchor, weekStartsOn), 7);
	}
</script>

<SeoHead title={m.cal_title_head()} description={m.cal_meta_description()} />

<!-- Proton-calendar-style: the layout puts this page in a no-scroll full-viewport
     flex column — the grid's rows split the leftover height and cell content
     clips instead of growing -->

<!-- The nav's active link already draws the page's name, so this one is for the
     document: the grid below heads nothing, and an indexed page needs an `<h1>`.
     `sr-only` and not printed because this is the one page the layout pins to
     `h-dvh` — a title here is 32px the grid rows can never scroll back. -->
<h1 class="sr-only">{m.cal_heading()}</h1>

<!-- Stepping left, view right: with the title gone the range IS the heading, so it
     takes the reading position. Neither group needs a margin of its own — the row's
     `justify-between` is what separates them and the gaps space them within. -->
<div class="mb-text-md flex flex-wrap items-center justify-between gap-grid-xs">
	<div class="flex flex-wrap items-center gap-grid-xs">
		<div class="flex items-center gap-grid-2xs">
			<Button
				variant="outline"
				size="sm"
				onclick={goPrev}
				aria-label={m.cal_previous({
					view: viewLabel,
				})}
			>
				<ChevronLeft class="h-4 w-4" />
			</Button>
			<span
				class="min-w-28 sm:min-w-36 px-text-2xs text-center text-sm font-medium text-ty-primary"
			>
				{rangeLabel}
			</span>
			<Button
				variant="outline"
				size="sm"
				onclick={goNext}
				aria-label={m.cal_next({
					view: viewLabel,
				})}
			>
				<ChevronRight class="h-4 w-4" />
			</Button>
		</div>
		{#if anchor !== today}
			<Button variant="outline" size="sm" onclick={() => (anchor = today)}>
				{m.link_today()}
			</Button>
		{/if}
	</div>

	<SegmentedToggle
		items={viewItems}
		value={view}
		onchange={(next) => (view = next)}
		label={m.cal_view_group()}
		itemClass="capitalize"
	/>
</div>

{#if calendar.isLoading}
	<p class="sr-only">{m.cal_loading()}</p>
{/if}

<!-- The WEEK stacks into full-width day rows below `xl` and scrolls inside the fixed
     viewport: seven columns of a day's readings need more width than a phone has, and a
     week is short enough to scroll. The MONTH keeps its seven columns at every size —
     thirty-one stacked rows is a list, and a month grid is what the view is for. -->
<div
	class="grid min-h-0 flex-1 gap-grid-2xs {view === 'week'
		? 'nice-scrollbar grid-cols-1 auto-rows-min overflow-y-auto xl:grid-cols-7 xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden'
		: 'grid-cols-7'}"
	style={view === 'month'
		? `grid-template-rows: auto repeat(${weeks.length}, minmax(0, 1fr));`
		: ''}
>
	{#each WEEKDAYS as day (day)}
		<div
			class="px-box-2xs pb-text-2xs text-xs font-medium tracking-wide text-ty-silent {view ===
			'week'
				? 'hidden xl:block'
				: ''}"
		>
			{day}
		</div>
	{/each}

	{#each weeks as week (week[0])}
		{#each week as date (date)}
			{@const s = calendar.summaryFor(date)}
			{@const inMonth = view === 'week' || fromISO(date).getMonth() === anchorDate.getMonth()}
			{@const isFuture = date > today}
			{@const isToday = date === today}
			{@const dayNum = fromISO(date).getDate()}
			<!-- Each rest state pairs with its OWN hover, per STYLE.md's two hover families. A
			     cell WITH tasks is filled, so it lifts its own fill; `hover:bg-surface-hover`
			     REPLACED that fill with a 6% tint on transparent instead, which measured a
			     1.00–1.03 step on every dark theme (no hover at all) and a panel vanishing to
			     bare page on the opaque ones. An empty cell has no fill of its own, which is
			     the case `surface-hover` is actually for.

			     The border ramps as WELL, and it is not belt-and-braces: a fill lift moves a
			     lot over a dark page and almost nothing over a light one (2.05 on meridian,
			     1.017 on weathervane), because the step depends on the page luminance behind
			     the card and no token can see that. The border is page-independent, so it is
			     what holds the eight light translucent themes above the 1.03 bound. It has to
			     rest on `line-soft` to move at all: `--color-line-strong` IS `--border`, which
			     is what a bare `border` already resolves to. Today keeps its own border. -->
			<a
				href={localizeHref(date === today ? resolve('/') : `${resolve('/')}?date=${date}`)}
				class="group flex min-h-0 flex-col overflow-hidden rounded-lg sm:rounded-xl border p-text-2xs sm:p-box-2xs transition-colors
				       {isToday ? 'border-success/40' : 'border-line-soft hover:border-line-strong'}
				       {s
					? 'backdrop-blur bg-surface-card hover:bg-surface-card-hover'
					: 'bg-transparent hover:bg-surface-hover'}
				       {inMonth ? '' : 'opacity-40'}
				       cursor-pointer"
			>
				<div class="flex items-baseline justify-between gap-text-2xs">
					<span
						class="text-sm font-medium {isToday
							? 'text-success'
							: s
								? 'text-ty-primary'
								: 'text-ty-silent'}"
					>
						{view === 'week'
							? fromISO(date).toLocaleDateString(getDateLocale(), {
									weekday: 'short',
									day: 'numeric',
								})
							: dayNum}
					</span>
					{#if s}
						<span class="text-xs text-ty-secondary">
							{#if isFuture}
								<span class="font-medium text-info-strong">{s.totalTasks}</span>
								{m.cal_planned()}
							{:else}
								<span class="font-medium text-ty-primary">{s.completedTasks}</span>/{s.totalTasks}
							{/if}
						</span>
					{/if}
				</div>

				{#if calendar.isLoading}
					<!-- A placeholder, never a claim: an unread range paints forty-two bare
					     day numbers, which is pixel-identical to a month that holds nothing.
					     Bars where the readings land — the completion rail, then the task
					     lines — so the frame is the same shape the summaries arrive into. -->
					<div aria-hidden="true">
						<div class="skeleton-block mt-grid-2xs h-1 w-full"></div>
						<div class="mt-grid-2xs space-y-text-3xs">
							{#each ['w-full', 'w-4/5', 'w-3/5'] as width (width)}
								<div class="skeleton-block h-3 {width}"></div>
							{/each}
						</div>
					</div>
				{:else if s}
					<!-- Future days are plans: nothing is completable yet, so no bar -->
					{#if !isFuture}
						<div
							class="mt-grid-2xs h-1 overflow-hidden rounded-full bg-surface-inset"
							title={m.cal_completion_title({
								rate: s.completionRate,
							})}
						>
							<div
								class="h-full rounded-full {BAND_BAR_CLASS[getBandBiggerBetter(s.completionRate)]}"
								style="width: {s.completionRate}%"
							></div>
						</div>
					{/if}

					{#if view === 'month'}
						<ul class="mt-grid-2xs min-h-0 flex-1 space-y-text-3xs overflow-hidden">
							{#each s.tasks.slice(0, 3) as task (task.id)}
								<li
									class="truncate text-2xs leading-tight {task.completed
										? 'text-ty-silent line-through'
										: 'text-ty-secondary'}"
								>
									{task.title}
								</li>
							{/each}
							{#if s.totalTasks > 3}
								<li class="text-2xs text-ty-silent">
									{m.cal_more({
										count: s.totalTasks - 3,
									})}
								</li>
							{/if}
						</ul>
					{:else}
						<div class="mt-text-xs flex items-baseline justify-between text-xs">
							{#if !isFuture}
								<span class="font-medium {BAND_TEXT_CLASS[getBandBiggerBetter(s.completionRate)]}">
									{s.completionRate}%
								</span>
							{:else}
								<span class="font-medium text-info-strong">{m.cal_planned_label()}</span>
							{/if}
							{#if s.availableHours > 0}
								<span class="text-ty-silent"
									>{m.cal_budget({
										hours: s.availableHours,
									})}</span
								>
							{/if}
						</div>
						<ul class="mt-text-xs min-h-0 flex-1 space-y-text-2xs overflow-y-auto">
							{#each s.tasks as task (task.id)}
								<li class="flex items-start gap-grid-2xs text-xs leading-snug">
									<span
										class="mt-text-2xs h-1.5 w-1.5 shrink-0 rounded-full {task.completed
											? 'bg-success'
											: 'bg-surface-inset'}"
									></span>
									<span
										class="min-w-0 wrap-break-word {task.completed
											? 'text-ty-silent line-through'
											: 'text-ty-secondary'}"
									>
										{task.title}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				{:else if view === 'week'}
					<!-- Reachable only past the loading branch above: before the range lands
					     every cell is summary-less, and "No tasks" is a claim about the
					     user's day, not a description of a read that has not returned. -->
					<p class="mt-text-xs text-xs text-ty-silent">
						{isFuture ? m.cal_nothing_planned() : m.cal_no_tasks()}
					</p>
				{/if}
			</a>
		{/each}
	{/each}
</div>

{#if !calendar.isLoading && !calendar.hasAnyData}
	<p class="mt-text-xs text-center text-xs text-ty-silent">
		{m.cal_empty_1({
			view: viewLabel,
		})}
		<a
			href={localizeHref(resolve('/'))}
			class="text-ty-secondary underline decoration-ty-ghost underline-offset-4 hover:text-ty-primary"
			>{m.link_today()}</a
		>
		{m.cal_empty_2()}
	</p>
{/if}
