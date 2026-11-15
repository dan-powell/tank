import { Vector3 } from 'three';
import type { CreatureIntent, CreatureMood } from '@/types';
import type { CreatureBody, FoodParticle, TankWorld } from './world';

/**
 * What a creature is doing this frame, as steering and drawing need it.
 *
 * The simulation decides each animal's intent and moods every tick (see
 * BehaviourSystem). The browser layers quick reactions on top: it hunts
 * food it can see whatever it was doing, darts away when startled, dashes
 * about in bursts when it has the zoomies, and its colours ease towards
 * how it feels.
 */
export type ResolvedBehaviour = {
    intent: CreatureIntent;
    /** Moods to show, including skittish while it is fleeing. */
    moods: CreatureMood[];
    /** Food it has spotted and is going for, if any. */
    food: FoodParticle | null;
    /** Set while it is fleeing: the way to dart (horizontal, unit length). */
    fleeFrom: Vector3 | null;
    /** True on the frame a zoomies dash starts, so it picks somewhere new to dash to. */
    dashStarted: boolean;
    /** Multiplier on its top speed. */
    speed: number;
    /** Multiplier on how strongly it keeps with its own kind. */
    schooling: number;
};

/** Per-creature memory for resolveBehaviour. */
export type BehaviourState = {
    /** Seconds left darting away. */
    startledFor: number;
    /** Seconds before it can be startled again. */
    calmFor: number;
    fleeDirection: Vector3;
    /** Seconds until the next zoomies dash, and left in the current one. */
    dashIn: number;
    dashFor: number;
    /** The colouring shown, eased towards the target. */
    saturation: number;
    brightness: number;
    resolved: ResolvedBehaviour;
};

/** What resolveBehaviour needs to know about the creature. */
export type BehaviourInputs = {
    id: number;
    intent: CreatureIntent;
    moods: CreatureMood[];
    hunger: number;
    health: number;
    /** Whether it chases dropped food (swimmers and bottom dwellers do). */
    eatsFood: boolean;
    /** Only goes for food that has sunk (bottom dwellers). */
    eatsSunkenFood: boolean;
    isYoung: boolean;
    isLit: boolean;
    /** Its cruising speed, to judge what counts as a fast neighbour. */
    speed: number;
};

/** How far (world units) a creature can sense food. */
const FOOD_SENSE_RANGE = 1.2;
/** Hunger at which a creature starts going for food it sees. */
const FOOD_HUNGER = 0.15;
/** A neighbour this close (world units) and moving fast startles the nervous. */
const STARTLE_RANGE = 0.08;
/** A food drop this close (horizontally, world units) startles the skittish. */
const SPLASH_RANGE = 0.25;
/** How fresh (seconds) a ripple must be to startle. */
const SPLASH_AGE = 0.3;
/** Seconds to ease most of the way to a new colouring. */
const COLOUR_EASE = 1.5;

const intentSpeed: Record<CreatureIntent, number> = {
    wander: 1,
    explore: 1,
    hunt: 1.15,
    rest: 0.4,
    hide: 0.9,
    shoal: 1,
    patrol: 0.8,
};

const intentSchooling: Record<CreatureIntent, number> = {
    wander: 1,
    explore: 0.5,
    hunt: 1,
    rest: 0.5,
    hide: 0.4,
    shoal: 3,
    patrol: 1,
};

const scratch = new Vector3();

export function createBehaviourState(): BehaviourState {
    return {
        startledFor: 0,
        calmFor: 0,
        fleeDirection: new Vector3(),
        dashIn: 1 + Math.random() * 3,
        dashFor: 0,
        saturation: 1,
        brightness: 1,
        resolved: {
            intent: 'wander',
            moods: [],
            food: null,
            fleeFrom: null,
            dashStarted: false,
            speed: 1,
            schooling: 1,
        },
    };
}

/**
 * Work out what the creature does this frame. Fleeing beats chasing food,
 * which beats whatever the simulation decided. Updates `state` in place
 * (including its eased colouring) and records the result on `body` for
 * the inhabitant panel.
 */
export function resolveBehaviour(
    state: BehaviourState,
    inputs: BehaviourInputs,
    body: CreatureBody,
    world: TankWorld,
    delta: number,
): ResolvedBehaviour {
    const dt = Math.min(delta, 0.1);
    const resolved = state.resolved;
    const isSkittish = inputs.moods.includes('skittish');

    state.calmFor = Math.max(0, state.calmFor - dt);
    state.startledFor = Math.max(0, state.startledFor - dt);

    if (
        state.startledFor === 0 &&
        state.calmFor === 0 &&
        (isSkittish || inputs.isYoung) &&
        findThreat(inputs, body, world, isSkittish, state.fleeDirection)
    ) {
        state.startledFor = 0.6 + Math.random() * 0.5;
        state.calmFor = state.startledFor + 1.5 + Math.random() * 2;
    }

    const isFleeing = state.startledFor > 0;
    const food =
        !isFleeing && inputs.eatsFood && inputs.hunger >= FOOD_HUNGER
            ? world.nearestFood(
                  body.position,
                  FOOD_SENSE_RANGE,
                  inputs.eatsSunkenFood,
              )
            : null;

    resolved.intent = food !== null ? 'hunt' : inputs.intent;
    resolved.food = food;
    resolved.fleeFrom = isFleeing ? state.fleeDirection : null;
    resolved.dashStarted = updateDash(state, inputs.moods, dt);
    resolved.moods =
        isFleeing && !isSkittish ? [...inputs.moods, 'skittish'] : inputs.moods;
    resolved.speed =
        (isFleeing ? 1.6 : intentSpeed[resolved.intent]) *
        (state.dashFor > 0 ? 2 : 1) *
        (inputs.moods.includes('sluggish') ? 0.6 : 1);
    resolved.schooling = intentSchooling[resolved.intent];

    easeColour(state, resolved, inputs, dt);

    body.intent = resolved.intent;
    body.moods = resolved.moods;

    return resolved;
}

/**
 * Whether something nearby gives it a fright: a fast-moving neighbour or,
 * for the skittish, food splashing down close by. Writes the way to flee.
 */
function findThreat(
    inputs: BehaviourInputs,
    body: CreatureBody,
    world: TankWorld,
    isSkittish: boolean,
    fleeDirection: Vector3,
): boolean {
    const fast = Math.max(0.05, inputs.speed * 0.8);

    for (const [id, other] of world.creatures) {
        if (id === inputs.id || (!isSkittish && other.isYoung)) {
            continue;
        }

        scratch.subVectors(body.position, other.position).setY(0);

        if (
            scratch.lengthSq() < STARTLE_RANGE * STARTLE_RANGE &&
            other.velocity.length() > fast
        ) {
            return pointAway(scratch, fleeDirection);
        }
    }

    if (!isSkittish) {
        return false;
    }

    for (const ripple of world.ripples) {
        if (ripple.age > SPLASH_AGE) {
            continue;
        }

        scratch.set(body.position.x - ripple.x, 0, body.position.z - ripple.z);

        if (scratch.lengthSq() < SPLASH_RANGE * SPLASH_RANGE) {
            return pointAway(scratch, fleeDirection);
        }
    }

    return false;
}

function pointAway(away: Vector3, out: Vector3): true {
    if (away.lengthSq() < 1e-8) {
        const angle = Math.random() * Math.PI * 2;
        away.set(Math.cos(angle), 0, Math.sin(angle));
    }

    out.copy(away).normalize();

    return true;
}

/**
 * Zoomies come in dashes: a second or so flat out, then a few seconds of
 * ordinary swimming. Returns true as a dash starts.
 */
function updateDash(
    state: BehaviourState,
    moods: CreatureMood[],
    dt: number,
): boolean {
    if (!moods.includes('zoomies')) {
        state.dashFor = 0;

        return false;
    }

    if (state.dashFor > 0) {
        state.dashFor = Math.max(0, state.dashFor - dt);

        return false;
    }

    state.dashIn -= dt;

    if (state.dashIn > 0) {
        return false;
    }

    state.dashFor = 0.6 + Math.random() * 0.9;
    state.dashIn = 1 + Math.random() * 3;

    return true;
}

/**
 * Colours follow mood: pale when frightened or hiding, dark and dull when
 * resting in the dark, vivid while hunting or zooming about. Ill health
 * dulls everything.
 */
function easeColour(
    state: BehaviourState,
    resolved: ResolvedBehaviour,
    inputs: BehaviourInputs,
    dt: number,
): void {
    let saturation = 1;
    let brightness = 1;

    if (resolved.intent === 'rest') {
        saturation *= inputs.isLit ? 0.85 : 0.55;
        brightness *= inputs.isLit ? 1 : 0.8;
    }

    if (resolved.intent === 'hide') {
        saturation *= 0.6;
        brightness *= 0.85;
    }

    if (resolved.intent === 'hunt' || resolved.moods.includes('zoomies')) {
        saturation *= 1.3;
        brightness *= 1.05;
    }

    if (resolved.moods.includes('skittish')) {
        saturation *= 0.6;
        brightness *= 1.1;
    }

    if (resolved.moods.includes('sluggish')) {
        saturation *= 0.75;
        brightness *= 0.9;
    }

    saturation *= 0.5 + 0.5 * inputs.health;

    const ease = 1 - Math.exp(-dt * (3 / COLOUR_EASE));
    state.saturation +=
        (Math.min(1.4, Math.max(0.3, saturation)) - state.saturation) * ease;
    state.brightness +=
        (Math.min(1.15, Math.max(0.7, brightness)) - state.brightness) * ease;
}
