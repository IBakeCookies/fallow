// Keep the root AGENTS.md a brief:
//   node scripts/brief-size.mjs           report the size
//   node scripts/brief-size.mjs --check   exit 1 when it is over budget (runs in `npm run lint`)
//
// The file was 1816 lines before it was split, so every agent paid ~26k tokens
// to change a translation. The split only holds if the brief stays one: the
// rule it encodes is AGENTS.md's own — statements here, the "because" in the
// topic file. A line count cannot tell prose from argument, but it does catch
// the way this actually regrows, which is a paragraph at a time.
//
// Raising LIMIT is a decision, not a fix. Move the argument to the file that
// owns it first; if the brief genuinely needs more room after that, raise it in
// the same commit that spends it.
import { readFileSync } from 'fs';

const FILE = 'AGENTS.md';
const LIMIT = 340;
const CHECK = process.argv.includes('--check');
const lines = readFileSync(FILE, 'utf8').split('\n').length;

if (lines > LIMIT) {
	console.error(
		`${FILE} is ${lines} lines, over the ${LIMIT}-line budget — move the argument to the topic file that owns it`,
	);

	if (CHECK) process.exit(1);
} else {
	console.log(`${FILE} is ${lines} lines of ${LIMIT}`);
}
