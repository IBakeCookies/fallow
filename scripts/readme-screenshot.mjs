// Regenerate the README hero shot: node scripts/readme-screenshot.mjs [outPath]
// Requires a running app (`npm run dev`, or `npm run build && npm run preview` for
// the production styling the README should show) and system NSS libs for headless
// chromium — if chromium fails with `libnspr4.so`, see .claude/skills/verify/SKILL.md.
// Point it elsewhere with BASE_URL=http://localhost:4173.
//
// Seeds a fixed day through the app's own import path, so the allocations,
// priorities and stopping times in the image are the ones the shipped model
// actually computes for these three tasks — not a mock-up.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = process.argv[2] ?? 'static/fallow-daily-time-allocation.png';
const baseUrl = process.env.BASE_URL ?? 'http://localhost:5173';
const fixture = join(tmpdir(), 'fallow-readme-fixture.json');
// Today, because the app plans the current day and nothing else.
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const tasks = [
	{
		title: 'Boxing Training',
		physicalDifficulty: 7,
		mentalDifficulty: 2,
		enjoyment: 9,
	},
	{
		title: 'Learn Rust',
		physicalDifficulty: 0,
		mentalDifficulty: 7,
		enjoyment: 7,
	},
	{
		title: 'Write Quarterly Report',
		physicalDifficulty: 0,
		mentalDifficulty: 6,
		enjoyment: 3,
	},
];

writeFileSync(
	fixture,
	JSON.stringify({
		app: 'fallow',
		// DB_VERSION in src/lib/data/storage/indexed-db.ts; import refuses a newer one.
		schemaVersion: 6,
		exportedAt: `${date}T12:00:00.000Z`,
		stores: {
			sessions: [
				{
					date,
					tasks: tasks.map((task, index) => ({
						...task,
						id: index + 1,
						createdAt: date,
						completed: false,
					})),
					availableHours: 8,
					switchCost: 0.25,
					cognitivePool: 4,
					physicalPool: 6,
					updatedAt: 0,
				},
			],
			routines: [],
			flowObservations: [],
			drainObservations: [],
			restObservations: [],
			settings: [],
			fitSnapshots: [],
		},
	}),
);

const browser = await chromium.launch();

const context = await browser.newContext({
	viewport: {
		width: 1200,
		height: 900,
	},
	deviceScaleFactor: 2,
});

const page = await context.newPage();
await page.goto(baseUrl);

// The import <input> is hidden behind the data menu, but setInputFiles reaches it
// directly; import merges and then reloads the page itself.
await page.locator('input[type="file"]').setInputFiles(fixture);
await page.getByText('Boxing Training').first().waitFor();
await page.waitForTimeout(1000);

// 1200×630 from the top — the budget bar and the ledger, which is what the README
// (and any link preview) needs to show. Widen the clip if the layout grows.
await page.screenshot({
	path: out,
	clip: {
		x: 0,
		y: 0,
		width: 1200,
		height: 630,
	},
});

await browser.close();
console.log(`wrote ${out}`);
