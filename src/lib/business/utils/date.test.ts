import { describe, it, expect } from 'vitest';
import { toISODate, fromISO, addDays, startOfWeek, monthGrid } from './date';

describe('date utilities', () => {
	it('round-trips ISO dates through Date', () => {
		for (const iso of ['2026-01-01', '2026-02-28', '2026-07-11', '2026-12-31']) {
			expect(toISODate(fromISO(iso))).toBe(iso);
		}
	});

	it('addDays crosses month and year boundaries', () => {
		expect(addDays('2026-07-11', 1)).toBe('2026-07-12');
		expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
		expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
		expect(addDays('2024-02-28', 1)).toBe('2024-02-29'); // leap year
		expect(addDays('2026-07-11', -30)).toBe('2026-06-11');
	});

	it('addDays is stable across DST transitions (Europe: late March / late October)', () => {
		expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
		expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
	});

	it('startOfWeek returns the Monday for every day of the week', () => {
		// 2026-07-06 is a Monday
		for (let i = 0; i < 7; i++) {
			expect(startOfWeek(addDays('2026-07-06', i))).toBe('2026-07-06');
		}
		expect(startOfWeek('2026-07-05')).toBe('2026-06-29'); // Sunday → previous Monday
	});

	it('monthGrid covers the whole month in Mon–Sun weeks', () => {
		// July 2026: 1st is a Wednesday, 31 days
		const grid = monthGrid(2026, 6);
		const flat = grid.flat();

		for (const week of grid) {
			expect(week).toHaveLength(7);
			expect(fromISO(week[0]).getDay()).toBe(1); // Monday
			expect(fromISO(week[6]).getDay()).toBe(0); // Sunday
		}
		// contiguous run of days
		for (let i = 1; i < flat.length; i++) {
			expect(flat[i]).toBe(addDays(flat[i - 1], 1));
		}
		expect(flat).toContain('2026-07-01');
		expect(flat).toContain('2026-07-31');
		expect(flat[0]).toBe('2026-06-29'); // leading days from June
	});

	it('monthGrid handles a month starting on Monday with no leading days', () => {
		// June 2026: 1st is a Monday, 30 days → exactly 5 weeks
		const grid = monthGrid(2026, 5);
		expect(grid[0][0]).toBe('2026-06-01');
		expect(grid).toHaveLength(5);
		expect(grid[4][6]).toBe('2026-07-05');
	});
});
