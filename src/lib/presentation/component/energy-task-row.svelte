<script lang="ts">
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import TaskRowShell from '$lib/presentation/component/task-row-shell.svelte';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import { getEnergyTaskColumns } from '$lib/presentation/utils/ledger-column';
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
		/** Not badged here, but ✎ must round-trip it rather than clear it. */
		mustDoToday?: boolean;
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
	}

	let {
		title,
		completed,
		physicalDifficulty,
		mentalDifficulty,
		enjoyment,
		mustDoToday = false,
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
	}: Props = $props();
</script>

{#snippet lead()}
	<span
		class="block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-series-ink/40"
		style="background-color: {color}"
	></span>
{/snippet}

{#snippet meta()}
	<td class="ledger-cell ledger-numeric ledger-wide whitespace-nowrap">{trueEffort.toFixed(1)}</td>
{/snippet}

<!-- Empty on a completed task: the optimizer funds it like any other (`toEnergyTask`
     drops `completed`), but hours quoted for work already done read as a verdict. -->
{#snippet trailing()}
	<td class="ledger-cell ledger-numeric whitespace-nowrap">
		{#if !completed && plannedHours !== null}
			<span
				class={plannedHours
					? 'text-sm font-semibold text-ty-primary'
					: 'text-2xs text-ty-silent italic'}
			>
				{plannedHours ? formatDuration(plannedHours) : m.energy_no_hours()}
			</span>
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
		withMustDoToday={false}
		columnCount={getEnergyTaskColumns().length}
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
		{meta}
		{trailing}
	/>
</Tooltip.Provider>
