import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverTimeout = 60 * 1000;
const testTimeout = 60 * 1000;
// Absolute: Playwright resolves `outputDir` against this file's directory but
// a reporter's `outputFolder` against the test root, so a relative path wrote
// the report twice — once at the root, once under `src/`.
const outputDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-result/e2e');

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		timeout: serverTimeout,
	},
	timeout: testTimeout,
	outputDir: `${outputDir}/asset`,
	testMatch: '**/*.e2e.{ts,js}',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : 6,
	reporter: [
		['list'],
		[
			'html',
			{
				outputFolder: `${outputDir}/report`,
			},
		],
	],
	use: {
		// Recording both for every test, only to delete them on a green run, cost a
		// third of the wall clock (45-test subset, 6 workers: 42s → 28s, measured
		// 2026-08-11). It is a CONTENTION cost — six recorders on four cores — so it
		// barely shows at `--workers=1`. On a retry the artefacts are still there,
		// which covers CI (`retries: 2`); locally, re-run the failing file with
		// `--trace on`.
		trace: 'on-first-retry',
		video: 'on-first-retry',
		// The production build registers a service worker, so every test otherwise
		// paid for an install and precache it never asserts on (~10% of the same
		// subset). service-worker.e2e.ts opts back in — it is the only suite whose
		// subject this is.
		serviceWorkers: 'block',
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
			},
		},
	],
});
