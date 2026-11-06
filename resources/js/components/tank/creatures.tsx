import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Mesh } from 'three';
import { Color, Group, Quaternion, Vector3 } from 'three';
import { CM, toWorld, TANK, zoneRadiusToWorld } from '@/lib/tank/space';
import { steer } from '@/lib/tank/steering';
import type { SteeringProfile, WanderState } from '@/lib/tank/steering';
import type { CreatureBody, TankWorld } from '@/lib/tank/world';
import type { CreatureSnapshot, Species } from '@/types';

type Props = {
    creatures: CreatureSnapshot[];
    species: Map<number, Species>;
    world: TankWorld;
    isLit: boolean;
    lowOxygen: boolean;
};

type Departed = {
    id: number;
    species: Species;
    size: number;
    position: Vector3;
};

/**
 * Renders the living creatures and briefly animates any that disappeared
 * from the latest snapshot (died) floating up and fading away.
 */
export function Creatures({
    creatures,
    species,
    world,
    isLit,
    lowOxygen,
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
                definition !== undefined
            ) {
                gone.push({
                    id: creature.id,
                    species: definition,
                    size: creature.size,
                    position: body.position.clone(),
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
                        isLit={isLit}
                        lowOxygen={lowOxygen}
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
    isLit: boolean;
    lowOxygen: boolean;
};

const lookTarget = new Vector3();
const targetQuaternion = new Quaternion();
const helper = new Group();

function Creature({
    creature,
    species,
    world,
    isLit,
    lowOxygen,
}: CreatureProps) {
    const group = useRef<Group>(null);
    const tail = useRef<Mesh>(null);
    const wander = useRef<WanderState>({
        heading: Math.random() * Math.PI * 2,
        pitch: 0,
    });
    const zoneCenter = useMemo(
        () => toWorld(...creature.zone.center),
        [creature.zone.center],
    );

    const body = useMemo<CreatureBody>(() => {
        const existing = world.creatures.get(creature.id);

        if (existing !== undefined) {
            return existing;
        }

        const spawn: CreatureBody = {
            speciesId: creature.species_id,
            position: zoneCenter
                .clone()
                .add(
                    new Vector3(
                        (Math.random() - 0.5) * 0.3,
                        (Math.random() - 0.5) * 0.1,
                        (Math.random() - 0.5) * 0.3,
                    ),
                ),
            velocity: new Vector3(),
        };
        world.creatures.set(creature.id, spawn);

        return spawn;
    }, [creature.id, creature.species_id, world, zoneCenter]);

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
        zoneCenter,
        zoneRadius: zoneRadiusToWorld(creature.zone.radius),
        hunger: creature.hunger,
        health: creature.health,
        isLit,
        lowOxygen,
    };

    useFrame((state, delta) => {
        const object = group.current;

        if (object === null) {
            return;
        }

        steer(body, wander.current, profile, world, delta);
        object.position.copy(body.position);

        if (body.velocity.lengthSq() > 1e-6) {
            helper.position.copy(body.position);
            helper.lookAt(lookTarget.copy(body.position).add(body.velocity));
            targetQuaternion.copy(helper.quaternion);
            object.quaternion.slerp(targetQuaternion, Math.min(1, delta * 6));
        }

        if (tail.current !== null) {
            const beat = 6 + body.velocity.length() * 40;
            tail.current.rotation.y =
                Math.sin(state.clock.elapsedTime * beat + creature.id) * 0.4;
        }
    });

    const length = Math.max(creature.size, 0.3) * CM;

    return (
        <group ref={group} position={body.position}>
            {species.behaviour === 'crawler' ? (
                <SnailModel length={length} species={species} />
            ) : (
                <FishModel
                    length={length}
                    species={species}
                    creatureId={creature.id}
                    health={creature.health}
                    tailRef={tail}
                />
            )}
        </group>
    );
}

type FishModelProps = {
    length: number;
    species: Species;
    creatureId: number;
    health: number;
    tailRef: React.RefObject<Mesh | null>;
};

function FishModel({
    length,
    species,
    creatureId,
    health,
    tailRef,
}: FishModelProps) {
    const bodyColour = useMemo(
        () =>
            new Color(species.render.body ?? '#b8c2cc').lerp(
                new Color('#6b6b6b'),
                (1 - health) * 0.6,
            ),
        [species.render.body, health],
    );
    const tailColour = useMemo(() => {
        if (!species.render.colorful_tail) {
            return bodyColour;
        }

        return new Color().setHSL(
            (((creatureId * 0.618) % 1) + 1) % 1,
            0.8,
            0.55,
        );
    }, [species.render.colorful_tail, creatureId, bodyColour]);
    const isBottom = species.behaviour === 'bottom_dweller';

    return (
        <group>
            <mesh
                scale={[
                    length * 0.22,
                    length * (isBottom ? 0.28 : 0.32),
                    length * 0.5,
                ]}
            >
                <sphereGeometry args={[1, 12, 10]} />
                <meshStandardMaterial
                    color={bodyColour}
                    roughness={0.5}
                    metalness={0.15}
                />
            </mesh>
            {isBottom && (
                <mesh
                    position={[0, length * 0.18, length * 0.05]}
                    scale={[length * 0.04, length * 0.16, length * 0.12]}
                >
                    <sphereGeometry args={[1, 6, 6]} />
                    <meshStandardMaterial color="#3a3226" />
                </mesh>
            )}
            <mesh
                ref={tailRef}
                position={[0, 0, -length * 0.5]}
                rotation={[Math.PI / 2, 0, 0]}
                scale={[
                    length * 0.02,
                    length * (species.render.colorful_tail ? 0.45 : 0.25),
                    length * 0.32,
                ]}
            >
                <coneGeometry args={[1, 1, 3]} />
                <meshStandardMaterial
                    color={tailColour}
                    roughness={0.6}
                    transparent
                    opacity={0.9}
                />
            </mesh>
            <mesh
                position={[length * 0.12, length * 0.06, length * 0.32]}
                scale={length * 0.05}
            >
                <sphereGeometry args={[1, 6, 6]} />
                <meshStandardMaterial color="#111111" />
            </mesh>
            <mesh
                position={[-length * 0.12, length * 0.06, length * 0.32]}
                scale={length * 0.05}
            >
                <sphereGeometry args={[1, 6, 6]} />
                <meshStandardMaterial color="#111111" />
            </mesh>
        </group>
    );
}

function SnailModel({ length, species }: { length: number; species: Species }) {
    return (
        <group>
            <mesh
                position={[0, length * 0.25, 0]}
                scale={[length * 0.4, length * 0.32, length * 0.42]}
            >
                <sphereGeometry args={[1, 14, 10]} />
                <meshStandardMaterial
                    color={species.render.shell ?? '#6b4f2a'}
                    roughness={0.4}
                />
            </mesh>
            <mesh
                position={[0, length * 0.3, 0]}
                rotation={[0, 0, Math.PI / 2]}
                scale={length * 0.36}
            >
                <torusGeometry args={[0.9, 0.08, 6, 16]} />
                <meshStandardMaterial
                    color={species.render.stripe ?? '#e0b84a'}
                />
            </mesh>
            <mesh
                position={[0, length * 0.05, length * 0.15]}
                scale={[length * 0.22, length * 0.08, length * 0.5]}
            >
                <sphereGeometry args={[1, 8, 6]} />
                <meshStandardMaterial color="#9a8f7a" />
            </mesh>
        </group>
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
        object.rotation.z = Math.min(Math.PI, object.rotation.z + delta * 1.5);
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
            {ghost.species.behaviour === 'crawler' ? (
                <SnailModel length={length} species={ghost.species} />
            ) : (
                <mesh scale={[length * 0.22, length * 0.3, length * 0.5]}>
                    <sphereGeometry args={[1, 10, 8]} />
                    <meshStandardMaterial
                        color="#9a9a9a"
                        transparent
                        opacity={0.8}
                    />
                </mesh>
            )}
        </group>
    );
}
