import { Color, MeshStandardMaterial } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { applyCaustics } from './caustics';
import { applyReveal } from './intro-material';
import type { RevealUniform } from './intro-material';

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
 * The lights' mixed colour and combined strength this frame (0 when they are
 * all off), shared by every creature's sheen. Kept up to date by TankLighting.
 */
export const sheenUniforms = {
    uSheenColour: { value: new Color('#ffffff') },
    uSheenStrength: { value: 0 },
};

/**
 * A wet, scaly sheen in the colour of the lights above: a glint on faces
 * turned towards the lights, and a rim of light along the back and edges,
 * rippling with the caustics. Needs applyCaustics first (for tankCaustic).
 */
function applySheen(shader: WebGLProgramParametersWithUniforms): void {
    Object.assign(shader.uniforms, sheenUniforms);

    shader.fragmentShader = `uniform vec3 uSheenColour;
uniform float uSheenStrength;
${shader.fragmentShader}`.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        vec3 sheenUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        float sheenFacing = max(dot(geometryNormal, geometryViewDir), 0.0);
        float sheenGlint = pow(max(dot(geometryNormal, normalize(sheenUp + geometryViewDir)), 0.0), 6.0);
        float sheenRim = pow(1.0 - sheenFacing, 3.0) * clamp(dot(geometryNormal, sheenUp) * 0.5 + 0.6, 0.0, 1.0);
        float sheenRipple = 0.5 + tankCaustic(vCausticWorld, uCausticWaterLine, uCausticTime);
        reflectedLight.directSpecular += uSheenColour * uSheenStrength * sheenRipple
            * (sheenGlint * 0.7 + sheenRim * 0.6);`,
    );
}

/**
 * A material for voxel creatures: sprite colours, with tint-keyed pixels
 * recoloured per individual, multiplied by `color` (white = unchanged), lit
 * by the water's caustics. With `sheen`, it also catches a glint in the
 * lights' colour (for fish and other animals). With `reveal`, it dissolves
 * in voxel by voxel (see applyReveal).
 */
export function createVoxelMaterial(
    tint: Color,
    color = new Color('#ffffff'),
    { sheen = false, reveal }: { sheen?: boolean; reveal?: RevealUniform } = {},
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

        if (sheen) {
            applySheen(shader);
        }

        if (reveal !== undefined) {
            applyReveal(shader, reveal);
        }
    };
    material.customProgramCacheKey = () =>
        `voxel-tint${sheen ? '-sheen' : ''}${reveal === undefined ? '' : '-reveal'}`;

    return material;
}
