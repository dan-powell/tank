/** Clip shown while an animal is moving. */
export const MOVE_CLIP = 'move';

/** Clip shown while an animal is still. */
export const IDLE_CLIP = 'idle';

/** Frame rates used when the catalogue gives none. */
const DEFAULT_FPS: Record<string, number> = { [MOVE_CLIP]: 6, [IDLE_CLIP]: 2 };

/** Share of its top speed above which a still animal starts moving, and below which a moving one stops (apart, so it doesn't flicker). */
const START_SHARE = 0.2;
const STOP_SHARE = 0.12;

/** Where one animal is in its animation. */
export type AnimationState = {
    clip: string;
    /** Frames played so far in this clip (fractional). */
    phase: number;
};

/**
 * Start an animation part-way through, so animals of one species don't flap
 * in step.
 */
export function createAnimationState(id: number): AnimationState {
    return { clip: IDLE_CLIP, phase: ((((id * 0.618034) % 1) + 1) % 1) * 4 };
}

/**
 * Advance an animal's animation by a frame of rendering and return the clip
 * and frame number (not yet wrapped to the clip's length) to show. Moving
 * animals play `move` faster the faster they go; still ones play `idle`.
 */
export function advanceAnimation(
    state: AnimationState,
    fps: Record<string, number> | undefined,
    speed: number,
    topSpeed: number,
    delta: number,
): { clip: string; frame: number } {
    const share = topSpeed > 0 ? speed / topSpeed : 0;
    const clip =
        share > (state.clip === MOVE_CLIP ? STOP_SHARE : START_SHARE)
            ? MOVE_CLIP
            : IDLE_CLIP;

    if (clip !== state.clip) {
        state.clip = clip;
        state.phase = 0;
    }

    const rate = fps?.[clip] ?? DEFAULT_FPS[clip] ?? 4;
    const pace =
        clip === MOVE_CLIP ? Math.min(2, Math.max(0.5, 0.5 + share)) : 1;
    state.phase += rate * pace * Math.min(delta, 0.1);

    return { clip, frame: Math.floor(state.phase) };
}
