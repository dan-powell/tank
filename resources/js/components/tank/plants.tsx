import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { useVoxelModel } from '@/hooks/use-voxel-model';
import { laneOffset, layerToZ, TANK, toWorld } from '@/lib/tank/space';
import type { PlantSnapshot, Species } from '@/types';
import { createSwayMaterial, healthTint } from './sway-material';

type Props = {
    plants: PlantSnapshot[];
    species: Map<number, Species>;
    layerCount: number;
};

export function Plants({ plants, species, layerCount }: Props) {
    return (
        <group>
            {plants.map((plant) => {
                const definition = species.get(plant.species_id);

                if (definition === undefined) {
                    return null;
                }

                return (
                    <Plant
                        key={plant.id}
                        plant={plant}
                        species={definition}
                        layerCount={layerCount}
                    />
                );
            })}
        </group>
    );
}

/** Offsets plant lanes from creature lanes, whose ids come from another table. */
const PLANT_LANE_SALT = 0.31;

type PlantProps = {
    plant: PlantSnapshot;
    species: Species;
    layerCount: number;
};

/**
 * A plant sprite as a swaying voxel mesh, rooted in its depth layer. The
 * sprite is the fully grown plant and is scaled to the current height. A
 * second copy turned 90° keeps it looking full when the tank is rotated.
 */
function Plant({ plant, species, layerCount }: PlantProps) {
    const group = useRef<Group>(null);
    const growIn = useRef(0);
    const model = useVoxelModel(species);
    const height =
        plant.segments * (species.render.segment_height ?? 0.06) * TANK.height;
    const scale = height / model.height;
    const layer = Math.min(layerCount - 1, plant.layer);
    const position = useMemo(
        () =>
            toWorld(plant.root[0], 0, 0.5)
                .setY(TANK.substrate)
                .setZ(
                    layerToZ(layer, layerCount) +
                        laneOffset(plant.id, layerCount, PLANT_LANE_SALT),
                ),
        [plant.id, plant.root, layer, layerCount],
    );

    const material = useMemo(
        () =>
            createSwayMaterial(
                healthTint(plant.health),
                species.behaviour === 'whorl' ? 0.08 : 0.12,
                model.height,
            ),
        [species.behaviour, plant.health, model.height],
    );

    useEffect(() => () => material.dispose(), [material]);

    useFrame((_, delta) => {
        if (group.current !== null && growIn.current < 1) {
            growIn.current = Math.min(1, growIn.current + delta / 2);
            group.current.scale.setScalar(growIn.current);
        }
    });

    const mirror = plant.id % 2 === 0 ? 1 : -1;

    return (
        <group ref={group} position={position} scale={0}>
            <mesh
                geometry={model.geometry}
                material={material}
                scale={[scale * mirror, scale, scale]}
            />
            <mesh
                geometry={model.geometry}
                material={material}
                rotation={[0, Math.PI / 2, 0]}
                scale={[scale * 0.8 * mirror, scale * 0.92, scale]}
            />
        </group>
    );
}
