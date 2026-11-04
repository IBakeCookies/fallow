// A negative cost, reachable mid-typing since the number input clamps on blur,
// bills as no switching rather than crediting the budget; NaN bills none too.
export function clampSwitchCost(switchCost: number): number {
	return Math.max(0, Number(switchCost) || 0);
}
