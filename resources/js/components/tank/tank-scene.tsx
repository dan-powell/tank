import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { TANK } from '@/lib/tank/space';
import type { TankWorld } from '@/lib/tank/world';
import type { Species, TankSnapshot } from '@/types';
import { AutoFeederModel } from './auto-feeder-model';
import { Creatures } from './creatures';
import { FoodParticles } from './food-particles';
import { Plants } from './plants';
import { swayClock } from './sway-material';
import { TankEnvironment } from './tank-environment';

type Props = {
    tank: TankSnapshot;
    species: Species[];
    world: TankWorld;
    onFeed: (worldX: number, worldZ: number) => void;
};

/** Low-oxygen threshold (mg/L) below which fish gasp at the surface. */
const LOW_OXYGEN = 4;

export function TankScene({ tank, species, world, onFeed }: Props) {
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
        onFeed(event.point.x, event.point.z);
    };

    return (
        <Canvas
            camera={{ position: [0, TANK.height * 0.6, 2.6], fov: 45 }}
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
            <Plants plants={tank.plants} species={speciesById} />
            <Creatures
                creatures={tank.creatures}
                species={speciesById}
                world={world}
                isLit={tank.is_lit}
                lowOxygen={tank.water.oxygen < LOW_OXYGEN}
            />
            <FoodParticles world={world} />
            {tank.auto_feeder !== null && (
                <AutoFeederModel feeder={tank.auto_feeder} />
            )}
            <OrbitControls
                target={[0, TANK.height * 0.45, 0]}
                enablePan={false}
                minDistance={1.2}
                maxDistance={4.5}
                minPolarAngle={0.3}
                maxPolarAngle={Math.PI / 2}
            />
        </Canvas>
    );
}

function SwayClock() {
    useFrame((_, delta) => {
        swayClock.value += delta;
    });

    return null;
}
