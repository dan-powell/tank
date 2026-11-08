import type { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { ComponentRef, RefObject } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { TANK } from '@/lib/tank/space';

type Props = {
    controls: RefObject<ComponentRef<typeof OrbitControls> | null>;
    /** How far (world units) the view centre may move from the tank's middle along x. */
    xLimit?: number;
    /** Lowest and highest height (world units) the view centre may move to. */
    yRange?: [number, number];
};

/** Never divide by less than this when correcting for a foreshortened axis. */
const MIN_ALIGNMENT = 0.35;

/**
 * Left-drag (mouse or pen) pans the view along the tank's own x axis (its length) and y axis
 * (its height), never in depth, clamped so the tank can never be dragged out
 * of view. The camera and orbit target move together, so rotating still
 * pivots around a point inside the tank.
 */
export function TankPanControls({
    controls,
    xLimit = TANK.width * 0.4,
    // By default, from just above the gravel to the rim (land may rise above the water).
    yRange = [TANK.substrate + 0.1, TANK.height],
}: Props) {
    const [yMin, yMax] = yRange;
    const camera = useThree((state) => state.camera);
    const element = useThree((state) => state.gl.domElement);

    useEffect(() => {
        const cameraRight = new Vector3();
        const cameraUp = new Vector3();
        let pointerId: number | null = null;
        let lastX = 0;
        let lastY = 0;

        const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0 || event.pointerType === 'touch') {
                return;
            }

            pointerId = event.pointerId;
            lastX = event.clientX;
            lastY = event.clientY;
            element.setPointerCapture(event.pointerId);
        };

        const onPointerMove = (event: PointerEvent) => {
            const orbit = controls.current;

            if (
                event.pointerId !== pointerId ||
                orbit === null ||
                !orbit.enabled
            ) {
                return;
            }

            const dx = event.clientX - lastX;
            const dy = event.clientY - lastY;
            lastX = event.clientX;
            lastY = event.clientY;

            const distance = camera.position.distanceTo(orbit.target);
            const fov = camera instanceof PerspectiveCamera ? camera.fov : 45;
            const worldPerPixel =
                (2 * distance * Math.tan((fov * Math.PI) / 360)) /
                Math.max(1, element.clientHeight);

            // How much of the screen's horizontal runs along the tank's x, and
            // its vertical along the tank's y, so the tank follows the cursor.
            // Clamped so panning still works (slowly) when an axis is
            // foreshortened, e.g. viewed end-on or from above.
            cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
            cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);

            const shiftX =
                clamp(
                    orbit.target.x +
                        (-dx * worldPerPixel) / alignment(cameraRight.x),
                    -xLimit,
                    xLimit,
                ) - orbit.target.x;
            const shiftY =
                clamp(
                    orbit.target.y +
                        (dy * worldPerPixel) / alignment(cameraUp.y),
                    yMin,
                    yMax,
                ) - orbit.target.y;

            orbit.target.x += shiftX;
            orbit.target.y += shiftY;
            camera.position.x += shiftX;
            camera.position.y += shiftY;
            orbit.update();
        };

        const onPointerUp = (event: PointerEvent) => {
            if (event.pointerId !== pointerId) {
                return;
            }

            pointerId = null;

            if (element.hasPointerCapture(event.pointerId)) {
                element.releasePointerCapture(event.pointerId);
            }
        };

        const onContextMenu = (event: MouseEvent) => event.preventDefault();

        element.addEventListener('pointerdown', onPointerDown);
        element.addEventListener('pointermove', onPointerMove);
        element.addEventListener('pointerup', onPointerUp);
        element.addEventListener('pointercancel', onPointerUp);
        element.addEventListener('contextmenu', onContextMenu);

        return () => {
            element.removeEventListener('pointerdown', onPointerDown);
            element.removeEventListener('pointermove', onPointerMove);
            element.removeEventListener('pointerup', onPointerUp);
            element.removeEventListener('pointercancel', onPointerUp);
            element.removeEventListener('contextmenu', onContextMenu);
        };
    }, [camera, element, controls, xLimit, yMin, yMax]);

    return null;
}

/** A signed axis alignment, kept away from zero. */
function alignment(component: number): number {
    return (
        Math.sign(component || 1) * Math.max(MIN_ALIGNMENT, Math.abs(component))
    );
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
