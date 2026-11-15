import type { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { ComponentRef, RefObject } from 'react';
import { Box3, MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import type { Object3D, Quaternion } from 'three';
import { flyBounds, flyStateFrom, stepFly } from '@/lib/tank/fly';
import type { FlyState } from '@/lib/tank/fly';
import { sightThroughTank, TANK } from '@/lib/tank/space';
import { TANK_VIEWS, viewAngles } from '@/lib/tank/views';
import type { TankView } from '@/lib/tank/views';
import { useFlyInput } from './tank-fly-controls';

/**
 * `orbit`: free 3D view around a pivot. `flat`: near-orthographic 2D-style
 * view from one side. `fly`: first-person, moved with the keyboard.
 */
export type TankViewMode = 'orbit' | 'flat' | 'fly';

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

/** Clipping planes while flying, when there is no pivot: near enough to brush past a fish. */
const FLY_NEAR = 0.003;

/** The far clipping plane while flying, in tank scales. */
const FLY_FAR = 12;

/** How much bigger than the followed entity (its bounding box diagonal) the view is, in visible heights. */
const FOLLOW_FRAMING = 2.4;

/** How quickly the view catches up with a moving followed entity (per second). */
const FOLLOW_RATE = 4;

/** Seconds without rotating or zooming before the 3D view starts circling a followed entity again. */
const FOLLOW_IDLE_SECONDS = 5;

/** OrbitControls' auto-rotate speed while following: a full circle in about a minute and a half. */
const FOLLOW_ROTATE_SPEED = 0.65;

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

/** `follows`: the move zooms in on the followed entity, so its target tracks it as it goes. */
type Transition = { from: Pose; to: Pose; progress: number; follows?: boolean };

type Props = {
    mode: TankViewMode;
    /** The side the flat view looks from. */
    flatView: TankView;
    /** The latest view cube click; a new `id` swings the camera round, fitted to the tank. */
    viewRequest: TankViewRequest | null;
    /** Kept in step with the camera's orientation every frame, for the view cube. */
    orientation: Quaternion;
    /** The name of the mesh to follow (see followTargetName), or null. */
    follow: string | null;
    /** The followed entity has gone (e.g. was removed), so following has ended. */
    onFollowLost: () => void;
    controls: RefObject<Controls | null>;
};

/**
 * Moves the camera between the orbit, flat and fly views, and to views
 * picked on the view cube, animating each move and applying each mode's
 * rotation and zoom limits. Orbit and flat each keep their own last view, so
 * switching back restores them; leaving fly for orbit carries on from where
 * the camera flew to. While flying it steers the camera from the keyboard
 * and mouse. While following an entity it zooms in on it and keeps it in
 * the middle of the view, and in 3D slowly circles it whenever the user
 * hasn't rotated or zoomed for a few seconds.
 */
export function TankCameraRig({
    mode,
    flatView,
    viewRequest,
    orientation,
    follow,
    onFollowLost,
    controls,
}: Props) {
    const camera = useThree((state) => state.camera);
    const element = useThree((state) => state.gl.domElement);
    const flyInput = useFlyInput(element, mode === 'fly');
    const flyState = useRef<FlyState | null>(null);
    const [bounds] = useState(flyBounds);
    const aspect = useThree((state) => state.size.width / state.size.height);
    const transition = useRef<Transition | null>(null);
    const savedOrbit = useRef<Pose | null>(null);
    const savedFlat = useRef<Pose | null>(null);
    const appliedMode = useRef<TankViewMode | null>(null);
    const handledRequest = useRef(viewRequest?.id ?? null);
    const flatViewRef = useRef(flatView);
    const scene = useThree((state) => state.scene);
    const followed = useRef<Object3D | null>(null);
    const followBox = useRef(new Box3());
    const followCentre = useRef(new Vector3());
    const lastManipulation = useRef(-Infinity);
    /** While following in 2D, how close the zoom may come (closer than the usual limit). */
    const flatFollowMin = useRef<number | null>(null);
    const onFollowLostRef = useRef(onFollowLost);
    /** Set once the loss of the followed entity has been reported, so it's reported once. */
    const hasLostFollowed = useRef(false);

    useEffect(() => {
        onFollowLostRef.current = onFollowLost;
    }, [onFollowLost]);

    /** The followed mesh's centre and size (bounding box diagonal) now, or null if it's gone. */
    const locateFollowed = (): { centre: Vector3; size: number } | null => {
        if (follow === null) {
            return null;
        }

        let object = followed.current;

        if (object === null || object.name !== follow || !isInScene(object)) {
            object = scene.getObjectByName(follow) ?? null;
            followed.current = object;
        }

        if (object === null) {
            return null;
        }

        object.updateWorldMatrix(true, false);
        const box = followBox.current.setFromObject(object);

        return {
            centre: box.getCenter(followCentre.current),
            size: Math.max(box.getSize(new Vector3()).length(), 0.01),
        };
    };

    // Rotating or zooming counts as handling the view, which pauses circling a followed entity.
    useEffect(() => {
        const orbit = controls.current;

        if (orbit === null) {
            return;
        }

        const onManipulate = () => {
            lastManipulation.current = performance.now();
        };

        orbit.addEventListener('start', onManipulate);
        orbit.addEventListener('end', onManipulate);

        return () => {
            orbit.removeEventListener('start', onManipulate);
            orbit.removeEventListener('end', onManipulate);
        };
    }, [controls]);

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

            if (mode === 'fly') {
                orbit.enabled = false;
                bounds.clampPoint(camera.position, camera.position);
            }

            applyLimits(orbit, mode, aspect, flatView);

            return;
        }

        if (appliedMode.current === mode && transition.current === null) {
            applyLimits(orbit, mode, aspect, flatView, flatFollowMin.current);

            return;
        }

        if (appliedMode.current === mode) {
            return;
        }

        const previous = appliedMode.current;
        appliedMode.current = mode;
        flyState.current = null;
        flatFollowMin.current = null;

        // The orbit target is left behind while flying: put it ahead, inside the tank.
        if (previous === 'fly' && transition.current === null) {
            orbit.target.copy(pivotAhead(camera));
        }

        const now = currentPose(camera, orbit);
        // Mid-way through a move, the view being left is where that move was heading.
        const leaving = transition.current?.to ?? now;

        if (previous === 'orbit') {
            savedOrbit.current = leaving;
        } else if (previous === 'flat') {
            savedFlat.current = leaving;
        }

        let to: Pose;

        if (mode === 'flat') {
            to =
                savedFlat.current ??
                fitPose(flatView, aspect, FLAT_FOV, 'cover');
        } else if (mode === 'orbit') {
            to =
                previous === 'fly'
                    ? {
                          ...leaving,
                          polar: Math.min(leaving.polar, Math.PI / 2),
                      }
                    : (savedOrbit.current ?? orbitStartPose());
        } else {
            to = withinBounds(
                previous === 'flat'
                    ? fitPose(flatView, aspect, ORBIT_FOV, 'contain')
                    : leaving,
                bounds,
            );
        }

        startTransition(transition, orbit, now, to);
    }, [mode, flatView, aspect, camera, controls, bounds]);

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
        flatFollowMin.current = null;

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

    // Start following (or carry on after switching between 2D and 3D): zoom in on the entity.
    useEffect(() => {
        const orbit = controls.current;

        if (orbit === null || !(camera instanceof PerspectiveCamera)) {
            return;
        }

        orbit.autoRotate = false;
        hasLostFollowed.current = false;

        if (follow === null || appliedMode.current === 'fly') {
            return;
        }

        const target = locateFollowed();

        if (target === null) {
            hasLostFollowed.current = true;
            onFollowLostRef.current();

            return;
        }

        const isFlat = appliedMode.current === 'flat';
        const fov = isFlat ? FLAT_FOV : ORBIT_FOV;
        const heading = isFlat
            ? viewAngles(flatViewRef.current)
            : (transition.current?.to ?? currentPose(camera, orbit));
        const halfHeight = Math.max(
            (target.size * FOLLOW_FRAMING) / 2,
            isFlat ? 0 : ORBIT_MIN_DISTANCE * tankScale() * halfFovTan(fov),
        );

        if (isFlat) {
            flatFollowMin.current = (halfHeight / halfFovTan(fov)) * 0.5;
        }

        lastManipulation.current = -Infinity;
        startTransition(
            transition,
            orbit,
            currentPose(camera, orbit),
            {
                target: target.centre.clone(),
                azimuth: heading.azimuth,
                polar: heading.polar,
                halfHeight,
                fov,
            },
            true,
        );
        // `mode` re-runs this after the mode effect has started its own move.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [follow, mode, camera, controls]);

    useFrame((_, delta) => {
        const active = transition.current;
        const orbit = controls.current;

        if (orbit === null || !(camera instanceof PerspectiveCamera)) {
            orientation.copy(camera.quaternion);

            return;
        }

        const target =
            follow !== null && appliedMode.current !== 'fly'
                ? locateFollowed()
                : null;

        if (
            follow !== null &&
            appliedMode.current !== 'fly' &&
            target === null &&
            !hasLostFollowed.current
        ) {
            hasLostFollowed.current = true;
            orbit.autoRotate = false;
            onFollowLostRef.current();
        }

        if (active !== null) {
            if (active.follows && target !== null) {
                active.to.target.copy(target.centre);
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
                    flatFollowMin.current,
                );
                orbit.enabled = appliedMode.current !== 'fly';
            }
        } else if (target !== null) {
            // Ease the pivot (and camera with it) after the entity, so the view keeps its angle and zoom.
            const shift = target.centre
                .clone()
                .sub(orbit.target)
                .multiplyScalar(
                    1 - Math.exp(-FOLLOW_RATE * Math.min(delta, 0.1)),
                );

            orbit.target.add(shift);
            camera.position.add(shift);
            orbit.autoRotate =
                appliedMode.current === 'orbit' &&
                performance.now() - lastManipulation.current >
                    FOLLOW_IDLE_SECONDS * 1000;
            orbit.autoRotateSpeed = FOLLOW_ROTATE_SPEED;
        } else if (appliedMode.current === 'fly') {
            if (flyState.current === null) {
                // Start from where the camera is looking, ignoring mouse movement during the move in.
                flyState.current = flyStateFrom(camera);
                flyInput.current.lookX = 0;
                flyInput.current.lookY = 0;
            }

            stepFly(camera, flyState.current, flyInput.current, bounds, delta);
        }

        fitClipPlanes(
            camera,
            appliedMode.current === 'fly' && transition.current === null
                ? null
                : camera.position.distanceTo(orbit.target),
        );
        orientation.copy(camera.quaternion);
    });

    return null;
}

/** Animate from `from` to `to`, with the controls off and unclamped meanwhile. */
function startTransition(
    transition: RefObject<Transition | null>,
    orbit: Controls,
    from: Pose,
    to: Pose,
    follows = false,
): void {
    transition.current = { from, to, progress: 0, follows };
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
    flatFollowMin: number | null = null,
): void {
    if (mode === 'fly') {
        unlockLimits(orbit);

        return;
    }

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

    orbit.minDistance = Math.min(
        distanceFor('cover') * 0.5,
        flatFollowMin ?? Infinity,
    );
    orbit.maxDistance = distanceFor('contain') * 1.05;
    orbit.minPolarAngle = Math.max(0, polar - FLAT_ROTATION);
    orbit.maxPolarAngle = Math.min(Math.PI / 2, polar + FLAT_ROTATION);
    orbit.minAzimuthAngle = azimuth - FLAT_ROTATION;
    orbit.maxAzimuthAngle = azimuth + FLAT_ROTATION;
}

/**
 * Keep the clipping planes in step with the zoom: a near plane close enough
 * for close-ups, without losing depth precision when the camera is far off.
 * `distance` is how far the camera is from its pivot, or null while flying.
 */
function fitClipPlanes(
    camera: PerspectiveCamera,
    distance: number | null,
): void {
    const near =
        distance === null
            ? FLY_NEAR
            : Math.max(0.001, distance * NEAR_PER_DISTANCE);
    const far =
        distance === null ? FLY_FAR * tankScale() : distance + 10 * tankScale();

    if (
        Math.abs(camera.near - near) > near * 0.05 ||
        Math.abs(camera.far - far) > far * 0.05
    ) {
        camera.near = near;
        camera.far = far;
        camera.updateProjectionMatrix();
    }
}

/**
 * A pivot along the camera's line of sight: the middle of its path through
 * the tank, within the orbit zoom limits, or a tank scale ahead if it misses.
 */
function pivotAhead(camera: PerspectiveCamera): Vector3 {
    const direction = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const sight = sightThroughTank(camera.position, direction);
    const distance =
        sight === null
            ? tankScale()
            : MathUtils.clamp(
                  (sight.enter + sight.exit) / 2,
                  ORBIT_MIN_DISTANCE * tankScale(),
                  ORBIT_MAX_DISTANCE * tankScale(),
              );

    return camera.position.clone().addScaledVector(direction, distance);
}

/** `pose`, brought closer to its target as needed so the camera is inside the fly bounds. */
function withinBounds(pose: Pose, bounds: Box3): Pose {
    const position = new Vector3();
    let halfHeight = pose.halfHeight;

    for (let step = 0; step < 40; step++) {
        position
            .setFromSpherical(
                new Spherical(
                    halfHeight / halfFovTan(pose.fov),
                    Math.max(MIN_POLAR, pose.polar),
                    pose.azimuth,
                ),
            )
            .add(pose.target);

        if (bounds.containsPoint(position)) {
            break;
        }

        halfHeight *= 0.9;
    }

    return { ...pose, halfHeight };
}

/** Whether `object` is still part of a scene (not removed, nor inside something removed). */
function isInScene(object: Object3D): boolean {
    let current: Object3D | null = object;

    while (current.parent !== null) {
        current = current.parent;
    }

    return current.type === 'Scene';
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
