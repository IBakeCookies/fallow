/* Data-driven scenery vars: unlike the seeded vars (scenery-seed.ts) these
   derive from the real clock — the sun's position for sundial, tonight's
   lunar phase for moonphase, the waking day's remaining hours for tide,
   the circumpolar sky's rotation for polaris, the sky's darkness for
   city-windows, the day/week planet angles for orrery.
   Recomputed every minute by the layout — these are positions, not
   animations, so they must follow the real clock for a tab left open all
   day. Every var has a CSS fallback (noon / full moon / half tide). SSR
   renders the request's IP-derived timezone (nowInTimeZone below);
   hydration does NOT re-patch the attribute, so the layout re-derives from
   the client clock in onMount — the value may shift once shortly after
   load. */

/* The fields the vars below actually read, so the wall clock never has to be
   smuggled through a Date whose epoch has been shifted into the target zone:
   that shifted the absolute instant too (the moon phase was off by up to
   ±12h) and depended on `toLocaleString` output staying re-parseable. */
export interface WallClock {
	/** Hours since local midnight, fractional. */
	hours: number;
	/** 0 = Sunday, as `Date#getDay`. */
	dayOfWeek: number;
	/** Fractional days since local January 1st. */
	dayOfYear: number;
	/** The true instant, unshifted — for anything measured against an epoch. */
	epochMs: number;
}

const CLOCK_FIELDS: Intl.DateTimeFormatOptions = {
	year: 'numeric',
	month: 'numeric',
	day: 'numeric',
	hour: 'numeric',
	minute: 'numeric',
	// h23, not hour12: false — the latter renders midnight as hour 24 in some ICU
	// builds.
	hourCycle: 'h23',
};

/* An unknown or malformed zone throws at construction (x-vercel-ip-timezone is
   absent on any non-Vercel host), so fall back to the runtime's own zone rather
   than to a wrong wall clock. */
function readClockFields(at: Date, timeZone?: string): Intl.DateTimeFormatPart[] {
	try {
		return new Intl.DateTimeFormat('en-US', {
			timeZone,
			...CLOCK_FIELDS,
		}).formatToParts(at);
	} catch {
		return new Intl.DateTimeFormat('en-US', CLOCK_FIELDS).formatToParts(at);
	}
}

/* Wall-clock "now" in an IANA timezone — SSR passes the request's IP-derived
   timezone so the inlined scenery state is already the visitor's local time.
   Called with no argument on the client, where the runtime's own zone is the
   right answer. */
export function nowInTimeZone(timeZone?: string): WallClock {
	const at = new Date();
	const parts = readClockFields(at, timeZone);

	const read = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value);

	const year = read('year');
	const hours = read('hour') + read('minute') / 60;
	/* Both ends in UTC, so the difference is whole days whatever DST did in
	   between. */
	const midnight = Date.UTC(year, read('month') - 1, read('day'));

	return {
		hours,
		dayOfWeek: new Date(midnight).getUTCDay(),
		dayOfYear: (midnight - Date.UTC(year, 0, 1)) / 86_400_000 + hours / 24,
		epochMs: at.getTime(),
	};
}

const SYNODIC_DAYS = 29.53058867;
/* a known new moon: 2000-01-06 18:14 UTC */
const NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

/* 0 below `from`, 1 above `to`, linear between — the building block for the
   foliage season windows below. */
function rampBetween(value: number, from: number, to: number): number {
	return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

export function dataSceneryStyle(clock: WallClock): string {
	const { hours } = clock;
	/* sundial: 0 at 06:00 → 1 at 20:00, clamped; alt is the sun's altitude
	   arc (0 at the ends, 1 at noon); vis fades the whole scenery out over
	   the hour past 20:00 and back in before 06:00 — at night the dial sleeps */
	const sun = Math.min(1, Math.max(0, (hours - 6) / 14));
	const alt = Math.sin(Math.PI * sun);
	const vis = Math.min(1, Math.max(0, Math.min(hours - 5, 21 - hours)));
	/* moonphase: 0 = new, 0.5 = full. The value is the shadow disc's offset
	   in moon radii — it slides left off the lit disc as the moon waxes
	   (lit edge grows on the right) and returns from the right as it wanes;
	   ±2 radii = fully lit, 0 = new. */
	const phase = (((clock.epochMs - NEW_MOON_MS) / 86_400_000) % SYNODIC_DAYS) / SYNODIC_DAYS;
	const shadow = phase < 0.5 ? -4 * phase : 4 * (1 - phase);
	/* tide: the day's water — full early, ebbing to low at 23:00 */
	const tide = Math.min(1, Math.max(0, (23 - hours) / 16));
	/* city-windows: how dark the sky is — vis inverted, so the skyline's
	   windows light in waves as the sun goes down (thresholds in the CSS) */
	const dark = 1 - vis;
	/* orrery: planet angles in degrees, clockwise from 12 o'clock. The inner
	   planet laps once per day (midnight at the top), the outer once per ISO
	   week (Monday 00:00 at the top). */
	const dayAngle = (hours / 24) * 360;
	const weekAngle = ((((clock.dayOfWeek + 6) % 7) + hours / 24) / 7) * 360;
	/* polaris: the circumpolar sky's rotation in degrees — 15.041°/h of clock
	   time plus 0.9857°/day of seasonal drift (a sidereal day runs ~4 min short
	   of a solar day, so the same hour's sky turns through the year). Negative:
	   facing north, the sky rotates counterclockwise. vis is sundial's curve
	   inverted — the star clock wakes when the sundial sleeps. */
	const polaris = -((hours * 15.041 + clock.dayOfYear * 0.9857) % 360);
	/* hourglass: the hour's sand — full on the hour, empty at :59, refilled
	   ("flipped") at the next :00. A level, not an animation: it steps down
	   with each minutely recompute like every var here. */
	const hourglassLevel = 1 - (hours % 1);
	/* circuit: the board's heat — cold at midnight, peaking at noon, cooling
	   back toward the next midnight. The CSS maps it to hue and glow. */
	const circuitHeat = Math.sin((Math.PI * hours) / 24);
	/* weathervane: the hour hand's bearing in degrees, clockwise from 12 —
	   30°/h, so 12:00 points straight up and 03:00 to the right. It wraps at
	   noon and not at midnight, because that is what an hour hand does; every
	   vane in the field is turned to this one number. */
	const vaneAngle = ((hours % 12) / 12) * 360;
	/* foliage: three leaf layers over the day of the year, each a plateau with
	   linear on/off ramps (zero-based, non-leap: day 59 = Mar 1, 151 = Jun 1,
	   243 = Sep 1, 334 = Dec 1). Buds carry spring, the full canopy carries
	   summer and thins through autumn while the warm layer turns, and by
	   December the branch is bare. Northern-hemisphere seasons, like polaris's
	   northern sky. */
	const { dayOfYear } = clock;
	const foliageBuds = rampBetween(dayOfYear, 59, 90) * (1 - rampBetween(dayOfYear, 120, 151));
	const foliageSummer = rampBetween(dayOfYear, 105, 151) * (1 - rampBetween(dayOfYear, 243, 319));
	const foliageAutumn = rampBetween(dayOfYear, 243, 283) * (1 - rampBetween(dayOfYear, 305, 334));

	return [
		`--sundial-t: ${sun.toFixed(3)}`,
		`--sundial-alt: ${alt.toFixed(3)}`,
		`--sundial-vis: ${vis.toFixed(3)}`,
		`--moon-shadow: ${shadow.toFixed(3)}`,
		`--tide-level: ${tide.toFixed(3)}`,
		`--city-dark: ${dark.toFixed(3)}`,
		`--orrery-day: ${dayAngle.toFixed(2)}`,
		`--orrery-week: ${weekAngle.toFixed(2)}`,
		`--polaris-angle: ${polaris.toFixed(2)}`,
		`--polaris-vis: ${(1 - vis).toFixed(3)}`,
		`--hourglass-level: ${hourglassLevel.toFixed(3)}`,
		`--circuit-heat: ${circuitHeat.toFixed(3)}`,
		`--vane-angle: ${vaneAngle.toFixed(2)}`,
		`--foliage-buds: ${foliageBuds.toFixed(3)}`,
		`--foliage-summer: ${foliageSummer.toFixed(3)}`,
		`--foliage-autumn: ${foliageAutumn.toFixed(3)}`,
	].join('; ');
}
