<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import TaskRowShell from '$lib/presentation/component/task-row-shell.svelte';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import { formatDecimals } from '$lib/presentation/utils/number-format';
	import type { RowMeasurements } from '$lib/presentation/utils/measurement-editor.svelte';

	// Why: presentation/AGENTS.md, "R3 in the UI — the two task screens are one definition"

	interface Props {
		task: TaskEdit;
		completed: boolean;
		/** The user's past tags, for the ✎ editor's tag field — the page's, since a
		 *  row cannot read the session store. */
		tagVocabulary?: string[];
		color: string;
		/** Read off the store, not computed here: R2, and it is the number `/` prints. */
		trueEffort: number;
		/** Null when there is no plan at all: "no hours" against every task would be a
		 *  claim the optimizer never made. */
		plannedHours: number | null;
		measurements: RowMeasurements;
		ontoggle: () => void;
		onremove: () => void;
		/** `onupdate`, like task-item.svelte's, because both rows forward it to the same
		 *  shell prop. The Lab's other control callbacks are `onchange`; this one is not
		 *  one of them. */
		onupdate: (edit: TaskEdit) => void;
		locale: string;
		class?: string;
	}

	let {
		task,
		completed,
		tagVocabulary,
		color,
		trueEffort,
		plannedHours,
		measurements,
		ontoggle,
		onremove,
		onupdate,
		locale,
		class: className,
	}: Props = $props();
</script>

{#snippet lead()}
	<span
		class="block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-series-divider"
		style="background-color: {color}"
	></span>
{/snippet}

<!-- What this peer model derives from the three sliders, and all of it: no ϕ and no
     stopping time — an energy plan never took either reading, which is also why this one
     carries no tooltip. `task_derived_tooltip` explains all three. -->
{#snippet readings()}
	{m.task_derived_effort({
		effort: formatDecimals(trueEffort, 1, locale),
	})}
{/snippet}

<!-- Silent on a completed task: the optimizer funds it like any other (`toEnergyTask`
     drops `completed`), but hours quoted for work already done read as a verdict. -->
{#snippet planned()}
	{#if !completed && plannedHours !== null}
		<span
			class={plannedHours
				? 'text-sm font-semibold whitespace-nowrap text-ty-primary tabular-nums'
				: 'text-2xs whitespace-nowrap text-ty-silent italic'}
		>
			{plannedHours ? formatDuration(plannedHours) : m.energy_no_hours()}
		</span>
	{/if}
{/snippet}

<Tooltip.Provider>
	<TaskRowShell
		{task}
		{completed}
		{tagVocabulary}
		withMustDoToday={false}
		{ontoggle}
		{measurements}
		{onupdate}
		{onremove}
		{lead}
		{readings}
		{planned}
		class={className}
	/>
</Tooltip.Provider>
