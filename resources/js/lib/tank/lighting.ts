import { useEffect, useState } from 'react';
import { Color, Vector3 } from 'three';
import type { LightFixture, TankGrid, TankLighting } from '@/types';
import { TANK, VOXEL } from './space';

/** Most lights a gantry can take (matches config simulation.lighting.max_fixtures). */
export const MAX_LIGHTS = 8;

const DAY_MINUTES = 1440;

/** Seconds (real time) a light takes to fade fully in or out when it is switched. */
export const LIGHT_FADE_SECONDS = 1.5;

/**
 * A light's output this frame, moved steadily from `current` towards
 * `target` so switching on or off fades over LIGHT_FADE_SECONDS rather than
 * snapping. Slow changes, like a timer's ramp, are followed as they are.
 */
export function fadeTowards(
    current: number,
    target: number,
    deltaSeconds: number,
): number {
    const step = deltaSeconds / LIGHT_FADE_SECONDS;

    return current + Math.max(-step, Math.min(step, target - current));
}

/** Minutes per day a fixture's timer has it on, ramps included (equal times = all day). */
export function onMinutes(fixture: LightFixture): number {
    const duration =
        (fixture.off_minute - fixture.on_minute + DAY_MINUTES) % DAY_MINUTES;

    return duration === 0 ? DAY_MINUTES : duration;
}

/**
 * How far a fixture's timer has it turned up (0-1) at a moment of simulated
 * time, ramping up after switching on and down before switching off. Mirrors
 * LightFixtureState::levelAt().
 */
export function levelAt(fixture: LightFixture, simSeconds: number): number {
    const minute = (simSeconds / 60) % DAY_MINUTES;
    const duration = onMinutes(fixture);
    const sinceOn =
        (minute - fixture.on_minute + DAY_MINUTES * 2) % DAY_MINUTES;

    if (duration >= DAY_MINUTES) {
        return 1;
    }

    if (sinceOn >= duration) {
        return 0;
    }

    const ramp = Math.min(fixture.ramp_minutes, duration / 2);

    return ramp <= 0
        ? 1
        : Math.min(1, sinceOn / ramp, (duration - sinceOn) / ramp);
}

/**
 * The combined output of all the lights (0-1 of their total at full) at a
 * moment, weighting each by brightness and size. Used for the day timeline
 * and the room's mood.
 */
export function combinedLevel(
    lighting: TankLighting,
    simSeconds: number,
): number {
    const weights = lighting.fixtures.map(fixtureWeight);
    const total = weights.reduce((sum, weight) => sum + weight, 0);

    if (total === 0) {
        return 0;
    }

    return (
        lighting.fixtures.reduce(
            (sum, fixture, index) =>
                sum + weights[index] * levelAt(fixture, simSeconds),
            0,
        ) / total
    );
}

/** A fixture's share of the light: brighter and longer lights count for more. */
function fixtureWeight(fixture: LightFixture): number {
    return (
        (fixture.brightness / 100) *
        (fixture.type === 'led-tube' ? fixture.length * 0.4 : 1)
    );
}

/** "08:30" for a minute of the day. */
export function formatMinute(minute: number): string {
    const hours = Math.floor(minute / 60) % 24;
    const minutes = Math.round(minute % 60);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Ready-made light colours, each a sensible choice for its job. */
export const LIGHT_COLOURS = [
    { name: 'Daylight', colour: '#f4f7ff' },
    { name: 'Warm white', colour: '#fff1d6' },
    { name: 'Plant grow', colour: '#ff7ae0' },
    { name: 'Actinic blue', colour: '#4f7bff' },
    { name: 'Moonlight', colour: '#9fb4ff' },
] as const;

/** Ready-made timers. */
export const LIGHT_SCHEDULES = [
    { name: 'Day', on_minute: 8 * 60, off_minute: 20 * 60, ramp_minutes: 30 },
    {
        name: 'Short day',
        on_minute: 10 * 60,
        off_minute: 18 * 60,
        ramp_minutes: 30,
    },
    {
        name: 'Evening',
        on_minute: 20 * 60,
        off_minute: 23 * 60,
        ramp_minutes: 15,
    },
    { name: 'Always on', on_minute: 0, off_minute: 0, ramp_minutes: 0 },
] as const;

/** World height of the gantry the lights hang from. */
export function gantryHeight(lighting: TankLighting): number {
    return TANK.height + lighting.gantry.clearance * VOXEL;
}

/**
 * Where a fixture hangs in world space: the middle of its slots (the centre
 * of a tube), how long it is along x, and the row's z.
 */
export function fixturePlacement(
    fixture: LightFixture,
    lighting: TankLighting,
    grid: TankGrid,
): { centre: Vector3; length: number } {
    const columnWidth = (grid.width * VOXEL) / lighting.gantry.columns;
    const rowDepth = (grid.depth * VOXEL) / lighting.gantry.rows;

    return {
        centre: new Vector3(
            (fixture.column + fixture.length / 2) * columnWidth -
                TANK.width / 2,
            gantryHeight(lighting),
            (fixture.row + 0.5) * rowDepth - TANK.depth / 2,
        ),
        length: fixture.length * columnWidth,
    };
}

/** One light's state this frame, as the water shader needs it. */
export type LiveLight = {
    centre: Vector3;
    /** Half the length of a tube along x; 0 for point lights. */
    halfLength: number;
    /** Cosine of the beam's outer edge from straight down (-1 for tubes, which light all round). */
    cosOuter: number;
    /** Current output, 0 when off. */
    intensity: number;
    colour: Color;
};

/**
 * The lights as they are this frame: filled in by the fixtures each frame
 * and read by the water, so its shafts, glints and tint follow them.
 */
export const liveLighting = {
    lights: Array.from({ length: MAX_LIGHTS }, (): LiveLight => ({
        centre: new Vector3(),
        halfLength: 0,
        cosOuter: -1,
        intensity: 0,
        colour: new Color(),
    })),
    count: 0,
    /** Sum of the lights' intensities. */
    total: 0,
    /** Intensity-weighted mix of their colours. */
    colour: new Color('#fff1d6'),
};

/** The simulated time a snapshot was taken at, and the real time it arrived. */
export type SimClock = {
    simSeconds: number;
    receivedAt: number;
    timeScale: number;
};

/**
 * Simulated time now, run on from the latest snapshot at the simulation's
 * speed (capped so a stalled simulation doesn't race ahead by much).
 */
export function simSecondsNow(
    clock: SimClock,
    now = performance.now(),
): number {
    const elapsed =
        Math.min(Math.max(0, now - clock.receivedAt), 120_000) / 1000;

    return clock.simSeconds + elapsed * clock.timeScale;
}

/** A sim clock that restarts from each new snapshot. */
export function useSimClock(simSeconds: number, timeScale: number): SimClock {
    const [clock, setClock] = useState<SimClock>(() => ({
        simSeconds,
        receivedAt: performance.now(),
        timeScale,
    }));

    useEffect(() => {
        setClock({ simSeconds, receivedAt: performance.now(), timeScale });
    }, [simSeconds, timeScale]);

    return clock;
}

/** Simulated seconds now, re-read every `intervalMs` for display. */
export function useSimSecondsNow(clock: SimClock, intervalMs = 2000): number {
    const [now, setNow] = useState(() => simSecondsNow(clock));

    useEffect(() => {
        setNow(simSecondsNow(clock));
        const timer = window.setInterval(
            () => setNow(simSecondsNow(clock)),
            intervalMs,
        );

        return () => window.clearInterval(timer);
    }, [clock, intervalMs]);

    return now;
}
