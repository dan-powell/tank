import { Box3, Euler, MathUtils, Vector3 } from 'three';
import type { Camera } from 'three';
import { TANK } from '@/lib/tank/space';

/** The fly camera's look angles (radians) and its current velocity (world units/s). */
export type FlyState = { yaw: number; pitch: number; velocity: Vector3 };

/**
 * What the player is doing: the `event.code`s of keys held down, and mouse
 * movement (pixels) gathered since the last frame, cleared once used.
 */
export type FlyInput = { pressed: Set<string>; lookX: number; lookY: number };

/** Every key fly mode listens to, by `event.code`. */
export const FLY_KEYS = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'KeyE',
    'KeyQ',
    'Space',
    'ShiftLeft',
    'ShiftRight',
]);

/** Radians turned per pixel of mouse movement. */
const LOOK_SENSITIVITY = 0.0022;

/** Never quite straight up or down, so the view can't flip over. */
const MAX_PITCH = MathUtils.degToRad(89);

/** Cruising speed, in longest tank sides per second. */
const FLY_SPEED = 0.35;

/** How much faster the camera goes with Shift held. */
const FAST_MULTIPLIER = 3;

/** How quickly the velocity catches up with the keys (per second); higher is snappier. */
const EASE_RATE = 10;

/** How far beyond the glass the camera may roam, in longest tank sides. */
const FLY_MARGIN = 0.75;

/** Lowest the camera may go: just above the floor the tank stands on. */
const FLOOR_CLEARANCE = 0.02;

/** Longest frame step used, so a stalled tab doesn't fling the camera. */
const MAX_DELTA = 0.1;

const euler = new Euler(0, 0, 0, 'YXZ');
const forward = new Vector3();
const right = new Vector3();
const wanted = new Vector3();

function longestSide(): number {
    return Math.max(TANK.width, TANK.height, TANK.depth);
}

/** The space the fly camera may move in: the tank and a margin around it, never below it. */
export function flyBounds(): Box3 {
    const margin = FLY_MARGIN * longestSide();

    return new Box3(
        new Vector3(
            -TANK.width / 2 - margin,
            FLOOR_CLEARANCE,
            -TANK.depth / 2 - margin,
        ),
        new Vector3(
            TANK.width / 2 + margin,
            TANK.height + margin,
            TANK.depth / 2 + margin,
        ),
    );
}

/** Start flying from wherever the camera is looking now, at rest. */
export function flyStateFrom(camera: Camera): FlyState {
    euler.setFromQuaternion(camera.quaternion, 'YXZ');

    return {
        yaw: euler.y,
        pitch: MathUtils.clamp(euler.x, -MAX_PITCH, MAX_PITCH),
        velocity: new Vector3(),
    };
}

/**
 * Advance the fly camera one frame: turn it by the mouse movement (never
 * rolling), ease its velocity towards what the held keys ask for (forward
 * follows the look direction, E/Space and Q go straight up and down), move
 * it, and keep it within {@link flyBounds}.
 */
export function stepFly(
    camera: Camera,
    state: FlyState,
    input: FlyInput,
    bounds: Box3,
    frameDelta: number,
): void {
    const delta = Math.min(frameDelta, MAX_DELTA);
    const held = (...codes: string[]) =>
        codes.some((code) => input.pressed.has(code));

    state.yaw -= input.lookX * LOOK_SENSITIVITY;
    state.pitch = MathUtils.clamp(
        state.pitch - input.lookY * LOOK_SENSITIVITY,
        -MAX_PITCH,
        MAX_PITCH,
    );
    input.lookX = 0;
    input.lookY = 0;

    camera.quaternion.setFromEuler(euler.set(state.pitch, state.yaw, 0));

    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    wanted.set(0, 0, 0);

    if (held('KeyW', 'ArrowUp')) {
        wanted.add(forward);
    }

    if (held('KeyS', 'ArrowDown')) {
        wanted.sub(forward);
    }

    if (held('KeyD', 'ArrowRight')) {
        wanted.add(right);
    }

    if (held('KeyA', 'ArrowLeft')) {
        wanted.sub(right);
    }

    if (held('KeyE', 'Space')) {
        wanted.y += 1;
    }

    if (held('KeyQ')) {
        wanted.y -= 1;
    }

    if (wanted.lengthSq() > 0) {
        const speed =
            FLY_SPEED *
            longestSide() *
            (held('ShiftLeft', 'ShiftRight') ? FAST_MULTIPLIER : 1);

        wanted.normalize().multiplyScalar(speed);
    }

    state.velocity.lerp(wanted, 1 - Math.exp(-EASE_RATE * delta));
    camera.position.addScaledVector(state.velocity, delta);
    bounds.clampPoint(camera.position, camera.position);
}
