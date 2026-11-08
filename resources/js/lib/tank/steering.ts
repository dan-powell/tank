import { Vector3 } from 'three';
import type { SpeciesBehaviour } from '@/types';
import {
    bounds,
    DECOR_VOXEL,
    laneOffset,
    layerDepth,
    layerToZ,
    TANK,
    zToLayer,
} from './space';
import type { TerrainField } from './terrain-field';
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
const previous = new Vector3();
const probe = new Vector3();
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
/** How far ahead (world units) a swimmer looks for decorations in its way. */
const LOOK_AHEAD = 0.08;
/** The tallest obstacle (world units) a swimmer rises over rather than turning back. */
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

    const terrain = world.terrain;

    if (terrain !== null && !isBottom) {
        avoidTerrain(body, wander, terrain, maxSpeed);
    }

    avoidWalls(position, maxSpeed);

    velocity.x += acceleration.x * dt;
    velocity.y = isBottom ? 0 : velocity.y + acceleration.y * dt;
    scratch.set(velocity.x, velocity.y, 0).clampLength(0, maxSpeed);
    velocity.x = scratch.x;
    velocity.y = scratch.y;

    const targetZ =
        foodZ ??
        layerToZ(body.layer, profile.layerCount) +
            laneOffset(profile.id, profile.layerCount);
    velocity.z = Math.max(
        -maxSpeed * 0.6,
        Math.min(maxSpeed * 0.6, (targetZ - position.z) * 1.5),
    );

    previous.copy(position);
    position.addScaledVector(velocity, dt);

    position.x = Math.min(bounds.maxX, Math.max(bounds.minX, position.x));
    position.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, position.z));

    if (isBottom) {
        walkOnTerrain(body, wander, profile, terrain, maxSpeed, dt);
    } else {
        position.y = Math.min(bounds.maxY, Math.max(bounds.minY, position.y));

        if (terrain !== null) {
            keepOutOfTerrain(position, terrain);
        }
    }

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

/**
 * Steer a swimmer around decorations: rise over an obstacle ahead when it is
 * low enough, otherwise turn back as at a wall, and keep a little clearance
 * above and below so fish don't scrape along rocks.
 */
function avoidTerrain(
    body: CreatureBody,
    wander: WanderState,
    terrain: TerrainField,
    maxSpeed: number,
): void {
    const { position, velocity } = body;
    const heading =
        Math.abs(velocity.x) > 0.005 ? Math.sign(velocity.x) : wander.direction;

    probe.set(position.x + heading * LOOK_AHEAD, position.y, position.z);

    if (!terrain.isFree(probe)) {
        const startY = probe.y;
        let clearAbove = false;

        for (let rise = DECOR_VOXEL; rise <= SWIM_OVER; rise += DECOR_VOXEL) {
            probe.y = startY + rise;

            if (probe.y > bounds.maxY) {
                break;
            }

            if (terrain.isFree(probe)) {
                clearAbove = true;
                break;
            }
        }

        if (clearAbove) {
            acceleration.y += 8 * maxSpeed;
            acceleration.x -= heading * 0.6 * maxSpeed;
        } else {
            wander.direction = heading > 0 ? -1 : 1;
            wander.turnIn = 4 + Math.random() * 10;
            velocity.x *= -0.3;
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

/**
 * Keep a bottom dweller on whatever is beneath it: the substrate or the top
 * of a decoration. Crawlers climb anything under water, slowly and clinging
 * to the face as they go; other bottom dwellers only take small steps and
 * turn round at anything taller.
 */
function walkOnTerrain(
    body: CreatureBody,
    wander: WanderState,
    profile: SteeringProfile,
    terrain: TerrainField | null,
    maxSpeed: number,
    dt: number,
): void {
    const { position, velocity } = body;
    const isCrawler = profile.behaviour === 'crawler';
    const lift = isCrawler ? 0 : BOTTOM_LIFT;

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
    const submerged = (height: number) =>
        height < terrain.waterLevel * DECOR_VOXEL - 0.01;

    let surface = ground(position.x, position.z);

    if (surface === null || !submerged(surface)) {
        position.x = previous.x;
        position.z = previous.z;
        wander.direction = wander.direction > 0 ? -1 : 1;
        wander.turnIn = 4 + Math.random() * 10;
        velocity.x = 0;
        surface = ground(position.x, position.z) ?? foot;
    }

    const target = surface + lift;
    const climb = target - previous.y;

    if (climb > 0.01) {
        // Climb the face before stepping onto the higher ground.
        position.x = previous.x;
        position.z = previous.z;
    }

    const rate = (isCrawler ? maxSpeed * 1.5 : 0.6) * dt;
    position.y =
        climb > 0
            ? Math.min(target, previous.y + rate)
            : Math.max(target, previous.y - Math.max(rate, 0.3 * dt));
}

function avoidWalls(position: Vector3, maxSpeed: number): void {
    const push = (distance: number) =>
        distance < 0.1 ? (0.1 - distance) * 40 * maxSpeed : 0;

    acceleration.x +=
        push(position.x - bounds.minX) - push(bounds.maxX - position.x);
    acceleration.y +=
        push(position.y - bounds.minY) - push(bounds.maxY - position.y);
}
