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
import { cn } from '@/lib/utils';
import { stock } from '@/routes/tanks';
import type { Species } from '@/types';

export function StockDialog({
    tankId,
    species,
}: {
    tankId: number;
    species: Species[];
}) {
    const [open, setOpen] = useState(false);
    const [speciesId, setSpeciesId] = useState<number | null>(
        species[0]?.id ?? null,
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
                <Button variant="outline" size="sm">
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

                    <fieldset className="grid gap-2">
                        <legend className="sr-only">Species</legend>
                        {species.map((definition) => (
                            <label
                                key={definition.id}
                                className={cn(
                                    'flex cursor-pointer gap-3 rounded-lg border p-3 text-sm',
                                    speciesId === definition.id &&
                                        'border-primary bg-accent',
                                )}
                            >
                                <input
                                    type="radio"
                                    name="species_id"
                                    value={definition.id}
                                    checked={speciesId === definition.id}
                                    onChange={() => setSpeciesId(definition.id)}
                                    className="mt-1"
                                />
                                <span>
                                    <span className="font-medium">
                                        {definition.name}
                                    </span>{' '}
                                    <span className="text-muted-foreground italic">
                                        {definition.scientific_name}
                                    </span>
                                    <span className="block text-muted-foreground">
                                        {definition.description}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </fieldset>
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
