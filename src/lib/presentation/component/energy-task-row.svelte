<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import DrainLogForm from '$lib/presentation/component/drain-log-form.svelte';
	import TaskEditForm from '$lib/presentation/component/task-edit-form.svelte';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import TaskRowShell, {
		ROW_ACTION_CLASS,
	} from '$lib/presentation/component/task-row-shell.svelte';
	import { cn } from '$lib/presentation/utils';
	import { formatDuration } from '$lib/presentation/utils/duration-format';

	/* The Lab's reading of a task: the plan's hue, the hours the schedule gave it, and
	   the 🪫 rating for the session it ends. Same shell as the main page's row, filled
	   from the other model — that difference is the only reason there are two.

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
		/** Flagged as unmovable. Not shown here — the plan advisor is the main page's —
		 *  but ✎ must round-trip it rather than clear it. */
		mustDoToday?: boolean;
		/** The plan's colour for this task — the same hue the timeline gives its blocks. */
		color: string;
		/** What the plan gave the task. Null when there is no plan to report on: "no
		 *  hours" against every task would be a claim the optimizer never made. */
		plannedHours: number | null;
		/** A 🪫 rating for this task exists for today. */
		measured: boolean;
		/** The open 🪫 editor's draft, or null when it is closed. Owned by the page: it
		 *  is one editor for the whole list, and the completion prompt refuses to open
		 *  over any of them — see `completionPromptAction`. */
		drainDraft: {
			minutes: number | null;
			mind: number | null;
			body: number | null;
		} | null;
		/** True only when this row's own 🪫 button opened the editor. */
		focusDrainMinutes: boolean;
		ontoggle: () => void;
		onremove: () => void;
		ondrainclick: () => void;
		/** The whole edit ✎ collected — the only way this row changes the task. */
		onchange: (edit: TaskEdit) => void;
		ondrainsave: (entry: { hours: number; mind: number; body: number }) => void;
		ondraincancel: () => void;
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
		measured,
		drainDraft,
		focusDrainMinutes,
		ontoggle,
		onremove,
		ondrainclick,
		onchange,
		ondrainsave,
		ondraincancel,
	}: Props = $props();

	// The ✎ editor, open. Local like task-item.svelte's, and unlike the 🪫 draft:
	// nothing outside the row gates on it, because the completion prompt cannot destroy
	// it — the two forms stack rather than replace each other.
	let editing = $state(false);
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

<!-- The 🪫 rating is this screen's own action; ✎ and ✕ are the shell's. Deliberately
     NOT hidden on a completed task: finishing one is the commonest way a session ends,
     and rating it is what the row is for. -->
{#snippet actions()}
	<Tooltip.Root>
		<Tooltip.Trigger
			class={cn(
				ROW_ACTION_CLASS,
				measured || drainDraft ? 'text-flow' : 'text-ty-silent hover:text-flow',
			)}
			onclick={ondrainclick}
			aria-label={m.energy_log_drain_aria()}
		>
			🪫
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>{m.energy_log_drain_tooltip()}</p>
		</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

{#snippet forms()}
	{#if drainDraft}
		<DrainLogForm
			seed={drainDraft}
			focusMinutes={focusDrainMinutes}
			onsave={ondrainsave}
			oncancel={ondraincancel}
		/>
	{/if}
	{#if editing}
		<!-- The same editor the main page's ✎ opens, minus the must-do flag: it is read
		     by the plan advisor and by nothing in this mode, so the checkbox would be a
		     control with no consequence on screen. The seed still carries the stored
		     value through, so renaming a task here cannot clear a flag set there. -->
		<TaskEditForm
			seed={{
				title,
				physicalDifficulty,
				mentalDifficulty,
				enjoyment,
				mustDoToday,
			}}
			showMustDoToday={false}
			onsave={(edit) => {
				onchange(edit);
				editing = false;
			}}
			oncancel={() => (editing = false)}
		/>
	{/if}
{/snippet}

<Tooltip.Provider delayDuration={150}>
	<TaskRowShell
		{title}
		{completed}
		{physicalDifficulty}
		{mentalDifficulty}
		{enjoyment}
		{ontoggle}
		{lead}
		{trailing}
		{actions}
		actionsPinned={measured || drainDraft !== null}
		{editing}
		onedit={() => (editing = !editing)}
		{onremove}
		{forms}
	/>
</Tooltip.Provider>
