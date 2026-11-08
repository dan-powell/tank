import { router } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowDownToLine,
    ArrowUp,
    ChevronsDown,
    ChevronsUp,
    RotateCcw,
    RotateCw,
    Sprout,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { rotatedSize } from '@/lib/tank/voxel-volume';
import type { TankWorld } from '@/lib/tank/world';
import { cn } from '@/lib/utils';
import { stock } from '@/routes/tanks';
import decorationRoutes from '@/routes/tanks/decorations';
import type {
    DecorationDefinition,
    DecorationSnapshot,
    GridCell,
    PlantSnapshot,
    Species,
    TankGrid,
} from '@/types';
import { PanelBackButton, PanelSection, SealedGuard } from './panel-section';

type Props = {
    tankId: number;
    decoration: DecorationSnapshot;
    definition: DecorationDefinition;
    /** Living plants attached to this decoration. */
    plants: PlantSnapshot[];
    species: Species[];
    grid: TankGrid;
    world: TankWorld;
    /** The anchor picked in the scene, to plant on. */
    selectedAnchor: number | null;
    onSelectAnchor: (anchor: number | null) => void;
    onMove: (position: GridCell, rotation: number) => void;
    onSelectPlant: (plantId: number) => void;
    /** Decorations can't be moved, planted on or removed through a sealed lid. */
    isSealed: boolean;
    onBack: () => void;
};

/** Cells moved per press of a nudge button (1 cm). */
const NUDGE = 2;

/**
 * The selected decoration: turning it, moving it in depth and height (the
 * arrows in the scene cover the rest), the plants on it, and removal.
 */
export function DecorationPanel({
    tankId,
    decoration,
    definition,
    plants,
    species,
    grid,
    world,
    selectedAnchor,
    onSelectAnchor,
    onMove,
    onSelectPlant,
    isSealed,
    onBack,
}: Props) {
    const [x, y, z] = decoration.position;
    const [width, height, depth] = rotatedSize(
        definition.size,
        decoration.rotation,
    );
    const clampCell = (cell: GridCell, size: GridCell): GridCell => [
        clamp(cell[0], 0, grid.width - size[0]),
        clamp(cell[1], 0, grid.height - size[1]),
        clamp(cell[2], 0, grid.depth - size[2]),
    ];

    /** Turn about the decoration's centre, keeping it inside the tank. */
    const rotate = (turns: number) => {
        const rotation = (((decoration.rotation + turns) % 4) + 4) % 4;
        const size = rotatedSize(definition.size, rotation);

        onMove(
            clampCell(
                [
                    x + Math.round((width - size[0]) / 2),
                    y,
                    z + Math.round((depth - size[2]) / 2),
                ],
                size,
            ),
            rotation,
        );
    };

    const nudge = (dy: number, dz: number) =>
        onMove(
            clampCell([x, y + dy, z + dz], [width, height, depth]),
            decoration.rotation,
        );

    const dropToSurface = () => {
        const rest = world.terrain?.restingCell(decoration.id);

        if (rest !== null && rest !== undefined && rest !== y) {
            onMove([x, rest, z], decoration.rotation);
        }
    };

    const isAboveWater = y + height > grid.water_level;

    return (
        <section aria-labelledby="decoration-heading" className="space-y-4">
            <PanelBackButton onClick={onBack} />

            <div className="min-w-0">
                <h2
                    id="decoration-heading"
                    className="truncate text-base font-semibold"
                >
                    {definition.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {definition.description}
                </p>
            </div>

            <SealedGuard isSealed={isSealed}>
                <PanelSection id="decoration-position-heading" title="Position">
                    <p className="text-xs text-muted-foreground">
                        Drag the arrows in the tank to slide it left, right, up
                        or down{' '}
                        <span className="whitespace-nowrap">
                            (and in depth in the 3D view).
                        </span>
                    </p>
                    <div className="grid grid-cols-2 gap-2 *:w-full *:justify-start">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rotate(1)}
                        >
                            <RotateCcw /> Turn left
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rotate(-1)}
                        >
                            <RotateCw /> Turn right
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={z <= 0}
                            onClick={() => nudge(0, -NUDGE)}
                        >
                            <ChevronsUp /> Further back
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={z >= grid.depth - depth}
                            onClick={() => nudge(0, NUDGE)}
                        >
                            <ChevronsDown /> Further forward
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={y >= grid.height - height}
                            onClick={() => nudge(NUDGE, 0)}
                        >
                            <ArrowUp /> Raise
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={y <= 0}
                            onClick={() => nudge(-NUDGE, 0)}
                        >
                            <ArrowDown /> Lower
                        </Button>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={dropToSurface}
                    >
                        <ArrowDownToLine /> Drop onto what&rsquo;s below
                    </Button>
                    {isAboveWater && (
                        <p className="text-xs text-muted-foreground">
                            The top pokes out above the water.
                        </p>
                    )}
                </PanelSection>

                {definition.anchors.length > 0 && (
                    <PanelSection id="decoration-plants-heading" title="Plants">
                        <ul className="space-y-1.5">
                            {definition.anchors.map((_, anchor) => {
                                const plant = plants.find(
                                    (candidate) =>
                                        candidate.attachment?.anchor === anchor,
                                );
                                const plantSpecies = species.find(
                                    (candidate) =>
                                        candidate.id === plant?.species_id,
                                );

                                return (
                                    <AnchorRow
                                        key={anchor}
                                        label={`Spot ${anchor + 1}`}
                                        isSelected={selectedAnchor === anchor}
                                    >
                                        {plant !== undefined ? (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2"
                                                onClick={() =>
                                                    onSelectPlant(plant.id)
                                                }
                                            >
                                                {plant.nickname ??
                                                    plantSpecies?.name ??
                                                    'Plant'}
                                            </Button>
                                        ) : selectedAnchor === anchor ? (
                                            <PlantPicker
                                                key={`${decoration.id}-${anchor}`}
                                                tankId={tankId}
                                                decorationId={decoration.id}
                                                anchor={anchor}
                                                species={species}
                                                onDone={() =>
                                                    onSelectAnchor(null)
                                                }
                                            />
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2"
                                                onClick={() =>
                                                    onSelectAnchor(anchor)
                                                }
                                            >
                                                <Sprout /> Plant here
                                            </Button>
                                        )}
                                    </AnchorRow>
                                );
                            })}
                        </ul>
                    </PanelSection>
                )}

                <RemoveDecorationButton
                    name={definition.name}
                    plantCount={plants.length}
                    onConfirm={() =>
                        router.delete(
                            decorationRoutes.destroy.url([
                                tankId,
                                decoration.id,
                            ]),
                            {
                                preserveScroll: true,
                                only: ['tank', 'events'],
                                onSuccess: onBack,
                            },
                        )
                    }
                />
            </SealedGuard>
        </section>
    );
}

function AnchorRow({
    label,
    isSelected,
    children,
}: {
    label: string;
    isSelected: boolean;
    children: ReactNode;
}) {
    return (
        <li
            className={cn(
                'flex min-h-9 items-center justify-between gap-2 rounded-md px-2 py-1',
                isSelected && 'bg-primary/10',
            )}
        >
            <span className="shrink-0 text-muted-foreground">{label}</span>
            {children}
        </li>
    );
}

/** Choose a plant that can grow on decorations and put it on an anchor. */
function PlantPicker({
    tankId,
    decorationId,
    anchor,
    species,
    onDone,
}: {
    tankId: number;
    decorationId: number;
    anchor: number;
    species: Species[];
    onDone: () => void;
}) {
    const choices = species.filter(
        (candidate) =>
            candidate.anchorage === 'decor' || candidate.anchorage === 'any',
    );
    const [speciesId, setSpeciesId] = useState<string>(
        choices[0] ? String(choices[0].id) : '',
    );
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | undefined>();

    if (choices.length === 0) {
        return (
            <span className="text-xs text-muted-foreground">
                No plants can grow here
            </span>
        );
    }

    const plant = () =>
        router.post(
            stock.url(tankId),
            {
                species_id: Number(speciesId),
                quantity: 1,
                decoration_id: decorationId,
                anchor,
            },
            {
                preserveScroll: true,
                only: ['tank', 'events', 'errors'],
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: (errors) =>
                    setError(
                        errors.anchor ??
                            errors.decoration_id ??
                            errors.quantity,
                    ),
                onSuccess: onDone,
            },
        );

    return (
        <div className="flex min-w-0 flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
                <Select value={speciesId} onValueChange={setSpeciesId}>
                    <SelectTrigger
                        size="sm"
                        className="h-7 w-32"
                        aria-label="Plant species"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {choices.map((choice) => (
                            <SelectItem
                                key={choice.id}
                                value={String(choice.id)}
                            >
                                {choice.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    size="sm"
                    className="h-7"
                    disabled={processing}
                    onClick={plant}
                >
                    Plant
                </Button>
            </div>
            <InputError message={error} />
        </div>
    );
}

function RemoveDecorationButton({
    name,
    plantCount,
    onConfirm,
}: {
    name: string;
    plantCount: number;
    onConfirm: () => void;
}) {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <Trash2 /> Remove from tank
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove the {name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {plantCount === 0
                            ? `The ${name} will be taken out of the tank.`
                            : `The ${name} will be taken out of the tank, and the ${plantCount === 1 ? 'plant' : `${plantCount} plants`} growing on it will drop to the gravel.`}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={onConfirm}
                    >
                        <Trash2 /> Remove
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
