/* Per-user scenery variety: one persisted 32-bit seed → deterministic CSS
   vars consumed by style/scenery/*.css. Every var has a CSS fallback equal to
   the hand-tuned look, so no-JS and un-seeded themes are unaffected. Server
   and client derive identical values from the same seed, so the style is
   SSR-inlined with no FOUC or hydration shift.

   Rules (see style/scenery/*.css comments):
   - offset background-position only on axes no keyframe animates
   - seamless one-tile drifts (zenith clouds, orbit-glide) are
     phased via animation-delay, never position-offset (breaks the wrap)
   - CSS vars can only move/retime existing gradients, never add stops */

/* mulberry32 — tiny deterministic PRNG over one 32-bit state word */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/* FNV-1a — theme name → PRNG stream key */
function hashName(name: string): number {
	let h = 0x811c9dc5;

	for (let i = 0; i < name.length; i++) {
		h = Math.imul(h ^ name.charCodeAt(i), 0x01000193);
	}

	return h >>> 0;
}

/* One PRNG per theme, keyed by its name. Draw order only has to stay stable
   WITHIN a theme, so adding, reordering or retuning one theme can never
   reshuffle another one's arrangement. */
function themeRandom(seed: number, name: string) {
	const rnd = mulberry32(seed ^ hashName(name));
	const between = (min: number, max: number) => min + rnd() * (max - min);
	const rem = (min: number, max: number) => `${between(min, max).toFixed(1)}rem`;

	return {
		between,
		rem,
		sec: (min: number, max: number) => `${between(min, max).toFixed(1)}s`,
		/* offset within one background tile — both axes must be non-animated */
		tile: (w: number, h: number) => `${rem(0, w)} ${rem(0, h)}`,
	};
}

/* meridian hero ribbons — tuned lane/hue/width/opacity per stroke; only the
   anchor and control-point coordinates jitter (see meridianRibbonsUrl) */
const MERIDIAN_RIBBONS = [
	{
		stroke: '%2322d3ee',
		width: 3,
		opacity: 0.55,
		y: 120,
		c1: [200, 40],
		c2: [380, 260],
		midX: 620,
		midY: 140,
		c4: [980, 200],
		endY: 120,
	},
	{
		stroke: '%23a78bfa',
		width: 2.5,
		opacity: 0.42,
		y: 320,
		c1: [180, 480],
		c2: [380, 220],
		midX: 600,
		midY: 380,
		c4: [980, 300],
		endY: 380,
	},
	{
		stroke: '%23fbbf24',
		width: 2,
		opacity: 0.4,
		y: 520,
		c1: [220, 380],
		c2: [420, 620],
		midX: 660,
		midY: 460,
		c4: [980, 520],
		endY: 440,
	},
	{
		stroke: '%2367e8f9',
		width: 4,
		opacity: 0.5,
		y: 60,
		c1: [240, 260],
		c2: [440, -60],
		midX: 680,
		midY: 140,
		c4: [980, 60],
		endY: 180,
	},
	{
		stroke: '%23fb7185',
		width: 2,
		opacity: 0.32,
		y: 700,
		c1: [200, 560],
		c2: [460, 800],
		midX: 700,
		midY: 640,
		c4: [980, 700],
		endY: 620,
	},
	{
		stroke: '%23c4b5fd',
		width: 3,
		opacity: 0.4,
		y: 260,
		c1: [180, 100],
		c2: [420, 400],
		midX: 660,
		midY: 240,
		c4: [980, 300],
		endY: 220,
	},
];

/* seeded ribbon geometry: anchors (start/mid/end y) jitter ±80, control
   points jitter ±120 y / ±60 x — hue, width, opacity and the anchor x's
   (-50, midX, 1080) stay exactly as tuned, so the sweep always reads as
   the same six ribbons, just redrawn. c3 is never jittered independently:
   it's c2 reflected through the mid anchor (S-command style) plus a small
   ±40 nudge, so the tangent through the mid anchor stays straight and the
   ribbon can't kink there. */
function meridianRibbonsUrl(between: (min: number, max: number) => number): string {
	const jY = (v: number) => Math.round(v + between(-80, 80));
	const jCy = (v: number) => Math.round(v + between(-120, 120));
	const jCx = (v: number) => Math.round(v + between(-60, 60));

	const paths = MERIDIAN_RIBBONS.map((r) => {
		const y0 = jY(r.y);
		const c1x = jCx(r.c1[0]);
		const c1y = jCy(r.c1[1]);
		const c2x = jCx(r.c2[0]);
		const c2y = jCy(r.c2[1]);
		const midY = jY(r.midY);
		const c3x = Math.round(2 * r.midX - c2x + between(-40, 40));
		const c3y = Math.round(2 * midY - c2y + between(-40, 40));
		const c4x = jCx(r.c4[0]);
		const c4y = jCy(r.c4[1]);
		const endY = jY(r.endY);

		return `<path d='M-50 ${y0} C${c1x} ${c1y} ${c2x} ${c2y} ${r.midX} ${midY} C${c3x} ${c3y} ${c4x} ${c4y} 1080 ${endY}' stroke='${r.stroke}' stroke-width='${r.width}' opacity='${r.opacity}'/>`;
	}).join('');

	return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000' preserveAspectRatio='xMidYMid slice'><g fill='none' stroke-linecap='round' stroke-linejoin='round'>${paths}</g></svg>")`;
}

/* dunes ridge silhouettes — three filled bezier hills (far/mid/near), tuned
   fill/opacity per depth; only the crest/trough y's jitter (x lanes and
   period stay put, so the layers keep reading as distinct depths). Anchors
   at (0, 300) and viewBox bottom close the shape into solid ground. Each
   layer also carries a sunlit crest stroke retraced along its open top
   curve (never the closing edges), brighter and wider the nearer the layer. */
const DUNES_LAYERS: {
	points: [number, number][];
	jitter: number;
	fill: string;
	opacity: number;
	crest: string;
	crestWidth: number;
	crestOpacity: number;
}[] = [
	{
		points: [
			[0, 175],
			[150, 110],
			[300, 175],
			[450, 110],
			[600, 175],
			[750, 110],
			[900, 175],
			[1050, 110],
			[1200, 175],
		],
		jitter: 12,
		fill: '%23e7c79c',
		opacity: 0.55,
		crest: '%23fff1d6',
		crestWidth: 1.6,
		crestOpacity: 0.3,
	},
	{
		points: [
			[0, 140],
			[180, 230],
			[360, 140],
			[540, 230],
			[720, 140],
			[900, 230],
			[1080, 140],
			[1200, 230],
		],
		jitter: 16,
		fill: '%23d59a5c',
		opacity: 0.78,
		crest: '%23ffe9c2',
		crestWidth: 2,
		crestOpacity: 0.42,
	},
	{
		points: [
			[0, 295],
			[210, 170],
			[420, 295],
			[630, 170],
			[840, 295],
			[1050, 170],
			[1200, 295],
		],
		jitter: 20,
		fill: '%23a85a2c',
		opacity: 0.95,
		crest: '%23ffd9a3',
		crestWidth: 2.4,
		crestOpacity: 0.55,
	},
];

/* flattened-S bezier through anchors: control points sit inside each span at
   the SAME y as the point they leave/arrive from, so every crest/trough gets
   a smooth horizontal-tangent landing. The control x's are skewed off the
   thirds (0.45/0.85 of the span, or the mirror) so each transition happens
   late in the span — a long gentle windward slope into a short steep leeward
   face, which is how wind actually shapes dunes. `lean` picks the wind
   direction; symmetric thirds would read as waves, not dunes. Returns just
   the ` C…` segment chain so callers can close it (fill) or not (crest). */
function duneCurveSegments(points: [number, number][], lean: 1 | -1): string {
	const [ca, cb] = lean === 1 ? [0.45, 0.85] : [0.15, 0.55];
	let d = '';

	for (let i = 0; i < points.length - 1; i++) {
		const [xa, ya] = points[i];
		const [xb, yb] = points[i + 1];
		const w = xb - xa;

		d += ` C${Math.round(xa + w * ca)} ${ya} ${Math.round(xa + w * cb)} ${yb} ${xb} ${yb}`;
	}

	return d;
}

/* seeded dune geometry: draws from the dunes stream, so its much larger jitter
   budget stays local to this theme. */
function dunesRidgesUrl(between: (min: number, max: number) => number): string {
	/* one wind direction for the whole scene — all three layers lean together */
	const lean = between(0, 1) < 0.5 ? 1 : -1;
	const jitter = (v: number, range: number) => Math.round(v + between(-range, range));

	const paths = DUNES_LAYERS.map((layer) => {
		const pts = layer.points.map(([x, y]) => [x, jitter(y, layer.jitter)] as [number, number]);
		const segs = duneCurveSegments(pts, lean);
		const [x0, y0] = pts[0];
		const xn = pts[pts.length - 1][0];

		return (
			`<path d='M0 300 L${x0} ${y0}${segs} L${xn} 300 Z' fill='${layer.fill}' fill-opacity='${layer.opacity}'/>` +
			`<path d='M${x0} ${y0}${segs}' fill='none' stroke='${layer.crest}' stroke-width='${layer.crestWidth}' stroke-opacity='${layer.crestOpacity}'/>`
		);
	}).join('');

	return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 300' preserveAspectRatio='xMidYMid slice'>${paths}</svg>")`;
}

export function sceneryStyle(seed: number): string {
	const abyss = themeRandom(seed, 'abyss');
	const ember = themeRandom(seed, 'ember');
	const zenith = themeRandom(seed, 'zenith');
	const orbit = themeRandom(seed, 'orbit');
	const ld = themeRandom(seed, 'lantern-drift');
	const canopy = themeRandom(seed, 'canopy');
	const meridian = themeRandom(seed, 'meridian');
	const glacier = themeRandom(seed, 'glacier');
	const ukiyo = themeRandom(seed, 'ukiyo');
	const dunes = themeRandom(seed, 'dunes');
	const sw = themeRandom(seed, 'synthwave');
	const polaris = themeRandom(seed, 'polaris');
	const vectorframe = themeRandom(seed, 'vectorframe');

	const vars: Record<string, string> = {
		/* abyss: glows wander via transform, so both position axes are free;
		   drift/breathe are desynced per layer by negative delays */
		'--abyss-pos': `${abyss.rem(-8, 8)} ${abyss.rem(-6, 6)}`,
		'--abyss-drift-1': abyss.sec(-44, 0),
		'--abyss-breathe-1': abyss.sec(-10, 0),
		'--abyss-drift-2': abyss.sec(-52, 0),
		'--abyss-breathe-2': abyss.sec(-13, 0),
		'--abyss-drift-3': abyss.sec(-48, 0),
		'--abyss-breathe-3': abyss.sec(-11, 0),

		/* ember: rise animates y only, so x is free; 16rem-wide tile */
		'--ember-x-1': ember.rem(0, 16),
		'--ember-phase-1': ember.sec(-13, 0),
		'--ember-phase-3': ember.sec(-5, 0),

		/* zenith: seamless one-tile drifts — phase only */
		'--zenith-phase-1': zenith.sec(-150, 0),
		'--zenith-phase-2': zenith.sec(-240, 0),

		/* orbit: star fields are static (both axes free, tiles 34×27rem and
		   28×22rem); glide/satellite are loops — phase only */
		'--orbit-stars-1': orbit.tile(34, 27),
		'--orbit-stars-2': orbit.tile(28, 22),
		'--orbit-twinkle-phase': orbit.sec(-7, 0),
		'--orbit-glide-phase': orbit.sec(-140, 0),
		'--orbit-sat-phase': orbit.sec(-180, 0),
		'--orbit-shimmer-phase': orbit.sec(-5, 0),
		'--orbit-lightning-phase': orbit.sec(-23, 0),

		/* lantern-drift: reed bank x is static-free (60rem tile). Lanterns and
		   their reflections share --ld-drift-phase — their horizontal lockstep
		   is the effect, never split them. */
		'--ld-reeds-x': ld.rem(0, 60),
		'--ld-drift-phase': ld.sec(-137, 0),
		'--ld-shimmer-phase': ld.sec(-9.5, 0),

		/* canopy: leaf dapple is static (both axes free, 34×28rem tile); rays
		   only re-phase; pollen rises on y so its x is free (18rem / 24rem tiles) */
		'--canopy-dapple': canopy.tile(34, 28),
		'--canopy-dapple-phase': canopy.sec(-13, 0),
		'--canopy-ray-1': canopy.sec(-17, 0),
		'--canopy-ray-2': canopy.sec(-23, 0),
		'--canopy-pollen-x-1': canopy.rem(0, 18),
		'--canopy-pollen-phase-1': canopy.sec(-26, 0),
		'--canopy-pollen-x-2': canopy.rem(0, 24),
		'--canopy-pollen-phase-2': canopy.sec(-19, 0),

		/* meridian: far contours and glow-nodes are static (both axes free,
		   38×26rem and 28×23rem tiles); breathe/sheen/twinkle only re-phase.
		   The hero ribbons are the one place seed drives geometry, not just
		   timing — a whole-SVG var, jitter constrained to the tuned lanes */
		'--meridian-lines-1': meridian.tile(38, 26),
		'--meridian-breathe-phase': meridian.sec(-13, 0),
		'--meridian-sheen-phase': meridian.sec(-17, 0),
		'--meridian-nodes': meridian.tile(28, 23),
		'--meridian-twinkle-phase': meridian.sec(-9, 0),
		'--meridian-ribbons': meridianRibbonsUrl(meridian.between),

		/* glacier: snowfall falls on y so x is free (tiles 20×26rem far, 16×22rem near); sway only re-phases */
		'--glacier-far-x': glacier.rem(0, 20),
		'--glacier-far-phase': glacier.sec(-15, 0),
		'--glacier-near-x': glacier.rem(0, 16),
		'--glacier-near-phase': glacier.sec(-8, 0),
		'--glacier-sway-phase': glacier.sec(-4.5, 0),

		/* ukiyo: sun wobbles on a small static tile; wave/fall loops re-phase; petal fall is on y so x is free (20rem/26rem tiles); sway is a transform, phased independently */
		'--ukiyo-wave-phase': ukiyo.sec(-68, 0),
		'--ukiyo-petal-x-far': ukiyo.rem(0, 20),
		'--ukiyo-petal-phase-far': ukiyo.sec(-32, 0),
		'--ukiyo-sway-phase-far': ukiyo.sec(-7, 0),
		'--ukiyo-petal-x-near': ukiyo.rem(0, 26),
		'--ukiyo-petal-phase-near': ukiyo.sec(-24, 0),
		'--ukiyo-sway-phase-near': ukiyo.sec(-5, 0),

		/* dunes: ridges are a whole-SVG var, same technique as --meridian-ribbons —
		   see dunesRidgesUrl; the shimmer only re-phases */
		'--dunes-shimmer-phase-1': dunes.sec(-4.5, 0),
		'--dunes-ridges': dunesRidgesUrl(dunes.between),

		/* synthwave: stars are a static tile (both axes free); breathe/sink/twinkle/haze only re-phase; grid rails are a static tile (x free); the grid's scroll is a seamless one-tile loop, phased via delay only */
		'--sw-stars': sw.tile(30, 24),
		'--sw-twinkle-phase': sw.sec(-6, 0),
		'--sw-breathe-phase': sw.sec(-11, 0),
		'--sw-sink-phase': sw.sec(-17, 0),
		'--sw-grid-x': sw.rem(0, 3),
		'--sw-grid-phase': sw.sec(-2.6, 0),
		'--sw-haze-phase': sw.sec(-8, 0),

		/* polaris: the field-star tile is static (both axes free, 30×24rem);
		   constellations and trails are fixed geometry, never offset */
		'--polaris-stars': polaris.tile(30, 24),

		/* vectorframe: far tracers and glow-nodes are static (both axes free,
		   38×26rem and 28×23rem tiles); breathe/sheen/twinkle only re-phase.
		   The hero lines are fixed geometry — two vertical tracers per side,
		   hardcoded in scenery CSS — so no stream lever drives geometry here */
		'--vectorframe-lines-1': vectorframe.tile(38, 26),
		'--vectorframe-breathe-phase': vectorframe.sec(-11, 0),
		'--vectorframe-sheen-phase': vectorframe.sec(-13, 0),
		'--vectorframe-nodes': vectorframe.tile(28, 23),
		'--vectorframe-twinkle-phase': vectorframe.sec(-8, 0),
	};

	return Object.entries(vars)
		.map(([k, v]) => `${k}: ${v}`)
		.join('; ');
}
