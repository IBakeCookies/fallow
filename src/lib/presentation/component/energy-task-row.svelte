<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import DrainLogForm from '$lib/presentation/component/drain-log-form.svelte';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import type { Task } from '$lib/business/type';

	/* The Lab's task row: the three model inputs on live sliders, the hours the plan
	   gave the task, and the 🪫 rating for the session it ends. Deliberately NOT
	   task-item.svelte, which is the same object seen from the other screen — priority,
	   allocation, T*, a ✎ editor — and would need a variant flag to be both. What the
	   two genuinely share is exported: the measurement editors' policy and chrome. */

	const SLIDERS = [
		{
			key: 'physicalDifficulty',
			label: 'P',
			title: m.energy_slider_physical(),
			min: 0,
			accent: 'accent-body',
			color: 'text-body/80',
		},
		{
			key: 'mentalDifficulty',
			label: 'M',
			title: m.energy_slider_mental(),
			min: 0,
			accent: 'accent-mind',
			color: 'text-mind/80',
		},
		{
			key: 'enjoyment',
			label: 'E',
			title: m.energy_slider_enjoyment(),
			min: 1,
			accent: 'accent-brand',
			color: 'text-brand/80',
		},
	] as const;

	type SliderKey = (typeof SLIDERS)[number]['key'];

	interface Props {
		title: string;
		completed: boolean;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		/** The plan's colour for this task — the same hue the timeline gives its blocks. */
		color: string;
		/** What the plan gave the task. Null when there is no plan to report on: "no
		 *  hours" against every task would be a claim the optimizer never made. */
		plannedHours: number | null;
		/** A 🪫 rating for this task exists for today. */
		measured: boolean;
		/** The open 🪫 editor's draft, or null when it is closed. Owned by the page: it
		 *  is one editor for the whole list, and the completion prompt refuses to open
		 *  over any of them — see `completionPromptAction`. */
		drainDraft: {
			minutes: number | null;
			mind: number | null;
			body: number | null;
		} | null;
		/** True only when this row's own 🪫 button opened the editor. */
		focusDrainMinutes: boolean;
		ontoggle: () => void;
		onremove: () => void;
		ondrainclick: () => void;
		onchange: (changes: Partial<Pick<Task, SliderKey>>) => void;
		ondrainsave: (entry: { hours: number; mind: number; body: number }) => void;
		ondraincancel: () => void;
	}

	let {
		title,
		completed,
		physicalDifficulty,
		mentalDifficulty,
		enjoyment,
		color,
		plannedHours,
		measured,
		drainDraft,
		focusDrainMinutes,
		ontoggle,
		onremove,
		ondrainclick,
		onchange,
		ondrainsave,
		ondraincancel,
	}: Props = $props();

	const values = $derived({
		physicalDifficulty,
		mentalDifficulty,
		enjoyment,
	});

	function setValue(key: SliderKey, value: number) {
		const changes: Partial<Pick<Task, SliderKey>> = {};
		changes[key] = value;
		onchange(changes);
	}
</script>

<!-- The completed look dims the task's own identity, never the whole row: it used to
     sit on the <li>, which faded the 🪫 rating that only exists for a finished session
     into looking disabled. Same split as task-item.svelte, which dims its title block
     alone. -->
<li class="group rounded-lg p-box-2xs transition hover:bg-surface-hover">
	<Tooltip.Provider delayDuration={150}>
		<div class="flex items-center gap-grid-xs">
			<input
				type="checkbox"
				checked={completed}
				onchange={ontoggle}
				aria-label={m.task_toggle_aria({
					title,
				})}
				class="h-4 w-4 cursor-pointer appearance-auto accent-brand focus:ring-2 focus:ring-brand/40"
			/>
			<span
				class="h-2.5 w-2.5 shrink-0 rounded-full"
				class:opacity-50={completed}
				style="background-color: {color}"
			></span>
			<span
				class:opacity-50={completed}
				class="min-w-0 flex-1 truncate text-sm font-medium capitalize {completed
					? 'text-ty-silent line-through'
					: 'text-ty-primary'}"
			>
				{title}
			</span>
			<!-- What the plan gave this task. The card invites you to drag a slider and
			     watch the schedule re-optimize, and until this was here the only place it
			     answered was the timeline — where a task funded zero says nothing at all. -->
			{#if plannedHours !== null}
				<span
					class="shrink-0 text-2xs tabular-nums {plannedHours
						? 'text-ty-secondary'
						: 'text-ty-silent italic'}"
				>
					{plannedHours ? formatDuration(plannedHours) : m.energy_no_hours()}
				</span>
			{/if}
			<!-- Deliberately NOT hidden on a completed task, unlike the sliders below:
			     finishing one is the commonest way a session ends, and the drain rating is
			     the whole point of the row. -->
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							type="button"
							aria-label={m.energy_log_drain_aria()}
							class="shrink-0 transition {measured
								? 'text-flow'
								: 'text-ty-silent opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 hover:text-flow'}"
							onclick={ondrainclick}
						>
							🪫
						</button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="top">
					<p>{m.energy_log_drain_tooltip()}</p>
				</Tooltip.Content>
			</Tooltip.Root>
			<button
				type="button"
				aria-label={m.task_remove_aria()}
				title={m.task_remove_tooltip()}
				class="shrink-0 text-ty-silent opacity-0 transition hover:text-danger focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
				onclick={onremove}
			>
				✕
			</button>
		</div>
		{#if !completed}
			<div class="mt-text-xs ml-7 grid gap-x-grid-lg gap-y-grid-2xs sm:grid-cols-3">
				{#each SLIDERS as slider (slider.key)}
					<label class="flex items-center gap-text-xs text-2xs text-ty-silent" title={slider.title}>
						<span class="w-3 font-medium {slider.color}">{slider.label}</span>
						<input
							type="range"
							min={slider.min}
							max="10"
							value={values[slider.key]}
							oninput={(e) => setValue(slider.key, Number(e.currentTarget.value))}
							class="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-surface-inset {slider.accent}"
						/>
						<span class="w-4 text-right tabular-nums text-ty-secondary">
							{values[slider.key]}
						</span>
					</label>
				{/each}
			</div>
		{/if}
		{#if drainDraft}
			<DrainLogForm
				seed={drainDraft}
				focusMinutes={focusDrainMinutes}
				onsave={ondrainsave}
				oncancel={ondraincancel}
			/>
		{/if}
	</Tooltip.Provider>
</li>
