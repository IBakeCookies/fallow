<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import * as m from '$lib/paraglide/messages.js';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import { Button } from '$lib/presentation/component/ui/button';
	import { getStatusBiggerBetter, getCompletionBarClass } from '$lib/presentation/utils/status';
	import { type DaySummary, summarizeSession } from '$lib/business/model/metric/history';
	import { monthGrid, startOfWeek, addDays, fromISO, toISODate } from '$lib/business/utils/date';
	import {
		initializeStorage,
		readSessionsByDateRange,
		readUserConstants
	} from '$lib/business/store/session-history';
	import { DEFAULT_USER_CONSTANTS, type UserConstants } from '$lib/business/model/zenith';
	import { liveToday } from '$lib/business/state/today.svelte';

	const today = $derived(liveToday.value);
	const WEEKDAYS = [
		m.weekday_mon(),
		m.weekday_tue(),
		m.weekday_wed(),
		m.weekday_thu(),
		m.weekday_fri(),
		m.weekday_sat(),
		m.weekday_sun()
	];
	const VIEWS = ['month', 'week'] as const;

	let view = $state<'month' | 'week'>('month');
	let anchor = $state(toISODate()); // any date inside the visible month/week
	const viewLabel = $derived(view === 'month' ? m.cal_view_month() : m.cal_view_week());
	let summaries = $state<Map<string, DaySummary>>(new Map());
	let constants = $state<UserConstants>(DEFAULT_USER_CONSTANTS);
	let ready = $state(false);
	let isLoading = $state(true);

	onMount(async () => {
		if (!browser) return;
		try {
			await initializeStorage();
			// Same personalized constants as the dashboard, so per-day completion
			// rates match what the main page showed that day
			constants = await readUserConstants();
		} catch (e) {
			console.error('Failed to initialize calendar', e);
		} finally {
			ready = true;
		}
	});

	const anchorDate = $derived(fromISO(anchor));
	const weeks = $derived(
		view === 'month'
			? monthGrid(anchorDate.getFullYear(), anchorDate.getMonth())
			: [Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))]
	);
	const rangeStart = $derived(weeks[0][0]);
	const rangeEnd = $derived(weeks[weeks.length - 1][6]);

	const rangeLabel = $derived.by(() => {
		if (view === 'month') {
			return anchorDate.toLocaleDateString(getDateLocale(), { month: 'long', year: 'numeric' });
		}
		const start = fromISO(rangeStart);
		const end = fromISO(rangeEnd);
		const startFmt = start.toLocaleDateString(getDateLocale(), { month: 'short', day: 'numeric' });
		const endFmt = end.toLocaleDateString(getDateLocale(), {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
		return `${startFmt} – ${endFmt}`;
	});

	// Reload whenever the visible range (or fitted constants) changes; the
	// version guard drops stale responses from rapid prev/next clicks.
	let loadVersion = 0;
	$effect(() => {
		if (!ready) return;
		const [start, end, consts] = [rangeStart, rangeEnd, constants];
		const version = ++loadVersion;
		readSessionsByDateRange(start, end)
			.then((sessions) => {
				if (version !== loadVersion) return;
				const map = new Map<string, DaySummary>();
				for (const s of sessions) {
					if (s.tasks.length > 0) map.set(s.date, summarizeSession(s, consts));
				}
				summaries = map;
				isLoading = false;
			})
			.catch((e) => console.error('Failed to load sessions', e));
	});

	function shiftMonth(iso: string, n: number): string {
		const d = fromISO(iso);
		return toISODate(new Date(d.getFullYear(), d.getMonth() + n, 1));
	}

	function goPrev() {
		anchor = view === 'month' ? shiftMonth(anchor, -1) : addDays(startOfWeek(anchor), -7);
	}

	function goNext() {
		anchor = view === 'month' ? shiftMonth(anchor, 1) : addDays(startOfWeek(anchor), 7);
	}

	const hasAnyData = $derived(summaries.size > 0);
</script>

<svelte:head>
	<title>{m.cal_title_head()}</title>
	<meta name="description" content={m.cal_meta_description()} />
</svelte:head>

<!-- Proton-calendar-style: the layout puts this page in a no-scroll full-viewport
     flex column — the grid's rows split the leftover height and cell content
     clips instead of growing -->
<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold text-zinc-100">{m.cal_heading()}</h1>

	<div class="flex flex-wrap items-center gap-2 sm:gap-3">
		{#if anchor !== today}
			<Button variant="outline" size="sm" class="ml-1" onclick={() => (anchor = today)}>
				{m.link_today()}
			</Button>
		{/if}
		<div
			class="ml-auto inline-flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5"
		>
			{#each VIEWS as v (v)}
				<button
					onclick={() => (view = v)}
					class="rounded-md px-3 py-1 text-sm capitalize transition-colors
					       {view === v ? 'bg-white/10 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}"
				>
					{v === 'month' ? m.cal_view_month() : m.cal_view_week()}
				</button>
			{/each}
		</div>

		<div class="flex items-center gap-1">
			<Button variant="outline" size="sm" onclick={goPrev} aria-label={m.cal_previous({ view: viewLabel })}>
				<ChevronLeft class="h-4 w-4" />
			</Button>
			<span class="min-w-28 sm:min-w-36 px-1 text-center text-sm font-medium text-zinc-200">
				{rangeLabel}
			</span>
			<Button variant="outline" size="sm" onclick={goNext} aria-label={m.cal_next({ view: viewLabel })}>
				<ChevronRight class="h-4 w-4" />
			</Button>
		</div>
	</div>
</div>

<div
	class="grid min-h-0 flex-1 grid-cols-7 gap-1.5"
	style="grid-template-rows: auto repeat({weeks.length}, minmax(0, 1fr));"
>
	{#each WEEKDAYS as day (day)}
		<div class="px-2 pb-1 text-xs font-medium tracking-wide text-zinc-500">{day}</div>
	{/each}

	{#each weeks as week (week[0])}
		{#each week as date (date)}
			{@const s = summaries.get(date)}
			{@const inMonth = view === 'week' || fromISO(date).getMonth() === anchorDate.getMonth()}
			{@const isFuture = date > today}
			{@const isToday = date === today}
			{@const dayNum = fromISO(date).getDate()}
			<a
				href={date === today ? '/' : `/?date=${date}`}
				class="group flex min-h-0 flex-col overflow-hidden rounded-lg sm:rounded-xl border p-1 sm:p-2 transition-colors
				       {isToday ? 'border-emerald-500/40' : s ? 'border-white/10' : 'border-white/5'}
				       {s ? 'bg-white/3' : 'bg-transparent'}
				       {inMonth ? '' : 'opacity-40'}
				       cursor-pointer hover:border-white/25 hover:bg-white/5"
			>
				<div class="flex items-baseline justify-between gap-1">
					<span
						class="text-sm font-medium {isToday
							? 'text-emerald-400'
							: s
								? 'text-zinc-200'
								: 'text-zinc-500'}"
					>
						{view === 'week'
							? fromISO(date).toLocaleDateString(getDateLocale(), {
									weekday: 'short',
									day: 'numeric'
								})
							: dayNum}
					</span>
					{#if s}
						<span class="text-xs text-zinc-400">
							{#if isFuture}
								<span class="font-medium text-sky-300">{s.totalTasks}</span>
								{m.cal_planned()}
							{:else}
								<span class="font-medium text-zinc-200">{s.completedTasks}</span>/{s.totalTasks}
							{/if}
						</span>
					{/if}
				</div>

				{#if s}
					<!-- Future days are plans: nothing is completable yet, so no bar -->
					{#if !isFuture}
						<div
							class="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10"
							title={m.cal_completion_title({ rate: s.completionRate })}
						>
							<div
								class="h-full rounded-full {getCompletionBarClass(s.completionRate)}"
								style="width: {s.completionRate}%"
							></div>
						</div>
					{/if}

					{#if view === 'month'}
						<ul class="mt-1.5 min-h-0 flex-1 space-y-0.5 overflow-hidden">
							{#each s.tasks.slice(0, 3) as task (task.id)}
								<li
									class="truncate text-[11px] leading-tight {task.completed
										? 'text-zinc-500 line-through'
										: 'text-zinc-400'}"
								>
									{task.title}
								</li>
							{/each}
							{#if s.totalTasks > 3}
								<li class="text-[11px] text-zinc-600">{m.cal_more({ count: s.totalTasks - 3 })}</li>
							{/if}
						</ul>
					{:else}
						<div class="mt-2 flex items-baseline justify-between text-xs">
							{#if !isFuture}
								<span class="font-medium {getStatusBiggerBetter(s.completionRate).color}">
									{s.completionRate}%
								</span>
							{:else}
								<span class="font-medium text-sky-300">{m.cal_planned_label()}</span>
							{/if}
							{#if s.availableHours > 0}
								<span class="text-zinc-500">{m.cal_budget({ hours: s.availableHours })}</span>
							{/if}
						</div>
						<ul class="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
							{#each s.tasks as task (task.id)}
								<li class="flex items-start gap-1.5 text-xs leading-snug">
									<span
										class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full {task.completed
											? 'bg-emerald-400'
											: 'bg-zinc-600'}"
									></span>
									<span
										class="min-w-0 break-words {task.completed
											? 'text-zinc-500 line-through'
											: 'text-zinc-300'}"
									>
										{task.title}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				{:else if view === 'week'}
					<p class="mt-2 text-xs text-zinc-600">
						{isFuture ? m.cal_nothing_planned() : m.cal_no_tasks()}
					</p>
				{/if}
			</a>
		{/each}
	{/each}
</div>

{#if !isLoading && !hasAnyData}
	<p class="mt-2 text-center text-xs text-zinc-500">
		{m.cal_empty_1({ view: viewLabel })}
		<a href="/" class="text-zinc-300 underline hover:text-zinc-100">{m.link_today()}</a>
		{m.cal_empty_2()}
	</p>
{/if}
