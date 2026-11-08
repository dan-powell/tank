import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

/** Pointer travel (px) beyond which a press is a drag (pan), not a selecting click. */
const CLICK_TOLERANCE = 5;

/**
 * Pointer handlers that select an entity on a left click (but not at the end
 * of a pan drag) and show a pointer cursor while hovering it.
 */
export function useSelectable(onSelect: () => void) {
    const element = useThree((state) => state.gl.domElement);
    const isHovered = useRef(false);

    useEffect(
        () => () => {
            if (isHovered.current) {
                element.style.cursor = '';
            }
        },
        [element],
    );

    return {
        onClick: (event: ThreeEvent<MouseEvent>) => {
            event.stopPropagation();

            if (event.button === 0 && event.delta <= CLICK_TOLERANCE) {
                onSelect();
            }
        },
        onPointerOver: (event: ThreeEvent<PointerEvent>) => {
            event.stopPropagation();
            isHovered.current = true;
            element.style.cursor = 'pointer';
        },
        onPointerOut: () => {
            isHovered.current = false;
            element.style.cursor = '';
        },
    };
}
