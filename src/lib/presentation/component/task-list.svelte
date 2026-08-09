<script lang="ts">
	import type { Snippet } from 'svelte';
	import TaskItem from '$lib/presentation/component/task-item.svelte';
	import TaskListCard from '$lib/presentation/component/task-list-card.svelte';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import type { DrainDraft, EditorSource } from '$lib/presentation/utils/measurement-prompt';
	import type { SuggestedTask } from '$lib/business/model/metric/calculation';

	interface Props {
		suggestedTasks: SuggestedTask[];
		runOrder: Map<number, number>; // task id → 1-based position in suggested sequence
		// The add-task form, rendered by the card above the list: adding and reading
		// the plan are the same place, and it costs no second card.
		form?: Snippet;
		ontoggle: (id: number) => void;
		onremove?: (id: number) => void;
		onlogflow?: (id: number, minutes: number) => void;
		/** The 🪫 editors open on this list, by task — the page owns them, since a draft
		 *  outlives the row it is keyed by. */
		drainDrafts?: Record<number, DrainDraft>;
		/** Task ids carrying at least one 🪫 rating for today. */
		drainMeasured?: ReadonlySet<number>;
		ondrainopen?: (id: number, source: EditorSource) => void;
		ondrainclose?: (id: number) => void;
		ondrainsave?: (id: number, entry: { hours: number; mind: number; body: number }) => void;
		onupdate?: (id: number, changes: TaskEdit) => void;
	}

	let {
		suggestedTasks,
		runOrder,
		form,
		ontoggle,
		onremove,
		onlogflow,
		drainDrafts = {},
		drainMeasured = new Set(),
		ondrainopen,
		ondrainclose,
		ondrainsave,
		onupdate,
	}: Props = $props();
</script>

{#snippet rows()}
	{#each suggestedTasks as task (task.id)}
		<li>
			<TaskItem
				id={task.id}
				title={task.title}
				physicalDifficulty={task.physicalDifficulty}
				mentalDifficulty={task.mentalDifficulty}
				enjoyment={task.enjoyment}
				nature={task.nature}
				completed={task.completed}
				priorityScore={task.priorityScore}
				suggestedHours={task.suggestedHours}
				trueEffort={task.trueEffort}
				flowStateTime={task.flowStateTime}
				optimalStopHours={task.optimalHours}
				runOrder={runOrder.get(task.id)}
				flowMinutes={task.flowMinutes}
				mustDoToday={task.mustDoToday}
				{ontoggle}
				{onremove}
				{onlogflow}
				drainDraft={drainDrafts[task.id] ?? null}
				isDrainMeasured={drainMeasured.has(task.id)}
				{ondrainopen}
				{ondrainclose}
				{ondrainsave}
				{onupdate}
			/>
		</li>
	{/each}
{/snippet}

<TaskListCard {form} rows={suggestedTasks.length ? rows : null} />
