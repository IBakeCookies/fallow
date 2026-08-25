import type { Attachment } from 'svelte/attachments';

/* The pointer moves the content, so the container scrolls AGAINST it. Mouse
   only: touch and trackpad already scroll the container themselves, and
   claiming those pointers costs the momentum the platform gives them. */
export const scrollByDrag: Attachment<HTMLElement> = (node) => {
	const onPointerDown = (event: PointerEvent) => {
		if (event.pointerType !== 'mouse' || event.button !== 0) {
			return;
		}

		// Or the drag selects the labels it passes over instead of moving them.
		event.preventDefault();

		const startX = event.clientX;
		const startScrollLeft = node.scrollLeft;

		const onPointerMove = (move: PointerEvent) => {
			node.scrollLeft = startScrollLeft - (move.clientX - startX);
		};

		// On the window, not the node: the pointer leaves a container it is
		// dragging sideways, and the release is what ends the drag.
		const onPointerUp = () => {
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
		};

		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
	};

	node.addEventListener('pointerdown', onPointerDown);

	return () => node.removeEventListener('pointerdown', onPointerDown);
};
