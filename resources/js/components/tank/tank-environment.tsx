import { Edges } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { DoubleSide, Object3D, Vector2, Vector3 } from 'three';
import type {
    Group,
    InstancedMesh,
    Line,
    Mesh,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
} from 'three';
import {
    easeOutBounce,
    easeOutCubic,
    introProgress,
    introStarted,
} from '@/lib/tank/intro';
import type { IntroPhase } from '@/lib/tank/intro';
import { TANK } from '@/lib/tank/space';
import type { Heightmap } from '@/lib/tank/substrate-heightmap';
import { substrateHeightAt } from '@/lib/tank/terrain-field';
import type { TankGrid, WaterParameters } from '@/types';
import { Bubbles } from './bubbles';
import {
    createCondensationMaterial,
    createCondensationUniforms,
} from './condensation-material';
import type { CondensationUniforms } from './condensation-material';
import { introUniforms } from './intro-material';
import { hiddenFromWater } from './water-volume';

type Props = {
    water: WaterParameters;
    isLit: boolean;
    grid: TankGrid;
    /** The substrate's heightmap, for litter lying on it. */
    substrate: Heightmap;
    /** False when the tank is empty: no bubbles from the air stone. */
    hasWater: boolean;
    /** A sealed tank gets a glass lid, and mists up as its air grows humid. */
    isSealed: boolean;
    /** Relative humidity of the air inside, %. */
    humidity: number;
    /** Outline the glass edges (hidden in the flat 2D view). */
    showEdges?: boolean;
};

export function TankEnvironment({
    water,
    isLit,
    grid,
    substrate,
    hasWater,
    isSealed,
    humidity,
    showEdges = true,
}: Props) {
    const algae = Math.min(1, water.algae / 100);
    // Condensation beads on the glass once sealed air nears saturation.
    const mist = isSealed ? Math.min(1, Math.max(0, (humidity - 80) / 18)) : 0;
    const algaeMaterial = useRef<MeshStandardMaterial>(null);
    const condensation = useMemo(() => createCondensationUniforms(), []);

    // The algae and mist arrive with what they grow on, not before.
    useFrame(() => {
        if (algaeMaterial.current !== null) {
            algaeMaterial.current.opacity =
                algae * 0.7 * introUniforms.landscape.value;
        }

        condensation.uMist.value = mist;
        condensation.uFade.value = introProgress('panels');
    });

    return (
        <group>
            <Detritus
                amount={water.detritus}
                grid={grid}
                substrate={substrate}
            />
            {hasWater && <Bubbles key={grid.water_level} isLit={isLit} />}

            {/* Algae film on the back and side glass */}
            {algae > 0.02 && (
                <mesh position={[0, TANK.height / 2, -TANK.depth / 2 + 0.002]}>
                    <planeGeometry args={[TANK.width, TANK.height]} />
                    <meshStandardMaterial
                        ref={algaeMaterial}
                        color="#4f7f2a"
                        transparent
                        opacity={0}
                        depthWrite={false}
                        side={DoubleSide}
                    />
                </mesh>
            )}

            {/* Glass: open at the top, so the lights shine straight in. */}
            <GlassPanels showEdges={showEdges} />

            {mist > 0.01 && (
                <Condensation
                    uniforms={condensation}
                    bottom={hasWater ? TANK.waterLine : 0}
                />
            )}

            {isSealed && (
                <Landing phase="gantry" height={TANK.height * 1.2}>
                    <mesh
                        position={[0, TANK.height + 0.004, 0]}
                        raycast={() => null}
                    >
                        <boxGeometry
                            args={[TANK.width + 0.02, 0.008, TANK.depth + 0.02]}
                        />
                        <meshPhysicalMaterial
                            color="#dff4ff"
                            transparent
                            opacity={0.18}
                            roughness={0.1}
                            depthWrite={false}
                        />
                        <Edges color="#a8c8d8" />
                    </mesh>
                </Landing>
            )}
        </group>
    );
}

/** How far inside the glass the condensation film sits. */
const CONDENSATION_INSET = 0.002;

/**
 * Condensation on the inside of a sealed tank: beads and running drops on
 * the glass walls above the water, and beads under the lid, seen only as
 * the way they bend the view and catch the light. Glass below the
 * waterline is wet, not misted, so the water and everything in it stays
 * clear.
 */
function Condensation({
    uniforms,
    bottom,
}: {
    uniforms: CondensationUniforms;
    /** Where the misted glass starts: the water surface, or the floor when dry. */
    bottom: number;
}) {
    const top = TANK.height - CONDENSATION_INSET;
    const gap = top - bottom;
    const middle = bottom + gap / 2;
    const halfWidth = TANK.width / 2 - CONDENSATION_INSET;
    const halfDepth = TANK.depth / 2 - CONDENSATION_INSET;
    const panes = useMemo(() => {
        const wall = (
            position: [number, number, number],
            rotation: number,
            width: number,
            seed: number,
        ) => {
            const size = new Vector2(width, gap);

            return {
                position,
                rotation: [0, rotation, 0] as [number, number, number],
                size,
                material: createCondensationMaterial(uniforms, size, {
                    running: true,
                    seed,
                }),
            };
        };
        const walls =
            gap > 0.004
                ? [
                      wall([0, middle, -halfDepth], 0, halfWidth * 2, 0.11),
                      wall([0, middle, halfDepth], 0, halfWidth * 2, 0.37),
                      wall(
                          [-halfWidth, middle, 0],
                          Math.PI / 2,
                          halfDepth * 2,
                          0.59,
                      ),
                      wall(
                          [halfWidth, middle, 0],
                          Math.PI / 2,
                          halfDepth * 2,
                          0.83,
                      ),
                  ]
                : [];
        const lidSize = new Vector2(halfWidth * 2, halfDepth * 2);

        return [
            ...walls,
            {
                position: [0, top, 0] as [number, number, number],
                rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
                size: lidSize,
                material: createCondensationMaterial(uniforms, lidSize, {
                    running: false,
                    seed: 0.97,
                }),
            },
        ];
    }, [uniforms, gap, middle, top, halfWidth, halfDepth]);

    useEffect(
        () => () => panes.forEach((pane) => pane.material.dispose()),
        [panes],
    );

    const group = useRef<Group>(null);

    useEffect(() => {
        const object = group.current;

        if (object === null) {
            return;
        }

        hiddenFromWater.add(object);

        return () => {
            hiddenFromWater.delete(object);
        };
    }, []);

    return (
        <group ref={group}>
            {panes.map((pane, index) => (
                <mesh
                    key={index}
                    position={pane.position}
                    rotation={pane.rotation}
                    material={pane.material}
                    raycast={() => null}
                >
                    <planeGeometry args={[pane.size.x, pane.size.y]} />
                </mesh>
            ))}
        </group>
    );
}

/** How far (in tank widths) each glass panel starts from where it ends up. */
const PANEL_FLIGHT = 1.2;

/** Glass opacity once in place. */
const GLASS_OPACITY = 0.06;

type Panel = {
    /** Where its centre ends up. */
    position: [number, number, number];
    /** Turns the pane to face outwards (seen from outside only, as glass was before). */
    rotation: [number, number, number];
    size: [number, number];
    /** The way it flies in from (it travels against this). */
    from: [number, number, number];
    /** Seconds after the first panel that it sets off. */
    delay: number;
};

/**
 * The five panes of the tank: floor, back, sides and front. They fly in
 * from their own sides and meet, the floor first and the front last.
 */
function GlassPanels({ showEdges }: { showEdges: boolean }) {
    const { width, height, depth } = TANK;
    const panels = useMemo<Panel[]>(
        () => [
            {
                position: [0, 0, 0],
                rotation: [Math.PI / 2, 0, 0],
                size: [width, depth],
                from: [0, -1, 0],
                delay: 0,
            },
            {
                position: [0, height / 2, -depth / 2],
                rotation: [0, Math.PI, 0],
                size: [width, height],
                from: [0, 0, -1],
                delay: 0.075,
            },
            {
                position: [-width / 2, height / 2, 0],
                rotation: [0, -Math.PI / 2, 0],
                size: [depth, height],
                from: [-1, 0, 0],
                delay: 0.125,
            },
            {
                position: [width / 2, height / 2, 0],
                rotation: [0, Math.PI / 2, 0],
                size: [depth, height],
                from: [1, 0, 0],
                delay: 0.125,
            },
            {
                position: [0, height / 2, depth / 2],
                rotation: [0, 0, 0],
                size: [width, height],
                from: [0, 0, 1],
                delay: 0.2,
            },
        ],
        [width, height, depth],
    );

    return (
        <group>
            {panels.map((panel, index) => (
                <GlassPanel key={index} panel={panel} showEdges={showEdges} />
            ))}
        </group>
    );
}

function GlassPanel({
    panel,
    showEdges,
}: {
    panel: Panel;
    showEdges: boolean;
}) {
    const mesh = useRef<Mesh>(null);
    const material = useRef<MeshPhysicalMaterial>(null);
    const rest = useMemo(() => new Vector3(...panel.position), [panel]);
    const from = useMemo(
        () =>
            new Vector3(...panel.from).multiplyScalar(
                TANK.width * PANEL_FLIGHT,
            ),
        [panel],
    );

    useFrame(() => {
        if (mesh.current === null || material.current === null) {
            return;
        }

        const progress = easeOutCubic(introProgress('panels', panel.delay));

        mesh.current.visible = !introStarted() || progress > 0;
        mesh.current.position.copy(rest).addScaledVector(from, 1 - progress);
        material.current.opacity = GLASS_OPACITY * progress;
    });

    return (
        <mesh ref={mesh} rotation={panel.rotation} raycast={() => null}>
            <planeGeometry args={panel.size} />
            <meshPhysicalMaterial
                ref={material}
                color="#dff4ff"
                transparent
                opacity={0}
                roughness={0.05}
                depthWrite={false}
            />
            {showEdges && <Edges color="#a8c8d8" />}
        </mesh>
    );
}

/**
 * Drops its children from `height` above their place, bouncing as they land,
 * during an intro phase. Until then their meshes and lines are hidden, but
 * not their lights: hiding a light would change the number of lights,
 * recompiling every shader just as the animation plays.
 */
export function Landing({
    phase,
    height,
    children,
}: {
    phase: IntroPhase;
    height: number;
    children: ReactNode;
}) {
    const group = useRef<Group>(null);
    const isShown = useRef(true);

    useFrame(() => {
        if (group.current === null) {
            return;
        }

        const progress = introProgress(phase);
        const shouldShow = !introStarted() || progress > 0;

        if (shouldShow !== isShown.current) {
            isShown.current = shouldShow;
            group.current.traverse((object) => {
                if ((object as Mesh).isMesh || (object as Line).isLine) {
                    object.visible = shouldShow;
                }
            });
        }

        group.current.position.y = (1 - easeOutBounce(progress)) * height;
    });

    return <group ref={group}>{children}</group>;
}

const dummy = new Object3D();

function Detritus({
    amount,
    grid,
    substrate,
}: {
    amount: number;
    grid: TankGrid;
    substrate: Heightmap;
}) {
    const count = Math.min(250, Math.round(amount * 50));
    const litter = useRef<Group>(null);

    // Settles on the gravel halfway through the gravel's own arrival.
    useFrame(() => {
        if (litter.current !== null) {
            litter.current.visible = introUniforms.landscape.value >= 0.5;
        }
    });
    const offsets = useMemo(
        () =>
            Array.from({ length: 250 }, (_, index) => ({
                x: (pseudoRandom(index * 3.1) - 0.5) * (TANK.width - 0.1),
                z: (pseudoRandom(index * 7.7) - 0.5) * (TANK.depth - 0.1),
                rotation: pseudoRandom(index * 1.3) * Math.PI,
                scale: 0.5 + pseudoRandom(index * 5.9),
            })),
        [],
    );

    const updateInstances = (mesh: InstancedMesh | null) => {
        if (mesh === null) {
            return;
        }

        offsets.slice(0, count).forEach((offset, index) => {
            dummy.position.set(
                offset.x,
                substrateHeightAt(grid, substrate, offset.x, offset.z) + 0.002,
                offset.z,
            );
            dummy.rotation.set(-Math.PI / 2, 0, offset.rotation);
            dummy.scale.setScalar(offset.scale);
            dummy.updateMatrix();
            mesh.setMatrixAt(index, dummy.matrix);
        });
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
    };

    if (count === 0) {
        return null;
    }

    return (
        <group ref={litter}>
            <instancedMesh
                key={count}
                ref={updateInstances}
                args={[undefined, undefined, 250]}
            >
                <circleGeometry args={[0.012, 5]} />
                <meshStandardMaterial color="#4a3a22" roughness={1} />
            </instancedMesh>
        </group>
    );
}

/** Deterministic 0..1 noise so detritus does not jump around between renders. */
function pseudoRandom(seed: number): number {
    const value = Math.sin(seed * 12.9898) * 43758.5453;

    return value - Math.floor(value);
}
