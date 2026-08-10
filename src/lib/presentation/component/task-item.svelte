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

	/* The main page's reading of a task: what the allocator made of it — priority, its
	   share of the day, run order, T*. The row's frame, checkbox, action strip and every
	   editor are task-row-shell's, filled here; the Lab's row fills the same slots with
	   the schedule's reading. Both measurements (⚡ and 🪫) are the shell's on both
	   screens — this component only binds them to an id. */

	interface Props {
		id: number;
		title: string;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		/** Which system the task leans on — classified by the model, badged here. */
		nature: TaskNature;
		completed: boolean;
		priorityScore: number;
		suggestedHours: number;
		trueEffort: number;
		flowStateTime: number;
		// Per-task optimal stopping time from the allocator (model v2:
		// task-dependent — no longer reconstructable as a fixed 1.79 × ϕ, and
		// hedged for ϕ-uncertainty, so it can land below ϕ itself — MATH.md §3)
		optimalStopHours: number;
		/** The mid-day re-plan (MATH.md §35): what the hours still left today are worth
		 *  on this task, beside how many are left at all. Absent until today has 🪫
		 *  hours logged against it — the plan alone answers a day nobody has worked.
		 *  Passed for every row once any hours exist, but only rendered where it says
		 *  something the plan does not; see `replan`. */
		remaining?: {
			taskHours: number;
			dayHours: number;
		};
		runOrder?: number;
		flowMinutes?: number;
		/** Flagged as unmovable, so the plan advisor never offers to defer it. */
		mustDoToday?: boolean;
		ontoggle: (id: number) => void;
		onremove?: (id: number) => void;
		flowDraft?: EditorDraft | null;
		onflowopen?: (id: number, source: EditorSource) => void;
		/** The badge's own action — see `task-row-shell.svelte`. */
		onflowedit?: (id: number, source: EditorSource) => void;
		onflowclose?: (id: number) => void;
		onlogflow?: (id: number, minutes: number) => void;
		onflowdelete?: (id: number) => void;
		drainDraft?: DrainDraft | null;
		drainLogs?: Persisted<DrainObservationRecord>[];
		ondrainopen?: (id: number, source: EditorSource) => void;
		ondrainclose?: (id: number) => void;
		ondrainsave?: (id: number, entry: { hours: number; mind: number; body: number }) => void;
		/** Required, unlike the logging callbacks: a rating stays correctable on every day
		 *  this row renders — see `task-row-shell.svelte`. */
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

	/* The re-plan is shown only where it DISAGREES with the plan (MATH.md §35). Hours
	   logged against one task re-plan every other row, and on a day spent as the plan
	   asked, the answer for those rows is the plan again — a second line repeating it
	   reads as news where there is none, and it would appear on nothing more than a
	   drain log existing. Compared on the PRINTED figure, because what the guard is
	   preventing is the same text twice; the raw hours differ below the minute. */
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
	<span class="text-ty-ghost">|</span>
	<Tooltip.Root>
		<Tooltip.Trigger class="cursor-help">
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
			<!-- Mid-day (MATH.md §35): the delta leads and the plan drops beneath it,
			     because at 2pm the actionable number is the one saying what to do next.
			     Deliberately NOT a strikethrough on the plan. It is not superseded — it
			     is the same number the plan-family rows on this page are still computed
			     from (§11.8) — and the two are on different bases: this is time to spend
			     ON TOP of the hours already worked, so pairing them as was/now would
			     understate the day's real total. Which is also why neither line is
			     phrased as a comparison ("15m more"): the delta is not measured against
			     the plan printed under it, and a comparative word would invite exactly
			     that reading — wrongly, and in only one direction, since a task you
			     over-worked leaves the others LESS. Each line is labelled by what it
			     answers instead, which is also what keeps the two legible as one row:
			     they are never the same printed figure, but they are two figures. -->
			<div class="text-right">
				<Tooltip.Root>
					<Tooltip.Trigger class="block cursor-help text-sm font-semibold text-ty-primary">
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
					<Tooltip.Trigger class="block cursor-help text-2xs text-ty-silent">
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
				<Tooltip.Trigger class="cursor-help text-right">
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
