// Check every button variant's hover state in every theme:
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
// Three checks per variant:
//   step — hover differs visibly from rest, in the fill OR the border (ΔL ≥ 0.008)
//   gap  — the hover fill does not sink into the surface behind it (ΔL ≥ 0.015),
//          skipped for the variants that keep a border of their own
//   cr   — the label still clears 4.5:1, at rest and on the hover fill
// `step` deliberately does not constrain DIRECTION: the neutral fill is lighter
// than the page on the light themes and darker on the dark ones, so "stronger"
// means darker in one family and lighter in the other.
//
// Known residue at 23 findings, all of it a palette cap rather than a hover
// token (see STYLE.md's hover and danger bullets): danger is a red ink on a red
// fill, one shade apart, so nine light themes land in the 3.9–4.5 band and
// `zenith` at 3.0 because its own `--danger-strong` is mid-luminance; `default`
// sits at 4.0–4.3 on three themes for the same reason; `blueprint`'s near-white
// primary caps secondary at 3.7. `glass-light outline` reports step 0 because a
// 55%-white fill over a white region of that photo composites to white either
// way — the single-pixel sample cannot see a change that does exist over the
// rest of the image. Everything else passes: no invisible hovers, no fill that
// sinks into its surface.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { inflateSync } from 'node:zlib';

// Read the catalogue instead of duplicating it — a hand-copied list silently
// stops covering new themes, which is the one thing this script is for.
const only = process.argv.slice(2);

const THEMES = [...readFileSync('src/lib/business/model/theme.ts', 'utf8').matchAll(/name: '([^']+)',/g)]
	.map((m) => m[1])
	.filter((n) => n !== 'ThemeName' && (!only.length || only.includes(n)));

const VARIANTS = ['default', 'outline', 'secondary', 'destructive'];
const BORDERED = new Set(['outline', 'destructive']);

// 1x1 PNG -> [r,g,b]. Cheaper than a decoder dependency: inflate the IDATs and
// skip the scanline's filter byte.
const pixel = (png) => {
	const idat = [];
	let o = 8;

	while (o < png.length) {
		const len = png.readUInt32BE(o);

		if (png.toString('ascii', o + 4, o + 8) === 'IDAT') idat.push(png.subarray(o + 8, o + 8 + len));

		o += 12 + len;
	}

	const raw = inflateSync(Buffer.concat(idat));

	return [raw[1], raw[2], raw[3]];
};

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
 width: 900, height: 300, 
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
 name: v, exact: true, 
});

		const box = await el.boundingBox();
		const y = Math.round(box.y + box.height / 2);

		// inside the left edge, clear of both the border and the label glyphs
		const fill = {
 x: Math.round(box.x + 4), y, width: 1, height: 1, 
};

		// the surface immediately left of the button: what it sits on
		const behind = {
 x: Math.round(box.x - 4), y, width: 1, height: 1, 
};

		// the 1px left edge: a variant may carry its hover on the border instead
		const edge = {
 x: Math.round(box.x), y, width: 1, height: 1, 
};

		await page.mouse.move(880, 290);
		await page.waitForTimeout(250);

		const surface = lum(pixel(await page.screenshot({
 clip: behind, 
})));

		const restPx = pixel(await page.screenshot({
 clip: fill, 
}));

		const restEdge = lum(pixel(await page.screenshot({
 clip: edge, 
})));

		await el.hover();
		await page.waitForTimeout(350);

		const hoverPx = pixel(await page.screenshot({
 clip: fill, 
}));

		const hoverEdge = lum(pixel(await page.screenshot({
 clip: edge, 
})));

		const ink = await toRgb(await el.evaluate((n) => getComputedStyle(n).color));
		const crRest = ratio(ink, restPx);
		const crHover = ratio(ink, hoverPx);
		const step = Math.max(Math.abs(lum(hoverPx) - lum(restPx)), Math.abs(hoverEdge - restEdge));
		const gap = Math.abs(lum(hoverPx) - surface);

		row.push(
			`${v} step=${step.toFixed(3)} gap=${gap.toFixed(3)} cr=${crRest.toFixed(1)}/${crHover.toFixed(1)}`,
		);

		if (step < 0.008) fails.push(`${theme} ${v}: hover invisible (step ${step.toFixed(4)})`);

		if (gap < 0.015 && !BORDERED.has(v))
			fails.push(`${theme} ${v}: hover sinks into surface (gap ${gap.toFixed(4)})`);

		if (crRest < 4.5) fails.push(`${theme} ${v}: label ${crRest.toFixed(2)}:1 at rest`);

		if (crHover < 4.5) fails.push(`${theme} ${v}: label ${crHover.toFixed(2)}:1 on hover fill`);
	}

	console.log(`${theme.padEnd(14)} ${row.join(' | ')}`);
}

console.log(fails.length ? `\n${fails.length} findings\n${fails.join('\n')}` : '\nall pass');
await browser.close();
