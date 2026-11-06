import { Vector3 } from 'three';
import type { SpeciesBehaviour } from '@/types';
import { bounds, layerDepth, layerToZ, TANK, zToLayer } from './space';
import type { CreatureBody, TankWorld } from './world';

export type SteeringProfile = {
    id: number;
    behaviour: SpeciesBehaviour;
    /** Cruising speed in world units per second. */
    speed: number;
    /** 0..1 tendency to stay with others of the same species. */
    schooling: number;
    /** 0..1 tendency to wander into a neighbouring depth layer. */
    layerRoam: number;
    layerCount: number;
    /** Preferred x/y within the layer (world space; z is ignored). */
    zoneCenter: Vector3;
    zoneRadius: number;
    hunger: number;
    health: number;
    isLit: boolean;
    lowOxygen: boolean;
};

export type WanderState = {
    /** Direction of travel along x. */
    direction: 1 | -1;
    /** Seconds until the creature next turns around of its own accord. */
    turnIn: number;
    /** Gentle up/down drift angle. */
    pitch: number;
    /** Seconds left visiting another layer before heading home. */
    awayFor: number;
};

export function createWanderState(): WanderState {
    return {
        direction: Math.random() < 0.5 ? 1 : -1,
        turnIn: 2 + Math.random() * 8,
        pitch: 0,
        awayFor: 0,
    };
}

const acceleration = new Vector3();
const scratch = new Vector3();
const neighbourCentre = new Vector3();
const neighbourHeading = new Vector3();

const FOOD_SENSE_RANGE = 1.2;
const EAT_DISTANCE = 0.05;
const NEIGHBOUR_RANGE = 0.3;
const PERSONAL_SPACE = 0.08;
/** Distance from a side wall at which a swimmer turns around. */
const TURN_DISTANCE = 0.12;
/** Chance per second (scaled by layer_roam) of visiting a neighbouring layer. */
const ROAM_RATE = 0.15;

/**
 * Advance one creature by a frame. Movement happens mostly in the x/y plane
 * of its depth layer: it swims back and forth along x, turning at walls and
 * the edge of its zone, with schooling, food seeking and surface gasping.
 * Depth (z) eases towards its current layer, which occasionally changes to a
 * neighbouring one, or to wherever food is sinking, before returning home.
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
    const isBottom =
        profile.behaviour === 'bottom_dweller' ||
        profile.behaviour === 'crawler';
    const maxSpeed =
        profile.speed *
        (0.35 + 0.65 * profile.health) *
        (profile.isLit ? 1 : 0.45);

    acceleration.set(0, 0, 0);

    wanderAlongLayer(body, wander, profile, dt, isBottom, maxSpeed);
    roamLayers(body, wander, profile, dt);
    applySchooling(body, profile, world, maxSpeed);

    const foodZ = seekFood(body, wander, profile, world, maxSpeed);

    if (profile.lowOxygen && !isBottom) {
        acceleration.y += (bounds.maxY - position.y) * 4 * maxSpeed;
    }

    avoidWalls(position, maxSpeed);

    velocity.x += acceleration.x * dt;
    velocity.y = isBottom ? 0 : velocity.y + acceleration.y * dt;
    scratch.set(velocity.x, velocity.y, 0).clampLength(0, maxSpeed);
    velocity.x = scratch.x;
    velocity.y = scratch.y;

    const targetZ = foodZ ?? layerToZ(body.layer, profile.layerCount);
    velocity.z = Math.max(
        -maxSpeed * 0.6,
        Math.min(maxSpeed * 0.6, (targetZ - position.z) * 1.5),
    );

    position.addScaledVector(velocity, dt);

    position.x = Math.min(bounds.maxX, Math.max(bounds.minX, position.x));
    position.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, position.z));
    position.y = isBottom
        ? TANK.substrate + (profile.behaviour === 'crawler' ? 0 : 0.035)
        : Math.min(bounds.maxY, Math.max(bounds.minY, position.y));

    if (velocity.x > 0.005) {
        body.facing = 1;
    } else if (velocity.x < -0.005) {
        body.facing = -1;
    }
}

/**
 * Swim back and forth along x: keep going one way, turning around at the
 * side walls, beyond the zone edge, or now and then on a whim.
 */
function wanderAlongLayer(
    body: CreatureBody,
    wander: WanderState,
    profile: SteeringProfile,
    dt: number,
    isBottom: boolean,
    maxSpeed: number,
): void {
    const { position } = body;
    const toZoneX = profile.zoneCenter.x - position.x;

    wander.turnIn -= dt;

    const nearWall =
        (wander.direction > 0 && bounds.maxX - position.x < TURN_DISTANCE) ||
        (wander.direction < 0 && position.x - bounds.minX < TURN_DISTANCE);
    const leavingZone =
        Math.abs(toZoneX) > profile.zoneRadius &&
        Math.sign(toZoneX) !== wander.direction;

    if (nearWall || leavingZone || wander.turnIn <= 0) {
        wander.direction = wander.direction > 0 ? -1 : 1;
        wander.turnIn = 4 + Math.random() * 10;
    }

    acceleration.x += wander.direction * maxSpeed * 0.8;

    if (isBottom) {
        return;
    }

    wander.pitch = Math.max(
        -0.4,
        Math.min(0.4, wander.pitch + (Math.random() - 0.5) * 1.5 * dt),
    );
    acceleration.y += Math.sin(wander.pitch) * maxSpeed * 0.8;

    const toZoneY = profile.zoneCenter.y - position.y;

    if (Math.abs(toZoneY) > profile.zoneRadius * 0.5) {
        acceleration.y +=
            (toZoneY - Math.sign(toZoneY) * profile.zoneRadius * 0.5) *
            3 *
            maxSpeed;
    }
}

/**
 * Mostly stay in the home layer, occasionally drifting into a neighbouring
 * one for a few seconds.
 */
function roamLayers(
    body: CreatureBody,
    wander: WanderState,
    profile: SteeringProfile,
    dt: number,
): void {
    if (body.layer !== body.homeLayer) {
        wander.awayFor -= dt;

        if (wander.awayFor <= 0) {
            body.layer = body.homeLayer;
        }

        return;
    }

    if (Math.random() >= profile.layerRoam * ROAM_RATE * dt) {
        return;
    }

    const step = Math.random() < 0.5 ? -1 : 1;
    const neighbour = body.homeLayer + step;
    const layer =
        neighbour < 0 || neighbour >= profile.layerCount
            ? body.homeLayer - step
            : neighbour;

    if (layer >= 0 && layer < profile.layerCount) {
        body.layer = layer;
        wander.awayFor = 4 + Math.random() * 6;
    }
}

function applySchooling(
    body: CreatureBody,
    profile: SteeringProfile,
    world: TankWorld,
    maxSpeed: number,
): void {
    neighbourCentre.set(0, 0, 0);
    neighbourHeading.set(0, 0, 0);
    let schoolmates = 0;

    for (const [id, other] of world.creatures) {
        if (id === profile.id || Math.abs(other.layer - body.layer) > 1) {
            continue;
        }

        const distance = other.position.distanceTo(body.position);

        if (distance < PERSONAL_SPACE && distance > 0) {
            scratch.subVectors(body.position, other.position).setZ(0);

            if (scratch.lengthSq() > 0) {
                acceleration.addScaledVector(
                    scratch.normalize(),
                    (PERSONAL_SPACE - distance) * 30 * maxSpeed,
                );
            }
        }

        if (
            profile.schooling > 0 &&
            other.speciesId === body.speciesId &&
            distance < NEIGHBOUR_RANGE
        ) {
            neighbourCentre.add(other.position);
            neighbourHeading.add(other.velocity);
            schoolmates++;
        }
    }

    if (schoolmates > 0) {
        neighbourCentre.divideScalar(schoolmates).sub(body.position).setZ(0);
        acceleration.addScaledVector(
            neighbourCentre,
            profile.schooling * 2 * maxSpeed,
        );
        acceleration.addScaledVector(
            neighbourHeading.divideScalar(schoolmates).setZ(0),
            profile.schooling,
        );
    }
}

/**
 * Chase the nearest food within about a layer either side. Returns the z to
 * swim to while chasing (so the food can actually be reached), or null.
 */
function seekFood(
    body: CreatureBody,
    wander: WanderState,
    profile: SteeringProfile,
    world: TankWorld,
    maxSpeed: number,
): number | null {
    if (profile.hunger < 0.15 || profile.behaviour === 'crawler') {
        return null;
    }

    const food = world.nearestFood(
        body.position,
        FOOD_SENSE_RANGE,
        profile.behaviour === 'bottom_dweller',
        layerDepth(profile.layerCount) * 1.5,
    );

    if (food === null) {
        return null;
    }

    const toFood = scratch.subVectors(food.position, body.position);

    if (toFood.length() < EAT_DISTANCE) {
        world.eat(food);

        return null;
    }

    body.layer = zToLayer(food.position.z, profile.layerCount);
    wander.awayFor = Math.max(wander.awayFor, 3);

    if (Math.abs(toFood.x) > 0.02) {
        wander.direction = toFood.x > 0 ? 1 : -1;
    }

    toFood.z = 0;
    acceleration.addScaledVector(toFood.normalize(), 6 * maxSpeed);

    return food.position.z;
}

function avoidWalls(position: Vector3, maxSpeed: number): void {
    const push = (distance: number) =>
        distance < 0.1 ? (0.1 - distance) * 40 * maxSpeed : 0;

    acceleration.x +=
        push(position.x - bounds.minX) - push(bounds.maxX - position.x);
    acceleration.y +=
        push(position.y - bounds.minY) - push(bounds.maxY - position.y);
}
