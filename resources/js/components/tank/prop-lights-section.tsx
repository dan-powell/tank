import { router } from '@inertiajs/react';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import decorationRoutes from '@/routes/tanks/decorations';
import type {
    DecorationDefinition,
    DecorationLightMode,
    DecorationLights,
    DecorationSnapshot,
    TankSnapshot,
} from '@/types';
import { PanelSection } from './panel-section';

type Props = {
    tankId: number;
    decorations: DecorationSnapshot[];
    catalogue: DecorationDefinition[];
};

/**
 * LEDs built into every decoration (the treasure chest's jewels, the coral
 * wall's crevices, a niche in each rock). Purely for looks: they don't light
 * the plants.
 */
export function PropLightsSection({ tankId, decorations, catalogue }: Props) {
    const lit = decorations.filter((decoration) => decoration.lights !== null);

    return (
        <PanelSection id="prop-lights-heading" title="Decoration LEDs">
            {lit.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Every decoration has LEDs built in. Add one in Aquascaping
                    to light it up.
                </p>
            ) : (
                <ul className="space-y-2">
                    {lit.map((decoration) => (
                        <PropLightRow
                            key={decoration.id}
                            tankId={tankId}
                            decoration={decoration}
                            lights={decoration.lights as DecorationLights}
                            name={
                                catalogue.find(
                                    (entry) => entry.slug === decoration.type,
                                )?.name ?? decoration.type
                            }
                        />
                    ))}
                </ul>
            )}
        </PanelSection>
    );
}

function PropLightRow({
    tankId,
    decoration,
    lights,
    name,
}: {
    tankId: number;
    decoration: DecorationSnapshot;
    lights: DecorationLights;
    name: string;
}) {
    const [colour, setColour] = useState(lights.colour);

    const update = (settings: {
        lights_on?: boolean;
        light_colour?: string;
        light_mode?: DecorationLightMode;
    }) =>
        router.patch(
            decorationRoutes.lights.url([tankId, decoration.id]),
            settings,
            {
                preserveScroll: true,
                only: ['tank'],
                optimistic: (props) => {
                    const tank = props.tank as TankSnapshot;
                    const next: DecorationLights = {
                        on: settings.lights_on ?? lights.on,
                        colour: settings.light_colour ?? lights.colour,
                        mode: settings.light_mode ?? lights.mode,
                    };

                    return {
                        tank: {
                            ...tank,
                            decorations: tank.decorations.map((candidate) =>
                                candidate.id === decoration.id
                                    ? { ...candidate, lights: next }
                                    : candidate,
                            ),
                        },
                    };
                },
            },
        );

    return (
        <li className="space-y-2 border border-sidebar-border p-2">
            <div className="flex items-center gap-2">
                <span className="truncate text-sm">{name}</span>
                <input
                    type="color"
                    aria-label={`${name} LED colour`}
                    value={colour}
                    onChange={(event) => setColour(event.target.value)}
                    onBlur={() =>
                        colour !== lights.colour &&
                        update({ light_colour: colour })
                    }
                    className="ml-auto h-6 w-8 cursor-pointer border border-sidebar-border bg-transparent"
                />
                <Switch
                    checked={lights.on}
                    aria-label={`${name} LEDs`}
                    onCheckedChange={(checked) =>
                        update({ lights_on: checked })
                    }
                />
            </div>
            {lights.on && (
                <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    className="w-full *:flex-1"
                    value={lights.mode}
                    onValueChange={(value) =>
                        value &&
                        update({ light_mode: value as DecorationLightMode })
                    }
                >
                    <ToggleGroupItem value="timer">
                        Glow after dark
                    </ToggleGroupItem>
                    <ToggleGroupItem value="always">Always on</ToggleGroupItem>
                </ToggleGroup>
            )}
        </li>
    );
}
