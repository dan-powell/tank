import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Color, Group, Material, Mesh, Vector3 } from 'three';
import {
    framesFor,
    stageFor,
    useSpeciesModel,
} from '@/hooks/use-species-model';
import type { ModelFrame } from '@/hooks/use-species-model';
import {
    laneOffset,
    layerToZ,
    TANK,
    toWorld,
    VOXEL,
    zoneRadiusToWorld,
} from '@/lib/tank/space';
import { createWanderState, standsOnBase, steer } from '@/lib/tank/steering';
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

/** Seconds a creature takes to turn round (models face right). */
const TURN_SECONDS = 0.4;

/** Seconds of the squash-and-stretch played when a creature grows into its next stage. */
const POP_SECONDS = 0.35;

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
    const model = useSpeciesModel(species);
    const stage = stageFor(species, model, creature.size);
    const frame = framesFor(model, stage, 'idle')[0];
    const length = (frame?.size[0] ?? 1) * VOXEL;
    const height = (frame?.size[1] ?? 1) * VOXEL;
    const depth = (frame?.size[2] ?? 1) * VOXEL;
    const centreY = standsOnBase(species.behaviour) ? height / 2 : 0;
    const yaw = useRef<Group>(null);
    const pop = useRef<Group>(null);
    const shownStage = useRef(stage);
    const popStarted = useRef<number | null>(null);
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

        if (world.terrain !== null) {
            if (
                species.habitat === 'terrestrial' ||
                species.habitat === 'amphibious'
            ) {
                // Land animals start out on dry ground near their home.
                world.terrain.moveToLandNear(spawn.position);
            } else if (!world.terrain.isFree(spawn.position)) {
                world.terrain.moveToFreeCell(spawn.position);
            }
        }

        world.creatures.set(creature.id, spawn);

        return spawn;
    }, [
        creature.id,
        creature.species_id,
        species.habitat,
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
        habitat: species.habitat,
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
            (standsOnBase(species.behaviour) ? 0 : 0.12);

        if (shownStage.current !== stage) {
            shownStage.current = stage;
            popStarted.current = state.clock.elapsedTime;
        }

        const popping = pop.current;

        if (popping !== null && popStarted.current !== null) {
            const t =
                (state.clock.elapsedTime - popStarted.current) / POP_SECONDS;
            const squash = t >= 1 ? 0 : Math.sin(Math.PI * t) * 0.25;
            popping.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);

            if (t >= 1) {
                popStarted.current = null;
            }
        }
    });

    return (
        <group ref={group} position={body.position}>
            <group ref={yaw}>
                <group ref={pop}>
                    {frame !== undefined && (
                        <VoxelCreature
                            species={species}
                            frame={frame}
                            tint={tailColour(species, creature.id)}
                            health={creature.health}
                            highlighted={isSelected}
                        />
                    )}
                </group>
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
                            Math.max(depth * 1.2, MIN_HIT_SIZE),
                        ]}
                    />
                </mesh>
            </group>
        </group>
    );
}

/** Per-individual colour for tint-keyed voxels (e.g. guppy tails). */
function tailColour(species: Species, creatureId: number): Color {
    if (!species.render.colorful_tail) {
        return new Color(species.render.body ?? '#b8c2cc');
    }

    return new Color().setHSL((((creatureId * 0.618) % 1) + 1) % 1, 0.8, 0.55);
}

type VoxelCreatureProps = {
    species: Species;
    frame: ModelFrame;
    tint: Color;
    health: number;
    /** Overall colour multiplier override (e.g. for the dead). */
    shade?: Color;
    opacity?: number;
    /** Selected: brightened and surrounded by a halo. */
    highlighted?: boolean;
};

/**
 * One frame of a species model at the shared voxel size, centred on its body
 * (crawlers and walkers stand on their base instead).
 */
function VoxelCreature({
    species,
    frame,
    tint,
    health,
    shade,
    opacity = 1,
    highlighted = false,
}: VoxelCreatureProps) {
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

    const lift = standsOnBase(species.behaviour) ? 0 : -frame.size[1] / 2;

    return (
        <>
            <mesh
                geometry={frame.geometry}
                material={material}
                scale={VOXEL}
                position={[0, lift * VOXEL, 0]}
                renderOrder={highlighted ? SELECTED_RENDER_ORDER : 0}
            />
            {halo !== null && (
                <mesh
                    geometry={haloGeometry(frame.geometry)}
                    material={halo}
                    scale={VOXEL}
                    position={[0, lift * VOXEL, 0]}
                    renderOrder={HALO_RENDER_ORDER}
                    raycast={() => null}
                />
            )}
        </>
    );
}

/** Seconds the dead take to float up (or lie still on land) and fade away. */
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
    const model = useSpeciesModel(ghost.species);
    const frame = framesFor(
        model,
        stageFor(ghost.species, model, ghost.size),
        'idle',
    )[0];

    useFrame((_, delta) => {
        const object = group.current;

        if (object === null || finished.current) {
            return;
        }

        elapsed.current += delta;

        // The dead float up through water; on land they just fade where they lie.
        if (object.position.y < TANK.waterLine) {
            object.position.y = Math.min(
                TANK.waterLine - 0.02,
                object.position.y + delta * 0.08,
            );
            object.rotation.x = Math.min(
                Math.PI,
                object.rotation.x + delta * 1.5,
            );
        }
        const opacity = 0.8 * Math.max(0, 1 - elapsed.current / FLOAT_SECONDS);
        object.traverse((child) => {
            if (child instanceof Mesh && child.material instanceof Material) {
                child.material.opacity = opacity;
            }
        });

        if (elapsed.current >= FLOAT_SECONDS) {
            finished.current = true;
            onDone();
        }
    });

    return (
        <group ref={group} position={ghost.position}>
            <group rotation={[0, ghost.facing > 0 ? 0 : Math.PI, 0]}>
                {frame !== undefined && (
                    <VoxelCreature
                        species={ghost.species}
                        frame={frame}
                        tint={new Color('#9a9a9a')}
                        health={0}
                        shade={new Color('#9a9a9a')}
                        opacity={0.8}
                    />
                )}
            </group>
        </group>
    );
}
