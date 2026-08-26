import { describe, expect, it } from 'vitest';
import {
	getElapsedMinutes,
	getPendingMinutes,
	pauseTimer,
	runTimer,
	sanitizeSessionTimer,
	stopTimer,
} from '$lib/business/utils/session-timer';

const TODAY = '2026-08-22';
const START = 1_800_000_000_000;
const at = (minutes: number) => START + minutes * 60_000;

describe('getElapsedMinutes', () => {
	// Milliseconds accumulate and minutes are rounded once, at read: rounding each
	// segment would let a run of short pauses drift the reading off the clock.
	it('sums the running segments and leaves out the pause', () => {
		const started = runTimer(null, TODAY, START);
		const paused = pauseTimer(started, at(10));
		const resumed = runTimer(paused, TODAY, at(40));

		expect(getElapsedMinutes(resumed, at(45))).toBe(15);
	});
});

describe('stopTimer', () => {
	// Start then Stop is the only path the 🪫 editor is seeded from, so the segment
	// still running when Stop is pressed has to land in the reading.
	it('keeps the segment that was running when it stopped', () => {
		expect(getPendingMinutes(stopTimer(runTimer(null, TODAY, START), at(45)))).toBe(45);
	});

	it('sums two running segments and leaves out the pause', () => {
		const paused = pauseTimer(runTimer(null, TODAY, START), at(10));
		const resumed = runTimer(paused, TODAY, at(40));

		expect(getPendingMinutes(stopTimer(resumed, at(45)))).toBe(15);
	});

	// A clock corrected backwards mid-segment would otherwise store a negative total,
	// which `formatDuration` renders as "-1h -5m".
	it('floors a backwards clock correction at zero', () => {
		const stopped = stopTimer(runTimer(null, TODAY, START), at(-5));

		expect(getElapsedMinutes(stopped, at(-5))).toBe(0);
	});
});

describe('getPendingMinutes', () => {
	const stopped = (accumulatedMs: number) => ({
		phase: 'stopped' as const,
		startedOn: TODAY,
		runningSince: null,
		accumulatedMs,
	});

	it("offers a stopped timer's whole minutes", () => {
		expect(getPendingMinutes(stopped(45 * 60_000))).toBe(45);
	});

	// A clock still counting would fund a second log from the same minutes,
	// and the first log would take the rest of the session with it.
	it('offers nothing while the timer is still running', () => {
		expect(getPendingMinutes(runTimer(null, TODAY, START))).toBeNull();
	});

	it('offers nothing for a session shorter than half a minute', () => {
		expect(getPendingMinutes(stopped(20_000))).toBeNull();
	});
});

describe('sanitizeSessionTimer', () => {
	// A new 🪫 measurement is today-only, and forgetting to stop overnight is the
	// commonest way a timer goes wrong — one check disposes of both.
	it('drops a timer that did not start today', () => {
		expect(
			sanitizeSessionTimer(
				{
					phase: 'running',
					startedOn: '2026-08-21',
					runningSince: START,
					accumulatedMs: 0,
				},
				TODAY,
			),
		).toBeNull();
	});

	it('drops a timer whose accumulated time is not a finite number', () => {
		expect(
			sanitizeSessionTimer(
				{
					phase: 'paused',
					startedOn: TODAY,
					runningSince: null,
					accumulatedMs: 'a while',
				},
				TODAY,
			),
		).toBeNull();
	});

	// The same floor as the write path: storage is hand-reachable, so a negative
	// total can arrive from outside the timer's own transitions.
	it('floors a negative accumulated time at zero', () => {
		expect(
			sanitizeSessionTimer(
				{
					phase: 'paused',
					startedOn: TODAY,
					runningSince: null,
					accumulatedMs: -300_000,
				},
				TODAY,
			)?.accumulatedMs,
		).toBe(0);
	});
});
