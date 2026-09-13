// Regenerate the README hero shot: `npm run screenshot:readme` (builds, previews,
// shoots). Without BASE_URL the script starts `vite preview` itself against the
// current build; BASE_URL=http://localhost:5173 points it at a running dev server
// instead. THEME=<theme name> shoots in that theme (default: whatever the app
// picks for a fresh visit). Needs system NSS libs for headless chromium — if
// chromium fails with `libnspr4.so`, see .claude/skills/verify/SKILL.md.
//
// Seeds a fixed day through the app's own import path, so the allocations,
// priorities and stopping times in the image are the ones the shipped model
// actually computes for these three tasks — not a mock-up.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = process.argv[2] ?? 'static/fallow-daily-time-allocation.png';
let baseUrl = process.env.BASE_URL;
let server;

if (!baseUrl) {
	baseUrl = 'http://localhost:4173';

	// The binary itself, not `npx vite`: kill() must reach the server, not a wrapper.
	server = spawn(join('node_modules', '.bin', 'vite'), ['preview', '--strictPort'], {
		stdio: 'ignore',
	});

	while (
		!(await fetch(baseUrl).then(
			() => true,
			() => false,
		))
	) {
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
}

const fixture = join(tmpdir(), 'fallow-readme-fixture.json');
// Today, because the app plans the current day and nothing else.
const now = new Date();
/** @param {number} n */
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

// The server stamps the theme classes from this cookie before first paint, so
// setting it here is enough — no in-app clicking. Names: `themes` in
// src/lib/business/model/theme.ts.
if (process.env.THEME) {
	await context.addCookies([
		{
			name: 'theme',
			value: process.env.THEME,
			url: baseUrl,
		},
	]);
}

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
server?.kill();
console.log(`wrote ${out}`);
