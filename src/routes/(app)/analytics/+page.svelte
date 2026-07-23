<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import { segmentedToggleVariants } from '$lib/presentation/component/segmented-toggle-variants';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import type { DailyQuadrant } from '$lib/business/model/metric/calculation';
	import {
		type DaySummary,
		summarizeSession,
		currentStreak
	} from '$lib/business/model/metric/history';
	import { addDays, fromISO } from '$lib/business/utils/date';
	import {
		initializeStorage,
		readCalibrationSnapshot,
		readPlanAuditDays,
		readSessionsByDateRange,
		readUserFit,
		type CalibrationSnapshot
	} from '$lib/business/store/session-history';
	import { auditPlanAdherence, type PlanAudit } from '$lib/business/model/plan-audit';
	import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
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
	// Plan-adherence audit (MATH.md §12); null while loading
	let audit = $state<PlanAudit | null>(null);
	// Calibration snapshot ("Your model" card); null while loading
	let calibration = $state<CalibrationSnapshot | null>(null);
	// One optimizer run per audited day (~60ms each) — cap the lookback
	const AUDIT_DAY_CAP = 30;

	onMount(async () => {
		if (!browser) return;
		try {
			await initializeStorage();
			const fit = await readUserFit();
			const sessions = await readSessionsByDateRange(addDays(today, -364), today);
			all = sessions
				.filter((s) => s.tasks.length > 0)
				.map((s) => summarizeSession(s, fit.constants, fit.posterior));
			// Main view can paint before the audit's optimizer runs finish.
			isLoading = false;
			const [auditDays, snapshot] = await Promise.all([
				readPlanAuditDays(today),
				readCalibrationSnapshot(today)
			]);
			calibration = snapshot;
			audit = auditPlanAdherence(
				auditDays.slice(-AUDIT_DAY_CAP),
				snapshot.energy.params,
				fit.constants,
				fit.posterior
			);
		} catch (e) {
			console.error('Failed to load analytics data', e);
			audit ??= auditPlanAdherence([], DEFAULT_ENERGY_PARAMS);
		} finally {
			isLoading = false;
		}
	});

	// "Your model" rows: fitted value (± std) next to its default and log count.
	// ≈/±/units match the Energy Lab's fit lines; counts are the fits' OWN
	// usedCounts (informative observations, not raw log rows).
	const modelRows = $derived.by(() => {
		if (!calibration) return [];
		const f2 = (x: number) => x.toFixed(2);
		const minutes = (h: number) => `${Math.round(h * 60)}m`;
		const rate = (
			fit: { fitted: boolean },
			value: number,
			std: number | undefined,
			unit: string
		) => (fit.fitted ? `≈ ${f2(value)} ± ${f2(std ?? 0)} ${unit}` : `${f2(value)} ${unit}`);
		const { flow, energy, stopping } = calibration;
		return [
			{
				label: m.ana_model_flow(),
				value: flow.fitted ? `≈ ${minutes(flow.phiHours)}` : minutes(flow.phiHours),
				note: m.ana_model_note_flow({
					value: minutes(flow.defaultPhiHours),
					count: flow.usedCount
				})
			},
			{
				label: m.ana_model_recovery(),
				value: rate(energy.recovery, energy.recovery.rate, energy.recovery.rateStd, '/h'),
				note: m.ana_model_note_ratings({
					value: f2(DEFAULT_ENERGY_PARAMS.recoveryRate),
					count: energy.recovery.usedCount
				})
			},
			{
				label: m.ana_model_drain_cog(),
				value: rate(
					energy.cognitiveDrain,
					energy.cognitiveDrain.alpha,
					energy.cognitiveDrain.alphaStd,
					'/h'
				),
				note: m.ana_model_note_ratings({
					value: f2(DEFAULT_ENERGY_PARAMS.alphaCog),
					count: energy.cognitiveDrain.usedCount
				})
			},
			{
				label: m.ana_model_drain_phys(),
				value: rate(
					energy.physicalDrain,
					energy.physicalDrain.alpha,
					energy.physicalDrain.alphaStd,
					'/h'
				),
				note: m.ana_model_note_ratings({
					value: f2(DEFAULT_ENERGY_PARAMS.alphaPhys),
					count: energy.physicalDrain.usedCount
				})
			},
			{
				label: m.ana_model_stop(),
				value: rate(stopping, stopping.value, stopping.valueStd, 'out/h'),
				note: m.ana_model_note_days({
					value: f2(DEFAULT_ENERGY_PARAMS.freeTimeValue),
					count: stopping.usedCount
				})
			}
		];
	});

	const auditVerdict = $derived.by(() => {
		if (!audit || audit.usedCount === 0) return null;
		const diff = audit.energyOverlap - audit.classicOverlap;
		if (diff > 0.05) return m.ana_adherence_verdict_energy();
		if (diff < -0.05) return m.ana_adherence_verdict_classic();
		return m.ana_adherence_verdict_tie();
	});

	const days = $derived(RANGES[range].days);
	const rangeStart = $derived(addDays(today, -(days - 1)));
	const inRange = $derived(all.filter((s) => s.date >= rangeStart));

	// ---------- Headline stats ----------
	const totalTasks = $derived(inRange.reduce((sum, s) => sum + s.totalTasks, 0));
	const completedTasks = $derived(inRange.reduce((sum, s) => sum + s.completedTasks, 0));
	const completedShare = $derived(
		totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
	);

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
		{ key: 'flow', label: m.quadrant_flow(), color: 'var(--color-flow)' },
		{ key: 'cruise', label: m.quadrant_cruise(), color: '#0ea5e9' },
		{ key: 'grind', label: m.quadrant_grind(), color: '#f97316' },
		{ key: 'routine', label: m.quadrant_routine(), color: '#71717a' }
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
			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local bucket, replaced wholesale
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

<div class="mb-text-xl flex flex-wrap items-center justify-between gap-grid-xs">
	<div>
		<h1 class="text-2xl font-bold text-ty-primary">{m.ana_heading()}</h1>
		<p class="mt-text-2xs text-sm text-ty-silent">
			{m.ana_subtitle()}
		</p>
	</div>

	<div class="inline-flex items-center rounded-lg border bg-surface-card p-0.5">
		{#each Object.entries(RANGES) as [key, r] (key)}
			<button
				onclick={() => (range = key as RangeKey)}
				class={segmentedToggleVariants({ active: range === key })}
			>
				{r.label()}
			</button>
		{/each}
	</div>
</div>

{#if isLoading}
	<p class="text-sm text-ty-silent">{m.ana_loading()}</p>
{:else if !hasData}
	<div class="rounded-xl border bg-surface-card p-box-2xl text-center backdrop-blur shadow-card">
		<p class="text-ty-secondary">{m.ana_empty()}</p>
		<p class="mt-text-2xs text-sm text-ty-silent">
			{m.ana_empty_hint_1()}
			<a href={resolve('/')} class="text-ty-secondary underline hover:text-ty-primary"
				>{m.link_today()}</a
			>
			{m.ana_empty_hint_2()}
		</p>
	</div>
{:else}
	<!-- KPI tiles -->
	<div class="grid gap-grid-xs sm:grid-cols-2 lg:grid-cols-3">
		<div class="rounded-xl border bg-surface-card p-box-md backdrop-blur shadow-card">
			<p class="text-xs text-ty-silent">{m.ana_tasks_completed()}</p>
			<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">
				{completedTasks} <span class="text-base font-normal text-ty-silent">/ {totalTasks}</span>
			</p>
			<p class="mt-text-3xs text-xs text-ty-silent">
				{m.ana_of_planned({ percent: completedShare })}
			</p>
		</div>

		<div class="rounded-xl border bg-surface-card p-box-md backdrop-blur shadow-card">
			<p class="text-xs text-ty-silent">{m.ana_avg_rate()}</p>
			<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">{avgRate}%</p>
			<p class="mt-text-3xs text-xs text-ty-silent">
				{#if rateDelta !== null}
					<span class={rateDelta >= 0 ? 'text-success' : 'text-danger'}>
						{rateDelta >= 0 ? '+' : ''}{rateDelta}%
					</span>
					{m.ana_vs_prev({ period: RANGES[range].prevLabel() })}
				{:else}
					{m.ana_rate_note()}
				{/if}
			</p>
		</div>

		<div class="rounded-xl border bg-surface-card p-box-md backdrop-blur shadow-card">
			<p class="text-xs text-ty-silent">{m.ana_active_days()}</p>
			<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">
				{inRange.length} <span class="text-base font-normal text-ty-silent">/ {days}</span>
			</p>
			<p class="mt-text-3xs text-xs text-ty-silent">
				{m.ana_with_completion({ count: activeDaysWithCompletion })}
			</p>
		</div>

		<div class="rounded-xl border bg-surface-card p-box-md backdrop-blur shadow-card">
			<p class="text-xs text-ty-silent">{m.ana_current_streak()}</p>
			<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">
				{streak}
				<span class="text-base font-normal text-ty-silent">
					{streak === 1 ? m.ana_day_one() : m.ana_day_other()}
				</span>
			</p>
			<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_streak_note()}</p>
		</div>

		<div class="rounded-xl border bg-surface-card p-box-md backdrop-blur shadow-card">
			<p class="text-xs text-ty-silent">{m.ana_planned_hours()}</p>
			<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">{plannedHours}h</p>
			<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_planned_hours_note()}</p>
		</div>

		<div class="rounded-xl border bg-surface-card p-box-md backdrop-blur shadow-card">
			<p class="text-xs text-ty-silent">{m.ana_best_day()}</p>
			{#if bestDay}
				<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">{formatDay(bestDay.date)}</p>
				<p class="mt-text-3xs text-xs text-ty-silent">
					{bestDay.completedTasks === 1
						? m.ana_best_day_note_one({ rate: bestDay.completionRate })
						: m.ana_best_day_note({
								rate: bestDay.completionRate,
								count: bestDay.completedTasks
							})}
				</p>
			{:else}
				<p class="mt-text-2xs text-2xl font-semibold text-ty-silent">—</p>
				<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_no_completed()}</p>
			{/if}
		</div>
	</div>

	<!-- Completion trend -->
	<div class="mt-grid-xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_completion_rate()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">
			{range === 'year' ? m.ana_chart_hint_year() : m.ana_chart_hint_day()}
		</p>

		<svg
			viewBox="0 0 {CHART.w} {CHART.h}"
			class="mt-text-md w-full"
			role="img"
			aria-label={m.ana_chart_aria({ range: RANGES[range].label().toLowerCase() })}
		>
			{#each yTicks as tick (tick)}
				<line
					x1={CHART.left}
					x2={CHART.w - CHART.right}
					y1={yPos(tick)}
					y2={yPos(tick)}
					stroke="var(--color-line-soft)"
					stroke-width="1"
				/>
				<text
					x={CHART.left - 8}
					y={yPos(tick) + 3}
					text-anchor="end"
					class="fill-ty-silent"
					font-size="10"
					style="font-variant-numeric: tabular-nums"
				>
					{tick}
				</text>
			{/each}

			{#each bars as bar, i (i)}
				{#if bar.value !== null}
					<path d={barPath(bar.x, bar.y, bar.w, bar.h)} fill="var(--color-brand)">
						<title>{bar.full} — {bar.value}% · {bar.sub}</title>
					</path>
				{/if}
				{#if bar.showLabel}
					<text
						x={bar.slotX + bar.slotW / 2}
						y={CHART.h - 8}
						text-anchor="middle"
						class="fill-ty-silent"
						font-size="10"
					>
						{bar.label}
					</text>
				{/if}
				<!-- full-slot hover target so tooltips don't require pixel-perfect aim -->
				<rect x={bar.slotX} y={CHART.top} width={bar.slotW} height={innerH} fill="transparent">
					<title
						>{bar.full} — {bar.value === null
							? m.ana_no_data()
							: `${bar.value}% · ${bar.sub}`}</title
					>
				</rect>
			{/each}
		</svg>
	</div>

	<!-- Day profiles -->
	<div class="mt-grid-xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_day_profiles()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">
			{m.ana_day_profiles_hint()}
		</p>

		<div class="mt-text-md flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
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

		<div class="mt-text-sm flex flex-wrap gap-x-grid-lg gap-y-grid-2xs">
			{#each QUADRANTS as q (q.key)}
				<div class="flex items-center gap-grid-2xs text-xs">
					<span class="h-2 w-2 rounded-full" style="background: {q.color}"></span>
					<span class="text-ty-secondary">{q.label}</span>
					<span class="font-medium text-ty-primary" style="font-variant-numeric: tabular-nums">
						{quadrantCounts[q.key]}
					</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Plan adherence (MATH.md §12) -->
	<div class="mt-grid-xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_adherence()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_adherence_hint()}</p>

		{#if audit === null}
			<p class="mt-text-md text-sm text-ty-silent">{m.ana_loading()}</p>
		{:else if audit.usedCount === 0}
			<p class="mt-text-md text-sm text-ty-secondary">{m.ana_adherence_empty()}</p>
		{:else}
			<div class="mt-text-md grid gap-grid-xs sm:grid-cols-3">
				<div>
					<p class="text-xs text-ty-silent">{m.ana_adherence_classic()}</p>
					<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">
						{Math.round(audit.classicOverlap * 100)}%
					</p>
				</div>
				<div>
					<p class="text-xs text-ty-silent">{m.ana_adherence_energy()}</p>
					<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">
						{Math.round(audit.energyOverlap * 100)}%
					</p>
				</div>
				<div>
					<p class="text-xs text-ty-silent">{m.ana_adherence_spread()}</p>
					<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">
						{audit.actualTaskSpread.toFixed(1)}
					</p>
					<p class="mt-text-3xs text-xs text-ty-silent">
						{m.ana_adherence_spread_note({
							actual: audit.actualTaskSpread.toFixed(1),
							classic: audit.classicTaskSpread.toFixed(1),
							energy: audit.energyTaskSpread.toFixed(1)
						})}
					</p>
				</div>
			</div>
			<p class="mt-text-sm text-xs text-ty-secondary">
				{auditVerdict} · {audit.usedCount === 1
					? m.ana_adherence_days_one()
					: m.ana_adherence_days_other({ count: audit.usedCount })}
			</p>
		{/if}
	</div>

	<!-- Your model (calibration visibility) -->
	<div class="mt-grid-xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_model()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_model_hint()}</p>

		{#if calibration === null}
			<p class="mt-text-md text-sm text-ty-silent">{m.ana_loading()}</p>
		{:else}
			<div class="mt-text-md grid gap-text-xs">
				{#each modelRows as row (row.label)}
					<div class="flex flex-wrap items-baseline justify-between gap-x-grid-xs">
						<span class="text-xs text-ty-silent">{row.label}</span>
						<span class="text-sm">
							<span class="font-medium text-ty-primary" style="font-variant-numeric: tabular-nums"
								>{row.value}</span
							>
							<span class="text-xs text-ty-silent"> · {row.note}</span>
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
