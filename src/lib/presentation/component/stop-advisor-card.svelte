<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { StopAdvice } from '$lib/business/model/zenith-energy';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import { formatDecimals } from '$lib/presentation/utils/number-format';

	interface Props {
		advice: StopAdvice;
		/** Title of the recommended task; unused on the window-full verdict */
		taskTitle: string;
		freeTimeValue: number;
		/** BCP-47 tag for the decimals, like every locale-aware format on this page */
		locale: string;
	}

	let { advice, taskTitle, freeTimeValue, locale }: Props = $props();
</script>

<!-- The in-day verdict (MATH.md §8.11): is the best next session still worth
     more per hour than free time? Renders only while there is one to price —
     the page hides the card when the store has nothing to advise on. -->
<div class="card-shell p-box-md sm:p-box-xl">
	<Tooltip.Provider delayDuration={150}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<h3
						{...props}
						class="hint-underline w-fit text-xs font-semibold tracking-wider text-ty-secondary uppercase"
					>
						{m.energy_stop_advisor()}
					</h3>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content class="max-w-md">
				<p>{m.energy_stop_advisor_hint()}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>

	{#if advice.verdict === 'window-full'}
		<p class="mt-text-2xs text-sm text-ty-secondary">{m.energy_stop_window_full()}</p>
	{:else}
		{@const detail = {
			duration: formatDuration(advice.sessionHours),
			task: taskTitle,
			value: formatDecimals(advice.marginalValue, 2, locale),
			free: formatDecimals(freeTimeValue, 2, locale),
		}}
		<p class="mt-text-2xs text-lg font-semibold text-ty-primary">
			{advice.verdict === 'continue' ? m.energy_stop_continue() : m.energy_stop_stop()}
		</p>
		<p class="mt-text-2xs text-sm text-ty-silent">
			{advice.verdict === 'continue'
				? m.energy_stop_continue_detail(detail)
				: m.energy_stop_stop_detail(detail)}
		</p>
	{/if}
</div>
