import type { Preview } from '@storybook/sveltekit';
import {
	DEFAULT_THEME,
	getClassesToAdd,
	themes,
	type ThemeName,
} from '../src/lib/business/model/theme';
import { sceneryStyle } from '../src/lib/presentation/utils/scenery-seed';
import { dataSceneryStyle } from '../src/lib/presentation/utils/scenery-time';
import '../src/lib/presentation/style/app.css';

/* Fixed, so a story's background is identical on every run. */
const SCENERY_SEED = 42;

/* The decorative layers normally come from the root layout, which no story
   renders. Without them a translucent card is reviewed over a flat colour —
   and "does this need backdrop-blur?" is exactly what these stories are for. */
function mountScenery(): HTMLElement {
	const existing = document.querySelector<HTMLElement>('.theme-scenery');

	if (existing) return existing;

	const scenery = document.createElement('div');
	scenery.className = 'theme-scenery';
	scenery.ariaHidden = 'true';

	scenery.append(
		...[1, 2, 3, 4].map((index) => {
			const helper = document.createElement('div');
			helper.className = `theme-helper-${index}`;

			return helper;
		}),
	);

	document.body.prepend(scenery);

	return scenery;
}

const preview: Preview = {
	initialGlobals: {
		theme: DEFAULT_THEME,
	},

	globalTypes: {
		theme: {
			description: 'Theme palette — every token resolves from this class on <html>',
			toolbar: {
				title: 'Theme',
				icon: 'paintbrush',
				dynamicTitle: true,
				items: themes.map((theme) => ({
					value: theme.name,
					title: theme.label,
				})),
			},
		},
	},

	// Mirrors what hooks.server.ts stamps into the HTML: the theme classes on
	// <html>. Everything else (page background, font) follows from @layer base.
	beforeEach: ({ globals }) => {
		document.documentElement.className = getClassesToAdd(globals.theme as ThemeName).join(' ');

		mountScenery().setAttribute(
			'style',
			`${sceneryStyle(SCENERY_SEED)}; ${dataSceneryStyle(new Date())}`,
		);
	},

	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},

		a11y: {
			// 'todo' - show a11y violations in the test UI only
			// 'error' - fail CI on a11y violations
			// 'off' - skip a11y checks entirely
			test: 'error',
		},
	},
};

export default preview;
