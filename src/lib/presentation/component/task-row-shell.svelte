<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { buttonVariants } from '$lib/presentation/component/ui/button';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import Pencil from '@lucide/svelte/icons/pencil';
	import X from '@lucide/svelte/icons/x';
	import MeasurementFormActions from '$lib/presentation/component/measurement-form-actions.svelte';
	import DrainLogForm from '$lib/presentation/component/drain-log-form.svelte';
	import TaskEditForm from '$lib/presentation/component/task-edit-form.svelte';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import { cn } from '$lib/presentation/utils';
	import {
		completionPromptAction,
		MEASUREMENT_FORM_CLASS,
		MEASUREMENT_MINUTES_CLASS,
		type DrainDraft,
		type EditorSource,
	} from '$lib/presentation/utils/measurement-prompt';

	/* Everything the two task rows say the same way: the frame and its hover surface,
	   the completion checkbox, the title, the three model inputs under it, the action
	   strip that appears on hover — ⚡, 🪫, ✎ and ✕, which mean the same thing on both
	   screens — and the editors they open below. Each screen fills the slots from its
	   own reading of the task: `/` adds priority, T* and its allocation, the Lab adds
	   the schedule's hue and hours. That difference is the ONLY reason there are two
	   components; if the two readings ever converge, merge the callers rather than
	   adding a mode flag here.

	   Both measurements are on both rows because both models read both fits: ϕ (⚡)
	   feeds the Lab's own curves, and the α/λ₀/audit/carry-over readings all run off
	   🪫 hours, which used to be reachable only from `/energy` — so a user who never
	   opened the Lab calibrated nothing (ROADMAP item 11). An action is present when
	   its callback is: a past day passes neither, and a read-only row no ✎ or ✕.

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
		/** Today's ⚡ time-to-flow, when one is measured. */
		flowMinutes?: number;
		/** Absent → no ⚡ action. */
		onlogflow?: (minutes: number) => void;
		/** This row's open 🪫 editor, or null. The page owns it — see `DrainDraft`. */
		drainDraft?: DrainDraft | null;
		/** A 🪫 rating for this task exists for today. Never "the" rating: a task worked
		 *  in two sessions has two of them (MATH.md §8.7). */
		isDrainMeasured?: boolean;
		/** Absent → no 🪫 action. */
		ondrainopen?: (source: EditorSource) => void;
		ondrainclose?: () => void;
		ondrainsave?: (entry: { hours: number; mind: number; body: number }) => void;
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
		onlogflow,
		drainDraft = null,
		isDrainMeasured = false,
		ondrainopen,
		ondrainclose,
		ondrainsave,
		onupdate,
		onremove,
		lead,
		meta,
		trailing,
	}: Props = $props();

	// Inline "log time-to-flow" editor (⚡): feeds the c₁,c₂,c₃ personalization. Local,
	// unlike the 🪫 draft: nothing outside the row opens one.
	let loggingFlow = $state(false);
	let flowMinutesInput = $state<number | null>(null);
	// How the editor was opened, which decides two things. The caret: auto-opening must
	// not move it, or ticking tasks off with the keyboard lands it in a number field
	// nobody asked for. And the close: un-completing withdraws a question completion
	// asked, but must not discard an editor the user opened. Focus cannot be an
	// `autofocus` attribute — the document's autofocus-processed flag is set at load, so
	// it is inert on any node inserted afterwards, which is every editor in this app.
	// Only meaningful while `loggingFlow`; every read is gated on it.
	let flowSource = $state<EditorSource>('button');

	// Inline task editor (✎): re-tune the task after it is added. It stacks with the
	// measurement editors rather than replacing them — they answer different questions,
	// and closing one to open another discarded a draft nobody asked to throw away.
	let editing = $state(false);

	function openFlowLog(source: EditorSource) {
		flowMinutesInput = flowMinutes ?? null;
		flowSource = source;
		loggingFlow = true;
	}

	// Completing a task is the one moment the user still knows both how long the ramp-up
	// took and how spent they are. `completed` is a prop, so this reads the value BEFORE
	// the parent flips it. Both questions are asked; each keeps its own policy, and the
	// only difference is `measured` — ⚡ is one number per day, 🪫 one per session, so an
	// earlier rating silences the first and never the second (MATH.md §18).
	function onCompletionChange() {
		const flowAction = completionPromptAction({
			finishing: !completed,
			measured: Boolean(flowMinutes),
			editorOpenOnThisRow: loggingFlow,
			promptOpenForThisTask: loggingFlow && flowSource === 'completion',
		});

		const drainAction = completionPromptAction({
			finishing: !completed,
			measured: false,
			editorOpenOnThisRow: drainDraft !== null,
			promptOpenForThisTask: drainDraft?.promptedByCompletion ?? false,
		});

		ontoggle();

		if (flowAction === 'open' && onlogflow) openFlowLog('completion');

		if (flowAction === 'withdraw') loggingFlow = false;

		if (drainAction === 'open') ondrainopen?.('completion');

		if (drainAction === 'withdraw') ondrainclose?.();
	}

	function saveFlowLog() {
		const minutes = Number(flowMinutesInput);

		if (!minutes || minutes <= 0 || !onlogflow) return;

		onlogflow(minutes);
		loggingFlow = false;
	}

	// The strip stays put while any editor it opened is on screen. Without it it fades
	// out from under a form that is still being filled in — and the button that opened
	// it is how you close it again. A 🪫 rating pins it for a different reason: it is the
	// one measurement no row badges, so the lit button is the only thing that says the
	// session was rated, and a hover-revealed one says it to nobody.
	const actionsPinned = $derived(loggingFlow || drainDraft !== null || editing || isDrainMeasured);
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

		<!-- The completed look dims the task's own identity and nothing else: it used to
		     sit on the whole row in the Lab, which faded the 🪫 rating that only exists
		     for a finished session into looking disabled. -->
		<div class="min-w-0 flex-1" class:opacity-60={completed}>
			<div class="flex flex-wrap items-center gap-text-xs">
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
				<!-- What the row has already measured, at rest: the strip is hover-revealed,
					     so without this a logged session looks exactly like an unlogged one. ⚡
					     reads as a badge because it is one number per day; 🪫 cannot — a task
					     worked twice has two ratings (MATH.md §8.7) — so it pins the strip
					     instead and the lit 🪫 is what says so. -->
				{#if flowMinutes}
					<Tooltip.Root>
						<Tooltip.Trigger class="cursor-help font-medium text-flow">
							⚡ {flowMinutes}m
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>{m.task_flow_badge_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}
			</div>
		</div>

		<div class="flex shrink-0 items-center gap-grid-xs">
			{@render trailing?.()}
			<div
				class="flex items-center gap-grid-2xs transition-opacity {actionsPinned
					? 'opacity-100'
					: 'hover-reveal'}"
			>
				{#if onlogflow}
					<Tooltip.Root>
						<Tooltip.Trigger
							class={cn(
								ROW_ACTION_CLASS,
								flowMinutes || loggingFlow ? 'text-flow' : 'text-ty-silent hover:text-flow',
							)}
							onclick={() => (loggingFlow ? (loggingFlow = false) : openFlowLog('button'))}
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
				     commonest way a session ends, and rating it is what the button is for. -->
				{#if ondrainopen}
					<Tooltip.Root>
						<Tooltip.Trigger
							class={cn(
								ROW_ACTION_CLASS,
								isDrainMeasured || drainDraft ? 'text-flow' : 'text-ty-silent hover:text-flow',
							)}
							onclick={() => (drainDraft ? ondrainclose?.() : ondrainopen('button'))}
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
	{#if loggingFlow && onlogflow}
		<form class={MEASUREMENT_FORM_CLASS} onsubmit={(e) => (e.preventDefault(), saveFlowLog())}>
			<label class="flex items-center gap-grid-2xs">
				<span class="text-ty-secondary">{m.task_flow_form_title()}</span>
				<input
					type="number"
					min="1"
					max="960"
					placeholder={m.task_minutes_placeholder()}
					{@attach (node) => {
						if (flowSource === 'button') node.focus();
					}}
					bind:value={flowMinutesInput}
					required
					class={MEASUREMENT_MINUTES_CLASS}
				/>
			</label>
			<MeasurementFormActions oncancel={() => (loggingFlow = false)} />
		</form>
	{/if}

	<!-- Keyed on the draft itself, which is what makes `seed` and `focusMinutes` mean
	     what they say: both are read at MOUNT, and the page can replace a draft while
	     its editor is open — the Lab's calibration card ✎ re-seeds an already-open row
	     with a stored rating. Unkeyed, the fields kept the old draft while `recordId`
	     switched the save path from "append a session" to "edit that record", so ✓
	     overwrote a stored rating with whatever happened to be typed. Every opening
	     assigns a fresh object, so identity change is exactly "a new opening"; reading
	     the proxy's reference subscribes to no property, so typing cannot retrigger it. -->
	{#if drainDraft && ondrainsave}
		{#key drainDraft}
			<DrainLogForm
				seed={drainDraft}
				focusMinutes={drainDraft.focusMinutes}
				onsave={ondrainsave}
				oncancel={() => ondrainclose?.()}
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
