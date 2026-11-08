import { Form } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { store } from '@/routes/tanks';
import type { TankSizeLimits } from '@/types';

type Props = {
    limits: TankSizeLimits;
    /** Suggested name, e.g. "Ada's Tank". */
    defaultName: string;
    trigger?: ReactNode;
};

type Dimension = keyof TankSizeLimits;

const DIMENSIONS: { key: Dimension; label: string }[] = [
    { key: 'width', label: 'Width' },
    { key: 'height', label: 'Height' },
    { key: 'depth', label: 'Depth' },
];

/** Gravel depth and the gap between the water and the rim, in cm (matches TankGeometry). */
const SUBSTRATE_CM = 2;
const RIM_GAP_CM = 2;

/** Target thickness of a depth layer, in cm (matches TankGeometry). */
const LAYER_CM = 5.5;

/**
 * Set up a new tank: its name and interior size, and whether it starts
 * planted and stocked. The size is fixed once the tank exists.
 */
export function NewTankDialog({ limits, defaultName, trigger }: Props) {
    const [size, setSize] = useState({ width: 60, height: 35, depth: 30 });
    /** Chosen water depth in cm; null fills to the top, following the height. */
    const [waterDepth, setWaterDepth] = useState<number | null>(null);
    const deepest = Math.max(0, size.height - SUBSTRATE_CM - RIM_GAP_CM);
    const water = Math.min(waterDepth ?? deepest, deepest);
    const litres = Math.round((size.width * size.depth * water) / 1000);
    const layers = Math.max(2, Math.round(size.depth / LAYER_CM));

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button>
                        <Plus /> New tank
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New tank</DialogTitle>
                    <DialogDescription>
                        Choose the inside measurements. A tank keeps its size
                        once it is set up.
                    </DialogDescription>
                </DialogHeader>
                <Form {...store.form()} className="space-y-5">
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="tank-name">Name</Label>
                                <Input
                                    id="tank-name"
                                    name="name"
                                    defaultValue={defaultName}
                                    maxLength={40}
                                    required
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {DIMENSIONS.map(({ key, label }) => (
                                    <div key={key} className="grid gap-2">
                                        <Label htmlFor={`tank-${key}`}>
                                            {label} (cm)
                                        </Label>
                                        <Input
                                            id={`tank-${key}`}
                                            name={key}
                                            type="number"
                                            inputMode="numeric"
                                            min={limits[key][0]}
                                            max={limits[key][1]}
                                            step={1}
                                            value={size[key]}
                                            onChange={(event) =>
                                                setSize((current) => ({
                                                    ...current,
                                                    [key]: Number(
                                                        event.target.value,
                                                    ),
                                                }))
                                            }
                                            required
                                        />
                                        <InputError message={errors[key]} />
                                    </div>
                                ))}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="tank-water-depth">
                                    Water depth above the gravel (cm)
                                </Label>
                                <Input
                                    id="tank-water-depth"
                                    name="water_depth"
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    max={deepest}
                                    step={0.2}
                                    value={water}
                                    onChange={(event) =>
                                        setWaterDepth(
                                            Number(event.target.value),
                                        )
                                    }
                                    required
                                />
                                <p className="text-xs text-muted-foreground">
                                    Up to {deepest} cm. Lower it for a
                                    paludarium with land above the water, or 0
                                    for an empty tank.
                                </p>
                                <InputError message={errors.water_depth} />
                            </div>

                            <p className="text-sm text-muted-foreground tabular-nums">
                                Holds about {litres} litres of water, in{' '}
                                {layers} depth layers. Widths {limits.width[0]}–
                                {limits.width[1]} cm, heights {limits.height[0]}
                                –{limits.height[1]} cm, depths {limits.depth[0]}
                                –{limits.depth[1]} cm.
                            </p>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="tank-stocked"
                                    name="stocked"
                                    value="1"
                                    defaultChecked
                                />
                                <Label htmlFor="tank-stocked">
                                    Start with plants and fish to suit its size
                                </Label>
                            </div>
                            <InputError message={errors.stocked} />

                            <DialogFooter>
                                <Button type="submit" disabled={processing}>
                                    Set up tank
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
