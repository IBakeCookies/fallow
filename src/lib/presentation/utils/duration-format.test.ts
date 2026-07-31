import { describe, expect, it } from 'vitest';
import { formatDuration, formatOffset } from '$lib/presentation/utils/duration-format';

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
