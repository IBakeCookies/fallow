// Context conditions for the rule-adherence eval: each condition resolves to an
// ordered list of doc paths whose contents get concatenated into the prompt of
// the agent under test. The point of the harness is the spread between them.

import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..');

// `routed` is today's actual design: the root brief plus the layer file(s) the
// task touches.
const LAYER_DOCS = {
	presentation: ['src/lib/presentation/AGENTS.md', 'src/lib/presentation/style/STYLE.md'],
	business: ['src/lib/business/AGENTS.md'],
	model: ['src/lib/business/model/AGENTS.md'],
	data: ['src/lib/data/AGENTS.md'],
};

export const MONOLITH_DOCS = [
	'AGENTS.md',
	'docs/design.md',
	'docs/testing.md',
	'docs/deployment.md',
	'src/lib/data/AGENTS.md',
	'src/lib/business/AGENTS.md',
	'src/lib/business/model/AGENTS.md',
	'src/lib/presentation/AGENTS.md',
	'src/lib/presentation/style/STYLE.md',
];

export const CONDITIONS = ['none', 'effort', 'targeted', 'routed', 'monolith'];

// `effort` carries no rules — it is `none` plus a disposition to verify, and it
// exists to separate two explanations that the other conditions cannot tell
// apart. Within a single condition, what a run spent predicts its score
// (Spearman 0.81 over 8 reps), and the rules cost ~4x more to follow than to
// omit, so an arm holding the whole corpus may be scoring higher because the
// rules made it work more rather than because they told it anything. If ~30
// tokens of "verify your work" recovers what 33,856 tokens of rules recovers,
// the corpus is mostly buying effort.
//
// Deliberately names no tool and no rule: `prettier`, `eslint` or "test first"
// would restate AGENTS.md §3 and R6, and this has to be the disposition without
// the content.
export const EFFORT_DIRECTIVE = [
	'Work thoroughly. Before you treat this as done, verify the change actually',
	'works rather than assuming it does: exercise it with whatever checks this',
	'project already has, and iterate until they pass. Do not stop at the first',
	'plausible implementation.',
].join(' ');

// R6 is the testing rule; the router hands out docs/testing.md for it on top of
// the layer files.
const routed = (testCase) => {
	const layer = LAYER_DOCS[testCase.touches];

	if (!layer) throw new Error(`${testCase.id}: unknown touches area "${testCase.touches}"`);

	const testing = testCase.rules.includes('R6') ? ['docs/testing.md'] : [];

	return ['AGENTS.md', ...layer, ...testing];
};

export const docsFor = (testCase) => ({
	none: [],
	effort: [],
	targeted: testCase.owns,
	routed: routed(testCase),
	monolith: MONOLITH_DOCS,
});

// Read out of `base`, never off the working tree. A sweep names the commit its
// runs are scored against, and the rules corpus is half of what is being
// measured — reading the live tree would let an edit to AGENTS.md change what
// an agent was told while leaving the code it works on untouched, so two sweeps
// pinned to the same base could still be measuring different rules. That
// happened once: the first `--base` sweep pinned the code and not the docs.
export const readContext = async (docPaths, base) => {
	const parts = await Promise.all(
		docPaths.map(async (rel) => {
			const { stdout } = await promisify(execFile)('git', ['show', `${base}:${rel}`], {
				cwd: REPO_ROOT,
				maxBuffer: 32 * 1024 * 1024,
			});

			return `===== ${rel} =====\n${stdout.trim()}`;
		}),
	);

	return parts.join('\n\n');
};

// No tokenizer package is installed (checked: no @anthropic-ai/tokenizer, no
// tiktoken), and the harness must not add a dependency — words * 4/3 is close
// enough to rank the conditions against each other.
export const estimateTokens = (text) =>
	Math.round((text.split(/\s+/u).filter(Boolean).length * 4) / 3);
