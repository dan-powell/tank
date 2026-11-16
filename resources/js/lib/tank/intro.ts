/**
 * The tank's load-in animation: once its models have loaded, the glass
 * panels fly together, the gantry lands and its lights come on, the
 * landscape fades in, the water fills, plants grow and the inhabitants
 * appear, each phase starting as the one before it finishes.
 */

/** Start and length (seconds after the intro begins) of each phase. */
export const INTRO_PHASES = {
    panels: { start: 0, duration: 0.5 },
    gantry: { start: 0.55, duration: 0.55 },
    lights: { start: 1.05, duration: 0.2 },
    landscape: { start: 1.2, duration: 0.5 },
    water: { start: 1.6, duration: 0.7 },
    plants: { start: 2.2, duration: 1 },
    inhabitants: { start: 2.8, duration: 0.4 },
} as const;

export type IntroPhase = keyof typeof INTRO_PHASES;

/** Longest delay (seconds) one plant or animal waits after another. */
export const INTRO_STAGGER = 0.5;

/** Seconds after which everything has arrived. */
export const INTRO_END =
    INTRO_PHASES.inhabitants.start +
    INTRO_PHASES.inhabitants.duration +
    INTRO_STAGGER;

/**
 * Seconds since the intro began; -1 while the models are still loading.
 * It keeps counting afterwards, so things added later can time their own
 * arrival from it. Advanced by TankIntro.
 */
export const intro = { elapsed: -1 };

/** Whether the intro has begun (the models have loaded). */
export function introStarted(): boolean {
    return intro.elapsed >= 0;
}

/** How far through a phase the intro is, 0..1, unshaped. */
export function introProgress(phase: IntroPhase, delay = 0): number {
    if (!introStarted()) {
        return 0;
    }

    const { start, duration } = INTRO_PHASES[phase];

    return clamp01((intro.elapsed - start - delay) / duration);
}

/**
 * Times the arrival of one plant or animal: during the intro it waits for
 * its phase (staggered by `id`); once the intro is over it arrives at once.
 * Call `progress()` every frame; it is 0 until the intro has begun.
 */
export function createArrival(
    phase: IntroPhase,
    id: number,
): { progress: () => number } {
    let begin: number | null = null;

    return {
        progress: () => {
            if (!introStarted()) {
                return 0;
            }

            begin ??= Math.max(
                intro.elapsed,
                INTRO_PHASES[phase].start + stagger(id) * INTRO_STAGGER,
            );

            return clamp01(
                (intro.elapsed - begin) / INTRO_PHASES[phase].duration,
            );
        },
    };
}

/** A deterministic 0..1 value per id, to spread out arrivals. */
export function stagger(id: number): number {
    const value = Math.sin(id * 78.233 + 12.9898) * 43758.5453;

    return value - Math.floor(value);
}

export function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Falls, touches down and bounces twice, smaller each time, like something
 * heavy landing; never goes past 1.
 */
export function easeOutBounce(t: number): number {
    const bounces: [number, number, number][] = [
        // [end of segment, centre of its arc, arc height]
        [0.64, 0, 0],
        [0.88, 0.76, 0.06],
        [1, 0.94, 0.015],
    ];

    if (t < bounces[0][0]) {
        return Math.pow(t / bounces[0][0], 2);
    }

    for (const [end, centre, height] of bounces.slice(1)) {
        if (t <= end) {
            const half = end - centre;

            return 1 - height * (1 - Math.pow((t - centre) / half, 2));
        }
    }

    return 1;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}
