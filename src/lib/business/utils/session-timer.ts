/* The day's session clock and nothing else: stopping it leaves a reading that the first
   🪫 editor opened on either screen claims, and writes no log. The claim rule is the
   pages' (`measurement-prompt.ts`), not this file's — all it knows is whether there is a
   reading to hand out. */

export type SessionTimer = {
	phase: 'running' | 'paused' | 'stopped';
	/** The day it was started on. A new 🪫 measurement is today's alone, so a timer
	 *  carrying any other day is dropped rather than carried over. */
	startedOn: string;
	/** Epoch ms the current running segment began; `null` while it is not running. */
	runningSince: number | null;
	accumulatedMs: number;
};

const totalMs = (timer: SessionTimer, now: number) =>
	timer.accumulatedMs + (timer.runningSince === null ? 0 : now - timer.runningSince);

/* Floored: a device clock corrected backwards mid-segment (an NTP fix after a bad RTC
   boot) makes the segment negative, and `formatDuration` renders a negative total as
   "-1h -5m". */
const halt = (timer: SessionTimer, phase: SessionTimer['phase'], now: number): SessionTimer => ({
	...timer,
	phase,
	runningSince: null,
	accumulatedMs: Math.max(0, totalMs(timer, now)),
});

/** Starts a timer, or resumes a paused one — the button reads differently, the
 *  transition does not. */
export const runTimer = (timer: SessionTimer | null, today: string, now: number): SessionTimer => ({
	phase: 'running',
	startedOn: today,
	runningSince: now,
	accumulatedMs: timer?.accumulatedMs ?? 0,
});

export const pauseTimer = (timer: SessionTimer, now: number) => halt(timer, 'paused', now);

export const stopTimer = (timer: SessionTimer, now: number) => halt(timer, 'stopped', now);

const toMinutes = (ms: number) => Math.round(ms / 60_000);

/** What the readout shows. Rounded once here: rounding at each pause would let a run of
 *  short segments drift the reading off the clock. */
export const getElapsedMinutes = (timer: SessionTimer, now: number): number =>
	toMinutes(totalMs(timer, now));

/** The minutes a 🪫 log may be seeded from — a STOPPED timer's, and nothing else. A
 *  clock still counting would fund a second log from the same minutes, and the first
 *  log would take the rest of the session with it. Under half a minute is not a
 *  session, so it seeds nothing and the field stays empty. */
export function getPendingMinutes(timer: SessionTimer | null): number | null {
	if (timer === null || timer.phase !== 'stopped') return null;

	const minutes = toMinutes(timer.accumulatedMs);

	return minutes > 0 ? minutes : null;
}

export function sanitizeSessionTimer(value: unknown, today: string): SessionTimer | null {
	if (typeof value !== 'object' || value === null) return null;

	const { phase, startedOn, runningSince, accumulatedMs } = value as Record<string, unknown>;

	if (phase !== 'running' && phase !== 'paused' && phase !== 'stopped') return null;

	if (startedOn !== today) return null;

	if (typeof accumulatedMs !== 'number' || !Number.isFinite(accumulatedMs)) return null;

	const isRunning = phase === 'running';

	if (isRunning && (typeof runningSince !== 'number' || !Number.isFinite(runningSince)))
		return null;

	return {
		phase,
		startedOn: today,
		runningSince: isRunning ? (runningSince as number) : null,
		// hand-reachable storage, so the same floor as `halt` holds on read
		accumulatedMs: Math.max(0, accumulatedMs),
	};
}
