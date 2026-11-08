import {
    BufferGeometry,
    Color,
    DoubleSide,
    MeshBasicMaterial,
    Vector2,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { applySway } from './sway-material';

/**
 * The canvas size in CSS pixels, shared by every halo material so the halo
 * keeps the same on-screen width at any zoom. Kept up to date by the scene.
 */
export const haloUniforms = {
    uHaloResolution: { value: new Vector2(1, 1) },
};

/**
 * Render order for a selection halo and for the selected mesh itself. The
 * halo is drawn after the rest of the scene without writing depth, then the
 * selected mesh is drawn over it, covering everything inside its silhouette.
 * Only the rim around the outside is left, whatever the viewing angle.
 */
export const HALO_RENDER_ORDER = 1;
export const SELECTED_RENDER_ORDER = 2;

const haloGeometries = new WeakMap<BufferGeometry, BufferGeometry>();

/**
 * A copy of a voxel geometry with shared vertices and smoothed normals. Flat
 * voxel normals would split apart at every corner when pushed outwards; the
 * averaged ones grow the shape evenly in all directions.
 */
export function haloGeometry(geometry: BufferGeometry): BufferGeometry {
    let halo = haloGeometries.get(geometry);

    if (halo === undefined) {
        const positions = new BufferGeometry();
        positions.setAttribute('position', geometry.getAttribute('position'));
        positions.setIndex(geometry.getIndex());
        halo = mergeVertices(positions, 1e-4);
        halo.computeVertexNormals();
        haloGeometries.set(geometry, halo);
    }

    return halo;
}

type HaloOptions = {
    color?: Color;
    /** Halo width in CSS pixels. */
    pixels?: number;
    /** Match a plant's sway so the halo moves with it. */
    sway?: { amplitude: number; unitHeight: number };
};

/**
 * An unlit material that draws a {@link haloGeometry} grown outwards in
 * screen space by a fixed number of pixels. Pair it with
 * {@link HALO_RENDER_ORDER} and draw the real mesh at
 * {@link SELECTED_RENDER_ORDER}.
 */
export function createHaloMaterial({
    color = new Color('#fff1b8'),
    pixels = 2.5,
    sway,
}: HaloOptions = {}): MeshBasicMaterial {
    const material = new MeshBasicMaterial({
        color,
        side: DoubleSide,
        depthWrite: false,
    });

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uHaloResolution = haloUniforms.uHaloResolution;

        if (sway !== undefined) {
            applySway(shader, sway.amplitude, sway.unitHeight);
        }

        shader.vertexShader =
            `uniform vec2 uHaloResolution;\n${shader.vertexShader}`.replace(
                '#include <project_vertex>',
                `#include <project_vertex>
            vec4 haloClipNormal = projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0);
            vec2 haloDirection = haloClipNormal.xy * uHaloResolution;

            if (length(haloDirection) > 1e-5) {
                gl_Position.xy += normalize(haloDirection) * ${pixels.toFixed(1)} * 2.0
                    / uHaloResolution * gl_Position.w;
            }`,
            );
    };
    material.customProgramCacheKey = () =>
        sway === undefined
            ? `halo-${pixels}`
            : `halo-${pixels}-sway-${sway.amplitude.toFixed(3)}`;

    return material;
}
