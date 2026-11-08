import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';

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

type MarkerProps = {
    /** Height (world units) of the marker's tip above the parent's origin. */
    height: number;
};

/**
 * A small bobbing chevron above the selected entity, drawn over everything
 * so it stays visible behind plants and through the glass.
 */
export function SelectionMarker({ height }: MarkerProps) {
    const group = useRef<Group>(null);

    useFrame((state) => {
        if (group.current !== null) {
            group.current.position.y =
                height + Math.sin(state.clock.elapsedTime * 4) * 0.008;
            group.current.rotation.y = state.clock.elapsedTime * 1.5;
        }
    });

    return (
        <group ref={group} position={[0, height, 0]}>
            <mesh
                position={[0, 0.02, 0]}
                rotation={[Math.PI, 0, 0]}
                renderOrder={10}
                raycast={() => null}
            >
                <coneGeometry args={[0.014, 0.04, 4]} />
                <meshBasicMaterial
                    color="#ffe27a"
                    depthTest={false}
                    transparent
                    opacity={0.95}
                />
            </mesh>
        </group>
    );
}
