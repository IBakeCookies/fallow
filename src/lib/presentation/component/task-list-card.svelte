<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/presentation/component/ui/dialog';
	import { cn } from '$lib/presentation/utils';

	interface Props {
		/** Mounted in the dialog below, so it renders only while that is open — every
		 *  opening is a fresh mount, and no page decides when a form is on screen. It
		 *  takes the closer: only this card knows the dialog its Cancel closes. */
		form?: Snippet<[() => void]>;
		/** Between the heading and the list — `/` its day axis, the Lab its ☕ editor. */
		strip?: Snippet;
		/** What the screen reads beside the heading — both screens put the day's Load/Save
		 *  there. A snippet, like `form`: this card is the two screens' shared frame, so
		 *  what only one of them says arrives from that one. */
		heading?: Snippet;
		/** Null, not an empty snippet: an empty `<ul>` announces "list, 0 items" over the
		 *  empty-state copy. */
		rows: Snippet | null;
		/** Splits the list into two headed groups instead of one plain one — `/` reads
		 *  the tasks the plan funded nothing in the second. Both labels arrive with it: a
		 *  heading over the only group there is says nothing about it. */
		split?: {
			firstLabel: string;
			restLabel: string;
			rest: Snippet;
		};
		/** Where the empty state's example-day link points; the Lab passes none. */
		exampleDayHref?: string;
		/** After the list — `/`'s legend for its rails; the Lab passes none. */
		foot?: Snippet;
		class?: string;
	}

	let {
		form,
		strip,
		heading,
		rows,
		split,
		exampleDayHref,
		foot,
		class: className,
	}: Props = $props();

	let addOpen = $state(false);
</script>

<!-- A styled label and NOT a heading: every row title is an `<h3>`, so an `<h4>` here
     would be closed by the first row under it and the second group would read as part of
     the last task. The list carries the group's name instead, and `ruled` divides the two
     at a weight the rows inside one do not use: presentation/AGENTS.md, "`/` reads the day
     as the two groups the plan makes". -->
<!-- `pt-text-sm` on the ruled group only — wider than the card's rhythm, so the two
     groups read as two lists rather than one with a line through it. -->
{#snippet group(label: string, items: Snippet, ruled: boolean)}
	<div class={cn('space-y-text-2xs pt-text-sm', ruled && ' border-t border-line-strong')}>
		<p class="text-2xs font-semibold tracking-wider text-ty-silent uppercase">{label}</p>
		<ul aria-label={label} class="divide-y divide-line-soft">{@render items()}</ul>
	</div>
{/snippet}

<Dialog.Root bind:open={addOpen}>
	<div class={cn('card-shell space-y-text-xs p-box-sm sm:p-box-xl', className)}>
		<div class="flex flex-wrap items-center justify-between gap-text-xs">
			<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
				{m.list_title()}
			</h3>
			{#if form}
				<!-- `mr-auto` takes the free space: the opener keeps the title's side.
				     The `+` is `aria-hidden` so the accessible name stays the plain
				     "Add task" — a name that opens with punctuation is read out as it. -->
				<Dialog.Trigger class="mr-auto" variant="default">
					<span aria-hidden="true">+</span>
					{m.form_add_task_title()}
				</Dialog.Trigger>
			{/if}
			{@render heading?.()}
		</div>
		{@render strip?.()}

		{#if rows && split}
			{@render group(split.firstLabel, rows, false)}
			{@render group(split.restLabel, split.rest, true)}
		{:else if rows}
			<ul class="divide-y divide-line-soft">{@render rows()}</ul>
		{:else}
			<div class="flex flex-col items-center justify-center py-empty-state text-center">
				<div class="text-ty-silent mb-text-xs">
					<svg
						class="w-12 h-12 mx-auto"
						aria-hidden="true"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						/>
					</svg>
				</div>
				<p class="text-sm text-ty-secondary">{m.list_empty()}</p>
				<p class="text-xs text-ty-silent mt-text-2xs">{m.list_empty_hint()}</p>
				{#if form}
					<Dialog.Trigger class="mt-text-sm" variant="default">{m.form_add_task()}</Dialog.Trigger>
				{/if}
				{#if exampleDayHref}
					<!-- A shared link lands here with nothing on it; the worked day is the answer. -->
					<a href={exampleDayHref} class="mt-text-2xs text-xs hint-underline">
						{m.list_empty_example()}
					</a>
				{/if}
			</div>
		{/if}
		{@render foot?.()}
	</div>

	{#if form}
		<!-- `/`'s form is two columns — the fields and their reading — so `max-w-lg` is too narrow. -->
		<Dialog.Content class="sm:max-w-4xl">
			<Dialog.Title class="mb-text-md border-b border-line-soft pb-text-md"
				>{m.form_add_task_title()}</Dialog.Title
			>
			{@render form(() => (addOpen = false))}
		</Dialog.Content>
	{/if}
</Dialog.Root>
