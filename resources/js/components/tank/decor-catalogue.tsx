import { router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { DECOR_VOXEL, CM } from '@/lib/tank/space';
import decorationRoutes from '@/routes/tanks/decorations';
import type { DecorationDefinition } from '@/types';
import { PanelSection } from './panel-section';

type Props = {
    tankId: number;
    catalogue: DecorationDefinition[];
    placedCount: number;
    /** Called with the new decoration's id once it is in the tank. */
    onPlaced: (decorationId: number) => void;
};

/**
 * The decorations that can be added. Each is placed automatically in a free
 * spot, then selected so it can be moved into position.
 */
export function DecorCatalogue({
    tankId,
    catalogue,
    placedCount,
    onPlaced,
}: Props) {
    const [adding, setAdding] = useState<string | null>(null);
    const [error, setError] = useState<string | undefined>();

    const add = (type: string) =>
        router.post(
            decorationRoutes.store.url(tankId),
            { type },
            {
                preserveScroll: true,
                only: ['tank', 'events', 'errors'],
                onStart: () => setAdding(type),
                onFinish: () => setAdding(null),
                onError: (errors) => setError(errors.type),
                onSuccess: () => setError(undefined),
                onFlash: (flash) => {
                    const id = (flash as { placedDecorationId?: number })
                        .placedDecorationId;

                    if (id !== undefined) {
                        onPlaced(id);
                    }
                },
            },
        );

    return (
        <PanelSection
            id="decor-heading"
            title="Aquascaping"
            action={
                <span className="text-xs text-muted-foreground tabular-nums">
                    {placedCount} placed
                </span>
            }
        >
            <p className="text-xs text-muted-foreground">
                New pieces find a free spot on their own. Select one in the tank
                to drag it with the arrows, turn it, or plant on it.
            </p>
            <InputError message={error} />
            <ul className="space-y-2">
                {catalogue.map((definition) => (
                    <li
                        key={definition.slug}
                        className="flex items-center gap-3 rounded-md border border-sidebar-border/60 bg-sidebar/40 p-2"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                                {definition.name}
                            </p>
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                                {definition.description}
                            </p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                                {formatSize(definition)}
                                {definition.anchors.length > 0 &&
                                    ` · ${definition.anchors.length} plant ${definition.anchors.length === 1 ? 'spot' : 'spots'}`}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={adding !== null}
                            onClick={() => add(definition.slug)}
                            aria-label={`Add ${definition.name}`}
                        >
                            <Plus /> Add
                        </Button>
                    </li>
                ))}
            </ul>
        </PanelSection>
    );
}

/** "24 × 18 × 6 cm" (width × height × depth). */
function formatSize(definition: DecorationDefinition): string {
    const cm = (cells: number) => Math.round((cells * DECOR_VOXEL) / CM);

    return definition.size.map(cm).join(' × ') + ' cm';
}
