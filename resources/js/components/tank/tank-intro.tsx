import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import { Spinner } from '@/components/ui/spinner';
import {
    easeOutCubic,
    intro,
    INTRO_END,
    introProgress,
    introStarted,
} from '@/lib/tank/intro';
import { cn } from '@/lib/utils';
import { introUniforms } from './intro-material';

/**
 * Reports that the Suspense boundary it sits in has loaded: a boundary shows
 * all its children at once, so this mounts only once every model inside it
 * is ready.
 */
export function IntroReady({ onReady }: { onReady: () => void }) {
    const report = useEffectEvent(onReady);

    useEffect(() => {
        report();
    }, []);

    return null;
}

type Props = {
    /** Every model the intro waits for has loaded. */
    isLoaded: boolean;
    /** The intro has begun: the loading screen can go. */
    onStart: () => void;
};

/**
 * Runs the load-in animation (see lib/tank/intro): held back until the
 * models have loaded and the scene's shaders have compiled, so it plays
 * smoothly from the first frame. Skipped for those who prefer less motion.
 */
export function TankIntro({ isLoaded, onStart }: Props) {
    const gl = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);
    const camera = useThree((state) => state.camera);
    const hasBegun = useRef(false);
    const start = useEffectEvent(onStart);

    // Before anything draws: a new scene starts its intro from the beginning.
    useLayoutEffect(() => {
        intro.elapsed = -1;
        introUniforms.landscape.value = 0;

        return () => {
            intro.elapsed = INTRO_END;
            introUniforms.landscape.value = 1;
        };
    }, []);

    useEffect(() => {
        if (!isLoaded || hasBegun.current) {
            return;
        }

        hasBegun.current = true;
        let isCancelled = false;

        // Starts anyway if compiling fails: the shaders then compile as they draw.
        void gl
            .compileAsync(scene, camera)
            .catch(() => undefined)
            .then(() => {
                if (isCancelled) {
                    return;
                }

                intro.elapsed = prefersReducedMotion() ? INTRO_END : 0;
                start();
            });

        return () => {
            isCancelled = true;
            hasBegun.current = false;
        };
    }, [isLoaded, gl, scene, camera]);

    useFrame((_, delta) => {
        if (!introStarted()) {
            return;
        }

        // Capped, so a hidden tab doesn't skip the rest of the intro.
        intro.elapsed += Math.min(delta, 0.1);
        introUniforms.landscape.value = easeOutCubic(
            introProgress('landscape'),
        );
    });

    return null;
}

function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Covers the tank while its models load, then fades away as the intro begins. */
export function TankLoading({ isShown }: { isShown: boolean }) {
    return (
        <div
            aria-hidden={!isShown}
            className={cn(
                'pointer-events-none absolute inset-0 flex items-center justify-center bg-background transition-opacity duration-500',
                isShown ? 'opacity-100' : 'opacity-0',
            )}
        >
            <div className="flex items-center gap-2 rounded-md border border-sidebar-border/60 bg-sidebar/70 px-3 py-2 text-sm text-sidebar-foreground shadow-md backdrop-blur-md">
                <Spinner />
                Filling the tank…
            </div>
        </div>
    );
}
