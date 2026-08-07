<script lang="ts">
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages.js';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import SegmentedToggle from '$lib/presentation/component/segmented-toggle.svelte';
	import StatTile from '$lib/presentation/component/stat-tile.svelte';
	import CompletionBarChart from '$lib/presentation/component/completion-bar-chart.svelte';
	import MetricTrendChart from '$lib/presentation/component/metric-trend-chart.svelte';
	import ParamTrend from '$lib/presentation/component/param-trend.svelte';
	import QuadrantDistribution from '$lib/presentation/component/quadrant-distribution.svelte';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import { showToast } from '$lib/presentation/utils/toast';
	import { formatDecimals } from '$lib/presentation/utils/number-format';
	import { calibrationRows } from '$lib/presentation/utils/calibration-descriptor';
	import { adherenceVerdict } from '$lib/presentation/utils/plan-audit-descriptor';
	import { completionChartPoints } from '$lib/presentation/utils/completion-chart-points';
	import { metricTrendSeries } from '$lib/presentation/utils/metric-trend-series';
	import { fromISO } from '$lib/business/utils/date';
	import {
		ANALYTICS_RANGES,
		setAnalyticsStore,
		type AnalyticsRange,
	} from '$lib/business/store/analytics-store.svelte';

	// Everything on this page comes off the store — the folds and the load live
	// there; this file is the range copy and the composition. Formatting policy
	// lives in `presentation/utils`, the drawing in the components.
	const analytics = setAnalyticsStore(() => showToast.danger(m.analytics_load_failed()));

	/** Every decimal the markup prints is a task spread, to one place. */
	const oneDecimal = (value: number) => formatDecimals(value, 1, getDateLocale());

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

	const rangeItems = $derived(
		(Object.keys(ANALYTICS_RANGES) as AnalyticsRange[]).map((key) => ({
			value: key,
			label: RANGE_LABELS[key].label(),
		})),
	);

	// Thin aliases for the values the markup reads more than once
	const calibration = $derived(analytics.calibration);
	const audit = $derived(analytics.audit);
	const rateDelta = $derived(analytics.completionRateDelta);
	const bestDay = $derived(analytics.bestDay);
	const quadrantCounts = $derived(analytics.quadrantCounts);
	// The bar's 100% is the days that HAVE a profile, not the days on record: a
	// day that books no hours has no profile (MATH.md §29) and `countQuadrants`
	// counts it nowhere, so `summaries.length` would leave the segments summing
	// to less than the bar and understate every share.
	const profiledDays = $derived(
		Object.values(quadrantCounts).reduce((sum, count) => sum + count, 0),
	);

	const modelRows = $derived(calibrationRows(calibration, getDateLocale()));
	const auditVerdict = $derived(adherenceVerdict(audit));

	function formatDay(iso: string): string {
		return fromISO(iso).toLocaleDateString(getDateLocale(), {
			month: 'short',
			day: 'numeric',
		});
	}

	// `null` while the calibrated energy params are still in flight — the card
	// says so rather than drawing a series fitted to the defaults (MATH.md §31).
	const trend = $derived(
		analytics.metricTrend === null
			? null
			: metricTrendSeries({
					trend: analytics.metricTrend,
					rangeStart: analytics.rangeStart,
					rangeDays: analytics.rangeDays,
					locale: getDateLocale(),
				}),
	);

	const chartPoints = $derived(
		completionChartPoints({
			range: analytics.range,
			summaries: analytics.summaries,
			monthlyRates: analytics.monthlyRates,
			rangeStart: analytics.rangeStart,
			rangeDays: analytics.rangeDays,
			today: analytics.today,
			locale: getDateLocale(),
		}),
	);
</script>

<SeoHead title={m.ana_title_head()} description={m.ana_meta_description()} />

<div class="mb-text-xl flex flex-wrap items-center justify-between gap-grid-xs">
	<div>
		<h1 class="text-2xl font-bold text-ty-primary">{m.ana_heading()}</h1>
		<p class="mt-text-2xs text-sm text-ty-silent">
			{m.ana_subtitle()}
		</p>
	</div>

	<SegmentedToggle
		items={rangeItems}
		value={analytics.range}
		onchange={(range) => (analytics.range = range)}
		label={m.ana_range_group()}
	/>
</div>

{#if analytics.isLoading}
	<!-- The frame the history will land in, at the sizes it will take. The
	     alternative is not a faster page but a less finished one: the readings
	     come from IndexedDB after mount, so anything rendered here is either a
	     placeholder or a claim — zeroed tiles say the range was empty, and the
	     empty-state card below says the user has never used the app. The text
	     stays for screen readers, which the bars tell nothing. -->
	<p class="sr-only">{m.ana_loading()}</p>
	<!-- Bar heights are the line-heights they stand in for: `text-xs` is h-4,
	     `text-sm` h-5, the tile's `text-2xl` reading h-8. -->
	<div class="grid gap-grid-xs sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
		{#each Array(6), i (i)}
			<div class="card-shell rounded-xl p-box-md">
				<div class="skeleton-block h-4 w-20"></div>
				<div class="skeleton-block mt-text-2xs h-8 w-24"></div>
				<div class="skeleton-block mt-text-3xs h-4 w-28"></div>
			</div>
		{/each}
	</div>
	<!-- Bodies, in the five cards' order. Both charts are a fixed viewBox at
	     `w-full`, so their height is a function of the container's width and the
	     ratio is the only thing that tracks it; the other three are the heights
	     their content measures. -->
	{#each ['aspect-[800/240]', 'aspect-[800/180]', 'h-10', 'h-5', 'h-33'] as body, i (i)}
		<div class="card-shell mt-grid-xl rounded-xl p-box-lg" aria-hidden="true">
			<div class="skeleton-block h-5 w-40"></div>
			<div class="skeleton-block mt-text-3xs h-4 w-64 max-w-full"></div>
			<div class="skeleton-block mt-text-md w-full {body}"></div>
		</div>
	{/each}
{:else if !analytics.hasData}
	<div class="card-shell rounded-xl p-box-2xl text-center">
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
		<StatTile
			label={m.ana_tasks_completed()}
			value={analytics.completedTasks}
			suffix="/ {analytics.totalTasks}"
		>
			{#snippet note()}
				{m.ana_of_planned({
					percent: analytics.completedShare,
				})}
			{/snippet}
		</StatTile>

		<StatTile label={m.ana_avg_rate()} value="{analytics.averageCompletionRate}%">
			{#snippet note()}
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
			{/snippet}
		</StatTile>

		<StatTile
			label={m.ana_active_days()}
			value={analytics.summaries.length}
			suffix="/ {analytics.rangeDays}"
		>
			{#snippet note()}
				{m.ana_with_completion({
					count: analytics.activeDaysWithCompletion,
				})}
			{/snippet}
		</StatTile>

		<StatTile
			label={m.ana_current_streak()}
			value={analytics.streak}
			suffix={analytics.streak === 1 ? m.ana_day_one() : m.ana_day_other()}
		>
			{#snippet note()}{m.ana_streak_note()}{/snippet}
		</StatTile>

		<StatTile
			label={m.ana_planned_hours()}
			value={analytics.plannedHours.toLocaleString(getDateLocale())}
			suffix={m.unit_hours()}
		>
			{#snippet note()}{m.ana_planned_hours_note()}{/snippet}
		</StatTile>

		<StatTile
			label={m.ana_best_day()}
			value={bestDay ? formatDay(bestDay.date) : '—'}
			muted={bestDay === null}
		>
			{#snippet note()}
				{#if bestDay === null}
					{m.ana_no_completed()}
				{:else if bestDay.completedTasks === 1}
					{m.ana_best_day_note_one({
						rate: bestDay.completionRate,
					})}
				{:else}
					{m.ana_best_day_note({
						rate: bestDay.completionRate,
						count: bestDay.completedTasks,
					})}
				{/if}
			{/snippet}
		</StatTile>
	</div>

	<!-- Completion trend -->
	<div class="card-shell mt-grid-xl rounded-xl p-box-lg">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_completion_rate()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">
			{analytics.range === 'year' ? m.ana_chart_hint_year() : m.ana_chart_hint_day()}
		</p>

		<CompletionBarChart
			points={chartPoints}
			ariaLabel={m.ana_chart_aria({
				range: RANGE_LABELS[analytics.range].label().toLowerCase(),
			})}
		/>
	</div>

	<!-- Load and burnout over the range (MATH.md §31) -->
	<div class="card-shell mt-grid-xl rounded-xl p-box-lg">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_load_trend()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_load_trend_hint()}</p>

		{#if analytics.hasModelReportFailed}
			<p class="mt-text-md text-sm text-danger-strong">{m.error_title()}</p>
		{:else if trend === null}
			<p class="mt-text-md text-sm text-ty-silent">{m.ana_loading()}</p>
		{:else}
			<MetricTrendChart
				labels={trend.labels}
				series={trend.series}
				ariaLabel={m.ana_load_trend_aria({
					range: RANGE_LABELS[analytics.range].label().toLowerCase(),
				})}
			/>
		{/if}
	</div>

	<!-- Day profiles -->
	<div class="card-shell mt-grid-xl rounded-xl p-box-lg">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_day_profiles()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">
			{m.ana_day_profiles_hint()}
		</p>

		<QuadrantDistribution counts={quadrantCounts} total={profiledDays} />
	</div>

	<!-- Plan adherence (MATH.md §12) -->
	<div class="card-shell mt-grid-xl rounded-xl p-box-lg">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_adherence()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_adherence_hint()}</p>

		{#if analytics.hasModelReportFailed}
			<p class="mt-text-md text-sm text-danger-strong">{m.error_title()}</p>
		{:else if audit === null}
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
						{oneDecimal(audit.actualTaskSpread)}
					</p>
					<p class="mt-text-3xs text-xs text-ty-silent">
						{m.ana_adherence_spread_note({
							actual: oneDecimal(audit.actualTaskSpread),
							classic: oneDecimal(audit.classicTaskSpread),
							energy: oneDecimal(audit.energyTaskSpread),
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
	<div class="card-shell mt-grid-xl rounded-xl p-box-lg">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_model()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_model_hint()}</p>

		{#if analytics.hasModelReportFailed}
			<p class="mt-text-md text-sm text-danger-strong">{m.error_title()}</p>
		{:else if calibration === null}
			<p class="mt-text-md text-sm text-ty-silent">{m.ana_loading()}</p>
		{:else}
			<div class="mt-text-md grid gap-text-xs">
				{#each modelRows as row (row.label)}
					<div class="flex flex-wrap items-baseline justify-between gap-x-grid-xs">
						<span class="text-xs text-ty-silent">{row.label}</span>
						<span class="flex items-baseline gap-grid-2xs text-sm">
							{#if row.trend}
								<ParamTrend
									values={row.trend.values}
									defaultValue={row.trend.defaultValue}
									ariaLabel={row.trend.ariaLabel}
								/>
							{/if}
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
