<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import * as m from '$lib/paraglide/messages.js';
	import { buttonVariants } from '$lib/presentation/component/ui/button';
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

	const ROW_ACTION_CLASS = buttonVariants({
		variant: 'ghost',
		size: 'icon-xs',
	});

	interface Props {
		title: string;
		completed: boolean;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		mustDoToday?: boolean;
		withMustDoToday?: boolean;
		ontoggle: () => void;
		flowMinutes?: number;
		flowDraft?: EditorDraft | null;
		/** Why two ⚡ callbacks, and why 🪫's corrections are required: presentation/AGENTS.md,
		 *  "Both corrections are offered on any day the page shows". */
		onflowopen?: (source: EditorSource) => void;
		onflowedit?: () => void;
		onflowclose?: () => void;
		onlogflow?: (minutes: number) => void;
		onflowdelete?: () => void;
		drainDraft?: DrainDraft | null;
		drainLogs?: Persisted<DrainObservationRecord>[];
		ondrainopen?: (source: EditorSource) => void;
		ondrainclose?: () => void;
		ondrainsave?: (entry: { hours: number; mind: number; body: number }) => void;
		ondrainedit: (log: Persisted<DrainObservationRecord>) => void;
		ondraindelete: (recordId: number) => void;
		onupdate?: (edit: TaskEdit) => void;
		onremove?: () => void;
		lead?: Snippet;
		meta?: Snippet;
		trailing?: Snippet;
	}

	let {
		title,
		completed,
		physicalDifficulty,
		mentalDifficulty,
		enjoyment,
		mustDoToday = false,
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
		meta,
		trailing,
	}: Props = $props();

	// Local, unlike the two measurement drafts: the task it edits is the row, and nothing
	// else opens it.
	let isEditing = $state(false);

	// `completed` is a prop, read BEFORE the parent flips it. `measured: false` for 🪫:
	// a rating is per session, so an earlier one never silences the next prompt (§18).
	function onCompletionChange() {
		const flowAction = completionPromptAction({
			finishing: !completed,
			measured: Boolean(flowMinutes),
			editorOpenOnThisRow: flowDraft !== null,
			promptOpenForThisTask: flowDraft?.promptedByCompletion ?? false,
		});

		const drainAction = completionPromptAction({
			finishing: !completed,
			measured: false,
			editorOpenOnThisRow: drainDraft !== null,
			promptOpenForThisTask: drainDraft?.promptedByCompletion ?? false,
		});

		ontoggle();

		if (flowAction === 'open') onflowopen?.('completion');

		if (flowAction === 'withdraw') onflowclose?.();

		if (drainAction === 'open') ondrainopen?.('completion');

		if (drainAction === 'withdraw') ondrainclose?.();
	}

	// The strip stays put while an editor it opened is on screen: otherwise it fades out
	// from under a form still being filled in, and its button is how you close it again.
	const actionsPinned = $derived(flowDraft !== null || drainDraft !== null || isEditing);
</script>

<div
	class="group rounded-lg border border-transparent p-box-sm transition hover:border-line-soft hover:bg-surface-hover"
>
	<!-- The checkbox goes into a flex WITH the task rather than being a block of its own,
	     or stacking would put it on a line above the title it ticks. -->
	<div class="sm:flex sm:items-start sm:gap-grid-xs">
		<div class="flex items-start gap-grid-xs sm:min-w-0 sm:flex-1">
			<input
				type="checkbox"
				checked={completed}
				onchange={onCompletionChange}
				aria-label={m.task_toggle_aria({
					title,
				})}
				class="mt-text-3xs h-4 w-4 cursor-pointer appearance-auto accent-brand focus:ring-2 focus:ring-brand/40"
			/>

			<!-- The dim is on the title line only: the meta line below holds the 🪫 rating a
			     finished session exists for, and a faded reading reads as disabled. -->
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-text-xs" class:opacity-60={completed}>
					{@render lead?.()}
					<!-- Truncates from `sm` up only: below it the title has the whole row to
					     wrap into. -->
					<h3
						class:text-ty-silent={completed}
						class:line-through={completed}
						class="min-w-0 text-sm font-medium wrap-break-word text-ty-primary capitalize sm:truncate"
					>
						{title}
					</h3>
				</div>

				<div
					class="mt-text-2xs flex flex-wrap items-center gap-x-text-xs gap-y-text-3xs text-2xs text-ty-silent"
				>
					<Tooltip.Root>
						<Tooltip.Trigger class="cursor-help text-left">
							<span class="font-medium text-body/80">P {physicalDifficulty}</span>
							<span class="text-ty-ghost">·</span>
							<span class="font-medium text-mind/80">M {mentalDifficulty}</span>
							<span class="text-ty-ghost">·</span>
							<span class="font-medium text-brand/80">E {enjoyment}</span>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>{m.task_inputs_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
					<!-- `text-left` on every trigger, here and in `meta`: a trigger is a <button>,
					     whose UA `text-align` is center, so a wrapped reading centres its last line. -->
					{@render meta?.()}

					{#if flowMinutes}
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									{#if onflowedit}
										<button
											{...props}
											type="button"
											onclick={() => (flowDraft ? onflowclose?.() : onflowedit())}
											aria-label={m.task_edit_flow_log_aria()}
											class="font-medium text-flow transition hover:text-ty-primary"
										>
											⚡ {flowMinutes}m
										</button>
									{:else}
										<span {...props} class="cursor-help font-medium text-flow">
											⚡ {flowMinutes}m
										</span>
									{/if}
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
											drainDraft?.recordId === log.id ? ondrainclose?.() : ondrainedit(log)}
										aria-label={m.energy_edit_drain_log_aria()}
										class="flex items-center gap-text-3xs tabular-nums transition hover:text-ty-primary"
									>
										<span class="text-flow">🪫</span>
										<span>{formatDuration(log.hours)}</span>
										<span class="font-medium text-mind/90">M{log.mindDrain}</span>
										<span class="font-medium text-body/90">B{log.bodyDrain}</span>
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
		</div>

		<!-- `ml-auto` and not `justify-between`: `trailing` is absent on a completed task,
		     and the strip belongs at the right edge either way. -->
		<div class="mt-text-2xs flex items-center gap-grid-xs sm:mt-0 sm:shrink-0">
			{@render trailing?.()}
			<div
				class="ml-auto flex items-center gap-grid-2xs transition-opacity {actionsPinned
					? 'opacity-100'
					: 'hover-reveal'}"
			>
				{#if onflowopen}
					<Tooltip.Root>
						<Tooltip.Trigger
							class={cn(
								ROW_ACTION_CLASS,
								flowMinutes || flowDraft ? 'text-flow' : 'text-ty-silent hover:text-flow',
							)}
							onclick={() => (flowDraft ? onflowclose?.() : onflowopen('button'))}
							aria-label={m.task_log_flow_aria()}
						>
							⚡
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>{m.task_log_flow_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}

				<!-- Why the `recordId === undefined` arm: presentation/AGENTS.md, "One click
				     rule covers the whole strip" — 🪫 owns only the append editor. -->
				{#if ondrainopen}
					<Tooltip.Root>
						<Tooltip.Trigger
							class={cn(
								ROW_ACTION_CLASS,
								drainLogs.length > 0 || drainDraft ? 'text-flow' : 'text-ty-silent hover:text-flow',
							)}
							onclick={() =>
								drainDraft && drainDraft.recordId === undefined
									? ondrainclose?.()
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
							ROW_ACTION_CLASS,
							isEditing ? 'text-success' : 'text-ty-silent hover:text-success',
						)}
						onclick={() => (isEditing = !isEditing)}
						aria-label={m.task_edit_aria()}
					>
						<Pencil class="h-4 w-4" />
					</button>
				{/if}

				{#if onremove}
					<button
						type="button"
						class={cn(ROW_ACTION_CLASS, 'text-ty-silent hover:text-danger')}
						onclick={onremove}
						aria-label={m.task_remove_aria()}
					>
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Both keyed on the draft: `seed`/`focusMinutes` are read at MOUNT and the page can
	     swap a draft while its editor is open — unkeyed, ✓ overwrote a stored rating. -->
	{#if flowDraft && onlogflow}
		{#key flowDraft}
			<FlowLogForm
				seed={flowMinutes ?? null}
				focusMinutes={flowDraft.focusMinutes}
				onsave={onlogflow}
				oncancel={() => onflowclose?.()}
				ondelete={onflowdelete}
			/>
		{/key}
	{/if}

	{#if drainDraft && ondrainsave}
		{#key drainDraft}
			{@const recordId = drainDraft.recordId}
			<DrainLogForm
				seed={drainDraft}
				focusMinutes={drainDraft.focusMinutes}
				onsave={ondrainsave}
				oncancel={() => ondrainclose?.()}
				ondelete={recordId === undefined ? undefined : () => ondraindelete(recordId)}
			/>
		{/key}
	{/if}

	{#if isEditing && onupdate}
		<TaskEditForm
			seed={{
				title,
				physicalDifficulty,
				mentalDifficulty,
				enjoyment,
				mustDoToday,
			}}
			showMustDoToday={withMustDoToday}
			onsave={(edit) => {
				onupdate(edit);
				isEditing = false;
			}}
			oncancel={() => (isEditing = false)}
		/>
	{/if}
</div>
