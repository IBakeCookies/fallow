<script lang="ts">
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages.js';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import SegmentedToggle from '$lib/presentation/component/segmented-toggle.svelte';
	import StatTile from '$lib/presentation/component/stat-tile.svelte';
	import CompletionYieldChart from '$lib/presentation/component/completion-yield-chart.svelte';
	import MetricTrendChart from '$lib/presentation/component/metric-trend-chart.svelte';
	import PlanAdherenceSummary from '$lib/presentation/component/plan-adherence-summary.svelte';
	import ModelParameterTable from '$lib/presentation/component/model-parameter-table.svelte';
	import QuadrantDistribution from '$lib/presentation/component/quadrant-distribution.svelte';
	import LogHistoryList from '$lib/presentation/component/log-history-list.svelte';
	import TagHoursCard from '$lib/presentation/component/tag-hours-card.svelte';
	import FlowCalibrationCard from '$lib/presentation/component/flow-calibration-card.svelte';
	import DrainCalibrationCard from '$lib/presentation/component/drain-calibration-card.svelte';
	import FitLogSummary from '$lib/presentation/component/fit-log-summary.svelte';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import { showToast } from '$lib/presentation/utils/toast';
	import { calibrationRows } from '$lib/presentation/utils/calibration-descriptor';
	import { completionChartPoints } from '$lib/presentation/utils/completion-chart-points';
	import { metricTrendSeries } from '$lib/presentation/utils/metric-trend-series';
	import { buildMetricTrack } from '$lib/presentation/utils/metric-descriptor';
	import { logHistory, type LogKind } from '$lib/presentation/utils/log-history';
	import { removeLogWithUndo } from '$lib/presentation/utils/remove-log-with-undo';
	import { fromISO } from '$lib/business/utils/date';
	import {
		ANALYTICS_RANGES,
		setAnalyticsStore,
		type AnalyticsRange,
	} from '$lib/business/store/analytics-store.svelte';
	import { getSessionStore } from '$lib/business/store/session-store.svelte';
	import { getEnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';

	const analytics = setAnalyticsStore(() => showToast.danger(m.analytics_load_failed()));

	const session = getSessionStore();
	const observations = getEnergyObservationStore();

	// Derived here rather than read off a store: this page builds no `EnergyLabStore`,
	// which is where the rest count of the same shape lives.
	const pendingDrainLogs = $derived(
		observations.drainObservations.filter((o) => o.date >= session.today).length,
	);

	// The two fit cards read these two stores and not the range, so they wait on their
	// own pair rather than on `areLogsLoading`.
	const areFitsLoading = $derived(session.isLoading || observations.isLoading);

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

	const calibration = $derived(analytics.calibration);
	// Either α off its default is a personalized model.
	// Null until the snapshot lands: the count's store answers before it does.
	const drainRatesFitted = $derived(
		calibration
			? calibration.energy.cognitiveDrain.fitted || calibration.energy.physicalDrain.fitted
			: null,
	);
	const audit = $derived(analytics.audit);
	const rateDelta = $derived(analytics.completionRateDelta);
	const bestDay = $derived(analytics.bestDay);
	const quadrantCounts = $derived(analytics.quadrantCounts);
	const loggedHours = $derived(analytics.loggedHours);
	const restStats = $derived(analytics.restSummary);
	// What the Logged hours tile says instead of a reading, on the two states the
	// model report leaves it without one. The cards below say it in their own
	// markup; a tile has one note line, so it says it there.
	const missingReading = $derived(
		analytics.hasModelReportFailed ? m.error_title() : m.ana_loading(),
	);

	const modelRows = $derived(calibrationRows(calibration, getDateLocale()));

	const drainRanking = $derived(analytics.drainRanking);
	const drainRankRows = $derived(
		drainRanking === null
			? []
			: [
					{
						label: m.ana_drain_rank_mind(),
						pair: drainRanking.cognitive,
					},
					{
						label: m.ana_drain_rank_body(),
						pair: drainRanking.physical,
					},
				],
	);

	function formatDay(iso: string): string {
		return fromISO(iso).toLocaleDateString(getDateLocale(), {
			month: 'short',
			day: 'numeric',
		});
	}

	// The three reference readings under the headline four: label, value and
	// suffix, no note line — a note is what makes a reading read as headline. The
	// other two became the streak's and the logged hours' denominators.
	const referenceReadings = $derived([
		{
			label: m.ana_active_days(),
			value: analytics.summaries.length,
			suffix: `/ ${analytics.rangeDays}`,
		},
		{
			label: m.ana_rest_hours(),
			value: restStats === null ? '—' : restStats.hours.toLocaleString(getDateLocale()),
			suffix: restStats === null ? '' : m.unit_hours(),
		},
		{
			label: m.ana_best_day(),
			value: bestDay ? formatDay(bestDay.date) : '—',
			suffix: '',
		},
	]);

	// `null` while the calibrated energy params are still in flight — the card
	// says so rather than drawing a series fitted to the defaults.
	const trend = $derived(
		analytics.metricTrend === null
			? null
			: metricTrendSeries({
					range: analytics.range,
					trend: analytics.metricTrend,
					weeklyTrend: analytics.weeklyMetricTrend,
					rangeStart: analytics.rangeStart,
					rangeDays: analytics.rangeDays,
					locale: getDateLocale(),
				}),
	);

	// `rangeStart` alone bounds it: both stores refuse a measurement on a day ahead of
	// today, so none is ever dated ahead.
	let allTime = $state(false);

	// Named by what each task is CALLED now, not by the title copied onto the record
	// when it was logged.
	const logRows = $derived(
		logHistory({
			flow: session.flowObservations,
			drain: observations.drainObservations,
			rest: observations.restObservations,
			rangeStart: allTime ? undefined : analytics.rangeStart,
			taskTitles: analytics.taskTitles,
		}),
	);

	// `analytics.isLoading` too: the layout's stores are loaded on arrival while this page
	// re-reads its year, so a list published first prints the names `taskTitles` replaces.
	const areLogsLoading = $derived(
		session.isLoading || observations.isLoading || analytics.isLoading,
	);

	function deleteLog(kind: LogKind, id: number) {
		removeLogWithUndo(session, observations, kind, id);

		editingKey = null;
	}

	// Which row's ✎ is open, by the fold's own key — the PAGE's, because the three saves
	// land in two stores. One at a time: a row's form reads its seed at mount. The list
	// hands the key back rather than the kind and id, so the format stays `logHistory`'s.
	let editingKey = $state<string | null>(null);
	const closeEditor = () => (editingKey = null);

	const formatResetLabel = (kind: string, count: number) =>
		count === 1
			? m.ana_logs_reset_count_one({
					kind,
				})
			: m.ana_logs_reset_count_other({
					kind,
					count,
				});

	function saveFlowLog(id: number, minutes: number) {
		session.editFlowLog(id, minutes);
		closeEditor();
	}

	function saveDrainLog(id: number, entry: { hours: number; mind: number; body: number }) {
		observations.editDrainLog(id, entry.hours, entry.mind, entry.body);
		closeEditor();
	}

	// Both stores hold the tag: the write is the session store's, and the loaded
	// year is refreshed only once it lands.
	async function renameTag(from: string, to: string) {
		if (await session.renameTag(from, to)) analytics.renameTag(from, to);
	}

	async function deleteTag(tag: string) {
		if (await session.deleteTag(tag)) analytics.deleteTag(tag);
	}

	function saveRestLog(
		id: number,
		entry: {
			hours: number;
			mindBefore: number;
			mindAfter: number;
			bodyBefore: number;
			bodyAfter: number;
		},
	) {
		observations.editRestLog(id, entry);
		closeEditor();
	}

	const chartPoints = $derived(
		completionChartPoints({
			range: analytics.range,
			summaries: analytics.summaries,
			weeklyRollups: analytics.weeklyRollups,
			rangeStart: analytics.rangeStart,
			rangeDays: analytics.rangeDays,
			today: analytics.today,
			locale: getDateLocale(),
		}),
	);
</script>

<SeoHead title={m.ana_title_head()} description={m.ana_meta_description()} />

{#snippet reportFailed()}
	<p class="mt-text-md text-sm text-danger-strong">{m.error_title()}</p>
{/snippet}

{#snippet pending()}
	<p class="mt-text-md text-sm text-ty-silent">{m.ana_loading()}</p>
{/snippet}

{#snippet skeletonBody(body: string)}
	<div class="skeleton-block h-5 w-40"></div>
	<div class="skeleton-block mt-text-3xs h-4 w-64 max-w-full"></div>
	<div class="skeleton-block mt-text-md w-full {body}"></div>
{/snippet}

<!-- The nav's active link already draws the page's name, so this one is for the
     document: the cards below open at `<h2>` and an indexed page needs an `<h1>`
     above them. The subtitle stays printed — it says what the readings are, which
     a one-word nav item does not. -->
<h1 class="sr-only">{m.ana_heading()}</h1>

<div class="mb-text-xl flex flex-wrap items-center justify-between gap-grid-xs">
	<p class="text-sm text-ty-silent">{m.ana_subtitle()}</p>

	<SegmentedToggle
		items={rangeItems}
		value={analytics.range}
		onchange={(range) => {
			analytics.range = range;
			// Narrowing the range can take the open row out of the list, and `editingKey`
			// would outlive it — switching back would re-open it.
			closeEditor();
		}}
		label={m.ana_range_group()}
	/>
</div>

{#if analytics.isLoading}
	<!-- A placeholder, never a claim: zeroed tiles would say the range was empty, and the
	     empty state below that the app was never used. The bars tell a screen reader nothing. -->
	<p class="sr-only">{m.ana_loading()}</p>
	<!-- Bar heights are the line-heights they stand in for: `text-xs` is h-4,
	     `text-sm` h-5, the tile's `text-2xl` reading h-8. -->
	<div class="card-shell rounded-xl p-box-lg" aria-hidden="true">
		<div class="grid gap-grid-sm sm:grid-cols-2 lg:grid-cols-4">
			{#each Array(4), i (i)}
				<div>
					<div class="skeleton-block h-4 w-20"></div>
					<div class="skeleton-block mt-text-2xs h-8 w-24"></div>
					<div class="skeleton-block mt-text-3xs h-4 w-28"></div>
					<div class="skeleton-block mt-text-2xs h-1 w-full"></div>
				</div>
			{/each}
		</div>
		<!-- The three reference readings, on the rule they sit under when they land. -->
		<div class="mt-grid-lg columns-1 gap-grid-lg border-t border-line-soft pt-grid-sm sm:columns-3">
			{#each Array(3), i (i)}
				<div class="border-b border-line-soft py-text-2xs">
					<div class="skeleton-block h-4 w-full"></div>
				</div>
			{/each}
		</div>
	</div>
	<!-- Bodies, in the order of the six full-width GATED cards that always render — the
	     calibration grid and the logs card sit outside this gate and the drain ranking may
	     not render at all. Both charts are a fixed viewBox at `w-full`, so a ratio is what
	     tracks their height. -->
	{#each ['h-16', 'aspect-[800/180]', 'aspect-[800/180]', 'h-10', 'h-5', 'h-[201px]'] as body, i (i)}
		<div class="card-shell mt-grid-xl rounded-xl p-box-lg" aria-hidden="true">
			{@render skeletonBody(body)}
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
	<!-- One card holding every reading, as on `/`: four answer a question the range
	     asks — volume, trend, consistency, load — and the other three sit under the
	     rule. A card each said the four were four independent facts. -->
	<div class="card-shell rounded-xl p-box-lg">
		<div class="grid gap-grid-sm sm:grid-cols-2 lg:grid-cols-4">
			<StatTile
				label={m.ana_tasks_completed()}
				value={analytics.completedTasks}
				suffix="/ {analytics.totalTasks}"
				track={buildMetricTrack(analytics.completedTasks, analytics.totalTasks)}
			>
				{#snippet note()}
					{m.ana_of_planned({
						percent: analytics.completedShare,
					})}
				{/snippet}
			</StatTile>

			<StatTile
				label={m.ana_avg_rate()}
				value="{analytics.averageCompletionRate}%"
				track={buildMetricTrack(analytics.averageCompletionRate, 100)}
			>
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
				label={m.ana_current_streak()}
				value={analytics.streak}
				suffix={analytics.streak === 1 ? m.ana_day_one() : m.ana_day_other()}
				track={buildMetricTrack(analytics.streak, analytics.longestStreak)}
			>
				{#snippet note()}{analytics.longestStreak === 1
						? m.ana_streak_longest_one({
								days: analytics.longestStreak,
							})
						: m.ana_streak_longest_other({
								days: analytics.longestStreak,
							})}{/snippet}
			</StatTile>

			<StatTile
				label={m.ana_logged_hours()}
				value={loggedHours === null ? '—' : loggedHours.toLocaleString(getDateLocale())}
				suffix={loggedHours === null ? undefined : m.unit_hours()}
				muted={loggedHours === null}
				track={loggedHours === null
					? undefined
					: buildMetricTrack(loggedHours, analytics.plannedHours)}
			>
				{#snippet note()}
					{#if loggedHours === null}
						{missingReading}
					{:else}
						{m.ana_logged_hours_note({
							hours: analytics.plannedHours.toLocaleString(getDateLocale()),
						})}
					{/if}
				{/snippet}
			</StatTile>
		</div>

		<!-- Always open, under the rule the disclosure used to sit on: three lines cost
		     more to hide than to show. No colour either — none of these is judged. -->
		<div class="mt-grid-lg columns-1 gap-grid-lg border-t border-line-soft pt-grid-sm sm:columns-3">
			{#each referenceReadings as reading (reading.label)}
				<div
					class="flex break-inside-avoid items-baseline justify-between gap-text-xs border-b border-line-soft py-text-2xs"
				>
					<span class="text-xs text-ty-silent">{reading.label}</span>
					<span class="text-right text-sm font-semibold tabular-nums text-ty-primary">
						{reading.value}
						{#if reading.suffix}<span class="font-normal text-ty-silent">{reading.suffix}</span
							>{/if}
					</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="card-shell mt-grid-xl rounded-xl p-box-lg">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_completion_rate()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">
			{analytics.range === 'year' ? m.ana_chart_hint_year() : m.ana_chart_hint_day()}
		</p>

		<CompletionYieldChart
			points={chartPoints}
			ariaLabel={m.ana_chart_aria({
				range: RANGE_LABELS[analytics.range].label().toLowerCase(),
			})}
		/>
	</div>

	<!-- Load and burnout over the range -->
	<div class="card-shell mt-grid-xl rounded-xl p-box-lg">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_load_trend()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">
			{analytics.range === 'year' ? m.ana_load_trend_hint_year() : m.ana_load_trend_hint()}
		</p>

		{#if analytics.hasModelReportFailed}
			{@render reportFailed()}
		{:else if trend === null}
			{@render pending()}
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

	<div class="card-shell mt-grid-xl rounded-xl p-box-lg">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_day_profiles()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">
			{m.ana_day_profiles_hint()}
		</p>

		<QuadrantDistribution counts={quadrantCounts} />
	</div>

	<!-- Plan adherence and the tag breakdown, a half each: both are short lists of
	     labelled bars, so full width left either one mostly empty. -->
	<div class="mt-grid-xl grid gap-grid-lg lg:grid-cols-2">
		<div class="card-shell rounded-xl p-box-lg">
			<h2 class="text-sm font-medium text-ty-primary">{m.ana_adherence()}</h2>
			<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_adherence_hint()}</p>

			{#if analytics.hasModelReportFailed}
				{@render reportFailed()}
			{:else if audit === null}
				{@render pending()}
			{:else if audit.usedCount === 0}
				<p class="mt-text-md text-sm text-ty-secondary">{m.ana_adherence_empty()}</p>
			{:else}
				<PlanAdherenceSummary {audit} locale={getDateLocale()} class="mt-text-md" />
			{/if}
		</div>

		<TagHoursCard
			breakdown={analytics.tagHours}
			hasFailed={analytics.hasModelReportFailed}
			locale={getDateLocale()}
			onrename={renameTag}
			ondelete={deleteTag}
			willMerge={(from, draft) => session.willMergeTag(from, draft)}
		/>
	</div>

	<div class="card-shell mt-grid-xl rounded-xl p-box-lg">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_model()}</h2>
		<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_model_hint()}</p>

		{#if analytics.hasModelReportFailed}
			{@render reportFailed()}
		{:else if calibration === null}
			{@render pending()}
		{:else}
			<ModelParameterTable rows={modelRows} class="mt-text-md" />
		{/if}
	</div>

	<!-- Most draining per hour. No pending or failed state: the reading is null on both, and
	     a card with no end to name is absent rather than empty — a deferred count alone is
	     not a reason to render, or a user whose only ratings are today's gets the empty box
	     this card is gated to avoid. -->
	{#if drainRanking !== null && (drainRanking.cognitive !== null || drainRanking.physical !== null)}
		<div class="card-shell mt-grid-xl rounded-xl p-box-lg">
			<h2 class="text-sm font-medium text-ty-primary">{m.ana_drain_rank()}</h2>
			<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_drain_rank_hint()}</p>

			<div class="mt-text-md grid gap-text-xs">
				{#each drainRankRows as { label, pair } (label)}
					<div class="flex flex-wrap items-baseline justify-between gap-x-grid-xs">
						<span class="text-xs text-ty-silent">{label}</span>
						<span class="text-sm font-medium text-ty-primary">
							{pair === null
								? m.ana_drain_rank_none()
								: m.ana_drain_rank_pair({
										most: pair.most.taskTitle,
										least: pair.least.taskTitle,
									})}
						</span>
					</div>
				{/each}
			</div>

			{#if drainRanking.deferredCount > 0}
				<p class="mt-text-sm text-xs text-ty-secondary">
					{drainRanking.deferredCount === 1
						? m.energy_drain_pending_one()
						: m.energy_drain_pending({
								count: drainRanking.deferredCount,
							})}
				</p>
			{/if}
		</div>
	{/if}
{/if}

<!-- What each fit was made from, above the list of the logs it was made from — outside the
     load gate for the same reason that list is: the gate's `{:else if}` is `hasData`, which
     is about day SUMMARIES. Absent until their own stores answer, rather than empty: a
     headline of 0 before the read is a claim that nothing was ever logged. -->
{#if !areFitsLoading}
	<div class="mt-grid-xl grid gap-grid-lg lg:grid-cols-2">
		<FlowCalibrationCard
			constantsFitted={session.constantsFit.fitted}
			logCount={session.flowObservations.length}
			pendingLogs={session.pendingFlowLogCount}
		/>

		<DrainCalibrationCard
			logCount={observations.drainObservations.length}
			pendingLogs={pendingDrainLogs}
			ratesFitted={drainRatesFitted}
		/>
	</div>
{/if}

<!-- OUTSIDE the load gate, unlike every other card: "In your logs →" scrolls to this `id`
     once on arrival and nothing retries, and the gate's `{:else if}` is `hasData`, which is
     about day SUMMARIES — measurements without one would be told the app was never used. -->
<div id="log-history" class="card-shell mt-grid-xl scroll-mt-grid-lg rounded-xl p-box-lg">
	<div class="flex flex-wrap items-baseline justify-between gap-x-grid-xs gap-y-text-3xs">
		<h2 class="text-sm font-medium text-ty-primary">{m.ana_logs()}</h2>
		<button
			type="button"
			class="hint-underline shrink-0 text-xs text-ty-silent transition hover:text-ty-secondary"
			onclick={() => {
				allTime = !allTime;
				closeEditor();
			}}
		>
			{allTime ? m.ana_logs_scope_range() : m.ana_logs_scope_all()}
		</button>
	</div>
	<p class="mt-text-3xs text-xs text-ty-silent">{m.ana_logs_hint()}</p>

	{#if areLogsLoading}
		{@render pending()}
	{:else}
		<LogHistoryList
			rows={logRows}
			{allTime}
			{editingKey}
			ondelete={deleteLog}
			onedit={(key) => (editingKey = key)}
			oncancel={closeEditor}
			onsaveflow={saveFlowLog}
			onsavedrain={saveDrainLog}
			onsaverest={saveRestLog}
		/>
		<div class="mt-text-lg grid gap-text-2xs border-t border-line-soft pt-box-sm">
			<FitLogSummary
				label={formatResetLabel(m.ana_logs_kind_flow(), session.flowObservations.length)}
				count={session.flowObservations.length}
				confirmLabel={m.budget_reset_confirm({
					count: session.flowObservations.length,
				})}
				resetLabel={m.ana_logs_reset_flow()}
				resetTitle={m.budget_reset_title()}
				withHistoryLink={false}
				onreset={() => {
					session.resetFlowLogs();
					closeEditor();
				}}
			/>
			<FitLogSummary
				label={formatResetLabel(m.ana_logs_kind_drain(), observations.drainObservations.length)}
				count={observations.drainObservations.length}
				confirmLabel={m.energy_reset_drain_confirm({
					count: observations.drainObservations.length,
				})}
				resetLabel={m.energy_reset_drain_logs()}
				resetTitle={m.energy_reset_drain_title()}
				withHistoryLink={false}
				onreset={() => {
					observations.resetDrainLogs();
					closeEditor();
				}}
			/>
			<FitLogSummary
				label={formatResetLabel(m.ana_logs_kind_rest(), observations.restObservations.length)}
				count={observations.restObservations.length}
				confirmLabel={m.energy_reset_rest_confirm({
					count: observations.restObservations.length,
				})}
				resetLabel={m.energy_reset_rest_logs()}
				resetTitle={m.energy_reset_rest_title()}
				withHistoryLink={false}
				onreset={() => {
					observations.resetRestLogs();
					closeEditor();
				}}
			/>
		</div>
	{/if}
</div>
