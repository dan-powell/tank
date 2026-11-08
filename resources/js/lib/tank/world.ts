import { Vector3 } from 'three';
import { TANK } from './space';
import type { TerrainField } from './terrain-field';

export type FoodParticle = {
    id: number;
    position: Vector3;
    drift: Vector3;
    settledFor: number;
};

export type CreatureBody = {
    speciesId: number;
    position: Vector3;
    velocity: Vector3;
    /** The depth layer the creature lives in. */
    homeLayer: number;
    /** The depth layer it is currently heading for (usually its home). */
    layer: number;
    /** Which way the creature faces along x: 1 = right, -1 = left. */
    facing: 1 | -1;
};

/** A ring spreading across the water surface from where something landed. */
export type SurfaceRipple = {
    x: number;
    z: number;
    /** Seconds since the ripple started. */
    age: number;
};

/** Ripples fade out after this many seconds. */
export const RIPPLE_LIFETIME = 4;

/** At most this many ripples are kept (the water shader has fixed slots). */
export const MAX_RIPPLES = 8;

/** Food stays on the substrate this many seconds before it is cleared visually. */
const SETTLED_LIFETIME = 90;

const MAX_FOOD = 300;

/**
 * Mutable client-side world shared by the animated scene: food particles
 * and the current positions of every creature. Lives outside React state
 * because it changes every frame.
 */
export class TankWorld {
    food: FoodParticle[] = [];

    ripples: SurfaceRipple[] = [];

    creatures = new Map<number, CreatureBody>();

    /** Creatures the user took out, so they vanish rather than float up as if dead. */
    removedCreatures = new Set<number>();

    /** The substrate and decorations, once their models have loaded. */
    terrain: TerrainField | null = null;

    private nextFoodId = 1;

    /** Sprinkle food at a point on the surface (world coordinates). */
    sprinkle(x: number, z: number, count = 14): void {
        this.ripples = [...this.ripples, { x, z, age: 0 }].slice(-MAX_RIPPLES);

        for (let i = 0; i < count && this.food.length < MAX_FOOD; i++) {
            this.food.push({
                id: this.nextFoodId++,
                position: new Vector3(
                    x + (Math.random() - 0.5) * 0.18,
                    TANK.waterLine - 0.01,
                    z + (Math.random() - 0.5) * 0.18,
                ),
                drift: new Vector3(
                    (Math.random() - 0.5) * 0.03,
                    -0.06 - Math.random() * 0.05,
                    (Math.random() - 0.5) * 0.03,
                ),
                settledFor: 0,
            });
        }
    }

    /** Scatter leftover food that has already sunk to the bottom. */
    scatterSunkenFood(count: number): void {
        for (let i = 0; i < count && this.food.length < MAX_FOOD; i++) {
            this.food.push({
                id: this.nextFoodId++,
                position: new Vector3(
                    (Math.random() - 0.5) * (TANK.width - 0.3),
                    TANK.substrate + 0.005,
                    (Math.random() - 0.5) * (TANK.depth - 0.3),
                ),
                drift: new Vector3(),
                settledFor: Math.random() * SETTLED_LIFETIME * 0.5,
            });
        }
    }

    /** Advance sinking food and surface ripples, and drop particles that have lain too long. */
    update(delta: number): void {
        for (const ripple of this.ripples) {
            ripple.age += delta;
        }

        this.ripples = this.ripples.filter(
            (ripple) => ripple.age < RIPPLE_LIFETIME,
        );

        for (const particle of this.food) {
            const floor = this.floorBeneath(particle.position) + 0.005;

            if (particle.settledFor === 0 && particle.position.y > floor) {
                particle.position.addScaledVector(particle.drift, delta);
                particle.drift.x *= 0.99;
                particle.drift.z *= 0.99;
            } else {
                particle.position.y = floor;
                particle.settledFor += delta;
            }
        }

        this.food = this.food.filter(
            (particle) => particle.settledFor < SETTLED_LIFETIME,
        );
    }

    /**
     * The closest food particle within `maxDistance`, optionally only food
     * that has sunk and only food within `maxDepthOffset` of `from` in z.
     */
    nearestFood(
        from: Vector3,
        maxDistance: number,
        sunkenOnly: boolean,
        maxDepthOffset = Infinity,
    ): FoodParticle | null {
        let best: FoodParticle | null = null;
        let bestDistance = maxDistance * maxDistance;

        for (const particle of this.food) {
            if (
                sunkenOnly &&
                particle.settledFor === 0 &&
                particle.position.y >
                    this.floorBeneath(particle.position) + 0.08
            ) {
                continue;
            }

            if (Math.abs(particle.position.z - from.z) > maxDepthOffset) {
                continue;
            }

            const distance = particle.position.distanceToSquared(from);

            if (distance < bestDistance) {
                best = particle;
                bestDistance = distance;
            }
        }

        return best;
    }

    /** Height of whatever a sinking particle would land on: a decoration or the substrate. */
    private floorBeneath(position: Vector3): number {
        return this.terrain?.surfaceBelow(position) ?? TANK.substrate;
    }

    eat(particle: FoodParticle): void {
        this.food = this.food.filter((other) => other.id !== particle.id);
    }
}
