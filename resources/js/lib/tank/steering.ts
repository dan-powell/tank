import { Vector3 } from 'three';
import type { Habitat, SpeciesBehaviour } from '@/types';
import { bounds, layerDepth, layerToZ, TANK, VOXEL } from './space';
import type { TerrainField } from './terrain-field';
import type { CreatureBody, TankWorld } from './world';

export type SteeringProfile = {
    id: number;
    behaviour: SpeciesBehaviour;
    habitat: Habitat;
    /** Cruising speed in world units per second. */
    speed: number;
    /** 0..1 tendency to stay with others of the same species. */
    schooling: number;
    /** 0..1: how far beyond its home depth layer it roams (0 = within the layer). */
    layerRoam: number;
    layerCount: number;
    /** Centre of its home zone: x and y in world space (z comes from its home layer). */
    zoneCenter: Vector3;
    zoneRadius: number;
    hunger: number;
    health: number;
    isLit: boolean;
    lowOxygen: boolean;
};

export type WanderState = {
    /** Where the creature is heading, in world space. */
    target: Vector3;
    /** Whether a target has been chosen yet (cleared to pick a new one, e.g. after a move). */
    hasTarget: boolean;
    /** Seconds until it heads somewhere new even if it hasn't arrived. */
    retargetIn: number;
    /** Seconds left idling where it arrived. */
    lingerFor: number;
};

export function createWanderState(): WanderState {
    return {
        target: new Vector3(),
        hasTarget: false,
        retargetIn: 0,
        lingerFor: 0,
    };
}

const acceleration = new Vector3();
const scratch = new Vector3();
const heading = new Vector3();
const side = new Vector3();
const previous = new Vector3();
const probe = new Vector3();
const candidate = new Vector3();
const neighbourCentre = new Vector3();
const neighbourHeading = new Vector3();

const FOOD_SENSE_RANGE = 1.2;
const EAT_DISTANCE = 0.05;
const NEIGHBOUR_RANGE = 0.3;
const PERSONAL_SPACE = 0.08;
/** Close enough (world units) to a wander target to count as arrived. */
const ARRIVE_DISTANCE = 0.04;
/** Distance within which a creature eases off as it nears its target. */
const SLOW_DISTANCE = 0.12;
/** Share of top speed used for ordinary wandering. */
const CRUISE = 0.7;
/** How quickly (per second) velocity turns towards where it wants to go: lower is a wider, lazier curve. */
const STEER_RESPONSE = 2.5;
/** Share of top speed allowed vertically, so swimmers mostly cruise level. */
const VERTICAL_SHARE = 0.5;
/** Chance of idling a while on reaching a target. */
const LINGER_CHANCE = 0.35;
/** How far ahead (world units) a creature looks for things in its way. */
const LOOK_AHEAD = 0.08;
/** The tallest obstacle (world units) a swimmer rises over rather than going round. */
const SWIM_OVER = 0.16;
/** Clearance (world units) swimmers keep above and below decorations. */
const DECOR_CLEARANCE = 0.03;
/** The tallest step (world units) a bottom dweller walks up; taller turns it round. */
const BOTTOM_STEP = 0.05;
/** Crawlers climb anything, as long as it stays under water. */
const CRAWLER_CLIMB = 2;
/** Height a bottom dweller's body centre floats above the ground. */
const BOTTOM_LIFT = 0.035;

/**
 * Advance one creature by a frame, moving freely in 3D around its home.
 *
 * The server only knows each creature's home (a zone and a depth layer), so
 * everything here is the browser's own: the creature picks places to go
 * within a home volume (its zone in x/y and a band of depth around its home
 * layer that widens with `layerRoam`), curves towards them, idles now and
 * then, schools, chases food, gasps at the surface when oxygen is low, and
 * steers over, round or away from anything in its way. Ground dwellers do
 * the same across the ground (front to back too), following its surface.
 */
export function steer(
    body: CreatureBody,
    wander: WanderState,
    profile: SteeringProfile,
    world: TankWorld,
    delta: number,
): void {
    const { position, velocity } = body;
    const dt = Math.min(delta, 0.05);
    const isBottom = walksOnGround(profile.behaviour);
    const terrain = world.terrain;
    const maxSpeed =
        profile.speed *
        (0.35 + 0.65 * profile.health) *
        (profile.isLit ? 1 : 0.45);

    acceleration.set(0, 0, 0);

    if (!wander.hasTarget) {
        pickTarget(body, wander, profile, terrain, isBottom);
    }

    wanderTowardsTarget(body, wander, profile, terrain, dt, isBottom, maxSpeed);
    applySchooling(body, profile, world, isBottom, maxSpeed);
    seekFood(body, wander, profile, world, maxSpeed);

    if (profile.lowOxygen && !isBottom) {
        acceleration.y += (bounds.maxY - position.y) * 4 * maxSpeed;
    }

    if (terrain !== null && !isBottom) {
        avoidTerrain(body, wander, profile, terrain, maxSpeed);
    }

    avoidWalls(position, isBottom, maxSpeed);

    velocity.addScaledVector(acceleration, dt);

    if (isBottom) {
        velocity.y = 0;
    }

    velocity.clampLength(0, maxSpeed);
    velocity.y = Math.max(
        -maxSpeed * VERTICAL_SHARE,
        Math.min(maxSpeed * VERTICAL_SHARE, velocity.y),
    );

    previous.copy(position);
    position.addScaledVector(velocity, dt);

    position.x = Math.min(bounds.maxX, Math.max(bounds.minX, position.x));
    position.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, position.z));

    if (isBottom) {
        walkOnTerrain(body, wander, profile, terrain, maxSpeed, dt, isBottom);
    } else {
        position.y = Math.min(bounds.maxY, Math.max(bounds.minY, position.y));

        if (terrain !== null) {
            keepOutOfTerrain(position, terrain);
        }
    }

    if (Math.hypot(velocity.x, velocity.z) > 0.003) {
        body.yaw = Math.atan2(-velocity.z, velocity.x);
    }
}

/**
 * Choose somewhere new to go within the creature's home volume, avoiding
 * spots inside decorations when it can.
 */
function pickTarget(
    body: CreatureBody,
    wander: WanderState,
    profile: SteeringProfile,
    terrain: TerrainField | null,
    isBottom: boolean,
): void {
    const depthReach =
        layerDepth(profile.layerCount) * (0.5 + 1.5 * profile.layerRoam);
    const homeZ = layerToZ(body.homeLayer, profile.layerCount);
    const spread = () => Math.random() * 2 - 1;

    for (let attempt = 0; attempt < 8; attempt++) {
        candidate.set(
            profile.zoneCenter.x + spread() * profile.zoneRadius,
            isBottom
                ? body.position.y
                : profile.zoneCenter.y + spread() * profile.zoneRadius * 0.5,
            homeZ + spread() * depthReach,
        );
        candidate.set(
            Math.min(bounds.maxX, Math.max(bounds.minX, candidate.x)),
            Math.min(bounds.maxY, Math.max(bounds.minY, candidate.y)),
            Math.min(bounds.maxZ, Math.max(bounds.minZ, candidate.z)),
        );

        if (isBottom || terrain === null || terrain.isFree(candidate)) {
            break;
        }
    }

    wander.target.copy(candidate);
    wander.hasTarget = true;
    wander.retargetIn = 3 + Math.random() * 6;
}

/**
 * Curve towards the current target, easing off as it arrives; on arrival
 * sometimes idle a while, then pick somewhere new.
 */
function wanderTowardsTarget(
    body: CreatureBody,
    wander: WanderState,
    profile: SteeringProfile,
    terrain: TerrainField | null,
    dt: number,
    isBottom: boolean,
    maxSpeed: number,
): void {
    const { position, velocity } = body;

    if (wander.lingerFor > 0) {
        wander.lingerFor -= dt;
        acceleration.addScaledVector(velocity, -STEER_RESPONSE);

        if (wander.lingerFor <= 0) {
            pickTarget(body, wander, profile, terrain, isBottom);
        }

        return;
    }

    const toTarget = scratch.subVectors(wander.target, position);

    if (isBottom) {
        toTarget.y = 0;
    }

    const distance = toTarget.length();
    wander.retargetIn -= dt;

    if (distance < ARRIVE_DISTANCE || wander.retargetIn <= 0) {
        if (distance < ARRIVE_DISTANCE && Math.random() < LINGER_CHANCE) {
            wander.lingerFor = 1 + Math.random() * 2.5;
        }

        pickTarget(body, wander, profile, terrain, isBottom);

        return;
    }

    const desiredSpeed =
        maxSpeed * CRUISE * Math.min(1, distance / SLOW_DISTANCE);
    toTarget.multiplyScalar(desiredSpeed / distance).sub(velocity);
    acceleration.addScaledVector(toTarget, STEER_RESPONSE);
}

function applySchooling(
    body: CreatureBody,
    profile: SteeringProfile,
    world: TankWorld,
    isBottom: boolean,
    maxSpeed: number,
): void {
    neighbourCentre.set(0, 0, 0);
    neighbourHeading.set(0, 0, 0);
    let schoolmates = 0;

    for (const [id, other] of world.creatures) {
        if (id === profile.id) {
            continue;
        }

        const distance = other.position.distanceTo(body.position);

        if (distance > NEIGHBOUR_RANGE) {
            continue;
        }

        if (distance < PERSONAL_SPACE && distance > 0) {
            scratch.subVectors(body.position, other.position);

            if (isBottom) {
                scratch.y = 0;
            }

            if (scratch.lengthSq() > 0) {
                acceleration.addScaledVector(
                    scratch.normalize(),
                    (PERSONAL_SPACE - distance) * 30 * maxSpeed,
                );
            }
        }

        if (profile.schooling > 0 && other.speciesId === body.speciesId) {
            neighbourCentre.add(other.position);
            neighbourHeading.add(other.velocity);
            schoolmates++;
        }
    }

    if (schoolmates > 0) {
        neighbourCentre.divideScalar(schoolmates).sub(body.position);
        neighbourHeading.divideScalar(schoolmates);

        if (isBottom) {
            neighbourCentre.y = 0;
            neighbourHeading.y = 0;
        }

        acceleration.addScaledVector(
            neighbourCentre,
            profile.schooling * 2 * maxSpeed,
        );
        acceleration.addScaledVector(neighbourHeading, profile.schooling);
    }
}

/** Chase the nearest food in reach, straight to it in 3D, and eat it on arrival. */
function seekFood(
    body: CreatureBody,
    wander: WanderState,
    profile: SteeringProfile,
    world: TankWorld,
    maxSpeed: number,
): void {
    if (
        profile.hunger < 0.15 ||
        (profile.behaviour !== 'swimmer' &&
            profile.behaviour !== 'bottom_dweller')
    ) {
        return;
    }

    const food = world.nearestFood(
        body.position,
        FOOD_SENSE_RANGE,
        profile.behaviour === 'bottom_dweller',
    );

    if (food === null) {
        return;
    }

    const toFood = scratch.subVectors(food.position, body.position);

    if (toFood.length() < EAT_DISTANCE) {
        world.eat(food);

        return;
    }

    // Afterwards, potter about where the food was.
    wander.target.copy(food.position);
    wander.retargetIn = Math.max(wander.retargetIn, 2);
    wander.lingerFor = 0;

    if (walksOnGround(profile.behaviour)) {
        toFood.y = 0;
    }

    acceleration.addScaledVector(toFood.normalize(), 6 * maxSpeed);
}

/**
 * Steer a swimmer round decorations: rise over an obstacle ahead when it is
 * low enough, otherwise slip round whichever side is open (preferring the
 * side its target is on), or turn away and head somewhere else. Keeps a
 * little clearance above and below so fish don't scrape along rocks.
 */
function avoidTerrain(
    body: CreatureBody,
    wander: WanderState,
    profile: SteeringProfile,
    terrain: TerrainField,
    maxSpeed: number,
): void {
    const { position, velocity } = body;

    heading.set(velocity.x, 0, velocity.z);

    if (heading.lengthSq() < 1e-6) {
        heading.subVectors(wander.target, position).setY(0);
    }

    if (heading.lengthSq() > 1e-8) {
        heading.normalize();
        probe.copy(position).addScaledVector(heading, LOOK_AHEAD);

        if (!terrain.isFree(probe)) {
            steerRound(body, wander, profile, terrain, maxSpeed);
        }
    }

    probe.set(position.x, position.y - DECOR_CLEARANCE, position.z);

    if (terrain.isSolid(probe)) {
        acceleration.y += 4 * maxSpeed;
    }

    probe.set(position.x, position.y + DECOR_CLEARANCE, position.z);

    if (terrain.isSolid(probe)) {
        acceleration.y -= 4 * maxSpeed;
    }
}

/** Something is in the way along `heading`: go over, round, or back. */
function steerRound(
    body: CreatureBody,
    wander: WanderState,
    profile: SteeringProfile,
    terrain: TerrainField,
    maxSpeed: number,
): void {
    const { position, velocity } = body;
    const startY = probe.y;

    for (let rise = VOXEL; rise <= SWIM_OVER; rise += VOXEL * 2) {
        probe.y = startY + rise;

        if (probe.y > bounds.maxY) {
            break;
        }

        if (terrain.isFree(probe)) {
            acceleration.y += 8 * maxSpeed;
            acceleration.addScaledVector(heading, -0.6 * maxSpeed);

            return;
        }
    }

    // Perpendicular to the heading, on the side of the target first.
    side.set(-heading.z, 0, heading.x);
    scratch.subVectors(wander.target, position);
    const preferred = side.dot(scratch) >= 0 ? 1 : -1;

    for (const sign of [preferred, -preferred]) {
        probe.copy(position).addScaledVector(side, sign * LOOK_AHEAD);

        if (terrain.isFree(probe)) {
            acceleration.addScaledVector(side, sign * 6 * maxSpeed);
            acceleration.addScaledVector(heading, -2 * maxSpeed);

            return;
        }
    }

    velocity.multiplyScalar(-0.3);
    pickTarget(body, wander, profile, terrain, false);
}

/**
 * Undo whichever part of this frame's move took a swimmer into a decoration
 * (or out of the water). Anything still stuck, e.g. because a decoration was
 * dropped on top of it, is lifted to the nearest open water.
 */
function keepOutOfTerrain(position: Vector3, terrain: TerrainField): void {
    if (terrain.isFree(position)) {
        return;
    }

    const attempts: [number, number, number][] = [
        [position.x, position.y, previous.z],
        [previous.x, position.y, position.z],
        [position.x, previous.y, position.z],
        [previous.x, previous.y, previous.z],
    ];

    for (const [x, y, z] of attempts) {
        probe.set(x, y, z);

        if (terrain.isFree(probe)) {
            position.copy(probe);

            return;
        }
    }

    terrain.moveToFreeCell(position);
}

/** Behaviours that walk on surfaces rather than swim. */
export function walksOnGround(behaviour: SpeciesBehaviour): boolean {
    return (
        behaviour === 'bottom_dweller' ||
        behaviour === 'crawler' ||
        behaviour === 'walker' ||
        behaviour === 'amphibian'
    );
}

/** Behaviours drawn standing on their base rather than centred on their body. */
export function standsOnBase(behaviour: SpeciesBehaviour): boolean {
    return (
        behaviour === 'crawler' ||
        behaviour === 'walker' ||
        behaviour === 'amphibian'
    );
}

/**
 * Keep a bottom dweller on whatever is beneath it: the substrate or the top
 * of a decoration. Crawlers and walkers climb anything, clinging to the face
 * as they go; other bottom dwellers only take small steps and head elsewhere
 * at anything taller. Water animals keep below the waterline, land animals
 * above it (hauling out if they find themselves under water), and
 * amphibians go where they please.
 */
function walkOnTerrain(
    body: CreatureBody,
    wander: WanderState,
    profile: SteeringProfile,
    terrain: TerrainField | null,
    maxSpeed: number,
    dt: number,
    isBottom: boolean,
): void {
    const { position, velocity } = body;
    const isCrawler = profile.behaviour !== 'bottom_dweller';
    const lift = standsOnBase(profile.behaviour) ? 0 : BOTTOM_LIFT;

    if (terrain === null) {
        position.y = TANK.substrate + lift;

        return;
    }

    const foot = Math.max(0, previous.y - lift) + 0.001;
    const ground = (x: number, z: number) =>
        terrain.surfaceBelow(
            probe.set(x, foot, z),
            isCrawler ? CRAWLER_CLIMB : BOTTOM_STEP,
        );
    const waterLine = terrain.waterLevel * VOXEL - 0.01;
    const allowed = (height: number) =>
        profile.habitat === 'terrestrial'
            ? height >= waterLine
            : profile.habitat === 'amphibious' || height < waterLine;

    if (profile.habitat === 'terrestrial') {
        const here = ground(previous.x, previous.z);

        if (
            here !== null &&
            !allowed(here) &&
            terrain.moveToLandNear(position)
        ) {
            previous.copy(position);

            return;
        }
    }

    let surface = ground(position.x, position.z);

    if (surface === null || !allowed(surface)) {
        // Blocked: stay put and head somewhere else.
        position.x = previous.x;
        position.z = previous.z;
        velocity.multiplyScalar(-0.3);
        pickTarget(body, wander, profile, terrain, isBottom);
        surface = ground(position.x, position.z) ?? foot;
    }

    const target = surface + lift;
    const climb = target - previous.y;

    if (climb > 0.01) {
        // Climb the face before stepping onto the higher ground.
        position.x = previous.x;
        position.z = previous.z;
    }

    const rate =
        (profile.behaviour === 'crawler'
            ? maxSpeed * 1.5
            : isCrawler
              ? maxSpeed * 3
              : 0.6) * dt;
    position.y =
        climb > 0
            ? Math.min(target, previous.y + rate)
            : Math.max(target, previous.y - Math.max(rate, 0.3 * dt));
}

/** Push away from the glass on every side (swimmers also from the floor and surface limits). */
function avoidWalls(
    position: Vector3,
    isBottom: boolean,
    maxSpeed: number,
): void {
    const push = (distance: number) =>
        distance < 0.1 ? (0.1 - distance) * 40 * maxSpeed : 0;

    acceleration.x +=
        push(position.x - bounds.minX) - push(bounds.maxX - position.x);
    acceleration.z +=
        push(position.z - bounds.minZ) - push(bounds.maxZ - position.z);

    if (!isBottom) {
        acceleration.y +=
            push(position.y - bounds.minY) - push(bounds.maxY - position.y);
    }
}
