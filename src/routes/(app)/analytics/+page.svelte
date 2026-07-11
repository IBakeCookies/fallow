<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import type { DailyQuadrant } from '$lib/metrics/calculations';
	import {
		type DaySummary,
		summarizeSession,
		addDays,
		fromISO,
		currentStreak
	} from '$lib/metrics/history';
	import { initDB, getSessionsInRange, getAllFlowObservations } from '$lib/storage/db';
	import { fitUserConstants } from '$lib/zenith';

	const today = new Date().toISOString().slice(0, 10);

	const RANGES = {
		week: { days: 7, label: 'Last 7 days', prevLabel: 'previous 7 days' },
		month: { days: 30, label: 'Last 30 days', prevLabel: 'previous 30 days' },
		year: { days: 365, label: 'Last 12 months', prevLabel: '' }
	} as const;
	type RangeKey = keyof typeof RANGES;

	let range = $state<RangeKey>('week');
	// Every stored day with tasks in the last year, ascending by date
	let all = $state<DaySummary[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		if (!browser) return;
		try {
			await initDB();
			const obs = await getAllFlowObservations();
			const constants = fitUserConstants(
				obs.map((o) => ({ E: o.E, beta: o.beta, phi: o.phiHours }))
			).constants;
			const sessions = await getSessionsInRange(addDays(today, -364), today);
			all = sessions.filter((s) => s.tasks.length > 0).map((s) => summarizeSession(s, constants));
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

	// Delta vs the previous period of the same length (year has no prior data:
	// sessions older than a year are cleaned up)
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
		return fromISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// ---------- Day profile distribution ----------
	const QUADRANTS: { key: DailyQuadrant; label: string; color: string }[] = [
		{ key: 'flow', label: 'Flow Zone', color: '#a78bfa' },
		{ key: 'cruise', label: 'Cruise', color: '#38bdf8' },
		{ key: 'grind', label: 'Grind Mode', color: '#fb923c' },
		{ key: 'routine', label: 'Routine', color: '#a1a1aa' }
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
				const monthLabel = fromISO(cursor).toLocaleDateString('en-US', { month: 'short' });
				points.push({
					label: monthLabel,
					full: fromISO(cursor).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
					value: daysIn.length
						? Math.round(daysIn.reduce((sum, s) => sum + s.completionRate, 0) / daysIn.length)
						: null,
					sub: daysIn.length ? `${daysIn.length} active day${daysIn.length === 1 ? '' : 's'}` : 'no data',
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
						? d.toLocaleDateString('en-US', { weekday: 'short' })
						: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
				full: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
				value: s ? s.completionRate : null,
				sub: s ? `${s.completedTasks}/${s.totalTasks} tasks done` : 'no data',
				showLabel: range === 'week' || i % 5 === 0,
				...(date === today ? { full: `Today, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` } : {})
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

<svelte:head>
	<title>Zenith — Analytics</title>
	<meta name="description" content="Completion trends and task stats across your Zenith days." />
</svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold text-zinc-100">Analytics</h1>
		<p class="mt-1 text-sm text-zinc-500">
			How your days have gone — completion, streaks, and day profiles over time.
		</p>
	</div>

	<div class="inline-flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
		{#each Object.entries(RANGES) as [key, r] (key)}
			<button
				onclick={() => (range = key as RangeKey)}
				class="rounded-md px-3 py-1 text-sm transition-colors
				       {range === key ? 'bg-white/10 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}"
			>
				{r.label}
			</button>
		{/each}
	</div>
</div>

{#if isLoading}
	<p class="text-sm text-zinc-500">Loading…</p>
{:else if !hasData}
	<div class="rounded-xl border border-white/10 bg-white/3 p-8 text-center backdrop-blur-xl">
		<p class="text-zinc-300">Nothing to analyze in this range yet.</p>
		<p class="mt-1 text-sm text-zinc-500">
			Plan a day on the <a href="/" class="text-zinc-300 underline hover:text-zinc-100">Today</a>
			page and it will show up here.
		</p>
	</div>
{:else}
	<!-- KPI tiles -->
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		<div class="rounded-xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
			<p class="text-xs text-zinc-500">Tasks completed</p>
			<p class="mt-1 text-2xl font-semibold text-zinc-100">
				{completedTasks} <span class="text-base font-normal text-zinc-500">/ {totalTasks}</span>
			</p>
			<p class="mt-0.5 text-xs text-zinc-500">{completedShare}% of planned tasks</p>
		</div>

		<div class="rounded-xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
			<p class="text-xs text-zinc-500">Avg completion rate</p>
			<p class="mt-1 text-2xl font-semibold text-zinc-100">{avgRate}%</p>
			<p class="mt-0.5 text-xs text-zinc-500">
				{#if rateDelta !== null}
					<span class={rateDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
						{rateDelta >= 0 ? '+' : ''}{rateDelta}%
					</span>
					vs {RANGES[range].prevLabel}
				{:else}
					priority-weighted, per active day
				{/if}
			</p>
		</div>

		<div class="rounded-xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
			<p class="text-xs text-zinc-500">Active days</p>
			<p class="mt-1 text-2xl font-semibold text-zinc-100">
				{inRange.length} <span class="text-base font-normal text-zinc-500">/ {days}</span>
			</p>
			<p class="mt-0.5 text-xs text-zinc-500">
				{activeDaysWithCompletion} with at least one task done
			</p>
		</div>

		<div class="rounded-xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
			<p class="text-xs text-zinc-500">Current streak</p>
			<p class="mt-1 text-2xl font-semibold text-zinc-100">
				{streak} <span class="text-base font-normal text-zinc-500">day{streak === 1 ? '' : 's'}</span>
			</p>
			<p class="mt-0.5 text-xs text-zinc-500">consecutive days with a completed task</p>
		</div>

		<div class="rounded-xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
			<p class="text-xs text-zinc-500">Planned hours</p>
			<p class="mt-1 text-2xl font-semibold text-zinc-100">{plannedHours}h</p>
			<p class="mt-0.5 text-xs text-zinc-500">time budget across active days</p>
		</div>

		<div class="rounded-xl border border-white/10 bg-white/3 p-4 backdrop-blur-xl">
			<p class="text-xs text-zinc-500">Best day</p>
			{#if bestDay}
				<p class="mt-1 text-2xl font-semibold text-zinc-100">{formatDay(bestDay.date)}</p>
				<p class="mt-0.5 text-xs text-zinc-500">
					{bestDay.completionRate}% rate · {bestDay.completedTasks} task{bestDay.completedTasks ===
					1
						? ''
						: 's'} done
				</p>
			{:else}
				<p class="mt-1 text-2xl font-semibold text-zinc-500">—</p>
				<p class="mt-0.5 text-xs text-zinc-500">no completed tasks yet</p>
			{/if}
		</div>
	</div>

	<!-- Completion trend -->
	<div class="mt-6 rounded-xl border border-white/10 bg-white/3 p-5 backdrop-blur-xl">
		<h2 class="text-sm font-medium text-zinc-200">Completion rate</h2>
		<p class="mt-0.5 text-xs text-zinc-500">
			{range === 'year'
				? 'Monthly average of the priority-weighted daily completion rate'
				: 'Priority-weighted completion rate per day — hover a bar for details'}
		</p>

		<svg
			viewBox="0 0 {CHART.w} {CHART.h}"
			class="mt-4 w-full"
			role="img"
			aria-label="Bar chart of completion rate over the {RANGES[range].label.toLowerCase()}"
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
					<title>{bar.full} — {bar.value === null ? 'no data' : `${bar.value}% · ${bar.sub}`}</title>
				</rect>
			{/each}
		</svg>
	</div>

	<!-- Day profiles -->
	<div class="mt-6 rounded-xl border border-white/10 bg-white/3 p-5 backdrop-blur-xl">
		<h2 class="text-sm font-medium text-zinc-200">Day profiles</h2>
		<p class="mt-0.5 text-xs text-zinc-500">
			Character of your active days: challenging &amp; engaging (Flow), demanding (Grind), light
			&amp; fun (Cruise), or low-key (Routine)
		</p>

		<div class="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
			{#each QUADRANTS as q (q.key)}
				{#if quadrantCounts[q.key] > 0}
					<div
						style="width: {(quadrantCounts[q.key] / inRange.length) * 100}%; background: {q.color}"
						title="{q.label}: {quadrantCounts[q.key]} day{quadrantCounts[q.key] === 1 ? '' : 's'}"
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
