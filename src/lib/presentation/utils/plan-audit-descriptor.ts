/* The verdict the plan-adherence card prints, and the band that decides it.

   A threshold that picks a winner between the two planners is policy, not markup
   (AGENTS.md R2), and it lived in `analytics/+page.svelte` where nothing could
   reach it: the tie band's two edges are the whole behaviour and neither had a
   test. */

import * as m from '$lib/paraglide/messages.js';
import type { PlanAudit } from '$lib/business/model/plan-audit';

/**
 * Overlap gap inside this band reads as a tie rather than a winner. The width is
 * measured, not asserted: MATH.md §9 derives it, and
 * `scripts/adherence-tie-band.probe.ts` is the instrument that sizes it.
 */
export const ADHERENCE_TIE_BAND = 0.2;

/**
 * Which planner the days actually worked resemble more; `null` when there is
 * nothing scored to compare, which the card renders as its empty state instead.
 */
export function adherenceVerdict(audit: PlanAudit | null): string | null {
	if (audit === null || audit.usedCount === 0) return null;

	const diff = audit.energyOverlap - audit.classicOverlap;

	if (diff > ADHERENCE_TIE_BAND) return m.ana_adherence_verdict_energy();

	if (diff < -ADHERENCE_TIE_BAND) return m.ana_adherence_verdict_classic();

	return m.ana_adherence_verdict_tie();
}
