<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { AdviceDisplay } from '$lib/presentation/utils/plan-advice-descriptor';
	import { Button } from '$lib/presentation/component/ui/button';

	interface Props {
		/** Null until the user asks: the search costs a full solve per candidate. */
		advice: AdviceDisplay | null;
		busy: boolean;
		/** The day changed after this advice was calculated. */
		stale: boolean;
		oncheck: () => void;
	}

	let { advice, busy, stale, oncheck }: Props = $props();
</script>

<!-- Until the user asks, this is one button and nothing else: a card advertising
     a feature it has not run yet is pure vertical cost above the plan. -->
{#if !advice}
	<div class="flex justify-end">
		<Button variant="secondary" size="sm" disabled={busy} onclick={oncheck} title={m.advice_desc()}>
			{busy ? m.advice_working() : m.advice_check()}
		</Button>
	</div>
{:else}
	<div class="rounded-2xl border bg-surface-card backdrop-blur shadow-card p-box-md sm:p-box-xl">
		<div class="flex items-start justify-between gap-grid-xs">
			<div class="min-w-0">
				<h3 class="text-xs font-semibold text-ty-secondary uppercase tracking-wider">
					{m.advice_title()}
				</h3>
				<p class="mt-text-xs text-xs text-ty-silent">{m.advice_desc()}</p>
			</div>
			<Button variant="outline" size="sm" disabled={busy} onclick={oncheck}>
				{busy ? m.advice_working() : m.advice_recheck()}
			</Button>
		</div>

		{#if stale}
			<p
				class="mt-grid-sm rounded-lg border border-warning/20 bg-warning/5 p-box-sm text-xs text-warning-strong"
			>
				{m.advice_stale()}
			</p>
		{/if}

		{#if advice.unfunded}
			<p class="mt-grid-sm text-xs text-ty-secondary">{advice.unfunded}</p>
		{/if}

		{#if advice.rows.length === 0}
			<p class="mt-grid-sm text-xs text-success-strong">{m.advice_clear()}</p>
		{:else}
			<ul class="mt-grid-sm space-y-grid-sm">
				{#each advice.rows as row (row.axis)}
					<li class="rounded-xl border border-line-soft p-box-sm">
						<div class="flex items-baseline justify-between gap-grid-xs">
							<span class="text-xs font-medium text-ty-secondary">{row.label}</span>
							<span class="text-sm font-semibold {row.beforeStyle}">{row.before}</span>
						</div>
						<ul class="mt-text-xs space-y-text-xs">
							{#each row.options as option (option.action)}
								<li
									class="flex flex-wrap items-baseline justify-between gap-x-text-md gap-y-text-xs"
								>
									<span class="min-w-0 text-xs text-ty-primary">{option.action}</span>
									<span class="flex shrink-0 items-baseline gap-text-xs text-xs">
										<span class="font-semibold {option.afterStyle}">{option.after}</span>
										<span class="text-ty-silent">· {option.cost}</span>
									</span>
									{#if option.profileFlip}
										<span class="basis-full text-xs text-ty-silent">{option.profileFlip}</span>
									{/if}
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}
