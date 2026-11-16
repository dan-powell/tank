import { router } from '@inertiajs/react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pause } from '@/routes/tanks';
import type { TankSnapshot } from '@/types';
import { PanelSection } from './panel-section';

/** Pause or resume a tank's simulation, shown straight away. */
export function setTankPaused(tankId: number, paused: boolean): void {
    router.put(
        pause.url(tankId),
        { paused },
        {
            preserveScroll: true,
            only: ['tank', 'events'],
            optimistic: (props) => ({
                tank: {
                    ...(props.tank as TankSnapshot),
                    is_paused: paused,
                    pause_reason: paused ? 'manual' : null,
                },
            }),
        },
    );
}

type Props = {
    tankId: number;
    isPaused: boolean;
};

/** Stop the clock to take stock and rebalance the tank, then set it running again. */
export function SimulationPanel({ tankId, isPaused }: Props) {
    return (
        <PanelSection
            id="simulation-heading"
            title="Simulation"
            action={
                <span className="text-xs text-muted-foreground">
                    {isPaused ? 'Paused' : 'Running'}
                </span>
            }
        >
            <p className="text-sm text-muted-foreground">
                {isPaused
                    ? 'Time is standing still. You can still change the water, clean, light and rearrange the tank, but not feed it.'
                    : 'Pause the tank to stop time while you bring it back into balance.'}
            </p>
            <Button
                size="sm"
                variant={isPaused ? 'default' : 'outline'}
                onClick={() => setTankPaused(tankId, !isPaused)}
            >
                {isPaused ? <Play /> : <Pause />}
                {isPaused ? 'Resume' : 'Pause'}
            </Button>
        </PanelSection>
    );
}
