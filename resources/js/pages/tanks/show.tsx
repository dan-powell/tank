import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Box,
    ChevronLeft,
    ChevronRight,
    Cog,
    Fish,
    History,
    LayoutDashboard,
    Mountain,
    Square,
    Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AutoFeederPanel } from '@/components/tank/auto-feeder-panel';
import { BackgroundPanel } from '@/components/tank/background-panel';
import { DecorCatalogue } from '@/components/tank/decor-catalogue';
import { DecorationPanel } from '@/components/tank/decoration-panel';
import { SubstratePanel } from '@/components/tank/substrate-panel';
import { EventLog } from '@/components/tank/event-log';
import { InhabitantList } from '@/components/tank/inhabitant-list';
import { InhabitantPanel } from '@/components/tank/inhabitant-panel';
import type { Inhabitant } from '@/components/tank/inhabitant-panel';
import type { TankViewMode } from '@/components/tank/tank-camera-rig';
import { PopulationPanel } from '@/components/tank/population-panel';
import { TankHeading } from '@/components/tank/tank-heading';
import { TankScene } from '@/components/tank/tank-scene';
import { ToolsPanel } from '@/components/tank/tools-panel';
import { WaterLevelPanel } from '@/components/tank/water-level-panel';
import { AirPanel, WaterPanel } from '@/components/tank/water-panel';
import { LidPanel } from '@/components/tank/lid-panel';
import { SealedGuard } from '@/components/tank/panel-section';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSubstrateSync } from '@/hooks/use-substrate-sync';
import { useTankChannel } from '@/hooks/use-tank-channel';
import {
    AUTO_FEEDER_SPOT,
    configureTankSpace,
    layerToZ,
    TANK,
    toNormalisedSurface,
    toWorld,
    zToLayer,
} from '@/lib/tank/space';
import { cn } from '@/lib/utils';
import { TankWorld } from '@/lib/tank/world';
import { dashboard } from '@/routes';
import type { SculptBrush } from '@/lib/tank/substrate-sculpt';
import { feed } from '@/routes/tanks';
import creatureRoutes from '@/routes/tanks/creatures';
import plantRoutes from '@/routes/tanks/plants';
import type { PlacementMode } from '@/components/tank/placement';
import decorationRoutes from '@/routes/tanks/decorations';
import type {
    DecorationDefinition,
    GridCell,
    Species,
    TankBackground,
    TankEvent,
    TankSelection,
    TankSnapshot,
} from '@/types';
import { toast } from 'sonner';
import { Vector3 } from 'three';

type Props = {
    tank: TankSnapshot;
    species: Species[];
    decorationCatalogue: DecorationDefinition[];
    events: TankEvent[];
};

const PANEL_STORAGE_KEY = 'tank-panel-open';

/** Keyboard shortcut that shows or hides the side panel. */
const PANEL_SHORTCUT = 'p';

type PanelTab =
    | 'summary'
    | 'activity'
    | 'inhabitants'
    | 'management'
    | 'decor'
    | 'equipment';

/** Which way new tab content slides in: from the side of the tab chosen. */
type TabDirection = 'left' | 'right';

const PANEL_TABS: { value: PanelTab; label: string; icon: LucideIcon }[] = [
    { value: 'summary', label: 'Summary', icon: LayoutDashboard },
    { value: 'activity', label: 'Activity', icon: History },
    { value: 'inhabitants', label: 'Inhabitants', icon: Fish },
    { value: 'management', label: 'Management', icon: Wrench },
    { value: 'decor', label: 'Aquascaping', icon: Mountain },
    { value: 'equipment', label: 'Equipment', icon: Cog },
];

/** Frosted glass, as used by the side panel, for controls over the tank. */
const hudSurface =
    'border border-sidebar-border/60 bg-sidebar/70 text-sidebar-foreground shadow-md backdrop-blur-md';

/**
 * 2D/3D options, styled like the panel tabs: the chosen one is tinted with a
 * primary underline. Focus moves with the choice, so no outline either.
 */
const viewToggleItem =
    'relative h-full gap-1.5 px-3 group-data-[spacing=0]/toggle-group:px-3 text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:bg-primary/20 focus-visible:ring-0 focus-visible:outline-none data-[state=on]:bg-primary/10 data-[state=on]:text-primary dark:data-[state=on]:bg-primary/15 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:opacity-0 after:transition-opacity data-[state=on]:after:opacity-100';

/**
 * Full-height panel tabs; the active one is tinted with a primary underline.
 * Focus moves with the active tab (arrow keys select as they go), so focus is
 * shown as a slightly stronger tint rather than an outline.
 */
const panelTabTrigger =
    'h-full border-0 text-muted-foreground hover:bg-sidebar-accent/60 focus-visible:border-0 focus-visible:bg-primary/20 focus-visible:ring-0 focus-visible:outline-none data-active:bg-primary/10 data-active:text-primary dark:data-active:border-transparent dark:data-active:bg-primary/15 dark:data-active:text-primary after:bg-primary group-data-horizontal/tabs:after:bottom-0 data-active:after:opacity-100';
const hudButton = cn(
    hudSurface,
    'hover:bg-sidebar hover:text-sidebar-foreground',
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

export default function ShowTank({
    tank,
    species,
    decorationCatalogue,
    events,
}: Props) {
    const { width, height, depth } = tank.grid;
    const sizeKey = `${width}x${height}x${depth}`;

    // The scene and steering read the shared tank space, so size it for this
    // tank before anything renders (it is idempotent), and give each size a
    // fresh world and scene.
    configureTankSpace(tank.grid);
    const world = useMemo(
        () => new TankWorld(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sizeKey],
    );
    const [viewMode, setViewMode] = useState<TankViewMode>('flat');
    const [isPanelOpen, setIsPanelOpen] = useState(initialPanelOpen);
    const [selection, setSelection] = useState<TankSelection | null>(null);
    const [selectedAnchor, setSelectedAnchor] = useState<number | null>(null);
    const [sculptBrush, setSculptBrush] = useState<SculptBrush | null>(null);
    /** The inhabitant being moved, while waiting for a click on its new spot. */
    const [moving, setMoving] = useState<TankSelection | null>(null);
    const gravel = useSubstrateSync(tank.id, tank.substrate);
    /** The tank as shown, with any gravel changes not yet saved. */
    const shownTank = useMemo(
        () =>
            gravel.substrate === tank.substrate
                ? tank
                : { ...tank, substrate: gravel.substrate },
        [tank, gravel.substrate],
    );
    const [tab, setTab] = useState<PanelTab>('summary');
    const [previewBackground, setPreviewBackground] =
        useState<TankBackground | null>(null);
    const [tabDirection, setTabDirection] = useState<TabDirection>('right');

    const changeTab = (next: PanelTab) => {
        const index = (value: PanelTab) =>
            PANEL_TABS.findIndex((candidate) => candidate.value === value);

        setTabDirection(index(next) < index(tab) ? 'left' : 'right');
        setTab(next);
        setSculptBrush(null);
    };

    const togglePanel = () => setIsPanelOpen((open) => !open);

    const select = (next: TankSelection | null) => {
        setSelection(next);
        setSelectedAnchor(null);

        if (next !== null) {
            setIsPanelOpen(true);
        }
    };

    const selectAnchor = (decorationId: number, anchor: number) => {
        select({ kind: 'decoration', id: decorationId });
        setSelectedAnchor(anchor);
    };

    /** The selected decoration and its catalogue entry, if it is still in the tank. */
    const decoration = useMemo(() => {
        if (selection?.kind !== 'decoration') {
            return null;
        }

        const placed = tank.decorations.find((d) => d.id === selection.id);
        const definition = decorationCatalogue.find(
            (candidate) => candidate.slug === placed?.type,
        );

        return placed && definition ? { placed, definition } : null;
    }, [tank.decorations, decorationCatalogue, selection]);

    const movingInhabitant = useMemo(
        () => findInhabitant(tank, species, moving),
        [tank, species, moving],
    );

    /** How a click picks the new spot: swimmers by depth slice, the rest on the ground. */
    const placement = useMemo((): PlacementMode | null => {
        if (movingInhabitant === null) {
            return null;
        }

        return movingInhabitant.kind === 'creature' &&
            movingInhabitant.species.behaviour === 'swimmer'
            ? {
                  kind: 'swim',
                  z: layerToZ(
                      Math.min(
                          tank.layer_count - 1,
                          movingInhabitant.entity.zone.layer,
                      ),
                      tank.layer_count,
                  ),
              }
            : { kind: 'ground' };
    }, [movingInhabitant, tank.layer_count]);

    /** Send the inhabitant being moved to where the tank was clicked. */
    const placeMoving = (point: Vector3) => {
        const target = movingInhabitant;
        setMoving(null);

        if (target === null) {
            return;
        }

        const { x } = toNormalisedSurface(point);
        const layer = zToLayer(point.z, tank.layer_count);
        const options = {
            preserveScroll: true,
            only: ['tank', 'errors'],
            onError: (errors: Record<string, string>) =>
                toast.error(
                    errors.x ??
                        errors.layer ??
                        errors.lid ??
                        'It could not be moved there.',
                ),
        };

        if (target.kind === 'plant') {
            router.patch(
                plantRoutes.move.url([tank.id, target.entity.id]),
                { x, layer },
                options,
            );

            return;
        }

        const isSwimmer = target.species.behaviour === 'swimmer';
        const height =
            (point.y - TANK.substrate) / (TANK.waterLine - TANK.substrate);

        router.patch(
            creatureRoutes.move.url([tank.id, target.entity.id]),
            {
                x,
                y: isSwimmer ? Math.min(0.95, Math.max(0.05, height)) : 0,
                layer: isSwimmer ? target.entity.zone.layer : layer,
            },
            {
                ...options,
                onSuccess: () => {
                    // Pop it straight there rather than letting it swim across.
                    world.creatures.get(target.entity.id)?.position.copy(point);
                },
            },
        );
    };

    const startSculpting = (brush: SculptBrush | null) => {
        if (brush !== null) {
            setSelection(null);
        }

        setSculptBrush(brush);
    };

    /** Move (and/or turn) a decoration, showing it there before the server confirms. */
    const moveDecoration = (
        decorationId: number,
        position: GridCell,
        rotation?: number,
    ) => {
        const current = tank.decorations.find((d) => d.id === decorationId);

        if (current === undefined) {
            return;
        }

        const [x, y, z] = position;
        const nextRotation = rotation ?? current.rotation;

        router.patch(
            decorationRoutes.update.url([tank.id, decorationId]),
            { x, y, z, rotation: nextRotation },
            {
                preserveScroll: true,
                only: ['tank'],
                optimistic: (props) => {
                    const snapshot = props.tank as TankSnapshot;

                    return {
                        tank: {
                            ...snapshot,
                            decorations: snapshot.decorations.map((d) =>
                                d.id === decorationId
                                    ? { ...d, position, rotation: nextRotation }
                                    : d,
                            ),
                        },
                    };
                },
            },
        );
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

            // Already handled, e.g. Escape closing a dialog.
            if (
                event.defaultPrevented ||
                isTyping ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey
            ) {
                return;
            }

            if (event.key === 'Escape') {
                setSelection(null);
                setSculptBrush(null);
                setMoving(null);
            } else if (event.key.toLowerCase() === PANEL_SHORTCUT) {
                setIsPanelOpen((open) => !open);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Hands-in work refused through a sealed lid is reported as a toast.
    useEffect(
        () =>
            router.on('error', (event) => {
                const lid = (event as CustomEvent).detail?.errors?.lid;

                if (typeof lid === 'string') {
                    toast.error(lid);
                }
            }),
        [],
    );

    // Sealing the lid ends any sculpting in progress.
    useEffect(() => {
        if (tank.is_sealed) {
            setSculptBrush(null);
        }
    }, [tank.is_sealed]);

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
            <div className="relative h-svh w-full overflow-hidden bg-background">
                <main className="absolute inset-0">
                    <TankScene
                        key={sizeKey}
                        tank={shownTank}
                        species={species}
                        world={world}
                        viewMode={viewMode}
                        decorationCatalogue={decorationCatalogue}
                        selection={selection}
                        onSelect={select}
                        onSelectAnchor={selectAnchor}
                        onMoveDecoration={moveDecoration}
                        sculptBrush={sculptBrush}
                        onSculpt={gravel.reshape}
                        placement={placement}
                        onPlace={placeMoving}
                        previewBackground={previewBackground}
                    />

                    {movingInhabitant !== null && (
                        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-16">
                            <div
                                className={cn(
                                    hudSurface,
                                    'pointer-events-auto flex items-center gap-3 rounded-md px-3 py-2 text-sm',
                                )}
                            >
                                <span>
                                    Click where to put{' '}
                                    <strong>
                                        {movingInhabitant.entity.nickname ??
                                            movingInhabitant.species.name}
                                    </strong>
                                    {movingInhabitant.kind === 'creature' &&
                                    movingInhabitant.species.behaviour ===
                                        'swimmer'
                                        ? ' in the water.'
                                        : ' on the gravel or a decoration.'}
                                </span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7"
                                    onClick={() => setMoving(null)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="pointer-events-none absolute top-3 left-3 flex items-start gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        hudButton,
                                        'pointer-events-auto',
                                    )}
                                >
                                    <Link
                                        href={dashboard()}
                                        aria-label="Back to dashboard"
                                    >
                                        <ArrowLeft />
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                Dashboard
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    <div className="absolute bottom-3 left-3">
                        <ToggleGroup
                            type="single"
                            size="sm"
                            spacing={0}
                            value={viewMode}
                            onValueChange={(value) =>
                                value && setViewMode(value as TankViewMode)
                            }
                            aria-label="Tank view"
                            className={cn(hudSurface, 'h-9 p-0')}
                        >
                            <ToggleGroupItem
                                value="orbit"
                                aria-label="3D view"
                                className={viewToggleItem}
                            >
                                <Box className="size-4" />
                                3D
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="flat"
                                aria-label="Front 2D view"
                                className={viewToggleItem}
                            >
                                <Square className="size-4" />
                                2D
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </main>

                {/* Slides as one: the pull tab stays reachable when closed. */}
                <div
                    className={cn(
                        'absolute inset-y-0 right-0 z-10 w-[min(20rem,85vw)] transition-transform duration-300 ease-in-out',
                        isPanelOpen ? 'translate-x-0' : 'translate-x-full',
                    )}
                >
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={togglePanel}
                                aria-label={
                                    isPanelOpen
                                        ? 'Hide tank panel'
                                        : 'Show tank panel'
                                }
                                aria-expanded={isPanelOpen}
                                aria-controls="tank-panel"
                                className="absolute top-0 right-full flex h-11 w-7 items-center justify-center rounded-l-md border border-r-0 border-sidebar-border/60 bg-sidebar/70 text-sidebar-foreground shadow-md backdrop-blur-md transition-colors outline-none hover:bg-sidebar focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {isPanelOpen ? (
                                    <ChevronRight className="size-4" />
                                ) : (
                                    <ChevronLeft className="size-4" />
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                            {isPanelOpen ? 'Hide panel' : 'Show panel'}{' '}
                            <Kbd className="ml-1 uppercase">
                                {PANEL_SHORTCUT}
                            </Kbd>
                        </TooltipContent>
                    </Tooltip>

                    <aside
                        id="tank-panel"
                        aria-label="Tank details"
                        inert={!isPanelOpen}
                        className="flex h-full flex-col border-l border-sidebar-border/60 bg-sidebar/70 text-sidebar-foreground shadow-xl backdrop-blur-md"
                    >
                        {/*
                         * Kept mounted (just hidden) while an inhabitant is
                         * selected, so Back returns to the same tab, search and
                         * scroll position. The fade replays whenever it reappears.
                         */}
                        <Tabs
                            value={tab}
                            onValueChange={(value) =>
                                changeTab(value as PanelTab)
                            }
                            className={cn(
                                'min-h-0 flex-1 gap-0 motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in-0',
                                (inhabitant !== null || decoration !== null) &&
                                    'hidden',
                            )}
                        >
                            <TabsList className="grid w-full shrink-0 grid-cols-6 gap-0 border-b border-sidebar-border bg-sidebar/60 p-0 group-data-horizontal/tabs:h-11">
                                {PANEL_TABS.map(
                                    ({ value, label, icon: Icon }) => (
                                        <Tooltip key={value}>
                                            <TooltipTrigger asChild>
                                                <TabsTrigger
                                                    value={value}
                                                    aria-label={label}
                                                    // The tooltip trigger overwrites
                                                    // data-state, so mark active here.
                                                    data-active={tab === value}
                                                    className={panelTabTrigger}
                                                >
                                                    <Icon />
                                                </TabsTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">
                                                {label}
                                            </TooltipContent>
                                        </Tooltip>
                                    ),
                                )}
                            </TabsList>

                            <PanelTabContent
                                value="summary"
                                direction={tabDirection}
                                className="flex flex-col"
                            >
                                <TankHeading tank={tank} />
                                <WaterPanel water={tank.water} />
                                <AirPanel
                                    air={tank.air}
                                    isSealed={tank.is_sealed}
                                />
                                <PopulationPanel
                                    creatures={tank.creatures}
                                    plants={tank.plants}
                                    species={species}
                                    onViewAll={() => changeTab('inhabitants')}
                                />
                                <EventLog
                                    events={events}
                                    fitToSpace
                                    onViewAll={() => changeTab('activity')}
                                />
                            </PanelTabContent>

                            <PanelTabContent
                                value="activity"
                                direction={tabDirection}
                            >
                                <EventLog events={events} />
                            </PanelTabContent>

                            <PanelTabContent
                                value="inhabitants"
                                direction={tabDirection}
                            >
                                <InhabitantList
                                    tankId={tank.id}
                                    creatures={tank.creatures}
                                    plants={tank.plants}
                                    species={species}
                                    stockConditions={{
                                        hasWater: tank.has_water,
                                        hasLand: tank.land_area_cm2 > 0,
                                        isSealed: tank.is_sealed,
                                    }}
                                    onSelect={select}
                                />
                            </PanelTabContent>

                            <PanelTabContent
                                value="management"
                                direction={tabDirection}
                            >
                                <ToolsPanel
                                    tankId={tank.id}
                                    lightOn={tank.light_on}
                                    hasWater={tank.has_water}
                                    isSealed={tank.is_sealed}
                                    onFeedRandomly={feedRandomly}
                                />
                                <SealedGuard isSealed={tank.is_sealed}>
                                    <WaterLevelPanel
                                        key={tank.grid.water_level}
                                        tankId={tank.id}
                                        grid={tank.grid}
                                        litres={tank.volume_litres}
                                        hasWater={tank.has_water}
                                    />
                                </SealedGuard>
                            </PanelTabContent>

                            <PanelTabContent
                                value="decor"
                                direction={tabDirection}
                            >
                                <SealedGuard isSealed={tank.is_sealed}>
                                    <SubstratePanel
                                        grid={tank.grid}
                                        brush={sculptBrush}
                                        onBrushChange={startSculpting}
                                        onApply={gravel.reshape}
                                        onUndo={gravel.undo}
                                        canUndo={gravel.canUndo}
                                    />
                                    <DecorCatalogue
                                        tankId={tank.id}
                                        catalogue={decorationCatalogue}
                                        placedCount={tank.decorations.length}
                                        onPlaced={(id) =>
                                            select({ kind: 'decoration', id })
                                        }
                                    />
                                </SealedGuard>
                            </PanelTabContent>

                            <PanelTabContent
                                value="equipment"
                                direction={tabDirection}
                            >
                                <LidPanel
                                    tankId={tank.id}
                                    isSealed={tank.is_sealed}
                                />
                                <BackgroundPanel
                                    tankId={tank.id}
                                    background={tank.background}
                                    onPreview={setPreviewBackground}
                                />
                                <SealedGuard isSealed={tank.is_sealed}>
                                    <AutoFeederPanel
                                        tankId={tank.id}
                                        feeder={tank.auto_feeder}
                                    />
                                </SealedGuard>
                            </PanelTabContent>
                        </Tabs>

                        {inhabitant !== null && (
                            <div className="min-h-0 flex-1 overflow-y-auto p-4 motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in-0 motion-safe:slide-in-from-right-4">
                                <InhabitantPanel
                                    tankId={tank.id}
                                    inhabitant={inhabitant}
                                    world={world}
                                    isSealed={tank.is_sealed}
                                    onMove={() =>
                                        setMoving({
                                            kind: inhabitant.kind,
                                            id: inhabitant.entity.id,
                                        })
                                    }
                                    onBack={() => setSelection(null)}
                                />
                            </div>
                        )}

                        {decoration !== null && (
                            <div className="min-h-0 flex-1 overflow-y-auto p-4 motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in-0 motion-safe:slide-in-from-right-4">
                                <DecorationPanel
                                    key={decoration.placed.id}
                                    tankId={tank.id}
                                    decoration={decoration.placed}
                                    definition={decoration.definition}
                                    plants={tank.plants.filter(
                                        (plant) =>
                                            plant.attachment?.decoration_id ===
                                            decoration.placed.id,
                                    )}
                                    species={species}
                                    grid={tank.grid}
                                    world={world}
                                    selectedAnchor={selectedAnchor}
                                    onSelectAnchor={setSelectedAnchor}
                                    onMove={(position, rotation) =>
                                        moveDecoration(
                                            decoration.placed.id,
                                            position,
                                            rotation,
                                        )
                                    }
                                    onSelectPlant={(id) =>
                                        select({ kind: 'plant', id })
                                    }
                                    isSealed={tank.is_sealed}
                                    onBack={() => select(null)}
                                />
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </>
    );
}

/**
 * One tab's scrolling content. Inactive tabs unmount, so each newly shown
 * tab plays its entrance: a fade plus a short slide from the side of the tab
 * that was chosen.
 */
function PanelTabContent({
    value,
    direction,
    className,
    children,
}: {
    value: PanelTab;
    direction: TabDirection;
    className?: string;
    children: ReactNode;
}) {
    return (
        <TabsContent
            value={value}
            className={cn(
                'min-h-0 divide-y divide-sidebar-border overflow-y-auto p-4 text-sm motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in-0',
                direction === 'right'
                    ? 'motion-safe:slide-in-from-right-4'
                    : 'motion-safe:slide-in-from-left-4',
                className,
            )}
        >
            {children}
        </TabsContent>
    );
}

function findInhabitant(
    tank: TankSnapshot,
    species: Species[],
    selection: TankSelection | null,
): Inhabitant | null {
    if (selection === null || selection.kind === 'decoration') {
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
