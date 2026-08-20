// Context conditions for the rule-adherence eval: each condition resolves to an
// ordered list of doc paths whose contents get concatenated into the prompt of
// the agent under test. The point of the harness is the spread between them.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

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

export const CONDITIONS = ['none', 'targeted', 'routed', 'monolith'];

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
	targeted: testCase.owns,
	routed: routed(testCase),
	monolith: MONOLITH_DOCS,
});

export const readContext = async (docPaths) => {
	const parts = await Promise.all(
		docPaths.map(async (rel) => {
			const body = await readFile(path.join(REPO_ROOT, rel), 'utf8');

			return `===== ${rel} =====\n${body.trim()}`;
		}),
	);

	return parts.join('\n\n');
};

// No tokenizer package is installed (checked: no @anthropic-ai/tokenizer, no
// tiktoken), and the harness must not add a dependency — words * 4/3 is close
// enough to rank the conditions against each other.
export const estimateTokens = (text) =>
	Math.round((text.split(/\s+/u).filter(Boolean).length * 4) / 3);
