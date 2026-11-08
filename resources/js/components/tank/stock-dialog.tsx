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

                    <RadioGroup
                        aria-label="Species"
                        name="species_id"
                        value={speciesId === null ? '' : String(speciesId)}
                        onValueChange={(value) => setSpeciesId(Number(value))}
                        className="gap-2"
                    >
                        {species.map((definition) => (
                            <Label
                                key={definition.id}
                                className={cn(
                                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 leading-normal font-normal',
                                    speciesId === definition.id &&
                                        'border-primary bg-accent',
                                )}
                            >
                                <RadioGroupItem
                                    value={String(definition.id)}
                                    className="mt-0.5"
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
                            </Label>
                        ))}
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
