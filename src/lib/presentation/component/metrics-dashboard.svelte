<script lang="ts">
	import type { Metric } from '$lib/presentation/type';
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { Badge } from '$lib/presentation/component/ui/badge';
	import {
		BAND_BORDER_CLASS,
		BAND_TEXT_CLASS,
		bandLabel,
		type Band,
	} from '$lib/presentation/utils/band';

	interface Props {
		metrics: Metric[];
		momentum: number | null;
	}

	let { metrics, momentum }: Props = $props();

	// Every reading at equal weight is a spreadsheet: Burnout Risk read exactly
	// like Avg Enjoyment. The headline four get tiles; the rest stay one click
	// away rather than gone.
	const headline = $derived(metrics.filter((item) => item.headline));
	const rest = $derived(metrics.filter((item) => !item.headline));

	// Only the sign is rendered, by both the badge's fill and its wording. `-0`
	// (Math.round of a small negative) compares equal to 0, so it reads as stable.
	const trend = $derived(momentum === null ? null : Math.sign(momentum));
</script>

<div class="card-shell p-box-md sm:p-box-xl">
	<!-- Momentum. tailwind-merge lets `class` win the fill and the ink, so the
	     variant only picks tinted vs. plain: a `destructive` branch would style
	     nothing and name a severity the warning fill contradicts. -->
	<div class="flex items-center justify-between mb-grid-sm">
		{@render label(m.momentum_label(), m.momentum_tooltip())}
		<Badge
			variant={trend ? 'default' : 'outline'}
			class={trend === 1
				? 'bg-success/20 text-success-strong'
				: trend === -1
					? 'bg-warning/20 text-warning-strong'
					: ''}
		>
			{trend === null
				? m.na_value()
				: trend === 1
					? m.momentum_upward()
					: trend === -1
						? m.momentum_reset_required()
						: m.momentum_stable()}
		</Badge>
	</div>

	<!-- Headline readings: large, first, unmissable. Four across, each behind a
	     rule in its own band colour — the rule is what makes an out-of-the-
	     ordinary reading findable without reading any of the numbers. -->
	<div class="grid grid-cols-1 gap-grid-sm sm:grid-cols-2 lg:grid-cols-4">
		{#each headline as item (item.label)}
			<div class="border-l-2 pl-box-xs {BAND_BORDER_CLASS[item.band]}">
				{@render label(item.label, item.description)}
				<p
					class="mt-text-3xs text-2xl font-medium leading-tight tabular-nums capitalize wrap-anywhere {BAND_TEXT_CLASS[
						item.band
					]}"
				>
					{item.value}
				</p>
				{@render bandText(item.band)}
			</div>
		{/each}
	</div>

	<!-- The rest are reference, not headline: one click away rather than the rest
	     at equal weight burying the four that matter. Dense and multi-column once
	     opened, and `columns` not a grid — column flow fills a column top to bottom
	     before starting the next, so a reading's neighbours in the descriptor stay
	     its neighbours on screen; a row-first grid scatters them across four. -->
	{#if rest.length > 0}
		<details class="mt-grid-lg border-t border-line-soft pt-grid-sm">
			<summary
				class="cursor-pointer text-xs text-ty-secondary transition hover:text-ty-primary marker:text-ty-silent"
			>
				{m.metrics_more({
					count: rest.length,
				})}
			</summary>
			<div class="mt-grid-sm columns-1 gap-grid-lg sm:columns-2 lg:columns-4">
				{#each rest as item (item.label)}
					<div
						class="flex break-inside-avoid items-baseline justify-between gap-text-xs border-b border-line-soft py-text-2xs"
					>
						{@render label(item.label, item.description)}
						<span
							class="text-right text-sm font-semibold tabular-nums capitalize {BAND_TEXT_CLASS[
								item.band
							]}">{item.value}</span
						>
						{@render bandText(item.band)}
					</div>
				{/each}
			</div>
		</details>
	{/if}
</div>

<!-- Every label in the card is a dotted-underlined tooltip trigger: the readings'
     and Momentum's, which is why this takes the two strings rather than a Metric. -->
{#snippet label(text: string, description: string)}
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger>
				<span class="hint-underline text-xs text-ty-secondary">
					{text}
				</span>
			</Tooltip.Trigger>
			<Tooltip.Content side="left">
				<p>{description}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
{/snippet}

<!-- A reading's band is otherwise carried by colour alone (WCAG 1.4.1), so each
     judged band also gets text only a screen reader hears. Sibling of the value,
     never nested: that keeps the value element's text content exactly the
     reading, which is what the e2e assertions and any consumer of the rendered
     number match on. A screen reader reads the two in sequence either way. -->
{#snippet bandText(band: Band)}
	{@const judged = bandLabel(band)}
	{#if judged}
		<span class="sr-only">({judged})</span>
	{/if}
{/snippet}
