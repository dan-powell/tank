import { CircleHelp } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type {
    BalanceLimit,
    BalanceParameter,
    BalanceRange,
    TankSnapshot,
} from '@/types';
import { PanelSection } from './panel-section';

type Status = 'good' | 'warn' | 'bad';

type Reading = {
    label: string;
    value: string;
    unit: string;
    status: Status;
    /** Which way it is out of balance, if it is. */
    side: 'low' | 'high' | null;
    limit: BalanceLimit;
};

type Limits = TankSnapshot['limits'];

/** Which side of a range a value falls on, or null when inside it. */
function sideOf(range: BalanceRange, value: number): 'low' | 'high' | null {
    const [min, max] = range;

    if (min !== null && value < min) {
        return 'low';
    }

    if (max !== null && value > max) {
        return 'high';
    }

    return null;
}

function reading(
    limits: Limits,
    parameter: BalanceParameter,
    value: number,
    shown: string,
    unit: string,
    label?: string,
): Reading {
    const limit = limits[parameter];
    const side = sideOf(limit.ideal, value);
    const status: Status =
        side === null
            ? 'good'
            : sideOf(limit.safe, value) === null
              ? 'warn'
              : 'bad';

    return {
        label: label ?? limit.label,
        value: unit === '' ? shown : `${shown} ${unit}`.replace(' %', '%'),
        unit,
        status,
        side,
        limit,
    };
}

function readings(water: TankSnapshot['water'], limits: Limits): Reading[] {
    return [
        reading(
            limits,
            'temperature',
            water.temperature,
            water.temperature.toFixed(1),
            '°C',
        ),
        reading(limits, 'ph', water.ph, water.ph.toFixed(2), ''),
        reading(
            limits,
            'ammonia',
            water.ammonia,
            water.ammonia.toFixed(2),
            'ppm',
        ),
        reading(
            limits,
            'nitrite',
            water.nitrite,
            water.nitrite.toFixed(2),
            'ppm',
        ),
        reading(
            limits,
            'nitrate',
            water.nitrate,
            water.nitrate.toFixed(0),
            'ppm',
        ),
        reading(
            limits,
            'oxygen',
            water.oxygen,
            water.oxygen.toFixed(1),
            'mg/L',
        ),
        reading(limits, 'algae', water.algae, water.algae.toFixed(0), '%'),
        reading(
            limits,
            'detritus',
            water.detritus,
            water.detritus.toFixed(1),
            'g',
        ),
    ];
}

const dot = {
    good: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-red-500',
};

export function WaterPanel({
    water,
    limits,
}: {
    water: TankSnapshot['water'];
    limits: Limits;
}) {
    return (
        <PanelSection id="water-heading" title="Water">
            <ReadingList readings={readings(water, limits)} />
        </PanelSection>
    );
}

function airReadings(air: TankSnapshot['air'], limits: Limits): Reading[] {
    return [
        reading(limits, 'humidity', air.humidity, air.humidity.toFixed(0), '%'),
        reading(
            limits,
            'air_oxygen',
            air.oxygen,
            air.oxygen.toFixed(1),
            '%',
            'Oxygen',
        ),
        reading(limits, 'air_co2', air.co2, air.co2.toFixed(0), 'ppm', 'CO₂'),
    ];
}

/** The air above the water, which land life breathes; sealed tanks keep their own. */
export function AirPanel({
    air,
    isSealed,
    limits,
}: {
    air: TankSnapshot['air'];
    isSealed: boolean;
    limits: Limits;
}) {
    return (
        <PanelSection
            id="air-heading"
            title="Air"
            action={
                <span className="text-xs text-muted-foreground">
                    {isSealed ? 'Sealed' : 'Open to the room'}
                </span>
            }
        >
            <ReadingList readings={airReadings(air, limits)} />
        </PanelSection>
    );
}

/** The ideal range in words, e.g. "22–28 °C" or "below 25 ppm". */
function describeRange([min, max]: BalanceRange, unit: string): string {
    const withUnit = (value: number) =>
        unit === '' ? `${value}` : `${value}${unit === '%' ? '' : ' '}${unit}`;

    if (min !== null && max !== null) {
        return `${min}–${withUnit(max)}`;
    }

    if (min !== null) {
        return `above ${withUnit(min)}`;
    }

    return max === null ? 'any' : `below ${withUnit(max)}`;
}

function ReadingList({ readings }: { readings: Reading[] }) {
    return (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {readings.map((reading) => (
                <div
                    key={reading.label}
                    className="flex items-center justify-between gap-2"
                >
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <span
                            aria-hidden
                            className={cn(
                                'size-2 rounded-full',
                                dot[reading.status],
                            )}
                        />
                        {reading.label}
                        {reading.side !== null && (
                            <BalanceHint reading={reading} />
                        )}
                    </dt>
                    <dd className="font-medium tabular-nums">
                        {reading.value}
                        <span className="sr-only"> ({reading.status})</span>
                    </dd>
                </div>
            ))}
        </dl>
    );
}

/** A help icon explaining how to bring an out-of-balance reading back. */
function BalanceHint({ reading }: { reading: Reading }) {
    const side = reading.side ?? 'high';
    const hint = reading.limit.hints[side];

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground focus-visible:text-foreground"
                    aria-label={`How to fix ${reading.label.toLowerCase()}`}
                >
                    <CircleHelp className="size-3.5" />
                </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="flex-col items-start">
                <p className="font-medium">
                    {reading.label} is {side === 'low' ? 'low' : 'high'}. Ideal:{' '}
                    {describeRange(reading.limit.ideal, reading.unit)}.
                </p>
                {hint && <p>{hint}</p>}
            </TooltipContent>
        </Tooltip>
    );
}
