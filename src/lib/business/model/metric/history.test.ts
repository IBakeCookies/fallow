import { describe, it, expect } from 'vitest';
import { currentStreak } from './history';

describe('currentStreak', () => {
	const today = '2026-07-11';

	it('counts consecutive completed days ending today', () => {
		const dates = new Set(['2026-07-09', '2026-07-10', '2026-07-11']);
		expect(currentStreak(dates, today)).toBe(3);
	});

	it('does not break the streak when today has no completion yet', () => {
		const dates = new Set(['2026-07-09', '2026-07-10']);
		expect(currentStreak(dates, today)).toBe(2);
	});

	it('breaks on a gap', () => {
		const dates = new Set(['2026-07-07', '2026-07-08', '2026-07-10', '2026-07-11']);
		expect(currentStreak(dates, today)).toBe(2);
	});

	it('is zero with no recent completions', () => {
		expect(currentStreak(new Set(['2026-07-01']), today)).toBe(0);
		expect(currentStreak(new Set(), today)).toBe(0);
	});
});
