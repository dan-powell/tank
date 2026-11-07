import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, InstancedMesh, Object3D } from 'three';
import { TANK } from '@/lib/tank/space';
import type { WaterParameters } from '@/types';
import { Bubbles } from './bubbles';
import { createCausticMaterial } from './caustics';
import { TankLighting } from './tank-lighting';

type Props = {
    water: WaterParameters;
    isLit: boolean;
    onSurfaceClick: (event: ThreeEvent<MouseEvent>) => void;
    /** Outline the glass edges (hidden in the flat 2D view). */
    showEdges?: boolean;
};

export function TankEnvironment({
    water,
    isLit,
    onSurfaceClick,
    showEdges = true,
}: Props) {
    const algae = Math.min(1, water.algae / 100);
    const substrateMaterial = useMemo(
        () => createCausticMaterial(new Color('#b49a72')),
        [],
    );

    useEffect(() => () => substrateMaterial.dispose(), [substrateMaterial]);

    return (
        <group>
            <TankLighting isLit={isLit} />

            {/* Substrate */}
            <mesh
                position={[0, TANK.substrate / 2, 0]}
                material={substrateMaterial}
            >
                <boxGeometry args={[TANK.width, TANK.substrate, TANK.depth]} />
            </mesh>
            <Detritus amount={water.detritus} />
            <Bubbles isLit={isLit} />

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

            {/* Clickable water surface for feeding (drawn by WaterVolume) */}
            <mesh
                position={[0, TANK.waterLine, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                onClick={onSurfaceClick}
            >
                <planeGeometry args={[TANK.width, TANK.depth]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

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
        </group>
    );
}

const dummy = new Object3D();

function Detritus({ amount }: { amount: number }) {
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
            dummy.position.set(offset.x, TANK.substrate + 0.002, offset.z);
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
