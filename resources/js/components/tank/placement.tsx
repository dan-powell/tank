import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { Object3D } from 'three';

/** How to read a click: a point in a vertical slice of water, or on the ground. */
export type PlacementMode = { kind: 'swim'; z: number } | { kind: 'ground' };

type Props = {
    mode: PlacementMode;
    onPlace: (point: Vector3) => void;
};

/** Pointer travel (px) beyond which a press is a drag (pan or turn), not a click. */
const CLICK_TOLERANCE = 5;

/**
 * While something is being moved, turns the next left click in the tank
 * into a destination: for swimmers, the point in the water at their depth
 * under the pointer; otherwise the gravel or decoration under it (meshes
 * marked `userData.placeable`).
 */
export function PlacementController({ mode, onPlace }: Props) {
    const camera = useThree((state) => state.camera);
    const scene = useThree((state) => state.scene);
    const element = useThree((state) => state.gl.domElement);

    useEffect(() => {
        const raycaster = new Raycaster();
        const pointer = new Vector2();
        const point = new Vector3();
        let pressedAt: { x: number; y: number } | null = null;

        const onPointerDown = (event: PointerEvent) => {
            pressedAt =
                event.button === 0
                    ? { x: event.clientX, y: event.clientY }
                    : null;
        };

        const onPointerUp = (event: PointerEvent) => {
            if (
                pressedAt === null ||
                Math.hypot(
                    event.clientX - pressedAt.x,
                    event.clientY - pressedAt.y,
                ) > CLICK_TOLERANCE
            ) {
                return;
            }

            const bounds = element.getBoundingClientRect();
            pointer.set(
                ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
                -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
            );
            raycaster.setFromCamera(pointer, camera);

            if (mode.kind === 'swim') {
                const slice = new Plane(new Vector3(0, 0, 1), -mode.z);

                if (raycaster.ray.intersectPlane(slice, point) !== null) {
                    onPlace(point.clone());
                }

                return;
            }

            const placeable: Object3D[] = [];
            scene.traverse((object) => {
                if (object.userData.placeable === true) {
                    placeable.push(object);
                }
            });
            const hit = raycaster.intersectObjects(placeable, false)[0];

            if (hit !== undefined) {
                onPlace(hit.point.clone());
            }
        };

        const previousCursor = element.style.cursor;
        element.style.cursor = 'crosshair';
        element.addEventListener('pointerdown', onPointerDown);
        element.addEventListener('pointerup', onPointerUp);

        return () => {
            element.style.cursor = previousCursor;
            element.removeEventListener('pointerdown', onPointerDown);
            element.removeEventListener('pointerup', onPointerUp);
        };
    }, [camera, scene, element, mode, onPlace]);

    return null;
}
