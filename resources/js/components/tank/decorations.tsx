import { TransformControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Color, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import type { Group, Object3D, PointLight } from 'three';
import { useDecorModels } from '@/hooks/use-decor-model';
import type { DecorModel } from '@/hooks/use-decor-model';
import { liveLighting } from '@/lib/tank/lighting';
import { cellToWorld, VOXEL, worldToCell } from '@/lib/tank/space';
import type { Heightmap } from '@/lib/tank/substrate-heightmap';
import { TerrainField } from '@/lib/tank/terrain-field';
import { rotateCell } from '@/lib/tank/voxel-volume';
import type { TankAxis } from '@/lib/tank/views';
import type { TankWorld } from '@/lib/tank/world';
import type {
    DecorationDefinition,
    DecorationLights,
    DecorationSnapshot,
    GridCell,
    PlantSnapshot,
    Species,
    TankGrid,
} from '@/types';
import {
    createHaloMaterial,
    HALO_RENDER_ORDER,
    haloGeometry,
    SELECTED_RENDER_ORDER,
} from './halo-material';
import { Plant } from './plants';
import { useSelectable } from './selection';
import { HIGHLIGHT_BRIGHTNESS } from './sway-material';
import { createVoxelMaterial } from './voxel-material';

type Props = {
    decorations: DecorationSnapshot[];
    catalogue: Map<string, DecorationDefinition>;
    /** Plants growing from decoration anchors. */
    plants: PlantSnapshot[];
    species: Map<number, Species>;
    world: TankWorld;
    grid: TankGrid;
    substrate: Heightmap;
    /** The move arrow to leave off: the one pointing at the viewer in a square-on 2D view. */
    hiddenAxis: TankAxis | null;
    /** Whether decorations may be moved (not through a sealed lid). */
    canArrange: boolean;
    selectedDecorationId: number | null;
    selectedPlantId: number | null;
    onSelectDecoration: (decorationId: number) => void;
    onSelectPlant: (plantId: number) => void;
    onSelectAnchor: (decorationId: number, anchor: number) => void;
    /** Commit a new position for a decoration dragged with the gizmo. */
    onMove: (decorationId: number, position: GridCell) => void;
    /** Called as a gizmo drag starts and ends, so other controls can stand aside. */
    onDragChange: (isDragging: boolean) => void;
};

/**
 * Renders the placed decorations, the plants growing on them, and a move
 * gizmo on the selected one. Also rebuilds the world's terrain field from the
 * substrate and decorations, so creatures keep out of them.
 */
export function Decorations({
    decorations,
    catalogue,
    plants,
    species,
    world,
    grid,
    substrate,
    hiddenAxis,
    canArrange,
    selectedDecorationId,
    selectedPlantId,
    onSelectDecoration,
    onSelectPlant,
    onSelectAnchor,
    onMove,
    onDragChange,
}: Props) {
    const models = useDecorModels(decorations, catalogue);
    const placementKey = decorations
        .map(
            (d) =>
                `${d.id}:${d.type}:${d.seed}:${d.rotation}:${d.position.join(',')}`,
        )
        .join('|');

    const terrain = useMemo(
        () =>
            new TerrainField(
                grid,
                substrate,
                decorations.flatMap((decoration) => {
                    const model = models.get(decoration.id);

                    return model === undefined
                        ? []
                        : [
                              {
                                  id: decoration.id,
                                  volume: model.volume,
                                  position: decoration.position,
                              },
                          ];
                }),
            ),
        // Rebuilt only when placements or the substrate actually change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            placementKey,
            substrate,
            grid.width,
            grid.height,
            grid.depth,
            grid.water_level,
        ],
    );

    useEffect(() => {
        world.terrain = terrain;
    }, [world, terrain]);

    useEffect(
        () => () => {
            world.terrain = null;
        },
        [world],
    );

    const material = useMemo(
        () => createVoxelMaterial(new Color('#ffffff')),
        [],
    );
    const highlighted = useMemo(
        () =>
            createVoxelMaterial(
                new Color('#ffffff'),
                new Color('#ffffff').multiplyScalar(HIGHLIGHT_BRIGHTNESS),
            ),
        [],
    );
    const halo = useMemo(() => createHaloMaterial(), []);

    useEffect(
        () => () => {
            material.dispose();
            highlighted.dispose();
            halo.dispose();
        },
        [material, highlighted, halo],
    );

    /** Only the first few lit decorations cast light on their surroundings; the rest just glow. */
    const glowingIds = decorations
        .filter((decoration) => decoration.lights?.on)
        .slice(0, MAX_LED_GLOWS)
        .map((decoration) => decoration.id);

    return (
        <group>
            {decorations.map((decoration) => {
                const definition = catalogue.get(decoration.type);
                const model = models.get(decoration.id);

                if (definition === undefined || model === undefined) {
                    return null;
                }

                const isSelected = decoration.id === selectedDecorationId;
                const content = (
                    <DecorationContent
                        decoration={decoration}
                        definition={definition}
                        model={model}
                        plants={plants.filter(
                            (plant) =>
                                plant.attachment?.decoration_id ===
                                decoration.id,
                        )}
                        species={species}
                        material={isSelected ? highlighted : material}
                        halo={isSelected ? halo : null}
                        selectedPlantId={selectedPlantId}
                        onSelect={() => onSelectDecoration(decoration.id)}
                        onSelectPlant={onSelectPlant}
                        onSelectAnchor={(anchor) =>
                            onSelectAnchor(decoration.id, anchor)
                        }
                        castsLight={glowingIds.includes(decoration.id)}
                    />
                );

                return isSelected && canArrange ? (
                    <DecorationGizmo
                        key={decoration.id}
                        decoration={decoration}
                        model={model}
                        grid={grid}
                        hiddenAxis={hiddenAxis}
                        onMove={(position) => onMove(decoration.id, position)}
                        onDragChange={onDragChange}
                    >
                        {content}
                    </DecorationGizmo>
                ) : (
                    <group
                        key={decoration.id}
                        position={cellToWorld(...decoration.position)}
                    >
                        {content}
                    </group>
                );
            })}
        </group>
    );
}

/** Marks decorations as somewhere things can be put down (see PlacementController). */
const PLACEABLE = { placeable: true };

type ContentProps = {
    decoration: DecorationSnapshot;
    definition: DecorationDefinition;
    model: DecorModel;
    plants: PlantSnapshot[];
    species: Map<number, Species>;
    material: ReturnType<typeof createVoxelMaterial>;
    halo: ReturnType<typeof createHaloMaterial> | null;
    selectedPlantId: number | null;
    onSelect: () => void;
    onSelectPlant: (plantId: number) => void;
    onSelectAnchor: (anchor: number) => void;
    /** Whether its LEDs light their surroundings, not just glow. */
    castsLight: boolean;
};

/**
 * One decoration's mesh, relative to its corner, with the plants on its
 * anchors and (while selected) markers on the free ones.
 */
function DecorationContent({
    decoration,
    definition,
    model,
    plants,
    species,
    material,
    halo,
    selectedPlantId,
    onSelect,
    onSelectPlant,
    onSelectAnchor,
    castsLight,
}: ContentProps) {
    const selectable = useSelectable(onSelect, {
        kind: 'decoration',
        id: decoration.id,
    });
    const anchors = useMemo(
        () =>
            definition.anchors.map((anchor) => {
                const [x, y, z] = rotateCell(
                    anchor,
                    definition.size,
                    decoration.rotation,
                );

                return new Vector3(
                    (x + 0.5) * VOXEL,
                    y * VOXEL,
                    (z + 0.5) * VOXEL,
                );
            }),
        [definition, decoration.rotation],
    );
    const occupied = new Set(plants.map((plant) => plant.attachment?.anchor));

    return (
        <>
            <mesh
                geometry={model.geometry}
                material={material}
                scale={VOXEL}
                renderOrder={halo !== null ? SELECTED_RENDER_ORDER : 0}
                userData={PLACEABLE}
                {...selectable}
            />
            {halo !== null && (
                <>
                    <mesh
                        geometry={haloGeometry(model.geometry)}
                        material={halo}
                        scale={VOXEL}
                        renderOrder={HALO_RENDER_ORDER}
                        raycast={() => null}
                    />
                    {anchors.map((position, index) =>
                        occupied.has(index) ? null : (
                            <AnchorMarker
                                key={index}
                                position={position}
                                onSelect={() => onSelectAnchor(index)}
                            />
                        ),
                    )}
                </>
            )}
            {plants.map((plant) => {
                const definitionOfPlant = species.get(plant.species_id);
                const position = anchors[plant.attachment?.anchor ?? -1];

                if (definitionOfPlant === undefined || position === undefined) {
                    return null;
                }

                return (
                    <Plant
                        key={plant.id}
                        plant={plant}
                        species={definitionOfPlant}
                        position={position}
                        isSelected={plant.id === selectedPlantId}
                        onSelect={() => onSelectPlant(plant.id)}
                    />
                );
            })}
            {decoration.lights?.on && (
                <DecorationLeds
                    lights={decoration.lights}
                    points={definition.light_points.map((point) =>
                        rotateCell(point, definition.size, decoration.rotation),
                    )}
                    castsLight={castsLight}
                />
            )}
        </>
    );
}

/** Most decorations whose LEDs cast real light (each point light costs every lit pixel). */
const MAX_LED_GLOWS = 6;

const LED_BEAD = new SphereGeometry(VOXEL * 1.4, 10, 8);

/** How brightly an LED bead glows (above 1 so the bloom picks it up). */
const LED_GLOW = 4;

/**
 * A decoration's LEDs: glowing beads at its light points, plus one small
 * light in their midst to tint what's nearby. On a timer they follow the
 * tank's lights, fading out as those come on (they look best in the dark).
 */
function DecorationLeds({
    lights,
    points,
    castsLight,
}: {
    lights: DecorationLights;
    points: GridCell[];
    castsLight: boolean;
}) {
    const material = useMemo(
        () =>
            new MeshStandardMaterial({
                color: lights.colour,
                emissive: lights.colour,
                toneMapped: false,
            }),
        [lights.colour],
    );
    const glow = useRef<PointLight>(null);
    const positions = useMemo(
        () =>
            points.map(
                ([x, y, z]) =>
                    new Vector3(
                        (x + 0.5) * VOXEL,
                        (y + 0.5) * VOXEL,
                        (z + 0.5) * VOXEL,
                    ),
            ),
        [points],
    );
    const middle = useMemo(
        () =>
            positions
                .reduce((sum, position) => sum.add(position), new Vector3())
                .divideScalar(Math.max(1, positions.length)),
        [positions],
    );

    useEffect(() => () => material.dispose(), [material]);

    useFrame(() => {
        let tankLight = 0;

        for (let index = 0; index < liveLighting.count; index++) {
            tankLight += liveLighting.lights[index].intensity;
        }

        const level =
            lights.mode === 'always' ? 1 : Math.max(0, 1 - tankLight * 1.5);

        material.emissiveIntensity = 0.3 + level * LED_GLOW;

        if (glow.current !== null) {
            glow.current.intensity = level * 0.25;
        }
    });

    return (
        <group>
            {positions.map((position, index) => (
                <mesh
                    key={index}
                    position={position}
                    geometry={LED_BEAD}
                    material={material}
                    raycast={() => null}
                />
            ))}
            {castsLight && (
                <pointLight
                    ref={glow}
                    position={middle}
                    color={lights.colour}
                    intensity={0}
                    distance={0.35}
                    decay={2}
                />
            )}
        </group>
    );
}

/** A ring marking a free anchor; clicking it offers to plant something there. */
function AnchorMarker({
    position,
    onSelect,
}: {
    position: Vector3;
    onSelect: () => void;
}) {
    const selectable = useSelectable(onSelect);

    return (
        <group position={position}>
            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.004, 0]}
                raycast={() => null}
            >
                <ringGeometry args={[0.012, 0.02, 20]} />
                <meshBasicMaterial
                    color="#7ee0c3"
                    transparent
                    opacity={0.9}
                    depthTest={false}
                />
            </mesh>
            {/* A larger invisible target, easier to hit than the thin ring. */}
            <mesh visible={false} {...selectable}>
                <sphereGeometry args={[0.03, 8, 8]} />
            </mesh>
        </group>
    );
}

type GizmoProps = {
    decoration: DecorationSnapshot;
    model: DecorModel;
    grid: TankGrid;
    /** The handle to leave off, as it would point straight at the viewer. */
    hiddenAxis: TankAxis | null;
    onMove: (position: GridCell) => void;
    onDragChange: (isDragging: boolean) => void;
    children: ReactNode;
};

/**
 * Arrow handles that move the selected decoration in whole grid cells,
 * kept inside the tank. The new position is committed when the drag ends.
 */
function DecorationGizmo({
    decoration,
    model,
    grid,
    hiddenAxis,
    onMove,
    onDragChange,
    children,
}: GizmoProps) {
    const group = useRef<Group>(null);
    const [width, height, depth] = model.volume.size;
    const scratch = useMemo(() => new Vector3(), []);

    /** The grid cell the group is nearest to, clamped so the decoration stays inside. */
    const snappedCell = (object: Object3D): GridCell => {
        const cell = worldToCell(object.position, scratch);

        return [
            clamp(Math.round(cell.x), 0, grid.width - width),
            clamp(Math.round(cell.y), 0, grid.height - height),
            clamp(Math.round(cell.z), 0, grid.depth - depth),
        ];
    };

    return (
        <TransformControls
            mode="translate"
            showX={hiddenAxis !== 'x'}
            showY={hiddenAxis !== 'y'}
            showZ={hiddenAxis !== 'z'}
            size={0.7}
            position={cellToWorld(...decoration.position)}
            onMouseDown={() => onDragChange(true)}
            onMouseUp={() => {
                onDragChange(false);

                const object = group.current?.parent;

                if (object === null || object === undefined) {
                    return;
                }

                const cell = snappedCell(object);

                if (
                    cell.some(
                        (value, axis) => value !== decoration.position[axis],
                    )
                ) {
                    onMove(cell);
                }
            }}
            onObjectChange={() => {
                const object = group.current?.parent;

                if (object !== null && object !== undefined) {
                    cellToWorld(...snappedCell(object), object.position);
                }
            }}
        >
            <group ref={group}>{children}</group>
        </TransformControls>
    );
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
