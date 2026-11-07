import { useEffect, useMemo } from 'react';
import {
    AdditiveBlending,
    InstancedBufferAttribute,
    ShaderMaterial,
    Color,
    SphereGeometry,
    Vector3,
} from 'three';
import { TANK } from '@/lib/tank/space';
import { createCausticMaterial } from './caustics';
import { sceneClock } from './scene-clock';

/** Where the air stone sits on the substrate (world x/z, back left). */
export const AIR_STONE = {
    x: -TANK.width * 0.36,
    z: -TANK.depth / 2 + 0.09,
} as const;

const BUBBLE_COUNT = 70;

/** Radius (world units) of the largest bubbles as they leave the stone. */
const BUBBLE_RADIUS = 0.009;

const vertexShader = /* glsl */ `
attribute vec4 aBubble; // x: start phase, y: rise speed, z: size, w: seed

uniform float uTime;
uniform vec3 uSource;
uniform float uTop;

varying vec3 vViewNormal;
varying vec3 vViewPosition;
varying float vFade;

void main() {
    float height = uTop - uSource.y;
    float rise = fract(aBubble.x + uTime * aBubble.y / height);
    float seed = aBubble.w;
    float wobble = uTime * (5.0 + seed * 4.0) + seed * 40.0;

    // Bubbles fan out a little as they rise and wobble from side to side.
    vec2 drift = vec2(cos(seed * 6.2831), sin(seed * 6.2831)) * rise * 0.05;
    vec3 centre = uSource + vec3(
        drift.x + sin(wobble) * 0.006 * (0.3 + rise),
        rise * height,
        drift.y + cos(wobble * 1.3) * 0.006 * (0.3 + rise)
    );

    // Grow from the stone, expand as pressure drops, and pop at the surface.
    float size = aBubble.z * (0.6 + 0.6 * rise)
        * smoothstep(0.0, 0.03, rise)
        * (1.0 - smoothstep(0.97, 1.0, rise));
    vec3 local = position * size * vec3(1.0 + 0.15 * sin(wobble * 2.0), 0.85, 1.0);

    vec4 view = viewMatrix * vec4(centre + local, 1.0);
    vViewPosition = view.xyz;
    vViewNormal = normalize(mat3(viewMatrix) * normal);
    vFade = size > 0.0 ? 1.0 : 0.0;
    gl_Position = projectionMatrix * view;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uLightColour;
uniform float uBrightness;

varying vec3 vViewNormal;
varying vec3 vViewPosition;
varying float vFade;

void main() {
    vec3 normal = normalize(vViewNormal);
    vec3 viewDir = normalize(-vViewPosition);
    float facing = abs(dot(normal, viewDir));

    // A thin bright rim, a dark-ish clear centre, and a highlight from above.
    float rim = pow(1.0 - facing, 2.5);
    vec3 lightDir = normalize(vec3(-0.3, 0.9, 0.4));
    float highlight = pow(max(dot(normal, normalize(lightDir + viewDir)), 0.0), 60.0);
    float glint = pow(max(dot(normal, normalize(vec3(0.4, -0.6, 0.7) + viewDir)), 0.0), 25.0) * 0.3;

    vec3 colour = uLightColour * uBrightness * (rim * 0.9 + highlight * 2.5 + glint);
    float alpha = clamp(rim * 0.85 + highlight + 0.04, 0.0, 1.0) * vFade;

    gl_FragColor = vec4(colour, alpha);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

type Props = {
    isLit: boolean;
};

/**
 * An air stone on the substrate with a stream of rising bubbles. All motion
 * runs in the vertex shader from per-bubble constants, so there is no
 * per-frame CPU work.
 */
export function Bubbles({ isLit }: Props) {
    const geometry = useMemo(() => {
        const sphere = new SphereGeometry(1, 12, 8);
        const bubbles = new Float32Array(BUBBLE_COUNT * 4);

        for (let index = 0; index < BUBBLE_COUNT; index++) {
            const seed = pseudoRandom(index + 1);
            bubbles.set(
                [
                    pseudoRandom(index * 3.7 + 0.5),
                    0.45 + pseudoRandom(index * 5.3) * 0.4,
                    BUBBLE_RADIUS * (0.35 + Math.pow(seed, 2) * 0.65),
                    seed,
                ],
                index * 4,
            );
        }

        sphere.setAttribute(
            'aBubble',
            new InstancedBufferAttribute(bubbles, 4),
        );

        return sphere;
    }, []);

    const material = useMemo(
        () =>
            new ShaderMaterial({
                vertexShader,
                fragmentShader,
                transparent: true,
                depthWrite: false,
                blending: AdditiveBlending,
                uniforms: {
                    uTime: sceneClock,
                    uSource: {
                        value: new Vector3(
                            AIR_STONE.x,
                            TANK.substrate + 0.025,
                            AIR_STONE.z,
                        ),
                    },
                    uTop: { value: TANK.waterLine },
                    uLightColour: { value: new Color('#e8f6ff') },
                    uBrightness: { value: 1 },
                },
            }),
        [],
    );

    const stoneMaterial = useMemo(
        () => createCausticMaterial(new Color('#5d6670'), 0.95),
        [],
    );

    useEffect(() => {
        material.uniforms.uBrightness.value = isLit ? 1 : 0.45;
    }, [material, isLit]);

    useEffect(
        () => () => {
            geometry.dispose();
            material.dispose();
            stoneMaterial.dispose();
        },
        [geometry, material, stoneMaterial],
    );

    const tubeHeight = TANK.height + 0.05 - TANK.substrate;

    return (
        <group>
            {/* Air stone */}
            <mesh
                position={[AIR_STONE.x, TANK.substrate + 0.012, AIR_STONE.z]}
                material={stoneMaterial}
                raycast={() => null}
            >
                <cylinderGeometry args={[0.035, 0.04, 0.03, 20]} />
            </mesh>
            {/* Airline up the back glass */}
            <mesh
                position={[
                    AIR_STONE.x,
                    TANK.substrate + tubeHeight / 2,
                    -TANK.depth / 2 + 0.02,
                ]}
                raycast={() => null}
            >
                <cylinderGeometry args={[0.006, 0.006, tubeHeight, 8]} />
                <meshStandardMaterial
                    color="#9fb7a8"
                    roughness={0.3}
                    transparent
                    opacity={0.7}
                />
            </mesh>
            <mesh
                position={[
                    AIR_STONE.x,
                    TANK.substrate + 0.012,
                    (AIR_STONE.z - TANK.depth / 2 + 0.02) / 2,
                ]}
                rotation={[Math.PI / 2, 0, 0]}
                raycast={() => null}
            >
                <cylinderGeometry
                    args={[
                        0.006,
                        0.006,
                        AIR_STONE.z + TANK.depth / 2 - 0.02,
                        8,
                    ]}
                />
                <meshStandardMaterial color="#9fb7a8" roughness={0.3} />
            </mesh>

            <instancedMesh
                args={[geometry, material, BUBBLE_COUNT]}
                frustumCulled={false}
                raycast={() => null}
            />
        </group>
    );
}

/** Deterministic 0..1 noise so the bubble stream is the same on every load. */
function pseudoRandom(seed: number): number {
    const value = Math.sin(seed * 12.9898) * 43758.5453;

    return value - Math.floor(value);
}
