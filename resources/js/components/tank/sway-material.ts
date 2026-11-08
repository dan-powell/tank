import { Color, MeshStandardMaterial } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { applyCaustics } from './caustics';
import { sceneClock } from './scene-clock';
import { applyVoxelTint } from './voxel-material';

/**
 * A vertex-coloured voxel material whose vertices bend with a gentle current.
 * The bend grows with height above the plant's base (local y = 0) and is
 * phased by world position, so neighbouring plants do not move in lockstep.
 *
 * `unitHeight` is the plant's height in local units (voxels), so the sway
 * shape is the same at any size; it is a uniform, so plants of every height
 * share one shader. The material colour multiplies the voxel colours (use
 * {@link healthTint}).
 */
export function createSwayMaterial(
    color: Color,
    amplitude: number,
    unitHeight = 1,
): MeshStandardMaterial {
    const material = new MeshStandardMaterial({
        color,
        vertexColors: true,
        roughness: 0.85,
    });

    material.onBeforeCompile = (shader) => {
        applyVoxelTint(shader, new Color('#ffffff'));
        applyCaustics(shader);
        applySway(shader, amplitude, unitHeight);
    };
    material.customProgramCacheKey = () => `sway-${amplitude.toFixed(3)}`;

    return material;
}

/**
 * Bend the vertices with the current (see {@link createSwayMaterial}). Shared
 * with the selection halo so it moves with the plant.
 */
export function applySway(
    shader: WebGLProgramParametersWithUniforms,
    amplitude: number,
    unitHeight: number,
): void {
    shader.uniforms.uSwayTime = sceneClock;
    shader.uniforms.uSwayHeight = { value: Math.max(unitHeight, 1e-3) };
    shader.vertexShader =
        `uniform float uSwayTime;\nuniform float uSwayHeight;\n${shader.vertexShader}`.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vec4 swayOrigin = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float swayHeight = max(position.y, 0.0) / uSwayHeight;
            float swayPhase = uSwayTime * 0.8 + swayOrigin.x * 2.3 + swayOrigin.z * 1.7;
            float swayAmount = ${amplitude.toFixed(3)} * swayHeight * swayHeight * uSwayHeight;
            transformed.x += sin(swayPhase + swayHeight * 1.5) * swayAmount;
            transformed.z += cos(swayPhase * 0.7) * swayAmount * 0.4;`,
        );
}

/** Colour multiplier that brightens the selected inhabitant. */
export const HIGHLIGHT_BRIGHTNESS = 1.45;

/**
 * A colour multiplier for voxel colours that browns a plant as its health
 * drops (white = colours unchanged).
 */
export function healthTint(health: number): Color {
    return new Color('#ffffff').lerp(
        new Color('#a8865a'),
        1 - Math.max(0, Math.min(1, health)),
    );
}
