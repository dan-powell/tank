import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { ComponentRef } from 'react';
import { MOUSE } from 'three';
import type { TankWorld } from '@/lib/tank/world';
import type { Species, TankSelection, TankSnapshot } from '@/types';
import { AutoFeederModel } from './auto-feeder-model';
import { Creatures } from './creatures';
import { FoodParticles } from './food-particles';
import { haloUniforms } from './halo-material';
import { Plants } from './plants';
import { sceneClock } from './scene-clock';
import { ORBIT_START, TankCameraRig } from './tank-camera-rig';
import type { TankViewMode } from './tank-camera-rig';
import { TankPanControls } from './tank-pan-controls';
import { TankEnvironment } from './tank-environment';
import { WaterVolume } from './water-volume';

type Props = {
    tank: TankSnapshot;
    species: Species[];
    world: TankWorld;
    viewMode: TankViewMode;
    selection: TankSelection | null;
    onSelect: (selection: TankSelection | null) => void;
};

/** Low-oxygen threshold (mg/L) below which fish gasp at the surface. */
const LOW_OXYGEN = 4;

/**
 * Right-drag rotates and the wheel zooms; left-drag pans (handled by
 * TankPanControls). A stable reference, so re-renders never reset it.
 */
const MOUSE_BUTTONS = { MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };

export function TankScene({
    tank,
    species,
    world,
    viewMode,
    selection,
    onSelect,
}: Props) {
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

    return (
        <Canvas
            camera={{ position: ORBIT_START.position, fov: ORBIT_START.fov }}
            dpr={[1, 2]}
            gl={{ antialias: true }}
            onPointerMissed={() => onSelect(null)}
        >
            <color
                attach="background"
                args={[tank.is_lit ? '#2c3e52' : '#0e1626']}
            />
            <SceneClock />
            <HaloResolution />
            <TankEnvironment
                water={tank.water}
                isLit={tank.is_lit}
                showEdges={viewMode === 'orbit'}
            />
            <Suspense fallback={null}>
                <Plants
                    plants={tank.plants}
                    species={speciesById}
                    layerCount={tank.layer_count}
                    selectedId={
                        selection?.kind === 'plant' ? selection.id : null
                    }
                    onSelect={(id) => onSelect({ kind: 'plant', id })}
                />
                <Creatures
                    creatures={tank.creatures}
                    species={speciesById}
                    world={world}
                    layerCount={tank.layer_count}
                    isLit={tank.is_lit}
                    lowOxygen={tank.water.oxygen < LOW_OXYGEN}
                    selectedId={
                        selection?.kind === 'creature' ? selection.id : null
                    }
                    onSelect={(id) => onSelect({ kind: 'creature', id })}
                />
            </Suspense>
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
            {/* Last, so its refraction pass sees this frame's camera. */}
            <WaterVolume water={tank.water} isLit={tank.is_lit} world={world} />
        </Canvas>
    );
}

function SceneClock() {
    useFrame((_, delta) => {
        sceneClock.value += delta;
    });

    return null;
}

/** Keeps selection halos a fixed number of pixels wide. */
function HaloResolution() {
    const size = useThree((state) => state.size);

    useEffect(() => {
        haloUniforms.uHaloResolution.value.set(size.width, size.height);
    }, [size]);

    return null;
}
