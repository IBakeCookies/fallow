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
		trace: 'retain-on-failure',
		video: 'retain-on-failure',
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
