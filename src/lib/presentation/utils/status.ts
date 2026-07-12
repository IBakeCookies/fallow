/**
 * Metric value → Tailwind class mappings. This is presentation policy (colors
 * for good/bad readings), so it lives here and not with the metric math.
 */

export const STATUS = {
	SUCCESS: { label: 'Optimal', color: 'text-emerald-400' },
	NEUTRAL: { label: 'Nominal', color: 'text-zinc-200' },
	WARNING: { label: 'Caution', color: 'text-amber-400' },
	CRITICAL: { label: 'Critical', color: 'text-red-400' }
} as const;

export type StatusType = (typeof STATUS)[keyof typeof STATUS];

export function getStatusBiggerBetter(val: number): StatusType {
	if (val >= 75) return STATUS.SUCCESS;
	if (val >= 50) return STATUS.NEUTRAL;
	if (val >= 25) return STATUS.WARNING;
	return STATUS.CRITICAL;
}

export function getStatusSmallerBetter(val: number): StatusType {
	if (val <= 25) return STATUS.SUCCESS;
	if (val <= 50) return STATUS.NEUTRAL;
	if (val <= 75) return STATUS.WARNING;
	return STATUS.CRITICAL;
}

/**
 * Background class for completion bars/fills, same thresholds as
 * getStatusBiggerBetter (which only provides text-* classes).
 */
export function getCompletionBarClass(rate: number): string {
	if (rate >= 75) return 'bg-emerald-400';
	if (rate >= 50) return 'bg-zinc-300';
	if (rate >= 25) return 'bg-amber-400';
	return 'bg-red-400';
}
