// Screenshot every theme for visual review: node scripts/theme-screenshots.mjs [outDir]
// Requires the dev server on :5173 and system NSS libs for headless chromium —
// if chromium fails with `libnspr4.so`, see .claude/skills/verify/SKILL.md
// (download libnspr4/libnss3 debs and set LD_LIBRARY_PATH to the extracted libs).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

// keep in sync with src/lib/business/store/theme-store.svelte.ts
const themes = [
	'fallow',
	'solid-light',
	'solid-dark',
	'glass-light',
	'glass-dark',
	'cyber-punk',
	'aurora',
	'daybreak',
	'royal',
	'terminal',
	'blueprint',
	'bubblegum',
	'ukiyo',
	'abyss',
	'parchment',
	'noir',
	'ember',
	'glacier',
	'zenith',
	'nadir',
	'eclipse',
	'cathedral',
	'orbit',
	'tempest'
];

const outDir = process.argv[2] ?? 'screenshots';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

for (const theme of themes) {
	await context.addCookies([{ name: 'theme', value: theme, url: 'http://localhost:5173' }]);
	await page.goto('http://localhost:5173/');
	await page.waitForTimeout(800);
	await page.screenshot({ path: `${outDir}/${theme}.png` });
	// theme switcher dropdown open — popovers are a common theme regression
	await page.getByRole('button', { name: /theme/i }).click();
	await page.waitForTimeout(400);
	await page.screenshot({ path: `${outDir}/${theme}-dropdown.png` });
	await page.keyboard.press('Escape');
	await page.waitForTimeout(200);
}

await browser.close();
console.log(`wrote ${themes.length * 2} screenshots to ${outDir}/`);
