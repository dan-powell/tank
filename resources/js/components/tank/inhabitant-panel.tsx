import { router } from '@inertiajs/react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CM, TANK } from '@/lib/tank/space';
import type { TankWorld } from '@/lib/tank/world';
import creatureRoutes from '@/routes/tanks/creatures';
import plantRoutes from '@/routes/tanks/plants';
import type { CreatureSnapshot, PlantSnapshot, Species } from '@/types';

export type Inhabitant =
    | { kind: 'creature'; entity: CreatureSnapshot; species: Species }
    | { kind: 'plant'; entity: PlantSnapshot; species: Species };

type Props = {
    tankId: number;
    inhabitant: Inhabitant;
    world: TankWorld;
    /** Deselect and return to the tank overview. */
    onBack: () => void;
};

const visitOptions = { preserveScroll: true, only: ['tank', 'events'] };

/**
 * Details of the inhabitant selected in the scene: its stats, a name, and
 * what can be done with it. Replaces the whole side panel while selected.
 */
export function InhabitantPanel({ tankId, inhabitant, world, onBack }: Props) {
    const { kind, entity, species } = inhabitant;
    const url =
        kind === 'creature'
            ? {
                  update: creatureRoutes.update.url([tankId, entity.id]),
                  destroy: creatureRoutes.destroy.url([tankId, entity.id]),
              }
            : {
                  update: plantRoutes.update.url([tankId, entity.id]),
                  destroy: plantRoutes.destroy.url([tankId, entity.id]),
              };
    const title = entity.nickname ?? species.name;

    return (
        <section aria-labelledby="inhabitant-heading" className="space-y-4">
            <Button
                size="sm"
                variant="ghost"
                className="-ml-2"
                onClick={onBack}
                title="Back to the tank (Esc)"
            >
                <ArrowLeft /> Back to tank
            </Button>

            <div className="min-w-0">
                <h2
                    id="inhabitant-heading"
                    className="truncate text-base font-semibold"
                >
                    {title}
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                    {entity.nickname !== null && `${species.name} · `}
                    {species.scientific_name !== null && (
                        <i>{species.scientific_name}</i>
                    )}
                </p>
            </div>

            {species.description !== null && (
                <p className="text-sm text-muted-foreground">
                    {species.description}
                </p>
            )}

            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
                {inhabitant.kind === 'creature' ? (
                    <CreatureStats
                        creature={inhabitant.entity}
                        species={species}
                    />
                ) : (
                    <PlantStats plant={inhabitant.entity} species={species} />
                )}
            </dl>

            <NameForm
                key={`${kind}-${entity.id}`}
                url={url.update}
                nickname={entity.nickname}
                placeholder={species.name}
            />

            <RemoveButton
                key={`remove-${kind}-${entity.id}`}
                name={title}
                onConfirm={() =>
                    router.delete(url.destroy, {
                        ...visitOptions,
                        onBefore: () => {
                            if (kind === 'creature') {
                                world.removedCreatures.add(entity.id);
                            }
                        },
                    })
                }
            />
        </section>
    );
}

function CreatureStats({
    creature,
    species,
}: {
    creature: CreatureSnapshot;
    species: Species;
}) {
    const isFry = creature.size < (species.adult_size ?? 1) * 0.35;

    return (
        <>
            <Stat label="Sex">
                <span className="capitalize">{creature.sex}</span>
                {creature.is_pregnant && (
                    <span className="text-muted-foreground"> · pregnant</span>
                )}
            </Stat>
            <Stat label="Age">
                {formatDays(creature.age_days)}
                {isFry && <span className="text-muted-foreground"> · fry</span>}
            </Stat>
            <Stat label="Length">{creature.size.toFixed(1)} cm</Stat>
            <Stat label="Generation">{creature.generation}</Stat>
            <Stat label="Health">
                <Meter value={creature.health} className="bg-emerald-500" />
            </Stat>
            <Stat label="Hunger">
                <Meter value={creature.hunger} className="bg-amber-500" />
            </Stat>
        </>
    );
}

function PlantStats({
    plant,
    species,
}: {
    plant: PlantSnapshot;
    species: Species;
}) {
    const heightCm =
        (plant.segments *
            (species.render.segment_height ?? 0.06) *
            TANK.height) /
        CM;

    return (
        <>
            <Stat label="Age">{formatDays(plant.age_days)}</Stat>
            <Stat label="Height">{heightCm.toFixed(1)} cm</Stat>
            <Stat label="Health">
                <Meter value={plant.health} className="bg-emerald-500" />
            </Stat>
        </>
    );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
    return (
        <>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right tabular-nums">{children}</dd>
        </>
    );
}

/** A 0..1 value as a small bar with its percentage. */
function Meter({ value, className }: { value: number; className: string }) {
    const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);

    return (
        <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <span
                    className={`block h-full rounded-full ${className}`}
                    style={{ width: `${percent}%` }}
                />
            </span>
            <span className="w-9 text-right">{percent}%</span>
        </span>
    );
}

function formatDays(days: number): string {
    if (days < 1) {
        return 'Under a day';
    }

    const whole = Math.floor(days);

    return whole === 1 ? '1 day' : `${whole} days`;
}

function NameForm({
    url,
    nickname,
    placeholder,
}: {
    url: string;
    nickname: string | null;
    placeholder: string;
}) {
    const [name, setName] = useState(nickname ?? '');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const isChanged = name.trim() !== (nickname ?? '');

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.patch(
            url,
            { nickname: name },
            {
                ...visitOptions,
                only: [...visitOptions.only, 'errors'],
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: (errors) => setError(errors.nickname),
                onSuccess: () => {
                    setError(undefined);
                    setName((current) => current.trim());
                },
            },
        );
    };

    return (
        <form onSubmit={submit} className="space-y-1.5">
            <Label htmlFor="inhabitant-name">Name</Label>
            <div className="flex gap-2">
                <Input
                    id="inhabitant-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={placeholder}
                    maxLength={40}
                    className="h-8"
                />
                <Button
                    type="submit"
                    size="sm"
                    disabled={!isChanged || processing}
                >
                    Save
                </Button>
            </div>
            <InputError message={error} />
        </form>
    );
}

function RemoveButton({
    name,
    onConfirm,
}: {
    name: string;
    onConfirm: () => void;
}) {
    const [isConfirming, setIsConfirming] = useState(false);

    if (!isConfirming) {
        return (
            <Button
                size="sm"
                variant="outline"
                onClick={() => setIsConfirming(true)}
            >
                <Trash2 /> Remove from tank
            </Button>
        );
    }

    return (
        <div className="space-y-2 rounded-md border border-destructive/40 p-2">
            <p className="text-sm">Remove {name} from the tank for good?</p>
            <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={onConfirm}>
                    <Trash2 /> Remove
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsConfirming(false)}
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
}
