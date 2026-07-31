/* The "there is an explanation here" affordance: a dotted underline plus the help
   cursor. It is the only thing that tells anyone a tooltip exists — touch never shows
   a native `title`, and two sentences is past what one renders anyway — so it appears
   on every explained label in the app, and the five copies it was spelled in had
   already started to differ in which decoration colour they used.

   Not a component: the sites are an <h1>, an <h3>, a <label for>, a <p> and a
   <button>, and flattening those into one wrapper element would cost the heading
   level, the label association, or the button. */

export const HINT_UNDERLINE_CLASS =
	'cursor-help underline decoration-ty-ghost decoration-dotted underline-offset-4';
