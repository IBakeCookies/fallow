<script lang="ts">
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/presentation/component/ui/badge';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import TaskRowShell from '$lib/presentation/component/task-row-shell.svelte';
	import { natureBadge, type TaskNature } from '$lib/presentation/utils/task-nature';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import { getTaskColumns } from '$lib/presentation/utils/ledger-column';
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
		// Not reconstructable from ϕ: task-dependent and hedged for ϕ-uncertainty,
		// so it can land below ϕ itself (MATH.md §3).
		optimalStopHours: number;
		/** The mid-day re-plan (MATH.md §35): passed for every row once today has 🪫
		 *  hours, rendered only where it disagrees with the plan — see `replan`. */
		remaining?: {
			taskHours: number;
			dayHours: number;
		};
		runOrder?: number;
		flowMinutes?: number;
		mustDoToday?: boolean;
		slideDay?: number | null;
		ontoggle: (id: number) => void;
		onremove?: (id: number) => void;
		flowDraft?: EditorDraft | null;
		onflowopen?: (id: number, source: EditorSource) => void;
		onflowedit?: (id: number, source: EditorSource) => void;
		onflowclose?: (id: number) => void;
		onlogflow?: (id: number, minutes: number) => void;
		onflowdelete?: (id: number) => void;
		drainDraft?: DrainDraft | null;
		drainLogs?: Persisted<DrainObservationRecord>[];
		ondrainopen?: (id: number, source: EditorSource) => void;
		ondrainclose?: (id: number) => void;
		ondrainsave?: (id: number, entry: { hours: number; mind: number; body: number }) => void;
		ondrainedit: (id: number, log: Persisted<DrainObservationRecord>) => void;
		ondraindelete: (id: number, recordId: number) => void;
		onupdate?: (id: number, changes: TaskEdit) => void;
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
		optimalStopHours,
		remaining,
		runOrder,
		flowMinutes,
		mustDoToday = false,
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
	}: Props = $props();

	const badge = $derived(natureBadge(nature));

	/* Shown only where it DISAGREES with the plan (MATH.md §35); compared on the PRINTED
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
{/snippet}

{#snippet badges()}
	<Tooltip.Root>
		<Tooltip.Trigger class="cursor-help">
			<Badge class="border-transparent uppercase tracking-wide {badge.class}">
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
				<Badge class="border-transparent bg-warning/20 uppercase tracking-wide text-warning">
					{m.task_must_do_badge()}
				</Badge>
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.form_must_do_today_title()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
	{#if slideDay}
		<Tooltip.Root>
			<Tooltip.Trigger class="cursor-help">
				<Badge class="border-transparent bg-info/20 uppercase tracking-wide text-info">
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

<!-- `Prio` renders an empty cell on a completed task rather than being dropped:
     a row short of a cell breaks every column's width below it. -->
{#snippet meta()}
	<td class="ledger-cell ledger-numeric ledger-wide whitespace-nowrap">
		<Tooltip.Root>
			<Tooltip.Trigger class="cursor-help">{trueEffort.toFixed(1)}</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.task_derived_tooltip()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</td>
	<td class="ledger-cell ledger-numeric ledger-wide whitespace-nowrap">
		{#if !completed}
			<Tooltip.Root>
				<!-- 1 dp even at .0: a column whose decimal points do not line up is what
						`ledger-numeric` exists to prevent (MATH.md §3's printed scale). -->
				<Tooltip.Trigger class="cursor-help">{priorityScore.toFixed(1)}</Tooltip.Trigger>
				<Tooltip.Content>
					<p>{m.task_allocation_tooltip()}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		{/if}
	</td>
	<td class="ledger-cell ledger-numeric ledger-wide whitespace-nowrap">
		<Tooltip.Root>
			<Tooltip.Trigger class="cursor-help">{formatDuration(flowStateTime)}</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.task_derived_tooltip()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</td>
	<td class="ledger-cell ledger-numeric ledger-wide whitespace-nowrap">
		<Tooltip.Root>
			<Tooltip.Trigger class="cursor-help">{formatDuration(optimalStopHours)}</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.task_derived_tooltip()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</td>
{/snippet}

<!-- Last column, as in the Lab's ledger: same reading, same place. Empty on a completed
     task rather than dropped — a row short of a cell breaks every column's width below
     it. -->
{#snippet trailing()}
	<td class="ledger-cell ledger-numeric whitespace-nowrap">
		{#if !completed}
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
			<!-- The plan reads beneath the re-plan and only there (MATH.md §35): with no
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
		{/if}
	</td>
{/snippet}

<Tooltip.Provider>
	<TaskRowShell
		{title}
		{completed}
		{physicalDifficulty}
		{mentalDifficulty}
		{enjoyment}
		{mustDoToday}
		columnCount={getTaskColumns().length}
		ontoggle={() => ontoggle(id)}
		{flowMinutes}
		{flowDraft}
		onflowopen={onflowopen && ((source) => onflowopen(id, source))}
		onflowedit={onflowedit && (() => onflowedit(id, 'button'))}
		onflowclose={onflowclose && (() => onflowclose(id))}
		onlogflow={onlogflow && ((minutes) => onlogflow(id, minutes))}
		onflowdelete={onflowdelete && (() => onflowdelete(id))}
		{drainDraft}
		{drainLogs}
		ondrainopen={ondrainopen && ((source) => ondrainopen(id, source))}
		ondrainclose={ondrainclose && (() => ondrainclose(id))}
		ondrainsave={ondrainsave && ((entry) => ondrainsave(id, entry))}
		ondrainedit={(log) => ondrainedit(id, log)}
		ondraindelete={(recordId) => ondraindelete(id, recordId)}
		onupdate={onupdate && ((edit) => onupdate(id, edit))}
		onremove={onremove && (() => onremove(id))}
		{lead}
		{badges}
		{meta}
		{trailing}
	/>
</Tooltip.Provider>
