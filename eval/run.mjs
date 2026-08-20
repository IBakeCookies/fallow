// Driver for the rule-adherence eval. For every (case x condition x rep) it
// hands a task to the agent under test in a throwaway containerised git
// worktree, scores the resulting diff, and writes one row per rule to
// eval/results/.
//
//   node eval/run.mjs --cases '*.md' --conditions none,routed --reps 3
//   node eval/run.mjs --cases 'a.md,b.md' --max-turns 150
//   node eval/run.mjs --base 3fa78c9 --conditions none
//   node eval/run.mjs --dry-run

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { glob, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { CONDITIONS, REPO_ROOT, docsFor, estimateTokens, readContext } from './conditions.mjs';
import { judge } from './judge.mjs';
import { IMAGE_NAME, invokeAgent, must, readOauthToken, withSandbox } from './sandbox.mjs';

const CASES_DIR = path.join(REPO_ROOT, 'eval/cases');
const RESULTS_DIR = path.join(REPO_ROOT, 'eval/results');

const git = async (args) =>
	(
		await promisify(execFile)('git', args, {
			cwd: REPO_ROOT,
		})
	).stdout.trim();

// --- args ------------------------------------------------------------------

const parseArgs = (argv) => {
	const flags = {
		cases: '*.md',
		conditions: CONDITIONS.join(','),
		reps: '1',
		concurrency: '3',
		base: 'HEAD',
		'max-turns': '100',
	};

	const dryRun = argv.includes('--dry-run');
	const skipCanary = argv.includes('--skip-canary');

	for (const [i, arg] of argv.entries()) {
		const key = arg.replace(/^--/u, '');

		if (arg.startsWith('--') && key in flags) flags[key] = argv[i + 1];
	}

	const conditions = flags.conditions.split(',').filter(Boolean);
	const unknown = conditions.filter((c) => !CONDITIONS.includes(c));

	if (unknown.length) throw new Error(`unknown condition(s): ${unknown.join(', ')}`);

	return {
		cases: flags.cases,
		conditions,
		reps: Number(flags.reps),
		concurrency: Number(flags.concurrency),
		base: flags.base,
		maxTurns: Number(flags['max-turns']),
		dryRun,
		skipCanary,
	};
};

// --- case files ------------------------------------------------------------

// Hand-rolled because the frontmatter shape is fixed: scalars and flat lists.
const parseFrontmatter = (block) => {
	const fields = {};

	for (const line of block.split('\n')) {
		const match = /^([a-z]+):\s*(.*)$/u.exec(line.trim());

		if (!match) continue;

		const [, key, raw] = match;

		fields[key] = raw.startsWith('[')
			? raw
					.slice(1, raw.lastIndexOf(']'))
					.split(',')
					.map((v) => v.trim())
					.filter(Boolean)
			: raw.trim();
	}

	return fields;
};

// Markdown sections at one heading depth, keyed by their heading text.
const sections = (body, depth) => {
	const map = new Map();

	for (const part of body.split(new RegExp(`^#{${depth}} `, 'mu')).slice(1)) {
		const [heading, ...rest] = part.split('\n');
		map.set(heading.trim(), rest.join('\n').trim());
	}

	return map;
};

// `- rule: R2` opens an item; the indented lines under it are its fields.
const parseChecks = (block) => {
	const items = [];

	for (const line of block.split('\n')) {
		const opener = /^-\s*rule:\s*(.+)$/u.exec(line.trim());

		if (opener) {
			items.push({
				rule: opener[1].trim(),
			});

			continue;
		}

		const field = /^([a-z]+):\s*(.+)$/u.exec(line.trim());

		if (field && items.length) items.at(-1)[field[1]] = field[2].trim();
	}

	return items;
};

const parseCase = (text, file) => {
	const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(text);

	if (!match) throw new Error(`${file}: missing YAML frontmatter`);

	const meta = parseFrontmatter(match[1]);
	const body = sections(match[2], 2);
	const checks = sections(body.get('Checks') ?? '', 3);

	return {
		id: meta.id,
		class: meta.class,
		rules: meta.rules ?? [],
		touches: meta.touches,
		owns: meta.owns ?? [],
		prompt: body.get('Prompt') ?? '',
		deterministic: parseChecks(checks.get('deterministic') ?? ''),
		judge: parseChecks(checks.get('judge') ?? ''),
	};
};

// `--cases` is a comma-separated list of globs, so a sweep can name an
// arbitrary subset of the cases without one pattern having to cover it.
const loadCases = async (patterns) => {
	const cases = [];
	const seen = new Set();

	for (const pattern of patterns.split(',').filter(Boolean))
		for await (const file of glob(pattern, {
			cwd: CASES_DIR,
		})) {
			if (seen.has(file)) continue;

			seen.add(file);
			cases.push(parseCase(await readFile(path.join(CASES_DIR, file), 'utf8'), file));
		}

	if (!cases.length) throw new Error(`no cases matched ${patterns} in ${CASES_DIR}`);

	return cases.sort((a, b) => a.id.localeCompare(b.id));
};

// --- the agent's output ----------------------------------------------------

const streamEvents = function* (stdout) {
	for (const raw of stdout.split('\n')) {
		if (!raw.trim().startsWith('{')) continue;

		try {
			yield JSON.parse(raw);
		} catch {
			continue;
		}
	}
};

// stream-json is one JSON event per line. The judge only needs what was said
// and what was run, so keep the text, the tool calls and their output.
const compactTranscript = (stdout) => {
	const lines = [];

	for (const event of streamEvents(stdout)) {
		for (const block of event.message?.content ?? []) {
			if (block.type === 'text' && block.text.trim()) lines.push(`assistant: ${block.text.trim()}`);

			if (block.type === 'tool_use')
				lines.push(`tool ${block.name}: ${JSON.stringify(block.input).slice(0, 1500)}`);

			if (block.type === 'tool_result') {
				const text =
					typeof block.content === 'string'
						? block.content
						: (block.content ?? []).map((c) => c.text ?? '').join('\n');

				lines.push(`result: ${text.slice(0, 1500)}`);
			}
		}
	}

	return lines.join('\n');
};

// The last event of a print-mode stream carries the run's ledger: what the
// permission layer refused, and what the run cost.
const resultEvent = (stdout) => [...streamEvents(stdout)].findLast((e) => e.type === 'result');

// --- preflight -------------------------------------------------------------

// A sweep is dozens of six-minute runs, and the two things that would make all
// of them worthless — no image, a dead credential — are settled before anything
// is spawned. The context-isolation assertions moved into the container, where
// `withSandbox` re-checks them on every single run.
const preflight = async () => {
	const images = await promisify(execFile)('docker', ['images', '-q', IMAGE_NAME]).catch(
		(error) => {
			throw new Error(`docker is not usable (${error.message.trim()}) — is the daemon running?`);
		},
	);

	if (!images.stdout.trim())
		throw new Error(
			`no \`${IMAGE_NAME}\` image — build it once with:\n` +
				`  npx sandcastle docker build-image --image-name ${IMAGE_NAME} ` +
				'--dockerfile .sandcastle/Dockerfile',
		);

	const { token, expiresAt } = await readOauthToken();

	if (expiresAt !== null)
		console.log(
			`OAuth token expires in ${((expiresAt - Date.now()) / 3.6e6).toFixed(1)}h; a sweep that ` +
				'outlasts it needs CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`.',
		);

	return token;
};

const CANARY_PROMPT = `Before doing anything else, write a file named canary.json in the current working directory, with exactly this shape:

{"files": [{"name": "<file name>", "firstLine": "<its first line, verbatim>"}]}

List one entry for every project instruction file, rules file, coding-convention file or memory file whose contents are already present in your context for this session — for example a CLAUDE.md, an AGENTS.md, a MEMORY.md, or any other project guidance you were given before this message. Report only what was already in your context: do not search the filesystem for candidates, and do not guess. If there are none, write {"files": []}.

Then read canary.json back and print its contents. Do nothing else.`;

// The empirical half of the isolation story. A stripped worktree with zero
// injected context asks the agent what project rules it can see; anything it
// names stops the sweep. This is a self-report, so it catches gross
// contamination (a whole rules file in context), not subtle priming.
const runCanary = async (base, token, maxTurns) =>
	withSandbox('canary', base, token, async (sandbox) => {
		const agent = await invokeAgent(sandbox, CANARY_PROMPT, maxTurns);
		const file = await sandbox.exec('cat canary.json');

		if (file.exitCode !== 0)
			throw new Error(
				`the canary agent wrote no canary.json (exit ${agent.exitCode}), so isolation is ` +
					`unproven: ${agent.stderr.trim() || 'no stderr'}`,
			);

		const report = file.stdout.trim();
		const leak = /AGENTS\.md|CLAUDE\.md|MEMORY\.md|fallow|zenith/iu.exec(report);

		if (leak)
			throw new Error(
				`the canary agent can see project context (matched "${leak[0]}"), so the withheld ` +
					`conditions would be measuring nothing. It reported:\n${report}`,
			);

		return {
			report,
			cost_usd: resultEvent(agent.stdout)?.total_cost_usd ?? null,
		};
	});

// --- scoring ---------------------------------------------------------------

const scoreDeterministic = async (check, sandbox, changed) => {
	if (!changed.length)
		return {
			pass: false,
			evidence: 'no files changed',
		};

	const command = check.run.replaceAll('$CHANGED', changed.join(' '));
	const expected = Number(/exit\s+(\d+)/u.exec(check.expect ?? 'exit 0')[1]);
	const { exitCode, stdout, stderr } = await sandbox.exec(command);
	const output = `${stdout}${stderr}`.trim().split('\n').slice(0, 8).join('\n');

	return {
		pass: exitCode === expected,
		evidence: `exit ${exitCode} (expected ${expected}): ${output}`,
	};
};

// --- one run ---------------------------------------------------------------

const executeRun = async (task, base, token, maxTurns) =>
	withSandbox(task.testCase.id, base, token, async (sandbox, from) => {
		const agent = await invokeAgent(sandbox, task.prompt, maxTurns);

		if (agent.exitCode !== 0)
			console.error(`  ! agent exited ${agent.exitCode}: ${agent.stderr.trim()}`);

		const transcript = compactTranscript(agent.stdout);
		const result = resultEvent(agent.stdout);

		// The shell inside the container is unrestricted, so a denial here is not
		// an expected outcome — it means something blocked a command the rules
		// asked for, which is a harness bug rather than a rule failure. Every row
		// for the run carries it, and an empty `notes` is what a usable row looks
		// like.
		const notes = (result?.permission_denials ?? [])
			.map((d) => `denied ${d.tool_name}: ${JSON.stringify(d.tool_input ?? {}).slice(0, 200)}`)
			.concat(agent.exitCode === 0 ? [] : [`agent exited ${agent.exitCode}`])
			.join('; ');

		// On the row rather than the log line only, because an arm can score higher
		// by working longer instead of by following rules better, and the two are
		// indistinguishable after the fact unless the effort is recorded next to
		// the score.
		const effort = {
			turns: result?.num_turns ?? null,
			cost_usd: result?.total_cost_usd ?? null,
		};

		console.log(
			`  ${task.row.case}/${task.row.condition}: ${result?.num_turns ?? '?'} turns, ` +
				`$${(result?.total_cost_usd ?? 0).toFixed(3)}${notes ? `, ${notes}` : ''}`,
		);

		// Diffed against the sha the agent started from rather than the index
		// alone, so work it committed itself is counted too. Deletions are
		// dropped from `$CHANGED`: the checks feed those paths to linters, which
		// exit non-zero on a file that is not there.
		await sandbox.exec('git add -A');
		const diff = must('git diff', await sandbox.exec(`git diff --cached ${from}`));

		const changed = must(
			'git diff --name-only',
			await sandbox.exec(`git diff --cached --diff-filter=d --name-only ${from}`),
		)
			.split('\n')
			.filter(Boolean);

		const rows = [];

		for (const check of task.testCase.deterministic) {
			const { pass, evidence } = await scoreDeterministic(check, sandbox, changed);

			rows.push({
				...task.row,
				...effort,
				rule: check.rule,
				pass,
				source: 'deterministic',
				evidence,
				notes,
			});
		}

		for (const check of task.testCase.judge) {
			const { pass, evidence } = await judge({
				ask: check.ask,
				diff,
				transcript,
			});

			rows.push({
				...task.row,
				...effort,
				rule: check.rule,
				pass,
				source: 'judge',
				evidence,
				notes,
			});
		}

		return rows;
	});

// --- pool ------------------------------------------------------------------

const pool = async (items, limit, worker) => {
	const results = [];
	let next = 0;

	const runners = Array.from(
		{
			length: Math.min(limit, items.length),
		},
		async () => {
			while (next < items.length) {
				const index = next++;
				results[index] = await worker(items[index]);
			}
		},
	);

	await Promise.all(runners);

	return results.flat();
};

// --- main ------------------------------------------------------------------

const main = async () => {
	const args = parseArgs(process.argv.slice(2));
	const token = args.dryRun ? null : await preflight();
	const cases = await loadCases(args.cases);
	// Defaults to HEAD, but a sweep meant to extend an earlier one has to name
	// that sweep's base: several cases score a rule by running `eslint` over the
	// whole changed file, so a commit that adds an unrelated eslint rule makes
	// the same check stricter than it was and the two sweeps stop being
	// comparable.
	const base = await git(['rev-parse', args.base]);
	const tasks = [];

	for (const testCase of cases) {
		// The table has a row per (run, rule); a rule with no check would leave a
		// hole in it, which is a case-authoring mistake worth saying out loud.
		const scored = [...testCase.deterministic, ...testCase.judge].map((check) => check.rule);
		const unscored = testCase.rules.filter((rule) => !scored.includes(rule));

		if (unscored.length) console.error(`! ${testCase.id}: no check for ${unscored.join(', ')}`);

		const docs = docsFor(testCase);

		for (const condition of args.conditions) {
			const context = await readContext(docs[condition]);
			const prompt = context ? `${context}\n\n---\n\n${testCase.prompt}` : testCase.prompt;

			for (let rep = 1; rep <= args.reps; rep++) {
				tasks.push({
					testCase,
					prompt,
					row: {
						run_id: randomUUID(),
						case: testCase.id,
						class: testCase.class,
						condition,
						rep,
						context_tokens: estimateTokens(context),
					},
				});
			}
		}
	}

	if (args.dryRun) {
		for (const task of tasks) {
			console.log(`\n===== ${task.row.case} / ${task.row.condition} / rep ${task.row.rep} =====`);
			console.log(`context_tokens: ${task.row.context_tokens}`);
			console.log(task.prompt);
		}

		console.log(`\n${tasks.length} run(s) resolved against base ${base}; nothing invoked.`);

		return;
	}

	const canary = args.skipCanary ? 'skipped' : await runCanary(base, token, args.maxTurns);
	console.log(`canary: ${JSON.stringify(canary)}`);

	console.log(`${tasks.length} run(s) against base ${base}, concurrency ${args.concurrency}`);

	const rows = await pool(tasks, args.concurrency, async (task) => {
		console.log(`- ${task.row.case} / ${task.row.condition} / rep ${task.row.rep}`);

		return executeRun(task, base, token, args.maxTurns);
	});

	await mkdir(RESULTS_DIR, {
		recursive: true,
	});

	const stamp = new Date().toISOString().replaceAll(':', '-');
	const out = path.join(RESULTS_DIR, `${stamp}.json`);

	await writeFile(
		out,
		`${JSON.stringify(
			{
				base,
				canary,
				rows,
			},
			null,
			2,
		)}\n`,
	);

	console.log(`${rows.length} row(s) -> ${out}`);
};

// A failed preflight or a context leak is a message to read, not a stack to
// decode.
await main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
