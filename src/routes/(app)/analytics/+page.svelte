<script lang="ts">
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages.js';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import { segmentedToggleVariants } from '$lib/presentation/component/segmented-toggle-variants';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import type { DailyQuadrant } from '$lib/business/model/metric/calculation';
	import { addDays, fromISO } from '$lib/business/utils/date';
	import {
		ANALYTICS_RANGES,
		AnalyticsStore,
		type AnalyticsRange,
	} from '$lib/business/store/analytics-store.svelte';

	// Everything on this page comes off the store — the folds and the load live
	// there; this file is labels, colors, locale formatting and SVG geometry.
	const analytics = new AnalyticsStore();

	// Decimals follow the active locale, like every date on this page does —
	// otherwise a German reader gets "1.5" between two German dates.
	function formatDecimals(value: number, digits: number): string {
		return value.toLocaleString(getDateLocale(), {
			minimumFractionDigits: digits,
			maximumFractionDigits: digits,
		});
	}

	// Copy for the range toggle; the day counts themselves are the store's.
	const RANGE_LABELS: Record<AnalyticsRange, { label: () => string; prevLabel: () => string }> = {
		week: {
			label: () => m.ana_range_week(),
			prevLabel: () => m.ana_prev_week(),
		},
		month: {
			label: () => m.ana_range_month(),
			prevLabel: () => m.ana_prev_month(),
		},
		year: {
			label: () => m.ana_range_year(),
			prevLabel: () => '',
		},
	};

	// Thin aliases for the values the markup reads more than once
	const calibration = $derived(analytics.calibration);
	const audit = $derived(analytics.audit);
	const rateDelta = $derived(analytics.completionRateDelta);
	const bestDay = $derived(analytics.bestDay);
	const quadrantCounts = $derived(analytics.quadrantCounts);

	// "Your model" rows: fitted value (± std) next to its default and log count.
	// ≈/±/units match the Energy Lab's fit lines; counts are the fits' OWN
	// usedCounts (informative observations, not raw log rows).
	const modelRows = $derived.by(() => {
		if (!calibration) return [];

		const f2 = (x: number) => formatDecimals(x, 2);
		const minutes = (h: number) => `${Math.round(h * 60)} ${m.unit_minutes()}`;

		const rate = (
			fit: { fitted: boolean },
			value: number,
			std: number | undefined,
			unit: string,
		) => (fit.fitted ? `≈ ${f2(value)} ± ${f2(std ?? 0)} ${unit}` : `${f2(value)} ${unit}`);

		const { flow, energy, stopping, defaults } = calibration;

		return [
			{
				label: m.ana_model_flow(),
				value: flow.fitted ? `≈ ${minutes(flow.phiHours)}` : minutes(flow.phiHours),
				note: m.ana_model_note_flow({
					value: minutes(flow.defaultPhiHours),
					count: flow.usedCount,
				}),
			},
			{
				label: m.ana_model_recovery(),
				value: rate(
					energy.recovery,
					energy.recovery.rate,
					energy.recovery.rateStd,
					m.unit_per_hour(),
				),
				note: m.ana_model_note_ratings({
					value: f2(defaults.recoveryRate),
					count: energy.recovery.usedCount,
				}),
			},
			{
				label: m.ana_model_drain_cog(),
				value: rate(
					energy.cognitiveDrain,
					energy.cognitiveDrain.alpha,
					energy.cognitiveDrain.alphaStd,
					m.unit_per_hour(),
				),
				note: m.ana_model_note_ratings({
					value: f2(defaults.alphaCog),
					count: energy.cognitiveDrain.usedCount,
				}),
			},
			{
				label: m.ana_model_drain_phys(),
				value: rate(
					energy.physicalDrain,
					energy.physicalDrain.alpha,
					energy.physicalDrain.alphaStd,
					m.unit_per_hour(),
				),
				note: m.ana_model_note_ratings({
					value: f2(defaults.alphaPhys),
					count: energy.physicalDrain.usedCount,
				}),
			},
			{
				label: m.ana_model_stop(),
				value: rate(stopping, stopping.value, stopping.valueStd, m.unit_output_per_hour()),
				note: m.ana_model_note_days({
					value: f2(defaults.freeTimeValue),
					count: stopping.usedCount,
				}),
			},
		];
	});

	const auditVerdict = $derived.by(() => {
		if (!audit || audit.usedCount === 0) return null;

		const diff = audit.energyOverlap - audit.classicOverlap;

		if (diff > 0.05) return m.ana_adherence_verdict_energy();

		if (diff < -0.05) return m.ana_adherence_verdict_classic();

		return m.ana_adherence_verdict_tie();
	});

	function formatDay(iso: string): string {
		return fromISO(iso).toLocaleDateString(getDateLocale(), {
			month: 'short',
			day: 'numeric',
		});
	}

	// ---------- Day profile distribution ----------
	// Every colour is a token: these reference the plain `:root` custom properties
	// (base.css), which resolve regardless of Tailwind's @theme tree-shaking.
	const QUADRANTS: { key: DailyQuadrant; label: string; color: string }[] = [
		{
			key: 'flow',
			label: m.quadrant_flow(),
			color: 'var(--flow)',
		},
		{
			key: 'cruise',
			label: m.quadrant_cruise(),
			color: 'var(--info)',
		},
		{
			key: 'grind',
			label: m.quadrant_grind(),
			color: 'var(--warning)',
		},
		{
			key: 'routine',
			label: m.quadrant_routine(),
			color: 'var(--series-rest)',
		},
	];

	// ---------- Chart: completion rate per day (per month for the year view) ----------
	type ChartPoint = {
		label: string; // short x-axis label
		full: string; // tooltip label
		value: number | null; // null = no data for this slot
		sub: string;
		showLabel: boolean;
	};

	const chartPoints = $derived.by((): ChartPoint[] => {
		if (analytics.range === 'year') {
			return analytics.monthlyRates.map((month) => {
				const first = fromISO(`${month.month}-01`);

				return {
					label: first.toLocaleDateString(getDateLocale(), {
						month: 'short',
					}),
					full: first.toLocaleDateString(getDateLocale(), {
						month: 'long',
						year: 'numeric',
					}),
					value: month.average,
					sub:
						month.dayCount === 0
							? m.ana_no_data()
							: month.dayCount === 1
								? m.ana_active_day_one()
								: m.ana_active_day_other({
										count: month.dayCount,
									}),
					showLabel: true,
				};
			});
		}

		const byDate = new Map(analytics.summaries.map((s) => [s.date, s]));

		return Array.from(
			{
				length: analytics.rangeDays,
			},
			(_, i) => {
				const date = addDays(analytics.rangeStart, i);
				const s = byDate.get(date);
				const d = fromISO(date);

				return {
					label:
						analytics.range === 'week'
							? d.toLocaleDateString(getDateLocale(), {
									weekday: 'short',
								})
							: d.toLocaleDateString(getDateLocale(), {
									month: 'short',
									day: 'numeric',
								}),
					full: d.toLocaleDateString(getDateLocale(), {
						weekday: 'short',
						month: 'short',
						day: 'numeric',
					}),
					value: s ? s.completionRate : null,
					sub: s
						? m.ana_tasks_done_sub({
								completed: s.completedTasks,
								total: s.totalTasks,
							})
						: m.ana_no_data(),
					showLabel: analytics.range === 'week' || i % 5 === 0,
					...(date === analytics.today
						? {
								full: m.ana_today_label({
									date: d.toLocaleDateString(getDateLocale(), {
										month: 'short',
										day: 'numeric',
									}),
								}),
							}
						: {}),
				};
			},
		);
	});

	// SVG geometry (fixed viewBox, responsive via width: 100%)
	const CHART = {
		w: 800,
		h: 240,
		top: 12,
		right: 8,
		bottom: 26,
		left: 34,
	};
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

			return {
				...p,
				slotX,
				slotW: slot,
				x,
				w: barW,
				y: CHART.top + innerH - h,
				h,
			};
		});
	});

	function barPath(x: number, y: number, w: number, h: number): string {
		// Rounded at the data end, square at the baseline
		const r = Math.min(4, h, w / 2);
		const bottom = y + h;

		return `M${x},${bottom} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${bottom} Z`;
	}
</script>

<SeoHead title={m.ana_title_head()} description={m.ana_meta_description()} />

<div class="mb-text-xl flex flex-wrap items-center justify-between gap-grid-xs">
	<div>
		<h1 class="text-2xl font-bold text-ty-primary">{m.ana_heading()}</h1>
		<p class="mt-text-2xs text-sm text-ty-silent">
			{m.ana_subtitle()}
		</p>
	</div>

	<div class="inline-flex items-center rounded-lg border bg-surface-card p-text-3xs backdrop-blur">
		{#each Object.keys(ANALYTICS_RANGES) as AnalyticsRange[] as key (key)}
			<button
				onclick={() => (analytics.range = key)}
				aria-pressed={analytics.range === key}
				class={segmentedToggleVariants({
					active: analytics.range === key,
				})}
			>
				{RANGE_LABELS[key].label()}
			</button>
		{/each}
	</div>
</div>

{#if analytics.isLoading}
	<p class="text-sm text-ty-silent">{m.ana_loading()}</p>
{:else if !analytics.hasData}
	<div class="rounded-xl border bg-surface-card p-box-2xl text-center backdrop-blur shadow-card">
		<p class="text-ty-secondary">{m.ana_empty()}</p>
		<p class="mt-text-2xs text-sm text-ty-silent">
			{m.ana_empty_hint_1()}
			<a
				href={localizeHref(resolve('/'))}
				class="text-ty-secondary underline decoration-ty-ghost underline-offset-4 hover:text-ty-primary"
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
				{analytics.completedTasks}
				<span class="text-base font-normal text-ty-silent">/ {analytics.totalTasks}</span>
			</p>
			<p class="mt-text-3xs text-xs text-ty-silent">
				{m.ana_of_planned({
					percent: analytics.completedShare,
				})}
			</p>
		</div>

		<div class="rounded-xl border bg-surface-card p-box-md backdrop-blur shadow-card">
			<p class="text-xs text-ty-silent">{m.ana_avg_rate()}</p>
			<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">
				{analytics.averageCompletionRate}%
			</p>
			<p class="mt-text-3xs text-xs text-ty-silent">
				{#if rateDelta !== null}
					<span class={rateDelta >= 0 ? 'text-success' : 'text-danger'}>
						{rateDelta >= 0 ? '+' : ''}{rateDelta}%
					</span>
					{m.ana_vs_prev({
						period: RANGE_LABELS[analytics.range].prevLabel(),
					})}
				{:else}
					{m.ana_rate_note()}
				{/if}
			</p>
		</div>

		<div class="rounded-xl border bg-surface-card p-box-md backdrop-blur shadow-card">
			<p class="text-xs text-ty-silent">{m.ana_active_days()}</p>
			<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">
				{analytics.summaries.length}
				<span class="text-base font-normal text-ty-silent">/ {analytics.rangeDays}</span>
			</p>
			<p class="mt-text-3xs text-xs text-ty-silent">
				{m.ana_with_completion({
					count: analytics.activeDaysWithCompletion,
				})}
			</p>
		</div>

		<div class="rounded-xl border bg-surface-card p-box-md backdrop-blur shadow-card">
			<p class="text-xs text-ty-silent">{m.ana_current_streak()}</p>
			<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">
				{analytics.streak}
				<span class="text-base font-normal text-ty-silent">
					{analytics.streak === 1 ? m.ana_day_one() : m.ana_day_other()}
				</span>
			</p>
			<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_streak_note()}</p>
		</div>

		<div class="rounded-xl border bg-surface-card p-box-md backdrop-blur shadow-card">
			<p class="text-xs text-ty-silent">{m.ana_planned_hours()}</p>
			<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">
				{analytics.plannedHours.toLocaleString(getDateLocale())}
				<span class="text-base font-normal text-ty-silent">{m.unit_hours()}</span>
			</p>
			<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_planned_hours_note()}</p>
		</div>

		<div class="rounded-xl border bg-surface-card p-box-md backdrop-blur shadow-card">
			<p class="text-xs text-ty-silent">{m.ana_best_day()}</p>
			{#if bestDay}
				<p class="mt-text-2xs text-2xl font-semibold text-ty-primary">{formatDay(bestDay.date)}</p>
				<p class="mt-text-3xs text-xs text-ty-silent">
					{bestDay.completedTasks === 1
						? m.ana_best_day_note_one({
								rate: bestDay.completionRate,
							})
						: m.ana_best_day_note({
								rate: bestDay.completionRate,
								count: bestDay.completedTasks,
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
			{analytics.range === 'year' ? m.ana_chart_hint_year() : m.ana_chart_hint_day()}
		</p>

		<svg
			viewBox="0 0 {CHART.w} {CHART.h}"
			class="mt-text-md w-full"
			role="img"
			aria-label={m.ana_chart_aria({
				range: RANGE_LABELS[analytics.range].label().toLowerCase(),
			})}
		>
			{#each yTicks as tick (tick)}
				<line
					x1={CHART.left}
					x2={CHART.w - CHART.right}
					y1={yPos(tick)}
					y2={yPos(tick)}
					stroke="var(--line-soft)"
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
					<path d={barPath(bar.x, bar.y, bar.w, bar.h)} fill="var(--brand)">
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

		<div class="mt-text-md flex h-3 w-full gap-text-3xs overflow-hidden rounded-full">
			{#each QUADRANTS as q (q.key)}
				{#if quadrantCounts[q.key] > 0}
					<div
						style="width: {(quadrantCounts[q.key] / analytics.summaries.length) *
							100}%; background: {q.color}"
						title={quadrantCounts[q.key] === 1
							? m.ana_quadrant_count_one({
									label: q.label,
								})
							: m.ana_quadrant_count_other({
									label: q.label,
									count: quadrantCounts[q.key],
								})}
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
						{formatDecimals(audit.actualTaskSpread, 1)}
					</p>
					<p class="mt-text-3xs text-xs text-ty-silent">
						{m.ana_adherence_spread_note({
							actual: formatDecimals(audit.actualTaskSpread, 1),
							classic: formatDecimals(audit.classicTaskSpread, 1),
							energy: formatDecimals(audit.energyTaskSpread, 1),
						})}
					</p>
				</div>
			</div>
			<p class="mt-text-sm text-xs text-ty-secondary">
				{auditVerdict} · {audit.usedCount === 1
					? m.ana_adherence_days_one()
					: m.ana_adherence_days_other({
							count: audit.usedCount,
						})}
			</p>
		{/if}
	</div>

	<!-- Your model (calibration visibility) -->
	<div class="mt-grid-xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_model()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_model_hint()}</p>

		{#if analytics.calibrationFailed}
			<p class="mt-text-md text-sm text-danger-strong">{m.error_title()}</p>
		{:else if calibration === null}
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
