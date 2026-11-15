import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, Object3D } from 'three';
import type { MeshStandardMaterial, RectAreaLight, SpotLight } from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
    fixturePlacement,
    gantryHeight,
    levelAt,
    liveLighting,
    MAX_LIGHTS,
    simSecondsNow,
} from '@/lib/tank/lighting';
import type { SimClock } from '@/lib/tank/lighting';
import { introProgress } from '@/lib/tank/intro';
import { TANK } from '@/lib/tank/space';
import type { LightFixture, TankGrid, TankLighting as Lighting } from '@/types';
import { Landing } from './tank-environment';
import { sheenUniforms } from './voxel-material';

RectAreaLightUniformsLib.init();

type Props = {
    lighting: Lighting;
    /** The master switch. */
    lightOn: boolean;
    /** Whether any light is on (sets the room's mood). */
    isLit: boolean;
    grid: TankGrid;
    clock: SimClock;
    selectedFixtureId: number | null;
    onSelectFixture: (id: number) => void;
};

/**
 * Room lighting, so the tank can always be seen: brighter while the tank's
 * lights are on, dim and moonlit while they are off.
 */
const ROOM = {
    lit: {
        skyColour: '#dcefff',
        groundColour: '#5a4a36',
        fillIntensity: 0.8,
        keyColour: '#fff4dc',
        keyIntensity: 1.0,
    },
    dark: {
        skyColour: '#6c86c4',
        groundColour: '#2a2620',
        fillIntensity: 0.55,
        keyColour: '#8ea4ff',
        keyIntensity: 0.6,
    },
};

/** Light output at full brightness, per type (three.js units). */
const SPOT_INTENSITY = { spotlight: 22, flood: 12 } as const;

/** Tube luminance at full brightness, per metre of tube. */
const TUBE_INTENSITY = 9;

/** How bright lit lenses and tubes glow (above 1 so the bloom picks them up). */
const GLOW = 3;

const FRAME_COLOUR = '#2b2f36';
const SELECTED_COLOUR = '#3b82f6';

/**
 * The gantry above the tank and the lights hanging from it. Each light
 * follows its own timer, worked out every frame from the simulated clock,
 * and shares its state with the water (see liveLighting).
 */
export function TankLighting({
    lighting,
    lightOn,
    isLit,
    grid,
    clock,
    selectedFixtureId,
    onSelectFixture,
}: Props) {
    const room = isLit ? ROOM.lit : ROOM.dark;
    const fixtures = lighting.fixtures.slice(0, MAX_LIGHTS);

    useEffect(() => {
        liveLighting.count = fixtures.length;
    }, [fixtures.length]);

    useFrame(followSheen);

    return (
        <group>
            <hemisphereLight
                args={[room.skyColour, room.groundColour]}
                intensity={room.fillIntensity}
                position={[0, TANK.height, 0]}
            />
            <directionalLight
                position={[1.5, 4, 3]}
                intensity={room.keyIntensity}
                color={room.keyColour}
            />

            {/* Lowered onto the tank once its glass is in place. */}
            <Landing phase="gantry" height={TANK.height * 1.5}>
                <GantryFrame lighting={lighting} />

                {fixtures.map((fixture, index) => (
                    <Fixture
                        key={fixture.id}
                        index={index}
                        fixture={fixture}
                        lighting={lighting}
                        grid={grid}
                        lightOn={lightOn}
                        clock={clock}
                        isSelected={fixture.id === selectedFixtureId}
                        onSelect={onSelectFixture}
                    />
                ))}
            </Landing>
        </group>
    );
}

const sheenColour = new Color();

/** Tint the creatures' sheen with the lights' mixed colour, as bright as they are combined. */
function followSheen(): void {
    let total = 0;
    sheenColour.setRGB(0, 0, 0);

    for (let index = 0; index < liveLighting.count; index++) {
        const light = liveLighting.lights[index];

        sheenColour.r += light.colour.r * light.intensity;
        sheenColour.g += light.colour.g * light.intensity;
        sheenColour.b += light.colour.b * light.intensity;
        total += light.intensity;
    }

    sheenUniforms.uSheenStrength.value = Math.min(1, total);

    if (total > 0.01) {
        sheenUniforms.uSheenColour.value.copy(
            sheenColour.multiplyScalar(1 / total),
        );
    }
}

/** Rails along each gantry row, carried by a crossbar and upright at each end. */
function GantryFrame({ lighting }: { lighting: Lighting }) {
    const y = gantryHeight(lighting);
    const length = TANK.width + 0.1;
    const rowDepth = TANK.depth / lighting.gantry.rows;
    const uprightHeight = y - TANK.height + 0.02;

    return (
        <group>
            {Array.from({ length: lighting.gantry.rows }, (_, row) => (
                <mesh
                    key={row}
                    position={[
                        0,
                        y + 0.05,
                        (row + 0.5) * rowDepth - TANK.depth / 2,
                    ]}
                    raycast={() => null}
                >
                    <boxGeometry args={[length, 0.015, 0.02]} />
                    <FrameMaterial />
                </mesh>
            ))}
            {[-1, 1].map((side) => (
                <group key={side} position={[(side * length) / 2, 0, 0]}>
                    <mesh position={[0, y + 0.05, 0]} raycast={() => null}>
                        <boxGeometry args={[0.025, 0.025, TANK.depth]} />
                        <FrameMaterial />
                    </mesh>
                    <mesh
                        position={[0, TANK.height + uprightHeight / 2, 0]}
                        raycast={() => null}
                    >
                        <boxGeometry
                            args={[0.025, uprightHeight + 0.05, 0.025]}
                        />
                        <FrameMaterial />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

function FrameMaterial() {
    return (
        <meshStandardMaterial
            color={FRAME_COLOUR}
            metalness={0.6}
            roughness={0.4}
        />
    );
}

type FixtureProps = {
    index: number;
    fixture: LightFixture;
    lighting: Lighting;
    grid: TankGrid;
    lightOn: boolean;
    clock: SimClock;
    isSelected: boolean;
    onSelect: (id: number) => void;
};

function Fixture({
    index,
    fixture,
    lighting,
    grid,
    lightOn,
    clock,
    isSelected,
    onSelect,
}: FixtureProps) {
    const { centre, length } = useMemo(
        () => fixturePlacement(fixture, lighting, grid),
        [fixture, lighting, grid],
    );
    const isTube = fixture.type === 'led-tube';
    const colour = useMemo(() => new Color(fixture.colour), [fixture.colour]);
    const glow = useRef<MeshStandardMaterial>(null);
    const spot = useRef<SpotLight>(null);
    const area = useRef<RectAreaLight>(null);
    const target = useMemo(() => new Object3D(), []);
    const beamAngle = fixture.type === 'spotlight' ? 40 : 100;

    useFrame(() => {
        const level = lightOn ? levelAt(fixture, simSecondsNow(clock)) : 0;
        // Off until the gantry has landed, then switched on.
        const output =
            level * (fixture.brightness / 100) * introProgress('lights');
        const live = liveLighting.lights[index];

        live.centre.copy(centre);
        live.halfLength = isTube ? length / 2 : 0;
        live.cosOuter = isTube
            ? -1
            : Math.cos(((beamAngle / 2) * Math.PI) / 180);
        live.intensity = output * (isTube ? length * 0.5 : 0.8);
        live.colour.copy(colour);

        if (glow.current !== null) {
            glow.current.emissiveIntensity = 0.05 + output * GLOW;
        }

        if (spot.current !== null && fixture.type !== 'led-tube') {
            spot.current.intensity = output * SPOT_INTENSITY[fixture.type];
        }

        if (area.current !== null) {
            area.current.intensity = output * TUBE_INTENSITY;
        }
    });

    const select = (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect(fixture.id);
    };

    const housingColour = isSelected ? SELECTED_COLOUR : '#1f2329';

    return (
        <group position={centre}>
            {isTube ? (
                <>
                    <mesh position={[0, 0.02, 0]} onClick={select}>
                        <boxGeometry args={[length - 0.02, 0.022, 0.05]} />
                        <meshStandardMaterial
                            color={housingColour}
                            metalness={0.7}
                            roughness={0.35}
                        />
                    </mesh>
                    <mesh rotation={[0, 0, Math.PI / 2]} onClick={select}>
                        <cylinderGeometry
                            args={[0.012, 0.012, length - 0.04, 12]}
                        />
                        <meshStandardMaterial
                            ref={glow}
                            color={fixture.colour}
                            emissive={fixture.colour}
                            toneMapped={false}
                        />
                    </mesh>
                    <rectAreaLight
                        ref={area}
                        args={[colour, 0, length - 0.04, 0.03]}
                        position={[0, -0.015, 0]}
                        rotation={[-Math.PI / 2, 0, 0]}
                    />
                </>
            ) : (
                <>
                    <mesh position={[0, 0.03, 0]} onClick={select}>
                        {fixture.type === 'spotlight' ? (
                            <cylinderGeometry args={[0.05, 0.075, 0.09, 24]} />
                        ) : (
                            <cylinderGeometry args={[0.085, 0.085, 0.04, 24]} />
                        )}
                        <meshStandardMaterial
                            color={housingColour}
                            metalness={0.7}
                            roughness={0.35}
                        />
                    </mesh>
                    <mesh
                        position={[
                            0,
                            fixture.type === 'spotlight' ? -0.016 : 0.009,
                            0,
                        ]}
                        rotation={[Math.PI / 2, 0, 0]}
                        onClick={select}
                    >
                        <circleGeometry
                            args={[
                                fixture.type === 'spotlight' ? 0.068 : 0.08,
                                24,
                            ]}
                        />
                        <meshStandardMaterial
                            ref={glow}
                            color={fixture.colour}
                            emissive={fixture.colour}
                            toneMapped={false}
                        />
                    </mesh>
                    <primitive object={target} position={[0, -centre.y, 0]} />
                    <spotLight
                        ref={spot}
                        position={[0, -0.02, 0]}
                        target={target}
                        color={colour}
                        intensity={0}
                        angle={((beamAngle / 2) * Math.PI) / 180}
                        penumbra={0.6}
                        distance={0}
                        decay={1.6}
                    />
                </>
            )}
        </group>
    );
}
