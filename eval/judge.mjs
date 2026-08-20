// LLM judge for the checks a shell command cannot decide — "was the test run
// red first?" lives in the transcript, not the diff.
//
// The judge is deliberately blind to the case's Traps section and to any
// good/bad examples: it sees the rubric question, the diff and the transcript,
// and nothing that would tell it which answer the case author expected.

import { spawn } from 'node:child_process';
import os from 'node:os';

const RUBRIC = `You are grading one coding-agent run against a single rule question.

Answer only the question asked. Judge what the diff and transcript actually
show, not what a good change would have looked like. If the evidence does not
establish the answer, the verdict is false.

Reply with one JSON object and nothing else:
{"pass": <boolean>, "evidence": "<one sentence, quoting the file, line or transcript step that decided it>"}`;

const invoke = (prompt) =>
	new Promise((resolve, reject) => {
		// Same reason the agent under test dropped `--bare`: it accepts no OAuth
		// login. The judge must stay blind to this repo's rules, so it is spawned
		// from the temp dir — no CLAUDE.md above it — with auto-memory off. The
		// prompt goes over stdin, not argv: a real diff plus transcript is well
		// past the exec argument limit (E2BIG).
		const child = spawn('claude', ['-p', '--output-format', 'json'], {
			cwd: os.tmpdir(),
			env: {
				...process.env,
				CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
			},
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (d) => (stdout += d));
		child.stderr.on('data', (d) => (stderr += d));
		child.on('error', reject);
		child.stdin.on('error', reject);
		child.stdin.end(prompt);

		child.on('close', (code) =>
			code === 0 ? resolve(stdout) : reject(new Error(`judge exited ${code}: ${stderr.trim()}`)),
		);
	});

// The CLI envelope is JSON; the model's own answer inside `result` is text that
// may still arrive fenced.
const parseVerdict = (raw) => {
	const { result } = JSON.parse(raw);
	const body = result.replace(/^```(?:json)?\s*|\s*```$/gu, '').trim();
	const { pass, evidence } = JSON.parse(body);

	return {
		pass: Boolean(pass),
		evidence: String(evidence ?? ''),
	};
};

export const judge = async ({ ask, diff, transcript }) => {
	const prompt = [
		RUBRIC,
		`## Question\n${ask}`,
		`## Diff\n${diff || '(no changes)'}`,
		`## Transcript\n${transcript || '(empty)'}`,
	].join('\n\n');

	try {
		return parseVerdict(await invoke(prompt));
	} catch (error) {
		return {
			pass: false,
			evidence: `judge failed: ${error.message}`,
		};
	}
};
