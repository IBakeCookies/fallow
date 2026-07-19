<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import type { DailyQuadrant } from '$lib/business/model/metric/calculation';
	import { type DaySummary, summarizeSession, currentStreak } from '$lib/business/model/metric/history';
	import { addDays, fromISO } from '$lib/business/utils/date';
	import {
		initializeStorage,
		readSessionsByDateRange,
		readUserFit
	} from '$lib/business/store/session-history';
	import { liveToday } from '$lib/business/state/today.svelte';

	const today = $derived(liveToday.value);

	const RANGES = {
		week: { days: 7, label: () => m.ana_range_week(), prevLabel: () => m.ana_prev_week() },
		month: { days: 30, label: () => m.ana_range_month(), prevLabel: () => m.ana_prev_month() },
		year: { days: 365, label: () => m.ana_range_year(), prevLabel: () => '' }
	} as const;
	type RangeKey = keyof typeof RANGES;

	let range = $state<RangeKey>('week');
	// Every stored day with tasks in the last year, ascending by date
	let all = $state<DaySummary[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		if (!browser) return;
		try {
			await initializeStorage();
			const fit = await readUserFit();
			const sessions = await readSessionsByDateRange(addDays(today, -364), today);
			all = sessions
				.filter((s) => s.tasks.length > 0)
				.map((s) => summarizeSession(s, fit.constants, fit.posterior));
		} catch (e) {
			console.error('Failed to load analytics data', e);
		} finally {
			isLoading = false;
		}
	});

	const days = $derived(RANGES[range].days);
	const rangeStart = $derived(addDays(today, -(days - 1)));
	const inRange = $derived(all.filter((s) => s.date >= rangeStart));

	// ---------- Headline stats ----------
	const totalTasks = $derived(inRange.reduce((sum, s) => sum + s.totalTasks, 0));
	const completedTasks = $derived(inRange.reduce((sum, s) => sum + s.completedTasks, 0));
	const completedShare = $derived(totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);

	const avgRate = $derived(
		inRange.length > 0
			? Math.round(inRange.reduce((sum, s) => sum + s.completionRate, 0) / inRange.length)
			: 0
	);

	// Delta vs the previous period of the same length (year has none: this
	// page only loads the last 365 days)
	const prevRange = $derived.by(() => {
		if (range === 'year') return [];
		const start = addDays(today, -(2 * days - 1));
		const end = addDays(today, -days);
		return all.filter((s) => s.date >= start && s.date <= end);
	});
	const rateDelta = $derived.by(() => {
		if (prevRange.length === 0) return null;
		const prevAvg = prevRange.reduce((sum, s) => sum + s.completionRate, 0) / prevRange.length;
		return avgRate - Math.round(prevAvg);
	});

	const plannedHours = $derived(
		Math.round(inRange.reduce((sum, s) => sum + (Number(s.availableHours) || 0), 0) * 10) / 10
	);

	const streak = $derived(
		currentStreak(new Set(all.filter((s) => s.completedTasks > 0).map((s) => s.date)), today)
	);

	const bestDay = $derived.by(() => {
		const withDone = inRange.filter((s) => s.completedTasks > 0);
		if (withDone.length === 0) return null;
		return withDone.reduce((best, s) =>
			s.completionRate > best.completionRate ||
			(s.completionRate === best.completionRate && s.completedTasks > best.completedTasks)
				? s
				: best
		);
	});

	function formatDay(iso: string): string {
		return fromISO(iso).toLocaleDateString(getDateLocale(), { month: 'short', day: 'numeric' });
	}

	// ---------- Day profile distribution ----------
	const QUADRANTS: { key: DailyQuadrant; label: string; color: string }[] = [
		{ key: 'flow', label: m.quadrant_flow(), color: '#a78bfa' },
		{ key: 'cruise', label: m.quadrant_cruise(), color: '#38bdf8' },
		{ key: 'grind', label: m.quadrant_grind(), color: '#fb923c' },
		{ key: 'routine', label: m.quadrant_routine(), color: '#a1a1aa' }
	];
	const quadrantCounts = $derived.by(() => {
		const counts: Record<DailyQuadrant, number> = { flow: 0, cruise: 0, grind: 0, routine: 0 };
		for (const s of inRange) counts[s.quadrant]++;
		return counts;
	});

	// ---------- Chart: completion rate per day (per month for the year view) ----------
	type ChartPoint = {
		label: string; // short x-axis label
		full: string; // tooltip label
		value: number | null; // null = no data for this slot
		sub: string;
		showLabel: boolean;
	};

	const chartPoints = $derived.by((): ChartPoint[] => {
		if (range === 'year') {
			// Bucket by calendar month, newest 12 months (oldest may be partial)
			const buckets = new Map<string, DaySummary[]>();
			for (const s of inRange) {
				const key = s.date.slice(0, 7);
				if (!buckets.has(key)) buckets.set(key, []);
				buckets.get(key)!.push(s);
			}
			const points: ChartPoint[] = [];
			// Walk month by month so empty months still occupy a slot
			let cursor = rangeStart.slice(0, 7) + '-01';
			while (cursor.slice(0, 7) <= today.slice(0, 7)) {
				const key = cursor.slice(0, 7);
				const daysIn = buckets.get(key) ?? [];
				const monthLabel = fromISO(cursor).toLocaleDateString(getDateLocale(), { month: 'short' });
				points.push({
					label: monthLabel,
					full: fromISO(cursor).toLocaleDateString(getDateLocale(), {
						month: 'long',
						year: 'numeric'
					}),
					value: daysIn.length
						? Math.round(daysIn.reduce((sum, s) => sum + s.completionRate, 0) / daysIn.length)
						: null,
					sub: daysIn.length
						? daysIn.length === 1
							? m.ana_active_day_one()
							: m.ana_active_day_other({ count: daysIn.length })
						: m.ana_no_data(),
					showLabel: true
				});
				const d = fromISO(cursor);
				cursor = `${d.getFullYear()}-${String(d.getMonth() + 2).padStart(2, '0')}-01`;
				if (d.getMonth() === 11) cursor = `${d.getFullYear() + 1}-01-01`;
				if (points.length > 13) break; // safety
			}
			return points;
		}

		const byDate = new Map(inRange.map((s) => [s.date, s]));
		return Array.from({ length: days }, (_, i) => {
			const date = addDays(rangeStart, i);
			const s = byDate.get(date);
			const d = fromISO(date);
			return {
				label:
					range === 'week'
						? d.toLocaleDateString(getDateLocale(), { weekday: 'short' })
						: d.toLocaleDateString(getDateLocale(), { month: 'short', day: 'numeric' }),
				full: d.toLocaleDateString(getDateLocale(), {
					weekday: 'short',
					month: 'short',
					day: 'numeric'
				}),
				value: s ? s.completionRate : null,
				sub: s
					? m.ana_tasks_done_sub({ completed: s.completedTasks, total: s.totalTasks })
					: m.ana_no_data(),
				showLabel: range === 'week' || i % 5 === 0,
				...(date === today
					? {
							full: m.ana_today_label({
								date: d.toLocaleDateString(getDateLocale(), { month: 'short', day: 'numeric' })
							})
						}
					: {})
			};
		});
	});

	// SVG geometry (fixed viewBox, responsive via width: 100%)
	const CHART = { w: 800, h: 240, top: 12, right: 8, bottom: 26, left: 34 };
	const innerW = CHART.w - CHART.left - CHART.right;
	const innerH = CHART.h - CHART.top - CHART.bottom;
	const yTicks = [0, 25, 50, 75, 100];
	const yPos = (v: number) => CHART.top + innerH - (v / 100) * innerH;

	const bars = $derived.by(() => {
		const n = chartPoints.length;
		if (n === 0) return [];
		const slot = innerW / n;
		const barW = Math.min(24, slot * 0.65);
		return chartPoints.map((p, i) => {
			const slotX = CHART.left + i * slot;
			const x = slotX + (slot - barW) / 2;
			// A 0% day still gets a 2px stub so "0%" and "no data" read differently
			const h = p.value === null ? 0 : Math.max(2, (p.value / 100) * innerH);
			return { ...p, slotX, slotW: slot, x, w: barW, y: CHART.top + innerH - h, h };
		});
	});

	function barPath(x: number, y: number, w: number, h: number): string {
		// Rounded at the data end, square at the baseline
		const r = Math.min(4, h, w / 2);
		const bottom = y + h;
		return `M${x},${bottom} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${bottom} Z`;
	}

	const hasData = $derived(inRange.length > 0);
	const activeDaysWithCompletion = $derived(inRange.filter((s) => s.completedTasks > 0).length);
</script>

<SeoHead title={m.ana_title_head()} description={m.ana_meta_description()} />

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold text-zinc-100">{m.ana_heading()}</h1>
		<p class="mt-1 text-sm text-zinc-500">
			{m.ana_subtitle()}
		</p>
	</div>

	<div class="inline-flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
		{#each Object.entries(RANGES) as [key, r] (key)}
			<button
				onclick={() => (range = key as RangeKey)}
				class="rounded-md px-3 py-1 text-sm transition-colors
				       {range === key ? 'bg-white/10 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}"
			>
				{r.label()}
			</button>
		{/each}
	</div>
</div>

{#if isLoading}
	<p class="text-sm text-zinc-500">{m.ana_loading()}</p>
{:else if !hasData}
	<div class="rounded-xl border border-white/10 bg-white/3 p-8 text-center backdrop-blur-xl">
		<p class="text-zinc-300">{m.ana_empty()}</p>
		<p class="mt-1 text-sm text-zinc-500">
			{m.ana_empty_hint_1()}
			<a href="/" class="text-zinc-300 underline hover:text-zinc-100">{m.link_today()}</a>
			{m.ana_empty_hint_2()}
		</p>
	</div>
{:else}
	<!-- KPI tiles -->
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		<div class="rounded-xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
			<p class="text-xs text-zinc-500">{m.ana_tasks_completed()}</p>
			<p class="mt-1 text-2xl font-semibold text-zinc-100">
				{completedTasks} <span class="text-base font-normal text-zinc-500">/ {totalTasks}</span>
			</p>
			<p class="mt-0.5 text-xs text-zinc-500">{m.ana_of_planned({ percent: completedShare })}</p>
		</div>

		<div class="rounded-xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
			<p class="text-xs text-zinc-500">{m.ana_avg_rate()}</p>
			<p class="mt-1 text-2xl font-semibold text-zinc-100">{avgRate}%</p>
			<p class="mt-0.5 text-xs text-zinc-500">
				{#if rateDelta !== null}
					<span class={rateDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
						{rateDelta >= 0 ? '+' : ''}{rateDelta}%
					</span>
					{m.ana_vs_prev({ period: RANGES[range].prevLabel() })}
				{:else}
					{m.ana_rate_note()}
				{/if}
			</p>
		</div>

		<div class="rounded-xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
			<p class="text-xs text-zinc-500">{m.ana_active_days()}</p>
			<p class="mt-1 text-2xl font-semibold text-zinc-100">
				{inRange.length} <span class="text-base font-normal text-zinc-500">/ {days}</span>
			</p>
			<p class="mt-0.5 text-xs text-zinc-500">
				{m.ana_with_completion({ count: activeDaysWithCompletion })}
			</p>
		</div>

		<div class="rounded-xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
			<p class="text-xs text-zinc-500">{m.ana_current_streak()}</p>
			<p class="mt-1 text-2xl font-semibold text-zinc-100">
				{streak}
				<span class="text-base font-normal text-zinc-500">
					{streak === 1 ? m.ana_day_one() : m.ana_day_other()}
				</span>
			</p>
			<p class="mt-0.5 text-xs text-zinc-500">{m.ana_streak_note()}</p>
		</div>

		<div class="rounded-xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
			<p class="text-xs text-zinc-500">{m.ana_planned_hours()}</p>
			<p class="mt-1 text-2xl font-semibold text-zinc-100">{plannedHours}h</p>
			<p class="mt-0.5 text-xs text-zinc-500">{m.ana_planned_hours_note()}</p>
		</div>

		<div class="rounded-xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
			<p class="text-xs text-zinc-500">{m.ana_best_day()}</p>
			{#if bestDay}
				<p class="mt-1 text-2xl font-semibold text-zinc-100">{formatDay(bestDay.date)}</p>
				<p class="mt-0.5 text-xs text-zinc-500">
					{bestDay.completedTasks === 1
						? m.ana_best_day_note_one({ rate: bestDay.completionRate })
						: m.ana_best_day_note({
								rate: bestDay.completionRate,
								count: bestDay.completedTasks
							})}
				</p>
			{:else}
				<p class="mt-1 text-2xl font-semibold text-zinc-500">—</p>
				<p class="mt-0.5 text-xs text-zinc-500">{m.ana_no_completed()}</p>
			{/if}
		</div>
	</div>

	<!-- Completion trend -->
	<div class="mt-6 rounded-xl border border-white/10 bg-white/3 p-5 backdrop-blur-xl">
		<h2 class="text-sm font-medium text-zinc-200">{m.ana_completion_rate()}</h2>
		<p class="mt-0.5 text-xs text-zinc-500">
			{range === 'year' ? m.ana_chart_hint_year() : m.ana_chart_hint_day()}
		</p>

		<svg
			viewBox="0 0 {CHART.w} {CHART.h}"
			class="mt-4 w-full"
			role="img"
			aria-label={m.ana_chart_aria({ range: RANGES[range].label().toLowerCase() })}
		>
			{#each yTicks as tick (tick)}
				<line
					x1={CHART.left}
					x2={CHART.w - CHART.right}
					y1={yPos(tick)}
					y2={yPos(tick)}
					stroke="rgba(255,255,255,0.08)"
					stroke-width="1"
				/>
				<text
					x={CHART.left - 8}
					y={yPos(tick) + 3}
					text-anchor="end"
					class="fill-zinc-500"
					font-size="10"
					style="font-variant-numeric: tabular-nums"
				>
					{tick}
				</text>
			{/each}

			{#each bars as bar, i (i)}
				{#if bar.value !== null}
					<path d={barPath(bar.x, bar.y, bar.w, bar.h)} fill="#818cf8">
						<title>{bar.full} — {bar.value}% · {bar.sub}</title>
					</path>
				{/if}
				{#if bar.showLabel}
					<text
						x={bar.slotX + bar.slotW / 2}
						y={CHART.h - 8}
						text-anchor="middle"
						class="fill-zinc-500"
						font-size="10"
					>
						{bar.label}
					</text>
				{/if}
				<!-- full-slot hover target so tooltips don't require pixel-perfect aim -->
				<rect
					x={bar.slotX}
					y={CHART.top}
					width={bar.slotW}
					height={innerH}
					fill="transparent"
				>
					<title>{bar.full} — {bar.value === null ? m.ana_no_data() : `${bar.value}% · ${bar.sub}`}</title>
				</rect>
			{/each}
		</svg>
	</div>

	<!-- Day profiles -->
	<div class="mt-6 rounded-xl border border-white/10 bg-white/3 p-5 backdrop-blur-xl">
		<h2 class="text-sm font-medium text-zinc-200">{m.ana_day_profiles()}</h2>
		<p class="mt-0.5 text-xs text-zinc-500">
			{m.ana_day_profiles_hint()}
		</p>

		<div class="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
			{#each QUADRANTS as q (q.key)}
				{#if quadrantCounts[q.key] > 0}
					<div
						style="width: {(quadrantCounts[q.key] / inRange.length) * 100}%; background: {q.color}"
						title={quadrantCounts[q.key] === 1
							? m.ana_quadrant_count_one({ label: q.label })
							: m.ana_quadrant_count_other({ label: q.label, count: quadrantCounts[q.key] })}
					></div>
				{/if}
			{/each}
		</div>

		<div class="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
			{#each QUADRANTS as q (q.key)}
				<div class="flex items-center gap-1.5 text-xs">
					<span class="h-2 w-2 rounded-full" style="background: {q.color}"></span>
					<span class="text-zinc-400">{q.label}</span>
					<span class="font-medium text-zinc-200" style="font-variant-numeric: tabular-nums">
						{quadrantCounts[q.key]}
					</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
