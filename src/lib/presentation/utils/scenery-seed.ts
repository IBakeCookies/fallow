/* Per-user scenery variety: one persisted 32-bit seed → deterministic CSS
   vars consumed by theme-scenery/*.css. Every var has a CSS fallback equal to
   the hand-tuned look, so no-JS and un-seeded themes are unaffected. Server
   and client derive identical values from the same seed, so the style is
   SSR-inlined with no FOUC or hydration shift.

   Rules (see theme-scenery/*.css comments):
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
		endY: 120
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
		endY: 380
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
		endY: 440
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
		endY: 180
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
		endY: 620
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
		endY: 220
	}
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
			[1200, 175]
		],
		jitter: 12,
		fill: '%23e7c79c',
		opacity: 0.55,
		crest: '%23fff1d6',
		crestWidth: 1.6,
		crestOpacity: 0.3
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
			[1200, 230]
		],
		jitter: 16,
		fill: '%23d59a5c',
		opacity: 0.78,
		crest: '%23ffe9c2',
		crestWidth: 2,
		crestOpacity: 0.42
	},
	{
		points: [
			[0, 295],
			[210, 170],
			[420, 295],
			[630, 170],
			[840, 295],
			[1050, 170],
			[1200, 295]
		],
		jitter: 20,
		fill: '%23a85a2c',
		opacity: 0.95,
		crest: '%23ffd9a3',
		crestWidth: 2.4,
		crestOpacity: 0.55
	}
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

/* seeded dune geometry: an independent PRNG (harvested from two `between2`
   draws — the same call count the old tile2(46, 30) offset used) so this
   var's much larger jitter budget can never shift where every later vars2
   entry (sw-*, ff-*) lands in the shared stream2 sequence. */
function dunesRidgesUrl(between2: (min: number, max: number) => number): string {
	const localSeed = (Math.round(between2(0, 1e9)) ^ (Math.round(between2(0, 1e9)) << 16)) >>> 0;
	const rnd = mulberry32(localSeed);
	/* one wind direction for the whole scene — all three layers lean together */
	const lean = rnd() < 0.5 ? 1 : -1;
	const jitter = (v: number, range: number) => Math.round(v + (rnd() * 2 - 1) * range);

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
	const rnd = mulberry32(seed);
	const between = (min: number, max: number) => min + rnd() * (max - min);
	const rem = (min: number, max: number) => `${between(min, max).toFixed(1)}rem`;
	const sec = (min: number, max: number) => `${between(min, max).toFixed(1)}s`;
	/* offset within one background tile — both axes must be non-animated */
	const tile = (w: number, h: number) => `${rem(0, w)} ${rem(0, h)}`;

	/* Var order is the rnd() call order — append only, or every user's
	   scenery reshuffles on deploy. (The 2026-07 theme curation pruned vars
	   mid-stream — a deliberate one-time reshuffle.) */
	const vars: Record<string, string> = {
		/* abyss: glows wander via transform, so both position axes are free;
		   drift/breathe are desynced per layer by negative delays */
		'--abyss-pos': `${rem(-8, 8)} ${rem(-6, 6)}`,
		'--abyss-drift-1': sec(-44, 0),
		'--abyss-breathe-1': sec(-10, 0),
		'--abyss-drift-2': sec(-52, 0),
		'--abyss-breathe-2': sec(-13, 0),
		'--abyss-drift-3': sec(-48, 0),
		'--abyss-breathe-3': sec(-11, 0),

		/* ember: rise animates y only, so x is free; 16rem-wide tile */
		'--ember-x-1': rem(0, 16),
		'--ember-phase-1': sec(-13, 0),
		'--ember-phase-3': sec(-5, 0),

		/* zenith: seamless one-tile drifts — phase only */
		'--zenith-phase-1': sec(-150, 0),
		'--zenith-phase-2': sec(-240, 0),

		/* orbit: star fields are static (both axes free, tiles 34×27rem and
		   28×22rem); glide/satellite are loops — phase only */
		'--orbit-stars-1': tile(34, 27),
		'--orbit-stars-2': tile(28, 22),
		'--orbit-twinkle-phase': sec(-7, 0),
		'--orbit-glide-phase': sec(-140, 0),
		'--orbit-sat-phase': sec(-180, 0),
		'--orbit-shimmer-phase': sec(-5, 0),
		'--orbit-lightning-phase': sec(-23, 0),

		/* lantern-drift: reed bank x is static-free (60rem tile). Lanterns and
		   their reflections share --ld-drift-phase — their horizontal lockstep
		   is the effect, never split them. */
		'--ld-reeds-x': rem(0, 60),
		'--ld-drift-phase': sec(-137, 0),
		'--ld-shimmer-phase': sec(-9.5, 0),

		/* canopy: leaf dapple is static (both axes free, 34×28rem tile); rays
		   only re-phase; pollen rises on y so its x is free (18rem / 24rem tiles) */
		'--canopy-dapple': tile(34, 28),
		'--canopy-dapple-phase': sec(-13, 0),
		'--canopy-ray-1': sec(-17, 0),
		'--canopy-ray-2': sec(-23, 0),
		'--canopy-pollen-x-1': rem(0, 18),
		'--canopy-pollen-phase-1': sec(-26, 0),
		'--canopy-pollen-x-2': rem(0, 24),
		'--canopy-pollen-phase-2': sec(-19, 0),

		/* meridian: far contours and glow-nodes are static (both axes free,
		   38×26rem and 28×23rem tiles); breathe/sheen/twinkle only re-phase.
		   The hero ribbons are the one place seed drives geometry, not just
		   timing — a whole-SVG var, jitter constrained to the tuned lanes */
		'--meridian-lines-1': tile(38, 26),
		'--meridian-breathe-phase': sec(-13, 0),
		'--meridian-sheen-phase': sec(-17, 0),
		'--meridian-nodes': tile(28, 23),
		'--meridian-twinkle-phase': sec(-9, 0),
		/* must stay last: its internal rnd() call count can change independently
		   of this list (e.g. the c3-reflection fix), so nothing after it is safe */
		'--meridian-ribbons': meridianRibbonsUrl(between)
	};

	/* stream 2 — themes added after --meridian-ribbons. Independent PRNG so
	   stream 1 (incl. ribbons' variable rnd() call count) can never reshuffle
	   these. Same append-only rule applies within this stream. */
	const rnd2 = mulberry32(seed ^ 0x9e3779b9);
	const between2 = (min: number, max: number) => min + rnd2() * (max - min);
	const rem2 = (min: number, max: number) => `${between2(min, max).toFixed(1)}rem`;
	const sec2 = (min: number, max: number) => `${between2(min, max).toFixed(1)}s`;
	const tile2 = (w: number, h: number) => `${rem2(0, w)} ${rem2(0, h)}`;

	const vars2: Record<string, string> = {
		/* glacier: snowfall falls on y so x is free (tiles 20×26rem far, 16×22rem near); sway only re-phases */
		'--glacier-far-x': rem2(0, 20),
		'--glacier-far-phase': sec2(-15, 0),
		'--glacier-near-x': rem2(0, 16),
		'--glacier-near-phase': sec2(-8, 0),
		'--glacier-sway-phase': sec2(-4.5, 0),

		/* ukiyo: sun wobbles on a small static tile; wave/fall loops re-phase; petal fall is on y so x is free (20rem/26rem tiles); sway is a transform, phased independently */
		'--ukiyo-wave-phase': sec2(-68, 0),
		'--ukiyo-petal-x-far': rem2(0, 20),
		'--ukiyo-petal-phase-far': sec2(-32, 0),
		'--ukiyo-sway-phase-far': sec2(-7, 0),
		'--ukiyo-petal-x-near': rem2(0, 26),
		'--ukiyo-petal-phase-near': sec2(-24, 0),
		'--ukiyo-sway-phase-near': sec2(-5, 0),

		/* dunes: ridges are a whole-SVG var, same technique as --meridian-ribbons —
		   see dunesRidgesUrl; the shimmer only re-phases */
		'--dunes-ridges': dunesRidgesUrl(between2),
		'--dunes-shimmer-phase-1': sec2(-4.5, 0),

		/* synthwave: stars are a static tile (both axes free); breathe/sink/twinkle/haze only re-phase; grid rails are a static tile (x free); the grid's scroll is a seamless one-tile loop, phased via delay only */
		'--sw-stars': tile2(30, 24),
		'--sw-twinkle-phase': sec2(-6, 0),
		'--sw-breathe-phase': sec2(-11, 0),
		'--sw-sink-phase': sec2(-17, 0),
		'--sw-grid-x': rem2(0, 3),
		'--sw-grid-phase': sec2(-2.6, 0),
		'--sw-haze-phase': sec2(-8, 0),

		/* polaris: the field-star tile is static (both axes free, 30×24rem);
		   constellations and trails are fixed geometry, never offset */
		'--polaris-stars': tile2(30, 24)
	};

	return Object.entries({ ...vars, ...vars2 })
		.map(([k, v]) => `${k}: ${v}`)
		.join('; ');
}
