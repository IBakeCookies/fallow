import { describe, expect, it } from 'vitest';
import {
	completionPromptAction,
	RATING_INPUT_CLASS,
} from '$lib/presentation/utils/measurement-prompt';

const base = {
	finishing: true,
	measured: false,
	editorOpenOnThisRow: false,
	promptOpenForThisTask: false,
};

describe('completionPromptAction', () => {
	it('asks for the measurement when a task is finished', () => {
		expect(
			completionPromptAction({
				...base,
			}),
		).toBe('open');
	});

	it('stays quiet when the measurement already exists', () => {
		expect(
			completionPromptAction({
				...base,
				measured: true,
			}),
		).toBe('none');
	});

	/* Opening again reseeds the draft, so the prompt yields to one already showing on
	   the row. Scoped to the row on purpose: a draft on ANOTHER row used to block this
	   too, which is why a second task ticked off in the Lab got no prompt at all.
	   Nothing about another row reaches this predicate now, so neither screen can
	   regrow that half of the divergence. */
	it('never prompts over an editor open on the same row', () => {
		expect(
			completionPromptAction({
				...base,
				editorOpenOnThisRow: true,
			}),
		).toBe('none');
	});

	it('withdraws its own prompt when the task is un-completed', () => {
		expect(
			completionPromptAction({
				...base,
				finishing: false,
				editorOpenOnThisRow: true,
				promptOpenForThisTask: true,
			}),
		).toBe('withdraw');
	});

	// An editor the user opened by hand is theirs to keep — and un-completing task A
	// reaches nothing on task B's row, which is now true by construction.
	it('leaves a hand-opened editor alone when the task is un-completed', () => {
		expect(
			completionPromptAction({
				...base,
				finishing: false,
				editorOpenOnThisRow: true,
			}),
		).toBe('none');
	});
});

describe('RATING_INPUT_CLASS', () => {
	// Mind and body are one field in two paints, six copies of it before this record.
	// Anything that changes in one and not the other — a width, a focus ring — is the
	// drift the record exists to stop, and it is invisible on a page showing both.
	it('spells both channels identically apart from the capacity token', () => {
		expect(RATING_INPUT_CLASS.mind.replaceAll('mind', 'CAPACITY')).toBe(
			RATING_INPUT_CLASS.body.replaceAll('body', 'CAPACITY'),
		);
	});
});
