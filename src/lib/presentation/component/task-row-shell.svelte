<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Persisted, DrainObservationRecord, TaskImportance } from '$lib/business/type';
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import Pencil from '@lucide/svelte/icons/pencil';
	import X from '@lucide/svelte/icons/x';
	import DrainLogForm from '$lib/presentation/component/drain-log-form.svelte';
	import FlowLogForm from '$lib/presentation/component/flow-log-form.svelte';
	import TaskEditForm from '$lib/presentation/component/task-edit-form.svelte';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import { cn } from '$lib/presentation/utils';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import {
		completionPromptAction,
		type DrainDraft,
		type EditorDraft,
		type EditorSource,
	} from '$lib/presentation/utils/measurement-prompt';

	// Why: presentation/AGENTS.md, "R3 in the UI — the two task screens are one definition".

	/** A logged READING on the meta line. The recessed chip is what separates the two
	 *  readings from the two bare-glyph triggers that open their editors — "⚡ 🪫 2h Mind 0
	 *  Body 0 🪫" read as one run of glyphs while all four were bare. */
	const READING_CHIP_CLASS =
		'flex items-center gap-text-xs rounded-sm bg-surface-inset px-box-3xs py-text-3xs whitespace-nowrap tabular-nums';

	interface Props {
		title: string;
		completed: boolean;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		mustDoToday?: boolean;
		importance?: TaskImportance;
		/** Not badged on a row — the ✎ editor must round-trip them rather than clear them. */
		tags?: string[];
		/** The user's past tags, for the ✎ editor's tag field. Data, like `tags`
		 *  itself: it switches nothing, and the page that has the vocabulary is the
		 *  only one that can hand it down. */
		tagVocabulary?: string[];
		/** Whether the ✎ editor offers the must-do checkbox. The one carve-out from "no
		 *  mode flag on the shell" — presentation/AGENTS.md says which reading it is and
		 *  why the seeded value still round-trips. Same name all the way down. */
		withMustDoToday?: boolean;
		ontoggle: () => void;
		flowMinutes?: number;
		flowDraft?: EditorDraft | null;
		/** Why two ⚡ callbacks, and why 🪫's corrections are required: presentation/AGENTS.md,
		 *  "Both writers are offered on any day up to today, the timer only today". */
		onflowopen?: (source: EditorSource) => void;
		onflowedit: () => void;
		onflowclose: () => void;
		onlogflow: (minutes: number) => void;
		onflowdelete: () => void;
		drainDraft?: DrainDraft | null;
		drainLogs?: Persisted<DrainObservationRecord>[];
		ondrainopen?: (source: EditorSource) => void;
		ondrainclose: () => void;
		ondrainsave: (entry: { hours: number; mind: number; body: number }) => void;
		ondrainedit: (log: Persisted<DrainObservationRecord>) => void;
		ondraindelete: (recordId: number) => void;
		onupdate?: (edit: TaskEdit) => void;
		onremove?: () => void;
		/** The row's leading mark — `/`'s `#N`, the Lab's hue. */
		lead?: Snippet;
		badges?: Snippet;
		/** What the screen's own model derived, on the meta line beside the three ratings,
		 *  and required: a row that derives nothing from the sliders is not a row either
		 *  screen has. */
		readings: Snippet;
		/** One more of the screen's own readings, after `readings` on the meta line. */
		meta?: Snippet;
		/** The hours the optimizer planned, at the right edge of the title's line — the one
		 *  reading both screens put in the same place. */
		planned?: Snippet;
		/** The row's third line, under both columns — `/`'s rail on the day's hour scale. */
		rail?: Snippet;
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
		tags = [],
		tagVocabulary = [],
		withMustDoToday = true,
		ontoggle,
		flowMinutes,
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
		onremove,
		lead,
		badges,
		readings,
		meta,
		planned,
		rail,
		class: className,
	}: Props = $props();

	const id = $props.id();

	// Local, unlike the two measurement drafts: the task it edits is the row, and nothing
	// else opens it.
	let isEditing = $state(false);

	const hasFlowReading = $derived(flowMinutes !== undefined);

	// `completed` is a prop, read BEFORE the parent flips it.
	function onCompletionChange() {
		const flowAction = completionPromptAction({
			finishing: !completed,
			measured: hasFlowReading,
			editorOpenOnThisRow: flowDraft !== null,
			promptOpenForThisTask: flowDraft?.promptedByCompletion ?? false,
		});

		const drainAction = completionPromptAction({
			finishing: !completed,
			measured: drainLogs.length > 0,
			editorOpenOnThisRow: drainDraft !== null,
			promptOpenForThisTask: drainDraft?.promptedByCompletion ?? false,
		});

		ontoggle();

		if (flowAction === 'open') onflowopen?.('completion');

		if (flowAction === 'withdraw') onflowclose();

		if (drainAction === 'open') ondrainopen?.('completion');

		if (drainAction === 'withdraw') ondrainclose();
	}

	const hasLogged = $derived(hasFlowReading || drainLogs.length > 0);
	// With none of the four passed, an empty box would take the right end of the line
	// the hours are meant to hold.
	const hasControls = $derived(Boolean(onflowopen || ondrainopen || onupdate || onremove));
</script>

<li
	class={cn('rounded-lg px-box-2xs py-box-xs text-sm transition hover:bg-surface-hover', className)}
>
	<!-- Two columns from `sm`: everything the task IS stacks on the left, and what today
	     gave it holds the whole right edge — one block, full height, so the hours never
	     sit above a second right-hand reading. Stacked in DOM order, so a phone reads
	     title, readings, logs, then the controls. -->
	<div class="flex flex-col gap-x-grid-md gap-y-text-2xs sm:flex-row sm:items-center">
		<div class="min-w-0 flex-1 space-y-text-2xs">
			<div class="flex flex-wrap items-center gap-x-grid-xs gap-y-text-2xs">
				{@render lead?.()}

				<input
					id="{id}-done"
					type="checkbox"
					checked={completed}
					onchange={onCompletionChange}
					aria-label={m.task_toggle_aria({
						title,
					})}
					class="h-4 w-4 shrink-0 cursor-pointer appearance-auto accent-brand focus:ring-2 focus:ring-brand-line"
				/>

				<!-- The dim covers the title and its badges only: the logs beside them are the 🪫
		     rating a finished session exists for, and a faded reading reads as disabled. -->
				<div class="flex min-w-0 flex-wrap items-center gap-text-xs" class:opacity-60={completed}>
					<h3
						class={cn(
							'font-medium wrap-break-word capitalize',
							completed ? 'text-ty-silent line-through' : 'text-ty-primary',
						)}
					>
						{title}
					</h3>
					{@render badges?.()}
				</div>
			</div>

			<!-- The meta line: what the task IS and what the two instruments recorded of it,
			     one line under the title. The READINGS half is dropped on a phone — eight
			     figures at `text-2xs` wrap to three lines there and bury the plan's own
			     answer, and ✎ still opens all three sliders — so with nothing logged the
			     line goes with it rather than leaving a gap.
			     `text-left` on the triggers: a trigger is a <button>, whose UA `text-align`
			     centres a wrapped last line. -->
			<div
				class={cn(
					'flex flex-wrap items-center gap-x-text-xs gap-y-text-3xs text-2xs text-ty-silent',
					!hasLogged && 'hidden sm:flex',
				)}
			>
				<div class="hidden flex-wrap items-center gap-x-text-xs gap-y-text-3xs sm:flex">
					<Tooltip.Root>
						<Tooltip.Trigger class="cursor-help text-left">
							<!-- body/mind/brand are how every other reading of the same three names is
				     written (`drain-log-form`, `log-history-list`). -->
							<span class="font-medium text-body">P {physicalDifficulty}</span>
							<span class="text-ty-ghost">·</span>
							<span class="font-medium text-mind">M {mentalDifficulty}</span>
							<span class="text-ty-ghost">·</span>
							<span class="font-medium text-brand">E {enjoyment}</span>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>{m.task_inputs_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
					<span class="text-ty-ghost">|</span>
					{@render readings()}
					{@render meta?.()}
				</div>

				{#if hasFlowReading}
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									type="button"
									onclick={() => (flowDraft ? onflowclose() : onflowedit())}
									aria-label={m.task_edit_flow_log_aria()}
									class={cn(
										READING_CHIP_CLASS,
										'font-medium text-flow transition hover:text-ty-primary',
									)}
								>
									⚡ {flowMinutes}m
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>{m.task_flow_badge_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}

				{#each drainLogs as log (log.id)}
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									type="button"
									onclick={() =>
										drainDraft?.recordId === log.id ? ondrainclose() : ondrainedit(log)}
									aria-label={m.energy_edit_drain_log_aria()}
									class={cn(READING_CHIP_CLASS, 'transition hover:text-ty-primary')}
								>
									<span class="text-flow">🪫</span>
									<span>{formatDuration(log.hours)}</span>
									<!-- Worded, not `M6`/`B4`: two bare initials beside a duration read as a code
							     rather than as two ratings, and both words are already localized for the
							     editor's own fields. -->
									<span class="font-medium text-mind">
										{m.energy_drain_mind_label()}
										{log.mindDrain}
									</span>
									<span class="font-medium text-body">
										{m.energy_drain_body_label()}
										{log.bodyDrain}
									</span>
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>{m.energy_edit_drain_log_title()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				{/each}
			</div>
		</div>

		<!-- The plan's hours and the four controls: the row's whole right edge from `sm`,
		     and its own line under the title below it — where the two take opposite ends,
		     since the hours are a reading and the controls are the thumb's target. -->
		<div class="flex items-center justify-between gap-grid-2xs sm:justify-end">
			{@render planned?.()}

			{#if hasControls}
				<div class="flex items-center gap-grid-2xs">
					{#if onflowopen}
						<Tooltip.Root>
							<Tooltip.Trigger
								class={cn(
									'row-action',
									flowMinutes || flowDraft ? 'text-flow' : 'text-ty-silent hover:text-flow',
								)}
								onclick={() => (flowDraft ? onflowclose() : onflowopen('button'))}
								aria-label={m.task_log_flow_aria()}
							>
								⚡
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p>{m.task_log_flow_tooltip()}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}

					<!-- Why the `recordId === undefined` arm: presentation/AGENTS.md, "One click rule
			     covers both instruments" — 🪫 owns only the append editor. -->
					{#if ondrainopen}
						<Tooltip.Root>
							<Tooltip.Trigger
								class={cn(
									'row-action',
									drainLogs.length > 0 || drainDraft
										? 'text-flow'
										: 'text-ty-silent hover:text-flow',
								)}
								onclick={() =>
									drainDraft && drainDraft.recordId === undefined
										? ondrainclose()
										: ondrainopen('button')}
								aria-label={m.energy_log_drain_aria()}
							>
								🪫
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p>{m.energy_log_drain_tooltip()}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}

					{#if onupdate}
						<button
							type="button"
							class={cn(
								'row-action',
								isEditing ? 'text-success' : 'text-ty-silent hover:text-success',
							)}
							onclick={() => (isEditing = !isEditing)}
							aria-label={m.task_edit_aria()}
						>
							<Pencil />
						</button>
					{/if}

					{#if onremove}
						<button
							type="button"
							class="row-action text-ty-silent hover:text-danger"
							onclick={onremove}
							aria-label={m.task_remove_aria()}
						>
							<X />
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	{@render rail?.()}

	<!-- Both keyed on the draft: `seed`/`focusMinutes` are read at MOUNT and the page can
	     swap a draft while its editor is open — unkeyed, ✓ overwrote a stored rating. -->
	{#if flowDraft}
		{#key flowDraft}
			<FlowLogForm
				seed={flowMinutes ?? null}
				focusMinutes={flowDraft.focusMinutes}
				onsave={onlogflow}
				oncancel={onflowclose}
				ondelete={hasFlowReading ? onflowdelete : undefined}
			/>
		{/key}
	{/if}

	{#if drainDraft}
		{#key drainDraft}
			{@const recordId = drainDraft.recordId}
			<DrainLogForm
				seed={drainDraft}
				focusMinutes={drainDraft.focusMinutes}
				onsave={ondrainsave}
				oncancel={ondrainclose}
				ondelete={recordId === undefined ? undefined : () => ondraindelete(recordId)}
			/>
		{/key}
	{/if}

	{#if isEditing && onupdate}
		<TaskEditForm
			{tagVocabulary}
			seed={{
				title,
				physicalDifficulty,
				mentalDifficulty,
				enjoyment,
				mustDoToday,
				importance,
				tags,
			}}
			{withMustDoToday}
			onsave={(edit) => {
				onupdate(edit);
				isEditing = false;
			}}
			oncancel={() => (isEditing = false)}
		/>
	{/if}
</li>
