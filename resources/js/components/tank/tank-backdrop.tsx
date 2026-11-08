import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { CanvasTexture, Color, SRGBColorSpace } from 'three';
import type { TankBackground } from '@/types';

type Props = {
    background: TankBackground;
    /** With the light off the room is dim, and so is the backdrop. */
    isLit: boolean;
};

/** The deep blue a dark room fades the backdrop towards. */
const NIGHT = new Color('#0e1626');

/** Pixel rows in the gradient texture: enough for a smooth fade. */
const GRADIENT_STEPS = 256;

/** The colour as it looks in the room: dimmed towards night with the light off. */
function shade(hex: string, isLit: boolean): string {
    if (isLit) {
        return hex;
    }

    return `#${new Color(hex).multiplyScalar(0.12).lerp(NIGHT, 0.4).getHexString()}`;
}

/**
 * Paints the scene background: a solid colour, or a gradient from top to
 * bottom of the view that stays put as the camera moves.
 */
export function TankBackdrop({ background, isLit }: Props) {
    const scene = useThree((state) => state.scene);
    const { colour, gradient_colour: gradientColour } = background;

    useEffect(() => {
        const top = shade(colour, isLit);

        if (gradientColour === null) {
            scene.background = new Color(top);

            return () => {
                scene.background = null;
            };
        }

        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = GRADIENT_STEPS;
        const context = canvas.getContext('2d');

        if (context === null) {
            scene.background = new Color(top);

            return () => {
                scene.background = null;
            };
        }

        const gradient = context.createLinearGradient(0, 0, 0, GRADIENT_STEPS);
        gradient.addColorStop(0, top);
        gradient.addColorStop(1, shade(gradientColour, isLit));
        context.fillStyle = gradient;
        context.fillRect(0, 0, 1, GRADIENT_STEPS);

        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        scene.background = texture;

        return () => {
            scene.background = null;
            texture.dispose();
        };
    }, [scene, colour, gradientColour, isLit]);

    return null;
}
