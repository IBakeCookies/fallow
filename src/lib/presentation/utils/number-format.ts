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
