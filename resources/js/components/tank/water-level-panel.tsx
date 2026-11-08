import { router } from '@inertiajs/react';
import { ArrowDownToLine, ArrowUpToLine, Waves } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { waterLevel as waterLevelRoute } from '@/routes/tanks';
import type { TankGrid } from '@/types';
import { PanelSection } from './panel-section';

type Props = {
    tankId: number;
    grid: TankGrid;
    litres: number;
    hasWater: boolean;
};

/** Grid cells per centimetre, and an unsculpted substrate's depth in cells (match TankGeometry). */
const CELLS_PER_CM = 2;
const SUBSTRATE_CELLS = 4;

const toDepth = (level: number) =>
    Math.max(0, (level - SUBSTRATE_CELLS) / CELLS_PER_CM);

/**
 * How much water the tank holds. Draining keeps the water as it is; topping
 * up mixes in fresh tap water. Low water leaves decorations standing out as
 * land; an empty tank needs its animals rehomed first.
 */
export function WaterLevelPanel({ tankId, grid, litres, hasWater }: Props) {
    const current = hasWater ? toDepth(grid.water_level) : 0;
    const deepest = toDepth(grid.max_water_level);
    const [depth, setDepth] = useState(String(current));
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const apply = (waterDepth: number) =>
        router.put(
            waterLevelRoute.url(tankId),
            { water_depth: waterDepth },
            {
                preserveScroll: true,
                only: ['tank', 'events', 'errors'],
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: (errors) => setError(errors.water_depth),
                onSuccess: () => {
                    setError(undefined);
                    setDepth(String(waterDepth));
                },
            },
        );

    const submit = (event: FormEvent) => {
        event.preventDefault();
        apply(Number(depth));
    };

    return (
        <PanelSection
            id="water-level-heading"
            title="Water level"
            action={
                <span className="text-xs text-muted-foreground tabular-nums">
                    {hasWater ? `${current} cm · ${litres} L` : 'Empty'}
                </span>
            }
        >
            <form onSubmit={submit} className="space-y-1.5">
                <Label
                    htmlFor="water-depth"
                    className="font-normal text-muted-foreground"
                >
                    Depth above the gravel (0–{deepest} cm)
                </Label>
                <div className="flex gap-2">
                    <Input
                        id="water-depth"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={deepest}
                        step={0.5}
                        value={depth}
                        onChange={(event) => setDepth(event.target.value)}
                        className="h-8 bg-background"
                    />
                    <Button
                        type="submit"
                        size="sm"
                        disabled={processing || Number(depth) === current}
                    >
                        <Waves /> Set
                    </Button>
                </div>
                <InputError message={error} />
            </form>
            <div className="grid grid-cols-2 gap-2 *:w-full *:justify-start">
                <Button
                    size="sm"
                    variant="outline"
                    disabled={processing || current === deepest}
                    onClick={() => apply(deepest)}
                >
                    <ArrowUpToLine /> Fill to the top
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={processing || !hasWater}
                    onClick={() => apply(0)}
                >
                    <ArrowDownToLine /> Empty
                </Button>
            </div>
        </PanelSection>
    );
}
