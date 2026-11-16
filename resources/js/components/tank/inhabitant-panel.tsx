import { router } from '@inertiajs/react';
import { Move, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MOSS_SPACING } from '@/lib/tank/plant-assembly';
import { CELLS_PER_CM, CM, PLANT_HEIGHT_UNIT } from '@/lib/tank/space';
import type { TankWorld } from '@/lib/tank/world';
import creatureRoutes from '@/routes/tanks/creatures';
import plantRoutes from '@/routes/tanks/plants';
import type {
    CreatureIntent,
    CreatureMood,
    CreatureSnapshot,
    PlantSnapshot,
    Species,
    TankSnapshot,
} from '@/types';
import { SelectionPanelHeader } from './panel-section';

export type Inhabitant =
    | { kind: 'creature'; entity: CreatureSnapshot; species: Species }
    | { kind: 'plant'; entity: PlantSnapshot; species: Species };

type Props = {
    tankId: number;
    inhabitant: Inhabitant;
    /** Species whose animals pause the tank when close to death. */
    watchedSpecies: number[];
    world: TankWorld;
    /** Start choosing a new spot for it in the tank. */
    onMove: () => void;
    /** Deselect and return to the tank overview. */
    onBack: () => void;
    /** Whether the camera is following it. */
    isFollowing: boolean;
    onToggleFollow: () => void;
};

const visitOptions = { preserveScroll: true, only: ['tank', 'events'] };

/**
 * Details of the inhabitant selected in the scene: its stats, a name, and
 * what can be done with it. Replaces the whole side panel while selected.
 */
export function InhabitantPanel({
    tankId,
    inhabitant,
    watchedSpecies,
    world,
    onMove,
    onBack,
    isFollowing,
    onToggleFollow,
}: Props) {
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
            <SelectionPanelHeader
                isFollowing={isFollowing}
                onBack={onBack}
                onToggleFollow={onToggleFollow}
            />

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
                        world={world}
                    />
                ) : (
                    <PlantStats plant={inhabitant.entity} species={species} />
                )}
            </dl>

            {inhabitant.kind === 'creature' && (
                <PauseWhenDying
                    url={url.update}
                    creature={inhabitant.entity}
                    speciesName={species.name}
                    isSpeciesWatched={watchedSpecies.includes(species.id)}
                />
            )}

            <NameForm
                key={`${kind}-${entity.id}`}
                url={url.update}
                nickname={entity.nickname}
                placeholder={species.name}
            />

            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={onMove}>
                    <Move /> Move
                </Button>
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
            </div>
        </section>
    );
}

type PauseChoice = 'species' | 'on' | 'off';

/** Whether this animal pauses the tank when close to death: as its species does, always, or never. */
function PauseWhenDying({
    url,
    creature,
    speciesName,
    isSpeciesWatched,
}: {
    url: string;
    creature: CreatureSnapshot;
    speciesName: string;
    isSpeciesWatched: boolean;
}) {
    const choice: PauseChoice =
        creature.pause_when_dying === null
            ? 'species'
            : creature.pause_when_dying
              ? 'on'
              : 'off';

    const choose = (value: string) => {
        if (value === '' || value === choice) {
            return;
        }

        const pauseWhenDying = value === 'species' ? null : value === 'on';

        router.patch(
            url,
            { pause_when_dying: pauseWhenDying },
            {
                ...visitOptions,
                optimistic: (props) => {
                    const tank = props.tank as TankSnapshot;

                    return {
                        tank: {
                            ...tank,
                            creatures: tank.creatures.map((other) =>
                                other.id === creature.id
                                    ? {
                                          ...other,
                                          pause_when_dying: pauseWhenDying,
                                      }
                                    : other,
                            ),
                        },
                    };
                },
            },
        );
    };

    return (
        <div className="space-y-1.5">
            <Label id="pause-when-dying-label" className="text-xs">
                Pause the tank if close to death
            </Label>
            <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={choice}
                onValueChange={choose}
                aria-labelledby="pause-when-dying-label"
                className="w-full *:flex-1"
            >
                <ToggleGroupItem
                    value="species"
                    title={`Follow the ${speciesName} setting on the Inhabitants tab`}
                >
                    As species ({isSpeciesWatched ? 'on' : 'off'})
                </ToggleGroupItem>
                <ToggleGroupItem value="on">On</ToggleGroupItem>
                <ToggleGroupItem value="off">Off</ToggleGroupItem>
            </ToggleGroup>
        </div>
    );
}

function CreatureStats({
    creature,
    species,
    world,
}: {
    creature: CreatureSnapshot;
    species: Species;
    world: TankWorld;
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
                <Meter
                    label="Health"
                    value={creature.health}
                    className="bg-emerald-500"
                />
            </Stat>
            <Stat label="Hunger">
                <Meter
                    label="Hunger"
                    value={creature.hunger}
                    className="bg-amber-500"
                />
            </Stat>
            <Stat label="Behaviour">
                <LiveBehaviour creature={creature} world={world} />
            </Stat>
        </>
    );
}

const intentLabels: Record<CreatureIntent, string> = {
    wander: 'Wandering',
    explore: 'Exploring',
    hunt: 'Hunting',
    rest: 'Resting',
    hide: 'Hiding',
    shoal: 'Shoaling',
    patrol: 'Patrolling',
};

const moodLabels: Record<CreatureMood, string> = {
    zoomies: 'Zoomies',
    skittish: 'Skittish',
    sluggish: 'Sluggish',
};

/** How often (ms) the behaviour badges catch up with the scene. */
const BEHAVIOUR_REFRESH_MS = 250;

function readBehaviour(
    creature: CreatureSnapshot,
    world: TankWorld,
): { intent: CreatureIntent; moods: CreatureMood[] } {
    const body = world.creatures.get(creature.id);

    return {
        intent: body?.intent ?? creature.intent,
        moods: body?.moods ?? creature.moods,
    };
}

/**
 * What the creature is doing right now, as the scene has it (e.g. hunting
 * the moment it spots food), rather than as of the last snapshot.
 */
function LiveBehaviour({
    creature,
    world,
}: {
    creature: CreatureSnapshot;
    world: TankWorld;
}) {
    const [behaviour, setBehaviour] = useState(() =>
        readBehaviour(creature, world),
    );

    useEffect(() => {
        const timer = window.setInterval(() => {
            const next = readBehaviour(creature, world);

            setBehaviour((current) =>
                current.intent === next.intent &&
                current.moods.join() === next.moods.join()
                    ? current
                    : next,
            );
        }, BEHAVIOUR_REFRESH_MS);

        return () => window.clearInterval(timer);
    }, [creature, world]);

    return (
        <span className="inline-flex flex-wrap justify-end gap-1">
            <Badge variant="secondary">{intentLabels[behaviour.intent]}</Badge>
            {behaviour.moods.map((mood) => (
                <Badge key={mood} variant="outline">
                    {moodLabels[mood]}
                </Badge>
            ))}
        </span>
    );
}

function PlantStats({
    plant,
    species,
}: {
    plant: PlantSnapshot;
    species: Species;
}) {
    const isCushion = species.behaviour === 'cushion';
    // Moss spreads instead of growing up: one patch per segment, about MOSS_SPACING apart.
    const sizeCm = isCushion
        ? (2 * MOSS_SPACING * Math.sqrt(plant.segments / Math.PI)) /
          CELLS_PER_CM
        : (plant.segments *
              (species.render.segment_height ?? 0.06) *
              PLANT_HEIGHT_UNIT) /
          CM;

    return (
        <>
            <Stat label="Age">{formatDays(plant.age_days)}</Stat>
            <Stat label={isCushion ? 'Spread' : 'Height'}>
                {sizeCm.toFixed(1)} cm
            </Stat>
            <Stat label="Health">
                <Meter
                    label="Health"
                    value={plant.health}
                    className="bg-emerald-500"
                />
            </Stat>
            {species.light !== null && (
                <Stat label="Light">
                    <LightVerdict light={plant.light} needs={species.light} />
                </Stat>
            )}
        </>
    );
}

/** Daily light, as a multiple of the top of a species' range, that scorches it (matches PlantGrowthSystem). */
const SCORCH_MULTIPLE = 2.5;

/**
 * How a plant's daily light compares with what its species needs: too
 * little starves it, up to the top of its range speeds its growth.
 */
function LightVerdict({
    light,
    needs: [minimum, saturation],
}: {
    light: number;
    needs: [number, number];
}) {
    const [verdict, tone] =
        light < minimum
            ? ['Too dark', 'text-amber-600 dark:text-amber-400']
            : light > saturation * SCORCH_MULTIPLE
              ? ['Scorching', 'text-amber-600 dark:text-amber-400']
              : light >= saturation
                ? ['Bright', 'text-emerald-600 dark:text-emerald-400']
                : ['Enough', ''];

    return (
        <span
            className={tone}
            title={`${light.toFixed(2)} a day; needs ${minimum}, thrives from ${saturation}`}
        >
            {verdict}
        </span>
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
function Meter({
    label,
    value,
    className,
}: {
    label: string;
    value: number;
    className: string;
}) {
    const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);

    return (
        <span className="inline-flex items-center gap-2">
            <Progress
                value={percent}
                aria-label={label}
                className="h-1.5 w-16 bg-muted"
                indicatorClassName={className}
            />
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
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <Trash2 /> Remove from tank
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {name} will be taken out of the tank for good.
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
