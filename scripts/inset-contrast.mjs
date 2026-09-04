// Check the recessed surface rung against the card it is cut into, in every
// theme:
//   npm run storybook   # this one drives :6006, like hover-contrast.mjs
//   node scripts/inset-contrast.mjs           # all 46
//   node scripts/inset-contrast.mjs abyss     # one theme
// Same chromium prerequisite as hover-contrast.mjs (see .claude/skills/verify/SKILL.md).
//
// `--surface-inset` is DERIVED from `--surface-card` per side — a step down on a
// light page and up on a dark one (base.css) — so no theme declares the pair
// this measures and changing the step changes all 46 at once. That derivation
// replaced 45 hand-set declarations, 22 of which put black at alpha over a page
// already at L 0.09-0.16: a well cut into a floor that was already the bottom,
// measured 1.013-1.079 against its own card, i.e. invisible. This script is the
// regression check for the thing that fixed, and the reason the step is the
// number it is.
//
// Measured from RENDERED PIXELS, because computed style cannot answer the
// question: the token resolves to oklch(from ... ) with alpha, so what the eye
// gets only exists after compositing over the theme's own card — which is
// itself translucent over a page, a gradient or a background photo on most
// themes.
//
// It has to be the inset against ITS OWN CARD and not against the page, which
// is why this drives a story built for it rather than Theme > Swatches: every
// swatch there sits on the page, and an inset that reads clearly against the
// page can still vanish into the card it actually lives in. That was the exact
// failure the derivation fixed.
//
// Two checks per theme, both CONTRAST RATIOS:
//   step — the well reads as distinct from the card around it
//   cr   — the row's own `text-ty-secondary` label still clears 4.5:1 on it,
//          which is what a LIGHTER inset on a dark theme puts at risk
//
// step is a ratio and not a difference of luminances for the reason
// hover-contrast.mjs gives at length: relative luminance is compressed near
// black, so one unchanging tint measures a 27x spread of dL across this
// catalogue and a dL threshold can only ever be calibrated for one end of it.
//
// MIN_STEP is hover-contrast.mjs's bound and carries that script's calibration,
// not a fresh one: it sits between the palette caps that cannot move and the
// faintest step the design ships, so it does not flip on rounding.
//
// An animated theme can flash something bright across the sample patch
// mid-measurement — `orbit` did it once to hover-contrast at 16.5 against 1.34
// on the three runs after. Re-run the one theme before believing a wild reading
// on a theme whose scenery moves.
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

const MIN_STEP = 1.03;
const MIN_CR = 4.5;

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
		height: 400,
	},
});

// any CSS colour -> the sRGB the eye gets, via the browser: these tokens are
// oklab/oklch, and the ink among them is TRANSLUCENT — `--ty-secondary` is
// `--ty-primary` at 70% over transparent (base.css). Painting it on a bare
// canvas returns the un-premultiplied colour, i.e. the label as if it were
// opaque, so the background it is actually drawn over has to go down first.
const composite = (css, bg) =>
	page.evaluate(
		([c, b]) => {
			const cv = document.createElement('canvas');
			cv.width = cv.height = 1;
			const ctx = cv.getContext('2d');
			ctx.fillStyle = `rgb(${b[0]} ${b[1]} ${b[2]})`;
			ctx.fillRect(0, 0, 1, 1);
			ctx.fillStyle = c;
			ctx.fillRect(0, 0, 1, 1);

			return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
		},
		[css, bg.map(Math.round)],
	);

// mean sRGB over a clip, decoded by the same browser rather than by a decoder
// here. A patch and not one pixel, for hover-contrast's reason: a single sample
// lands on antialiasing at a rounded corner or on one bright spot of a
// background photo and reports a change that is not there.
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
		`http://localhost:6006/iframe.html?id=theme--inset-on-card&globals=theme:${theme}`,
		{
			waitUntil: 'networkidle',
		},
	);

	const well = page.getByTestId('inset-well');
	const card = page.getByTestId('inset-card');

	await well.waitFor();

	const wellBox = await well.boundingBox();
	const cardBox = await card.boundingBox();

	// The strip between the two labels: inside the well, clear of its rounded
	// corners and of both label glyphs.
	const inset = {
		x: Math.round(wellBox.x + wellBox.width / 2) - 8,
		y: Math.round(wellBox.y) + 3,
		width: 16,
		height: Math.round(wellBox.height) - 6,
	};

	// The card's own padding, left of the well: the surface the well is cut into.
	// `p-box-xl` is what leaves room for this, so it is a fact of the story.
	const around = {
		x: Math.round(cardBox.x) + 4,
		y: Math.round(wellBox.y) + 3,
		width: 8,
		height: Math.round(wellBox.height) - 6,
	};

	// Let scenery settle before sampling: hover-contrast is documented flaky for
	// want of exactly this, and an animated theme is the case it misreads.
	await page.waitForTimeout(400);

	const insetPx = await sample(inset);
	const cardPx = await sample(around);

	const ink = await composite(
		await well.evaluate((n) => getComputedStyle(n.firstElementChild).color),
		insetPx,
	);

	const step = ratio(insetPx, cardPx);
	const cr = ratio(ink, insetPx);

	console.log(`${theme.padEnd(14)} step=${step.toFixed(3)} cr=${cr.toFixed(2)}`);

	if (step < MIN_STEP)
		fails.push(`${theme}: inset invisible against its card (step ${step.toFixed(3)})`);

	if (cr < MIN_CR) fails.push(`${theme}: log-row label ${cr.toFixed(2)}:1 on the inset`);
}

await browser.close();

if (fails.length) {
	console.log(`\n${fails.length} findings:`);
	for (const f of fails) console.log(`  ${f}`);
} else {
	console.log('\nno findings');
}
