<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import TaskRowShell from '$lib/presentation/component/task-row-shell.svelte';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import type {
		DrainDraft,
		EditorDraft,
		EditorSource,
	} from '$lib/presentation/utils/measurement-prompt';

	/* The Lab's reading of a task: the plan's hue and the hours the schedule gave it.
	   Same shell as the main page's row, filled from the other model — that difference
	   is the only reason there are two. Both measurements, every editor and the action
	   strip are the shell's.

	   The three model inputs used to be live sliders here, a second line on every row.
	   They are a definition the user sets once when deploying the task (the form even
	   suggests them from history), so they read as text like the main page spells them
	   and ✎ re-tunes them. What re-optimizes live is the params panel beside the list,
	   which is what the Lab is actually for. */

	interface Props {
		title: string;
		completed: boolean;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		/** Not badged here — the plan advisor is the main page's — but ✎ must round-trip
		 *  it rather than clear it. */
		mustDoToday?: boolean;
		/** The plan's colour for this task — the same hue the timeline gives its blocks. */
		color: string;
		/** What the plan gave the task. Null when there is no plan to report on: "no
		 *  hours" against every task would be a claim the optimizer never made. */
		plannedHours: number | null;
		flowMinutes?: number;
		flowDraft?: EditorDraft | null;
		onflowopen: (source: EditorSource) => void;
		onflowclose: () => void;
		onlogflow: (minutes: number) => void;
		drainDraft?: DrainDraft | null;
		isDrainMeasured?: boolean;
		ontoggle: () => void;
		onremove: () => void;
		ondrainopen: (source: EditorSource) => void;
		ondrainclose: () => void;
		ondrainsave: (entry: { hours: number; mind: number; body: number }) => void;
		/** The whole edit ✎ collected — the only way this row changes the task. */
		onchange: (edit: TaskEdit) => void;
	}

	let {
		title,
		completed,
		physicalDifficulty,
		mentalDifficulty,
		enjoyment,
		mustDoToday = false,
		color,
		plannedHours,
		flowMinutes,
		flowDraft = null,
		onflowopen,
		onflowclose,
		onlogflow,
		drainDraft = null,
		isDrainMeasured = false,
		ontoggle,
		onremove,
		ondrainopen,
		ondrainclose,
		ondrainsave,
		onchange,
	}: Props = $props();
</script>

{#snippet lead()}
	<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: {color}"></span>
{/snippet}

<!-- What the plan gave this task, where the main page puts its own allocation. Hidden
     on a completed task, which the optimizer no longer plans at all: "no hours" there
     reads as a verdict when it only means the task is done. -->
{#snippet trailing()}
	{#if !completed && plannedHours !== null}
		<span
			class="text-right {plannedHours
				? 'text-sm font-semibold text-ty-primary'
				: 'text-2xs text-ty-silent italic'}"
		>
			{plannedHours ? formatDuration(plannedHours) : m.energy_no_hours()}
		</span>
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
		withMustDoToday={false}
		{ontoggle}
		{flowMinutes}
		{flowDraft}
		{onflowopen}
		{onflowclose}
		{onlogflow}
		{drainDraft}
		{isDrainMeasured}
		{ondrainopen}
		{ondrainclose}
		{ondrainsave}
		onupdate={onchange}
		{onremove}
		{lead}
		{trailing}
	/>
</Tooltip.Provider>
