import { Edges } from '@react-three/drei';
import { useMemo } from 'react';
import { DoubleSide, InstancedMesh, Object3D } from 'three';
import { TANK } from '@/lib/tank/space';
import type { Heightmap } from '@/lib/tank/substrate-heightmap';
import { substrateHeightAt } from '@/lib/tank/terrain-field';
import type { TankGrid, WaterParameters } from '@/types';
import { Bubbles } from './bubbles';
import { TankLighting } from './tank-lighting';

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

    return (
        <group>
            <TankLighting isLit={isLit} />

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
                        color="#4f7f2a"
                        transparent
                        opacity={algae * 0.7}
                        depthWrite={false}
                        side={DoubleSide}
                    />
                </mesh>
            )}

            {/* Glass */}
            <mesh position={[0, TANK.height / 2, 0]} raycast={() => null}>
                <boxGeometry args={[TANK.width, TANK.height, TANK.depth]} />
                <meshPhysicalMaterial
                    color="#dff4ff"
                    transparent
                    opacity={0.06}
                    roughness={0.05}
                    depthWrite={false}
                />
                {showEdges && <Edges color="#a8c8d8" />}
            </mesh>

            {mist > 0.01 && (
                <mesh position={[0, TANK.height / 2, 0]} raycast={() => null}>
                    <boxGeometry
                        args={[
                            TANK.width - 0.004,
                            TANK.height - 0.004,
                            TANK.depth - 0.004,
                        ]}
                    />
                    <meshBasicMaterial
                        color="#f2f8fb"
                        transparent
                        opacity={mist * 0.22}
                        depthWrite={false}
                        side={DoubleSide}
                    />
                </mesh>
            )}

            {isSealed && (
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
            )}
        </group>
    );
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
        <instancedMesh
            key={count}
            ref={updateInstances}
            args={[undefined, undefined, 250]}
        >
            <circleGeometry args={[0.012, 5]} />
            <meshStandardMaterial color="#4a3a22" roughness={1} />
        </instancedMesh>
    );
}

/** Deterministic 0..1 noise so detritus does not jump around between renders. */
function pseudoRandom(seed: number): number {
    const value = Math.sin(seed * 12.9898) * 43758.5453;

    return value - Math.floor(value);
}
