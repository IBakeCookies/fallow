import { describe, it, expect } from 'vitest';
import {
	toISODate,
	fromISO,
	addDays,
	daysBetween,
	startOfWeek,
	monthGrid,
	isISODate,
} from '$lib/business/utils/date';

describe('date utilities', () => {
	it('isISODate accepts real days', () => {
		for (const iso of ['2026-01-01', '2024-02-29', '2026-07-11', '2026-12-31']) {
			expect(isISODate(iso)).toBe(true);
		}
	});

	it('isISODate rejects days that look valid but do not exist', () => {
		// Date rolls these forward silently, so the regex alone would key a
		// session under a day every label renders as a different one.
		for (const iso of ['2026-02-30', '2026-02-31', '2026-04-31', '2025-02-29']) {
			expect(isISODate(iso)).toBe(false);
		}
	});

	it('isISODate rejects out-of-range parts and anything not YYYY-MM-DD', () => {
		for (const value of [
			'2026-13-01',
			'2026-00-10',
			'2026-01-32',
			'2026-1-01',
			'2026/07/11',
			'2026-07-11T12:00:00',
			'',
			null,
			undefined,
			20260711,
			new Date(),
		]) {
			expect(isISODate(value)).toBe(false);
		}
	});

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

	// The ⚡ recency weights are 2^(−daysBetween/365) (MATH.md §5.2), so a day
	// miscounted here silently mis-weights a log.
	it('daysBetween counts whole days in both directions', () => {
		expect(daysBetween('2026-07-11', '2026-07-11')).toBe(0);
		expect(daysBetween('2026-07-11', '2026-07-12')).toBe(1);
		expect(daysBetween('2026-07-12', '2026-07-11')).toBe(-1);
		expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
		expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // leap year
		expect(daysBetween('2025-07-11', '2026-07-11')).toBe(365);
	});

	// A 23- and a 25-hour day sit inside these spans; dividing elapsed
	// milliseconds without the noon anchor would round one of them to 1 or 3.
	it('daysBetween is stable across DST transitions', () => {
		expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
		expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
	});

	it('startOfWeek returns the Monday for every day of the week', () => {
		// 2026-07-06 is a Monday
		for (let i = 0; i < 7; i++) {
			expect(startOfWeek(addDays('2026-07-06', i), 1)).toBe('2026-07-06');
		}

		expect(startOfWeek('2026-07-05', 1)).toBe('2026-06-29'); // Sunday → previous Monday
	});

	it('startOfWeek honours a Sunday-first locale', () => {
		// 2026-07-05 is a Sunday
		for (let i = 0; i < 7; i++) {
			expect(startOfWeek(addDays('2026-07-05', i), 7)).toBe('2026-07-05');
		}

		expect(startOfWeek('2026-07-04', 7)).toBe('2026-06-28'); // Saturday → previous Sunday
	});

	it('monthGrid covers the whole month in Mon–Sun weeks', () => {
		// July 2026: 1st is a Wednesday, 31 days
		const grid = monthGrid(2026, 6, 1);
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
		const grid = monthGrid(2026, 5, 1);
		expect(grid[0][0]).toBe('2026-06-01');
		expect(grid).toHaveLength(5);
		expect(grid[4][6]).toBe('2026-07-05');
	});

	it('monthGrid starts its weeks on the locale first day', () => {
		const grid = monthGrid(2026, 6, 7); // July 2026, Sunday-first

		for (const week of grid) {
			expect(week).toHaveLength(7);
			expect(fromISO(week[0]).getDay()).toBe(0); // Sunday
			expect(fromISO(week[6]).getDay()).toBe(6); // Saturday
		}

		expect(grid[0][0]).toBe('2026-06-28');
		expect(grid.flat()).toContain('2026-07-31');
	});
});
