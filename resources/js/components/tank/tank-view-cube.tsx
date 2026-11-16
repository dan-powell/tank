import { Edges } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasTexture, SRGBColorSpace, Vector3 } from 'three';
import type { Group, Quaternion } from 'three';
import { TANK } from '@/lib/tank/space';
import { TANK_VIEW_NAMES, TANK_VIEWS, viewRank } from '@/lib/tank/views';
import type { TankView } from '@/lib/tank/views';
import { cn } from '@/lib/utils';

type Props = {
    /** The main camera's orientation, kept up to date by the camera rig. */
    orientation: Quaternion;
    onSelectView: (view: TankView) => void;
    className?: string;
};

/** The cuboid's longest side, in the cube scene's units. */
const CUBE_SIZE = 1.6;

/**
 * The shortest any side may be, as a share of the longest, so a very tall,
 * long or thin tank still gives faces big enough to read and click.
 */
const MIN_CUBE_SIDE = 0.55;

/** How far the edge and corner dots sit out from the cuboid's surface. */
const DOT_OFFSET = 0.06;

const DOT_RADIUS = 0.11;

const DOT_HOVER_SCALE = 1.4;

/** Texture pixels per cube-scene unit for the face labels. */
const LABEL_RESOLUTION = 160;

/** BoxGeometry face order: +x, -x, +y, -y, +z, -z. The bottom can't be picked. */
const FACE_VIEWS: (TankView | null)[] = [
    'right',
    'left',
    'top',
    null,
    'front',
    'back',
];

const FACE_LABELS = ['RIGHT', 'LEFT', 'TOP', '', 'FRONT', 'BACK'];

/** The edge and corner views, shown as dots. */
const DOT_VIEWS = TANK_VIEW_NAMES.filter((view) => viewRank(view) > 1);

type Palette = {
    face: string;
    bottom: string;
    label: string;
    hover: string;
    hoverLabel: string;
    line: string;
};

/**
 * The cuboid's side lengths: the tank's own proportions, softened and with
 * no side shorter than MIN_CUBE_SIDE of the longest, so it stays clickable
 * however extreme the tank. Scaled so the longest side is CUBE_SIZE.
 */
export function cubeProportions(
    width: number,
    height: number,
    depth: number,
): [number, number, number] {
    const longest = Math.max(width, height, depth, 1e-6);
    const side = (length: number) =>
        CUBE_SIZE * Math.max(MIN_CUBE_SIDE, Math.sqrt(length / longest));

    return [side(width), side(height), side(depth)];
}

/**
 * A small cuboid shaped (roughly) like the tank, turning with the camera.
 * Clicking a face swings the camera round to look square-on at that side of
 * the tank; the dots on its edges and top corners give 45° views.
 */
export function TankViewCube({ orientation, onSelectView, className }: Props) {
    const [hovered, setHovered] = useState<TankView | null>(null);

    return (
        <div
            role="group"
            aria-label="View cube"
            className={cn(
                'size-28',
                hovered !== null && 'cursor-pointer',
                className,
            )}
        >
            <Canvas
                orthographic
                camera={{ position: [0, 0, 10], zoom: 30 }}
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: true }}
            >
                <CubeScene
                    orientation={orientation}
                    hovered={hovered}
                    onHover={setHovered}
                    onSelectView={onSelectView}
                />
            </Canvas>
        </div>
    );
}

type SceneProps = {
    orientation: Quaternion;
    hovered: TankView | null;
    onHover: (update: (current: TankView | null) => TankView | null) => void;
    onSelectView: (view: TankView) => void;
};

function CubeScene({
    orientation,
    hovered,
    onHover,
    onSelectView,
}: SceneProps) {
    const group = useRef<Group>(null);
    const palette = useThemePalette();
    const [width, height, depth] = useMemo(
        () => cubeProportions(TANK.width, TANK.height, TANK.depth),
        [],
    );
    const half = useMemo(
        () => new Vector3(width / 2, height / 2, depth / 2),
        [width, height, depth],
    );
    const faces = useFaceTextures(width, height, depth, palette);
    const camera = useThree((state) => state.camera);
    const size = useThree((state) => state.size);

    // Fit the cuboid and its dots in the canvas at any orientation.
    useEffect(() => {
        const radius =
            half.length() + DOT_OFFSET + DOT_RADIUS * DOT_HOVER_SCALE;

        camera.zoom = Math.min(size.width, size.height) / 2 / (radius * 1.04);
        camera.updateProjectionMatrix();
    }, [camera, size, half]);

    useFrame(() => {
        group.current?.quaternion.copy(orientation).invert();
    });

    const faceView = (event: ThreeEvent<PointerEvent | MouseEvent>) =>
        FACE_VIEWS[event.face?.materialIndex ?? 3] ?? null;

    return (
        <group ref={group}>
            <mesh
                onPointerMove={(event) => {
                    event.stopPropagation();
                    const view = faceView(event);
                    onHover(() => view);
                }}
                onPointerOut={() =>
                    onHover((current) =>
                        current !== null && viewRank(current) === 1
                            ? null
                            : current,
                    )
                }
                onClick={(event) => {
                    event.stopPropagation();
                    const view = faceView(event);

                    if (view !== null) {
                        onSelectView(view);
                    }
                }}
            >
                <boxGeometry args={[width, height, depth]} />
                {faces.map((face, index) => (
                    <meshBasicMaterial
                        key={index}
                        attach={`material-${index}`}
                        map={
                            FACE_VIEWS[index] !== null &&
                            FACE_VIEWS[index] === hovered
                                ? face.hover
                                : face.normal
                        }
                    />
                ))}
                <Edges color={palette.line} />
            </mesh>
            {DOT_VIEWS.map((view) => {
                const isHovered = hovered === view;
                const [x, y, z] = TANK_VIEWS[view];

                return (
                    <mesh
                        key={view}
                        position={[
                            x * (half.x + DOT_OFFSET),
                            y * (half.y + DOT_OFFSET),
                            z * (half.z + DOT_OFFSET),
                        ]}
                        scale={isHovered ? DOT_HOVER_SCALE : 1}
                        onPointerMove={(event) => {
                            event.stopPropagation();
                            onHover(() => view);
                        }}
                        onPointerOut={() =>
                            onHover((current) =>
                                current === view ? null : current,
                            )
                        }
                        onClick={(event) => {
                            event.stopPropagation();
                            onSelectView(view);
                        }}
                    >
                        <sphereGeometry args={[DOT_RADIUS, 16, 12]} />
                        <meshBasicMaterial
                            color={isHovered ? palette.hover : palette.line}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}

type FaceTextures = { normal: CanvasTexture; hover: CanvasTexture };

/** A labelled texture for each face, plus a highlighted one for hovering. */
function useFaceTextures(
    width: number,
    height: number,
    depth: number,
    palette: Palette,
): FaceTextures[] {
    const faces = useMemo(() => {
        // Each face's size across (u) and up (v), in BoxGeometry face order.
        const sizes: [number, number][] = [
            [depth, height],
            [depth, height],
            [width, depth],
            [width, depth],
            [width, height],
            [width, height],
        ];

        return sizes.map(([across, up], index) => {
            const isBottom = FACE_VIEWS[index] === null;
            const background = isBottom ? palette.bottom : palette.face;

            return {
                normal: labelTexture(
                    FACE_LABELS[index],
                    across,
                    up,
                    background,
                    palette.label,
                ),
                hover: labelTexture(
                    FACE_LABELS[index],
                    across,
                    up,
                    palette.hover,
                    palette.hoverLabel,
                ),
            };
        });
    }, [width, height, depth, palette]);

    useEffect(
        () => () => {
            faces.forEach((face) => {
                face.normal.dispose();
                face.hover.dispose();
            });
        },
        [faces],
    );

    return faces;
}

function labelTexture(
    label: string,
    across: number,
    up: number,
    background: string,
    foreground: string,
): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(across * LABEL_RESOLUTION);
    canvas.height = Math.round(up * LABEL_RESOLUTION);
    const context = canvas.getContext('2d');

    if (context !== null) {
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);

        if (label !== '') {
            let fontSize = canvas.height * 0.3;
            const font = (size: number) =>
                `600 ${size}px "Source Sans 3 Variable", sans-serif`;
            context.font = font(fontSize);
            const fitWidth = canvas.width * 0.86;
            const measured = context.measureText(label).width;

            if (measured > fitWidth) {
                fontSize *= fitWidth / measured;
                context.font = font(fontSize);
            }

            context.fillStyle = foreground;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(label, canvas.width / 2, canvas.height / 2);
        }
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;

    return texture;
}

/** The HUD's theme colours as hex strings, updated when light/dark mode changes. */
function useThemePalette(): Palette {
    const [palette, setPalette] = useState(readPalette);

    useEffect(() => {
        const observer = new MutationObserver(() => setPalette(readPalette()));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'style'],
        });

        return () => observer.disconnect();
    }, []);

    return palette;
}

function readPalette(): Palette {
    return {
        face: cssColor('--sidebar', '#fafafa'),
        bottom: cssColor('--sidebar-accent', '#f2f2f2'),
        label: cssColor('--sidebar-foreground', '#1a1a1a'),
        hover: cssColor('--primary', '#0f766e'),
        hoverLabel: cssColor('--primary-foreground', '#f0fdfa'),
        line: cssColor('--sidebar-ring', '#a3a3a3'),
    };
}

/**
 * Resolve a CSS colour variable (which may be oklch) to a hex string that
 * both canvas and three's Color understand, by painting it on a 1px canvas.
 */
function cssColor(variable: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(variable)
        .trim();
    const context = document
        .createElement('canvas')
        .getContext('2d', { willReadFrequently: true });

    if (value === '' || context === null) {
        return fallback;
    }

    context.fillStyle = fallback;
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;

    return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
