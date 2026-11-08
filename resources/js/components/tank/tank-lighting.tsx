import { useMemo } from 'react';
import { Object3D } from 'three';
import { TANK } from '@/lib/tank/space';

type Props = {
    isLit: boolean;
};

/** Height of the lamp hood's underside above the tank floor. */
export function hoodHeight(): number {
    return TANK.height + 0.35;
}

/** Horizontal positions of the spotlights along the hood. */
export function spotPositions(): number[] {
    return [-TANK.width / 3, 0, TANK.width / 3];
}

/**
 * Lighting presets. The spotlights are room lighting so the tank is always
 * viewable: warm and bright while the tank lamp is on, dimmer and moonlit
 * while it is off (lamp timer outside 08:00–20:00, or switched off).
 */
const DAY = {
    spotColour: '#fff4dc',
    spotIntensity: 14,
    skyColour: '#dcefff',
    groundColour: '#5a4a36',
    fillIntensity: 0.9,
    keyColour: '#fff4dc',
    keyIntensity: 1.2,
    lensGlow: 2,
};

const NIGHT = {
    spotColour: '#b8c8ff',
    spotIntensity: 6,
    skyColour: '#6c86c4',
    groundColour: '#2a2620',
    fillIntensity: 0.55,
    keyColour: '#8ea4ff',
    keyIntensity: 0.6,
    lensGlow: 1,
};

export function TankLighting({ isLit }: Props) {
    const preset = isLit ? DAY : NIGHT;

    return (
        <group>
            <hemisphereLight
                args={[preset.skyColour, preset.groundColour]}
                intensity={preset.fillIntensity}
                position={[0, TANK.height, 0]}
            />
            <directionalLight
                position={[1.5, 4, 3]}
                intensity={preset.keyIntensity}
                color={preset.keyColour}
            />

            <LampHood isLit={isLit} />
            {spotPositions().map((x) => (
                <Spotlight key={x} x={x} isLit={isLit} />
            ))}
        </group>
    );
}

function LampHood({ isLit }: Props) {
    const preset = isLit ? DAY : NIGHT;
    const barLength = TANK.width + 0.1;

    return (
        <group position={[0, hoodHeight(), 0]}>
            {/* Rail the spotlights hang from */}
            <mesh position={[0, 0.08, 0]} raycast={() => null}>
                <boxGeometry args={[barLength, 0.03, 0.06]} />
                <meshStandardMaterial
                    color="#2b2f36"
                    metalness={0.6}
                    roughness={0.4}
                />
            </mesh>

            {/* Uprights down to the tank rim */}
            {[-1, 1].map((side) => (
                <mesh
                    key={side}
                    position={[(side * barLength) / 2, -0.1275, 0]}
                    raycast={() => null}
                >
                    <boxGeometry args={[0.025, 0.445, 0.025]} />
                    <meshStandardMaterial
                        color="#2b2f36"
                        metalness={0.6}
                        roughness={0.4}
                    />
                </mesh>
            ))}

            {spotPositions().map((x) => (
                <group key={x} position={[x, 0, 0]}>
                    {/* Housing */}
                    <mesh position={[0, 0.03, 0]} raycast={() => null}>
                        <cylinderGeometry args={[0.05, 0.075, 0.09, 24]} />
                        <meshStandardMaterial
                            color="#1f2329"
                            metalness={0.7}
                            roughness={0.35}
                        />
                    </mesh>
                    {/* Lens */}
                    <mesh
                        position={[0, -0.016, 0]}
                        rotation={[Math.PI / 2, 0, 0]}
                        raycast={() => null}
                    >
                        <circleGeometry args={[0.068, 24]} />
                        <meshStandardMaterial
                            color={preset.spotColour}
                            emissive={preset.spotColour}
                            emissiveIntensity={preset.lensGlow}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

function Spotlight({ x, isLit }: { x: number; isLit: boolean }) {
    const preset = isLit ? DAY : NIGHT;
    const target = useMemo(() => new Object3D(), []);

    return (
        <>
            <primitive object={target} position={[x, 0, 0]} />
            <spotLight
                position={[x, hoodHeight() - 0.02, 0]}
                target={target}
                color={preset.spotColour}
                intensity={preset.spotIntensity}
                angle={0.75}
                penumbra={0.6}
                distance={0}
                decay={1.6}
            />
        </>
    );
}
