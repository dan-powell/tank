import type { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { ComponentRef, RefObject } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import type { Camera } from 'three';
import { sightThroughTank, TANK } from '@/lib/tank/space';
import { facingAxis } from '@/lib/tank/views';
import type { TankView } from '@/lib/tank/views';
import type { TankViewMode } from './tank-camera-rig';

type Controls = ComponentRef<typeof OrbitControls>;

type Props = {
    controls: RefObject<Controls | null>;
    /** `orbit` pans freely along the camera's own axes; `flat` keeps the view centre inside the tank. */
    mode: TankViewMode;
    /** The side the flat view looks from. */
    flatView: TankView;
    /** Called as a pan drag starts moving the view (e.g. to stop following an entity). */
    onPan?: () => void;
    /** How far (world units) the view centre may move from the tank's middle along x. */
    xLimit?: number;
    /** How far (world units) the view centre may move from the tank's middle along z. */
    zLimit?: number;
    /** Lowest and highest height (world units) the view centre may move to. */
    yRange?: [number, number];
};

/**
 * Left-drag (mouse or pen) pans the view.
 *
 * In the 3D (`orbit`) view the camera slides along its own x and y axes, so
 * the tank follows the cursor up, down, left or right from any angle. The
 * centre of the view must keep looking through the tank, so the tank can
 * never be dragged out of view; on release the orbit target is moved along
 * the line of sight to a point inside the tank, so rotating pivots around it.
 *
 * In the 2D (`flat`) view it pans across the screen too, but never towards
 * or away from a square-on side (so the front view never pans in depth), and
 * the view centre stays within `xLimit`, `yRange` and `zLimit`.
 */
export function TankPanControls({
    controls,
    mode,
    flatView,
    onPan,
    xLimit = TANK.width * 0.4,
    zLimit = TANK.depth * 0.4,
    // By default, from just above the gravel to the rim (land may rise above the water).
    yRange = [TANK.substrate + 0.1, TANK.height],
}: Props) {
    const [yMin, yMax] = yRange;
    const camera = useThree((state) => state.camera);
    const element = useThree((state) => state.gl.domElement);
    // Read through a ref, so a new callback each render doesn't interrupt a drag.
    const onPanRef = useRef(onPan);

    useEffect(() => {
        onPanRef.current = onPan;
    }, [onPan]);

    useEffect(() => {
        const cameraRight = new Vector3();
        const cameraUp = new Vector3();
        let pointerId: number | null = null;
        let hasPanned = false;
        let lastX = 0;
        let lastY = 0;

        const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0 || event.pointerType === 'touch') {
                return;
            }

            pointerId = event.pointerId;
            hasPanned = false;
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

            if (!hasPanned && (dx !== 0 || dy !== 0)) {
                hasPanned = true;
                onPanRef.current?.();
            }

            const distance = camera.position.distanceTo(orbit.target);
            const fov = camera instanceof PerspectiveCamera ? camera.fov : 45;
            const worldPerPixel =
                (2 * distance * Math.tan((fov * Math.PI) / 360)) /
                Math.max(1, element.clientHeight);

            cameraRight
                .setFromMatrixColumn(camera.matrixWorld, 0)
                .multiplyScalar(-dx * worldPerPixel);
            cameraUp
                .setFromMatrixColumn(camera.matrixWorld, 1)
                .multiplyScalar(dy * worldPerPixel);

            if (mode === 'orbit') {
                panAlongCameraAxes(camera, orbit, cameraRight, cameraUp);

                return;
            }

            const shift = cameraRight.add(cameraUp);
            const facing = facingAxis(flatView);

            if (facing !== null) {
                shift[facing] = 0;
            }

            shift.set(
                clamp(orbit.target.x + shift.x, -xLimit, xLimit) -
                    orbit.target.x,
                clamp(orbit.target.y + shift.y, yMin, yMax) - orbit.target.y,
                clamp(orbit.target.z + shift.z, -zLimit, zLimit) -
                    orbit.target.z,
            );

            orbit.target.add(shift);
            camera.position.add(shift);
            orbit.update();
        };

        const onPointerUp = (event: PointerEvent) => {
            if (event.pointerId !== pointerId) {
                return;
            }

            pointerId = null;

            const orbit = controls.current;

            if (mode === 'orbit' && orbit !== null) {
                pivotInsideTank(camera, orbit);
            }

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
    }, [camera, element, controls, mode, flatView, xLimit, zLimit, yMin, yMax]);

    return null;
}

/**
 * Slide the camera and orbit target together by `right` + `up` (vectors along
 * the camera's own axes), as far as the centre of the view still looks
 * through the tank. If the whole move would miss it, the horizontal or
 * vertical part alone is used so the view slides along the tank's edge, else
 * the move is shortened to stop at the edge.
 */
function panAlongCameraAxes(
    camera: Camera,
    orbit: Controls,
    right: Vector3,
    up: Vector3,
): void {
    const direction = orbit.target.clone().sub(camera.position).normalize();
    const full = right.clone().add(up);
    const looksThroughTank = (shift: Vector3) =>
        sightThroughTank(camera.position.clone().add(shift), direction) !==
        null;

    let shift = [full, right, up].find(looksThroughTank);

    if (shift === undefined) {
        let low = 0;
        let high = 1;

        for (let step = 0; step < 10; step++) {
            const middle = (low + high) / 2;

            if (looksThroughTank(full.clone().multiplyScalar(middle))) {
                low = middle;
            } else {
                high = middle;
            }
        }

        shift = full.multiplyScalar(low);
    }

    camera.position.add(shift);
    orbit.target.add(shift);
    orbit.update();
}

/**
 * Move the orbit target along the line of sight (the camera stays put, so the
 * view doesn't change) to the nearest point inside the tank that is within
 * the zoom limits, so rotating pivots around the tank.
 */
function pivotInsideTank(camera: Camera, orbit: Controls): void {
    const direction = orbit.target.clone().sub(camera.position);
    const distance = direction.length();
    const sight = sightThroughTank(camera.position, direction.normalize());

    if (sight === null) {
        return;
    }

    const nearest = Math.max(sight.enter, orbit.minDistance);
    const farthest = Math.min(sight.exit, orbit.maxDistance);

    if (nearest > farthest) {
        return;
    }

    orbit.target
        .copy(camera.position)
        .addScaledVector(direction, clamp(distance, nearest, farthest));
    orbit.update();
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
