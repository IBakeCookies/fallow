<script lang="ts">
	import type { Persisted, DrainObservationRecord, TaskImportance } from '$lib/business/type';
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/presentation/component/ui/badge';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import DayRail from '$lib/presentation/component/day-rail.svelte';
	import TaskRowShell from '$lib/presentation/component/task-row-shell.svelte';
	import { cn } from '$lib/presentation/utils';
	import { BAND_TEXT_CLASS } from '$lib/presentation/utils/band';
	import type { DayBlock } from '$lib/presentation/utils/day-timeline';
	import { natureBadge, type TaskNature } from '$lib/presentation/utils/task-nature';
	import { formatDuration, formatDurationBand } from '$lib/presentation/utils/duration-format';
	import type {
		DrainDraft,
		EditorDraft,
		EditorSource,
	} from '$lib/presentation/utils/measurement-prompt';

	interface Props {
		id: number;
		title: string;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		nature: TaskNature;
		completed: boolean;
		priorityScore: number;
		suggestedHours: number;
		trueEffort: number;
		flowStateTime: number;
		/** The fit's predictive spread on ϕ, printed beside it. Absent before there is a fit. */
		flowStateTimeStd?: number;
		// Not reconstructable from ϕ: task-dependent and hedged for ϕ-uncertainty,
		// so it can land below ϕ itself (MATH.md §3).
		optimalStopHours: number;
		/** The mid-day re-plan: passed for every row once today has 🪫
		 *  hours, rendered only where it disagrees with the plan — see `replan`. */
		remaining?: {
			taskHours: number;
			dayHours: number;
		};
		runOrder?: number;
		/** Position 1 of the mid-day re-plan — "you are here". Read from the hours logged
		 *  today, so it is routinely not the row `#1`: that badge is the whole-day plan's
		 *  order and stays the morning's answer. */
		isNext?: boolean;
		/** The row's block in the day's plan; absent on an unfunded row. */
		block?: DayBlock;
		/** The day the block is a share of — arrives with `block`. */
		totalHours?: number;
		flowMinutes?: number;
		mustDoToday?: boolean;
		importance?: TaskImportance;
		tags?: string[];
		/** The user's past tags, for the ✎ editor's tag field — the list comes from
		 *  the page, since a row cannot read the session store. */
		tagVocabulary?: string[];
		slideDay?: number | null;
		ontoggle: (id: number) => void;
		onremove?: (id: number) => void;
		flowDraft?: EditorDraft | null;
		onflowopen?: (id: number, source: EditorSource) => void;
		onflowedit: (id: number, source: EditorSource) => void;
		onflowclose: (id: number) => void;
		onlogflow: (id: number, minutes: number) => void;
		onflowdelete: (id: number) => void;
		drainDraft?: DrainDraft | null;
		drainLogs?: Persisted<DrainObservationRecord>[];
		ondrainopen?: (id: number, source: EditorSource) => void;
		ondrainclose: (id: number) => void;
		ondrainsave: (id: number, entry: { hours: number; mind: number; body: number }) => void;
		ondrainedit: (id: number, log: Persisted<DrainObservationRecord>) => void;
		ondraindelete: (id: number, recordId: number) => void;
		onupdate?: (id: number, changes: TaskEdit) => void;
		class?: string;
	}

	let {
		id,
		title,
		physicalDifficulty,
		mentalDifficulty,
		enjoyment,
		nature,
		completed,
		priorityScore,
		suggestedHours,
		trueEffort,
		flowStateTime,
		flowStateTimeStd,
		optimalStopHours,
		remaining,
		runOrder,
		isNext = false,
		block,
		totalHours,
		flowMinutes,
		mustDoToday = false,
		importance = 'normal',
		tags,
		tagVocabulary,
		slideDay,
		ontoggle,
		onremove,
		flowDraft = null,
		onflowopen,
		onflowedit,
		onflowclose,
		onlogflow,
		onflowdelete,
		drainDraft = null,
		drainLogs = [],
		ondrainopen,
		ondrainclose,
		ondrainsave,
		ondrainedit,
		ondraindelete,
		onupdate,
		class: className,
	}: Props = $props();

	const badge = $derived(natureBadge(nature));

	/* Shown only where it DISAGREES with the plan; compared on the PRINTED
	   figure, because what the guard prevents is the same text twice. */
	const replan = $derived(
		remaining && formatDuration(remaining.taskHours) !== formatDuration(suggestedHours)
			? remaining
			: null,
	);
</script>

{#snippet lead()}
	{#if runOrder !== undefined && !completed}
		<Tooltip.Root>
			<Tooltip.Trigger class="order-badge">
				#{runOrder}
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.task_run_order_tooltip()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
	{#if isNext}
		<Tooltip.Root>
			<Tooltip.Trigger class="order-badge uppercase tracking-wide">
				{m.next_up_label()}
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.next_up_tooltip()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
{/snippet}

{#snippet badges()}
	<Tooltip.Root>
		<Tooltip.Trigger class="cursor-help">
			<Badge class={cn('uppercase tracking-wide', badge.class)}>
				{badge.label}
			</Badge>
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>{badge.description}</p>
		</Tooltip.Content>
	</Tooltip.Root>
	{#if mustDoToday}
		<Tooltip.Root>
			<Tooltip.Trigger class="cursor-help">
				<Badge class="bg-warning-tint uppercase tracking-wide text-warning-strong">
					{m.task_must_do_badge()}
				</Badge>
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.form_must_do_today_title()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
	<!-- `normal` is silent: a badge for the level nobody chose would be on every row. -->
	{#if importance !== 'normal'}
		<Tooltip.Root>
			<Tooltip.Trigger class="cursor-help">
				<Badge
					class={cn(
						'uppercase tracking-wide',
						importance === 'high'
							? 'bg-danger-tint text-danger-strong'
							: 'bg-surface-inset text-ty-silent',
					)}
				>
					{importance === 'high' ? m.task_importance_high_badge() : m.task_importance_low_badge()}
				</Badge>
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.form_importance_title()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
	{#if slideDay}
		<Tooltip.Root>
			<Tooltip.Trigger class="cursor-help">
				<Badge class="bg-info-tint uppercase tracking-wide text-info-strong">
					{m.task_slide_badge({
						day: slideDay,
					})}
				</Badge>
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.task_slide_tooltip()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
{/snippet}

<!-- One trigger over the three: they are one sentence about what the model made of the
     sliders, and three triggers on one line read as three separate claims. -->
{#snippet readings()}
	<Tooltip.Root>
		<Tooltip.Trigger class="cursor-help text-left">
			{m.task_derived_values({
				effort: trueEffort.toFixed(1),
				flow: formatDurationBand(flowStateTime, flowStateTimeStd),
				stop: formatDuration(optimalStopHours),
			})}
		</Tooltip.Trigger>
		<!-- Two paragraphs, and the shell is an `inline-flex` ROW — so the second
		     one sets beside the first without this. -->
		<Tooltip.Content class="flex-col items-start">
			<p>{m.task_derived_tooltip()}</p>
			{#if flowStateTimeStd !== undefined}
				<p>{m.task_flow_band_tooltip()}</p>
			{/if}
		</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

<!-- The run order's own justification, so it reads beside the readings it ranks — and
     nothing at all on a completed task, which the plan is no longer ranking. -->
{#snippet meta()}
	{#if !completed}
		<!-- The separator is the caller's: every other `·` on the line is inside a message,
		     and the Lab renders no `meta` for one to sit before. -->
		<span class="text-ty-ghost">·</span>
		<Tooltip.Root>
			<!-- 1 dp even at .0: MATH.md §3's printed scale. -->
			<Tooltip.Trigger class="cursor-help tabular-nums">
				{m.task_derived_priority({
					score: priorityScore.toFixed(1),
				})}
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.task_allocation_tooltip()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
		<!-- A block that reaches flow prints no sentence: `readings` already prints ϕ, and
		     the solid segment is the reading. -->
		{#if block && block.ghostHours > 0}
			<span class="text-ty-ghost">·</span>
			<span class={BAND_TEXT_CLASS[block.band]}>
				{m.flow_short({
					duration: formatDuration(block.ghostHours),
				})}
			</span>
		{/if}
	{/if}
{/snippet}

{#snippet rail()}
	{#if block && totalHours !== undefined}
		<DayRail {block} {totalHours} class="mt-text-2xs" />
	{/if}
{/snippet}

<!-- Beside the title, as in the Lab's list: same reading, same place. Nothing at all on
     a completed task — hours quoted for work already done read as a verdict. -->
{#snippet planned()}
	{#if !completed}
		<div class="text-right whitespace-nowrap tabular-nums">
			<Tooltip.Root>
				<!-- Why each reading triggers on itself: presentation/AGENTS.md, "The row's
				     layout" -->
				<Tooltip.Trigger class="block cursor-help text-right font-semibold text-ty-primary">
					{replan
						? m.task_remaining_spend({
								hours: formatDuration(replan.taskHours),
							})
						: formatDuration(suggestedHours)}
				</Tooltip.Trigger>
				<Tooltip.Content>
					<p>
						{replan
							? m.task_remaining_tooltip({
									left: formatDuration(replan.dayHours),
								})
							: m.task_allocation_tooltip()}
					</p>
				</Tooltip.Content>
			</Tooltip.Root>
			<!-- The plan reads beneath the re-plan and only there: with no
			     re-plan above it, the bold line already IS the plan. -->
			{#if replan}
				<Tooltip.Root>
					<Tooltip.Trigger class="block cursor-help text-right text-2xs text-ty-silent">
						{m.task_plan_hours({
							hours: formatDuration(suggestedHours),
						})}
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>{m.task_allocation_tooltip()}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			{/if}
		</div>
	{/if}
{/snippet}

<!-- A task row is dense with hover targets: a pointer crossing it to reach the
     checkbox or the ✎ passes over several triggers, and the shared 150ms opens
     each one on the way. 400ms is long enough that only a deliberate rest opens
     a tooltip. -->
<Tooltip.Provider delayDuration={400}>
	<TaskRowShell
		{title}
		{completed}
		{physicalDifficulty}
		{mentalDifficulty}
		{enjoyment}
		{mustDoToday}
		{importance}
		{tags}
		{tagVocabulary}
		ontoggle={() => ontoggle(id)}
		{flowMinutes}
		{flowDraft}
		onflowopen={onflowopen && ((source) => onflowopen(id, source))}
		onflowedit={() => onflowedit(id, 'button')}
		onflowclose={() => onflowclose(id)}
		onlogflow={(minutes) => onlogflow(id, minutes)}
		onflowdelete={() => onflowdelete(id)}
		{drainDraft}
		{drainLogs}
		ondrainopen={ondrainopen && ((source) => ondrainopen(id, source))}
		ondrainclose={() => ondrainclose(id)}
		ondrainsave={(entry) => ondrainsave(id, entry)}
		ondrainedit={(log) => ondrainedit(id, log)}
		ondraindelete={(recordId) => ondraindelete(id, recordId)}
		onupdate={onupdate && ((edit) => onupdate(id, edit))}
		onremove={onremove && (() => onremove(id))}
		{lead}
		{badges}
		{readings}
		{meta}
		{planned}
		{rail}
		class={className}
	/>
</Tooltip.Provider>
