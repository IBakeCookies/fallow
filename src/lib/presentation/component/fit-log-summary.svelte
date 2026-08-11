<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime';

	interface Props {
		label: string;
		title?: string;
		count: number;
		confirmLabel: string;
		resetLabel: string;
		resetTitle?: string;
		onreset?: () => void;
	}

	let { label, title, count, confirmLabel, resetLabel, resetTitle, onreset }: Props = $props();

	// Confirm focuses Cancel, so a stray Enter cannot wipe the logs; cancel hands focus
	// back to the trigger. Plain `let`, not `$state`: it must not re-run the attachment.
	let confirmingReset = $state(false);
	let returningFromCancel = false;

	// The confirm pair lives inside `count > 0`; the row above can drop the last log while
	// it is open, and it would re-arm itself, focused, on the next log.
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
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a
					href={`${localizeHref(resolve('/analytics'))}#log-history`}
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
