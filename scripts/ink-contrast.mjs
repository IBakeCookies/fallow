// Check the derived `-ink` tokens against every state fill in every theme:
//   node scripts/ink-contrast.mjs [--sweep]
// Requires the dev server on :5173 and system NSS libs for headless chromium —
// if chromium fails with `libnspr4.so`, see .claude/skills/verify/SKILL.md
// (download libnspr4/libnss3 debs and set LD_LIBRARY_PATH to the extracted libs).
//
// The `-ink` tokens in base.css derive their lightness from the fill's own,
// which means a theme that swaps a fill silently changes its ink. This is the
// regression check for that. `--sweep` re-derives the 0.58 threshold from the
// measurements instead of trusting it.
//
// The load-bearing assertion is the POLE test, not the contrast number: a
// working derivation can only ever produce l≈0.16 or l≈0.97. Read a contrast
// figure only after that passes — an unresolved token inherits the theme's text
// colour, which still looks like a plausible colour and scores a plausible
// ratio.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const SWEEP = process.argv.includes('--sweep');
const DARK = 0.16;
const LIGHT = 0.97;

// Read the catalogue instead of duplicating it — a hand-copied list silently
// stops covering new themes, which is the one thing this script is for.
const catalogue = readFileSync('src/lib/business/model/theme.ts', 'utf8');
const themes = [
	...catalogue.matchAll(/name: '([^']+)',\s*\n\s*label: '[^']*',\s*\n\s*css: \[([^\]]+)\]/g)
].map((m) => ({ name: m[1], css: [...m[2].matchAll(/'([^']+)'/g)].map((c) => c[1]) }));
if (themes.length === 0) throw new Error('no themes parsed from business/model/theme.ts');

// Literal names: the utility classes below must exist in the built CSS, and
// Tailwind's scanner is textual — theme.stories.svelte is what emits them.
const STATES = ['danger', 'warning', 'success', 'info', 'mind', 'body', 'flow', 'mixed', 'brand'];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

const results = await page.evaluate(
	({ themes, STATES, DARK, LIGHT }) => {
		// Paint the computed colour and read the sRGB bytes back, so the browser
		// does the oklch→sRGB conversion rather than a hand-rolled copy of it.
		const cv = document.createElement('canvas');
		cv.width = cv.height = 1;
		const ctx = cv.getContext('2d', { willReadFrequently: true });
		const srgb = (css) => {
			ctx.fillStyle = '#000';
			ctx.fillRect(0, 0, 1, 1);
			ctx.fillStyle = css;
			ctx.fillRect(0, 0, 1, 1);
			return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
		};
		const lum = (rgb) => {
			const [r, g, b] = rgb.map((v) => {
				const c = v / 255;
				return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
			});
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		};
		const ratio = (a, b) => {
			const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
			return (x + 0.05) / (y + 0.05);
		};

		// Read through the real utility classes rather than the custom property, so
		// this measures what a component actually renders. (`var(--color-x-ink)`
		// does resolve too — base.css owns that name — but if the base.css
		// declaration is ever missing, the self-referential `@theme` line makes it
		// a silent cycle that inherits the theme's text colour instead of erroring,
		// which reads as a plausible result. Hence the pole assertion below.)
		const holder = document.createElement('div');
		holder.style.cssText = 'position:fixed;left:-9999px;top:0';
		holder.innerHTML = STATES.map(
			(s) => `<span id="ink-${s}" class="bg-${s} text-${s}-ink">Aa</span>`
		).join('');
		document.body.appendChild(holder);

		const out = [];
		const original = document.documentElement.className;
		for (const t of themes) {
			document.documentElement.className = t.css.join(' ');
			for (const s of STATES) {
				const cs = getComputedStyle(document.getElementById(`ink-${s}`));
				const ink = cs.color;
				const fill = cs.backgroundColor;
				const inkL = +ink.match(/oklch\(([\d.]+)/)?.[1];
				const hue = ink.match(/oklch\([\d.]+ [\d.]+ ([\d.]+)/)?.[1] ?? 0;
				out.push({
					theme: t.name,
					state: s,
					fill,
					ink,
					fillL: +fill.match(/oklch\(([\d.]+)/)?.[1],
					atPole: Math.abs(inkL - DARK) < 0.01 || Math.abs(inkL - LIGHT) < 0.01,
					ratio: +ratio(srgb(ink), srgb(fill)).toFixed(2),
					// both poles scored on the same fill, so the threshold can be
					// re-derived from measurements rather than assumed
					dark: +ratio(srgb(`oklch(${DARK} 0.02 ${hue})`), srgb(fill)).toFixed(2),
					light: +ratio(srgb(`oklch(${LIGHT} 0.02 ${hue})`), srgb(fill)).toFixed(2)
				});
			}
		}
		document.documentElement.className = original;
		holder.remove();
		return out;
	},
	{ themes, STATES, DARK, LIGHT }
);
await browser.close();

for (const r of results) r.best = Math.max(r.dark, r.light);
console.log(`${themes.length} themes × ${STATES.length} fills = ${results.length} pairs`);

const unresolved = results.filter((r) => !r.atPole);
if (unresolved.length) {
	console.error(`\nFAIL — ink did not resolve to a pole (${unresolved.length}):`);
	for (const r of unresolved.slice(0, 10)) console.error(`   ${r.theme}/${r.state} ink=${r.ink}`);
	process.exit(1);
}

const worse = results.filter((r) => r.ratio < r.best - 0.01);
const ratios = results.map((r) => r.ratio).sort((a, b) => a - b);
const capped = results.filter((r) => r.best < 4.5);
console.log(`worst ${ratios[0]}:1   median ${ratios[Math.floor(ratios.length / 2)]}:1`);
console.log(`picked the worse pole: ${worse.length}`);
for (const r of worse.slice(0, 10))
	console.log(`   ${r.theme}/${r.state} fillL=${r.fillL} got=${r.ratio} best=${r.best}`);
console.log(`below 3.0:1 (unusable at any size): ${results.filter((r) => r.ratio < 3).length}`);
console.log(`capped below 4.5:1 by the fill itself, no ink can fix: ${capped.length}`);

if (SWEEP) {
	console.log(`\nthreshold sweep — dark ink when fill l > T:`);
	for (let T = 0.5; T <= 0.72; T += 0.02) {
		const got = results.map((r) => (r.fillL > T ? r.dark : r.light));
		const missed = results.filter((r, i) => got[i] < r.best - 0.01).length;
		console.log(
			`   T=${T.toFixed(2)}  worst=${Math.min(...got).toFixed(2)}  <3: ${String(got.filter((v) => v < 3).length).padStart(3)}  <4.5: ${String(got.filter((v) => v < 4.5).length).padStart(3)}  worse-pole: ${missed}`
		);
	}
}

// Only the pole test and the worse-pole count are regressions; a fill-capped
// pair is a property of the fill, not a bug in the derivation.
if (worse.length) {
	console.error(`\nFAIL — the threshold in base.css is no longer optimal; re-run with --sweep.`);
	process.exit(1);
}
console.log(`\nOK`);
