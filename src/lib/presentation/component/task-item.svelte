<script lang="ts">
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/presentation/component/ui/badge';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import TaskRowShell from '$lib/presentation/component/task-row-shell.svelte';
	import { natureBadge, type TaskNature } from '$lib/presentation/utils/task-nature';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
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
			<Tooltip.Trigger
				class="cursor-help rounded-sm bg-flow/15 px-box-3xs py-text-3xs text-xs font-semibold text-flow"
			>
				#{runOrder}
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.task_run_order_tooltip()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
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
{/snippet}

{#snippet meta()}
	<!-- Below `sm` this rule's two sides never share a line, so it would point at nothing. -->
	<span class="hidden text-ty-ghost sm:inline">|</span>
	<Tooltip.Root>
		<Tooltip.Trigger class="cursor-help text-left">
			{m.task_derived_values({
				effort: trueEffort.toFixed(1),
				flow: formatDuration(flowStateTime),
				stop: formatDuration(optimalStopHours),
			})}
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>{m.task_derived_tooltip()}</p>
		</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

{#snippet trailing()}
	{#if !completed}
		{#if replan}
			<div>
				<Tooltip.Root>
					<!-- Why: presentation/AGENTS.md, "The row's layout" -->
					<Tooltip.Trigger
						class="block cursor-help text-left text-sm font-semibold text-ty-primary sm:text-right"
					>
						{m.task_remaining_spend({
							hours: formatDuration(replan.taskHours),
						})}
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>
							{m.task_remaining_tooltip({
								left: formatDuration(replan.dayHours),
							})}
						</p>
					</Tooltip.Content>
				</Tooltip.Root>
				<Tooltip.Root>
					<Tooltip.Trigger
						class="block cursor-help text-left text-2xs text-ty-silent sm:text-right"
					>
						{m.task_plan_hours({
							hours: formatDuration(suggestedHours),
						})} ·

						{m.task_priority({
							score: priorityScore,
						})}
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>{m.task_allocation_tooltip()}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</div>
		{:else}
			<Tooltip.Root>
				<Tooltip.Trigger class="cursor-help text-left sm:text-right">
					<span class="block text-sm font-semibold text-ty-primary">
						{formatDuration(suggestedHours)}
					</span>
					<span class="block text-2xs text-ty-silent">
						{m.task_priority({
							score: priorityScore,
						})}
					</span>
				</Tooltip.Trigger>
				<Tooltip.Content>
					<p>{m.task_allocation_tooltip()}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		{/if}
	{/if}
{/snippet}

<Tooltip.Provider delayDuration={150}>
	<TaskRowShell
		{title}
		{completed}
		{physicalDifficulty}
		{mentalDifficulty}
		{enjoyment}
		{mustDoToday}
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
		{meta}
		{trailing}
	/>
</Tooltip.Provider>
