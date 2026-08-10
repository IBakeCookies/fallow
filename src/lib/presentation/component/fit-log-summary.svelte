<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';

	interface Props {
		/** What the fit is fitted from, in words — e.g. "Personalized from 7 flow logs". */
		label: string;
		title?: string;
		/** How many logs feed this fit. Zero hides both verbs: there is nothing to look
		 *  at and nothing to reset, and `label` is already the sentence that says so. */
		count: number;
		confirmLabel: string;
		resetLabel: string;
		resetTitle?: string;
		/** Omit to hide the reset. */
		onreset?: () => void;
	}

	let { label, title, count, confirmLabel, resetLabel, resetTitle, onreset }: Props = $props();

	/* What a fit was fitted from, where to read it, and how to drop all of it. Under
	   each of the three calibration cards: ϕ in the time-budget bar, α and r in the
	   Lab.

	   It used to print the logs too, as an expandable list with a ✕ per row (it was
	   `log-list.svelte` until 2026-08-10). Three cards each listing their own kind of
	   log is three answers to "what have I logged", none of which could show a
	   neighbouring kind or a day outside the fit — so the listing moved to
	   `/analytics`, which prints all three kinds dated, and this kept the two verbs
	   that belong to a FIT rather than to a measurement: read what it used, reset it.

	   The reset stayed here rather than following the rows for the same reason: it is
	   not "delete these logs" but "un-personalize this parameter", which is a
	   statement about the card it sits under. Dropping ONE log is the other verb, and
	   lives with the log — on its row for ⚡ and 🪫, and in the analytics list for all
	   three. */

	// The two-step swap unmounts whichever button was focused: entering confirm
	// focuses Cancel — the safe half, so a second stray Enter cannot wipe the logs —
	// and cancelling hands focus back to the trigger. A plain `let`, not `$state`: the
	// attachment reads it once when the trigger mounts and must not re-run when it
	// flips back.
	let confirmingReset = $state(false);
	let returningFromCancel = false;

	// An unconfirmed reset does not outlive the logs it was aimed at. The two-step pair
	// lives inside `count > 0`, and the count can reach 0 while it is open — the ⚡ badge's
	// own 🗑 drops the last log from the row above this card — which unmounts the confirm
	// with `confirmingReset` still true. It would then re-arm itself on the next log,
	// focused, over a reset nobody asked for a second time. `log-list.svelte` cleared this
	// when its panel collapsed; with no panel left, the count is what says the question is
	// moot.
	$effect(() => {
		if (count === 0) confirmingReset = false;
	});
</script>

<div class="flex flex-wrap items-center justify-between gap-x-grid-xs gap-y-text-2xs">
	<p class="text-xs text-ty-silent" {title}>{label}</p>

	{#if count > 0}
		<span class="flex shrink-0 items-center gap-grid-xs text-xs">
			{#if confirmingReset}
				<span class="text-ty-silent">{confirmLabel}</span>
				<button
					type="button"
					class="font-medium text-danger hover:text-danger-strong"
					onclick={() => {
						onreset?.();
						confirmingReset = false;
					}}
				>
					{m.common_reset()}
				</button>
				<button
					type="button"
					class="text-ty-silent hover:text-ty-secondary"
					{@attach (node) => node.focus()}
					onclick={() => {
						returningFromCancel = true;
						confirmingReset = false;
					}}
				>
					{m.common_cancel()}
				</button>
			{:else}
				<!-- No count in the link: `label` beside it already says how many logs this
				     fit read, and the page it opens is scoped to a range the user picks, so a
				     number here would be a promise about a screen this component cannot see. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a
					href={localizeHref(resolve('/analytics'))}
					class="hint-underline text-ty-silent transition hover:text-ty-secondary"
				>
					{m.fit_logs_open_history()}
				</a>
				{#if onreset}
					<button
						type="button"
						class="text-ty-silent transition hover:text-danger"
						title={resetTitle}
						{@attach (node) => {
							if (returningFromCancel) {
								returningFromCancel = false;
								node.focus();
							}
						}}
						onclick={() => (confirmingReset = true)}
					>
						{resetLabel}
					</button>
				{/if}
			{/if}
		</span>
	{/if}
</div>
