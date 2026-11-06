import { Head, router } from '@inertiajs/react';
import { Moon, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { AutoFeederPanel } from '@/components/tank/auto-feeder-panel';
import { EventLog } from '@/components/tank/event-log';
import { MaintenancePanel } from '@/components/tank/maintenance-panel';
import { PopulationPanel } from '@/components/tank/population-panel';
import { TankScene } from '@/components/tank/tank-scene';
import { WaterPanel } from '@/components/tank/water-panel';
import { useTankChannel } from '@/hooks/use-tank-channel';
import {
    AUTO_FEEDER_SPOT,
    formatSimClock,
    TANK,
    toNormalisedSurface,
    toWorld,
} from '@/lib/tank/space';
import { TankWorld } from '@/lib/tank/world';
import { dashboard } from '@/routes';
import { feed } from '@/routes/tanks';
import type { Species, TankEvent, TankSnapshot } from '@/types';
import { Vector3 } from 'three';

type Props = {
    tank: TankSnapshot;
    species: Species[];
    events: TankEvent[];
};

export default function ShowTank({ tank, species, events }: Props) {
    const world = useMemo(() => new TankWorld(), []);

    useTankChannel(tank.id, () => {
        const drop = toWorld(AUTO_FEEDER_SPOT.x, 1, AUTO_FEEDER_SPOT.z);
        world.sprinkle(drop.x, drop.z, 10);
    });

    const feedAt = (worldX: number, worldZ: number) => {
        world.sprinkle(worldX, worldZ);
        const { x, z } = toNormalisedSurface(new Vector3(worldX, 0, worldZ));
        router.post(
            feed.url(tank.id),
            { x, z },
            { preserveScroll: true, only: ['tank', 'events'] },
        );
    };

    const feedRandomly = () =>
        feedAt(
            (Math.random() - 0.5) * TANK.width * 0.6,
            (Math.random() - 0.5) * TANK.depth * 0.6,
        );

    return (
        <>
            <Head title={tank.name} />
            <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row">
                <div className="relative min-h-[60svh] flex-1 overflow-hidden rounded-xl border border-sidebar-border/70 lg:min-h-0 dark:border-sidebar-border">
                    <TankScene
                        tank={tank}
                        species={species}
                        world={world}
                        onFeed={feedAt}
                    />
                    <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-black/50 px-3 py-1.5 text-sm text-white">
                        <h1 className="font-semibold">{tank.name}</h1>
                        <p className="flex items-center gap-1.5 text-xs text-white/80">
                            {tank.is_lit ? (
                                <Sun className="size-3" />
                            ) : (
                                <Moon className="size-3" />
                            )}
                            {formatSimClock(tank.sim_seconds)} ·{' '}
                            {tank.volume_litres} L
                        </p>
                    </div>
                </div>
                <aside className="flex w-full flex-col gap-6 rounded-xl border border-sidebar-border/70 p-4 lg:max-h-[calc(100svh-6rem)] lg:w-80 dark:border-sidebar-border">
                    <WaterPanel water={tank.water} />
                    <PopulationPanel
                        creatures={tank.creatures}
                        plants={tank.plants}
                        species={species}
                    />
                    <MaintenancePanel
                        tankId={tank.id}
                        lightOn={tank.light_on}
                        species={species}
                        onFeedRandomly={feedRandomly}
                    />
                    <AutoFeederPanel
                        tankId={tank.id}
                        feeder={tank.auto_feeder}
                    />
                    <EventLog events={events} />
                </aside>
            </div>
        </>
    );
}

ShowTank.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
        {
            title: 'Tank',
            href: '#',
        },
    ],
};
