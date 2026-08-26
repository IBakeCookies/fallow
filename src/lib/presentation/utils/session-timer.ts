/* The session clock's `localStorage` half, and the one declaration of its key.
   `localStorage` because a running timer has no business in a backup — restoring a
   three-week-old one would resurrect it (data/AGENTS.md, R4's localStorage tier). */

import { logError } from '$lib/logger';
import { sanitizeSessionTimer, type SessionTimer } from '$lib/business/utils/session-timer';

const STORAGE_KEY = 'fallow:session-timer';

export function readSessionTimer(today: string): SessionTimer | null {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);

		return stored === null ? null : sanitizeSessionTimer(JSON.parse(stored), today);
	} catch (e) {
		logError('Failed to read the session timer', e);

		return null;
	}
}

export function writeSessionTimer(timer: SessionTimer | null) {
	try {
		if (timer === null) localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
	} catch {
		// private-mode storage failures just lose the reading
	}
}
