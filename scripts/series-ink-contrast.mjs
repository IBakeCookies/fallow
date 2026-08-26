// Check `series-ink` against the categorical series fills:
//   node scripts/series-ink-contrast.mjs
// Requires the dev server on :5173 and system NSS libs for headless chromium —
// if chromium fails with `libnspr4.so`, see .claude/skills/verify/SKILL.md
// (download libnspr4/libnss3 debs and set LD_LIBRARY_PATH to the extracted libs).
//
// Unlike the derived `-ink` tokens (scripts/ink-contrast.mjs), `series-ink` is a
// fixed colour per side of the light/dark line, so two ratio tables answer the
// whole catalogue — but only while the fills are fixed the same way. That premise
// is the load-bearing assertion here: a theme that re-declares a series colour, or
// an alpha on one, makes the printed ratios a statement about a colour nothing
// paints. The second column is the block against the surface behind it, which a
// dark fill on a dark page can lose while its label still reads.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const AA = 4.5;
// Read the catalogue instead of duplicating it — a hand-copied list silently
// stops covering new themes, which is the one thing this script is for.
const catalogue = readFileSync('src/lib/business/model/theme.ts', 'utf8');

const themes = [
	...catalogue.matchAll(/name: '([^']+)',\s*\n\s*label: '[^']*',\s*\n\s*css: \[([^\]]+)\]/g),
].map((m) => ({
	name: m[1],
	css: [...m[2].matchAll(/'([^']+)'/g)].map((c) => c[1]),
}));

if (themes.length === 0) throw new Error('no themes parsed from business/model/theme.ts');

const FILLS = [1, 2, 3, 4, 5, 6, 7, 8, 'rest'];
const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/', {
	waitUntil: 'domcontentloaded',
});

const { sides, drifted, translucent } = await page.evaluate(
	({ themes, FILLS }) => {
		// Paint the computed colour and read the sRGB bytes back, so the browser does
		// the oklch→sRGB conversion rather than a hand-rolled copy of it. Painted over
		// white and over black: the two agree only on an opaque colour, which is how
		// alpha is caught without parsing a colour syntax.
		const cv = document.createElement('canvas');
		cv.width = cv.height = 1;

		const ctx = cv.getContext('2d', {
			willReadFrequently: true,
		});

		const srgb = (css, under) => {
			ctx.fillStyle = under;
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

		// The raw :root properties, not the `-series-N` utility classes: these are the
		// names series-color.ts builds, and Tailwind's scanner never sees those either.
		// The surfaces come with them so the backdrop is the theme's own, composited
		// the way the page composites it (card over page, both translucent on .dark).
		const NAMES = ['ink', ...FILLS];
		const holder = document.createElement('div');
		holder.style.cssText = 'position:fixed;left:-9999px;top:0';

		holder.innerHTML = [
			...NAMES.map((n) => `<span id="s-${n}" style="background: var(--series-${n})"></span>`),
			`<span id="s-page" style="background: var(--surface-page)"></span>`,
			`<span id="s-card" style="background: var(--surface-card)"></span>`,
		].join('');

		document.body.appendChild(holder);

		const paint = (n) => getComputedStyle(document.getElementById(`s-${n}`)).backgroundColor;

		// Straight colour and alpha, recovered from the two paints above.
		const layer = (n) => {
			const onWhite = srgb(paint(n), '#fff');
			const onBlack = srgb(paint(n), '#000');
			const a = 1 - (onWhite[0] - onBlack[0]) / 255;

			return {
				rgb: a > 0.001 ? onBlack.map((v) => v / a) : [0, 0, 0],
				a,
			};
		};

		const over = (fg, bg) => fg.rgb.map((v, i) => fg.a * v + (1 - fg.a) * bg[i]);
		const original = document.documentElement.className;
		const sides = {};
		const drifted = [];
		const translucent = [];

		for (const t of themes) {
			document.documentElement.className = t.css.join(' ');

			const key = NAMES.map(paint).join('|');
			const backdrop = over(layer('card'), over(layer('page'), [255, 255, 255]));
			const ink = srgb(paint('ink'), '#000');

			for (const n of NAMES) if (layer(n).a < 0.999) translucent.push(`${t.name}/series-${n}`);

			if (sides[key]) {
				sides[key].themes.push(t.name);
				continue;
			}

			// One entry per distinct scale: :root and .dark are the two expected, and a
			// third means a theme re-declared what both halves promise to leave alone.
			sides[key] = {
				themes: [t.name],
				rows: FILLS.map((n) => {
					const fill = srgb(paint(n), '#000');

					return {
						fill: `series-${n}`,
						label: +ratio(fill, ink).toFixed(2),
						block: +ratio(fill, backdrop).toFixed(2),
					};
				}),
			};
		}

		document.documentElement.className = original;
		holder.remove();

		if (Object.keys(sides).length > 2)
			for (const s of Object.values(sides).slice(2)) drifted.push(s.themes.join(', '));

		return {
			sides: Object.values(sides),
			drifted,
			translucent,
		};
	},
	{
		themes,
		FILLS,
	},
);

await browser.close();
console.log(`${themes.length} themes, ${sides.length} distinct series scale(s)`);

for (const [label, offenders] of [
	['a third series scale — a theme re-declared one', drifted],
	['a series colour is not opaque', [...new Set(translucent)]],
]) {
	if (offenders.length === 0) continue;

	console.error(`\nFAIL — ${label} (${offenders.length}):`);
	for (const o of offenders.slice(0, 10)) console.error(`   ${o}`);
	process.exit(1);
}

for (const side of sides) {
	console.log(`\n${side.themes.length} themes (${side.themes[0]} …)   label / block`);

	for (const r of side.rows.sort((a, b) => a.label - b.label))
		console.log(
			`   ${r.fill.padEnd(12)} ${r.label}:1   ${r.block}:1${r.label < AA ? '   LABEL BELOW 4.5:1' : ''}`,
		);
}

if (sides.some((s) => s.rows.some((r) => r.label < AA))) process.exit(1);
