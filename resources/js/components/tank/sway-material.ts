import { Color, MeshStandardMaterial } from 'three';
import { applyVoxelTint } from './voxel-material';

/** Shared clock for every swaying plant; advanced once per frame by the scene. */
export const swayClock = { value: 0 };

/**
 * A vertex-coloured voxel material whose vertices bend with a gentle current.
 * The bend grows with height above the plant's base (local y = 0) and is
 * phased by world position, so neighbouring plants do not move in lockstep.
 *
 * `unitHeight` is the model's height in local units, so the sway shape is the
 * same whatever the sprite's resolution; the material colour multiplies the
 * sprite colours (use {@link healthTint}).
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
        shader.uniforms.uSwayTime = swayClock;
        shader.vertexShader =
            `uniform float uSwayTime;\n${shader.vertexShader}`.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
            vec4 swayOrigin = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float swayHeight = max(position.y, 0.0) / ${unitHeight.toFixed(3)};
            float swayPhase = uSwayTime * 0.8 + swayOrigin.x * 2.3 + swayOrigin.z * 1.7;
            float swayAmount = ${amplitude.toFixed(3)} * swayHeight * swayHeight * ${unitHeight.toFixed(3)};
            transformed.x += sin(swayPhase + swayHeight * 1.5) * swayAmount;
            transformed.z += cos(swayPhase * 0.7) * swayAmount * 0.4;`,
            );
    };
    material.customProgramCacheKey = () =>
        `sway-${amplitude.toFixed(3)}-${unitHeight.toFixed(3)}`;

    return material;
}

/**
 * A colour multiplier for sprite colours that browns a plant as its health
 * drops (white = sprite colours unchanged).
 */
export function healthTint(health: number): Color {
    return new Color('#ffffff').lerp(
        new Color('#a8865a'),
        1 - Math.max(0, Math.min(1, health)),
    );
}
