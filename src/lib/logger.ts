/**
 * The one place the app reports diagnostics, and therefore the one place to
 * point at a reporting service. Every call site goes through `logError` /
 * `logWarning`; `console` is a lint error everywhere else.
 *
 * Deliberately outside the three layers. Data, business, presentation and the
 * hooks all report failures, so any home inside one of them would break the
 * layer direction for the other two (AGENTS.md R1).
 *
 * Distinct from the user-facing surfaces, of which there are three:
 * `reportStorageError` (the session store's banner), a toast
 * (`presentation/utils/toast.ts`, reached from a store through an injected
 * thunk), and a failure a component already shows on its own. This records what
 * happened for whoever debugs it. Most failures do both, and neither replaces
 * the other — AGENTS.md R1 has the rule for choosing.
 *
 * Never put task titles, notes or any other user content in `context`. It is
 * the payload a reporting service would ship off-device, and this app's whole
 * content is personal. Ids, dates and counts only.
 */

export type LogLevel = 'warn' | 'error';

export type LogContext = Record<string, string | number | boolean | null | undefined>;

export type LogEvent = {
	level: LogLevel;
	message: string;
	error?: unknown;
	context?: LogContext;
};

export type LogSink = (event: LogEvent) => void;

export const consoleSink: LogSink = ({ level, message, error, context }) => {
	console[level](message, ...(error === undefined ? [] : [error]), ...(context ? [context] : []));
};

let sink: LogSink = consoleSink;

/**
 * Swap the destination — called once at startup (`hooks.client.ts`), which is
 * where a Sentry adapter would go.
 *
 * Module scope is safe here in a way a module-scope store is not: the sink is
 * environment configuration, not user data, so there is nothing to leak
 * between SSR requests. Never close over request-scoped values in it; pass
 * those per call as `context`.
 */
export function setLogSink(next: LogSink) {
	sink = next;
}

export function logWarning(message: string, error?: unknown, context?: LogContext) {
	sink({
		level: 'warn',
		message,
		error,
		context,
	});
}

export function logError(message: string, error?: unknown, context?: LogContext) {
	sink({
		level: 'error',
		message,
		error,
		context,
	});
}
