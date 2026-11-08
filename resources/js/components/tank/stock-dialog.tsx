import { router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { stock } from '@/routes/tanks';
import type { Habitat, Species } from '@/types';

/** What the tank currently offers new arrivals. */
export type StockConditions = {
    hasWater: boolean;
    hasLand: boolean;
    isSealed: boolean;
};

const GROUPS: { title: string; habitats: Habitat[] }[] = [
    { title: 'In the water', habitats: ['aquatic'] },
    { title: "At the water's edge", habitats: ['emergent', 'amphibious'] },
    { title: 'On land', habitats: ['terrestrial'] },
];

/** Why a species can't go into the tank as it is, if it can't. */
function unavailableReason(
    species: Species,
    conditions: StockConditions,
): string | null {
    const isPlant = species.kind === 'plant';

    switch (species.habitat) {
        case 'aquatic':
            return conditions.hasWater ? null : 'Needs water';
        case 'emergent':
            return conditions.hasWater ? null : 'Needs a waterline to root at';
        case 'terrestrial':
            return conditions.hasLand
                ? null
                : isPlant
                  ? 'Needs gravel above the water'
                  : 'Needs dry land above the water';
        case 'amphibious':
            return conditions.hasWater && conditions.hasLand
                ? null
                : 'Needs both water and dry land';
    }
}

export function StockDialog({
    tankId,
    species,
    conditions,
}: {
    tankId: number;
    species: Species[];
    conditions: StockConditions;
}) {
    const [open, setOpen] = useState(false);
    const firstAvailable = species.find(
        (definition) => unavailableReason(definition, conditions) === null,
    );
    const [speciesId, setSpeciesId] = useState<number | null>(
        firstAvailable?.id ?? null,
    );
    const [quantity, setQuantity] = useState(1);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        router.post(
            stock.url(tankId),
            { species_id: speciesId, quantity },
            {
                preserveScroll: true,
                only: ['tank', 'events', 'errors'],
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: (validationErrors) => setErrors(validationErrors),
                onSuccess: () => {
                    setErrors({});
                    setOpen(false);
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={conditions.isSealed}
                    title={
                        conditions.isSealed
                            ? 'Lift the lid to add plants or animals'
                            : undefined
                    }
                >
                    <Plus /> Add stock
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Add plants or animals</DialogTitle>
                        <DialogDescription>
                            New arrivals are young adults. Overstocking will
                            strain your water quality.
                        </DialogDescription>
                    </DialogHeader>

                    <RadioGroup
                        aria-label="Species"
                        name="species_id"
                        value={speciesId === null ? '' : String(speciesId)}
                        onValueChange={(value) => setSpeciesId(Number(value))}
                        className="max-h-[50vh] gap-4 overflow-y-auto pr-1"
                    >
                        {GROUPS.map((group) => {
                            const members = species.filter((definition) =>
                                group.habitats.includes(definition.habitat),
                            );

                            if (members.length === 0) {
                                return null;
                            }

                            return (
                                <div key={group.title} className="space-y-2">
                                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        {group.title}
                                    </p>
                                    {members.map((definition) => {
                                        const reason = unavailableReason(
                                            definition,
                                            conditions,
                                        );

                                        return (
                                            <Label
                                                key={definition.id}
                                                className={cn(
                                                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 leading-normal font-normal',
                                                    speciesId ===
                                                        definition.id &&
                                                        'border-primary bg-accent',
                                                    reason !== null &&
                                                        'cursor-not-allowed opacity-60',
                                                )}
                                            >
                                                <RadioGroupItem
                                                    value={String(
                                                        definition.id,
                                                    )}
                                                    disabled={reason !== null}
                                                    className="mt-0.5"
                                                />
                                                <span>
                                                    <span className="font-medium">
                                                        {definition.name}
                                                    </span>{' '}
                                                    <span className="text-muted-foreground italic">
                                                        {
                                                            definition.scientific_name
                                                        }
                                                    </span>
                                                    <span className="block text-muted-foreground">
                                                        {definition.description}
                                                    </span>
                                                    {reason !== null && (
                                                        <span className="block text-xs font-medium text-amber-600 dark:text-amber-400">
                                                            {reason}
                                                        </span>
                                                    )}
                                                </span>
                                            </Label>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </RadioGroup>
                    <InputError message={errors.species_id} />

                    <div className="grid gap-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                            id="quantity"
                            type="number"
                            min={1}
                            max={5}
                            value={quantity}
                            onChange={(event) =>
                                setQuantity(Number(event.target.value))
                            }
                            className="w-24"
                        />
                        <InputError message={errors.quantity} />
                    </div>

                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={processing || speciesId === null}
                        >
                            Add to tank
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
