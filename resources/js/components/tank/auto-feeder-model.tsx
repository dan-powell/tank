import { AUTO_FEEDER_SPOT, TANK, toWorld } from '@/lib/tank/space';
import type { AutoFeeder } from '@/types';

type Props = {
    feeder: AutoFeeder;
};

const HOPPER_HEIGHT = 0.12;
const HOPPER_RADIUS = 0.045;

/**
 * A battery auto-feeder clamped to the back glass, with a clear hopper
 * showing how much food is left.
 */
export function AutoFeederModel({ feeder }: Props) {
    const spot = toWorld(AUTO_FEEDER_SPOT.x, 1, AUTO_FEEDER_SPOT.z);
    const backGlass = -TANK.depth / 2;
    const bracketLength = spot.z - backGlass;
    const fill = feeder.unlimited ? 1 : feeder.portions / feeder.capacity;
    const foodHeight = HOPPER_HEIGHT * 0.9 * fill;
    const baseY = TANK.height + 0.03;

    return (
        <group position={[spot.x, 0, 0]}>
            {/* Clamp over the back glass */}
            <mesh
                position={[
                    0,
                    TANK.height + 0.005,
                    backGlass + bracketLength / 2,
                ]}
                raycast={() => null}
            >
                <boxGeometry args={[0.05, 0.015, bracketLength + 0.03]} />
                <meshStandardMaterial color="#d8dadf" roughness={0.5} />
            </mesh>

            <group position={[0, baseY, spot.z]}>
                {/* Motor housing */}
                <mesh raycast={() => null}>
                    <boxGeometry args={[0.11, 0.05, 0.1]} />
                    <meshStandardMaterial color="#e9ebef" roughness={0.45} />
                </mesh>
                {/* Status light: green while it has food, red when empty */}
                <mesh position={[0, 0, 0.051]} raycast={() => null}>
                    <circleGeometry args={[0.008, 12]} />
                    <meshStandardMaterial
                        color={fill > 0 ? '#3ad16b' : '#e04444'}
                        emissive={fill > 0 ? '#3ad16b' : '#e04444'}
                        emissiveIntensity={1.5}
                    />
                </mesh>

                {/* Food inside the hopper */}
                {foodHeight > 0.001 && (
                    <mesh
                        position={[0, 0.025 + foodHeight / 2, 0]}
                        raycast={() => null}
                    >
                        <cylinderGeometry
                            args={[
                                HOPPER_RADIUS * 0.92,
                                HOPPER_RADIUS * 0.92,
                                foodHeight,
                                20,
                            ]}
                        />
                        <meshStandardMaterial color="#d9763a" roughness={0.9} />
                    </mesh>
                )}

                {/* Clear hopper */}
                <mesh
                    position={[0, 0.025 + HOPPER_HEIGHT / 2, 0]}
                    raycast={() => null}
                >
                    <cylinderGeometry
                        args={[HOPPER_RADIUS, HOPPER_RADIUS, HOPPER_HEIGHT, 20]}
                    />
                    <meshStandardMaterial
                        color="#e6f4ff"
                        transparent
                        opacity={0.25}
                        depthWrite={false}
                    />
                </mesh>

                {/* Lid */}
                <mesh
                    position={[0, 0.025 + HOPPER_HEIGHT + 0.008, 0]}
                    raycast={() => null}
                >
                    <cylinderGeometry
                        args={[
                            HOPPER_RADIUS + 0.004,
                            HOPPER_RADIUS + 0.004,
                            0.016,
                            20,
                        ]}
                    />
                    <meshStandardMaterial color="#5b9bd5" roughness={0.4} />
                </mesh>
            </group>
        </group>
    );
}
