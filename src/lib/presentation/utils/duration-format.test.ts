import { describe, expect, it } from 'vitest';
import {
	formatClock,
	formatDuration,
	formatOffset,
	parseClock,
} from '$lib/presentation/utils/duration-format';

describe('formatDuration', () => {
	it.each([
		[0, '0m'],
		[0.75, '45m'],
		[1, '1h'],
		[1.5, '1h 30m'],
		[8.25, '8h 15m'],
	])('renders %f hours as %s', (hours, expected) => {
		expect(formatDuration(hours)).toBe(expected);
	});

	// The rollover the two old copies spelled differently: rounding the remainder
	// alone yields "1h 60m", flooring the total alone loses the last minute.
	it.each([
		[1.9999, '2h'],
		[0.99999, '1h'],
		[0.008, '0m'],
	])('rolls %f hours up to %s rather than to 60 minutes', (hours, expected) => {
		expect(formatDuration(hours)).toBe(expected);
	});
});

describe('formatOffset', () => {
	// The start of the window is an elapsed-hours zero, not midnight — "0:00" read
	// as a wall clock, which is the whole reason offsets replaced clock times.
	it('renders the start of the window as 0h', () => {
		expect(formatOffset(0)).toBe('0h');
	});

	it.each([
		[6.5, '6h 30m'],
		[13, '13h'],
	])('renders the %f-hour offset as %s', (hours, expected) => {
		expect(formatOffset(hours)).toBe(expected);
	});
});

describe('formatClock', () => {
	it.each([
		[9, '09:00'],
		[7.5, '07:30'],
		[17.25, '17:15'],
		[0, '00:00'],
	])('renders %f hours past midnight as %s', (hours, expected) => {
		expect(formatClock(hours)).toBe(expected);
	});

	// A day's end is its start plus its budget, which a late start pushes past
	// midnight — and 25:00 is not a time any clock or `<input type="time">` reads.
	it('wraps a range that runs past midnight', () => {
		expect(formatClock(20 + 8)).toBe('04:00');
	});
});

describe('parseClock', () => {
	it.each([
		['07:30', 7.5],
		['00:00', 0],
		['23:45', 23.75],
	])('reads %s back as %f hours', (value, expected) => {
		expect(parseClock(value)).toBe(expected);
	});

	// What a cleared field sends. The bar's own guard rests on this being null
	// rather than 0, which would silently move the day's start to midnight.
	it.each(['', 'noon', '7:3'])('refuses %o', (value) => {
		expect(parseClock(value)).toBeNull();
	});
});
