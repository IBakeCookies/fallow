<script module lang="ts">
	import { buttonVariants } from '$lib/presentation/component/ui/button';

	/** What a row action looks like. Exported because each screen adds one action of its
	 *  own — ⚡ on the main page, 🪫 in the Lab — and two buttons in one strip cannot be
	 *  a different size from each other. */
	export const ROW_ACTION_CLASS = buttonVariants({
		variant: 'ghost',
		size: 'icon-xs',
	});
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import Pencil from '@lucide/svelte/icons/pencil';
	import X from '@lucide/svelte/icons/x';
	import { cn } from '$lib/presentation/utils';

	/* Everything the two task rows say the same way: the frame and its hover surface,
	   the completion checkbox, the title, the three model inputs under it, the action
	   strip that appears on hover — including ✎ and ✕, which mean the same thing on
	   both screens — and the editors that open below. Each screen fills the slots from
	   its own reading of the task: `/` adds priority, T* and its allocation with the ⚡
	   measurement, the Lab adds the schedule's hue and hours with the 🪫 one. That
	   difference is the ONLY reason there are two components; if the two readings ever
	   converge, merge the callers rather than adding a mode flag here.

	   Not an <li>: the list is what makes a row one (task-list.svelte, and the Lab
	   page's rows snippet), and task-list-card.svelte is where the rule between them is
	   drawn. No Tooltip.Provider either — the callers' snippets are full of tooltips,
	   so the provider has to be theirs, above this. */

	interface Props {
		title: string;
		completed: boolean;
		/** The task's definition, spelled the same on both screens. ✎ is what changes
		 *  them; they read here because a row that hides its inputs cannot explain the
		 *  hours beside it. */
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		ontoggle: () => void;
		/** Before the title, on its line: the nature and run-order badges on the main
		 *  page, the plan's hue in the Lab. */
		lead?: Snippet;
		/** The rest of the readings, after the three inputs. */
		meta?: Snippet;
		/** The right-hand column, before the actions: what the day gave the task. */
		trailing?: Snippet;
		/** The measurement this screen collects, first in the strip. */
		actions?: Snippet;
		/** True while an editor one of the actions opened is on screen. Without it the
		 *  strip fades out from under a form that is still being filled in — and the
		 *  button that opened it is how you close it again. */
		actionsPinned?: boolean;
		/** ✎ is open — so the strip stays pinned and the button reads as active. The
		 *  editor itself is the caller's, rendered in `forms` alongside that screen's
		 *  own; both rows stack the two rather than trading one for the other. */
		editing?: boolean;
		/** Toggles ✎. Absent on a read-only row, which then has no ✎ at all. */
		onedit?: () => void;
		/** Absent on a read-only row. */
		onremove?: () => void;
		/** The editors, under the row rather than inside its flex line: the strip has no
		 *  room for a label, and an unlabelled number field is what nobody understood. */
		forms?: Snippet;
	}

	let {
		title,
		completed,
		physicalDifficulty,
		mentalDifficulty,
		enjoyment,
		ontoggle,
		lead,
		meta,
		trailing,
		actions,
		actionsPinned = false,
		editing = false,
		onedit,
		onremove,
		forms,
	}: Props = $props();
</script>

<div
	class="group rounded-lg border border-transparent p-box-sm transition hover:border-line-soft hover:bg-surface-hover"
>
	<div class="flex items-start gap-grid-xs">
		<input
			type="checkbox"
			checked={completed}
			onchange={ontoggle}
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
			</div>
		</div>

		<div class="flex shrink-0 items-center gap-grid-xs">
			{@render trailing?.()}
			<div
				class="flex items-center gap-grid-2xs transition-opacity {actionsPinned || editing
					? 'opacity-100'
					: 'hover-reveal'}"
			>
				{@render actions?.()}

				{#if onedit}
					<Tooltip.Root>
						<Tooltip.Trigger
							class={cn(
								ROW_ACTION_CLASS,
								editing ? 'text-success' : 'text-ty-silent hover:text-success',
							)}
							onclick={onedit}
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

	{@render forms?.()}
</div>
