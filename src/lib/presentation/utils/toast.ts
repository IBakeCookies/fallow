import { toast } from 'svelte-sonner';
import { logWarning } from '$lib/logger';

/** A caller picks the severity, never the colours — `ui/sonner/sonner.svelte` maps those to tokens. */
export type ToastSeverity = 'danger' | 'warning' | 'success' | 'info';

/**
 * Raise a toast now. The business layer may not import this module (R1), so a
 * store that needs to notify takes an injected thunk closing over one of these —
 * the `ReportStorageError` pattern.
 */
export const showToast: Record<ToastSeverity, (message: string) => void> = {
	danger: (message) => toast.error(message),
	warning: (message) => toast.warning(message),
	success: (message) => toast.success(message),
	info: (message) => toast.info(message),
};

/**
 * An informational toast carrying one way to take the action back. Sonner dismisses
 * the toast when its action fires, so the undo can only run once. Longer than
 * sonner's 4 s default: reading the message is what tells the user there is anything
 * to undo, and the window is the only thing between them and a lost task.
 */
export function showUndoToast(message: string, undoLabel: string, onUndo: () => void) {
	toast.info(message, {
		duration: 8000,
		action: {
			label: undoLabel,
			onClick: onUndo,
		},
	});
}

/** Every severity, derived from the map so the two can never drift. */
export const TOAST_SEVERITIES = Object.keys(showToast) as ToastSeverity[];

const PENDING_KEY = 'fallow:pending-toasts';

type PendingToast = {
	severity: ToastSeverity;
	message: string;
};

// The queue is hand-editable, so a bad entry must never reach `showToast[undefined]`.
function isPendingToast(value: unknown): value is PendingToast {
	if (!value || typeof value !== 'object') return false;

	const { severity, message } = value as Partial<PendingToast>;

	return typeof message === 'string' && TOAST_SEVERITIES.includes(severity as ToastSeverity);
}

function readRawQueue(): string | null {
	try {
		return sessionStorage.getItem(PENDING_KEY);
	} catch (e) {
		logWarning('Failed to read pending toasts', e);

		return null;
	}
}

function parsePendingToasts(raw: string | null): PendingToast[] {
	if (raw === null) return [];

	try {
		const parsed: unknown = JSON.parse(raw);

		return Array.isArray(parsed) ? parsed.filter(isPendingToast) : [];
	} catch (e) {
		logWarning('Failed to parse pending toasts', e);

		return [];
	}
}

/**
 * Queue a toast to fire after a deliberate `location.reload()`, which destroys
 * the live toaster before it can paint. sessionStorage per R4's tier: losing the
 * message costs nothing. The reload keeps the URL and therefore the locale, so
 * storing the resolved string needs no message key.
 *
 * Call it immediately before reloading — nothing expires the queue, so a message
 * left in it fires on whatever navigation comes next.
 */
export function showToastAfterReload(severity: ToastSeverity, message: string) {
	// Read without clearing, so a failed write below cannot take the entries that
	// were already queued down with this one.
	const pending = parsePendingToasts(readRawQueue());

	try {
		sessionStorage.setItem(
			PENDING_KEY,
			JSON.stringify([
				...pending,
				{
					severity,
					message,
				},
			]),
		);
	} catch (e) {
		// Losing a confirmation must not fail the action it confirms.
		logWarning('Failed to queue a toast across reload', e);
	}
}

/** Fire and clear everything queued. Called once, from the `(app)` layout's mount. */
export function flushPendingToasts() {
	const raw = readRawQueue();

	if (raw === null) return;

	// Cleared before parsing, so an unparseable payload is dropped once rather than
	// re-read on every later mount.
	try {
		sessionStorage.removeItem(PENDING_KEY);
	} catch (e) {
		logWarning('Failed to clear pending toasts', e);
	}

	for (const { severity, message } of parsePendingToasts(raw)) showToast[severity](message);
}
