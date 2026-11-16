import { LampCeiling, MoveRight, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { fixtureLevel } from '@/lib/tank/lighting';
import { cn } from '@/lib/utils';
import type {
    LightDefinition,
    LightFixture,
    LightMode,
    TankLighting,
} from '@/types';
import type { LightActions } from './lighting-panel';

type Props = {
    lighting: TankLighting;
    catalogue: LightDefinition[];
    lightMode: LightMode;
    simSeconds: number;
    selectedFixtureId: number | null;
    onSelectFixture: (id: number | null) => void;
    actions: LightActions;
};

type Slot = { column: number; row: number };

/** Slots a new tube takes by default. */
const DEFAULT_TUBE_LENGTH = 4;

/**
 * The gantry seen from above, back of the tank at the top: each light
 * spans its slots in its own colour. Click a light to pick it, or an empty
 * slot to hang a new light there (or move the picked one to it).
 */
export function GantryMap({
    lighting,
    catalogue,
    lightMode,
    simSeconds,
    selectedFixtureId,
    onSelectFixture,
    actions,
}: Props) {
    const { columns, rows } = lighting.gantry;
    const [slot, setSlot] = useState<Slot | null>(null);
    const occupant = (column: number, row: number): LightFixture | undefined =>
        lighting.fixtures.find(
            (fixture) =>
                fixture.row === row &&
                column >= fixture.column &&
                column < fixture.column + fixture.length,
        );
    const selected = lighting.fixtures.find(
        (fixture) => fixture.id === selectedFixtureId,
    );

    /** Free slots in a row from a column rightwards, ignoring one light (the one being moved). */
    const freeRun = (column: number, row: number, ignore?: number): number => {
        let run = 0;

        while (column + run < columns) {
            const taken = occupant(column + run, row);

            if (taken !== undefined && taken.id !== ignore) {
                break;
            }

            run++;
        }

        return run;
    };

    const isFull = lighting.fixtures.length >= lighting.max_fixtures;

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-[0.65rem] text-muted-foreground uppercase">
                <span>Back</span>
                <span>Seen from above</span>
            </div>
            <div
                className="grid gap-0.5 border border-sidebar-border bg-muted/40 p-0.5"
                style={{
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${rows}, 1.75rem)`,
                }}
            >
                {Array.from({ length: rows }, (_, row) =>
                    Array.from({ length: columns }, (_, column) =>
                        occupant(column, row) === undefined ? (
                            <button
                                key={`${column}-${row}`}
                                type="button"
                                aria-label={`Empty slot ${column + 1} in row ${row + 1}`}
                                onClick={() => setSlot({ column, row })}
                                className={cn(
                                    'border border-dashed border-sidebar-border/70 transition-colors outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring',
                                    slot?.column === column &&
                                        slot.row === row &&
                                        'bg-primary/25',
                                )}
                                style={{
                                    gridColumn: column + 1,
                                    gridRow: row + 1,
                                }}
                            />
                        ) : null,
                    ),
                )}
                {lighting.fixtures.map((fixture) => {
                    const level = fixtureLevel(fixture, simSeconds, lightMode);
                    const name =
                        catalogue.find((entry) => entry.slug === fixture.type)
                            ?.name ?? fixture.type;

                    return (
                        <button
                            key={fixture.id}
                            type="button"
                            aria-label={`${name}, ${level > 0 ? `on at ${Math.round(level * 100)}%` : 'off'}`}
                            aria-pressed={fixture.id === selectedFixtureId}
                            onClick={() => {
                                setSlot(null);
                                onSelectFixture(
                                    fixture.id === selectedFixtureId
                                        ? null
                                        : fixture.id,
                                );
                            }}
                            className={cn(
                                'relative flex items-center justify-center overflow-hidden border border-black/30 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                fixture.id === selectedFixtureId &&
                                    'ring-2 ring-primary ring-offset-1 ring-offset-sidebar',
                            )}
                            style={{
                                gridColumn: `${fixture.column + 1} / span ${fixture.length}`,
                                gridRow: fixture.row + 1,
                                backgroundColor: fixture.colour,
                            }}
                        >
                            {/* Darkened while off or dimmed. */}
                            <span
                                className="absolute inset-0 bg-black"
                                style={{
                                    opacity:
                                        0.65 *
                                        (1 -
                                            level * (fixture.brightness / 100)),
                                }}
                            />
                            <LampCeiling className="relative size-3.5 text-white mix-blend-difference" />
                        </button>
                    );
                })}
            </div>
            <div className="text-[0.65rem] text-muted-foreground uppercase">
                Front
            </div>

            {slot !== null && (
                <SlotChoices
                    slot={slot}
                    catalogue={catalogue}
                    isFull={isFull}
                    freeSlots={freeRun(slot.column, slot.row)}
                    selected={selected}
                    selectedFits={
                        selected !== undefined &&
                        freeRun(slot.column, slot.row, selected.id) >=
                            selected.length
                    }
                    onInstall={(definition, length) => {
                        actions.install(
                            definition.slug,
                            slot.column,
                            slot.row,
                            length,
                        );
                        setSlot(null);
                    }}
                    onMove={(fixture) => {
                        actions.update(fixture.id, {
                            column: slot.column,
                            row: slot.row,
                        });
                        setSlot(null);
                    }}
                    onCancel={() => setSlot(null)}
                />
            )}
        </div>
    );
}

function SlotChoices({
    slot,
    catalogue,
    isFull,
    freeSlots,
    selected,
    selectedFits,
    onInstall,
    onMove,
    onCancel,
}: {
    slot: Slot;
    catalogue: LightDefinition[];
    isFull: boolean;
    freeSlots: number;
    selected: LightFixture | undefined;
    selectedFits: boolean;
    onInstall: (definition: LightDefinition, length: number) => void;
    onMove: (fixture: LightFixture) => void;
    onCancel: () => void;
}) {
    return (
        <div className="space-y-2 border border-sidebar-border bg-sidebar/60 p-2">
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    Slot {slot.column + 1}, row {slot.row + 1}
                </p>
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    aria-label="Close"
                    onClick={onCancel}
                >
                    <X />
                </Button>
            </div>
            {isFull ? (
                <p className="text-xs text-muted-foreground">
                    The gantry is full. Take a light down to add another.
                </p>
            ) : (
                <div className="grid gap-1.5">
                    {catalogue.map((definition) => {
                        const length = definition.is_tube
                            ? Math.min(DEFAULT_TUBE_LENGTH, freeSlots)
                            : 1;

                        return (
                            <Button
                                key={definition.slug}
                                size="sm"
                                variant="outline"
                                className="justify-start"
                                title={definition.description}
                                disabled={length < definition.min_length}
                                onClick={() => onInstall(definition, length)}
                            >
                                <Plus /> {definition.name}
                                {definition.is_tube &&
                                    length >= definition.min_length && (
                                        <span className="ml-auto text-xs text-muted-foreground">
                                            {length} slots
                                        </span>
                                    )}
                            </Button>
                        );
                    })}
                </div>
            )}
            {selected !== undefined && selectedFits && (
                <Button
                    size="sm"
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => onMove(selected)}
                >
                    <MoveRight /> Move the selected light here
                </Button>
            )}
        </div>
    );
}
