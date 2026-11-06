import { Color, DoubleSide, MeshStandardMaterial } from 'three';

/** Shared clock for every swaying plant; advanced once per frame by the scene. */
export const swayClock = { value: 0 };

/**
 * A standard material whose vertices bend with a gentle current. The bend
 * grows with height above the plant's base (local y = 0) and is phased by
 * world position, so neighbouring plants do not move in lockstep.
 */
export function createSwayMaterial(
    color: Color,
    amplitude: number,
): MeshStandardMaterial {
    const material = new MeshStandardMaterial({
        color,
        side: DoubleSide,
        roughness: 0.85,
    });

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uSwayTime = swayClock;
        shader.vertexShader =
            `uniform float uSwayTime;\n${shader.vertexShader}`.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
            vec4 swayOrigin = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float swayHeight = max(position.y, 0.0);
            float swayPhase = uSwayTime * 0.8 + swayOrigin.x * 2.3 + swayOrigin.z * 1.7;
            float swayAmount = ${amplitude.toFixed(3)} * swayHeight * swayHeight;
            transformed.x += sin(swayPhase + swayHeight * 1.5) * swayAmount;
            transformed.z += cos(swayPhase * 0.7) * swayAmount * 0.4;`,
            );
    };

    return material;
}

/** Blend a healthy colour towards a sickly brown as health drops. */
export function healthTint(base: string, health: number): Color {
    return new Color(base).lerp(
        new Color('#8a6d3b'),
        1 - Math.max(0, Math.min(1, health)),
    );
}
