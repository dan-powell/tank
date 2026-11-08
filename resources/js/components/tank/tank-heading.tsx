import { Moon, Sun } from 'lucide-react';
import { formatSimClock } from '@/lib/tank/space';
import type { TankSnapshot } from '@/types';

type Props = {
    tank: Pick<
        TankSnapshot,
        'name' | 'is_lit' | 'sim_seconds' | 'volume_litres'
    >;
};

/** The tank's name, simulated time of day and volume: the top of Summary. */
export function TankHeading({ tank }: Props) {
    return (
        <header className="space-y-1 py-4 first:pt-0 last:pb-0">
            <h1 className="truncate text-base font-semibold">{tank.name}</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {tank.is_lit ? (
                    <Sun aria-label="Lights on" className="size-3.5" />
                ) : (
                    <Moon aria-label="Lights off" className="size-3.5" />
                )}
                {formatSimClock(tank.sim_seconds)} · {tank.volume_litres} L
            </p>
        </header>
    );
}
