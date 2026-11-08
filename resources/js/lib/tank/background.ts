import type { CSSProperties } from 'react';
import type { TankBackground } from '@/types';

/** CSS for a tank's backdrop: its solid colour, or its gradient from top to bottom. */
export function backgroundStyle({
    colour,
    gradient_colour,
}: TankBackground): CSSProperties {
    return {
        background: `linear-gradient(${colour}, ${gradient_colour ?? colour})`,
    };
}
