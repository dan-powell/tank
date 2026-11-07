import { Color, MeshStandardMaterial } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { TANK } from '@/lib/tank/space';
import { sceneClock } from './scene-clock';

/**
 * Uniforms shared by every material that receives caustics. They are the same
 * objects in every program, so changing a value here updates them all.
 */
export const causticUniforms = {
    uCausticTime: sceneClock,
    uCausticStrength: { value: 1 },
    uCausticColour: { value: new Color('#fff4dc') },
    uCausticWaterLine: { value: TANK.waterLine },
};

/**
 * GLSL for the animated caustic network: two drifting Voronoi layers whose
 * cell edges form the bright web of light focused by the rippling surface.
 * World x/z is projected up a slightly slanted light so the pattern shifts
 * with depth. Shared by the lit materials and the water volume.
 */
export const CAUSTIC_GLSL = /* glsl */ `
vec2 causticHash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

float causticCells(vec2 p, float t) {
    vec2 cell = floor(p);
    vec2 local = fract(p);
    float nearest = 8.0;
    float second = 8.0;

    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 hash = causticHash(cell + offset);
            vec2 point = offset + 0.5 + 0.4 * sin(t + 6.2831 * hash);
            float d = length(point - local);

            if (d < nearest) {
                second = nearest;
                nearest = d;
            } else if (d < second) {
                second = d;
            }
        }
    }

    return 1.0 - smoothstep(0.0, 0.12, second - nearest);
}

float tankCaustic(vec3 world, float waterLine, float t) {
    float below = max(waterLine - world.y, 0.0);
    vec2 p = (world.xz + vec2(0.12, 0.08) * below) * 6.5;
    p += 0.3 * vec2(sin(p.y * 0.7 + t * 0.6), cos(p.x * 0.6 - t * 0.5));
    float a = causticCells(p, t * 0.9);
    float b = causticCells(p * 1.37 + vec2(3.1, 7.4), -t * 0.7);
    float sharpness = mix(1.0, 0.55, clamp(below, 0.0, 1.0));

    return (a * a * 0.55 + b * b * 0.35 + a * b * 0.9) * sharpness;
}
`;

/**
 * Add underwater caustics to a standard material's shader. Like real
 * caustics, the pattern redistributes the direct light (bright lines, dimmer
 * gaps) rather than adding to it; strongest on upward-facing surfaces and
 * only below the water line.
 */
export function applyCaustics(
    shader: WebGLProgramParametersWithUniforms,
): void {
    Object.assign(shader.uniforms, causticUniforms);

    shader.vertexShader =
        `varying vec3 vCausticWorld;\nvarying vec3 vCausticNormal;\n${shader.vertexShader}`.replace(
            '#include <project_vertex>',
            `#include <project_vertex>
        vec4 causticPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
            causticPosition = instanceMatrix * causticPosition;
        #endif
        vCausticWorld = (modelMatrix * causticPosition).xyz;
        vCausticNormal = normalize(mat3(modelMatrix) * objectNormal);`,
        );

    shader.fragmentShader = `uniform float uCausticTime;
uniform float uCausticStrength;
uniform vec3 uCausticColour;
uniform float uCausticWaterLine;
varying vec3 vCausticWorld;
varying vec3 vCausticNormal;
${CAUSTIC_GLSL}
${shader.fragmentShader}`.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        float causticFacing = clamp(vCausticNormal.y * 0.6 + 0.4, 0.0, 1.0);
        float causticWet = smoothstep(uCausticWaterLine + 0.005, uCausticWaterLine - 0.03, vCausticWorld.y);
        float causticLight = 0.6 + 1.4 * tankCaustic(vCausticWorld, uCausticWaterLine, uCausticTime);
        reflectedLight.directDiffuse *= mix(vec3(1.0), uCausticColour * causticLight,
            clamp(uCausticStrength * causticFacing * causticWet, 0.0, 1.0));`,
    );
}

/** A plain standard material that receives caustics (e.g. the substrate). */
export function createCausticMaterial(
    color: Color,
    roughness = 1,
): MeshStandardMaterial {
    const material = new MeshStandardMaterial({ color, roughness });

    material.onBeforeCompile = applyCaustics;
    material.customProgramCacheKey = () => 'caustic-standard';

    return material;
}
