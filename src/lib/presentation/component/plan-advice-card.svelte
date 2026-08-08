<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { AdviceDisplay } from '$lib/presentation/utils/plan-advice-descriptor';
	import { BAND_TEXT_CLASS, bandLabel, type Band } from '$lib/presentation/utils/band';
	import { Button } from '$lib/presentation/component/ui/button';

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
		 * Perform a set-budget option: declare that many available hours. Takes the
		 * lever's UNROUNDED hours, which is the point of the button — the trim lever
		 * is `budget − planSlack` and only its label rounds (MATH.md §14.1-2), so a
		 * user retyping what the card shows lands on a budget the model never priced.
		 */
		onapplybudget: (hours: number) => void;
	}

	let { advice, isBusy, isStale, hasError, oncheck, onapply, onapplybudget }: Props = $props();
</script>

<!-- Until the user asks, this is one button and nothing else: a card advertising
     a feature it has not run yet is pure vertical cost above the plan. -->
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

		<!-- Louder than the plain unfunded line: this one is a contradiction the user
		     set up, and the menu below cannot offer to resolve it. -->
		{#if advice.unfundedMustDo}
			<p class="mt-grid-sm text-xs text-warning-strong">{advice.unfundedMustDo}</p>
		{/if}

		<!-- The budget's shadow price (MATH.md §14.2): what one more block buys and
		     who gets it. A day-level reading, so it sits above the per-axis menu
		     rather than inside any one row's budget levers. -->
		<p class="mt-grid-sm text-xs text-ty-silent">{advice.marginal}</p>

		<!-- What the declared switch cost reserves, and what the plan would read at
		     zero and at double (MATH.md §14.3). Same quiet register as the marginal
		     above, and deliberately not a row in the menu below: §14 rules the switch
		     cost a measurement of the user, so there is no lever to offer. -->
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
						<ul class="mt-text-xs space-y-text-xs">
							<!-- Keyed on the lever — one object per candidate — and never on the
							     option's words: two tasks sharing a title spell the same
							     sentence, and a duplicate key crashes the card outright. -->
							{#each row.options as option (option.lever)}
								{@const lever = option.lever}
								<!-- The unpriced increase is ruled out of the frontier by the model
								     (MATH.md §14), so it is not a fourth comparable option: ruled off
								     from them, since its reading is worse than every option above it
								     and its cost is denominated in something else entirely. -->
								<li
									class="flex flex-wrap items-baseline justify-between gap-x-text-md gap-y-text-xs"
									class:border-t={option.isUnpriced}
									class:border-line-soft={option.isUnpriced}
									class:pt-text-xs={option.isUnpriced}
								>
									<span class="min-w-0 text-xs text-ty-primary">{option.action}</span>
									<span class="flex shrink-0 items-baseline gap-text-xs text-xs">
										<span class="font-semibold {BAND_TEXT_CLASS[option.afterBand]}"
											>{option.after}</span
										>
										{@render bandText(option.afterBand)}
										<span class="text-ty-silent">· {option.cost}</span>
										<!-- A deferral prices "off today" (MATH.md §14) while the button
										     commits to a destination, so aria-label carries both, plus the
										     title so the buttons stay apart. -->
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
											<!-- Also performable, and §14 is why: the budget is a choice about
											     the day, which is exactly what makes it a lever where the
											     switch cost is only a diagnostic. Applies the lever's own
											     unrounded hours, which the number field accepts and the
											     slider's 0.25 step cannot express. -->
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
					</li>
				{/each}
			</ul>
			<!-- Every axis in band does NOT mean the day is fine: unfunded tasks are a
			     read, not a band, so a day can read clean everywhere and still leave
			     work with no hours. Saying "this day is fine" under either line above
			     negates it. -->
		{:else if !advice.unfunded && !advice.unfundedMustDo}
			<p class="mt-grid-sm text-xs text-success-strong">{m.advice_clear()}</p>
		{/if}
	</div>
{/if}

<!-- The band a reading falls in is otherwise carried by colour alone (WCAG
     1.4.1), the same reason the metrics dashboard renders this. Sibling of the
     value, never nested, so the value element's text stays exactly the reading. -->
{#snippet bandText(band: Band)}
	{@const judged = bandLabel(band)}
	{#if judged}
		<span class="sr-only">({judged})</span>
	{/if}
{/snippet}
