import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Color,
    DepthTexture,
    FloatType,
    HalfFloatType,
    Matrix4,
    ShaderMaterial,
    Vector2,
    Vector3,
    Vector4,
    WebGLRenderTarget,
} from 'three';
import type { Mesh, PerspectiveCamera } from 'three';
import { TANK } from '@/lib/tank/space';
import { MAX_RIPPLES, RIPPLE_LIFETIME } from '@/lib/tank/world';
import type { TankWorld } from '@/lib/tank/world';
import type { WaterParameters } from '@/types';
import { airStone } from './bubbles';
import { CAUSTIC_GLSL, causticUniforms } from './caustics';
import { sceneClock } from './scene-clock';
import { hoodHeight, spotPositions } from './tank-lighting';

type Props = {
    water: WaterParameters;
    isLit: boolean;
    world: TankWorld;
};

const CLEAN_WATER = new Color('#7cc4e4');
const GREEN_WATER = new Color('#6f9f4a');
const MURKY_WATER = new Color('#8a7a50');

/** Light colours (linear, pre-tone-mapping) for the lamp on and off. */
const DAY = {
    light: new Color('#fff1d6'),
    room: new Color('#2c3e52'),
    sky: new Color('#dcefff'),
    ambient: 0.32,
    shafts: 1.1,
    caustics: 0.9,
    causticTint: new Color('#ffffff'),
};

const NIGHT = {
    light: new Color('#9fb4ff'),
    room: new Color('#0e1626'),
    sky: new Color('#3a4c7a'),
    ambient: 0.1,
    shafts: 0.35,
    caustics: 0.5,
    causticTint: new Color('#dfe6ff'),
};

/** Height of the water box's floor, just clear of the glass. */
const WATER_FLOOR = 0.002;

/** Surface subdivisions per world unit; the top face is displaced by the ripple field. */
const SURFACE_SEGMENTS_PER_UNIT = 66;

/**
 * The water's box in the current tank, from just above the glass floor to the
 * water line; the gravel hides whatever part of it lies beneath its surface,
 * wherever it has been sculpted.
 */
function waterBox(): {
    min: Vector3;
    max: Vector3;
    height: number;
    segments: { x: number; z: number };
} {
    return {
        min: new Vector3(
            -TANK.width / 2 + 0.005,
            WATER_FLOOR,
            -TANK.depth / 2 + 0.005,
        ),
        max: new Vector3(
            TANK.width / 2 - 0.005,
            TANK.waterLine,
            TANK.depth / 2 - 0.005,
        ),
        height: TANK.waterLine - WATER_FLOOR,
        segments: {
            x: Math.round(TANK.width * SURFACE_SEGMENTS_PER_UNIT),
            z: Math.round(TANK.depth * SURFACE_SEGMENTS_PER_UNIT),
        },
    };
}

const vertexShader = /* glsl */ `
#define MAX_RIPPLES ${MAX_RIPPLES}

uniform float uTime;
uniform float uSurfaceY;
uniform vec2 uBubbleSource;
uniform vec4 uRipples[MAX_RIPPLES];

varying vec3 vWorld;
varying float vTop;

__WAVES__

void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);

    if (world.y > uSurfaceY - 0.001) {
        world.y += waveHeight(world.xz);
    }

    vWorld = world.xyz;
    vTop = normal.y > 0.5 ? 1.0 : 0.0;
    gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * The surface height field: a few travelling swells, a constant boil above
 * the air stone, and rings spreading from where food landed.
 */
const WAVE_GLSL = /* glsl */ `
float waveHeight(vec2 p) {
    float t = uTime;
    float h = 0.0;
    h += sin(dot(p, vec2(0.9, 0.4)) * 9.0 + t * 1.6) * 0.0022;
    h += sin(dot(p, vec2(-0.5, 0.85)) * 13.0 + t * 2.1) * 0.0015;
    h += sin(dot(p, vec2(0.2, -1.0)) * 21.0 + t * 2.9) * 0.0008;

    float boil = distance(p, uBubbleSource);
    h += sin(boil * 70.0 - t * 10.0) * 0.003 * exp(-boil * 9.0);

    for (int i = 0; i < MAX_RIPPLES; i++) {
        vec4 ripple = uRipples[i];
        float d = distance(p, ripple.xy);
        float offset = d - ripple.z * 0.32;
        float ring = exp(-offset * offset * 260.0);
        h += sin(offset * 75.0) * ring * ripple.w * 0.007 * exp(-ripple.z * 1.1);
    }

    return h;
}
`;

const fragmentShader = /* glsl */ `
#include <packing>
#define MAX_RIPPLES ${MAX_RIPPLES}
#define SHAFT_STEPS 20
#define IOR 1.333

uniform sampler2D uScene;
uniform sampler2D uDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform mat4 uViewProjection;

uniform float uTime;
uniform float uSurfaceY;
uniform vec2 uBubbleSource;
uniform vec4 uRipples[MAX_RIPPLES];
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;

uniform vec3 uWaterColour;
uniform vec3 uExtinction;
uniform float uAmbient;
uniform vec3 uLightColour;
uniform vec3 uRoomColour;
uniform vec3 uSkyColour;
uniform float uShaftStrength;
uniform vec3 uSpots[3];

varying vec3 vWorld;
varying float vTop;

__WAVES__
${CAUSTIC_GLSL}

vec3 surfaceNormal(vec2 p) {
    float e = 0.004;
    float dx = waveHeight(p + vec2(e, 0.0)) - waveHeight(p - vec2(e, 0.0));
    float dz = waveHeight(p + vec2(0.0, e)) - waveHeight(p - vec2(0.0, e));
    // Fine capillary ripples that are too small for the mesh.
    float t = uTime;
    dx += cos(p.x * 55.0 + p.y * 20.0 + t * 4.0) * 0.0009;
    dz += cos(p.y * 60.0 - p.x * 25.0 + t * 3.6) * 0.0009;

    return normalize(vec3(-dx / (2.0 * e), 1.0, -dz / (2.0 * e)));
}

float sceneViewZ(vec2 uv) {
    return perspectiveDepthToViewZ(texture2D(uDepth, uv).x, uNear, uFar);
}

vec2 toScreen(vec3 world) {
    vec4 clip = uViewProjection * vec4(world, 1.0);

    return clip.xy / clip.w * 0.5 + 0.5;
}

vec2 clampUv(vec2 uv) {
    return clamp(uv, vec2(0.001), vec2(0.999));
}

/** Soft, slowly drifting light pattern for the shafts (cheaper than the cells). */
float shaftPattern(vec2 p, float t) {
    float a = sin(p.x * 7.0 + sin(p.y * 5.0 + t * 0.7) * 1.5 + t * 0.4);
    float b = sin(p.y * 6.0 + sin(p.x * 4.0 - t * 0.6) * 1.5 - t * 0.5);
    float c = sin((p.x - p.y) * 9.0 + t * 0.9);

    return pow(max(0.0, (a + b + c) / 3.0 + 0.25), 3.0);
}

/** How much of the lamps' cones reaches a point. */
float spotCover(vec3 p) {
    float cover = 0.25;

    for (int i = 0; i < 3; i++) {
        vec3 toPoint = normalize(p - uSpots[i]);
        cover += smoothstep(0.73, 0.93, -toPoint.y);
    }

    return min(cover, 1.4);
}

float interleavedNoise(vec2 pixel) {
    return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec3 rayDir = normalize(vWorld - cameraPosition);
    float entryDist = distance(vWorld, cameraPosition);
    float fragViewZ = (viewMatrix * vec4(vWorld, 1.0)).z;

    // Where the ray leaves the water box, and where it hits the scene.
    vec3 safeDir = sign(rayDir) * max(abs(rayDir), vec3(1e-5));
    vec3 t0 = (uBoxMin - cameraPosition) / safeDir;
    vec3 t1 = (uBoxMax - cameraPosition) / safeDir;
    vec3 tFar = max(t0, t1);
    float exitDist = min(min(tFar.x, tFar.y), tFar.z);
    float sceneDist = entryDist * sceneViewZ(uv) / fragViewZ;
    float pathLength = max(min(sceneDist, exitDist) - entryDist, 0.0);

    // Refraction. The flat faces' own bend is left out (in screen space it
    // shears the view at every edge); what shows is how the moving surface
    // wobbles the refracted ray away from that.
    vec3 flatNormal = vec3(0.0, 1.0, 0.0);
    vec3 normal;

    if (vTop > 0.5) {
        normal = surfaceNormal(vWorld.xz);
    } else {
        // The glass is flat; a faint shimmer hints at moving water behind it.
        vec2 q = vWorld.xy * 14.0 + vWorld.zz * 9.0;
        vec3 halfSize = (uBoxMax - uBoxMin) * 0.5;
        vec3 fromCentre = (vWorld - (uBoxMin + uBoxMax) * 0.5) / halfSize;
        vec3 faceNormal = abs(fromCentre.z) > abs(fromCentre.x)
            ? vec3(0.0, 0.0, sign(fromCentre.z))
            : vec3(sign(fromCentre.x), 0.0, 0.0);
        flatNormal = faceNormal;
        normal = normalize(faceNormal + 0.02 * vec3(sin(q.x + uTime * 1.3), sin(q.y * 1.3 - uTime * 1.1), 0.0));
    }

    float reach = min(pathLength, 0.5);
    vec2 shift = toScreen(vWorld + refract(rayDir, normal, 1.0 / IOR) * reach)
        - toScreen(vWorld + refract(rayDir, flatNormal, 1.0 / IOR) * reach);
    vec2 refractedUv = clampUv(uv + clamp(shift, vec2(-0.03), vec2(0.03)));
    float seenViewZ = sceneViewZ(refractedUv);

    // Never pull in anything that sits in front of the water.
    if (seenViewZ > fragViewZ - 0.001) {
        refractedUv = uv;
        seenViewZ = sceneViewZ(uv);
    }

    vec3 behind = texture2D(uScene, refractedUv).rgb;

    // Fog by the depth of what is actually seen through the refraction.
    pathLength = max(min(entryDist * seenViewZ / fragViewZ, exitDist) - entryDist, 0.0);

    // Underside of the surface seen through the glass: total internal reflection.
    bool exitsThroughSurface = tFar.y <= min(tFar.x, tFar.z) && rayDir.y > 0.0;

    if (exitsThroughSurface && sceneDist >= exitDist - 0.002) {
        vec3 exitPoint = cameraPosition + rayDir * exitDist;
        vec3 under = -surfaceNormal(exitPoint.xz);
        float cosTheta = dot(-rayDir, under);
        float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
        float internal = smoothstep(1.0 / IOR - 0.08, 1.0 / IOR + 0.02, sinTheta);
        vec3 mirrored = reflect(rayDir, under);
        vec3 mirror = texture2D(uScene, clampUv(toScreen(exitPoint + mirrored * 0.35))).rgb;
        vec3 sheen = uWaterColour * uAmbient * 2.0 + uLightColour * 0.25 * shaftPattern(exitPoint.xz * 2.0, uTime);
        behind = mix(behind, mirror * 0.9 + sheen * 0.4, internal);
    }

    // Absorption and in-scattering along the path through the water.
    vec3 transmittance = exp(-uExtinction * pathLength);
    vec3 colour = behind * transmittance + uWaterColour * uAmbient * (1.0 - transmittance);

    // Volumetric caustics: march the path and gather light shafts from above.
    float jitter = interleavedNoise(gl_FragCoord.xy);
    float stepLength = pathLength / float(SHAFT_STEPS);
    vec3 shafts = vec3(0.0);

    for (int i = 0; i < SHAFT_STEPS; i++) {
        float d = entryDist + (float(i) + jitter) * stepLength;
        vec3 p = cameraPosition + rayDir * d;
        float below = max(uSurfaceY - p.y, 0.0);
        vec2 q = (p.xz + vec2(0.12, 0.08) * below) * 2.2;
        float light = shaftPattern(q, uTime * 0.8) * spotCover(p) * exp(-below * 1.4);
        vec3 toCamera = exp(-uExtinction * (d - entryDist));
        shafts += light * toCamera;
    }

    // Water scatters light mostly onwards, so shafts fade when looked down upon.
    float phase = mix(0.12, 1.0, smoothstep(-0.9, 0.3, rayDir.y));
    colour += shafts * stepLength * phase * uLightColour * uWaterColour * uShaftStrength;

    // Seen from above: Fresnel reflection of the room and lamp glints.
    if (vTop > 0.5 && rayDir.y < 0.0) {
        vec3 viewDir = -rayDir;
        float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(normal, viewDir), 0.0), 5.0);
        vec3 reflected = reflect(rayDir, normal);
        vec3 environment = mix(uRoomColour, uSkyColour, smoothstep(-0.1, 0.7, reflected.y));
        float glints = 0.0;

        for (int i = 0; i < 3; i++) {
            vec3 toLight = normalize(uSpots[i] - vWorld);
            vec3 halfway = normalize(toLight + viewDir);
            glints += pow(max(dot(normal, halfway), 0.0), 3000.0) * 4.0;
        }

        // Break each lamp's reflection into sparkles on the wavelets.
        glints *= 0.25 + causticCells(vWorld.xz * 40.0, uTime * 3.0);
        colour = mix(colour, environment, fresnel) + glints * uLightColour;
    }

    gl_FragColor = vec4(colour, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

/**
 * The water as one box with a custom shader. Each frame the rest of the scene
 * is rendered into an off-screen buffer (colour and depth); the water faces
 * then sample it to refract what lies behind them, absorb and scatter light
 * along the path through the water, march light shafts from the rippling
 * surface, and reflect the room (from above) or the tank itself (total
 * internal reflection from below).
 *
 * Mount this after the camera controls so its pass uses this frame's camera.
 */
export function WaterVolume({ water, isLit, world }: Props) {
    const mesh = useRef<Mesh>(null);
    const target = useSceneTarget();
    const preset = isLit ? DAY : NIGHT;
    const [box] = useState(waterBox);

    const algae = Math.min(1, water.algae / 100);
    const murk = Math.min(1, water.detritus / 4);

    const material = useMemo(
        () =>
            new ShaderMaterial({
                vertexShader: vertexShader.replace('__WAVES__', WAVE_GLSL),
                fragmentShader: fragmentShader.replace('__WAVES__', WAVE_GLSL),
                uniforms: {
                    uScene: { value: null },
                    uDepth: { value: null },
                    uResolution: { value: new Vector2(1, 1) },
                    uNear: { value: 0.1 },
                    uFar: { value: 1000 },
                    uViewProjection: { value: new Matrix4() },
                    uTime: sceneClock,
                    uSurfaceY: { value: TANK.waterLine },
                    uBubbleSource: {
                        value: new Vector2(airStone().x, airStone().z),
                    },
                    uRipples: {
                        value: Array.from(
                            { length: MAX_RIPPLES },
                            () => new Vector4(0, 0, 0, 0),
                        ),
                    },
                    uBoxMin: { value: box.min },
                    uBoxMax: { value: box.max },
                    uWaterColour: { value: new Color() },
                    uExtinction: { value: new Vector3() },
                    uAmbient: { value: 0 },
                    uLightColour: { value: new Color() },
                    uRoomColour: { value: new Color() },
                    uSkyColour: { value: new Color() },
                    uShaftStrength: { value: 0 },
                    uSpots: {
                        value: spotPositions().map(
                            (x) => new Vector3(x, hoodHeight(), 0),
                        ),
                    },
                },
            }),
        [box],
    );

    useEffect(() => () => material.dispose(), [material]);

    useEffect(() => {
        const uniforms = material.uniforms;
        const colour = CLEAN_WATER.clone()
            .lerp(GREEN_WATER, algae * 0.7)
            .lerp(MURKY_WATER, murk * 0.5);

        uniforms.uWaterColour.value.copy(colour);
        // Water absorbs the colours it does not show; algae and detritus cloud it.
        const haze = 0.1 + algae * 0.9 + murk * 1.1;
        uniforms.uExtinction.value.set(
            (1 - colour.r * 0.75) * 0.45 + haze,
            (1 - colour.g * 0.75) * 0.45 + haze,
            (1 - colour.b * 0.75) * 0.45 + haze,
        );
        uniforms.uAmbient.value = preset.ambient * (1 + murk * 0.6);
        uniforms.uLightColour.value.copy(preset.light);
        uniforms.uRoomColour.value.copy(preset.room);
        uniforms.uSkyColour.value.copy(preset.sky);
        uniforms.uShaftStrength.value = preset.shafts * (1 - murk * 0.5);

        causticUniforms.uCausticColour.value.copy(preset.causticTint);
        causticUniforms.uCausticStrength.value =
            preset.caustics * (1 - murk * 0.6) * (1 - algae * 0.4);
    }, [material, preset, algae, murk]);

    useFrame(({ gl, scene, camera }) => {
        const uniforms = material.uniforms;

        world.ripples.forEach((ripple, index) => {
            uniforms.uRipples.value[index].set(
                ripple.x,
                ripple.z,
                ripple.age,
                1 - ripple.age / RIPPLE_LIFETIME,
            );
        });

        for (let index = world.ripples.length; index < MAX_RIPPLES; index++) {
            uniforms.uRipples.value[index].set(0, 0, 0, 0);
        }

        if (mesh.current === null) {
            return;
        }

        mesh.current.visible = false;
        gl.setRenderTarget(target);
        gl.render(scene, camera);
        gl.setRenderTarget(null);
        mesh.current.visible = true;

        const perspective = camera as PerspectiveCamera;
        uniforms.uScene.value = target.texture;
        uniforms.uDepth.value = target.depthTexture;
        uniforms.uResolution.value.set(target.width, target.height);
        uniforms.uNear.value = perspective.near;
        uniforms.uFar.value = perspective.far;
        uniforms.uViewProjection.value.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse,
        );
    });

    return (
        <mesh
            ref={mesh}
            material={material}
            position={[0, WATER_FLOOR + box.height / 2, 0]}
            renderOrder={-1}
            raycast={() => null}
        >
            <boxGeometry
                args={[
                    box.max.x - box.min.x,
                    box.height,
                    box.max.z - box.min.z,
                    box.segments.x,
                    1,
                    box.segments.z,
                ]}
            />
        </mesh>
    );
}

/**
 * A drawing-buffer-sized, multisampled HDR render target with a depth
 * texture, for the water's view of the rest of the scene.
 */
function useSceneTarget(): WebGLRenderTarget {
    const size = useThree((state) => state.size);
    const dpr = useThree((state) => state.viewport.dpr);
    const target = useMemo(() => {
        const created = new WebGLRenderTarget(1, 1, {
            type: HalfFloatType,
            samples: 4,
        });
        created.depthTexture = new DepthTexture(1, 1, FloatType);

        return created;
    }, []);

    useLayoutEffect(() => {
        target.setSize(
            Math.max(1, Math.floor(size.width * dpr)),
            Math.max(1, Math.floor(size.height * dpr)),
        );
    }, [target, size.width, size.height, dpr]);

    useEffect(() => () => target.dispose(), [target]);

    return target;
}
