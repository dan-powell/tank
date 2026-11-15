import type { WebGLProgramParametersWithUniforms } from 'three';

/** A uniform holding how much of something is shown, 0..1. */
export type RevealUniform = { value: number };

/**
 * Reveal uniforms shared by every material of a kind. They are the same
 * objects in every program, so changing a value here updates them all.
 * Fully shown (1) unless the intro is running.
 */
export const introUniforms = {
    /** The gravel, decorations and litter. */
    landscape: { value: 1 } as RevealUniform,
};

/**
 * The voxel cell a fragment belongs to: its object-space position nudged half
 * a cell inwards along the face's normal, so a face lands in the cell it
 * covers rather than on the boundary between two.
 */
function addCellVarying(
    shader: WebGLProgramParametersWithUniforms,
    prefix: string,
    cellSize: number,
): void {
    const cell = cellSize.toFixed(6);

    shader.vertexShader =
        `varying vec3 v${prefix}Cell;\n${shader.vertexShader}`.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            v${prefix}Cell = (position - normal * ${cell} * 0.5) / ${cell};`,
        );
    shader.fragmentShader = `varying vec3 v${prefix}Cell;\n${shader.fragmentShader}`;
}

/**
 * Dissolve a material in voxel by voxel: each cell (`cellSize` in the
 * geometry's own units) appears once `reveal` passes its own random
 * threshold, so at 0 nothing is drawn and at 1 everything is.
 */
export function applyReveal(
    shader: WebGLProgramParametersWithUniforms,
    reveal: RevealUniform,
    cellSize = 1,
): void {
    shader.uniforms.uReveal = reveal;
    addCellVarying(shader, 'Reveal', cellSize);
    shader.fragmentShader = `uniform float uReveal;
float revealHash(vec3 cell) {
    return fract(sin(dot(cell, vec3(39.346, 11.135, 83.155))) * 24634.6345);
}
${shader.fragmentShader}`.replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        if (revealHash(floor(vRevealCell + 1e-3)) * 0.999 >= uReveal) {
            discard;
        }`,
    );
}

/** How a plant grows: tall plants upwards, cushions (moss) outwards. */
export type GrowthShape = 'upright' | 'spreading';

/**
 * Grow a plant from its roots (local origin, in voxels, centred on the root
 * voxel across the ground and at its base upwards): only the voxels
 * within `grow` × `extent` of the roots are drawn, measured upwards for
 * upright plants (roots below the origin always drawn: the gravel hides
 * them) and outwards across the ground for spreading ones.
 */
export function applyGrow(
    shader: WebGLProgramParametersWithUniforms,
    grow: RevealUniform,
    shape: GrowthShape,
    extent: number,
): void {
    shader.uniforms.uGrow = grow;
    shader.uniforms.uGrowExtent = { value: Math.max(extent, 1) };
    addCellVarying(shader, 'Grow', 1);

    const isBeyond =
        shape === 'upright'
            ? 'growCell.y >= 0.0 && growCell.y + 1.0 > uGrow * uGrowExtent + 1e-3'
            : 'length(growCell.xz) + 0.5 > uGrow * uGrowExtent + 1e-3';

    shader.fragmentShader = `uniform float uGrow;
uniform float uGrowExtent;
${shader.fragmentShader}`.replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        vec3 growCell = floor(vGrowCell + vec3(0.5, 0.0, 0.5) + 1e-3);
        if (${isBeyond}) {
            discard;
        }`,
    );
}
