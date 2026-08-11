// One source for every control over `session.availableHours`: the day bar's field
// and slider, and the Energy Lab's window-hours row. The store's setter neither
// clamps nor validates, so these bounds are the only thing below the UI.
// `step` binds the slider only: off-quarter budgets are typed (MATH.md §14.1).
export const BUDGET_BOUNDS = {
	min: 0,
	max: 24,
	step: 0.25,
};
