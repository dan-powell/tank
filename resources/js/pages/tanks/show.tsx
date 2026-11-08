import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Box,
    Moon,
    PanelRightClose,
    PanelRightOpen,
    Square,
    Sun,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AutoFeederPanel } from '@/components/tank/auto-feeder-panel';
import { EventLog } from '@/components/tank/event-log';
import { InhabitantPanel } from '@/components/tank/inhabitant-panel';
import type { Inhabitant } from '@/components/tank/inhabitant-panel';
import { MaintenancePanel } from '@/components/tank/maintenance-panel';
import type { TankViewMode } from '@/components/tank/tank-camera-rig';
import { PopulationPanel } from '@/components/tank/population-panel';
import { TankScene } from '@/components/tank/tank-scene';
import { WaterPanel } from '@/components/tank/water-panel';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTankChannel } from '@/hooks/use-tank-channel';
import {
    AUTO_FEEDER_SPOT,
    formatSimClock,
    TANK,
    toNormalisedSurface,
    toWorld,
} from '@/lib/tank/space';
import { cn } from '@/lib/utils';
import { TankWorld } from '@/lib/tank/world';
import { dashboard } from '@/routes';
import { feed } from '@/routes/tanks';
import type { Species, TankEvent, TankSelection, TankSnapshot } from '@/types';
import { Vector3 } from 'three';

type Props = {
    tank: TankSnapshot;
    species: Species[];
    events: TankEvent[];
};

const PANEL_STORAGE_KEY = 'tank-panel-open';

/** Keyboard shortcut that shows or hides the side panel. */
const PANEL_SHORTCUT = 'p';

const hudSurface = 'rounded-md bg-black/50 text-white backdrop-blur-sm';
const hudButton = cn(
    hudSurface,
    'inline-flex size-9 items-center justify-center transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none',
);

/**
 * Whether the side panel starts open: the viewer's last choice, otherwise
 * open on wide screens and closed on narrow ones where it covers the tank.
 */
function initialPanelOpen(): boolean {
    if (typeof window === 'undefined') {
        return true;
    }

    try {
        const stored = window.localStorage.getItem(PANEL_STORAGE_KEY);

        if (stored !== null) {
            return stored === 'true';
        }
    } catch {
        // Storage can be unavailable (private windows, blocked site data).
    }

    return window.matchMedia('(min-width: 1024px)').matches;
}

export default function ShowTank({ tank, species, events }: Props) {
    const world = useMemo(() => new TankWorld(), []);
    const [viewMode, setViewMode] = useState<TankViewMode>('flat');
    const [isPanelOpen, setIsPanelOpen] = useState(initialPanelOpen);
    const [selection, setSelection] = useState<TankSelection | null>(null);

    const togglePanel = () => setIsPanelOpen((open) => !open);

    const select = (next: TankSelection | null) => {
        setSelection(next);

        if (next !== null) {
            setIsPanelOpen(true);
        }
    };

    /** The selected inhabitant, if it is still in the tank. */
    const inhabitant = useMemo(
        () => findInhabitant(tank, species, selection),
        [tank, species, selection],
    );

    useEffect(() => {
        try {
            window.localStorage.setItem(PANEL_STORAGE_KEY, String(isPanelOpen));
        } catch {
            // Not remembering the choice is fine.
        }
    }, [isPanelOpen]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isTyping =
                target !== null &&
                (target.isContentEditable ||
                    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

            if (isTyping || event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }

            if (event.key === 'Escape') {
                setSelection(null);
            } else if (event.key.toLowerCase() === PANEL_SHORTCUT) {
                setIsPanelOpen((open) => !open);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
            <div className="relative flex h-svh w-full overflow-hidden bg-background">
                <main className="relative min-w-0 flex-1">
                    <TankScene
                        tank={tank}
                        species={species}
                        world={world}
                        viewMode={viewMode}
                        selection={selection}
                        onSelect={select}
                    />

                    <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link
                                        href={dashboard()}
                                        className={cn(
                                            hudButton,
                                            'pointer-events-auto',
                                        )}
                                        aria-label="Back to dashboard"
                                    >
                                        <ArrowLeft className="size-4" />
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    Dashboard
                                </TooltipContent>
                            </Tooltip>
                            <div className={cn(hudSurface, 'px-3 py-1.5')}>
                                <h1 className="text-sm font-semibold">
                                    {tank.name}
                                </h1>
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

                        <div className="pointer-events-auto flex items-center gap-2">
                            <ToggleGroup
                                type="single"
                                size="sm"
                                value={viewMode}
                                onValueChange={(value) =>
                                    value && setViewMode(value as TankViewMode)
                                }
                                aria-label="Tank view"
                                className={cn(hudSurface, 'h-9')}
                            >
                                <ToggleGroupItem
                                    value="orbit"
                                    aria-label="3D view"
                                    className="h-9 gap-1.5 px-2.5 hover:bg-white/15 hover:text-white data-[state=on]:bg-white/25 data-[state=on]:text-white"
                                >
                                    <Box className="size-4" />
                                    3D
                                </ToggleGroupItem>
                                <ToggleGroupItem
                                    value="flat"
                                    aria-label="Front 2D view"
                                    className="h-9 gap-1.5 px-2.5 hover:bg-white/15 hover:text-white data-[state=on]:bg-white/25 data-[state=on]:text-white"
                                >
                                    <Square className="size-4" />
                                    2D
                                </ToggleGroupItem>
                            </ToggleGroup>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={togglePanel}
                                        className={hudButton}
                                        aria-label={
                                            isPanelOpen
                                                ? 'Hide tank panel'
                                                : 'Show tank panel'
                                        }
                                        aria-expanded={isPanelOpen}
                                        aria-controls="tank-panel"
                                    >
                                        {isPanelOpen ? (
                                            <PanelRightClose className="size-4" />
                                        ) : (
                                            <PanelRightOpen className="size-4" />
                                        )}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    {isPanelOpen ? 'Hide panel' : 'Show panel'}{' '}
                                    <kbd className="ml-1 rounded border border-current/30 px-1 font-mono text-[10px] uppercase">
                                        {PANEL_SHORTCUT}
                                    </kbd>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                </main>

                <div
                    className={cn(
                        'absolute inset-y-0 right-0 z-10 shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out lg:relative',
                        isPanelOpen ? 'w-[min(20rem,85vw)]' : 'w-0',
                    )}
                >
                    <aside
                        id="tank-panel"
                        aria-label="Tank details"
                        inert={!isPanelOpen}
                        className="flex h-full w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto border-l border-sidebar-border bg-sidebar p-4 text-sidebar-foreground"
                    >
                        <WaterPanel water={tank.water} />
                        <PopulationPanel
                            creatures={tank.creatures}
                            plants={tank.plants}
                            species={species}
                        />
                        {inhabitant === null ? (
                            <MaintenancePanel
                                tankId={tank.id}
                                lightOn={tank.light_on}
                                species={species}
                                onFeedRandomly={feedRandomly}
                            />
                        ) : (
                            <InhabitantPanel
                                tankId={tank.id}
                                inhabitant={inhabitant}
                                world={world}
                                onClose={() => setSelection(null)}
                            />
                        )}
                        <AutoFeederPanel
                            tankId={tank.id}
                            feeder={tank.auto_feeder}
                        />
                        <EventLog events={events} />
                    </aside>
                </div>
            </div>
        </>
    );
}

function findInhabitant(
    tank: TankSnapshot,
    species: Species[],
    selection: TankSelection | null,
): Inhabitant | null {
    if (selection === null) {
        return null;
    }

    if (selection.kind === 'creature') {
        const entity = tank.creatures.find(
            (creature) => creature.id === selection.id,
        );
        const definition = species.find((s) => s.id === entity?.species_id);

        return entity && definition
            ? { kind: 'creature', entity, species: definition }
            : null;
    }

    const entity = tank.plants.find((plant) => plant.id === selection.id);
    const definition = species.find((s) => s.id === entity?.species_id);

    return entity && definition
        ? { kind: 'plant', entity, species: definition }
        : null;
}
