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

	/** A logged READING in the `Logged` cell. The recessed chip is what separates the two
	 *  readings from the two bare-glyph triggers beside them: ⚡ and 🪫 open an editor, and
	 *  "⚡ 🪫 2h Mind 0 Body 0 🪫" read as one run of glyphs while all four were bare. */
	const READING_CHIP_CLASS =
		'flex items-center gap-text-xs rounded-sm bg-surface-inset px-box-3xs py-text-3xs whitespace-nowrap tabular-nums';

	interface Props {
		title: string;
		completed: boolean;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		mustDoToday?: boolean;
		/** Whether the ✎ editor offers the must-do checkbox. The one carve-out from "no
		 *  mode flag on the shell" — presentation/AGENTS.md says which reading it is and
		 *  why the seeded value still round-trips. Same name all the way down. */
		withMustDoToday?: boolean;
		/** How wide the caller's table is, for the editors' spanning row. Not a mode flag:
		 *  it switches no behaviour, and each caller owns its own column list. */
		columnCount: number;
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
		badges?: Snippet;
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
		columnCount,
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
		meta,
		trailing,
	}: Props = $props();

	// Local, unlike the two measurement drafts: the task it edits is the row, and nothing
	// else opens it.
	let isEditing = $state(false);

	// `completed` is a prop, read BEFORE the parent flips it. `measured: false` for 🪫:
	// a rating is per session, so an earlier one never silences the next prompt.
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

	const hasEditor = $derived(flowDraft !== null || drainDraft !== null || isEditing);
</script>

<tbody class="text-sm">
	<!-- `group`, because the two pinned cells paint their own opaque fill and so hide the
	     row's hover — `ledger-pin` re-reads it from here. -->
	<tr class="group transition hover:bg-surface-hover">
		<td class="ledger-cell ledger-pin">{@render lead?.()}</td>

		<!-- The one flexible-width column, so the checkbox goes in a flex WITH the title
		     rather than a cell of its own, which would be a column of ticks. Pinned with
		     the lead: the task's name is what a scrolled-out reading needs beside it. -->
		<td class="ledger-cell ledger-pin sm:min-w-48">
			<div class="flex items-start gap-grid-xs">
				<input
					type="checkbox"
					checked={completed}
					onchange={onCompletionChange}
					aria-label={m.task_toggle_aria({
						title,
					})}
					class="mt-text-3xs h-4 w-4 cursor-pointer appearance-auto accent-brand focus:ring-2 focus:ring-brand/40"
				/>

				<!-- The dim covers the title and its badges only: the `Logged` cell holds the
				     🪫 rating a finished session exists for, and a faded reading reads as
				     disabled. -->
				<div class="flex flex-wrap items-center gap-text-xs" class:opacity-60={completed}>
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
		</td>

		<!-- Bare numbers: the headed columns say what `P `/`M `/`E ` and a tooltip had to.
		     The hues stay, though — body/mind/brand are how every other reading of the same
		     three names is written (`drain-log-form`, `log-history-list`, `fit-row`). -->
		<td class="ledger-cell ledger-numeric ledger-wide text-body/80">{physicalDifficulty}</td>
		<td class="ledger-cell ledger-numeric ledger-wide text-mind/80">{mentalDifficulty}</td>
		<td class="ledger-cell ledger-numeric ledger-wide text-brand/80">{enjoyment}</td>

		{@render meta?.()}

		<td class="ledger-cell">
			<div class="flex flex-wrap items-center gap-x-text-xs gap-y-text-3xs text-2xs text-ty-silent">
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
										class={cn(
											READING_CHIP_CLASS,
											'font-medium text-flow transition hover:text-ty-primary',
										)}
									>
										⚡ {flowMinutes}m
									</button>
								{:else}
									<span
										{...props}
										class={cn(READING_CHIP_CLASS, 'cursor-help font-medium text-flow')}
									>
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
									class={cn(READING_CHIP_CLASS, 'transition hover:text-ty-primary')}
								>
									<span class="text-flow">🪫</span>
									<span>{formatDuration(log.hours)}</span>
									<!-- Worded, not `M6`/`B4`: two bare initials beside a duration read as a code
									     rather than as two ratings, and both words are already localized for the
									     editor's own fields. -->
									<span class="font-medium text-mind/90">
										{m.energy_drain_mind_label()}
										{log.mindDrain}
									</span>
									<span class="font-medium text-body/90">
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

				<!-- Why the `recordId === undefined` arm: presentation/AGENTS.md, "One click
				     rule covers the whole `Logged` cell" — 🪫 owns only the append editor. -->
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
			</div>
		</td>

		{@render trailing?.()}

		<td class="ledger-cell">
			<div class="flex items-center gap-grid-2xs">
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
		</td>
	</tr>

	{#if hasEditor}
		<tr>
			<td colspan={columnCount} class="ledger-cell">
				<!-- Both keyed on the draft: `seed`/`focusMinutes` are read at MOUNT and the page
				     can swap a draft while its editor is open — unkeyed, ✓ overwrote a stored
				     rating. -->
				{#if flowDraft && onlogflow}
					{#key flowDraft}
						<FlowLogForm
							seed={flowMinutes ?? null}
							focusMinutes={flowDraft.focusMinutes}
							onsave={onlogflow}
							oncancel={() => onflowclose?.()}
							ondelete={flowMinutes === undefined ? undefined : onflowdelete}
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
						{withMustDoToday}
						onsave={(edit) => {
							onupdate(edit);
							isEditing = false;
						}}
						oncancel={() => (isEditing = false)}
					/>
				{/if}
			</td>
		</tr>
	{/if}
</tbody>
