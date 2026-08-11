<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { AdviceDisplay } from '$lib/presentation/utils/plan-advice-descriptor';
	import { BAND_TEXT_CLASS, bandLabel, type Band } from '$lib/presentation/utils/band';
	import { Button } from '$lib/presentation/component/ui/button';
	import { cn } from '$lib/presentation/utils';

	interface Props {
		/** Null until the user asks: the search costs a full solve per candidate. */
		advice: AdviceDisplay | null;
		isBusy: boolean;
		/** The day changed after this advice was calculated. */
		isStale: boolean;
		/** The last check failed; the advice shown (if any) predates the failure. */
		hasError: boolean;
		oncheck: () => void;
		/** Perform a defer-task option: move that task to tomorrow's plan. */
		onapply: (taskId: number) => void;
		/**
		 * Takes the lever's UNROUNDED hours: only the label rounds (MATH.md §14.1-2),
		 * so a budget retyped from what the card shows is one the model never priced.
		 */
		onapplybudget: (hours: number) => void;
	}

	let { advice, isBusy, isStale, hasError, oncheck, onapply, onapplybudget }: Props = $props();
</script>

{#if !advice}
	<div class="flex items-baseline justify-end gap-grid-xs">
		{#if hasError}
			<p class="text-xs text-danger">{m.advice_error()}</p>
		{/if}
		<Button variant="outline" size="sm" disabled={isBusy} onclick={oncheck} title={m.advice_desc()}>
			{isBusy ? m.advice_working() : m.advice_check()}
		</Button>
	</div>
{:else}
	<div class="card-shell p-box-md sm:p-box-xl">
		<div class="flex items-start justify-between gap-grid-xs">
			<div class="min-w-0">
				<h3 class="text-xs font-semibold text-ty-secondary uppercase tracking-wider">
					{m.advice_title()}
				</h3>
				<p class="mt-text-xs text-xs text-ty-silent">{m.advice_desc()}</p>
			</div>
			<Button variant="outline" size="sm" disabled={isBusy} onclick={oncheck}>
				{isBusy ? m.advice_working() : m.advice_recheck()}
			</Button>
		</div>

		{#if hasError}
			<p
				class="mt-grid-sm rounded-lg border border-danger/20 bg-danger/5 p-box-sm text-xs text-danger-strong"
			>
				{m.advice_error()}
			</p>
		{/if}

		{#if isStale}
			<p
				class="mt-grid-sm rounded-lg border border-warning/20 bg-warning/5 p-box-sm text-xs text-warning-strong"
			>
				{m.advice_stale()}
			</p>
		{/if}

		{#if advice.unfunded}
			<p class="mt-grid-sm text-xs text-ty-secondary">{advice.unfunded}</p>
		{/if}

		<!-- Louder than the plain unfunded line: the menu below has no lever for it. -->
		{#if advice.unfundedMustDo}
			<p class="mt-grid-sm text-xs text-warning-strong">{advice.unfundedMustDo}</p>
		{/if}

		<!-- The budget's shadow price (MATH.md §14.2): a day-level reading, so it sits
		     above the per-axis menu rather than inside one row's budget levers. -->
		<p class="mt-grid-sm text-xs text-ty-silent">{advice.marginal}</p>

		<!-- Not a row in the menu below: §14 rules the switch cost a measurement of
		     the user (§14.3), so there is no lever to offer. -->
		<p class="mt-text-xs text-xs text-ty-silent">{advice.switchCost}</p>

		{#if advice.rows.length > 0}
			<ul class="mt-grid-sm space-y-grid-sm">
				{#each advice.rows as row (row.axis)}
					<li class="rounded-xl border border-line-soft p-box-sm">
						<div class="flex items-baseline justify-between gap-grid-xs">
							<span class="text-xs font-medium text-ty-secondary">{row.label}</span>
							<span class="text-sm font-semibold {BAND_TEXT_CLASS[row.beforeBand]}"
								>{row.before}</span
							>
							{@render bandText(row.beforeBand)}
						</div>
						<!-- An axis the search came back empty on (MATH.md §14.4), said out loud:
						     a reading with nothing under it otherwise reads as a rendering failure. -->
						{#if row.options.length === 0}
							<p class="mt-text-xs text-xs text-ty-silent">{m.advice_no_lever()}</p>
						{:else}
							<ul class="mt-text-xs space-y-text-xs">
								<!-- Keyed on the lever, never the option's words: two tasks sharing a
								     title spell the same sentence, and a duplicate key crashes the card. -->
								{#each row.options as option (option.lever)}
									{@const lever = option.lever}
									<!-- Ruled off from the priced options: the unpriced increase is off the
									     frontier (MATH.md §14) and its cost is denominated in something else. -->
									<li
										class={cn(
											'flex flex-wrap items-baseline justify-between gap-x-text-md gap-y-text-xs',
											option.isUnpriced && 'border-t border-line-soft pt-text-xs',
										)}
									>
										<span class="min-w-0 text-xs text-ty-primary">{option.action}</span>
										<span class="flex shrink-0 items-baseline gap-text-xs text-xs">
											<span class="font-semibold {BAND_TEXT_CLASS[option.afterBand]}"
												>{option.after}</span
											>
											{@render bandText(option.afterBand)}
											<span class="text-ty-silent">· {option.cost}</span>
											<!-- A deferral prices "off today" (MATH.md §14) while the button commits
											     to a destination: the aria-label carries both, and the task title. -->
											{#if lever.kind === 'defer-task'}
												<Button
													variant="outline"
													size="sm"
													disabled={isBusy}
													aria-label={m.advice_apply_label({
														title: lever.title,
													})}
													onclick={() => onapply(lever.taskId)}
												>
													{m.advice_apply()}
												</Button>
											{:else}
												<Button
													variant="outline"
													size="sm"
													disabled={isBusy}
													onclick={() => onapplybudget(lever.hours)}
												>
													{option.applyLabel}
												</Button>
											{/if}
										</span>
										{#if option.profileFlip}
											<span class="basis-full text-xs text-ty-silent">{option.profileFlip}</span>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ul>
			<!-- Unfunded tasks are a read, not a band: a day can be in band everywhere
			     and still leave work with no hours, which "this day is fine" negates. -->
		{:else if !advice.unfunded && !advice.unfundedMustDo}
			<p class="mt-grid-sm text-xs text-success-strong">{m.advice_clear()}</p>
		{/if}
	</div>
{/if}

<!-- The band is otherwise carried by colour alone (WCAG 1.4.1). Sibling of the
     value, never nested, so the value element's text stays exactly the reading. -->
{#snippet bandText(band: Band)}
	{@const judged = bandLabel(band)}
	{#if judged}
		<span class="sr-only">({judged})</span>
	{/if}
{/snippet}
