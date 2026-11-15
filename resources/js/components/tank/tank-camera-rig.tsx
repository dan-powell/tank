import type { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { ComponentRef, RefObject } from 'react';
import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import type { Quaternion } from 'three';
import { TANK } from '@/lib/tank/space';
import { TANK_VIEWS, viewAngles } from '@/lib/tank/views';
import type { TankView } from '@/lib/tank/views';

/** `orbit`: free 3D view. `flat`: near-orthographic 2D-style view from one side. */
export type TankViewMode = 'orbit' | 'flat';

/** A request (from the view cube) to swing the camera round to look from `view`. */
export type TankViewRequest = { view: TankView; id: number };

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
        fov: ORBIT_FOV,
    };
}

/** Field of view in the 3D view. */
const ORBIT_FOV = 75;

/** Field of view in flat mode: narrow enough to all but remove perspective. */
const FLAT_FOV = 1;

/** Room (world units) left around the tank when fitting it to the view, per side. */
const FIT_PADDING = { x: 0.05, y: 0.04, z: 0.05 };

/** Extra room when a view cube click fits the whole tank in, so it isn't hard against the edges. */
const CONTAIN_MARGIN = 1.1;

/** How far (radians) the flat view may be turned or tilted away from its side. */
const FLAT_ROTATION = 0.12;

/** Never quite straight down: looking exactly along the up axis loses the azimuth. */
const MIN_POLAR = 1e-4;

const TRANSITION_SECONDS = 0.8;

/** Closest the 3D view may come to its pivot, in tank scales (close enough to see single voxels). */
const ORBIT_MIN_DISTANCE = 0.2;

/** Furthest the 3D view may pull back from its pivot, in tank scales. */
const ORBIT_MAX_DISTANCE = 4.5;

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
    /** The side the flat view looks from. */
    flatView: TankView;
    /** The latest view cube click; a new `id` swings the camera round, fitted to the tank. */
    viewRequest: TankViewRequest | null;
    /** Kept in step with the camera's orientation every frame, for the view cube. */
    orientation: Quaternion;
    controls: RefObject<Controls | null>;
};

/**
 * Moves the camera between the free orbit view and the flat view, and to
 * views picked on the view cube, animating each move and applying each
 * mode's rotation and zoom limits. Each mode keeps its own last view, so
 * switching back restores it.
 */
export function TankCameraRig({
    mode,
    flatView,
    viewRequest,
    orientation,
    controls,
}: Props) {
    const camera = useThree((state) => state.camera);
    const aspect = useThree((state) => state.size.width / state.size.height);
    const transition = useRef<Transition | null>(null);
    const savedOrbit = useRef<Pose | null>(null);
    const savedFlat = useRef<Pose | null>(null);
    const appliedMode = useRef<TankViewMode | null>(null);
    const handledRequest = useRef(viewRequest?.id ?? null);
    const flatViewRef = useRef(flatView);

    useEffect(() => {
        flatViewRef.current = flatView;
    }, [flatView]);

    useEffect(() => {
        const orbit = controls.current;

        if (orbit === null || !(camera instanceof PerspectiveCamera)) {
            return;
        }

        // First run: jump straight to the starting mode, no animation.
        if (appliedMode.current === null) {
            appliedMode.current = mode;

            if (mode === 'flat') {
                applyPose(
                    camera,
                    orbit,
                    fitPose(flatView, aspect, FLAT_FOV, 'cover'),
                );
            }

            applyLimits(orbit, mode, aspect, flatView);

            return;
        }

        if (appliedMode.current === mode && transition.current === null) {
            applyLimits(orbit, mode, aspect, flatView);

            return;
        }

        if (appliedMode.current === mode) {
            return;
        }

        appliedMode.current = mode;
        // Mid-way through a move, the view being left is where that move was heading.
        const leaving = transition.current?.to ?? currentPose(camera, orbit);

        if (mode === 'flat') {
            savedOrbit.current = leaving;
        } else {
            savedFlat.current = leaving;
        }

        startTransition(
            transition,
            orbit,
            currentPose(camera, orbit),
            mode === 'flat'
                ? (savedFlat.current ??
                      fitPose(flatView, aspect, FLAT_FOV, 'cover'))
                : (savedOrbit.current ?? orbitStartPose()),
        );
    }, [mode, flatView, aspect, camera, controls]);

    useEffect(() => {
        const orbit = controls.current;

        if (
            viewRequest === null ||
            viewRequest.id === handledRequest.current ||
            orbit === null ||
            !(camera instanceof PerspectiveCamera)
        ) {
            return;
        }

        handledRequest.current = viewRequest.id;

        startTransition(
            transition,
            orbit,
            currentPose(camera, orbit),
            fitPose(
                viewRequest.view,
                camera.aspect,
                appliedMode.current === 'flat' ? FLAT_FOV : ORBIT_FOV,
                'contain',
            ),
        );
    }, [viewRequest, camera, controls]);

    useFrame((_, delta) => {
        const active = transition.current;
        const orbit = controls.current;

        orientation.copy(camera.quaternion);

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
            applyLimits(
                orbit,
                appliedMode.current ?? 'orbit',
                camera.aspect,
                flatViewRef.current,
            );
            orbit.enabled = true;
        }
    });

    return null;
}

/** Animate from `from` to `to`, with the controls off and unclamped meanwhile. */
function startTransition(
    transition: RefObject<Transition | null>,
    orbit: Controls,
    from: Pose,
    to: Pose,
): void {
    transition.current = { from, to, progress: 0 };
    unlockLimits(orbit);
    orbit.enabled = false;
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
 * Looking at the middle of the tank from `view`, zoomed so the whole tank
 * either fits inside the view (`contain`, with a little room around it) or
 * fills it and is cropped on the longer side (`cover`), as in CSS object-fit.
 * Exact for perspective: corners nearer the camera are allowed for.
 */
function fitPose(
    view: TankView,
    aspect: number,
    fov: number,
    fit: 'cover' | 'contain',
): Pose {
    const { azimuth, polar } = viewAngles(view);
    const target = new Vector3(0, TANK.height / 2, 0);
    const towardsCamera = new Vector3(...TANK_VIEWS[view]).normalize();
    // Built from the azimuth so it stays defined looking straight down.
    const right = new Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
    const up = towardsCamera.clone().cross(right);
    const tan = halfFovTan(fov);
    const halfWidthTan = tan * Math.max(aspect, 0.1);
    const half = new Vector3(
        TANK.width / 2 + FIT_PADDING.x,
        TANK.height / 2 + FIT_PADDING.y,
        TANK.depth / 2 + FIT_PADDING.z,
    );
    const corner = new Vector3();
    let distanceForHeight = 0;
    let distanceForWidth = 0;

    for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
            for (const sz of [-1, 1]) {
                corner.set(sx * half.x, sy * half.y, sz * half.z);
                const nearer = corner.dot(towardsCamera);

                distanceForHeight = Math.max(
                    distanceForHeight,
                    Math.abs(corner.dot(up)) / tan + nearer,
                );
                distanceForWidth = Math.max(
                    distanceForWidth,
                    Math.abs(corner.dot(right)) / halfWidthTan + nearer,
                );
            }
        }
    }

    const distance =
        fit === 'cover'
            ? Math.min(distanceForHeight, distanceForWidth)
            : Math.max(distanceForHeight, distanceForWidth) * CONTAIN_MARGIN;

    return {
        target,
        azimuth,
        polar,
        halfHeight: distance * tan,
        fov,
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
    return {
        target: from.target.clone().lerp(to.target, amount),
        azimuth: from.azimuth + shortestTurn(from.azimuth, to.azimuth) * amount,
        polar: MathUtils.lerp(from.polar, to.polar, amount),
        halfHeight: MathUtils.lerp(from.halfHeight, to.halfHeight, amount),
        fov: MathUtils.lerp(from.fov, to.fov, amount),
    };
}

/** The signed angle (within ±π) to turn from one azimuth to another. */
function shortestTurn(from: number, to: number): number {
    let turn = (to - from) % (Math.PI * 2);

    if (turn > Math.PI) {
        turn -= Math.PI * 2;
    } else if (turn < -Math.PI) {
        turn += Math.PI * 2;
    }

    return turn;
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
        .setFromSpherical(
            new Spherical(
                radius,
                Math.max(MIN_POLAR, pose.polar),
                pose.azimuth,
            ),
        )
        .add(pose.target);
    orbit.target.copy(pose.target);
    orbit.update();
}

function applyLimits(
    orbit: Controls,
    mode: TankViewMode,
    aspect: number,
    flatView: TankView,
): void {
    if (mode === 'orbit') {
        orbit.minDistance = ORBIT_MIN_DISTANCE * tankScale();
        orbit.maxDistance = ORBIT_MAX_DISTANCE * tankScale();
        orbit.minPolarAngle = 0;
        orbit.maxPolarAngle = Math.PI / 2;
        orbit.minAzimuthAngle = -Infinity;
        orbit.maxAzimuthAngle = Infinity;

        return;
    }

    // Zoom from a close-up out to a little beyond seeing the whole tank,
    // and turn or tilt only slightly away from the chosen side.
    const distanceFor = (fit: 'cover' | 'contain') =>
        fitPose(flatView, aspect, FLAT_FOV, fit).halfHeight /
        halfFovTan(FLAT_FOV);
    const { azimuth, polar } = viewAngles(flatView);

    orbit.minDistance = distanceFor('cover') * 0.5;
    orbit.maxDistance = distanceFor('contain') * 1.05;
    orbit.minPolarAngle = Math.max(0, polar - FLAT_ROTATION);
    orbit.maxPolarAngle = Math.min(Math.PI / 2, polar + FLAT_ROTATION);
    orbit.minAzimuthAngle = azimuth - FLAT_ROTATION;
    orbit.maxAzimuthAngle = azimuth + FLAT_ROTATION;
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
