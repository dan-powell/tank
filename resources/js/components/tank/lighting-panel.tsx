import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import {
    combinedLevel,
    formatMinute,
    levelAt,
    useSimSecondsNow,
} from '@/lib/tank/lighting';
import type { SimClock } from '@/lib/tank/lighting';
import { cn } from '@/lib/utils';
import { light } from '@/routes/tanks';
import lightRoutes from '@/routes/tanks/lights';
import type {
    DecorationDefinition,
    DecorationSnapshot,
    LightDefinition,
    LightFixture,
    TankLighting,
    TankSnapshot,
} from '@/types';
import { GantryMap } from './gantry-map';
import { LightFixtureList } from './light-fixture-card';
import { PanelSection } from './panel-section';
import { PropLightsSection } from './prop-lights-section';

type Props = {
    tankId: number;
    lighting: TankLighting;
    lightOn: boolean;
    clock: SimClock;
    catalogue: LightDefinition[];
    decorations: DecorationSnapshot[];
    decorationCatalogue: DecorationDefinition[];
    selectedFixtureId: number | null;
    onSelectFixture: (id: number | null) => void;
};

/** Days longer than this feed algae (matches AlgaeSystem::LONG_DAY_HOURS). */
const LONG_DAY_HOURS = 12;

const visitOptions = { preserveScroll: true, only: ['tank', 'events'] };

/** Changes to a tank's lights, shown straight away and rolled back if refused. */
export type LightActions = {
    install: (
        type: LightDefinition['slug'],
        column: number,
        row: number,
        length: number,
    ) => void;
    update: (fixtureId: number, settings: Partial<LightFixture>) => void;
    remove: (fixtureId: number) => void;
};

function useLightActions(tankId: number): LightActions {
    const showError = (errors: Record<string, string>) =>
        toast.error(
            Object.values(errors)[0] ?? 'The light could not be changed.',
        );

    return {
        install: (type, column, row, length) =>
            router.post(
                lightRoutes.store.url(tankId),
                { type, column, row, length },
                {
                    ...visitOptions,
                    onError: showError,
                },
            ),
        update: (fixtureId, settings) =>
            router.patch(
                lightRoutes.update.url([tankId, fixtureId]),
                settings,
                {
                    preserveScroll: true,
                    only: ['tank'],
                    onError: showError,
                    optimistic: (props) => {
                        const tank = props.tank as TankSnapshot;

                        return {
                            tank: {
                                ...tank,
                                lighting: {
                                    ...tank.lighting,
                                    fixtures: tank.lighting.fixtures.map(
                                        (fixture) =>
                                            fixture.id === fixtureId
                                                ? { ...fixture, ...settings }
                                                : fixture,
                                    ),
                                },
                            },
                        };
                    },
                },
            ),
        remove: (fixtureId) =>
            router.delete(lightRoutes.destroy.url([tankId, fixtureId]), {
                ...visitOptions,
                onError: showError,
            }),
    };
}

/**
 * The Lighting tab: the master switch and today's light, the gantry to hang
 * lights on, each light's settings, and decorations' LEDs.
 */
export function LightingPanel({
    tankId,
    lighting,
    lightOn,
    clock,
    catalogue,
    decorations,
    decorationCatalogue,
    selectedFixtureId,
    onSelectFixture,
}: Props) {
    const now = useSimSecondsNow(clock);
    const actions = useLightActions(tankId);

    // Pick a newly hung light. Listened for globally: the live update that
    // follows an install can be the response that carries the flash.
    useEffect(
        () =>
            router.on('flash', (event) => {
                const id = (
                    event.detail.flash as { installedLightFixtureId?: number }
                ).installedLightFixtureId;

                if (id !== undefined) {
                    onSelectFixture(id);
                }
            }),
        [onSelectFixture],
    );
    const level = lightOn ? combinedLevel(lighting, now) : 0;
    const photoperiod = lightOn ? lighting.photoperiod_hours : 0;

    return (
        <>
            <PanelSection
                id="lighting-heading"
                title="Lighting"
                action={
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        {lightOn ? 'On' : 'All off'}
                        <Switch
                            checked={lightOn}
                            aria-label="Master switch for all the lights"
                            onCheckedChange={() =>
                                router.post(light.url(tankId), {}, visitOptions)
                            }
                        />
                    </label>
                }
            >
                <p className="text-sm">
                    {formatMinute((now / 60) % 1440)} ·{' '}
                    {level >= 0.999
                        ? 'lights on'
                        : level > 0
                          ? `lights fading (${Math.round(level * 100)}% of full)`
                          : 'lights off'}
                </p>
                <DayTimeline
                    lighting={lighting}
                    lightOn={lightOn}
                    minuteNow={(now / 60) % 1440}
                />
                <p
                    className={cn(
                        'text-xs',
                        photoperiod > LONG_DAY_HOURS
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground',
                    )}
                >
                    {photoperiod === 0
                        ? 'No light: plants will slowly starve.'
                        : `${formatHours(photoperiod)} of light a day.`}
                    {photoperiod > LONG_DAY_HOURS &&
                        ' Days this long feed algae; aim for 8–12 hours.'}
                </p>
            </PanelSection>

            <PanelSection
                id="gantry-heading"
                title="Gantry"
                action={
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {lighting.fixtures.length} / {lighting.max_fixtures}{' '}
                        lights
                    </span>
                }
            >
                <GantryMap
                    lighting={lighting}
                    catalogue={catalogue}
                    lightOn={lightOn}
                    simSeconds={now}
                    selectedFixtureId={selectedFixtureId}
                    onSelectFixture={onSelectFixture}
                    actions={actions}
                />
                <LightFixtureList
                    lighting={lighting}
                    catalogue={catalogue}
                    levels={lighting.fixtures.map((fixture) =>
                        lightOn ? levelAt(fixture, now) : 0,
                    )}
                    selectedFixtureId={selectedFixtureId}
                    onSelectFixture={onSelectFixture}
                    actions={actions}
                />
            </PanelSection>

            <PropLightsSection
                tankId={tankId}
                decorations={decorations}
                catalogue={decorationCatalogue}
            />
        </>
    );
}

function formatHours(hours: number): string {
    const whole = Math.floor(hours);
    const minutes = Math.round((hours - whole) * 60);

    return minutes === 0 ? `${whole} h` : `${whole} h ${minutes} min`;
}

/** The day's light as a bar per quarter hour, with a marker at the current time. */
function DayTimeline({
    lighting,
    lightOn,
    minuteNow,
}: {
    lighting: TankLighting;
    lightOn: boolean;
    minuteNow: number;
}) {
    const bars = Array.from({ length: 96 }, (_, index) =>
        lightOn ? combinedLevel(lighting, index * 900 + 450) : 0,
    );

    return (
        <div aria-hidden className="space-y-1">
            <div className="relative flex h-10 items-end gap-px bg-muted/50">
                {bars.map((height, index) => (
                    <div
                        key={index}
                        className="flex-1 bg-amber-300/80 dark:bg-amber-200/70"
                        style={{ height: `${height * 100}%` }}
                    />
                ))}
                <div
                    className="absolute inset-y-0 w-0.5 bg-primary"
                    style={{ left: `${(minuteNow / 1440) * 100}%` }}
                />
            </div>
            <div className="flex justify-between text-[0.65rem] text-muted-foreground tabular-nums">
                {['00:00', '06:00', '12:00', '18:00', '24:00'].map((label) => (
                    <span key={label}>{label}</span>
                ))}
            </div>
        </div>
    );
}
