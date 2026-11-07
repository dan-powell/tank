/**
 * Shared animation clock (plant sway, caustics, water, bubbles), in seconds.
 * Advanced once per frame by the scene; a uniform-shaped object so shaders
 * can reference it directly.
 */
export const sceneClock = { value: 0 };
