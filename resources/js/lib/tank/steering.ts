import { Vector3 } from 'three';
import type { CreatureIntent, Habitat, SpeciesBehaviour } from '@/types';
import type { ResolvedBehaviour } from './behaviours';
import { bounds, layerDepth, layerToZ, TANK, VOXEL } from './space';
import type { TerrainField } from './terrain-field';
import type { CreatureBody, FoodParticle, TankWorld } from './world';

export type SteeringProfile = {
    id: number;
    behaviour: SpeciesBehaviour;
    habitat: Habitat;
    /** Cruising speed in world units per second. */
    speed: number;
    /** 0..1 tendency to stay with others of the same species. */
    schooling: number;
    /** 0..1: how far beyond its home depth layer it roams (0 = within the layer). */
    layerRoam: number;
    layerCount: number;
    /** Centre of its home zone: x and y in world space (z comes from its home layer). */
    zoneCenter: Vector3;
    zoneRadius: number;
    health: number;
    isLit: boolean;
    lowOxygen: boolean;
    /** Species it stalks when hunting (empty for animals that don't catch prey). */
    preySpeciesIds: ReadonlySet<number>;
};

export type WanderState = {
    /** Where the creature is heading, in world space. */
    target: Vector3;
    /** Whether a target has been chosen yet (cleared to pick a new one, e.g. after a move). */
    hasTarget: boolean;
    /** Seconds until it heads somewhere new even if it hasn't arrived. */
    retargetIn: number;
    /** Seconds left idling where it arrived. */
    lingerFor: number;
    /** The intent its target was chosen for: a new intent means a new target. */
    intent: CreatureIntent;
    /** Which end of its beat a patrolling creature is heading for (+1 right, -1 left). */
    patrolSign: number;
};

export function createWanderState(): WanderState {
    return {
        target: new Vector3(),
        hasTarget: false,
        retargetIn: 0,
        lingerFor: 0,
        intent: 'wander',
        patrolSign: Math.random() < 0.5 ? 1 : -1,
    };
}

/** Everything one creature's steering needs for this frame. */
type Frame = {
    body: CreatureBody;
    wander: WanderState;
    profile: SteeringProfile;
    behaviour: ResolvedBehaviour;
    world: TankWorld;
    terrain: TerrainField | null;
    isBottom: boolean;
    maxSpeed: number;
    dt: number;
};

const acceleration = new Vector3();
const scratch = new Vector3();
const heading = new Vector3();
const side = new Vector3();
const previous = new Vector3();
const probe = new Vector3();
const candidate = new Vector3();
const best = new Vector3();
const neighbourCentre = new Vector3();
const neighbourHeading = new Vector3();

const EAT_DISTANCE = 0.05;
const NEIGHBOUR_RANGE = 0.3;
const PERSONAL_SPACE = 0.08;
/** Close enough (world units) to a wander target to count as arrived. */
const ARRIVE_DISTANCE = 0.04;
/** Distance within which a creature eases off as it nears its target. */
const SLOW_DISTANCE = 0.12;
/** Share of top speed used for ordinary wandering. */
const CRUISE = 0.7;
/** How quickly (per second) velocity turns towards where it wants to go: lower is a wider, lazier curve. */
const STEER_RESPONSE = 2.5;
/** Share of top speed allowed vertically, so swimmers mostly cruise level. */
const VERTICAL_SHARE = 0.5;
/** Chance of idling a while on reaching a target. */
const LINGER_CHANCE = 0.35;
/** How far ahead (world units) a creature looks for things in its way. */
const LOOK_AHEAD = 0.08;
/** The tallest obstacle (world units) a swimmer rises over rather than going round. */
const SWIM_OVER = 0.16;
/** Clearance (world units) swimmers keep above and below decorations. */
const DECOR_CLEARANCE = 0.03;
/** The tallest step (world units) a bottom dweller walks up; taller turns it round. */
const BOTTOM_STEP = 0.05;
/** Crawlers climb anything, as long as it stays under water. */
const CRAWLER_CLIMB = 2;
/** Height a bottom dweller's body centre floats above the ground. */
const BOTTOM_LIFT = 0.035;
/** How far (world units) a hiding creature looks for cover. */
const COVER_SEARCH = 0.3;
/** How far (world units) a hunter can see prey. */
const PREY_SENSE_RANGE = 0.6;
/** Within this distance (world units) a stalking hunter lunges. */
const LUNGE_DISTANCE = 0.1;
/** How far (world units) patrollers keep from the end glass. */
const PATROL_MARGIN = 0.12;

/**
 * How each intent picks where to go, how long to idle on arrival (seconds,
 * with the chance of idling), and the share of top speed it moves at.
 */
const intentStyle: Record<
    CreatureIntent,
    { linger: [number, number]; lingerChance: number; cruise: number }
> = {
    wander: { linger: [1, 3.5], lingerChance: LINGER_CHANCE, cruise: CRUISE },
    explore: { linger: [0, 0], lingerChance: 0, cruise: CRUISE },
    hunt: { linger: [0.5, 1.5], lingerChance: 0.2, cruise: 0.9 },
    rest: { linger: [5, 15], lingerChance: 1, cruise: 0.5 },
    hide: { linger: [3, 8], lingerChance: 0.8, cruise: CRUISE },
    shoal: { linger: [0.5, 1.5], lingerChance: 0.2, cruise: CRUISE },
    patrol: { linger: [0.5, 1.5], lingerChance: 1, cruise: 0.8 },
};

/**
 * Advance one creature by a frame, moving freely in 3D around its home.
 *
 * The server only knows each creature's home (a zone and a depth layer) and
 * what it is busy doing; everything else is the browser's own. Its intent
 * picks where it goes: about its zone (wander), anywhere in the tank
 * (explore), to cover (hide), low down and still (rest), alongside its kind
 * (shoal), back and forth along the bottom (patrol), or after food and prey
 * (hunt). Whatever it is doing, it schools, gasps at the surface when
 * oxygen is low, darts away when startled, and steers over, round or away
 * from anything in its way. Ground dwellers do the same across the ground
 * (front to back too), following its surface.
 */
export function steer(
    body: CreatureBody,
    wander: WanderState,
    profile: SteeringProfile,
    behaviour: ResolvedBehaviour,
    world: TankWorld,
    delta: number,
): void {
    const { position, velocity } = body;
    const isBottom = walksOnGround(profile.behaviour);
    const frame: Frame = {
        body,
        wander,
        profile,
        behaviour,
        world,
        terrain: world.terrain,
        isBottom,
        maxSpeed:
            profile.speed *
            behaviour.speed *
            (0.35 + 0.65 * profile.health) *
            (profile.isLit ? 1 : 0.45),
        dt: Math.min(delta, 0.05),
    };
    const { terrain, maxSpeed, dt } = frame;

    acceleration.set(0, 0, 0);

    if (behaviour.intent !== wander.intent || behaviour.dashStarted) {
        wander.intent = behaviour.intent;
        wander.hasTarget = false;
        wander.lingerFor = 0;
    }

    if (!wander.hasTarget) {
        pickTarget(frame);
    }

    if (behaviour.fleeFrom !== null) {
        flee(frame, behaviour.fleeFrom);
    } else if (behaviour.food !== null) {
        seekFood(frame, behaviour.food);
    } else if (behaviour.intent === 'hunt' && profile.preySpeciesIds.size > 0) {
        stalkPrey(frame);
    } else {
        moveTowardsTarget(frame);
    }

    applySchooling(frame);

    if (profile.lowOxygen && !isBottom) {
        acceleration.y += (bounds.maxY - position.y) * 4 * maxSpeed;
    }

    if (terrain !== null && !isBottom) {
        avoidTerrain(frame, terrain);
    }

    avoidWalls(position, isBottom, maxSpeed);

    velocity.addScaledVector(acceleration, dt);

    if (isBottom) {
        velocity.y = 0;
    }

    velocity.clampLength(0, maxSpeed);
    velocity.y = Math.max(
        -maxSpeed * VERTICAL_SHARE,
        Math.min(maxSpeed * VERTICAL_SHARE, velocity.y),
    );

    previous.copy(position);
    position.addScaledVector(velocity, dt);

    position.x = Math.min(bounds.maxX, Math.max(bounds.minX, position.x));
    position.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, position.z));

    if (isBottom) {
        walkOnTerrain(frame);
    } else {
        position.y = Math.min(bounds.maxY, Math.max(bounds.minY, position.y));

        if (terrain !== null) {
            keepOutOfTerrain(position, terrain);
        }
    }

    if (Math.hypot(velocity.x, velocity.z) > 0.003) {
        body.yaw = Math.atan2(-velocity.z, velocity.x);
    }
}

/** Choose somewhere new to go, in the way its intent calls for. */
function pickTarget(frame: Frame): void {
    const { wander, behaviour } = frame;

    const found =
        behaviour.dashStarted || behaviour.intent === 'explore'
            ? pickFarTarget(frame)
            : behaviour.intent === 'hide'
              ? pickCover(frame)
              : behaviour.intent === 'rest'
                ? pickRestingSpot(frame)
                : behaviour.intent === 'shoal'
                  ? pickSchoolmates(frame)
                  : behaviour.intent === 'patrol'
                    ? pickPatrolEnd(frame)
                    : false;

    if (!found) {
        pickHomeTarget(frame);
    }

    wander.hasTarget = true;
    wander.retargetIn =
        behaviour.intent === 'explore' || behaviour.intent === 'patrol'
            ? 6 + Math.random() * 6
            : 3 + Math.random() * 6;
}

/**
 * Somewhere within its home volume (its zone in x/y and a band of depth
 * around its home layer that widens with `layerRoam`), avoiding spots inside
 * decorations when it can.
 */
function pickHomeTarget({
    body,
    wander,
    profile,
    terrain,
    isBottom,
}: Frame): void {
    const depthReach =
        layerDepth(profile.layerCount) * (0.5 + 1.5 * profile.layerRoam);
    const homeZ = layerToZ(body.homeLayer, profile.layerCount);
    const spread = () => Math.random() * 2 - 1;

    for (let attempt = 0; attempt < 8; attempt++) {
        candidate.set(
            profile.zoneCenter.x + spread() * profile.zoneRadius,
            isBottom
                ? body.position.y
                : profile.zoneCenter.y + spread() * profile.zoneRadius * 0.5,
            homeZ + spread() * depthReach,
        );
        clampToTank(candidate);

        if (isBottom || terrain === null || terrain.isFree(candidate)) {
            break;
        }
    }

    wander.target.copy(candidate);
}

/**
 * Somewhere well away from where it is, anywhere in the tank (swimmers keep
 * roughly to their usual height): for exploring and zoomies dashes.
 */
function pickFarTarget({
    body,
    wander,
    profile,
    terrain,
    isBottom,
}: Frame): boolean {
    let bestDistance = -1;

    for (let attempt = 0; attempt < 4; attempt++) {
        candidate.set(
            bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
            isBottom
                ? body.position.y
                : profile.zoneCenter.y +
                      (Math.random() * 2 - 1) * profile.zoneRadius,
            bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ),
        );
        clampToTank(candidate);

        if (!isBottom && terrain !== null && !terrain.isFree(candidate)) {
            continue;
        }

        const distance = candidate.distanceToSquared(body.position);

        if (distance > bestDistance) {
            bestDistance = distance;
            best.copy(candidate);
        }
    }

    if (bestDistance < 0) {
        return false;
    }

    wander.target.copy(best);

    return true;
}

/** A sheltered spot by a decoration or, failing that, among the nearest plant's stems. */
function pickCover({ body, wander, world, terrain, isBottom }: Frame): boolean {
    const medium = isBottom ? 'air' : 'water';

    if (
        terrain !== null &&
        terrain.coverNear(body.position, COVER_SEARCH, candidate, medium)
    ) {
        wander.target.copy(candidate);

        return true;
    }

    let nearest = Infinity;

    for (const cover of world.plantCover.values()) {
        const distance = cover.root.distanceToSquared(body.position);
        // Only plants in the creature's own element (water or air) will do.
        const isReachable =
            terrain === null ||
            terrain.isFree(
                probe.copy(cover.root).setY(cover.root.y + 0.02),
                medium,
            );

        if (distance < nearest && isReachable) {
            nearest = distance;
            best.set(
                cover.root.x + (Math.random() - 0.5) * 0.04,
                isBottom
                    ? body.position.y
                    : cover.root.y + Math.random() * cover.height * 0.6,
                cover.root.z + (Math.random() - 0.5) * 0.04,
            );
        }
    }

    if (nearest === Infinity) {
        return false;
    }

    wander.target.copy(best);

    return true;
}

/**
 * Low in its zone, tucked by a decoration if one is near. Ground dwellers
 * stay where they are.
 */
function pickRestingSpot(frame: Frame): boolean {
    const { body, wander, profile, terrain, isBottom } = frame;

    if (isBottom) {
        wander.target.copy(body.position);

        return true;
    }

    candidate.set(
        body.position.x,
        Math.max(bounds.minY, profile.zoneCenter.y - profile.zoneRadius * 0.5),
        body.position.z,
    );

    if (
        terrain !== null &&
        terrain.coverNear(candidate, COVER_SEARCH * 0.5, best)
    ) {
        wander.target.copy(best);

        return true;
    }

    if (terrain === null || terrain.isFree(candidate)) {
        wander.target.copy(candidate);

        return true;
    }

    return false;
}

/** Into the middle of the nearest group of its own kind. */
function pickSchoolmates({ body, wander, profile, world }: Frame): boolean {
    neighbourCentre.set(0, 0, 0);
    let count = 0;

    for (const [id, other] of world.creatures) {
        if (
            id !== profile.id &&
            other.speciesId === body.speciesId &&
            other.position.distanceTo(body.position) < NEIGHBOUR_RANGE * 2
        ) {
            neighbourCentre.add(other.position);
            count++;
        }
    }

    if (count === 0) {
        return false;
    }

    wander.target
        .copy(neighbourCentre.divideScalar(count))
        .add(
            scratch.set(
                (Math.random() - 0.5) * 0.06,
                (Math.random() - 0.5) * 0.03,
                (Math.random() - 0.5) * 0.06,
            ),
        );
    clampToTank(wander.target);

    return true;
}

/** The far end of a straight beat along the tank, turning round at each end. */
function pickPatrolEnd({ body, wander }: Frame): boolean {
    wander.patrolSign = -wander.patrolSign;
    wander.target.set(
        wander.patrolSign > 0
            ? bounds.maxX - PATROL_MARGIN
            : bounds.minX + PATROL_MARGIN,
        body.position.y,
        body.position.z,
    );

    return true;
}

/**
 * Curve towards the current target, easing off as it arrives; on arrival
 * sometimes idle a while (as its intent likes), then pick somewhere new.
 */
function moveTowardsTarget(frame: Frame): void {
    const { body, wander, behaviour, isBottom, maxSpeed, dt } = frame;
    const { position, velocity } = body;
    const style = intentStyle[behaviour.intent];

    if (wander.lingerFor > 0) {
        wander.lingerFor -= dt;
        acceleration.addScaledVector(velocity, -STEER_RESPONSE);

        if (wander.lingerFor <= 0) {
            pickTarget(frame);
        }

        return;
    }

    const toTarget = scratch.subVectors(wander.target, position);

    if (isBottom) {
        toTarget.y = 0;
    }

    const distance = toTarget.length();
    wander.retargetIn -= dt;

    if (distance < ARRIVE_DISTANCE || wander.retargetIn <= 0) {
        if (distance < ARRIVE_DISTANCE && Math.random() < style.lingerChance) {
            const [shortest, longest] = style.linger;
            wander.lingerFor = shortest + Math.random() * (longest - shortest);
        }

        pickTarget(frame);

        return;
    }

    const desiredSpeed =
        maxSpeed * style.cruise * Math.min(1, distance / SLOW_DISTANCE);
    toTarget.multiplyScalar(desiredSpeed / distance).sub(velocity);
    acceleration.addScaledVector(toTarget, STEER_RESPONSE);
}

/** Dart away flat out, then carry on where it was going. */
function flee({ wander, isBottom, maxSpeed }: Frame, away: Vector3): void {
    acceleration.addScaledVector(away, 8 * maxSpeed);

    if (!isBottom) {
        acceleration.y += (Math.random() - 0.3) * maxSpeed;
    }

    wander.lingerFor = 0;
}

/**
 * Creep up on the nearest prey animal in sight, then lunge. The simulation
 * decides what is caught; this is only the chase.
 */
function stalkPrey(frame: Frame): void {
    const { body, profile, world, isBottom, maxSpeed } = frame;
    let nearest = PREY_SENSE_RANGE * PREY_SENSE_RANGE;
    let prey: CreatureBody | null = null;

    for (const other of world.creatures.values()) {
        if (!profile.preySpeciesIds.has(other.speciesId)) {
            continue;
        }

        const distance = other.position.distanceToSquared(body.position);

        if (distance < nearest) {
            nearest = distance;
            prey = other;
        }
    }

    if (prey === null) {
        moveTowardsTarget(frame);

        return;
    }

    const toPrey = scratch.subVectors(prey.position, body.position);

    if (isBottom) {
        toPrey.y = 0;
    }

    const distance = toPrey.length();

    if (distance < 1e-4) {
        return;
    }

    const share = distance < LUNGE_DISTANCE ? 1 : 0.35;
    toPrey.multiplyScalar((maxSpeed * share) / distance).sub(body.velocity);
    acceleration.addScaledVector(toPrey, STEER_RESPONSE * 2);
}

function applySchooling({
    body,
    profile,
    behaviour,
    world,
    isBottom,
    maxSpeed,
}: Frame): void {
    const schooling = Math.min(1, profile.schooling * behaviour.schooling);
    neighbourCentre.set(0, 0, 0);
    neighbourHeading.set(0, 0, 0);
    let schoolmates = 0;

    for (const [id, other] of world.creatures) {
        if (id === profile.id) {
            continue;
        }

        const distance = other.position.distanceTo(body.position);

        if (distance > NEIGHBOUR_RANGE) {
            continue;
        }

        if (distance < PERSONAL_SPACE && distance > 0) {
            scratch.subVectors(body.position, other.position);

            if (isBottom) {
                scratch.y = 0;
            }

            if (scratch.lengthSq() > 0) {
                acceleration.addScaledVector(
                    scratch.normalize(),
                    (PERSONAL_SPACE - distance) * 30 * maxSpeed,
                );
            }
        }

        if (schooling > 0 && other.speciesId === body.speciesId) {
            neighbourCentre.add(other.position);
            neighbourHeading.add(other.velocity);
            schoolmates++;
        }
    }

    if (schoolmates > 0) {
        neighbourCentre.divideScalar(schoolmates).sub(body.position);
        neighbourHeading.divideScalar(schoolmates);

        if (isBottom) {
            neighbourCentre.y = 0;
            neighbourHeading.y = 0;
        }

        acceleration.addScaledVector(neighbourCentre, schooling * 2 * maxSpeed);
        acceleration.addScaledVector(neighbourHeading, schooling);
    }
}

/** Head straight for food it has spotted, in 3D, and eat it on arrival. */
function seekFood(
    { body, wander, world, isBottom, maxSpeed }: Frame,
    food: FoodParticle,
): void {
    const toFood = scratch.subVectors(food.position, body.position);

    if (toFood.length() < EAT_DISTANCE) {
        world.eat(food);

        return;
    }

    // Afterwards, potter about where the food was.
    wander.target.copy(food.position);
    wander.hasTarget = true;
    wander.retargetIn = Math.max(wander.retargetIn, 2);
    wander.lingerFor = 0;

    if (isBottom) {
        toFood.y = 0;
    }

    acceleration.addScaledVector(toFood.normalize(), 6 * maxSpeed);
}

/**
 * Steer a swimmer round decorations: rise over an obstacle ahead when it is
 * low enough, otherwise slip round whichever side is open (preferring the
 * side its target is on), or turn away and head somewhere else. Keeps a
 * little clearance above and below so fish don't scrape along rocks.
 */
function avoidTerrain(frame: Frame, terrain: TerrainField): void {
    const { body, wander, maxSpeed } = frame;
    const { position, velocity } = body;

    heading.set(velocity.x, 0, velocity.z);

    if (heading.lengthSq() < 1e-6) {
        heading.subVectors(wander.target, position).setY(0);
    }

    if (heading.lengthSq() > 1e-8) {
        heading.normalize();
        probe.copy(position).addScaledVector(heading, LOOK_AHEAD);

        if (!terrain.isFree(probe)) {
            steerRound(frame, terrain);
        }
    }

    probe.set(position.x, position.y - DECOR_CLEARANCE, position.z);

    if (terrain.isSolid(probe)) {
        acceleration.y += 4 * maxSpeed;
    }

    probe.set(position.x, position.y + DECOR_CLEARANCE, position.z);

    if (terrain.isSolid(probe)) {
        acceleration.y -= 4 * maxSpeed;
    }
}

/** Something is in the way along `heading`: go over, round, or back. */
function steerRound(frame: Frame, terrain: TerrainField): void {
    const { body, wander, maxSpeed } = frame;
    const { position, velocity } = body;
    const startY = probe.y;

    for (let rise = VOXEL; rise <= SWIM_OVER; rise += VOXEL * 2) {
        probe.y = startY + rise;

        if (probe.y > bounds.maxY) {
            break;
        }

        if (terrain.isFree(probe)) {
            acceleration.y += 8 * maxSpeed;
            acceleration.addScaledVector(heading, -0.6 * maxSpeed);

            return;
        }
    }

    // Perpendicular to the heading, on the side of the target first.
    side.set(-heading.z, 0, heading.x);
    scratch.subVectors(wander.target, position);
    const preferred = side.dot(scratch) >= 0 ? 1 : -1;

    for (const sign of [preferred, -preferred]) {
        probe.copy(position).addScaledVector(side, sign * LOOK_AHEAD);

        if (terrain.isFree(probe)) {
            acceleration.addScaledVector(side, sign * 6 * maxSpeed);
            acceleration.addScaledVector(heading, -2 * maxSpeed);

            return;
        }
    }

    velocity.multiplyScalar(-0.3);
    pickTarget(frame);
}

/**
 * Undo whichever part of this frame's move took a swimmer into a decoration
 * (or out of the water). Anything still stuck, e.g. because a decoration was
 * dropped on top of it, is lifted to the nearest open water.
 */
function keepOutOfTerrain(position: Vector3, terrain: TerrainField): void {
    if (terrain.isFree(position)) {
        return;
    }

    const attempts: [number, number, number][] = [
        [position.x, position.y, previous.z],
        [previous.x, position.y, position.z],
        [position.x, previous.y, position.z],
        [previous.x, previous.y, previous.z],
    ];

    for (const [x, y, z] of attempts) {
        probe.set(x, y, z);

        if (terrain.isFree(probe)) {
            position.copy(probe);

            return;
        }
    }

    terrain.moveToFreeCell(position);
}

/** Behaviours that walk on surfaces rather than swim. */
export function walksOnGround(behaviour: SpeciesBehaviour): boolean {
    return (
        behaviour === 'bottom_dweller' ||
        behaviour === 'crawler' ||
        behaviour === 'walker' ||
        behaviour === 'amphibian'
    );
}

/** Behaviours drawn standing on their base rather than centred on their body. */
export function standsOnBase(behaviour: SpeciesBehaviour): boolean {
    return (
        behaviour === 'crawler' ||
        behaviour === 'walker' ||
        behaviour === 'amphibian'
    );
}

/** Behaviours that go for dropped food. */
export function eatsDroppedFood(behaviour: SpeciesBehaviour): boolean {
    return behaviour === 'swimmer' || behaviour === 'bottom_dweller';
}

function clampToTank(point: Vector3): void {
    point.set(
        Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
        Math.min(bounds.maxY, Math.max(bounds.minY, point.y)),
        Math.min(bounds.maxZ, Math.max(bounds.minZ, point.z)),
    );
}

/**
 * Keep a bottom dweller on whatever is beneath it: the substrate or the top
 * of a decoration. Crawlers and walkers climb anything, clinging to the face
 * as they go; other bottom dwellers only take small steps and head elsewhere
 * at anything taller. Water animals keep below the waterline, land animals
 * above it (hauling out if they find themselves under water), and
 * amphibians go where they please.
 */
function walkOnTerrain(frame: Frame): void {
    const { body, profile, terrain, maxSpeed, dt } = frame;
    const { position, velocity } = body;
    const isCrawler = profile.behaviour !== 'bottom_dweller';
    const lift = standsOnBase(profile.behaviour) ? 0 : BOTTOM_LIFT;

    if (terrain === null) {
        position.y = TANK.substrate + lift;

        return;
    }

    const foot = Math.max(0, previous.y - lift) + 0.001;
    const ground = (x: number, z: number) =>
        terrain.surfaceBelow(
            probe.set(x, foot, z),
            isCrawler ? CRAWLER_CLIMB : BOTTOM_STEP,
        );
    const waterLine = terrain.waterLevel * VOXEL - 0.01;
    const allowed = (height: number) =>
        profile.habitat === 'terrestrial'
            ? height >= waterLine
            : profile.habitat === 'amphibious' || height < waterLine;

    if (profile.habitat === 'terrestrial') {
        const here = ground(previous.x, previous.z);

        if (
            here !== null &&
            !allowed(here) &&
            terrain.moveToLandNear(position)
        ) {
            previous.copy(position);

            return;
        }
    }

    let surface = ground(position.x, position.z);

    if (surface === null || !allowed(surface)) {
        // Blocked: stay put and head somewhere else.
        position.x = previous.x;
        position.z = previous.z;
        velocity.multiplyScalar(-0.3);
        pickTarget(frame);
        surface = ground(position.x, position.z) ?? foot;
    }

    const target = surface + lift;
    const climb = target - previous.y;

    if (climb > 0.01) {
        // Climb the face before stepping onto the higher ground.
        position.x = previous.x;
        position.z = previous.z;
    }

    const rate =
        (profile.behaviour === 'crawler'
            ? maxSpeed * 1.5
            : isCrawler
              ? maxSpeed * 3
              : 0.6) * dt;
    position.y =
        climb > 0
            ? Math.min(target, previous.y + rate)
            : Math.max(target, previous.y - Math.max(rate, 0.3 * dt));
}

/** Push away from the glass on every side (swimmers also from the floor and surface limits). */
function avoidWalls(
    position: Vector3,
    isBottom: boolean,
    maxSpeed: number,
): void {
    const push = (distance: number) =>
        distance < 0.1 ? (0.1 - distance) * 40 * maxSpeed : 0;

    acceleration.x +=
        push(position.x - bounds.minX) - push(bounds.maxX - position.x);
    acceleration.z +=
        push(position.z - bounds.minZ) - push(bounds.maxZ - position.z);

    if (!isBottom) {
        acceleration.y +=
            push(position.y - bounds.minY) - push(bounds.maxY - position.y);
    }
}
