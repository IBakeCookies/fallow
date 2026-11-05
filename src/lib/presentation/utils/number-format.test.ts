/* A signed percent prints one way wherever it appears — the dashboard's Fallow
   Gain, the Lab's vs-classic tile, /analytics' completion-rate delta and the
   advice card's prices: "+" or "−" on a change, nothing on a tie, the decimal in
   the reader's locale.

   Tests: this file; band.test.ts ("bands a completion-rate delta of …");
     metric-descriptor.test.ts ("prints Fallow Gain in the reader's locale");
     plan-summary.stories.svelte ("Behind the classic plan");
     e2e/analytics-stats.e2e.ts ("a completion rate below the previous range reads
     its drop in danger ink")
   Pins: band.test.ts "bands a completion-rate delta of 1 as success" and "of -1 as
     critical", every "bands a vs-classic …" case; plan-summary stories "Ahead of
     the classic plan" and "Level with the classic plan"; every sign and locale
     assertion in plan-advice-descriptor.test.ts (`signedPlanValue` delegates with
     no change in output)
   Out of scope:
   - N/A stays at each site: plan-advice's `na_value`, plan-summary's "—",
     /analytics' `{#if rateDelta !== null}`, Fallow Gain's `gated`. The formatter
     takes a number, never null.
   - Loss severity stays per metric: critical for the completion-rate delta,
     warning for vs-classic. Only the tie is unified.
   - Longest Warm-Up's `toFixed(1)` in metric-descriptor.ts is an unlocalized
     decimal too; not a signed percent, not this change.
   - M127, the Momentum badge's tint.
   Read before building:
   - src/lib/presentation/utils/number-format.ts — header: locale is a parameter,
     never a `getDateLocale()` call, so the module stays plain
   - src/lib/presentation/utils/plan-advice-descriptor.ts — `signedPlanValue` and
     `formatCost`: the spelling this adopts; its docblock's reasoning moves to the
     formatter
   - src/lib/presentation/utils/metric-descriptor.ts — `buildMetrics`, the Fallow
     Gain row; its "Signed from the value, not hardcoded '+'" comment is
     archaeology once the formatter is called — delete it
   - src/lib/presentation/component/plan-summary.svelte, src/routes/(app)/energy/+page.svelte
     (its `PlanSummary` call), src/routes/(app)/analytics/+page.svelte (the rate
     delta note), src/routes/(app)/+page.svelte (its `buildMetrics` call)
   - src/lib/presentation/utils/band.ts — `getBandCompletionRateDelta`
   - src/lib/presentation/AGENTS.md — the paragraph "A reading widens when whole
     percent would print an option as its own row" says the dashboard row "has no
     locale", which this makes false; a public export is added
   Decisions: one `formatSignedPercent(value, locale)` in number-format.ts beside
   `formatDecimals`: "+" and U+2212 "−", no sign on a tie (so -0 prints "0%"), at
   most one decimal in the reader's locale — the advice card's spelling, chosen by
   the user. A completion-rate delta of 0 bands `neutral`, as vs-classic's tie
   already does, because a sign-less "0%" in green reads as a gain. `buildMetrics`
   takes `locale` as its last parameter and `remainingDay` loses its default.
   Rejected locale third, because it would shift `remainingDay` and every existing
   call would pass a string where the day goes. `PlanSummary` takes a `locale` prop
   from /energy, as `PlanScheduleList` and `BudgetCurveCard` do. Rejected the route
   pre-formatting the string, because the band still reads the number.
   Roadmap: M122 */

import { describe, expect, it } from 'vitest';
import { formatSignedPercent } from '$lib/presentation/utils/number-format';

describe('formatSignedPercent', () => {
	it('signs a gain with a plus', () => {
		expect(formatSignedPercent(3.1, 'en-US')).toBe('+3.1%');
	});

	it('signs a loss with U+2212, not a hyphen-minus', () => {
		expect(formatSignedPercent(-6.2, 'en-US')).toBe('−6.2%');
	});

	it('signs a tie with nothing', () => {
		expect(formatSignedPercent(0, 'en-US')).toBe('0%');
	});

	// `Math.round` hands vs-classic -0 for a small loss.
	it('signs a rounded-away loss with nothing', () => {
		expect(formatSignedPercent(-0, 'en-US')).toBe('0%');
	});

	it('prints a whole percent with no decimal', () => {
		expect(formatSignedPercent(8, 'en-US')).toBe('+8%');
	});

	it('prints at most one decimal', () => {
		expect(formatSignedPercent(3.14, 'en-US')).toBe('+3.1%');
	});

	it("prints the decimal in the reader's locale", () => {
		expect(formatSignedPercent(3.1, 'de-DE')).toBe('+3,1%');
	});
});
