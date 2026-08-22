// One source for every control over `session.availableHours`: the day bar's field
// and slider, and the Energy Lab's window-hours row. The store's setter neither
// clamps nor validates, so these bounds are the only thing below the UI.
// `step` is what a control MOVES by — the steppers' click and the slider's drag —
// and never what a budget must be: off-quarter budgets are typed here and applied
// from plan advice, which MATH.md §14.1-2 keeps exact. No control may sanitize the
// value to it; the range carries `step="any"` and snaps its own drag for that reason.
export const BUDGET_BOUNDS = {
	min: 0,
	max: 24,
	step: 0.25,
};

// Presentation's, on the argument `band.ts` makes for its thresholds: no formula
// reads a start time, so what a day with none opens on is a display decision.
export const DEFAULT_START_HOUR = 9;
