import { Color, MeshStandardMaterial } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { applyCaustics } from './caustics';

/**
 * Replace the colour of tint-keyed sprite pixels (the `aTint` attribute
 * written by the voxel builder) with a uniform colour.
 */
export function applyVoxelTint(
    shader: WebGLProgramParametersWithUniforms,
    tint: Color,
): void {
    shader.uniforms.uTint = { value: tint };
    shader.vertexShader =
        `attribute float aTint;\nuniform vec3 uTint;\n${shader.vertexShader}`.replace(
            '#include <color_vertex>',
            `#include <color_vertex>
        vColor.rgb = mix(vColor.rgb, uTint, aTint);`,
        );
}

/**
 * A material for voxel creatures: sprite colours, with tint-keyed pixels
 * recoloured per individual, multiplied by `color` (white = unchanged), lit
 * by the water's caustics.
 */
export function createVoxelMaterial(
    tint: Color,
    color = new Color('#ffffff'),
): MeshStandardMaterial {
    const material = new MeshStandardMaterial({
        color,
        vertexColors: true,
        roughness: 0.55,
        metalness: 0.1,
    });

    material.onBeforeCompile = (shader) => {
        applyVoxelTint(shader, tint);
        applyCaustics(shader);
    };
    material.customProgramCacheKey = () => 'voxel-tint';

    return material;
}
