import type { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { ComponentRef, RefObject } from 'react';
import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { TANK } from '@/lib/tank/space';

/** `orbit`: free 3D view. `flat`: front-on, near-orthographic 2D-style view. */
export type TankViewMode = 'orbit' | 'flat';

type Controls = ComponentRef<typeof OrbitControls>;

/**
 * How much bigger the current tank is than a starter tank (60 x 32.5 cm),
 * which the camera distances were tuned for.
 */
function tankScale(): number {
    return Math.max(TANK.width / 2.4, TANK.height / 1.3);
}

/** Where the camera starts, and the pivot it orbits, for the current tank. */
export function orbitStart(): {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
} {
    return {
        position: [0, TANK.height * 0.6, 2.6 * tankScale()],
        target: [0, TANK.height * 0.45, 0],
        fov: 75,
    };
}

/** Field of view in flat mode: narrow enough to all but remove perspective. */
const FLAT_FOV = 1;

/** The area (world units) the flat view fits to the screen: the tank front. */
function flatFrame(): { width: number; height: number; centreY: number } {
    return {
        width: TANK.width + 0.1,
        height: TANK.height + 0.08,
        centreY: TANK.height / 2,
    };
}

/** How far (radians) the flat view may be turned or tilted away from the front. */
const FLAT_ROTATION = 0.12;

const TRANSITION_SECONDS = 0.8;

/** Closest the 3D view may come to its pivot, in tank scales (close enough to see single voxels). */
const ORBIT_MIN_DISTANCE = 0.2;

/** Furthest the 3D view may pull back from its pivot, in tank scales. */
const ORBIT_MAX_DISTANCE = 4.5;

/** Closest zoom of the flat view, as a share of the distance that fills the screen with the tank front. */
const FLAT_MIN_ZOOM = 0.08;

/** The near clipping plane as a share of the camera's distance to its pivot, so close-ups aren't clipped. */
const NEAR_PER_DISTANCE = 0.02;

/**
 * A camera pose. Size is held as the visible half-height at the target, so
 * blending between a wide and a narrow field of view keeps the tank roughly
 * the same size on screen instead of zooming wildly mid-way.
 */
type Pose = {
    target: Vector3;
    azimuth: number;
    polar: number;
    halfHeight: number;
    fov: number;
};

type Transition = { from: Pose; to: Pose; progress: number };

type Props = {
    mode: TankViewMode;
    controls: RefObject<Controls | null>;
};

/**
 * Moves the camera between the free orbit view and the flat front view,
 * animating the switch and applying each mode's rotation and zoom limits.
 * Returning to orbit restores the view as it was before going flat.
 */
export function TankCameraRig({ mode, controls }: Props) {
    const camera = useThree((state) => state.camera);
    const aspect = useThree((state) => state.size.width / state.size.height);
    const transition = useRef<Transition | null>(null);
    const savedOrbit = useRef<Pose | null>(null);
    const appliedMode = useRef<TankViewMode | null>(null);

    useEffect(() => {
        const orbit = controls.current;

        if (orbit === null || !(camera instanceof PerspectiveCamera)) {
            return;
        }

        // First run: jump straight to the starting mode, no animation.
        if (appliedMode.current === null) {
            appliedMode.current = mode;

            if (mode === 'flat') {
                applyPose(camera, orbit, flatPose(aspect, 'cover'));
            }

            applyLimits(orbit, mode, aspect);

            return;
        }

        if (appliedMode.current === mode && transition.current === null) {
            applyLimits(orbit, mode, aspect);

            return;
        }

        if (appliedMode.current === mode) {
            return;
        }

        appliedMode.current = mode;
        const from = currentPose(camera, orbit);

        if (mode === 'flat') {
            savedOrbit.current =
                transition.current === null ? from : savedOrbit.current;
        }

        transition.current = {
            from,
            to:
                mode === 'flat'
                    ? flatPose(aspect, 'cover')
                    : (savedOrbit.current ?? orbitStartPose()),
            progress: 0,
        };
        unlockLimits(orbit);
        orbit.enabled = false;
    }, [mode, aspect, camera, controls]);

    useFrame((_, delta) => {
        const active = transition.current;
        const orbit = controls.current;

        if (orbit === null || !(camera instanceof PerspectiveCamera)) {
            return;
        }

        fitClipPlanes(camera, orbit);

        if (active === null) {
            return;
        }

        active.progress = Math.min(
            1,
            active.progress + delta / TRANSITION_SECONDS,
        );
        const eased = MathUtils.smootherstep(active.progress, 0, 1);
        applyPose(camera, orbit, blendPoses(active.from, active.to, eased));

        if (active.progress >= 1) {
            transition.current = null;
            applyLimits(orbit, appliedMode.current ?? 'orbit', camera.aspect);
            orbit.enabled = true;
        }
    });

    return null;
}

function orbitStartPose(): Pose {
    const start = orbitStart();
    const target = new Vector3(...start.target);
    const offset = new Vector3(...start.position).sub(target);
    const spherical = new Spherical().setFromVector3(offset);

    return {
        target,
        azimuth: spherical.theta,
        polar: spherical.phi,
        halfHeight: spherical.radius * halfFovTan(start.fov),
        fov: start.fov,
    };
}

/**
 * Front-on and level, zoomed so the tank front either fills the whole view
 * and is cropped (`cover`) or fits entirely inside it (`contain`), as in CSS
 * object-fit.
 */
function flatPose(aspect: number, fit: 'cover' | 'contain'): Pose {
    const frame = flatFrame();
    const toFitHeight = frame.height / 2;
    const toFitWidth = frame.width / (2 * Math.max(aspect, 0.1));

    return {
        target: new Vector3(0, frame.centreY, 0),
        azimuth: 0,
        polar: Math.PI / 2,
        halfHeight:
            fit === 'cover'
                ? Math.min(toFitHeight, toFitWidth)
                : Math.max(toFitHeight, toFitWidth),
        fov: FLAT_FOV,
    };
}

function currentPose(camera: PerspectiveCamera, orbit: Controls): Pose {
    const spherical = new Spherical().setFromVector3(
        camera.position.clone().sub(orbit.target),
    );

    return {
        target: orbit.target.clone(),
        azimuth: spherical.theta,
        polar: spherical.phi,
        halfHeight: spherical.radius * halfFovTan(camera.fov),
        fov: camera.fov,
    };
}

function blendPoses(from: Pose, to: Pose, amount: number): Pose {
    let turn = (to.azimuth - from.azimuth) % (Math.PI * 2);

    if (turn > Math.PI) {
        turn -= Math.PI * 2;
    } else if (turn < -Math.PI) {
        turn += Math.PI * 2;
    }

    return {
        target: from.target.clone().lerp(to.target, amount),
        azimuth: from.azimuth + turn * amount,
        polar: MathUtils.lerp(from.polar, to.polar, amount),
        halfHeight: MathUtils.lerp(from.halfHeight, to.halfHeight, amount),
        fov: MathUtils.lerp(from.fov, to.fov, amount),
    };
}

function applyPose(
    camera: PerspectiveCamera,
    orbit: Controls,
    pose: Pose,
): void {
    const radius = pose.halfHeight / halfFovTan(pose.fov);

    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    camera.position
        .setFromSpherical(new Spherical(radius, pose.polar, pose.azimuth))
        .add(pose.target);
    orbit.target.copy(pose.target);
    orbit.update();
}

function applyLimits(
    orbit: Controls,
    mode: TankViewMode,
    aspect: number,
): void {
    if (mode === 'orbit') {
        orbit.minDistance = ORBIT_MIN_DISTANCE * tankScale();
        orbit.maxDistance = ORBIT_MAX_DISTANCE * tankScale();
        orbit.minPolarAngle = 0.3;
        orbit.maxPolarAngle = Math.PI / 2;
        orbit.minAzimuthAngle = -Infinity;
        orbit.maxAzimuthAngle = Infinity;

        return;
    }

    // Zoom from a close-up down to seeing the whole tank front at once.
    const distanceFor = (fit: 'cover' | 'contain') =>
        flatPose(aspect, fit).halfHeight / halfFovTan(FLAT_FOV);

    orbit.minDistance = distanceFor('cover') * FLAT_MIN_ZOOM;
    orbit.maxDistance = distanceFor('contain') * 1.05;
    orbit.minPolarAngle = Math.PI / 2 - FLAT_ROTATION;
    orbit.maxPolarAngle = Math.PI / 2;
    orbit.minAzimuthAngle = -FLAT_ROTATION;
    orbit.maxAzimuthAngle = FLAT_ROTATION;
}

/**
 * Keep the clipping planes in step with the zoom: a near plane close enough
 * for close-ups, without losing depth precision when the camera is far off.
 */
function fitClipPlanes(camera: PerspectiveCamera, orbit: Controls): void {
    const distance = camera.position.distanceTo(orbit.target);
    const near = Math.max(0.001, distance * NEAR_PER_DISTANCE);
    const far = distance + 10 * tankScale();

    if (
        Math.abs(camera.near - near) > near * 0.05 ||
        Math.abs(camera.far - far) > far * 0.05
    ) {
        camera.near = near;
        camera.far = far;
        camera.updateProjectionMatrix();
    }
}

/** Remove all limits so a transition is never clamped mid-way. */
function unlockLimits(orbit: Controls): void {
    orbit.minDistance = 0;
    orbit.maxDistance = Infinity;
    orbit.minPolarAngle = 0;
    orbit.maxPolarAngle = Math.PI;
    orbit.minAzimuthAngle = -Infinity;
    orbit.maxAzimuthAngle = Infinity;
}

function halfFovTan(fov: number): number {
    return Math.tan(MathUtils.degToRad(fov) / 2);
}
