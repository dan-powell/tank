import { Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
    formatMinute,
    LIGHT_COLOURS,
    LIGHT_SCHEDULES,
} from '@/lib/tank/lighting';
import { cn } from '@/lib/utils';
import type { LightDefinition, LightFixture, TankLighting } from '@/types';
import type { LightActions } from './lighting-panel';

type ListProps = {
    lighting: TankLighting;
    catalogue: LightDefinition[];
    /** Each fixture's timer level right now (0 when off), in fixture order. */
    levels: number[];
    selectedFixtureId: number | null;
    onSelectFixture: (id: number | null) => void;
    actions: LightActions;
};

const RAMP_OPTIONS = [0, 15, 30, 60, 120];

/** Every light on the gantry; the selected one opens up for editing. */
export function LightFixtureList({
    lighting,
    catalogue,
    levels,
    selectedFixtureId,
    onSelectFixture,
    actions,
}: ListProps) {
    if (lighting.fixtures.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No lights yet. Click a slot on the gantry to hang one.
            </p>
        );
    }

    return (
        <ul className="space-y-1.5">
            {lighting.fixtures.map((fixture, index) => {
                const definition = catalogue.find(
                    (entry) => entry.slug === fixture.type,
                );
                const isSelected = fixture.id === selectedFixtureId;
                const level = levels[index] ?? 0;

                return (
                    <li
                        key={fixture.id}
                        className={cn(
                            'border border-sidebar-border',
                            isSelected && 'border-primary/60 bg-primary/5',
                        )}
                    >
                        <button
                            type="button"
                            aria-expanded={isSelected}
                            onClick={() =>
                                onSelectFixture(isSelected ? null : fixture.id)
                            }
                            className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <span
                                aria-hidden
                                className="size-3 shrink-0 border border-black/30"
                                style={{ backgroundColor: fixture.colour }}
                            />
                            <span className="truncate">
                                {definition?.name ?? fixture.type}
                            </span>
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                                {formatMinute(fixture.on_minute)}–
                                {formatMinute(fixture.off_minute)} ·{' '}
                                {level > 0
                                    ? `${Math.round(level * fixture.brightness)}%`
                                    : 'off'}
                            </span>
                        </button>
                        {isSelected && definition !== undefined && (
                            <FixtureSettings
                                key={fixture.id}
                                fixture={fixture}
                                definition={definition}
                                maxLength={
                                    lighting.gantry.columns - fixture.column
                                }
                                actions={actions}
                                onRemoved={() => onSelectFixture(null)}
                            />
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

function FixtureSettings({
    fixture,
    definition,
    maxLength,
    actions,
    onRemoved,
}: {
    fixture: LightFixture;
    definition: LightDefinition;
    /** The longest a tube can be from where it starts. */
    maxLength: number;
    actions: LightActions;
    onRemoved: () => void;
}) {
    const update = (settings: Partial<LightFixture>) =>
        actions.update(fixture.id, settings);
    const [brightness, setBrightness] = useState(fixture.brightness);
    const [customColour, setCustomColour] = useState(fixture.colour);

    return (
        <div className="space-y-3 border-t border-sidebar-border p-2">
            <p className="text-xs text-muted-foreground">
                {definition.description}
            </p>

            <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Colour</p>
                <div className="flex flex-wrap items-center gap-1.5">
                    {LIGHT_COLOURS.map(({ name, colour }) => (
                        <button
                            key={colour}
                            type="button"
                            title={name}
                            aria-label={name}
                            aria-pressed={fixture.colour === colour}
                            onClick={() => {
                                setCustomColour(colour);
                                update({ colour });
                            }}
                            className={cn(
                                'size-6 border border-black/30 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                fixture.colour === colour &&
                                    'ring-2 ring-primary ring-offset-1 ring-offset-sidebar',
                            )}
                            style={{ backgroundColor: colour }}
                        />
                    ))}
                    <input
                        type="color"
                        aria-label="Custom colour"
                        value={customColour}
                        onChange={(event) =>
                            setCustomColour(event.target.value)
                        }
                        onBlur={() =>
                            customColour !== fixture.colour &&
                            update({ colour: customColour })
                        }
                        className="h-6 w-8 cursor-pointer border border-sidebar-border bg-transparent"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Brightness</span>
                    <span className="tabular-nums">{brightness}%</span>
                </div>
                <Slider
                    aria-label="Brightness"
                    min={5}
                    max={100}
                    step={5}
                    value={[brightness]}
                    onValueChange={([value]) => setBrightness(value)}
                    onValueCommit={([value]) => update({ brightness: value })}
                />
            </div>

            {definition.is_tube && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        Length
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            size="icon"
                            variant="outline"
                            className="size-7"
                            aria-label="Shorter"
                            disabled={fixture.length <= definition.min_length}
                            onClick={() =>
                                update({ length: fixture.length - 1 })
                            }
                        >
                            <Minus />
                        </Button>
                        <span className="w-14 text-center text-sm tabular-nums">
                            {fixture.length} slots
                        </span>
                        <Button
                            size="icon"
                            variant="outline"
                            className="size-7"
                            aria-label="Longer"
                            disabled={fixture.length >= maxLength}
                            onClick={() =>
                                update({ length: fixture.length + 1 })
                            }
                        >
                            <Plus />
                        </Button>
                    </div>
                </div>
            )}

            <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Timer</p>
                <div className="flex flex-wrap gap-1">
                    {LIGHT_SCHEDULES.map(({ name, ...schedule }) => (
                        <Button
                            key={name}
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            onClick={() => update(schedule)}
                        >
                            {name}
                        </Button>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <TimeField
                        label="On"
                        minute={fixture.on_minute}
                        onChange={(on_minute) => update({ on_minute })}
                    />
                    <TimeField
                        label="Off"
                        minute={fixture.off_minute}
                        onChange={(off_minute) => update({ off_minute })}
                    />
                    <label className="col-span-2 flex items-center justify-between gap-2">
                        <span className="text-[0.65rem] text-muted-foreground uppercase">
                            Fade in and out
                        </span>
                        <Select
                            value={String(fixture.ramp_minutes)}
                            onValueChange={(value) =>
                                update({ ramp_minutes: Number(value) })
                            }
                        >
                            <SelectTrigger size="sm" className="h-7 w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {RAMP_OPTIONS.map((minutes) => (
                                    <SelectItem
                                        key={minutes}
                                        value={String(minutes)}
                                    >
                                        {minutes === 0
                                            ? 'None'
                                            : `${minutes} min`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>
                </div>
            </div>

            <Button
                size="sm"
                variant="ghost"
                className="w-full justify-start text-muted-foreground"
                onClick={() => {
                    actions.remove(fixture.id);
                    onRemoved();
                }}
            >
                <Trash2 /> Take it down
            </Button>
        </div>
    );
}

/** A time of day, saved once a whole time has been entered. */
function TimeField({
    label,
    minute,
    onChange,
}: {
    label: string;
    minute: number;
    onChange: (minute: number) => void;
}) {
    return (
        <label className="space-y-0.5">
            <span className="text-[0.65rem] text-muted-foreground uppercase">
                {label}
            </span>
            <Input
                type="time"
                step={900}
                className="h-7 px-1.5 text-xs"
                defaultValue={formatMinute(minute)}
                key={minute}
                onBlur={(event) => {
                    const [hours, minutes] = event.target.value
                        .split(':')
                        .map(Number);
                    const next = hours * 60 + minutes;

                    if (Number.isFinite(next) && next !== minute) {
                        onChange(next);
                    }
                }}
            />
        </label>
    );
}
