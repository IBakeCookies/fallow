import { describe, it, expect } from 'vitest';
import { summarizeBudgetHistory, prefillBudgetFor } from '$lib/business/model/budget-memory';
import { addDays } from '$lib/business/utils/date';
import type { DailySession } from '$lib/data/type';

// Dates a week apart share a weekday, so the fixtures say which weekday they are
// about without naming one — the calendar is the same fact in both directions.
const MONDAY = '2026-08-03';
const TUESDAY = '2026-08-04';

const session = (date: string, availableHours: number): DailySession => ({
	date,
	tasks: [],
	availableHours,
	switchCost: 0.25,
	updatedAt: 0,
});

const prefillFrom = (sessions: DailySession[], date: string): number =>
	prefillBudgetFor(summarizeBudgetHistory(sessions), date);

describe('prefillBudgetFor', () => {
	it('answers with what that weekday usually gets, not with the whole history', () => {
		const history = [
			session(MONDAY, 2),
			session(addDays(MONDAY, -7), 2),
			session(TUESDAY, 9),
			session(addDays(TUESDAY, -7), 9),
			session(addDays(TUESDAY, -14), 9),
		];

		expect(prefillFrom(history, addDays(MONDAY, 7))).toBe(2);
		expect(prefillFrom(history, addDays(TUESDAY, 7))).toBe(9);
	});

	it('falls back to the overall median on a weekday never budgeted', () => {
		const history = [session(MONDAY, 3), session(TUESDAY, 5), session(addDays(TUESDAY, -7), 5)];

		expect(prefillFrom(history, addDays(MONDAY, 2))).toBe(5);
	});

	it('offers nothing when nothing has ever been budgeted', () => {
		expect(prefillFrom([], MONDAY)).toBe(0);
	});

	// A stored day the user never budgeted is not evidence of a habit — it is a
	// day they added a task to and left. Counting it drags every median toward 0,
	// which is the reading this whole prefill exists to replace.
	it('reads a day with no budget as no evidence, not as a budget of zero', () => {
		const history = [
			session(MONDAY, 0),
			session(addDays(MONDAY, -7), 0),
			session(addDays(MONDAY, -14), 6),
		];

		expect(prefillFrom(history, addDays(MONDAY, 7))).toBe(6);
	});

	// The lower of the two middles, so the prefill is always a number the user
	// really declared on that weekday rather than an average of two they did.
	it('takes the lower middle of an even count', () => {
		const history = [session(MONDAY, 4), session(addDays(MONDAY, -7), 7)];

		expect(prefillFrom(history, addDays(MONDAY, 7))).toBe(4);
	});
});
