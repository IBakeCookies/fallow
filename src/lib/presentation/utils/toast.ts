import { toast } from 'svelte-sonner';
import { logWarning } from '$lib/logger';

/**
 * How loud a message is. The whole vocabulary — a caller picks the severity,
 * never the colours, which `component/ui/sonner/sonner.svelte` maps to tokens.
 */
export type ToastSeverity = 'danger' | 'warning' | 'success' | 'info';

/**
 * Raise a toast now.
 *
 * Presentation-only by design: copy is a presentation concern (AGENTS.md R2)
 * and the business layer may not import this module at all (R1), so a store
 * that needs to notify takes an injected thunk closing over one of these —
 * the `ReportStorageError` pattern.
 */
export const showToast: Record<ToastSeverity, (message: string) => void> = {
	danger: (message) => toast.error(message),
	warning: (message) => toast.warning(message),
	success: (message) => toast.success(message),
	info: (message) => toast.info(message),
};

/** Every severity, derived from the map so the two can never drift. */
export const TOAST_SEVERITIES = Object.keys(showToast) as ToastSeverity[];

const PENDING_KEY = 'fallow:pending-toasts';

type PendingToast = {
	severity: ToastSeverity;
	message: string;
};

// The queue is user-reachable, so validate on read (R4's rule, one tier down):
// a hand-edited entry must never reach `showToast[undefined]`.
function isPendingToast(value: unknown): value is PendingToast {
	if (!value || typeof value !== 'object') return false;

	const { severity, message } = value as Partial<PendingToast>;

	return typeof message === 'string' && TOAST_SEVERITIES.includes(severity as ToastSeverity);
}

// Separate from the parse below because the two fail for unrelated reasons: no
// sessionStorage at all (SSR, or a locked-down private mode) vs. a payload that
// is present but corrupt.
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
 * the live toaster before it can paint. sessionStorage rather than IndexedDB:
 * the message outlives one navigation, has no business in a backup, and its
 * loss costs nothing — see R4's sessionStorage tier. The reload keeps the URL
 * and therefore the locale, so the resolved string is safe to store and no
 * message key is needed.
 *
 * An array, so two queued messages both survive. Call it immediately before
 * reloading: nothing expires the queue, so a message left in it fires on
 * whatever navigation comes next.
 */
export function showToastAfterReload(severity: ToastSeverity, message: string) {
	// Read without clearing. Consuming here would mean a failed write below
	// destroys the entries that were already queued as well as this one.
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

	// Cleared before parsing, so an unparseable payload is dropped once rather
	// than re-read on every later mount.
	try {
		sessionStorage.removeItem(PENDING_KEY);
	} catch (e) {
		logWarning('Failed to clear pending toasts', e);
	}

	for (const { severity, message } of parsePendingToasts(raw)) showToast[severity](message);
}
