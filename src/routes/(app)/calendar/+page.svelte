<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import * as m from '$lib/paraglide/messages.js';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import { segmentedToggleVariants } from '$lib/presentation/component/segmented-toggle-variants';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import { cn } from '$lib/presentation/utils';
	import { Button } from '$lib/presentation/component/ui/button';
	import { getStatusBiggerBetter, getCompletionBarClass } from '$lib/presentation/utils/status';
	import { type DaySummary, summarizeSession } from '$lib/business/model/metric/history';
	import { monthGrid, startOfWeek, addDays, fromISO, toISODate } from '$lib/business/utils/date';
	import {
		initializeStorage,
		readSessionsByDateRange,
		readUserFit
	} from '$lib/business/store/session-history';
	import {
		DEFAULT_USER_CONSTANTS,
		type FitPosterior,
		type UserConstants
	} from '$lib/business/model/zenith';
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
	let posterior = $state<FitPosterior | undefined>(undefined);
	let ready = $state(false);
	let isLoading = $state(true);

	onMount(async () => {
		if (!browser) return;
		try {
			await initializeStorage();
			// Same personalized fit (constants + posterior) as the dashboard, so
			// per-day completion rates match what the main page showed that day
			const fit = await readUserFit();
			constants = fit.constants;
			posterior = fit.posterior;
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
		const [start, end, consts, post] = [rangeStart, rangeEnd, constants, posterior];
		const version = ++loadVersion;
		readSessionsByDateRange(start, end)
			.then((sessions) => {
				if (version !== loadVersion) return;
				// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local accumulator, assigned once
				const map = new Map<string, DaySummary>();
				for (const s of sessions) {
					if (s.tasks.length > 0) map.set(s.date, summarizeSession(s, consts, post));
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

<SeoHead title={m.cal_title_head()} description={m.cal_meta_description()} />

<!-- Proton-calendar-style: the layout puts this page in a no-scroll full-viewport
     flex column — the grid's rows split the leftover height and cell content
     clips instead of growing -->
<div class="mb-text-md flex flex-wrap items-center justify-between gap-grid-xs">
	<h1 class="text-2xl font-bold text-ty-primary">{m.cal_heading()}</h1>

	<div class="flex flex-wrap items-center gap-grid-xs">
		{#if anchor !== today}
			<Button variant="outline" size="sm" class="ml-1" onclick={() => (anchor = today)}>
				{m.link_today()}
			</Button>
		{/if}
		<div class="ml-auto inline-flex items-center rounded-lg border bg-surface-card p-0.5">
			{#each VIEWS as v (v)}
				<button
					onclick={() => (view = v)}
					class={cn(segmentedToggleVariants({ active: view === v }), 'capitalize')}
				>
					{v === 'month' ? m.cal_view_month() : m.cal_view_week()}
				</button>
			{/each}
		</div>

		<div class="flex items-center gap-grid-2xs">
			<Button
				variant="outline"
				size="sm"
				onclick={goPrev}
				aria-label={m.cal_previous({ view: viewLabel })}
			>
				<ChevronLeft class="h-4 w-4" />
			</Button>
			<span class="min-w-28 sm:min-w-36 px-1 text-center text-sm font-medium text-ty-primary">
				{rangeLabel}
			</span>
			<Button
				variant="outline"
				size="sm"
				onclick={goNext}
				aria-label={m.cal_next({ view: viewLabel })}
			>
				<ChevronRight class="h-4 w-4" />
			</Button>
		</div>
	</div>
</div>

<div
	class="grid min-h-0 flex-1 grid-cols-7 gap-grid-2xs"
	style="grid-template-rows: auto repeat({weeks.length}, minmax(0, 1fr));"
>
	{#each WEEKDAYS as day (day)}
		<div class="px-2 pb-1 text-xs font-medium tracking-wide text-ty-silent">{day}</div>
	{/each}

	{#each weeks as week (week[0])}
		{#each week as date (date)}
			{@const s = summaries.get(date)}
			{@const inMonth = view === 'week' || fromISO(date).getMonth() === anchorDate.getMonth()}
			{@const isFuture = date > today}
			{@const isToday = date === today}
			{@const dayNum = fromISO(date).getDate()}
			<a
				href={date === today ? resolve('/') : `${resolve('/')}?date=${date}`}
				class="group flex min-h-0 flex-col overflow-hidden rounded-lg sm:rounded-xl border p-1 sm:p-2 transition-colors
				       {isToday ? 'border-success/40' : s ? '' : 'border-line-soft'}
				       {s ? 'backdrop-blur bg-surface-card' : 'bg-transparent'}
				       {inMonth ? '' : 'opacity-40'}
				       cursor-pointer hover:border-line-strong hover:bg-surface-card"
			>
				<div class="flex items-baseline justify-between gap-1">
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
									day: 'numeric'
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

				{#if s}
					<!-- Future days are plans: nothing is completable yet, so no bar -->
					{#if !isFuture}
						<div
							class="mt-1.5 h-1 overflow-hidden rounded-full bg-border"
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
									class="truncate text-2xs leading-tight {task.completed
										? 'text-ty-silent line-through'
										: 'text-ty-secondary'}"
								>
									{task.title}
								</li>
							{/each}
							{#if s.totalTasks > 3}
								<li class="text-2xs text-ty-silent">{m.cal_more({ count: s.totalTasks - 3 })}</li>
							{/if}
						</ul>
					{:else}
						<div class="mt-2 flex items-baseline justify-between text-xs">
							{#if !isFuture}
								<span class="font-medium {getStatusBiggerBetter(s.completionRate).color}">
									{s.completionRate}%
								</span>
							{:else}
								<span class="font-medium text-info-strong">{m.cal_planned_label()}</span>
							{/if}
							{#if s.availableHours > 0}
								<span class="text-ty-silent">{m.cal_budget({ hours: s.availableHours })}</span>
							{/if}
						</div>
						<ul class="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
							{#each s.tasks as task (task.id)}
								<li class="flex items-start gap-1.5 text-xs leading-snug">
									<span
										class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full {task.completed
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
					<p class="mt-2 text-xs text-ty-silent">
						{isFuture ? m.cal_nothing_planned() : m.cal_no_tasks()}
					</p>
				{/if}
			</a>
		{/each}
	{/each}
</div>

{#if !isLoading && !hasAnyData}
	<p class="mt-text-xs text-center text-xs text-ty-silent">
		{m.cal_empty_1({ view: viewLabel })}
		<a href={resolve('/')} class="text-ty-secondary underline hover:text-ty-primary"
			>{m.link_today()}</a
		>
		{m.cal_empty_2()}
	</p>
{/if}
