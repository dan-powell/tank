import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void): () => void {
    document.addEventListener('pointerlockchange', callback);

    return () => document.removeEventListener('pointerlockchange', callback);
}

function isPointerLocked(): boolean {
    return document.pointerLockElement !== null;
}

function getServerSnapshot(): boolean {
    return false;
}

/** Whether the mouse is currently captured (pointer lock), e.g. by fly mode. */
export function usePointerLocked(): boolean {
    return useSyncExternalStore(subscribe, isPointerLocked, getServerSnapshot);
}
