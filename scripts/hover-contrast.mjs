// Check every button variant that has a hover fill, in every theme:
//   npm run storybook   # this one drives :6006, not the dev server
//   node scripts/hover-contrast.mjs
// Same chromium prerequisite as ink-contrast.mjs (see .claude/skills/verify/SKILL.md).
//
// The hover tokens in base.css are derived from the fill they hover — alpha
// scaled for a translucent fill, a step away from the ink for a solid one — so
// a theme that re-tints a fill silently changes its hover. This is the
// regression check for that, and the reason those percentages are the ones they
// are: every alternative was rejected by a number here, not by taste.
//
// Measured from RENDERED PIXELS, because computed style cannot answer the
// question: the tokens resolve to color-mix()/oklch(from ...) with alpha, so
// what the eye gets only exists after compositing over the theme's card,
// gradient or background photo.
//
// Three checks per variant, all three of them CONTRAST RATIOS:
//   step — hover differs visibly from rest, in the fill OR the border
//   gap  — the hover fill does not sink into the surface behind it, skipped for
//          the variants where it is not a fact of its own (see NO_GAP)
//   cr   — the label still clears 4.5:1, at rest and on the hover fill
// `step` deliberately does not constrain DIRECTION: the neutral fill is lighter
// than the page on the light themes and darker on the dark ones, so "stronger"
// means darker in one family and lighter in the other.
//
// step and gap are ratios and not a difference of luminances, because relative
// luminance is compressed near black: ONE 6% `surface-hover` tint measures ΔL
// 0.129 over white and 0.0048 over black, a 27× spread from a token that does
// not vary. A ΔL threshold can therefore only ever be calibrated for one end of
// the catalogue — the same tint reads 1.14 and 1.10 as a ratio. This is not a
// second opinion about the ratio the label checks use; it is the same instrument
// asking the same question of a different pair of pixels.
//
// This script prints a residue of known findings, none of it reachable by a
// hover token (see STYLE.md's hover and danger bullets) — read the list, not a
// count written here, which is stale the next time a theme lands.
//
// Nearly all of it is one palette cap: danger is a red ink on a red fill, one
// shade apart, so the light themes land in the 3.9–4.5 band and `zenith` at 3.0
// because its own `--danger-strong` is mid-luminance; `default` sits at 4.0–4.5
// wherever primary is close to its own foreground; `blueprint`'s near-white
// primary caps secondary at 4.0. Three findings are step instead, and each is a
// palette with nowhere to go rather than a token: `glass-light` outline is a
// 55%-white fill over a white region of that photo, which composites to white
// either way; `blueprint` default hovers a near-white primary; and `dunes`
// secondary moves in hue and not in luminance (231,207,197 -> 242,202,187),
// which no luminance metric can see. A finding outside those shapes is new.
//
// One shape is not a palette fact at all: an animated theme can flash something
// bright across the sample patch mid-measurement. `orbit` destructive did that
// once at step 16.5 / cr 1.92 and measured 1.34 / 8.6 on the three runs after
// it. Re-run the one theme (`node scripts/hover-contrast.mjs orbit`) before
// believing a wild reading on a theme whose scenery moves.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

// Read the catalogue instead of duplicating it — a hand-copied list silently
// stops covering new themes, which is the one thing this script is for.
const only = process.argv.slice(2);

const THEMES = [
	...readFileSync('src/lib/business/model/theme.ts', 'utf8').matchAll(/name: '([^']+)',/g),
]
	.map((m) => m[1])
	.filter((n) => n !== 'ThemeName' && (!only.length || only.includes(n)));

// `link` is excluded: it has no hover fill or border to step, only an underline.
const VARIANTS = ['default', 'outline', 'secondary', 'ghost', 'destructive'];
// `gap` asks whether the HOVER fill separates from the page behind it, and these
// three are the variants for which that is not a fact of its own. `outline` and
// `destructive` keep a border, which is what separates them. `ghost` has neither
// a fill at rest nor a visible border, so the pixel behind it and its own rest
// pixel are one pixel — `gap` there is `step` re-measured against a second
// threshold, and would either restate step's verdict or contradict it.
const NO_GAP = new Set(['outline', 'destructive', 'ghost']);
// Two luminances read as different. One number for both step and gap: they
// compare different pairs, not different amounts. It sits in a gap the measured
// catalogue leaves — the palette caps that cannot move are at 1.000/1.013/1.019
// and the faintest hover the design ships is `foliage` outline at 1.037 — so it
// does not flip on rounding. Headroom is thin on one side: below 1.05 sit four
// light themes' `outline` and `bubblegum` secondary (1.037–1.049), a near-white
// hover over a near-white page, and they are the next thing a stricter bound
// would report. Every `ghost` in the catalogue clears 1.081.
const MIN_RATIO = 1.03;

const lum = ([r, g, b]) => {
	const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const ratio = (a, b) => {
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);

	return (hi + 0.05) / (lo + 0.05);
};

const browser = await chromium.launch();

const page = await browser.newPage({
	viewport: {
		width: 900,
		height: 300,
	},
});

// any CSS colour -> sRGB, via the browser: these tokens are oklab/oklch
const toRgb = (css) =>
	page.evaluate((c) => {
		const cv = document.createElement('canvas');
		cv.width = cv.height = 1;
		const ctx = cv.getContext('2d');
		ctx.fillStyle = c;
		ctx.fillRect(0, 0, 1, 1);

		return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
	}, css);

// mean sRGB over a clip, decoded by the same browser rather than by a decoder
// here. A patch and not one pixel: a single sample lands on antialiasing at a
// rounded corner, or on one bright spot of a background photo, and reports a
// change that is not there — it once put `glacier` ghost at 1.02 and
// `glass-light` outline at 1.00, both of which read normally over their own area.
const sample = async (clip) => {
	const png = (
		await page.screenshot({
			clip,
		})
	).toString('base64');

	return page.evaluate(async (b64) => {
		const bin = atob(b64);
		const buf = new Uint8Array(bin.length);

		for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

		const img = await createImageBitmap(new Blob([buf]));
		const cv = new OffscreenCanvas(img.width, img.height);
		const ctx = cv.getContext('2d');
		ctx.drawImage(img, 0, 0);

		const px = ctx.getImageData(0, 0, img.width, img.height).data;
		const sum = [0, 0, 0];

		for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += px[i + c];

		return sum.map((v) => v / (px.length / 4));
	}, png);
};

const fails = [];

for (const theme of THEMES) {
	await page.goto(
		`http://localhost:6006/iframe.html?id=ui-button--variants&globals=theme:${theme}`,
		{
			waitUntil: 'networkidle',
		},
	);

	const row = [];

	for (const v of VARIANTS) {
		const el = page.getByRole('button', {
			name: v,
			exact: true,
		});

		const box = await el.boundingBox();
		const y = Math.round(box.y) + 4;
		const height = Math.round(box.height) - 8;

		// inside the left edge, clear of both the border and the label glyphs
		const fill = {
			x: Math.round(box.x) + 3,
			y,
			width: 8,
			height,
		};

		// the surface left of the button: what it sits on. The row's gap is 12px,
		// so this stays off the button before it.
		const behind = {
			x: Math.round(box.x) - 10,
			y,
			width: 6,
			height,
		};

		// the 1px left edge: a variant may carry its hover on the border instead
		const edge = {
			x: Math.round(box.x),
			y,
			width: 1,
			height,
		};

		await page.mouse.move(880, 290);
		await page.waitForTimeout(250);

		const surface = await sample(behind);
		const restPx = await sample(fill);
		const restEdge = await sample(edge);

		await el.hover();
		await page.waitForTimeout(350);

		const hoverPx = await sample(fill);
		const hoverEdge = await sample(edge);
		const ink = await toRgb(await el.evaluate((n) => getComputedStyle(n).color));
		const crRest = ratio(ink, restPx);
		const crHover = ratio(ink, hoverPx);
		const step = Math.max(ratio(hoverPx, restPx), ratio(hoverEdge, restEdge));
		const gap = ratio(hoverPx, surface);

		row.push(
			`${v} step=${step.toFixed(3)} gap=${gap.toFixed(3)} cr=${crRest.toFixed(1)}/${crHover.toFixed(1)}`,
		);

		if (step < MIN_RATIO) fails.push(`${theme} ${v}: hover invisible (step ${step.toFixed(3)})`);

		if (gap < MIN_RATIO && !NO_GAP.has(v))
			fails.push(`${theme} ${v}: hover sinks into surface (gap ${gap.toFixed(3)})`);

		if (crRest < 4.5) fails.push(`${theme} ${v}: label ${crRest.toFixed(2)}:1 at rest`);

		if (crHover < 4.5) fails.push(`${theme} ${v}: label ${crHover.toFixed(2)}:1 on hover fill`);
	}

	console.log(`${theme.padEnd(14)} ${row.join(' | ')}`);
}

console.log(fails.length ? `\n${fails.length} findings\n${fails.join('\n')}` : '\nall pass');
await browser.close();
