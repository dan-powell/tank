import { Vector3 } from 'three';
import type { TankGrid } from '@/types';

/**
 * World-space dimensions of the tank being viewed (1 unit = 25 cm), set from
 * its grid by {@link configureTankSpace} before the scene renders. Only one
 * tank is shown at a time, so the scene and steering read these directly.
 * `substrate` is the unsculpted substrate depth, used where the heightmap
 * isn't to hand.
 */
export const TANK = {
    width: 2.4,
    height: 1.3,
    depth: 1.1,
    substrate: 0.08,
    waterLine: 1.22,
};

/** Where the auto-feeder sits on the rim, in normalised x/z (back right). */
export const AUTO_FEEDER_SPOT = { x: 0.82, z: 0.2 } as const;

/** World units per centimetre of animal length. */
export const CM = 0.04;

/**
 * World height that plant `segment_height`s are fractions of (32.5 cm, the
 * starter tank's height), so plants are the same size in any tank.
 */
export const PLANT_HEIGHT_UNIT = 1.3;

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

/** Where swimming animals may go: inside the glass, clear of the walls. */
export const bounds = {
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    minZ: 0,
    maxZ: 0,
};

/** Substrate depth of an unsculpted tank, in grid cells (matches TankGeometry). */
const DEFAULT_SUBSTRATE_CELLS = 4;

/**
 * Size the shared tank space for the tank about to be shown. Call before
 * rendering its scene (and remount the scene if the size changes).
 */
export function configureTankSpace(grid: TankGrid): void {
    TANK.width = grid.width * DECOR_VOXEL;
    TANK.height = grid.height * DECOR_VOXEL;
    TANK.depth = grid.depth * DECOR_VOXEL;
    TANK.substrate = DEFAULT_SUBSTRATE_CELLS * DECOR_VOXEL;
    TANK.waterLine = grid.water_level * DECOR_VOXEL;

    bounds.minX = -TANK.width / 2 + MARGIN;
    bounds.maxX = TANK.width / 2 - MARGIN;
    bounds.minY = TANK.substrate + 0.04;
    bounds.maxY = TANK.waterLine - 0.05;
    bounds.minZ = -TANK.depth / 2 + MARGIN;
    bounds.maxZ = TANK.depth / 2 - MARGIN;
}

configureTankSpace({
    width: 120,
    height: 65,
    depth: 55,
    water_level: 61,
    max_water_level: 61,
    substrate_column: 4,
});

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
