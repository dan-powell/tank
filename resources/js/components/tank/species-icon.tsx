import { Bug, Fish, PawPrint, Sprout } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { loadSpeciesSprite } from '@/lib/tank/species-sprite';
import type { Species } from '@/types';

type Props = {
    species: Pick<Species, 'slug' | 'kind'>;
    className?: string;
};

/** Shown while the model loads, or for a species without one. */
const FALLBACKS: Record<Species['kind'], LucideIcon> = {
    fish: Fish,
    invertebrate: Bug,
    amphibian: PawPrint,
    plant: Sprout,
};

/**
 * A small pixel-art picture of a species, drawn from its voxel model.
 * Decorative: label it from the surrounding element.
 */
export function SpeciesIcon({ species, className }: Props) {
    const [sprite, setSprite] = useState<{
        slug: string;
        url: string | null;
    } | null>(null);

    useEffect(() => {
        let current = true;

        void loadSpeciesSprite(species.slug).then((url) => {
            if (current) {
                setSprite({ slug: species.slug, url });
            }
        });

        return () => {
            current = false;
        };
    }, [species.slug]);

    const url = sprite?.slug === species.slug ? sprite.url : null;
    const Fallback = FALLBACKS[species.kind];

    return url === null ? (
        <Fallback
            aria-hidden
            className={cn('size-4 text-muted-foreground', className)}
        />
    ) : (
        <img
            src={url}
            alt=""
            aria-hidden
            className={cn(
                'size-full object-contain [image-rendering:pixelated]',
                className,
            )}
        />
    );
}
