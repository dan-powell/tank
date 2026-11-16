import { Spherical, Vector3 } from 'three';

/** A sign along each axis: towards -, level with, or towards + the tank's centre. */
type Sign = -1 | 0 | 1;

/**
 * Every direction the camera can be sent to from the view cube, as which side
 * of the tank's centre it looks from along x (right), y (up) and z (front).
 * Faces look square-on, edges at 45° between two faces, and the top corners
 * from between three. Nothing looks from below.
 */
export const TANK_VIEWS = {
    front: [0, 0, 1],
    back: [0, 0, -1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    top: [0, 1, 0],
    'front-left': [-1, 0, 1],
    'front-right': [1, 0, 1],
    'back-left': [-1, 0, -1],
    'back-right': [1, 0, -1],
    'top-front': [0, 1, 1],
    'top-back': [0, 1, -1],
    'top-left': [-1, 1, 0],
    'top-right': [1, 1, 0],
    'top-front-left': [-1, 1, 1],
    'top-front-right': [1, 1, 1],
    'top-back-left': [-1, 1, -1],
    'top-back-right': [1, 1, -1],
} as const satisfies Record<string, readonly [Sign, Sign, Sign]>;

export type TankView = keyof typeof TANK_VIEWS;

export type TankAxis = 'x' | 'y' | 'z';

export const TANK_VIEW_NAMES = Object.keys(TANK_VIEWS) as TankView[];

/** Orbit angles (radians, as in three's Spherical) for looking from `view`. */
export function viewAngles(view: TankView): { azimuth: number; polar: number } {
    const spherical = new Spherical().setFromVector3(
        new Vector3(...TANK_VIEWS[view]),
    );

    return { azimuth: spherical.theta, polar: spherical.phi };
}

/** The axis pointing straight at the viewer for a face view; null for edges and corners. */
export function facingAxis(view: TankView): TankAxis | null {
    const signs = TANK_VIEWS[view];
    const axes = (['x', 'y', 'z'] as const).filter(
        (_, index) => signs[index] !== 0,
    );

    return axes.length === 1 ? axes[0] : null;
}

/** How many axes `view` leans along: 1 for a face, 2 for an edge, 3 for a corner. */
export function viewRank(view: TankView): number {
    return TANK_VIEWS[view].filter((sign) => sign !== 0).length;
}
