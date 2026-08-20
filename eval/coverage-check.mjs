// Was every rule actually STATED in the context it was scored against?
// A rule absent from `targeted` was withheld, so failing it measures nothing
// about focused context — it measures that we never told the agent.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, MONOLITH_DOCS, docsFor, readContext } from './conditions.mjs';

// One pattern per rule: the phrasing that constitutes STATING it. Deliberately
// generous — a false "present" is the conservative error here, since it keeps a
// row in the headline rather than excusing a failure.
const PATTERNS = {
	R1: /R1\s*[—-]|Layers point one way|never imports `\$lib\/presentation/i,
	R2: /R2\s*[—-]|Routes and components hold no logic/i,
	R3: /R3\s*[—-]|R3 in the UI|One definition per concept/i,
	R4: /R4\s*[—-]|Model inputs are persisted data/i,
	R5: /R5\s*[—-]|does not import SvelteKit routing/i,
	R6: /R6\s*[—-]|Test first: write it, watch it fail/i,
	R7: /R7\s*[—-]|Math changes go in MATH\.md/i,
	R8: /R8\s*[—-]|five-step change/i,
	'convention.crud-prefix': /CRUD verb|\$createX|\$readX/,
	'convention.no-relative-import': /never a relative path|Import through `\$lib`/i,
	'style.color-role': /three roles|[`-]strong`? is text on a _?tinted|[`-]ink`? is text on the/i,
	'presentation.band-view-model': /carries a `Band`|utils\/band\.ts|band\.ts/i,
	'store.context-setter': /set[A-Z]\w*Store\(\)|setXStore/,
	'store.loaded-flag': /Loaded-ness is a field/i,
};

const parseCase = async (id) => {
	const raw = await readFile(path.join(REPO_ROOT, 'eval/cases', `${id}.md`), 'utf8');
	const fm = raw.split('---')[1];
	const get = (k) => fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1].trim() ?? '';

	const list = (k) =>
		get(k)
			.replace(/^\[|\]$/g, '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

	return {
		id,
		rules: list('rules'),
		owns: list('owns'),
		touches: get('touches'),
	};
};

const main = async () => {
	const resultsPath = process.argv[2];

	if (!resultsPath) throw new Error('usage: node eval/coverage-check.mjs <results.json>');

	const results = JSON.parse(await readFile(resultsPath, 'utf8'));
	const ids = [...new Set(results.rows.map((r) => r.case))];
	const withheld = new Set();
	console.log('rule coverage per case — is the rule STATED in the condition it was scored in?\n');
	console.log('case                  rule                            targeted  monolith');

	for (const id of ids) {
		const testCase = await parseCase(id);
		const docs = docsFor(testCase);
		const targetedText = await readContext(docs.targeted ?? testCase.owns);
		const monolithText = await readContext(docs.monolith ?? MONOLITH_DOCS);

		for (const rule of testCase.rules) {
			const p = PATTERNS[rule];

			if (!p) {
				console.log(`  ! no pattern for rule "${rule}" — treated as PRESENT`);
				continue;
			}

			const inT = p.test(targetedText),
				inM = p.test(monolithText);

			if (!inT) withheld.add(`${id}|${rule}`);

			console.log(
				id.padEnd(22) + rule.padEnd(32) + (inT ? 'yes' : 'NO ').padEnd(10) + (inM ? 'yes' : 'NO '),
			);
		}
	}

	console.log('\n--- headline, before and after excluding withheld rules ---');

	for (const cond of ['targeted', 'monolith']) {
		const all = results.rows.filter((r) => r.condition === cond && !r.notes);
		const kept = all.filter((r) => !withheld.has(`${r.case}|${r.rule}`));

		const rate = (rs) =>
			rs.length
				? `${rs.filter((r) => r.pass).length}/${rs.length} = ${((100 * rs.filter((r) => r.pass).length) / rs.length).toFixed(0)}%`
				: 'n/a';

		console.log(`${cond.padEnd(10)} raw ${rate(all).padEnd(18)} excluding withheld ${rate(kept)}`);
	}

	console.log(
		`\nwithheld (rule absent from targeted): ${withheld.size ? [...withheld].join(', ') : 'none'}`,
	);
};

main().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
