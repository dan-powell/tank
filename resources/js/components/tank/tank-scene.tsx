import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { MOUSE } from 'three';
import type { Vector3 } from 'three';
import { TANK } from '@/lib/tank/space';
import type { TankWorld } from '@/lib/tank/world';
import type { SculptBrush } from '@/lib/tank/substrate-sculpt';
import type {
    DecorationDefinition,
    GridCell,
    Species,
    TankBackground,
    TankSelection,
    TankSnapshot,
} from '@/types';
import { AutoFeederModel } from './auto-feeder-model';
import { causticUniforms } from './caustics';
import { Creatures } from './creatures';
import { Decorations } from './decorations';
import { Substrate } from './substrate';
import { PlacementController } from './placement';
import type { PlacementMode } from './placement';
import { FoodParticles } from './food-particles';
import { haloUniforms } from './halo-material';
import { Plants } from './plants';
import { sceneClock } from './scene-clock';
import { TankBackdrop } from './tank-backdrop';
import { orbitStart, TankCameraRig } from './tank-camera-rig';
import type { TankViewMode } from './tank-camera-rig';
import { TankPanControls } from './tank-pan-controls';
import { TankEnvironment } from './tank-environment';
import { WaterVolume } from './water-volume';

type Props = {
    tank: TankSnapshot;
    species: Species[];
    world: TankWorld;
    viewMode: TankViewMode;
    decorationCatalogue: DecorationDefinition[];
    selection: TankSelection | null;
    onSelect: (selection: TankSelection | null) => void;
    /** A free anchor on a decoration was picked, to plant something there. */
    onSelectAnchor: (decorationId: number, anchor: number) => void;
    onMoveDecoration: (decorationId: number, position: GridCell) => void;
    /** The sculpting brush while sculpt mode is on; selection is paused meanwhile. */
    sculptBrush: SculptBrush | null;
    onSculpt: (heights: number[]) => void;
    /** While an inhabitant is being moved: how to read the click, and where it landed. */
    placement: PlacementMode | null;
    onPlace: (point: Vector3) => void;
    /** An unsaved backdrop being tried out, shown instead of the tank's own. */
    previewBackground?: TankBackground | null;
};

/** Clicks this soon (ms) after a gizmo drag ends belong to the gizmo, not the empty water. */
const GIZMO_CLICK_GRACE = 300;

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
    decorationCatalogue,
    selection,
    onSelect: select,
    onSelectAnchor: selectAnchor,
    onMoveDecoration,
    sculptBrush,
    onSculpt,
    placement,
    onPlace,
    previewBackground = null,
}: Props) {
    const isSculpting = sculptBrush !== null || placement !== null;
    const onSelect = (next: TankSelection | null) => {
        if (!isSculpting) {
            select(next);
        }
    };
    const onSelectAnchor = (decorationId: number, anchor: number) => {
        if (!isSculpting) {
            selectAnchor(decorationId, anchor);
        }
    };
    const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
    const [start] = useState(orbitStart);

    const waterLevel = tank.grid.water_level;

    useEffect(() => {
        causticUniforms.uCausticWaterLine.value = TANK.waterLine;

        if (!tank.has_water) {
            causticUniforms.uCausticStrength.value = 0;
        }
    }, [waterLevel, tank.has_water]);
    const lastGizmoUse = useRef(0);
    const speciesById = useMemo(
        () => new Map(species.map((definition) => [definition.id, definition])),
        [species],
    );
    const catalogue = useMemo(
        () =>
            new Map(
                decorationCatalogue.map((definition) => [
                    definition.slug,
                    definition,
                ]),
            ),
        [decorationCatalogue],
    );
    const placedIds = new Set(
        tank.decorations.map((decoration) => decoration.id),
    );
    const attachedPlants = tank.plants.filter(
        (plant) =>
            plant.attachment !== null &&
            placedIds.has(plant.attachment.decoration_id),
    );
    const rootedPlants = tank.plants.filter(
        (plant) => !attachedPlants.includes(plant),
    );

    /** While dragging a decoration, orbiting and panning (which checks `enabled`) stand aside. */
    const setGizmoDragging = (isDragging: boolean) => {
        lastGizmoUse.current = performance.now();

        if (controls.current !== null) {
            controls.current.enabled = !isDragging;
        }
    };

    useEffect(() => {
        world.scatterSunkenFood(
            Math.min(40, Math.round(tank.water.uneaten_food * 150)),
        );
        // Only on first load: later food comes from the user's own feeding.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [world]);

    return (
        <Canvas
            camera={{ position: start.position, fov: start.fov }}
            dpr={[1, 2]}
            gl={{ antialias: true }}
            onPointerMissed={() => {
                if (
                    performance.now() - lastGizmoUse.current >
                    GIZMO_CLICK_GRACE
                ) {
                    onSelect(null);
                }
            }}
        >
            <TankBackdrop
                background={previewBackground ?? tank.background}
                isLit={tank.is_lit}
            />
            <SceneClock />
            <HaloResolution />
            <TankEnvironment
                water={tank.water}
                isLit={tank.is_lit}
                grid={tank.grid}
                substrate={tank.substrate}
                hasWater={tank.has_water}
                isSealed={tank.is_sealed}
                humidity={tank.air.humidity}
                showEdges={viewMode === 'orbit'}
            />
            <Substrate
                grid={tank.grid}
                heights={tank.substrate}
                brush={sculptBrush}
                onSculpt={onSculpt}
                onStrokeChange={setGizmoDragging}
            />
            <Suspense fallback={null}>
                <Decorations
                    decorations={tank.decorations}
                    catalogue={catalogue}
                    plants={attachedPlants}
                    species={speciesById}
                    world={world}
                    grid={tank.grid}
                    substrate={tank.substrate}
                    viewMode={viewMode}
                    canArrange={!tank.is_sealed}
                    selectedDecorationId={
                        selection?.kind === 'decoration' ? selection.id : null
                    }
                    selectedPlantId={
                        selection?.kind === 'plant' ? selection.id : null
                    }
                    onSelectDecoration={(id) =>
                        onSelect({ kind: 'decoration', id })
                    }
                    onSelectPlant={(id) => onSelect({ kind: 'plant', id })}
                    onSelectAnchor={onSelectAnchor}
                    onMove={onMoveDecoration}
                    onDragChange={setGizmoDragging}
                />
            </Suspense>
            <Suspense fallback={null}>
                <Plants
                    plants={rootedPlants}
                    species={speciesById}
                    layerCount={tank.layer_count}
                    grid={tank.grid}
                    substrate={tank.substrate}
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
                target={start.target}
                enablePan={false}
                mouseButtons={MOUSE_BUTTONS}
            />
            <TankCameraRig mode={viewMode} controls={controls} />
            <TankPanControls controls={controls} />
            {placement !== null && (
                <PlacementController mode={placement} onPlace={onPlace} />
            )}
            {/* Last, so its refraction pass sees this frame's camera. */}
            {tank.has_water && (
                <WaterVolume
                    key={waterLevel}
                    water={tank.water}
                    isLit={tank.is_lit}
                    world={world}
                />
            )}
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
