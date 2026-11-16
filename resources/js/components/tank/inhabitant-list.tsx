import { router } from '@inertiajs/react';
import {
    ArrowDownWideNarrow,
    ArrowUpNarrowWide,
    BellRing,
    Fish,
    Search,
    Sprout,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { watchedSpecies as watchedSpeciesRoute } from '@/routes/tanks';
import type {
    CreatureSnapshot,
    PlantSnapshot,
    Species,
    TankSelection,
    TankSnapshot,
} from '@/types';
import { PanelSection } from './panel-section';
import { StockDialog } from './stock-dialog';
import type { StockConditions } from './stock-dialog';

type Props = {
    tankId: number;
    creatures: CreatureSnapshot[];
    plants: PlantSnapshot[];
    species: Species[];
    /** Species whose animals pause the tank when close to death. */
    watchedSpecies: number[];
    /** What the tank offers new arrivals (water, land). */
    stockConditions: StockConditions;
    onSelect: (selection: TankSelection) => void;
};

type SortKey = 'name' | 'species' | 'age' | 'health';

type Row = {
    kind: TankSelection['kind'];
    id: number;
    name: string;
    speciesId: number;
    speciesName: string;
    /** Animals: whether it pauses the tank when close to death. */
    isWatched: boolean;
    /** Lower-cased text the search matches against. */
    haystack: string;
    detail: string;
    ageDays: number;
    health: number;
};

const sortLabels: Record<SortKey, string> = {
    name: 'Name',
    species: 'Species',
    age: 'Age',
    health: 'Health',
};

type Group = {
    species: Species | null;
    rows: Row[];
};

/** Choose whether a species' animals pause the tank when close to death, shown straight away. */
function watchSpecies(tankId: number, speciesId: number, watched: boolean) {
    router.put(
        watchedSpeciesRoute.url({ tank: tankId, species: speciesId }),
        { watched },
        {
            preserveScroll: true,
            only: ['tank'],
            optimistic: (props) => {
                const tank = props.tank as TankSnapshot;
                const others = tank.alerts.watched_species.filter(
                    (id) => id !== speciesId,
                );

                return {
                    tank: {
                        ...tank,
                        alerts: {
                            ...tank.alerts,
                            watched_species: watched
                                ? [...others, speciesId]
                                : others,
                        },
                    },
                };
            },
        },
    );
}

/**
 * Every fish and plant in the tank, searchable by name or species and
 * sortable. Choosing a row selects that inhabitant, as clicking it in the
 * scene does. Sorted by species, they are grouped under a heading per
 * species, where animals can be set to pause the tank when close to death.
 */
export function InhabitantList({
    tankId,
    creatures,
    plants,
    species,
    watchedSpecies,
    stockConditions,
    onSelect,
}: Props) {
    const [query, setQuery] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('species');
    const [isDescending, setIsDescending] = useState(false);

    const rows = useMemo(
        () => buildRows(creatures, plants, species, watchedSpecies),
        [creatures, plants, species, watchedSpecies],
    );

    const visibleRows = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const matching =
            needle === ''
                ? rows
                : rows.filter((row) => row.haystack.includes(needle));

        return [...matching].sort((a, b) => {
            const order = compareRows(a, b, sortKey);

            return isDescending ? -order : order;
        });
    }, [rows, query, sortKey, isDescending]);

    const groups = useMemo(
        () => groupRows(visibleRows, sortKey === 'species', species),
        [visibleRows, sortKey, species],
    );

    return (
        <PanelSection
            id="inhabitant-list-heading"
            title={`Inhabitants (${rows.length})`}
            action={
                <StockDialog
                    tankId={tankId}
                    species={species}
                    conditions={stockConditions}
                />
            }
        >
            <div className="space-y-2">
                <div className="relative">
                    <Search
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search by name or species"
                        aria-label="Search inhabitants"
                        className="bg-background pl-8"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        Sort by
                    </span>
                    <Select
                        value={sortKey}
                        onValueChange={(value) => setSortKey(value as SortKey)}
                    >
                        <SelectTrigger
                            size="sm"
                            aria-label="Sort inhabitants by"
                            className="flex-1 bg-background"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(Object.keys(sortLabels) as SortKey[]).map(
                                (key) => (
                                    <SelectItem key={key} value={key}>
                                        {sortLabels[key]}
                                    </SelectItem>
                                ),
                            )}
                        </SelectContent>
                    </Select>
                    <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => setIsDescending((value) => !value)}
                        aria-label={
                            isDescending
                                ? 'Sorted descending; sort ascending'
                                : 'Sorted ascending; sort descending'
                        }
                        title={isDescending ? 'Descending' : 'Ascending'}
                    >
                        {isDescending ? (
                            <ArrowDownWideNarrow />
                        ) : (
                            <ArrowUpNarrowWide />
                        )}
                    </Button>
                </div>
            </div>

            {visibleRows.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                    {rows.length === 0
                        ? 'The tank is empty.'
                        : 'Nothing matches that search.'}
                </p>
            ) : (
                <div className="space-y-3">
                    {groups.map((group) => (
                        <InhabitantGroup
                            key={group.species?.id ?? 'all'}
                            group={group}
                            isWatched={
                                group.species !== null &&
                                watchedSpecies.includes(group.species.id)
                            }
                            onWatch={(watched) =>
                                group.species !== null &&
                                watchSpecies(tankId, group.species.id, watched)
                            }
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </PanelSection>
    );
}

/** One species' heading (when grouped) and its inhabitants. */
function InhabitantGroup({
    group,
    isWatched,
    onWatch,
    onSelect,
}: {
    group: Group;
    isWatched: boolean;
    onWatch: (watched: boolean) => void;
    onSelect: (selection: TankSelection) => void;
}) {
    const definition = group.species;
    const switchId = `watch-species-${definition?.id}`;

    return (
        <div>
            {definition !== null && (
                <div className="flex min-h-7 items-center justify-between gap-2 border-b border-sidebar-border pb-1">
                    <h3 className="truncate text-xs font-medium">
                        {definition.name}{' '}
                        <span className="text-muted-foreground">
                            ({group.rows.length})
                        </span>
                    </h3>
                    {definition.kind !== 'plant' && (
                        <div className="flex shrink-0 items-center gap-1.5">
                            <Label
                                htmlFor={switchId}
                                className="text-xs font-normal text-muted-foreground"
                                title={`Pause the tank when any ${definition.name} is close to death`}
                            >
                                Pause if dying
                            </Label>
                            <Switch
                                id={switchId}
                                checked={isWatched}
                                onCheckedChange={onWatch}
                            />
                        </div>
                    )}
                </div>
            )}
            <ul className="-mx-2">
                {group.rows.map((row) => (
                    <li key={`${row.kind}-${row.id}`}>
                        <InhabitantRow row={row} onSelect={onSelect} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

function InhabitantRow({
    row,
    onSelect,
}: {
    row: Row;
    onSelect: (selection: TankSelection) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onSelect({ kind: row.kind, id: row.id })}
            className="flex w-full items-center gap-3 px-2 py-1.5 text-left transition-colors outline-none hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:ring-1 focus-visible:ring-ring"
        >
            {row.kind === 'creature' ? (
                <Fish
                    aria-hidden
                    className="size-4 shrink-0 text-sky-600 dark:text-sky-400"
                />
            ) : (
                <Sprout
                    aria-hidden
                    className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                />
            )}
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-sm">
                    {row.name}
                    {row.isWatched && (
                        <BellRing
                            className="size-3 shrink-0 text-muted-foreground"
                            aria-label="Pauses the tank when close to death"
                        />
                    )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                    {row.detail}
                </span>
            </span>
            <Progress
                value={Math.round(row.health * 100)}
                aria-label={`${row.name} health`}
                className="w-10 shrink-0"
                indicatorClassName={healthColour(row.health)}
            />
        </button>
    );
}

/** Rows split into one group per species, in the order they appear; or one ungrouped list. */
function groupRows(
    rows: Row[],
    bySpecies: boolean,
    species: Species[],
): Group[] {
    if (!bySpecies) {
        return [{ species: null, rows }];
    }

    const byId = new Map(
        species.map((definition) => [definition.id, definition]),
    );
    const groups = new Map<number, Group>();

    for (const row of rows) {
        const group = groups.get(row.speciesId) ?? {
            species: byId.get(row.speciesId) ?? null,
            rows: [],
        };
        group.rows.push(row);
        groups.set(row.speciesId, group);
    }

    return [...groups.values()];
}

function buildRows(
    creatures: CreatureSnapshot[],
    plants: PlantSnapshot[],
    species: Species[],
    watchedSpecies: number[],
): Row[] {
    const byId = new Map(
        species.map((definition) => [definition.id, definition]),
    );
    const rows: Row[] = [];

    for (const creature of creatures) {
        const definition = byId.get(creature.species_id);

        if (definition === undefined) {
            continue;
        }

        const isFry = creature.size < (definition.adult_size ?? 1) * 0.35;
        const facts = [
            creature.sex === 'female' ? 'Female' : 'Male',
            formatAge(creature.age_days),
            isFry ? 'fry' : null,
            creature.is_pregnant ? 'pregnant' : null,
        ].filter((fact) => fact !== null);

        rows.push(
            row(
                'creature',
                creature.id,
                creature.nickname,
                definition,
                facts,
                creature,
                creature.pause_when_dying ??
                    watchedSpecies.includes(definition.id),
            ),
        );
    }

    for (const plant of plants) {
        const definition = byId.get(plant.species_id);

        if (definition === undefined) {
            continue;
        }

        rows.push(
            row(
                'plant',
                plant.id,
                plant.nickname,
                definition,
                [formatAge(plant.age_days)],
                plant,
                false,
            ),
        );
    }

    return rows;
}

function row(
    kind: Row['kind'],
    id: number,
    nickname: string | null,
    definition: Species,
    facts: string[],
    entity: { age_days: number; health: number },
    isWatched: boolean,
): Row {
    const name = nickname ?? definition.name;
    const detail =
        nickname === null
            ? facts.join(' · ')
            : [definition.name, ...facts].join(' · ');

    return {
        kind,
        id,
        name,
        speciesId: definition.id,
        speciesName: definition.name,
        isWatched,
        haystack: [nickname, definition.name, definition.scientific_name]
            .filter((part) => part !== null)
            .join(' ')
            .toLowerCase(),
        detail,
        ageDays: entity.age_days,
        health: entity.health,
    };
}

/** Ascending order for the chosen key, with stable tie-breaks. */
function compareRows(a: Row, b: Row, key: SortKey): number {
    const byName = a.name.localeCompare(b.name) || a.id - b.id;

    switch (key) {
        case 'species':
            return a.speciesName.localeCompare(b.speciesName) || byName;
        case 'age':
            return a.ageDays - b.ageDays || byName;
        case 'health':
            return a.health - b.health || byName;
        default:
            return byName;
    }
}

function healthColour(health: number): string {
    if (health > 0.6) {
        return 'bg-emerald-500';
    }

    return health > 0.3 ? 'bg-amber-500' : 'bg-red-500';
}

function formatAge(days: number): string {
    if (days < 1) {
        return 'under a day';
    }

    const whole = Math.floor(days);

    return whole === 1 ? '1 day' : `${whole} days`;
}
