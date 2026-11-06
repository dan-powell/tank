import { Vector3 } from 'three';
import type { SpeciesBehaviour } from '@/types';
import { bounds, TANK } from './space';
import type { CreatureBody, TankWorld } from './world';

export type SteeringProfile = {
    id: number;
    behaviour: SpeciesBehaviour;
    /** Cruising speed in world units per second. */
    speed: number;
    /** 0..1 tendency to stay with others of the same species. */
    schooling: number;
    zoneCenter: Vector3;
    zoneRadius: number;
    hunger: number;
    health: number;
    isLit: boolean;
    lowOxygen: boolean;
};

export type WanderState = {
    heading: number;
    pitch: number;
};

const acceleration = new Vector3();
const scratch = new Vector3();
const neighbourCentre = new Vector3();
const neighbourHeading = new Vector3();

const FOOD_SENSE_RANGE = 1.2;
const EAT_DISTANCE = 0.05;
const NEIGHBOUR_RANGE = 0.3;
const PERSONAL_SPACE = 0.08;

/**
 * Advance one creature by a frame using simple steering behaviours:
 * wander, a spring towards its preferred zone, schooling, food seeking,
 * surface gasping when oxygen is low, and soft walls.
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

    wander.heading += (Math.random() - 0.5) * 3 * dt;
    wander.pitch = isBottom
        ? 0
        : Math.max(
              -0.4,
              Math.min(0.4, wander.pitch + (Math.random() - 0.5) * 1.5 * dt),
          );
    acceleration.add(
        scratch
            .set(
                Math.cos(wander.heading) * Math.cos(wander.pitch),
                Math.sin(wander.pitch),
                Math.sin(wander.heading) * Math.cos(wander.pitch),
            )
            .multiplyScalar(maxSpeed * 0.8),
    );

    const toZone = scratch.subVectors(profile.zoneCenter, position);

    if (isBottom) {
        toZone.y = 0;
    }

    const zoneDistance = toZone.length();

    if (zoneDistance > profile.zoneRadius) {
        acceleration.addScaledVector(
            toZone.normalize(),
            (zoneDistance - profile.zoneRadius) * 3 * maxSpeed,
        );
    }

    applySchooling(body, profile, world, maxSpeed);
    seekFood(body, profile, world, maxSpeed);

    if (profile.lowOxygen && !isBottom) {
        acceleration.y += (bounds.maxY - position.y) * 4 * maxSpeed;
    }

    avoidWalls(position, maxSpeed);

    velocity.addScaledVector(acceleration, dt);

    if (isBottom) {
        velocity.y = 0;
    }

    velocity.clampLength(0, maxSpeed);
    position.addScaledVector(velocity, dt);

    position.x = Math.min(bounds.maxX, Math.max(bounds.minX, position.x));
    position.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, position.z));
    position.y = isBottom
        ? TANK.substrate + (profile.behaviour === 'crawler' ? 0.015 : 0.035)
        : Math.min(bounds.maxY, Math.max(bounds.minY, position.y));
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
        if (id === profile.id) {
            continue;
        }

        const distance = other.position.distanceTo(body.position);

        if (distance < PERSONAL_SPACE && distance > 0) {
            acceleration.addScaledVector(
                scratch.subVectors(body.position, other.position).normalize(),
                (PERSONAL_SPACE - distance) * 30 * maxSpeed,
            );
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
        neighbourCentre.divideScalar(schoolmates).sub(body.position);
        acceleration.addScaledVector(
            neighbourCentre,
            profile.schooling * 2 * maxSpeed,
        );
        acceleration.addScaledVector(
            neighbourHeading.divideScalar(schoolmates),
            profile.schooling,
        );
    }
}

function seekFood(
    body: CreatureBody,
    profile: SteeringProfile,
    world: TankWorld,
    maxSpeed: number,
): void {
    if (profile.hunger < 0.15 || profile.behaviour === 'crawler') {
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

    acceleration.addScaledVector(toFood.normalize(), 6 * maxSpeed);
}

function avoidWalls(position: Vector3, maxSpeed: number): void {
    const push = (distance: number) =>
        distance < 0.1 ? (0.1 - distance) * 40 * maxSpeed : 0;

    acceleration.x +=
        push(position.x - bounds.minX) - push(bounds.maxX - position.x);
    acceleration.y +=
        push(position.y - bounds.minY) - push(bounds.maxY - position.y);
    acceleration.z +=
        push(position.z - bounds.minZ) - push(bounds.maxZ - position.z);
}
