import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Group, Vector3 } from 'three';
import { useSpeciesModel } from '@/hooks/use-species-model';
import { assembleMoss, assemblePlant } from '@/lib/tank/plant-assembly';
import { laneOffset, layerToZ, toWorld, VOXEL } from '@/lib/tank/space';
import type { Heightmap } from '@/lib/tank/substrate-heightmap';
import { substrateHeightAt } from '@/lib/tank/terrain-field';
import { buildVolumeGeometry, TINT_INDEX } from '@/lib/tank/voxel-volume';
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
    substrate: Heightmap;
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
}: Omit<PlantProps, 'position' | 'groundAt'> & {
    layerCount: number;
    grid: TankGrid;
    substrate: Heightmap;
}) {
    const layer = Math.min(layerCount - 1, plant.layer);
    const position = useMemo(() => {
        const root = toWorld(plant.root[0], 0, 0.5).setZ(
            layerToZ(layer, layerCount) +
                laneOffset(plant.id, layerCount, PLANT_LANE_SALT),
        );

        return root.setY(substrateHeightAt(grid, substrate, root.x, root.z));
    }, [plant.id, plant.root, layer, layerCount, grid, substrate]);
    const groundAt = useCallback(
        (dx: number, dz: number) =>
            (substrateHeightAt(
                grid,
                substrate,
                position.x + dx * VOXEL,
                position.z + dz * VOXEL,
            ) -
                position.y) /
            VOXEL,
        [grid, substrate, position],
    );

    return (
        <Plant
            plant={plant}
            position={position}
            groundAt={groundAt}
            {...props}
        />
    );
}

/** Offsets plant lanes from creature lanes, whose ids come from another table. */
const PLANT_LANE_SALT = 0.31;

/** Seconds a newly planted plant takes to rise out of the ground. */
const SPROUT_SECONDS = 2;

/** Flat ground, for plants on a decoration. */
const flatGround = () => 0;

type PlantProps = {
    plant: PlantSnapshot;
    species: Species;
    /** Where its roots are, relative to the parent group. */
    position: Vector3;
    /** Ground height (voxels, relative to the roots) at an offset from them, for spreading moss. */
    groundAt?: (dx: number, dz: number) => number;
    isSelected: boolean;
    onSelect: () => void;
};

/**
 * A plant built from its species' voxel parts and rooted at `position`:
 * stalks one stem part per growth segment (moss: one patch per segment,
 * spreading over the ground), swaying with the current. It grows by gaining
 * parts, never by scaling, so every voxel stays the same size.
 */
export function Plant({
    plant,
    species,
    position,
    groundAt = flatGround,
    isSelected,
    onSelect,
}: PlantProps) {
    const rise = useRef<Group>(null);
    const selectable = useSelectable(onSelect);
    const sprout = useRef(0);
    const model = useSpeciesModel(species);
    const assembled = useMemo(
        () =>
            species.behaviour === 'cushion'
                ? assembleMoss(model, plant.segments, plant.id, groundAt)
                : assemblePlant(model, species, plant.segments, plant.id),
        [model, species, plant.segments, plant.id, groundAt],
    );
    const geometry = useMemo(() => {
        const [ox, oy, oz] = assembled.origin;
        const built = buildVolumeGeometry(assembled.volume, {
            tintIndex: TINT_INDEX,
        });
        built.translate(-(ox + 0.5), -oy, -(oz + 0.5));

        return built;
    }, [assembled]);

    useEffect(() => () => geometry.dispose(), [geometry]);

    /** Height above the roots, in voxels. */
    const height = Math.max(1, assembled.volume.size[1] - assembled.origin[1]);

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
                height,
            ),
        [swayAmplitude, plant.health, height, isSelected],
    );

    useEffect(() => () => material.dispose(), [material]);

    const halo = useMemo(
        () =>
            isSelected
                ? createHaloMaterial({
                      sway: { amplitude: swayAmplitude, unitHeight: height },
                  })
                : null,
        [isSelected, swayAmplitude, height],
    );

    useEffect(() => () => halo?.dispose(), [halo]);

    // New plants rise out of the ground (or their decoration) instead of scaling up.
    useFrame((_, delta) => {
        if (rise.current !== null && sprout.current < 1) {
            sprout.current = Math.min(
                1,
                sprout.current + delta / SPROUT_SECONDS,
            );
            rise.current.position.y = -(1 - sprout.current) * height * VOXEL;
        }
    });

    return (
        <group position={position}>
            <group ref={rise} position={[0, -height * VOXEL, 0]}>
                {/* Clicks hit the voxels themselves, so gaps between leaves stay see-through. */}
                <mesh
                    geometry={geometry}
                    material={material}
                    scale={VOXEL}
                    renderOrder={isSelected ? SELECTED_RENDER_ORDER : 0}
                    {...selectable}
                />
                {halo !== null && (
                    <mesh
                        geometry={haloGeometry(geometry)}
                        material={halo}
                        scale={VOXEL}
                        renderOrder={HALO_RENDER_ORDER}
                        raycast={() => null}
                    />
                )}
            </group>
        </group>
    );
}
