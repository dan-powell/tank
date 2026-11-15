import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { FLY_KEYS } from '@/lib/tank/fly';
import type { FlyInput } from '@/lib/tank/fly';

/**
 * Gathers fly mode's input while `enabled`: movement keys held (by
 * `event.code`, so any keyboard layout works) and, once a left click on the
 * canvas has captured the mouse with pointer lock, how far it has moved.
 * Keys typed into form fields are left alone, and handled keys don't reach
 * the page (so Space never presses a focused button). Leaving fly mode
 * releases the mouse.
 */
export function useFlyInput(
    element: HTMLElement,
    enabled: boolean,
): RefObject<FlyInput> {
    const input = useRef<FlyInput>({ pressed: new Set(), lookX: 0, lookY: 0 });

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const state = input.current;

        const isHandled = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isTyping =
                target !== null &&
                (target.isContentEditable ||
                    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

            return (
                FLY_KEYS.has(event.code) &&
                !isTyping &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey
            );
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (isHandled(event)) {
                event.preventDefault();
                state.pressed.add(event.code);
            }
        };

        const onKeyUp = (event: KeyboardEvent) => {
            // Buttons react to Space on key up, so stop that too.
            if (state.pressed.delete(event.code) || isHandled(event)) {
                event.preventDefault();
            }
        };

        const releaseKeys = () => state.pressed.clear();

        const onPointerDown = (event: PointerEvent) => {
            if (event.button === 0 && document.pointerLockElement !== element) {
                // Refused if asked again too soon after Esc; the next click tries again.
                Promise.resolve(element.requestPointerLock()).catch(() => {});
            }
        };

        const onMouseMove = (event: MouseEvent) => {
            if (document.pointerLockElement === element) {
                state.lookX += event.movementX;
                state.lookY += event.movementY;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', releaseKeys);
        element.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('mousemove', onMouseMove);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', releaseKeys);
            element.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('mousemove', onMouseMove);
            releaseKeys();
            state.lookX = 0;
            state.lookY = 0;

            if (document.pointerLockElement === element) {
                document.exitPointerLock();
            }
        };
    }, [element, enabled]);

    return input;
}
