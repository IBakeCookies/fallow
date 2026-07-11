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

export function getStatusInRange(val: number, min: number, max: number): StatusType {
	if (val >= min && val <= max) return STATUS.SUCCESS;
	const distance = val < min ? min - val : val - max;
	if (distance <= 15) return STATUS.NEUTRAL;
	if (distance <= 30) return STATUS.WARNING;
	return STATUS.CRITICAL;
}
