import { Vector3 } from 'three';

/** World-space dimensions of the tank (roughly 1 unit = 25 cm). */
export const TANK = {
    width: 2.4,
    height: 1.3,
    depth: 1.1,
    substrate: 0.08,
    waterLine: 1.22,
} as const;

/** World units per centimetre of animal length. */
export const CM = 0.04;

/** Wall clearance kept by swimming animals. */
export const MARGIN = 0.08;

/**
 * Convert normalised tank coordinates (0..1; y = height above the
 * substrate, z = 0 at the back) into world space.
 */
export function toWorld(
    x: number,
    y: number,
    z: number,
    target = new Vector3(),
): Vector3 {
    return target.set(
        (x - 0.5) * TANK.width,
        TANK.substrate + y * (TANK.waterLine - TANK.substrate),
        (z - 0.5) * TANK.depth,
    );
}

/** Convert a world-space point on the water surface back to normalised x/z. */
export function toNormalisedSurface(point: Vector3): { x: number; z: number } {
    const clamp = (value: number) => Math.min(1, Math.max(0, value));

    return {
        x: clamp(point.x / TANK.width + 0.5),
        z: clamp(point.z / TANK.depth + 0.5),
    };
}

/** Scale a normalised zone radius into world units (using tank width). */
export function zoneRadiusToWorld(radius: number): number {
    return radius * TANK.width * 0.6;
}

export const bounds = {
    minX: -TANK.width / 2 + MARGIN,
    maxX: TANK.width / 2 - MARGIN,
    minY: TANK.substrate + 0.04,
    maxY: TANK.waterLine - 0.05,
    minZ: -TANK.depth / 2 + MARGIN,
    maxZ: TANK.depth / 2 - MARGIN,
};

/** Format the simulation clock as "Day 3, 14:05". */
export function formatSimClock(simSeconds: number): string {
    const day = Math.floor(simSeconds / 86400) + 1;
    const secondsToday = simSeconds % 86400;
    const hours = Math.floor(secondsToday / 3600)
        .toString()
        .padStart(2, '0');
    const minutes = Math.floor((secondsToday % 3600) / 60)
        .toString()
        .padStart(2, '0');

    return `Day ${day}, ${hours}:${minutes}`;
}
