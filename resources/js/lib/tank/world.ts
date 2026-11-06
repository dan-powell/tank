import { Vector3 } from 'three';
import { TANK } from './space';

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
};

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

    creatures = new Map<number, CreatureBody>();

    private nextFoodId = 1;

    /** Sprinkle food at a point on the surface (world coordinates). */
    sprinkle(x: number, z: number, count = 14): void {
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

    /** Advance sinking food and drop particles that have lain too long. */
    update(delta: number): void {
        for (const particle of this.food) {
            if (particle.position.y > TANK.substrate + 0.005) {
                particle.position.addScaledVector(particle.drift, delta);
                particle.drift.x *= 0.99;
                particle.drift.z *= 0.99;
            } else {
                particle.position.y = TANK.substrate + 0.005;
                particle.settledFor += delta;
            }
        }

        this.food = this.food.filter(
            (particle) => particle.settledFor < SETTLED_LIFETIME,
        );
    }

    nearestFood(
        from: Vector3,
        maxDistance: number,
        sunkenOnly: boolean,
    ): FoodParticle | null {
        let best: FoodParticle | null = null;
        let bestDistance = maxDistance * maxDistance;

        for (const particle of this.food) {
            if (sunkenOnly && particle.position.y > TANK.substrate + 0.08) {
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

    eat(particle: FoodParticle): void {
        this.food = this.food.filter((other) => other.id !== particle.id);
    }
}
