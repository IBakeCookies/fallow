/**
 * Task nature → badge copy and color tokens. The classification is the model's
 * (`getTaskNature`, one definition of the ±3 threshold); the label, description
 * and colors are presentation policy, so they live here and not with the plan
 * (AGENTS.md R2).
 *
 * Messages are read on each call, not baked into a module-scope table, so the
 * badge follows a locale switch.
 */

import * as m from '$lib/paraglide/messages.js';
import type { SuggestedTask } from '$lib/business/model/metric/calculation';

export type TaskNature = SuggestedTask['nature'];

export interface NatureBadge {
	label: string;
	description: string;
	/** Semantic token pair — the mind/body/mixed trio, never a raw palette class. */
	class: string;
}

export function natureBadge(nature: TaskNature): NatureBadge {
	switch (nature) {
		case 'cognitive':
			return {
				label: m.task_nature_cognitive_label(),
				description: m.task_nature_cognitive_description(),
				class: 'bg-mind/20 text-mind'
			};
		case 'physical':
			return {
				label: m.task_nature_physical_label(),
				description: m.task_nature_physical_description(),
				class: 'bg-body/20 text-body'
			};
		case 'balanced':
			return {
				label: m.task_nature_hybrid_label(),
				description: m.task_nature_hybrid_description(),
				class: 'bg-mixed/20 text-mixed'
			};
	}
}
