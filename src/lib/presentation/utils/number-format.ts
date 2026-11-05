/* Decimals follow the reader's locale, like every date beside them does —
   otherwise a German reader gets "1.5" between two German dates. The locale tag
   is a parameter rather than a `getDateLocale()` call so this stays a plain
   module: reading the active locale needs `$app/state`, and with it every caller
   would only be testable inside a component. */

/** A fixed-precision decimal in the reader's locale. */
export function formatDecimals(value: number, digits: number, locale: string): string {
	return value.toLocaleString(locale, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	});
}

/**
 * A change in per cent, signed both ways: "+3.1%" and "−6.2%" have to be told
 * apart at a glance, and a bare "6.2%" reads as a gain. A tie, -0 included,
 * takes no sign.
 */
export function formatSignedPercent(value: number, locale: string): string {
	const sign = value > 0 ? '+' : value < 0 ? '−' : '';

	const magnitude = Math.abs(value).toLocaleString(locale, {
		maximumFractionDigits: 1,
	});

	return `${sign}${magnitude}%`;
}
