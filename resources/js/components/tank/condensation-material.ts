import { Color, DoubleSide, MeshPhysicalMaterial, Vector2 } from 'three';
import { sceneClock } from './scene-clock';

/** How condensed the glass is (0..1), and how far it has faded in (0..1). */
export type CondensationUniforms = {
    uMist: { value: number };
    uFade: { value: number };
};

export function createCondensationUniforms(): CondensationUniforms {
    return { uMist: { value: 0 }, uFade: { value: 0 } };
}

/** How far light travels through a drop (world units): how strongly it bends what's behind. */
const DROP_THICKNESS = 0.02;

/** How steeply a drop's surface curves away towards its edge. */
const DROP_CURVE = 0.6;

const DROPS_GLSL = /* glsl */ `
uniform float uTime;
uniform float uMist;
uniform float uFade;
uniform float uRunning;
uniform float uSeed;
uniform vec2 uSize;
varying vec2 vPlane;
varying vec3 vDropAxisX;
varying vec3 vDropAxisY;

float dropHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21) + uSeed);
    p += dot(p, p + 45.32);

    return fract(p.x * p.y);
}

/**
 * One drop of radius r at offset d (world units) from its centre, sagging a
 * little at the bottom. Where it covers more than what is already there, it
 * sets the coverage and the slope of its domed surface (outwards at the rim).
 */
void addDrop(vec2 d, float r, float pixel, inout float cover, inout vec2 slope) {
    d.y *= d.y < 0.0 ? 0.8 : 1.0;
    vec2 q = d / r;
    float n = length(q);

    if (n > 1.2) {
        return;
    }

    float aa = pixel * 1.5 / r;
    // Drops smaller than a pixel would only shimmer: let them fade away.
    float inside = (1.0 - smoothstep(1.0 - aa, 1.0, n)) * smoothstep(pixel * 0.7, pixel * 2.0, r);

    if (inside > cover) {
        cover = inside;
        slope = q * inversesqrt(max(1.0 - n * n, 0.08));
    }
}

/** Beads scattered on a grid of cells, more of them (and bigger) as the glass mists up. */
void addBeads(float cell, float chance, float minR, float maxR, float salt, float pixel,
    float wiped, inout float cover, inout vec2 slope) {
    vec2 here = floor(vPlane / cell);

    for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
            vec2 id = here + vec2(float(i), float(j));

            if (dropHash(id + salt) > chance) {
                continue;
            }

            vec2 centre = (id + 0.25 + 0.5 * vec2(dropHash(id + salt + 7.1), dropHash(id + salt + 3.3))) * cell;
            float r = mix(minR, maxR, dropHash(id + salt + 1.9)) * cell * (0.6 + 0.4 * uMist);
            float beadCover = 0.0;
            vec2 beadSlope = vec2(0.0);
            addDrop(vPlane - centre, r, pixel, beadCover, beadSlope);
            beadCover *= 1.0 - wiped;

            if (beadCover > cover) {
                cover = beadCover;
                slope = beadSlope;
            }
        }
    }
}

/** How much of the glass here is under water, and the slope of that water's surface. */
void condensation(float pixel, out float cover, out vec2 slope) {
    cover = 0.0;
    slope = vec2(0.0);
    float wiped = 0.0;

    // Heavy condensation gathers into drops that run down, wiping a path.
    if (uRunning > 0.5) {
        float columnWidth = 0.08;
        float column = floor(vPlane.x / columnWidth);
        float runChance = 0.35 * smoothstep(0.4, 1.0, uMist);

        if (dropHash(vec2(column, 3.7)) < runChance) {
            float r = mix(0.009, 0.014, dropHash(vec2(column, 5.1)));
            float speed = mix(0.025, 0.06, dropHash(vec2(column, 8.4)));
            float fall = uSize.y + 0.04;
            float travel = fall / speed;
            float period = travel * mix(1.6, 3.0, dropHash(vec2(column, 9.2)));
            float since = mod(uTime + dropHash(vec2(column, 2.6)) * 97.0, period);
            float progress = min(since / travel, 1.0);
            // Stop-start, as a real drop catches and lets go.
            progress += 0.02 * sin(progress * 40.0 + column);
            float headY = uSize.y + 0.02 - fall * progress;
            float x = (column + 0.25 + 0.5 * dropHash(vec2(column, 1.3))) * columnWidth
                + 0.004 * sin(vPlane.y * 60.0 + column);
            float above = vPlane.y - headY;
            float across = vPlane.x - x;
            float fade = 1.0 - smoothstep(travel, period, since);

            if (since < travel) {
                addDrop(vec2(across, above), r, pixel, cover, slope);
            }

            if (above > 0.0) {
                // A thin film left behind, rounded across its width.
                float width = r * 0.35;
                float film = (1.0 - smoothstep(width * 0.6, width, abs(across)))
                    * fade * (1.0 - 0.6 * clamp(above / 0.2, 0.0, 1.0));

                if (film > cover) {
                    cover = film;
                    slope = vec2(across / width * 0.5, 0.0);
                }

                wiped = (1.0 - smoothstep(r * 0.9, r * 1.4, abs(across))) * fade;

                // Droplets left behind in the trail.
                float stretch = 0.025;
                float slot = floor(vPlane.y / stretch);

                if (dropHash(vec2(column, slot)) < 0.35 && slot * stretch > headY) {
                    addDrop(vPlane - vec2(x, (slot + 0.5) * stretch), r * 0.3, pixel, cover, slope);
                }
            }
        }
    }

    addBeads(0.045, uMist * 0.55, 0.15, 0.28, 11.0, pixel, wiped, cover, slope);
}
`;

/**
 * Condensation on a pane of glass `size` wide and tall (world units): only
 * the water shows, as lenses that bend the view behind them and catch the
 * lights. Clear glass between the drops is left untouched. Beads gather as
 * the glass mists up, and on walls (`running`) bigger drops run down,
 * leaving a thin trail wiped clear of beads.
 */
export function createCondensationMaterial(
    uniforms: CondensationUniforms,
    size: Vector2,
    { running, seed }: { running: boolean; seed: number },
): MeshPhysicalMaterial {
    const material = new MeshPhysicalMaterial({
        color: new Color('#ffffff'),
        metalness: 0,
        roughness: 0.04,
        transmission: 1,
        ior: 1.33,
        thickness: DROP_THICKNESS,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
    });

    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms, {
            uTime: sceneClock,
            uSize: { value: size },
            uRunning: { value: running ? 1 : 0 },
            uSeed: { value: seed },
        });

        shader.vertexShader = `uniform vec2 uSize;
varying vec2 vPlane;
varying vec3 vDropAxisX;
varying vec3 vDropAxisY;
${shader.vertexShader}`.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
        vPlane = uv * uSize;
        vDropAxisX = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
        vDropAxisY = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));`,
        );

        shader.fragmentShader = `${DROPS_GLSL}
${shader.fragmentShader}`
            .replace(
                'void main() {',
                `void main() {
        float dropPixel = length(fwidth(vPlane));
        float dropCover;
        vec2 dropSlope;
        condensation(dropPixel, dropCover, dropSlope);`,
            )
            .replace(
                '#include <normal_fragment_maps>',
                `#include <normal_fragment_maps>
        diffuseColor.a *= dropCover * uFade * smoothstep(0.0, 0.15, uMist);

        if (diffuseColor.a < 0.003) {
            discard;
        }

        normal = normalize(normal + (vDropAxisX * dropSlope.x + vDropAxisY * dropSlope.y) * ${DROP_CURVE.toFixed(2)});`,
            );
    };
    material.customProgramCacheKey = () => 'condensation';

    return material;
}
