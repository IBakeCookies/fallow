<script module lang="ts">
	import type { Task } from '$lib/business/type';

	/** What the inline editor emits — the only task fields it can change. */
	export type TaskEdit = Pick<
		Task,
		'title' | 'physicalDifficulty' | 'mentalDifficulty' | 'enjoyment' | 'mustDoToday'
	>;
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button, buttonVariants } from '$lib/presentation/component/ui/button';
	import { Badge } from '$lib/presentation/component/ui/badge';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { cn } from '$lib/presentation/utils';
	import { natureBadge, type TaskNature } from '$lib/presentation/utils/task-nature';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import {
		completionPromptAction,
		MEASUREMENT_FORM_CLASS,
		MEASUREMENT_MINUTES_CLASS,
		type EditorSource,
	} from '$lib/presentation/utils/measurement-prompt';

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

	// Inline task editor (✎): re-tune the sliders after the task is added
	let editing = $state(false);
	let editDraft = $state({
		title: '',
		physicalDifficulty: 5,
		mentalDifficulty: 5,
		enjoyment: 5,
		mustDoToday: false,
	});

	const editSliders = [
		{
			key: 'physicalDifficulty',
			label: m.form_physical_difficulty(),
			min: 0,
			accent: 'accent-body',
		},
		{
			key: 'mentalDifficulty',
			label: m.form_mental_difficulty(),
			min: 0,
			accent: 'accent-mind',
		},
		{
			key: 'enjoyment',
			label: m.form_enjoyment(),
			min: 1,
			accent: 'accent-brand',
		},
	] as const;

	function openEdit() {
		editDraft = {
			title,
			physicalDifficulty,
			mentalDifficulty,
			enjoyment,
			mustDoToday,
		};

		loggingFlow = false;
		editing = true;
	}

	function saveEdit() {
		const nextTitle = editDraft.title.trim();

		if (!nextTitle || !onupdate) return;

		onupdate(id, {
			...editDraft,
			title: nextTitle,
		});

		editing = false;
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

<Tooltip.Provider delayDuration={150}>
	<div
		class="group rounded-lg border border-transparent bg-transparent p-box-sm transition hover:border-line-soft hover:bg-surface-hover"
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

			<div class="min-w-0 flex-1" class:opacity-60={completed}>
				<div class="flex flex-wrap items-center gap-text-xs">
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
								<Badge
									class="border-transparent bg-warning/20 uppercase tracking-wide text-warning"
								>
									{m.task_must_do_badge()}
								</Badge>
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p>{m.form_must_do_today_title()}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}
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
				</div>
			</div>

			<div class="flex shrink-0 items-center gap-grid-xs">
				{#if !completed}
					<Tooltip.Root>
						<!-- Spans, not divs: the trigger renders a <button>, whose content
						     model is phrasing content only. -->
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

				<div
					class="flex items-center gap-grid-2xs transition-opacity {editing || loggingFlow
						? 'opacity-100'
						: 'opacity-0 [@media(hover:none)]:opacity-100 focus-within:opacity-100 group-hover:opacity-100'}"
				>
					{#if onlogflow}
						<Tooltip.Root>
							<Tooltip.Trigger
								class={cn(
									buttonVariants({
										variant: 'ghost',
										size: 'icon-xs',
									}),
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

					{#if onupdate}
						<Tooltip.Root>
							<Tooltip.Trigger
								class={cn(
									buttonVariants({
										variant: 'ghost',
										size: 'icon-xs',
									}),
									editing ? 'text-success' : 'text-ty-silent hover:text-success',
								)}
								onclick={() => (editing ? (editing = false) : openEdit())}
								aria-label={m.task_edit_aria()}
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897l12.682-12.68z"
									/>
								</svg>
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p>{m.task_edit_tooltip()}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}

					{#if onremove}
						<Tooltip.Root>
							<Tooltip.Trigger
								class={cn(
									buttonVariants({
										variant: 'ghost',
										size: 'icon-xs',
									}),
									'text-ty-silent hover:text-danger',
								)}
								onclick={() => onremove(id)}
								aria-label={m.task_remove_aria()}
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p>{m.task_remove_tooltip()}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}
				</div>
			</div>
		</div>

		<!-- Its own row, not the action strip: the strip has no room for a label, and
		     an unlabelled number field is exactly what nobody understood. -->
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

		{#if editing}
			<form
				class="mt-text-sm ml-7 space-y-grid-md rounded-lg border bg-surface-page/40 p-box-md"
				onsubmit={(e) => (e.preventDefault(), saveEdit())}
			>
				<label class="block text-xs font-medium text-ty-secondary">
					{m.task_title_label()}
					<input
						type="text"
						bind:value={editDraft.title}
						required
						class="mt-text-xs w-full rounded-lg border border-line-strong bg-input px-box-sm py-box-2xs text-sm text-ty-primary placeholder:text-ty-silent outline-none transition focus:border-brand/50 focus:ring-1 focus:ring-brand/50"
					/>
				</label>

				<div class="grid gap-grid-md sm:grid-cols-3">
					{#each editSliders as slider (slider.key)}
						<!-- The wrapping label is what names the range input -->
						<label class="block space-y-text-xs">
							<span class="flex justify-between text-xs font-medium">
								<span class="text-ty-secondary">{slider.label}</span>
								<span class="text-ty-primary">{editDraft[slider.key]}</span>
							</span>
							<input
								type="range"
								min={slider.min}
								max="10"
								bind:value={editDraft[slider.key]}
								class="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-inset {slider.accent}"
							/>
						</label>
					{/each}
				</div>

				<div class="flex flex-wrap items-center justify-between gap-grid-xs">
					<label
						class="flex items-center gap-text-xs text-xs font-medium text-ty-secondary"
						title={m.form_must_do_today_title()}
					>
						<input
							type="checkbox"
							bind:checked={editDraft.mustDoToday}
							class="size-4 appearance-auto accent-brand"
						/>
						{m.form_must_do_today()}
					</label>
					<span class="flex items-center gap-grid-xs">
						<Button variant="ghost" size="xs" type="button" onclick={() => (editing = false)}>
							{m.common_cancel()}
						</Button>
						<Button size="xs" type="submit" disabled={!editDraft.title.trim()}>
							{m.common_save()}
						</Button>
					</span>
				</div>
			</form>
		{/if}
	</div>
</Tooltip.Provider>
