<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/presentation/component/ui/badge';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import TaskRowShell from '$lib/presentation/component/task-row-shell.svelte';
	import { natureBadge, type TaskNature } from '$lib/presentation/utils/task-nature';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import type { DrainDraft, EditorSource } from '$lib/presentation/utils/measurement-prompt';

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
		 *  hours logged against it — the plan alone answers a day nobody has worked. */
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
		onlogflow?: (id: number, minutes: number) => void;
		drainDraft?: DrainDraft | null;
		isDrainMeasured?: boolean;
		ondrainopen?: (id: number, source: EditorSource) => void;
		ondrainclose?: (id: number) => void;
		ondrainsave?: (id: number, entry: { hours: number; mind: number; body: number }) => void;
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
		onlogflow,
		drainDraft = null,
		isDrainMeasured = false,
		ondrainopen,
		ondrainclose,
		ondrainsave,
		onupdate,
	}: Props = $props();

	const badge = $derived(natureBadge(nature));
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
		{#if remaining}
			<!-- Mid-day (MATH.md §35): the delta leads and the plan drops beneath it,
			     because at 2pm the actionable number is the one saying what to do next.
			     Deliberately NOT a strikethrough on the plan. It is not superseded — it
			     is the same number the plan-family rows on this page are still computed
			     from (§11.8) — and the two are on different bases: this is time to spend
			     ON TOP of the hours already worked, so pairing them as was/now would
			     understate the day's real total. The word carries that; a struck pair
			     could not. -->
			<div class="text-right">
				<Tooltip.Root>
					<Tooltip.Trigger class="block cursor-help text-sm font-semibold text-ty-primary">
						{m.task_remaining_more({
							hours: formatDuration(remaining.taskHours),
						})}
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>
							{m.task_remaining_tooltip({
								left: formatDuration(remaining.dayHours),
							})}
						</p>
					</Tooltip.Content>
				</Tooltip.Root>
				<Tooltip.Root>
					<!-- The plan figure only when it differs from the delta above: printing
					     the same duration twice reads as a display bug. It is NOT a claim
					     that nothing changed — the two coincide both on a task nobody
					     touched and on one worked 30m whose day just grew, and this row
					     cannot tell those apart (it is handed no per-task worked hours).
					     So the duplicate is what is dropped, never the line. -->
					<Tooltip.Trigger class="block cursor-help text-2xs text-ty-silent">
						{#if remaining.taskHours !== suggestedHours}
							{formatDuration(suggestedHours)} ·
						{/if}
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
				<!-- Spans, not divs: the trigger renders a <button>, whose content model is
				     phrasing content only. -->
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
		onlogflow={onlogflow && ((minutes) => onlogflow(id, minutes))}
		{drainDraft}
		{isDrainMeasured}
		ondrainopen={ondrainopen && ((source) => ondrainopen(id, source))}
		ondrainclose={ondrainclose && (() => ondrainclose(id))}
		ondrainsave={ondrainsave && ((entry) => ondrainsave(id, entry))}
		onupdate={onupdate && ((edit) => onupdate(id, edit))}
		onremove={onremove && (() => onremove(id))}
		{lead}
		{meta}
		{trailing}
	/>
</Tooltip.Provider>
