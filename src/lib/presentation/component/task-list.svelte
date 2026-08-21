<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import TaskItem from '$lib/presentation/component/task-item.svelte';
	import TaskListCard from '$lib/presentation/component/task-list-card.svelte';
	import NextUpLine from '$lib/presentation/component/next-up-line.svelte';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import type {
		DrainDraft,
		EditorDraft,
		EditorSource,
	} from '$lib/presentation/utils/measurement-prompt';
	import type { SuggestedTask } from '$lib/business/model/metric/calculation';
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import { getSlideDay } from '$lib/presentation/utils/slide-age';

	interface Props {
		suggestedTasks: SuggestedTask[];
		runOrder: Map<number, number>; // task id → 1-based position in suggested sequence
		/** The day on screen — every row's slide age is measured against it, not the clock. */
		viewedDate: string;
		/** The mid-day re-plan (MATH.md §35), or null until today has logged hours. A
		 *  task absent from `hoursByTask` is worth no more time today, so it reads 0 —
		 *  the map's absence and a task's absence from it are different answers. */
		remainingDay?: {
			remainingHours: number;
			hoursByTask: ReadonlyMap<number, number>;
		} | null;
		/** Position 1 of that re-plan's run order, rendered on the card's header row.
		 *  Undefined when there is nothing to pick up, which is every morning. */
		nextTaskTitle?: string;
		// The add-task form, rendered by the card above the list: adding and reading
		// the plan are the same place, and it costs no second card.
		form?: Snippet;
		ontoggle: (id: number) => void;
		onremove?: (id: number) => void;
		/** The ⚡ editors open on this list, by task — the page owns them, like the 🪫
		 *  ones, since a draft outlives the row it is keyed by. */
		flowDrafts?: Record<number, EditorDraft>;
		/** The viewed day's ⚡ readings in minutes, by task — one per task per day. */
		flowLogs?: ReadonlyMap<number, number>;
		onflowopen?: (id: number, source: EditorSource) => void;
		/** Required, unlike the logging callbacks, for the reason `ondrainedit` is: a
		 *  reading is correctable on every day the list renders. */
		onflowedit: (id: number, source: EditorSource) => void;
		onflowclose?: (id: number) => void;
		onlogflow?: (id: number, minutes: number) => void;
		onflowdelete?: (id: number) => void;
		/** The 🪫 editors open on this list, by task. */
		drainDrafts?: Record<number, DrainDraft>;
		/** The viewed day's 🪫 ratings, by task — several per task is normal, since each
		 *  row is one session (MATH.md §8.7). */
		drainLogs?: ReadonlyMap<number, Persisted<DrainObservationRecord>[]>;
		ondrainopen?: (id: number, source: EditorSource) => void;
		ondrainclose?: (id: number) => void;
		ondrainsave?: (id: number, entry: { hours: number; mind: number; body: number }) => void;
		/** Required, unlike the logging callbacks: a rating stays correctable on every day
		 *  the list renders — see `task-row-shell.svelte`. */
		ondrainedit: (id: number, log: Persisted<DrainObservationRecord>) => void;
		ondraindelete: (id: number, recordId: number) => void;
		onupdate?: (id: number, changes: TaskEdit) => void;
	}

	let {
		suggestedTasks,
		runOrder,
		viewedDate,
		remainingDay = null,
		nextTaskTitle,
		form,
		ontoggle,
		onremove,
		flowDrafts = {},
		flowLogs,
		onflowopen,
		onflowedit,
		onflowclose,
		onlogflow,
		onflowdelete,
		drainDrafts = {},
		drainLogs,
		ondrainopen,
		ondrainclose,
		ondrainsave,
		ondrainedit,
		ondraindelete,
		onupdate,
	}: Props = $props();

	// The plan's two answers about a task, read as two groups: hours today, or none.
	// The funded group reads in its `#N` order so the sequence counts down the page;
	// the rest keep the priority order they arrive in, having no position at all.
	const funded = $derived(
		suggestedTasks
			.filter((task) => task.suggestedHours > 0)
			.sort((a, b) => (runOrder.get(a.id) ?? 0) - (runOrder.get(b.id) ?? 0)),
	);
	const unfunded = $derived(suggestedTasks.filter((task) => task.suggestedHours === 0));
	const isSplit = $derived(funded.length > 0 && unfunded.length > 0);
	// One group when the other is empty — every row is then in the same state.
	const listed = $derived(isSplit ? funded : [...funded, ...unfunded]);
</script>

{#snippet rows()}
	{@render taskRows(listed)}
{/snippet}

{#snippet unfundedRows()}
	{@render taskRows(unfunded)}
{/snippet}

{#snippet taskRows(group: SuggestedTask[])}
	{#each group as task (task.id)}
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
				remaining={remainingDay
					? {
							taskHours: remainingDay.hoursByTask.get(task.id) ?? 0,
							dayHours: remainingDay.remainingHours,
						}
					: undefined}
				runOrder={runOrder.get(task.id)}
				slideDay={getSlideDay(task.createdAt, viewedDate)}
				flowMinutes={flowLogs?.get(task.id)}
				mustDoToday={task.mustDoToday}
				{ontoggle}
				{onremove}
				flowDraft={flowDrafts[task.id] ?? null}
				{onflowopen}
				{onflowedit}
				{onflowclose}
				{onlogflow}
				{onflowdelete}
				drainDraft={drainDrafts[task.id] ?? null}
				drainLogs={drainLogs?.get(task.id) ?? []}
				{ondrainopen}
				{ondrainclose}
				{ondrainsave}
				{ondrainedit}
				{ondraindelete}
				{onupdate}
			/>
		</li>
	{/each}
{/snippet}

<!-- Built here and not in the page: this list is `/`'s alone, and the card beneath
     it is the Lab's too. -->
{#snippet heading()}
	{#if nextTaskTitle}
		<NextUpLine title={nextTaskTitle} />
	{/if}
{/snippet}

<TaskListCard
	{form}
	{heading}
	rows={suggestedTasks.length ? rows : null}
	split={isSplit
		? {
				firstLabel: m.list_group_sequence(),
				restLabel: m.list_group_unfunded(),
				rest: unfundedRows,
			}
		: undefined}
/>
