import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group, Vector3 } from 'three';
import { useVoxelModel } from '@/hooks/use-voxel-model';
import {
    laneOffset,
    layerToZ,
    PLANT_HEIGHT_UNIT,
    toWorld,
} from '@/lib/tank/space';
import { substrateHeightAt } from '@/lib/tank/terrain-field';
import type { PlantSnapshot, Species, TankGrid } from '@/types';
import {
    createHaloMaterial,
    HALO_RENDER_ORDER,
    haloGeometry,
    SELECTED_RENDER_ORDER,
} from './halo-material';
import { useSelectable } from './selection';
import {
    createSwayMaterial,
    healthTint,
    HIGHLIGHT_BRIGHTNESS,
} from './sway-material';

type Props = {
    /** Plants rooted in the substrate (attached plants render with their decoration). */
    plants: PlantSnapshot[];
    species: Map<number, Species>;
    layerCount: number;
    grid: TankGrid;
    substrate: number[];
    selectedId: number | null;
    onSelect: (plantId: number) => void;
};

export function Plants({
    plants,
    species,
    layerCount,
    grid,
    substrate,
    selectedId,
    onSelect,
}: Props) {
    return (
        <group>
            {plants.map((plant) => {
                const definition = species.get(plant.species_id);

                if (definition === undefined) {
                    return null;
                }

                return (
                    <RootedPlant
                        key={plant.id}
                        plant={plant}
                        species={definition}
                        layerCount={layerCount}
                        grid={grid}
                        substrate={substrate}
                        isSelected={plant.id === selectedId}
                        onSelect={() => onSelect(plant.id)}
                    />
                );
            })}
        </group>
    );
}

/** A plant rooted in its depth layer, standing on the substrate's surface. */
function RootedPlant({
    plant,
    layerCount,
    grid,
    substrate,
    ...props
}: Omit<PlantProps, 'position'> & {
    layerCount: number;
    grid: TankGrid;
    substrate: number[];
}) {
    const layer = Math.min(layerCount - 1, plant.layer);
    const position = useMemo(() => {
        const root = toWorld(plant.root[0], 0, 0.5).setZ(
            layerToZ(layer, layerCount) +
                laneOffset(plant.id, layerCount, PLANT_LANE_SALT),
        );

        return root.setY(substrateHeightAt(grid, substrate, root.x, root.z));
    }, [plant.id, plant.root, layer, layerCount, grid, substrate]);

    return <Plant plant={plant} position={position} {...props} />;
}

/** Offsets plant lanes from creature lanes, whose ids come from another table. */
const PLANT_LANE_SALT = 0.31;

type PlantProps = {
    plant: PlantSnapshot;
    species: Species;
    /** Where its roots are, relative to the parent group. */
    position: Vector3;
    isSelected: boolean;
    onSelect: () => void;
};

/**
 * A plant sprite as a swaying voxel mesh, rooted at `position`. The sprite is
 * the fully grown plant and is scaled to the current height. A second copy
 * turned 90° keeps it looking full when the tank is rotated.
 */
export function Plant({
    plant,
    species,
    position,
    isSelected,
    onSelect,
}: PlantProps) {
    const group = useRef<Group>(null);
    const selectable = useSelectable(onSelect);
    const growIn = useRef(0);
    const model = useVoxelModel(species);
    const height =
        plant.segments *
        (species.render.segment_height ?? 0.06) *
        PLANT_HEIGHT_UNIT;
    const scale = height / model.height;

    // Water plants sway in the current; edge plants barely; land plants not at all.
    const swayAmplitude =
        species.habitat === 'terrestrial'
            ? 0
            : species.habitat === 'emergent'
              ? 0.03
              : species.behaviour === 'whorl'
                ? 0.08
                : 0.12;
    const material = useMemo(
        () =>
            createSwayMaterial(
                healthTint(plant.health).multiplyScalar(
                    isSelected ? HIGHLIGHT_BRIGHTNESS : 1,
                ),
                swayAmplitude,
                model.height,
            ),
        [swayAmplitude, plant.health, model.height, isSelected],
    );

    useEffect(() => () => material.dispose(), [material]);

    const halo = useMemo(
        () =>
            isSelected
                ? createHaloMaterial({
                      sway: {
                          amplitude: swayAmplitude,
                          unitHeight: model.height,
                      },
                  })
                : null,
        [isSelected, swayAmplitude, model.height],
    );

    useEffect(() => () => halo?.dispose(), [halo]);

    useFrame((_, delta) => {
        if (group.current !== null && growIn.current < 1) {
            growIn.current = Math.min(1, growIn.current + delta / 2);
            group.current.scale.setScalar(growIn.current);
        }
    });

    const mirror = plant.id % 2 === 0 ? 1 : -1;

    return (
        <group ref={group} position={position} scale={0}>
            {/* Clicks hit the voxels themselves, so gaps between leaves stay see-through. */}
            <group {...selectable}>
                <mesh
                    geometry={model.geometry}
                    material={material}
                    scale={[scale * mirror, scale, scale]}
                    renderOrder={isSelected ? SELECTED_RENDER_ORDER : 0}
                />
                <mesh
                    geometry={model.geometry}
                    material={material}
                    rotation={[0, Math.PI / 2, 0]}
                    scale={[scale * 0.8 * mirror, scale * 0.92, scale]}
                    renderOrder={isSelected ? SELECTED_RENDER_ORDER : 0}
                />
            </group>
            {halo !== null && (
                <>
                    <mesh
                        geometry={haloGeometry(model.geometry)}
                        material={halo}
                        scale={[scale * mirror, scale, scale]}
                        renderOrder={HALO_RENDER_ORDER}
                        raycast={() => null}
                    />
                    <mesh
                        geometry={haloGeometry(model.geometry)}
                        material={halo}
                        rotation={[0, Math.PI / 2, 0]}
                        scale={[scale * 0.8 * mirror, scale * 0.92, scale]}
                        renderOrder={HALO_RENDER_ORDER}
                        raycast={() => null}
                    />
                </>
            )}
        </group>
    );
}
