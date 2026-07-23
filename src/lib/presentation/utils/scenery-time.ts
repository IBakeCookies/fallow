/* Data-driven scenery vars: unlike the seeded vars (scenery-seed.ts) these
   derive from the real clock — the sun's position for sundial, tonight's
   lunar phase for moonphase, the waking day's remaining hours for tide,
   the circumpolar sky's rotation for polaris.
   Computed once per page load (a background needs no live ticking). Every
   var has a CSS fallback (noon / full moon / half tide); the SSR value can
   differ from the client's timezone, so the attribute may shift once on
   hydration. */

const SYNODIC_DAYS = 29.53058867;
/* a known new moon: 2000-01-06 18:14 UTC */
const NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

export function dataSceneryStyle(now: Date): string {
	const hours = now.getHours() + now.getMinutes() / 60;

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
	const phase = (((now.getTime() - NEW_MOON_MS) / 86_400_000) % SYNODIC_DAYS) / SYNODIC_DAYS;
	const shadow = phase < 0.5 ? -4 * phase : 4 * (1 - phase);

	/* tide: the day's water — full early, ebbing to low at 23:00 */
	const tide = Math.min(1, Math.max(0, (23 - hours) / 16));

	/* polaris: the circumpolar sky's rotation in degrees — 15.041°/h of clock
	   time plus 0.9857°/day of seasonal drift (a sidereal day runs ~4 min short
	   of a solar day, so the same hour's sky turns through the year). Negative:
	   facing north, the sky rotates counterclockwise. vis is sundial's curve
	   inverted — the star clock wakes when the sundial sleeps. */
	const dayOfYear = (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86_400_000;
	const polaris = -((hours * 15.041 + dayOfYear * 0.9857) % 360);

	return [
		`--sundial-t: ${sun.toFixed(3)}`,
		`--sundial-alt: ${alt.toFixed(3)}`,
		`--sundial-vis: ${vis.toFixed(3)}`,
		`--moon-shadow: ${shadow.toFixed(3)}`,
		`--tide-level: ${tide.toFixed(3)}`,
		`--polaris-angle: ${polaris.toFixed(2)}`,
		`--polaris-vis: ${(1 - vis).toFixed(3)}`
	].join('; ');
}
