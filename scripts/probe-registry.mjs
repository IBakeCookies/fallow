// Check scripts/PROBES.md's registry against the probes on disk:
//   node scripts/probe-registry.mjs           report drift
//   node scripts/probe-registry.mjs --check   exit 1 on drift (runs in `npm run lint`)
//
// This CHECKS rather than generates, unlike `math-index.mjs`. The table's
// "Backs" column is curated prose — which MATH.md sections a probe answers for,
// and in what terms — and no probe header carries that as a machine-readable
// field. Generating the table would mean either inventing those cells or
// tagging all 55 probes; verifying coverage catches the failure that actually
// happened (a committed probe nobody listed) at the cost of one script.
//
// The two directions read different sources, and that asymmetry is deliberate.
// A COMMITTED probe with no row is the defect this exists for, so that side
// asks git — an untracked scratch `zz-*.probe.ts` in a dirty tree is not a
// documentation defect, and failing lint for one would train people to stop
// writing them. A row with no file is stale, so that side asks the filesystem:
// a probe and its row land in the same change, and the row must not fail lint
// for the minutes before the file is staged.
import { execFileSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';

const FILE = 'scripts/PROBES.md';
const CHECK = process.argv.includes('--check');
const START = '<!-- probe-registry:start -->';
const END = '<!-- probe-registry:end -->';
const ROW = /^\| `([a-z0-9.-]+\.probe\.ts)`/;

/** Probe basenames listed in the registry table, in the order the table gives them. */
function listed() {
	const document = readFileSync(FILE, 'utf8');
	const open = document.indexOf(START);
	const close = document.indexOf(END, open + 1);

	if (open === -1 || close === -1) throw new Error(`no ${START} … ${END} markers in ${FILE}`);

	return document
		.slice(open, close)
		.split('\n')
		.map((line) => ROW.exec(line)?.[1])
		.filter(Boolean);
}

/** Probe basenames in `scripts/`. */
function present() {
	return readdirSync('scripts').filter((name) => name.endsWith('.probe.ts'));
}

/** Probe basenames git tracks. Falls back to every file present when git is unavailable. */
function committed() {
	try {
		return execFileSync('git', ['ls-files', 'scripts'], {
			encoding: 'utf8',
		})
			.split('\n')
			.filter((path) => path.endsWith('.probe.ts'))
			.map((path) => path.slice(path.lastIndexOf('/') + 1));
	} catch {
		console.warn('git unavailable — treating every probe in scripts/ as committed');

		return present();
	}
}

const rows = listed();
const files = committed();
const unlisted = files.filter((name) => !rows.includes(name));
const orphaned = rows.filter((name) => !present().includes(name));
const duplicated = rows.filter((name, index) => rows.indexOf(name) !== index);

for (const name of unlisted) console.error(`${name} is committed but has no row in ${FILE}`);
for (const name of orphaned) console.error(`${FILE} lists ${name}, which does not exist`);
for (const name of duplicated) console.error(`${FILE} lists ${name} twice`);

if (unlisted.length || orphaned.length || duplicated.length) {
	if (CHECK) process.exit(1);
} else {
	console.log(`${FILE} probe registry matches all ${files.length} committed probes`);
}
