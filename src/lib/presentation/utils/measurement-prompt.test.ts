import { describe, expect, it } from 'vitest';
import { completionPromptAction } from '$lib/presentation/utils/measurement-prompt';

const base = {
	finishing: true,
	measured: false,
	anyEditorOpen: false,
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

	/* The divergence this module exists for: the Lab's draft is page-level, so
	   prompting while ANY editor is open destroys the one being typed into —
	   opening reseeds the draft from stored values. Not only the same task's, and
	   not only the same kind (the main page's ✎ editor closes for the same
	   reason). */
	it('never prompts over an open editor, whosever it is', () => {
		expect(
			completionPromptAction({
				...base,
				anyEditorOpen: true,
			}),
		).toBe('none');
	});

	it('withdraws its own prompt when the task is un-completed', () => {
		expect(
			completionPromptAction({
				...base,
				finishing: false,
				anyEditorOpen: true,
				promptOpenForThisTask: true,
			}),
		).toBe('withdraw');
	});

	it('leaves a hand-opened editor alone when the task is un-completed', () => {
		expect(
			completionPromptAction({
				...base,
				finishing: false,
				anyEditorOpen: true,
			}),
		).toBe('none');
	});

	// Un-completing task A must not close an editor showing for task B
	it('withdraws nothing when the open prompt belongs to another task', () => {
		expect(
			completionPromptAction({
				...base,
				finishing: false,
				anyEditorOpen: true,
				promptOpenForThisTask: false,
			}),
		).toBe('none');
	});
});
