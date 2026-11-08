import { Vector3 } from 'three';

/** World-space dimensions of the tank (roughly 1 unit = 25 cm). */
export const TANK = {
    width: 2.4,
    height: 1.3,
    depth: 1.1,
    substrate: 0.08,
    waterLine: 1.22,
} as const;

/** Where the auto-feeder sits on the rim, in normalised x/z (back right). */
export const AUTO_FEEDER_SPOT = { x: 0.82, z: 0.2 } as const;

/** World units per centimetre of animal length. */
export const CM = 0.04;

/** Wall clearance kept by swimming animals. */
export const MARGIN = 0.08;

/**
 * Size of one decoration grid cell in world units (0.5 cm). The grid spans
 * the tank's interior from the glass floor (y = 0) to the rim, with z = 0 at
 * the back glass; decorations, the substrate and the water level all use it.
 */
export const DECOR_VOXEL = 0.02;

/** The world-space corner of a decoration grid cell (its minimum x, y and z). */
export function cellToWorld(
    x: number,
    y: number,
    z: number,
    target = new Vector3(),
): Vector3 {
    return target.set(
        x * DECOR_VOXEL - TANK.width / 2,
        y * DECOR_VOXEL,
        z * DECOR_VOXEL - TANK.depth / 2,
    );
}

/** The (fractional) decoration grid position of a world-space point. */
export function worldToCell(point: Vector3, target = new Vector3()): Vector3 {
    return target.set(
        (point.x + TANK.width / 2) / DECOR_VOXEL,
        point.y / DECOR_VOXEL,
        (point.z + TANK.depth / 2) / DECOR_VOXEL,
    );
}

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

/** Depth (world units) of one layer of a tank divided into `layerCount` layers. */
export function layerDepth(layerCount: number): number {
    return (TANK.depth - 2 * MARGIN) / Math.max(1, layerCount);
}

/** World-space z of the centre of a depth layer (layer 0 = back glass). */
export function layerToZ(layer: number, layerCount: number): number {
    return -TANK.depth / 2 + MARGIN + (layer + 0.5) * layerDepth(layerCount);
}

/** Share of a layer's depth that per-entity lanes are spread across. */
const LANE_SPREAD = 0.7;

/**
 * A fixed depth offset within a layer for one entity, so entities sharing a
 * layer sit at slightly different depths instead of z-fighting. Golden-ratio
 * spacing keeps consecutive ids well apart; `salt` decorrelates entity kinds.
 */
export function laneOffset(id: number, layerCount: number, salt = 0): number {
    const fraction = (((id * 0.618034 + salt) % 1) + 1) % 1;

    return (fraction - 0.5) * LANE_SPREAD * layerDepth(layerCount);
}

/** The depth layer containing a world-space z. */
export function zToLayer(z: number, layerCount: number): number {
    const layer = Math.floor(
        (z + TANK.depth / 2 - MARGIN) / layerDepth(layerCount),
    );

    return Math.min(layerCount - 1, Math.max(0, layer));
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
