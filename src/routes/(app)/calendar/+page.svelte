<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import { getStatusBiggerBetter } from '$lib/metrics/status';
	import {
		type DaySummary,
		summarizeSession,
		monthGrid,
		startOfWeek,
		addDays,
		fromISO,
		toISODate,
		completionBarClass
	} from '$lib/metrics/history';
	import { initDB, getSessionsInRange, getAllFlowObservations } from '$lib/storage/db';
	import { fitUserConstants, DEFAULT_USER_CONSTANTS, type UserConstants } from '$lib/zenith';
	import { liveToday, localISODate } from '$lib/today.svelte';

	const today = $derived(liveToday.value);
	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const VIEWS = ['month', 'week'] as const;

	let view = $state<'month' | 'week'>('month');
	let anchor = $state(localISODate()); // any date inside the visible month/week
	let summaries = $state<Map<string, DaySummary>>(new Map());
	let constants = $state<UserConstants>(DEFAULT_USER_CONSTANTS);
	let ready = $state(false);
	let isLoading = $state(true);

	onMount(async () => {
		if (!browser) return;
		try {
			await initDB();
			// Same personalized constants as the dashboard, so per-day completion
			// rates match what the main page showed that day
			const obs = await getAllFlowObservations();
			constants = fitUserConstants(
				obs.map((o) => ({ E: o.E, beta: o.beta, phi: o.phiHours }))
			).constants;
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
			return anchorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
		}
		const start = fromISO(rangeStart);
		const end = fromISO(rangeEnd);
		const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		const endFmt = end.toLocaleDateString('en-US', {
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
		getSessionsInRange(start, end)
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
	<title>Zenith — Calendar</title>
	<meta name="description" content="Month and week overview of your Zenith days." />
</svelte:head>

<!-- Proton-calendar-style: the layout puts this page in a no-scroll full-viewport
     flex column — the grid's rows split the leftover height and cell content
     clips instead of growing -->
<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold text-zinc-100">Calendar</h1>
		<p class="mt-1 text-sm text-zinc-500">
			Each day shows tasks done, completion rate, and what you worked on. Click a day to open
			it — future days too, to plan ahead.
		</p>
	</div>

	<div class="flex flex-wrap items-center gap-2 sm:gap-3">
		<div class="inline-flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
			{#each VIEWS as v (v)}
				<button
					onclick={() => (view = v)}
					class="rounded-md px-3 py-1 text-sm capitalize transition-colors
					       {view === v ? 'bg-white/10 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}"
				>
					{v}
				</button>
			{/each}
		</div>

		<div class="flex items-center gap-1">
			<Button variant="outline" size="sm" onclick={goPrev} aria-label="Previous {view}">
				<ChevronLeft class="h-4 w-4" />
			</Button>
			<span class="min-w-28 sm:min-w-36 px-1 text-center text-sm font-medium text-zinc-200">
				{rangeLabel}
			</span>
			<Button variant="outline" size="sm" onclick={goNext} aria-label="Next {view}">
				<ChevronRight class="h-4 w-4" />
			</Button>
			{#if anchor !== today}
				<Button variant="outline" size="sm" class="ml-1" onclick={() => (anchor = today)}>
					Today
				</Button>
			{/if}
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
							? fromISO(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
							: dayNum}
					</span>
					{#if s}
						<span class="text-xs text-zinc-400">
							{#if isFuture}
								<span class="font-medium text-sky-300">{s.totalTasks}</span> planned
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
							title="Completion rate {s.completionRate}%"
						>
							<div
								class="h-full rounded-full {completionBarClass(s.completionRate)}"
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
								<li class="text-[11px] text-zinc-600">+{s.totalTasks - 3} more</li>
							{/if}
						</ul>
					{:else}
						<div class="mt-2 flex items-baseline justify-between text-xs">
							{#if !isFuture}
								<span class="font-medium {getStatusBiggerBetter(s.completionRate).color}">
									{s.completionRate}%
								</span>
							{:else}
								<span class="font-medium text-sky-300">Planned</span>
							{/if}
							{#if s.availableHours > 0}
								<span class="text-zinc-500">{s.availableHours}h budget</span>
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
					<p class="mt-2 text-xs text-zinc-600">{isFuture ? 'Nothing planned' : 'No tasks'}</p>
				{/if}
			</a>
		{/each}
	{/each}
</div>

{#if !isLoading && !hasAnyData}
	<p class="mt-2 text-center text-xs text-zinc-500">
		No data in this {view} yet — days you plan on the
		<a href="/" class="text-zinc-300 underline hover:text-zinc-100">Today</a> page will show up here.
	</p>
{/if}
