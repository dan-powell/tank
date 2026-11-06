import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import { BackSide, Color, DoubleSide, InstancedMesh, Object3D } from 'three';
import { TANK } from '@/lib/tank/space';
import type { WaterParameters } from '@/types';
import { TankLighting } from './tank-lighting';

type Props = {
    water: WaterParameters;
    isLit: boolean;
    onSurfaceClick: (event: ThreeEvent<MouseEvent>) => void;
};

const CLEAN_WATER = new Color('#7cc4e4');
const GREEN_WATER = new Color('#6f9f4a');
const MURKY_WATER = new Color('#8a7a50');

export function TankEnvironment({ water, isLit, onSurfaceClick }: Props) {
    const algae = Math.min(1, water.algae / 100);
    const murk = Math.min(1, water.detritus / 4);
    const waterColour = useMemo(
        () =>
            CLEAN_WATER.clone()
                .lerp(GREEN_WATER, algae * 0.7)
                .lerp(MURKY_WATER, murk * 0.5),
        [algae, murk],
    );
    const waterHeight = TANK.waterLine - TANK.substrate;

    return (
        <group>
            <TankLighting isLit={isLit} />

            {/* Substrate */}
            <mesh position={[0, TANK.substrate / 2, 0]}>
                <boxGeometry args={[TANK.width, TANK.substrate, TANK.depth]} />
                <meshStandardMaterial color="#b49a72" roughness={1} />
            </mesh>
            <Detritus amount={water.detritus} />

            {/* Water volume */}
            <mesh position={[0, TANK.substrate + waterHeight / 2, 0]}>
                <boxGeometry
                    args={[TANK.width - 0.01, waterHeight, TANK.depth - 0.01]}
                />
                <meshStandardMaterial
                    color={waterColour}
                    transparent
                    opacity={0.12 + algae * 0.25 + murk * 0.2}
                    depthWrite={false}
                    side={BackSide}
                />
            </mesh>

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

            {/* Clickable water surface for feeding */}
            <mesh
                position={[0, TANK.waterLine, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                onClick={onSurfaceClick}
            >
                <planeGeometry args={[TANK.width, TANK.depth]} />
                <meshStandardMaterial
                    color="#bfe6ff"
                    transparent
                    opacity={isLit ? 0.12 : 0.05}
                    depthWrite={false}
                />
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
                <Edges color="#a8c8d8" />
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
