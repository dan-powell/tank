import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { ComponentRef } from 'react';
import { MOUSE } from 'three';
import { TANK } from '@/lib/tank/space';
import type { TankWorld } from '@/lib/tank/world';
import type { Species, TankSnapshot } from '@/types';
import { AutoFeederModel } from './auto-feeder-model';
import { Creatures } from './creatures';
import { FoodParticles } from './food-particles';
import { Plants } from './plants';
import { swayClock } from './sway-material';
import { ORBIT_START, TankCameraRig } from './tank-camera-rig';
import type { TankViewMode } from './tank-camera-rig';
import { TankPanControls } from './tank-pan-controls';
import { TankEnvironment } from './tank-environment';

type Props = {
    tank: TankSnapshot;
    species: Species[];
    world: TankWorld;
    viewMode: TankViewMode;
    onFeed: (worldX: number, worldZ: number) => void;
};

/** Low-oxygen threshold (mg/L) below which fish gasp at the surface. */
const LOW_OXYGEN = 4;

/**
 * Right-drag rotates and the wheel zooms; left-drag pans (handled by
 * TankPanControls). A stable reference, so re-renders never reset it.
 */
const MOUSE_BUTTONS = { MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };

/** Pointer travel (px) beyond which a press is a drag, not a feeding click. */
const CLICK_TOLERANCE = 5;

export function TankScene({ tank, species, world, viewMode, onFeed }: Props) {
    const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
    const speciesById = useMemo(
        () => new Map(species.map((definition) => [definition.id, definition])),
        [species],
    );

    useEffect(() => {
        world.scatterSunkenFood(
            Math.min(40, Math.round(tank.water.uneaten_food * 150)),
        );
        // Only on first load: later food comes from the user's own feeding.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [world]);

    const handleSurfaceClick = (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();

        if (event.delta <= CLICK_TOLERANCE) {
            onFeed(event.point.x, event.point.z);
        }
    };

    /** In the flat view the surface is edge-on, so clicking the water feeds. */
    const handleFrontClick = (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();

        if (event.delta <= CLICK_TOLERANCE) {
            onFeed(event.point.x, (Math.random() - 0.5) * TANK.depth * 0.6);
        }
    };

    return (
        <Canvas
            camera={{ position: ORBIT_START.position, fov: ORBIT_START.fov }}
            dpr={[1, 2]}
            gl={{ antialias: true }}
        >
            <color
                attach="background"
                args={[tank.is_lit ? '#2c3e52' : '#0e1626']}
            />
            <SwayClock />
            <TankEnvironment
                water={tank.water}
                isLit={tank.is_lit}
                onSurfaceClick={handleSurfaceClick}
            />
            <Suspense fallback={null}>
                <Plants
                    plants={tank.plants}
                    species={speciesById}
                    layerCount={tank.layer_count}
                />
                <Creatures
                    creatures={tank.creatures}
                    species={speciesById}
                    world={world}
                    layerCount={tank.layer_count}
                    isLit={tank.is_lit}
                    lowOxygen={tank.water.oxygen < LOW_OXYGEN}
                />
            </Suspense>
            {viewMode === 'flat' && (
                <mesh
                    position={[
                        0,
                        (TANK.substrate + TANK.waterLine) / 2,
                        TANK.depth / 2 - 0.01,
                    ]}
                    onClick={handleFrontClick}
                >
                    <planeGeometry
                        args={[TANK.width, TANK.waterLine - TANK.substrate]}
                    />
                    <meshBasicMaterial
                        transparent
                        opacity={0}
                        depthWrite={false}
                    />
                </mesh>
            )}
            <FoodParticles world={world} />
            {tank.auto_feeder !== null && (
                <AutoFeederModel feeder={tank.auto_feeder} />
            )}
            <OrbitControls
                ref={controls}
                target={ORBIT_START.target}
                enablePan={false}
                mouseButtons={MOUSE_BUTTONS}
            />
            <TankCameraRig mode={viewMode} controls={controls} />
            <TankPanControls controls={controls} />
        </Canvas>
    );
}

function SwayClock() {
    useFrame((_, delta) => {
        swayClock.value += delta;
    });

    return null;
}
