import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { TankSelection } from '@/types';

/** Pointer travel (px) beyond which a press is a drag (pan), not a selecting click. */
const CLICK_TOLERANCE = 5;

/**
 * The object name that marks an entity's clickable mesh, so the camera can
 * find it to follow (see {@link useSelectable}).
 */
export function followTargetName(selection: TankSelection): string {
    return `follow:${selection.kind}-${selection.id}`;
}

/**
 * Pointer handlers that select an entity on a left click (but not at the end
 * of a pan drag) and show a pointer cursor while hovering it. Given the
 * entity, the mesh is also named with {@link followTargetName}.
 */
export function useSelectable(onSelect: () => void, entity?: TankSelection) {
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
        name: entity === undefined ? '' : followTargetName(entity),
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
