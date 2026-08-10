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

	/* Everything the two task rows say the same way: the frame and its hover surface,
	   the completion checkbox, the title, the three model inputs under it, the action
	   strip that appears on hover — ⚡, 🪫, ✎ and ✕, which mean the same thing on both
	   screens — and the editors that hang below it. ⚡ and 🪫 report rather than toggle:
	   an editor is on screen while the page holds a draft for this row (`EditorDraft`),
	   and ✎'s is the one that is this component's own. Each screen fills the slots from its
	   own reading of the task: `/` adds priority, T* and its allocation, the Lab adds
	   the schedule's hue and hours. That difference is the ONLY reason there are two
	   components; if the two readings ever converge, merge the callers rather than
	   adding a mode flag here.

	   Both measurements are on both rows because both models read both fits: ϕ (⚡)
	   feeds the Lab's own curves, and the α/λ₀/audit/carry-over readings all run off
	   🪫 hours, which used to be reachable only from `/energy` — so a user who never
	   opened the Lab calibrated nothing (ROADMAP item 11). Both are also READ back
	   here, and corrected here, which is what stopped the two screens each owning half
	   of one measurement's verbs (2026-08-10): ⚡ as a badge, 🪫 as one chip per rating,
	   and each editor drops what it opened on.

	   An action is present when its callback is — a read-only row passes no ✎ or ✕, and
	   a past day none of the LOGGING ones. Correcting is not one of those: a new
	   observation stamps the live clock's today and would misdate itself onto a day
	   being read, while a 🪫 correction carries no date at all.

	   Not an <li>: the list is what makes a row one (task-list.svelte, and the Lab
	   page's rows snippet), and task-list-card.svelte is where the rule between them is
	   drawn. No Tooltip.Provider either — the callers' snippets are full of tooltips,
	   so the provider has to be theirs, above this. */

	const ROW_ACTION_CLASS = buttonVariants({
		variant: 'ghost',
		size: 'icon-xs',
	});

	interface Props {
		title: string;
		completed: boolean;
		/** The task's definition, spelled the same on both screens. ✎ is what changes
		 *  them; they read here because a row that hides its inputs cannot explain the
		 *  hours beside it. */
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		/** Flagged as unmovable. Badged by the caller that reads it — but ✎ must
		 *  round-trip it rather than clear it, on both screens. */
		mustDoToday?: boolean;
		/** Whether ✎ offers the must-do flag. The Lab hides it: the flag is read by the
		 *  plan advisor, which is the main page's, so there it is a control with no
		 *  consequence on screen. The seed still carries the stored value through. */
		withMustDoToday?: boolean;
		ontoggle: () => void;
		/** The VIEWED day's ⚡ time-to-flow, when one is measured — the badge, and what the
		 *  editor opens on. The day's own observation, not a field on its session: that
		 *  is what makes a past one correctable (`SessionStore.flowMinutesOn`). */
		flowMinutes?: number;
		/** This row's open ⚡ editor, or null. The page owns it — see `EditorDraft`. */
		flowDraft?: EditorDraft | null;
		/** Absent → no ⚡ BUTTON, which is what a day nothing may be logged on passes: a
		 *  first measurement is today's only. */
		onflowopen?: (source: EditorSource) => void;
		/** Correct the reading — the badge's own action, offered on every day this row can
		 *  render, exactly like a 🪫 chip's. Absent → the badge reads without opening. */
		onflowedit?: () => void;
		onflowclose?: () => void;
		onlogflow?: (minutes: number) => void;
		/** Absent → the ⚡ editor cannot drop the measurement it opened on. */
		onflowdelete?: () => void;
		/** This row's open 🪫 editor, or null. The page owns it too. */
		drainDraft?: DrainDraft | null;
		/** Every 🪫 rating the viewed day holds for this task — never "the" rating: a task
		 *  worked in two sessions has two of them (MATH.md §8.7), so this is a list and
		 *  the row shows one chip each. */
		drainLogs?: Persisted<DrainObservationRecord>[];
		/** Absent → no 🪫 action, which is what a day nothing may be logged on passes. */
		ondrainopen?: (source: EditorSource) => void;
		ondrainclose?: () => void;
		ondrainsave?: (entry: { hours: number; mind: number; body: number }) => void;
		/** Correct one stored rating — the chip's own action. Required, unlike the logging
		 *  callbacks: a rating is correctable on every day this row can render, so there
		 *  is no caller that withholds it and no read-only chip to build for. */
		ondrainedit: (log: Persisted<DrainObservationRecord>) => void;
		/** Drop the session the 🪫 editor opened on. Required for the same reason. */
		ondraindelete: (recordId: number) => void;
		/** Absent → read-only row, which then has no ✎ at all. */
		onupdate?: (edit: TaskEdit) => void;
		/** Absent on a read-only row. */
		onremove?: () => void;
		/** Before the title, on its line: the nature and run-order badges on the main
		 *  page, the plan's hue in the Lab. */
		lead?: Snippet;
		/** The rest of the readings, after the three inputs. */
		meta?: Snippet;
		/** The right-hand column, before the actions: what the day gave the task. */
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

	// Inline task editor (✎): re-tune the task after it is added. It stacks with the
	// measurement editors rather than replacing them — they answer different questions,
	// and closing one to open another discarded a draft nobody asked to throw away.
	// Local, unlike the two measurement drafts: it neither outlives the row (the task it
	// edits is the row) nor opens from anywhere else.
	let editing = $state(false);

	// Completing a task is the one moment the user still knows both how long the ramp-up
	// took and how spent they are. `completed` is a prop, so this reads the value BEFORE
	// the parent flips it. Both questions are asked, off one predicate and one shape of
	// draft; the only difference is `measured` — ⚡ is one number per day, 🪫 one per
	// session, so an earlier rating silences the first and never the second (§18).
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

	// The strip stays put while any editor it opened is on screen. Without it it fades
	// out from under a form that is still being filled in — and the button that opened
	// it is how you close it again. A rated session used to pin it too, back when the
	// lit 🪫 was the only thing that said so; the chips say it at rest now, so a rating
	// no longer holds four buttons on screen for the rest of the day.
	const actionsPinned = $derived(flowDraft !== null || drainDraft !== null || editing);
</script>

<div
	class="group rounded-lg border border-transparent p-box-sm transition hover:border-line-soft hover:bg-surface-hover"
>
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

		<!-- The completed look dims the task's TITLE and nothing else: it used to sit on
		     the whole row in the Lab, which faded the 🪫 rating that only exists for a
		     finished session into looking disabled. It sat on this block until the
		     readings moved into the line below (2026-08-10) and inherited exactly that
		     fade — so it moved down one level. The whole meta line stays lit, not just
		     the chips: the readings share a flex row with P·M·E, and dimming half a line
		     reads as a rendering fault rather than a state. -->
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-text-xs" class:opacity-60={completed}>
				{@render lead?.()}
				<h3
					class:text-ty-silent={completed}
					class:line-through={completed}
					class="truncate text-sm font-medium text-ty-primary capitalize"
				>
					{title}
				</h3>
			</div>

			<div
				class="mt-text-2xs flex flex-wrap items-center gap-x-text-xs gap-y-text-3xs text-2xs text-ty-silent"
			>
				<Tooltip.Root>
					<Tooltip.Trigger class="cursor-help">
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
				{@render meta?.()}
				<!-- What the row has already measured, at rest: the strip of actions is
					     hover-revealed, so without this a logged session looks exactly like an
					     unlogged one. The shapes differ because the quantities do — ⚡ is one
					     number per day, so one badge; 🪫 is one per session (MATH.md §8.7), so one
					     chip per rating — but both are readings you can click into their own
					     editor, and both explain themselves through the row's tooltip rather than
					     a native title.
					     One rule for every reading: clicking the one the editor is already open on
					     CLOSES it, clicking another switches to it. ⚡ is that rule with a single
					     reading, which is why its badge reads as a plain toggle and opens the same
					     editor the ⚡ button does; a 🪫 chip is the only control that can say WHICH
					     session a correction means, so the switch arm only ever fires there.
					     Both readings correct on any day the row renders, and neither LOGS on any
					     but today — which is why the badge takes its own callback rather than the
					     button's: a past day passes the correction and withholds the log. -->

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

		<div class="flex shrink-0 items-center gap-grid-xs">
			{@render trailing?.()}
			<div
				class="flex items-center gap-grid-2xs transition-opacity {actionsPinned
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

				<!-- Deliberately NOT hidden on a completed task: finishing one is the
				     commonest way a session ends, and rating it is what the button is for.
				     It closes only the editor it OWNS — the one with no `recordId`, i.e. a new
				     session. Over a correction it opens a blank one instead, because "one more
				     session" is what this button means, and a button that sometimes closes a
				     chip's editor instead would answer for a reading it does not name. Either
				     way the amendment goes: the blank draft replaces it. The chip it belongs
				     to is what closes it. -->
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
					<Tooltip.Root>
						<Tooltip.Trigger
							class={cn(
								ROW_ACTION_CLASS,
								editing ? 'text-success' : 'text-ty-silent hover:text-success',
							)}
							onclick={() => (editing = !editing)}
							aria-label={m.task_edit_aria()}
						>
							<Pencil class="h-4 w-4" />
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>{m.task_edit_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}

				{#if onremove}
					<Tooltip.Root>
						<Tooltip.Trigger
							class={cn(ROW_ACTION_CLASS, 'text-ty-silent hover:text-danger')}
							onclick={onremove}
							aria-label={m.task_remove_aria()}
						>
							<X class="h-4 w-4" />
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>{m.task_remove_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}
			</div>
		</div>
	</div>

	<!-- The editors, under the row rather than inside its flex line: the strip has no
	     room for a label, and an unlabelled number field is what nobody understood. All
	     three stack, so completing a task can ask both measurements at once. -->
	<!-- Both keyed on the draft itself, which is what makes `seed` and `focusMinutes`
	     mean what they say: both are read at MOUNT, and the page can replace a draft
	     while its editor is open — a 🪫 chip re-seeds an already-open row with the
	     stored rating it stands for. Unkeyed, the 🪫 fields kept the old draft while
	     `recordId` switched the save path from "append a session" to "edit that record",
	     so ✓ overwrote a stored rating with whatever happened to be typed. Every opening
	     assigns a fresh object, so identity change is exactly "a new opening"; reading
	     the proxy's reference subscribes to no property, so typing cannot retrigger it. -->
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

	{#if editing && onupdate}
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
				editing = false;
			}}
			oncancel={() => (editing = false)}
		/>
	{/if}
</div>
