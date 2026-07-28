import { describe, it, expect, afterEach, vi } from 'vitest';
import { consoleSink, logError, logWarning, setLogSink, type LogEvent } from '$lib/logger';

describe('logger', () => {
	afterEach(() => {
		setLogSink(consoleSink);
		vi.restoreAllMocks();
	});

	it('hands the installed sink a structured event, context intact', () => {
		const events: LogEvent[] = [];
		const failure = new Error('quota exceeded');
		setLogSink((event) => events.push(event));

		logError('Failed to save session', failure, {
			date: '2026-07-28',
		});

		expect(events).toEqual([
			{
				level: 'error',
				message: 'Failed to save session',
				error: failure,
				context: {
					date: '2026-07-28',
				},
			},
		]);
	});

	it('distinguishes warnings from errors', () => {
		const levels: string[] = [];
		setLogSink((event) => levels.push(event.level));

		logWarning('upgrade blocked');
		logError('load failed');

		expect(levels).toEqual(['warn', 'error']);
	});

	// The default has to reach the console, or swapping the sink in later would
	// be swapping in the app's only logging rather than replacing it.
	it('writes to the matching console method until a sink is installed', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const failure = new Error('boom');

		logError('Failed to load', failure, {
			date: '2026-07-28',
		});

		expect(spy).toHaveBeenCalledWith('Failed to load', failure, {
			date: '2026-07-28',
		});
	});

	it('omits absent error and context rather than logging undefined', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		logWarning('upgrade blocked');

		expect(spy).toHaveBeenCalledWith('upgrade blocked');
	});
});
