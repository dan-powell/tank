import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
    BoxGeometry,
    BufferGeometry,
    CylinderGeometry,
    Group,
    PlaneGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TANK, toWorld } from '@/lib/tank/space';
import type { PlantSnapshot, Species } from '@/types';
import { createSwayMaterial, healthTint } from './sway-material';

type Props = {
    plants: PlantSnapshot[];
    species: Map<number, Species>;
};

export function Plants({ plants, species }: Props) {
    return (
        <group>
            {plants.map((plant) => {
                const definition = species.get(plant.species_id);

                if (definition === undefined) {
                    return null;
                }

                return (
                    <Plant key={plant.id} plant={plant} species={definition} />
                );
            })}
        </group>
    );
}

function Plant({ plant, species }: { plant: PlantSnapshot; species: Species }) {
    const group = useRef<Group>(null);
    const growIn = useRef(0);
    const segmentHeight = (species.render.segment_height ?? 0.06) * TANK.height;
    const height = plant.segments * segmentHeight;
    const position = useMemo(
        () => toWorld(...plant.root).setY(TANK.substrate),
        [plant.root],
    );

    const geometry = useMemo(
        () =>
            species.behaviour === 'whorl'
                ? hornwortGeometry(plant.segments, segmentHeight)
                : ribbonGeometry(species.render.blades ?? 4, height, plant.id),
        [
            species.behaviour,
            species.render.blades,
            plant.segments,
            segmentHeight,
            height,
            plant.id,
        ],
    );
    const material = useMemo(
        () =>
            createSwayMaterial(
                healthTint(species.render.color ?? '#4f9d3a', plant.health),
                species.behaviour === 'whorl' ? 0.08 : 0.12,
            ),
        [species.render.color, species.behaviour, plant.health],
    );

    useEffect(() => () => geometry.dispose(), [geometry]);
    useEffect(() => () => material.dispose(), [material]);

    useFrame((_, delta) => {
        if (group.current !== null && growIn.current < 1) {
            growIn.current = Math.min(1, growIn.current + delta / 2);
            group.current.scale.setScalar(growIn.current);
        }
    });

    return (
        <group
            ref={group}
            position={position}
            rotation={[0, (plant.id * 2.399) % (Math.PI * 2), 0]}
            scale={0}
        >
            <mesh geometry={geometry} material={material} />
        </group>
    );
}

/** Several tall ribbon blades fanning out from one crown. */
function ribbonGeometry(
    blades: number,
    height: number,
    seed: number,
): BufferGeometry {
    const parts = Array.from({ length: blades }, (_, index) => {
        const bladeHeight =
            height * (0.75 + 0.25 * Math.abs(Math.sin(seed + index * 1.7)));
        const blade = new PlaneGeometry(
            0.03,
            bladeHeight,
            1,
            Math.max(2, Math.round(bladeHeight / 0.04)),
        );
        blade.translate(0, bladeHeight / 2, 0);
        blade.rotateZ((index - (blades - 1) / 2) * 0.08);
        blade.rotateY((index / blades) * Math.PI);

        return blade;
    });

    return mergeGeometries(parts) ?? new BufferGeometry();
}

/** A thin stem with a whorl of needle-like leaves at every segment. */
function hornwortGeometry(
    segments: number,
    segmentHeight: number,
): BufferGeometry {
    const height = segments * segmentHeight;
    const stem = new CylinderGeometry(
        0.005,
        0.007,
        height,
        5,
        Math.max(2, segments),
    );
    stem.translate(0, height / 2, 0);
    const parts: BufferGeometry[] = [stem];

    for (let segment = 1; segment <= segments; segment++) {
        const y = segment * segmentHeight - segmentHeight * 0.3;
        const length = 0.05 * (1 - (segment / (segments + 2)) * 0.4);

        for (let needle = 0; needle < 8; needle++) {
            const leaf = new BoxGeometry(0.004, length, 0.004);
            leaf.translate(0, length / 2, 0);
            leaf.rotateZ(1.0);
            leaf.rotateY((needle / 8) * Math.PI * 2 + segment * 0.4);
            leaf.translate(0, y, 0);
            parts.push(leaf);
        }
    }

    return mergeGeometries(parts) ?? new BufferGeometry();
}
