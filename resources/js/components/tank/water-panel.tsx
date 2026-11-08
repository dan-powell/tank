import { cn } from '@/lib/utils';
import type { TankSnapshot, WaterParameters } from '@/types';
import { PanelSection } from './panel-section';

type Reading = {
    label: string;
    value: string;
    status: 'good' | 'warn' | 'bad';
};

function readings(water: WaterParameters): Reading[] {
    const grade = (
        value: number,
        warn: number,
        bad: number,
    ): Reading['status'] =>
        value >= bad ? 'bad' : value >= warn ? 'warn' : 'good';
    const outside = (
        value: number,
        min: number,
        max: number,
        slack: number,
    ): Reading['status'] =>
        value < min - slack || value > max + slack
            ? 'bad'
            : value < min || value > max
              ? 'warn'
              : 'good';

    return [
        {
            label: 'Temperature',
            value: `${water.temperature.toFixed(1)} °C`,
            status: outside(water.temperature, 22, 28, 2),
        },
        {
            label: 'pH',
            value: water.ph.toFixed(2),
            status: outside(water.ph, 6.8, 7.9, 0.4),
        },
        {
            label: 'Ammonia',
            value: `${water.ammonia.toFixed(2)} ppm`,
            status: grade(water.ammonia, 0.25, 0.5),
        },
        {
            label: 'Nitrite',
            value: `${water.nitrite.toFixed(2)} ppm`,
            status: grade(water.nitrite, 0.25, 0.5),
        },
        {
            label: 'Nitrate',
            value: `${water.nitrate.toFixed(0)} ppm`,
            status: grade(water.nitrate, 25, 40),
        },
        {
            label: 'Oxygen',
            value: `${water.oxygen.toFixed(1)} mg/L`,
            status:
                water.oxygen < 4 ? 'bad' : water.oxygen < 5.5 ? 'warn' : 'good',
        },
        {
            label: 'Algae',
            value: `${water.algae.toFixed(0)}%`,
            status: grade(water.algae, 25, 50),
        },
        {
            label: 'Detritus',
            value: `${water.detritus.toFixed(1)} g`,
            status: grade(water.detritus, 2, 4),
        },
    ];
}

const dot = {
    good: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-red-500',
};

export function WaterPanel({ water }: { water: WaterParameters }) {
    return (
        <PanelSection id="water-heading" title="Water">
            <ReadingList readings={readings(water)} />
        </PanelSection>
    );
}

function airReadings(air: TankSnapshot['air']): Reading[] {
    return [
        {
            label: 'Humidity',
            value: `${air.humidity.toFixed(0)}%`,
            status:
                air.humidity < 40 ? 'bad' : air.humidity < 60 ? 'warn' : 'good',
        },
        {
            label: 'Oxygen',
            value: `${air.oxygen.toFixed(1)}%`,
            status: air.oxygen < 16 ? 'bad' : air.oxygen < 18 ? 'warn' : 'good',
        },
        {
            label: 'CO₂',
            value: `${air.co2.toFixed(0)} ppm`,
            status: air.co2 > 5000 ? 'bad' : air.co2 > 2000 ? 'warn' : 'good',
        },
    ];
}

/** The air above the water, which land life breathes; sealed tanks keep their own. */
export function AirPanel({
    air,
    isSealed,
}: {
    air: TankSnapshot['air'];
    isSealed: boolean;
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
            <ReadingList readings={airReadings(air)} />
        </PanelSection>
    );
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
