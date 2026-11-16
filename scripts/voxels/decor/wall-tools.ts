/**
 * Helpers shared by the rock wall models: plant spots kept clear, and
 * palette-friendly blends.
 */
import type { Cell, Solid } from './shapes.ts';

/** How far above and around a plant spot is kept clear for the plant. */
export const ANCHOR_CLEARANCE = { above: 16, radius: 4.5 };

/** Whether a cell is in the space kept clear above one of the plant spots. */
export function reservedAbove(
    anchors: Cell[],
): (x: number, y: number, z: number) => boolean {
    return (x, y, z) =>
        anchors.some(
            ([ax, ay, az]) =>
                y >= ay - 1 &&
                y <= ay + ANCHOR_CLEARANCE.above &&
                Math.hypot(x - ax, z - az) <= ANCHOR_CLEARANCE.radius + 1.5,
        );
}

/** Empty the room above each plant spot and make sure it has rock beneath. */
export function clearPlantSpots(solid: Solid, anchors: Cell[]): void {
    for (const [ax, ay, az] of anchors) {
        for (let y = ay; y <= ay + ANCHOR_CLEARANCE.above; y++) {
            for (let z = az - 6; z <= az + 6; z++) {
                for (let x = ax - 6; x <= ax + 6; x++) {
                    if (Math.hypot(x - ax, z - az) <= ANCHOR_CLEARANCE.radius) {
                        solid.put(x, y, z, 0);
                    }
                }
            }
        }

        solid.put(ax, ay - 1, az, solid.at(ax, ay - 1, az) || 1);
    }
}

/** Round a blend amount to a few steps, so the palette stays small. */
export function step(t: number, steps = 4): number {
    return Math.round(Math.max(0, Math.min(1, t)) * steps) / steps;
}
