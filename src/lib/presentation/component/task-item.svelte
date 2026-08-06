<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/presentation/component/ui/button';
	import { Badge } from '$lib/presentation/component/ui/badge';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import TaskEditForm from '$lib/presentation/component/task-edit-form.svelte';
	import type { TaskEdit } from '$lib/presentation/component/task-form-fields.svelte';
	import TaskRowShell, {
		ROW_ACTION_CLASS,
	} from '$lib/presentation/component/task-row-shell.svelte';
	import { cn } from '$lib/presentation/utils';
	import { natureBadge, type TaskNature } from '$lib/presentation/utils/task-nature';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import {
		completionPromptAction,
		MEASUREMENT_FORM_CLASS,
		MEASUREMENT_MINUTES_CLASS,
		type EditorSource,
	} from '$lib/presentation/utils/measurement-prompt';

	/* The main page's reading of a task: what the allocator made of it — priority, its
	   share of the day, run order, T* — plus the ⚡ measurement that personalizes the
	   model. The row's frame, checkbox, title and action strip are task-row-shell's,
	   filled here; the Lab's row fills the same slots with the schedule's reading. */

	interface Props {
		id: number;
		title: string;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		/** Which system the task leans on — classified by the model, badged here. */
		nature: TaskNature;
		completed: boolean;
		priorityScore: number;
		suggestedHours: number;
		trueEffort: number;
		flowStateTime: number;
		// Per-task optimal stopping time T* from the allocator (model v2:
		// task-dependent — no longer reconstructable as a fixed 1.79 × ϕ)
		optimalStopHours: number;
		runOrder?: number;
		flowMinutes?: number;
		/** Flagged as unmovable, so the plan advisor never offers to defer it. */
		mustDoToday?: boolean;
		ontoggle: (id: number) => void;
		onremove?: (id: number) => void;
		onlogflow?: (id: number, minutes: number) => void;
		onupdate?: (id: number, changes: TaskEdit) => void;
	}

	let {
		id,
		title,
		physicalDifficulty,
		mentalDifficulty,
		enjoyment,
		nature,
		completed,
		priorityScore,
		suggestedHours,
		trueEffort,
		flowStateTime,
		optimalStopHours,
		runOrder,
		flowMinutes,
		mustDoToday = false,
		ontoggle,
		onremove,
		onlogflow,
		onupdate,
	}: Props = $props();

	// Inline "log time-to-flow" editor (⚡): feeds the c₁,c₂,c₃ personalization
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

	// Inline task editor (✎): re-tune the task after it is added. The fields are
	// task-edit-form.svelte's, shared with the Lab's row.
	let editing = $state(false);

	function openEdit() {
		loggingFlow = false;
		editing = true;
	}

	function openFlowLog(source: EditorSource) {
		flowMinutesInput = flowMinutes ?? null;
		editing = false;
		flowSource = source;
		loggingFlow = true;
	}

	// Completing a task is the one moment the user still knows how long the ramp-up
	// took. `completed` is a prop, so this reads the value BEFORE the parent flips it.
	// The ✎ editor counts as open: `openFlowLog` closes it, and its draft is not
	// persisted until Save.
	function onCompletionChange() {
		const action = completionPromptAction({
			finishing: !completed,
			measured: Boolean(flowMinutes),
			anyEditorOpen: loggingFlow || editing,
			promptOpenForThisTask: loggingFlow && flowSource === 'completion',
		});

		ontoggle(id);

		if (action === 'open' && onlogflow) openFlowLog('completion');

		if (action === 'withdraw') loggingFlow = false;
	}

	function saveFlowLog() {
		const minutes = Number(flowMinutesInput);

		if (!minutes || minutes <= 0 || !onlogflow) return;

		onlogflow(id, minutes);
		loggingFlow = false;
	}

	const badge = $derived(natureBadge(nature));
</script>

{#snippet lead()}
	{#if runOrder !== undefined && !completed}
		<Tooltip.Root>
			<Tooltip.Trigger
				class="cursor-help rounded-sm bg-flow/15 px-box-3xs py-text-3xs text-xs font-semibold text-flow"
			>
				#{runOrder}
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.task_run_order_tooltip()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
	<Tooltip.Root>
		<Tooltip.Trigger class="cursor-help">
			<Badge class="border-transparent uppercase tracking-wide {badge.class}">
				{badge.label}
			</Badge>
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>{badge.description}</p>
		</Tooltip.Content>
	</Tooltip.Root>
	{#if mustDoToday}
		<Tooltip.Root>
			<Tooltip.Trigger class="cursor-help">
				<Badge class="border-transparent bg-warning/20 uppercase tracking-wide text-warning">
					{m.task_must_do_badge()}
				</Badge>
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.form_must_do_today_title()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
{/snippet}

{#snippet meta()}
	<span class="text-ty-ghost">|</span>
	<Tooltip.Root>
		<Tooltip.Trigger class="cursor-help">
			{m.task_derived_values({
				effort: trueEffort.toFixed(1),
				flow: formatDuration(flowStateTime),
				stop: formatDuration(optimalStopHours),
			})}
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>{m.task_derived_tooltip()}</p>
		</Tooltip.Content>
	</Tooltip.Root>
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
{/snippet}

{#snippet trailing()}
	{#if !completed}
		<Tooltip.Root>
			<!-- Spans, not divs: the trigger renders a <button>, whose content model is
			     phrasing content only. -->
			<Tooltip.Trigger class="cursor-help text-right">
				<span class="block text-sm font-semibold text-ty-primary">
					{formatDuration(suggestedHours)}
				</span>
				<span class="block text-2xs text-ty-silent">
					{m.task_priority({
						score: priorityScore,
					})}
				</span>
			</Tooltip.Trigger>
			<Tooltip.Content>
				<p>{m.task_allocation_tooltip()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	{/if}
{/snippet}

<!-- The ⚡ measurement is this screen's own action; ✎ and ✕ are the shell's. -->
{#snippet actions()}
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
{/snippet}

{#snippet forms()}
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
			<span class="ml-auto flex items-center gap-grid-2xs">
				<Button variant="ghost" size="icon-xs" type="submit" class="text-flow">✓</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					type="button"
					onclick={() => (loggingFlow = false)}
					class="text-ty-silent"
				>
					✕
				</Button>
			</span>
		</form>
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
			onsave={(edit) => {
				onupdate(id, edit);
				editing = false;
			}}
			oncancel={() => (editing = false)}
		/>
	{/if}
{/snippet}

<Tooltip.Provider delayDuration={150}>
	<TaskRowShell
		{title}
		{completed}
		{physicalDifficulty}
		{mentalDifficulty}
		{enjoyment}
		ontoggle={onCompletionChange}
		{lead}
		{meta}
		{trailing}
		{actions}
		actionsPinned={loggingFlow}
		{editing}
		onedit={onupdate && (() => (editing ? (editing = false) : openEdit()))}
		onremove={onremove && (() => onremove(id))}
		{forms}
	/>
</Tooltip.Provider>
