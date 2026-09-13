<script lang="ts">
	import type { Persisted, DrainObservationRecord, TaskImportance } from '$lib/business/type';
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

	// Why: presentation/AGENTS.md, "R3 in the UI — the two task screens are one definition"

	interface Props {
		title: string;
		completed: boolean;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		/** None of the three is badged here, but ✎ must round-trip them rather than
		 *  clear them. */
		mustDoToday?: boolean;
		importance?: TaskImportance;
		tags?: string[];
		/** The user's past tags, for the ✎ editor's tag field — the page's, since a
		 *  row cannot read the session store. */
		tagVocabulary?: string[];
		color: string;
		/** Read off the store, not computed here: R2, and it is the number `/` prints. */
		trueEffort: number;
		/** Null when there is no plan at all: "no hours" against every task would be a
		 *  claim the optimizer never made. */
		plannedHours: number | null;
		flowMinutes?: number;
		flowDraft?: EditorDraft | null;
		onflowopen: (source: EditorSource) => void;
		onflowedit: () => void;
		onflowclose: () => void;
		onlogflow: (minutes: number) => void;
		onflowdelete: () => void;
		drainDraft?: DrainDraft | null;
		drainLogs?: Persisted<DrainObservationRecord>[];
		ontoggle: () => void;
		onremove: () => void;
		ondrainopen: (source: EditorSource) => void;
		ondrainclose: () => void;
		ondrainsave: (entry: { hours: number; mind: number; body: number }) => void;
		ondrainedit: (log: Persisted<DrainObservationRecord>) => void;
		ondraindelete: (recordId: number) => void;
		/** `onupdate`, like task-item.svelte's, because both rows forward it to the same
		 *  shell prop. The Lab's other control callbacks are `onchange`; this one is not
		 *  one of them. */
		onupdate: (edit: TaskEdit) => void;
		class?: string;
	}

	let {
		title,
		completed,
		physicalDifficulty,
		mentalDifficulty,
		enjoyment,
		mustDoToday = false,
		importance = 'normal',
		tags,
		tagVocabulary,
		color,
		trueEffort,
		plannedHours,
		flowMinutes,
		flowDraft = null,
		onflowopen,
		onflowedit,
		onflowclose,
		onlogflow,
		onflowdelete,
		drainDraft = null,
		drainLogs = [],
		ontoggle,
		onremove,
		ondrainopen,
		ondrainclose,
		ondrainsave,
		ondrainedit,
		ondraindelete,
		onupdate,
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
		effort: trueEffort.toFixed(1),
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
		{title}
		{completed}
		{physicalDifficulty}
		{mentalDifficulty}
		{enjoyment}
		{mustDoToday}
		{importance}
		{tags}
		{tagVocabulary}
		withMustDoToday={false}
		{ontoggle}
		{flowMinutes}
		{flowDraft}
		{onflowopen}
		{onflowedit}
		{onflowclose}
		{onlogflow}
		{onflowdelete}
		{drainDraft}
		{drainLogs}
		{ondrainopen}
		{ondrainclose}
		{ondrainsave}
		{ondrainedit}
		{ondraindelete}
		{onupdate}
		{onremove}
		{lead}
		{readings}
		{planned}
		class={className}
	/>
</Tooltip.Provider>
