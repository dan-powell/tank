import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Color, Group, Vector3 } from 'three';
import { useVoxelModel } from '@/hooks/use-voxel-model';
import {
    CM,
    laneOffset,
    layerToZ,
    TANK,
    toWorld,
    zoneRadiusToWorld,
} from '@/lib/tank/space';
import { createWanderState, steer } from '@/lib/tank/steering';
import type { SteeringProfile, WanderState } from '@/lib/tank/steering';
import type { CreatureBody, TankWorld } from '@/lib/tank/world';
import type { CreatureSnapshot, Species } from '@/types';
import {
    createHaloMaterial,
    HALO_RENDER_ORDER,
    haloGeometry,
    SELECTED_RENDER_ORDER,
} from './halo-material';
import { useSelectable } from './selection';
import { HIGHLIGHT_BRIGHTNESS } from './sway-material';
import { createVoxelMaterial } from './voxel-material';

type Props = {
    creatures: CreatureSnapshot[];
    species: Map<number, Species>;
    world: TankWorld;
    layerCount: number;
    isLit: boolean;
    lowOxygen: boolean;
    selectedId: number | null;
    onSelect: (creatureId: number) => void;
};

type Departed = {
    id: number;
    species: Species;
    size: number;
    position: Vector3;
    facing: 1 | -1;
};

/**
 * Renders the living creatures and briefly animates any that disappeared
 * from the latest snapshot (died) floating up and fading away.
 */
export function Creatures({
    creatures,
    species,
    world,
    layerCount,
    isLit,
    lowOxygen,
    selectedId,
    onSelect,
}: Props) {
    const [departed, setDeparted] = useState<Departed[]>([]);
    const previous = useRef<CreatureSnapshot[]>(creatures);

    useEffect(() => {
        const currentIds = new Set(creatures.map((creature) => creature.id));
        const gone: Departed[] = [];

        for (const creature of previous.current) {
            const body = world.creatures.get(creature.id);
            const definition = species.get(creature.species_id);

            if (
                !currentIds.has(creature.id) &&
                body !== undefined &&
                definition !== undefined &&
                !world.removedCreatures.has(creature.id)
            ) {
                gone.push({
                    id: creature.id,
                    species: definition,
                    size: creature.size,
                    position: body.position.clone(),
                    facing: body.facing,
                });
                world.creatures.delete(creature.id);
            }
        }

        previous.current = creatures;

        if (gone.length > 0) {
            setDeparted((current) => [...current, ...gone]);
        }
    }, [creatures, species, world]);

    return (
        <group>
            {creatures.map((creature) => {
                const definition = species.get(creature.species_id);

                if (definition === undefined) {
                    return null;
                }

                return (
                    <Creature
                        key={creature.id}
                        creature={creature}
                        species={definition}
                        world={world}
                        layerCount={layerCount}
                        isLit={isLit}
                        lowOxygen={lowOxygen}
                        isSelected={creature.id === selectedId}
                        onSelect={() => onSelect(creature.id)}
                    />
                );
            })}
            {departed.map((ghost) => (
                <DepartedCreature
                    key={`departed-${ghost.id}`}
                    ghost={ghost}
                    onDone={() =>
                        setDeparted((current) =>
                            current.filter((other) => other.id !== ghost.id),
                        )
                    }
                />
            ))}
        </group>
    );
}

type CreatureProps = {
    creature: CreatureSnapshot;
    species: Species;
    world: TankWorld;
    layerCount: number;
    isLit: boolean;
    lowOxygen: boolean;
    isSelected: boolean;
    onSelect: () => void;
};

/** Smallest hit box (world units), so fry stay clickable. */
const MIN_HIT_SIZE = 0.06;

/** Seconds a creature takes to turn round (the sprite faces right). */
const TURN_SECONDS = 0.4;

function Creature({
    creature,
    species,
    world,
    layerCount,
    isLit,
    lowOxygen,
    isSelected,
    onSelect,
}: CreatureProps) {
    const group = useRef<Group>(null);
    const selectable = useSelectable(onSelect);
    const model = useVoxelModel(species);
    const length = Math.max(creature.size, 0.3) * CM;
    const height = (model.height * length) / model.width;
    const centreY = species.behaviour === 'crawler' ? height / 2 : 0;
    const yaw = useRef<Group>(null);
    const wander = useRef<WanderState | null>(null);
    const homeLayer = Math.min(layerCount - 1, creature.zone.layer);
    const zoneCenter = useMemo(
        () => toWorld(creature.zone.center[0], creature.zone.center[1], 0.5),
        [creature.zone.center],
    );

    const body = useMemo<CreatureBody>(() => {
        const existing = world.creatures.get(creature.id);

        if (existing !== undefined) {
            return existing;
        }

        const spawn: CreatureBody = {
            speciesId: creature.species_id,
            position: new Vector3(
                zoneCenter.x + (Math.random() - 0.5) * 0.3,
                zoneCenter.y + (Math.random() - 0.5) * 0.1,
                layerToZ(homeLayer, layerCount) +
                    laneOffset(creature.id, layerCount),
            ),
            velocity: new Vector3(),
            homeLayer,
            layer: homeLayer,
            facing: Math.random() < 0.5 ? 1 : -1,
        };
        world.creatures.set(creature.id, spawn);

        return spawn;
    }, [
        creature.id,
        creature.species_id,
        world,
        zoneCenter,
        homeLayer,
        layerCount,
    ]);

    useEffect(() => {
        body.homeLayer = homeLayer;
    }, [body, homeLayer]);

    useEffect(
        () => () => {
            world.creatures.delete(creature.id);
        },
        [creature.id, world],
    );

    const profile: SteeringProfile = {
        id: creature.id,
        behaviour: species.behaviour,
        speed:
            (species.render.speed ?? 0.25) *
            (creature.size < (species.adult_size ?? 1) * 0.35 ? 0.7 : 1),
        schooling: species.render.schooling ?? 0,
        layerRoam: species.render.layer_roam ?? 0,
        layerCount,
        zoneCenter,
        zoneRadius: zoneRadiusToWorld(creature.zone.radius),
        hunger: creature.hunger,
        health: creature.health,
        isLit,
        lowOxygen,
    };

    useFrame((state, delta) => {
        const object = group.current;
        const turn = yaw.current;

        if (object === null || turn === null) {
            return;
        }

        const targetYaw = body.facing > 0 ? 0 : Math.PI;

        if (wander.current === null) {
            wander.current = { ...createWanderState(), direction: body.facing };
            turn.rotation.y = targetYaw;
        }

        steer(body, wander.current, profile, world, delta);
        object.position.copy(body.position);

        const step = (Math.PI / TURN_SECONDS) * Math.min(delta, 0.1);
        const remaining = targetYaw - turn.rotation.y;
        turn.rotation.y +=
            Math.abs(remaining) <= step
                ? remaining
                : Math.sign(remaining) * step;

        const speed = Math.abs(body.velocity.x) + 1e-4;
        const pitch = Math.atan2(body.velocity.y, speed) * 0.6;
        turn.rotation.z += (pitch - turn.rotation.z) * Math.min(1, delta * 5);

        const beat = 6 + body.velocity.length() * 40;
        object.rotation.y =
            Math.sin(state.clock.elapsedTime * beat + creature.id) *
            (species.behaviour === 'crawler' ? 0 : 0.12);
    });

    return (
        <group ref={group} position={body.position}>
            <group ref={yaw}>
                <VoxelCreature
                    species={species}
                    length={length}
                    tint={tailColour(species, creature.id)}
                    health={creature.health}
                    highlighted={isSelected}
                />
                {/* Invisible, slightly generous hit box: cheaper to raycast than the voxels. */}
                <mesh
                    position={[0, centreY, 0]}
                    visible={false}
                    {...selectable}
                >
                    <boxGeometry
                        args={[
                            Math.max(length * 1.1, MIN_HIT_SIZE),
                            Math.max(height * 1.2, MIN_HIT_SIZE),
                            Math.max(height * 0.8, MIN_HIT_SIZE),
                        ]}
                    />
                </mesh>
            </group>
        </group>
    );
}

/** Per-individual colour for tint-keyed sprite pixels (e.g. guppy tails). */
function tailColour(species: Species, creatureId: number): Color {
    if (!species.render.colorful_tail) {
        return new Color(species.render.body ?? '#b8c2cc');
    }

    return new Color().setHSL((((creatureId * 0.618) % 1) + 1) % 1, 0.8, 0.55);
}

type VoxelCreatureProps = {
    species: Species;
    /** Nose-to-tail length in world units. */
    length: number;
    tint: Color;
    health: number;
    /** Overall colour multiplier override (e.g. for the dead). */
    shade?: Color;
    opacity?: number;
    /** Selected: brightened and surrounded by a halo. */
    highlighted?: boolean;
};

/**
 * The species sprite as a voxel mesh, scaled to the creature's length and
 * centred on its body (crawlers sit on their base instead).
 */
function VoxelCreature({
    species,
    length,
    tint,
    health,
    shade,
    opacity = 1,
    highlighted = false,
}: VoxelCreatureProps) {
    const model = useVoxelModel(species);
    const tintHex = tint.getHexString();
    const shadeHex = shade?.getHexString();
    const material = useMemo(() => {
        const colour =
            shadeHex === undefined
                ? new Color('#ffffff').lerp(
                      new Color('#7a7a7a'),
                      (1 - health) * 0.6,
                  )
                : new Color(`#${shadeHex}`);

        if (highlighted) {
            colour.multiplyScalar(HIGHLIGHT_BRIGHTNESS);
        }

        const created = createVoxelMaterial(new Color(`#${tintHex}`), colour);
        created.transparent = opacity < 1;
        created.opacity = opacity;

        return created;
    }, [tintHex, shadeHex, health, opacity, highlighted]);

    useEffect(() => () => material.dispose(), [material]);

    const halo = useMemo(
        () => (highlighted ? createHaloMaterial() : null),
        [highlighted],
    );

    useEffect(() => () => halo?.dispose(), [halo]);

    const scale = length / model.width;
    const lift = species.behaviour === 'crawler' ? 0 : -model.height / 2;

    return (
        <>
            <mesh
                geometry={model.geometry}
                material={material}
                scale={scale}
                position={[0, lift * scale, 0]}
                renderOrder={highlighted ? SELECTED_RENDER_ORDER : 0}
            />
            {halo !== null && (
                <mesh
                    geometry={haloGeometry(model.geometry)}
                    material={halo}
                    scale={scale}
                    position={[0, lift * scale, 0]}
                    renderOrder={HALO_RENDER_ORDER}
                    raycast={() => null}
                />
            )}
        </>
    );
}

const FLOAT_SECONDS = 5;

function DepartedCreature({
    ghost,
    onDone,
}: {
    ghost: Departed;
    onDone: () => void;
}) {
    const group = useRef<Group>(null);
    const elapsed = useRef(0);
    const finished = useRef(false);
    const length = Math.max(ghost.size, 0.3) * CM;

    useFrame((_, delta) => {
        const object = group.current;

        if (object === null || finished.current) {
            return;
        }

        elapsed.current += delta;
        object.position.y = Math.min(
            TANK.waterLine - 0.02,
            object.position.y + delta * 0.08,
        );
        object.rotation.x = Math.min(Math.PI, object.rotation.x + delta * 1.5);
        object.scale.setScalar(
            Math.max(0.01, 1 - elapsed.current / FLOAT_SECONDS),
        );

        if (elapsed.current >= FLOAT_SECONDS) {
            finished.current = true;
            onDone();
        }
    });

    return (
        <group ref={group} position={ghost.position}>
            <group rotation={[0, ghost.facing > 0 ? 0 : Math.PI, 0]}>
                <VoxelCreature
                    species={ghost.species}
                    length={length}
                    tint={new Color('#9a9a9a')}
                    health={0}
                    shade={new Color('#9a9a9a')}
                    opacity={0.8}
                />
            </group>
        </group>
    );
}
