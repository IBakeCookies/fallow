// Each is both its fit's clamp and the Energy Lab stepper's range, so a fitted value is
// always one the stepper can hold and "Apply my fits" can write. The clamp doubles as
// the fits' absurdity guard: inconsistent ratings pin a value to an edge, never past it.
// In `utils/`, not `model/`, because the Lab route value-imports them too (R1).
export const ALPHA_FIT_MIN = 0.05;

export const ALPHA_FIT_MAX = 2;

export const RECOVERY_FIT_MIN = 0.1;

export const RECOVERY_FIT_MAX = 3;

export const STOP_FIT_MIN = 0;

export const STOP_FIT_MAX = 3;
