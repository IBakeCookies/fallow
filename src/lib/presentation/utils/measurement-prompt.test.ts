import { describe, expect, it } from 'vitest';
import {
	claimPendingMinutes,
	completionPromptAction,
	drainDraftFromLog,
	newDrainDraft,
	type DrainDraft,
	RATING_INPUT_CLASS,
	spendsPendingMinutes,
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

/* One stop funds one log (MATH.md §18), and several rows can hold an open 🪫 editor at
   once — two tasks ticked done each opened one, and each was handed the same 45. */
describe('the pending reading is claimed by one editor', () => {
	const claiming = () => newDrainDraft('completion', 45);

	const correction = drainDraftFromLog({
		id: 7,
		date: '2026-08-22',
		taskId: 1,
		taskTitle: 'write report',
		hours: 1,
		cognitiveDemand: 0.7,
		physicalDemand: 0.3,
		mindDrain: 5,
		bodyDrain: 3,
		createdAt: 0,
	});

	it('hands the reading to the first editor opened', () => {
		expect(claimPendingMinutes({}, 45)).toBe(45);
	});

	it('opens a second editor empty while another holds it', () => {
		expect(
			claimPendingMinutes(
				{
					1: claiming(),
				},
				45,
			),
		).toBeNull();
	});

	it('releases it when the claiming editor closes unsaved', () => {
		const drafts: Record<number, DrainDraft> = {
			1: claiming(),
		};

		delete drafts[1];

		expect(claimPendingMinutes(drafts, 45)).toBe(45);
	});

	// A correction seeds its own minutes from the rating it rewrites, not from the clock.
	it('is not held by an open correction', () => {
		expect(
			claimPendingMinutes(
				{
					1: correction,
				},
				45,
			),
		).toBe(45);
	});

	it('is spent by the editor that claimed it', () => {
		expect(spendsPendingMinutes(claiming(), 45)).toBe(true);
	});

	it('is not spent by a row that opened empty', () => {
		expect(spendsPendingMinutes(newDrainDraft('completion'), 45)).toBe(false);
	});

	it('is never spent by a correction', () => {
		expect(spendsPendingMinutes(correction, 45)).toBe(false);
	});

	it('is spent by nothing once the clock is no longer stopped', () => {
		expect(spendsPendingMinutes(claiming(), null)).toBe(false);
	});
});
