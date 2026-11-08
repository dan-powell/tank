import { router } from '@inertiajs/react';
import { PackagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import autoFeeder from '@/routes/tanks/auto-feeder';
import type { AutoFeeder } from '@/types';

type Props = {
    tankId: number;
    feeder: AutoFeeder | null;
};

const visitOptions = { preserveScroll: true, only: ['tank', 'events'] };

export function AutoFeederPanel({ tankId, feeder }: Props) {
    const configure = (feedsPerDay: number, unlimited: boolean) =>
        router.put(
            autoFeeder.update.url(tankId),
            { feeds_per_day: feedsPerDay, unlimited },
            visitOptions,
        );

    if (feeder === null) {
        return (
            <section aria-labelledby="feeder-heading" className="space-y-2">
                <h2 id="feeder-heading" className="text-sm font-semibold">
                    Auto-feeder
                </h2>
                <p className="text-xs text-muted-foreground">
                    Feeds your fish on a schedule while you're away.
                </p>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => configure(2, false)}
                >
                    <PackagePlus /> Add auto-feeder
                </Button>
            </section>
        );
    }

    const fill = feeder.portions / feeder.capacity;

    return (
        <section aria-labelledby="feeder-heading" className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 id="feeder-heading" className="text-sm font-semibold">
                    Auto-feeder
                </h2>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-muted-foreground"
                    onClick={() =>
                        router.delete(
                            autoFeeder.destroy.url(tankId),
                            visitOptions,
                        )
                    }
                >
                    <Trash2 /> Remove
                </Button>
            </div>

            <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Feeds per day</p>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={String(feeder.feeds_per_day)}
                    onValueChange={(value) =>
                        value && configure(Number(value), feeder.unlimited)
                    }
                >
                    {['1', '2', '3'].map((option) => (
                        <ToggleGroupItem
                            key={option}
                            value={option}
                            className="w-10"
                        >
                            {option}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
                <p className="text-xs text-muted-foreground">
                    At{' '}
                    {feeder.feed_hours
                        .map((hour) => `${String(hour).padStart(2, '0')}:00`)
                        .join(', ')}
                    .
                </p>
            </div>

            <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Food supply</p>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={feeder.unlimited ? 'unlimited' : 'hopper'}
                    onValueChange={(value) =>
                        value &&
                        configure(feeder.feeds_per_day, value === 'unlimited')
                    }
                >
                    <ToggleGroupItem value="hopper" className="px-3">
                        Hopper
                    </ToggleGroupItem>
                    <ToggleGroupItem value="unlimited" className="px-3">
                        Unlimited
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            {!feeder.unlimited && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Hopper</span>
                        <span
                            className={cn(
                                'tabular-nums',
                                feeder.portions === 0 &&
                                    'font-medium text-red-600 dark:text-red-400',
                            )}
                        >
                            {feeder.portions} / {feeder.capacity} portions
                        </span>
                    </div>
                    <Progress
                        value={fill * 100}
                        aria-label="Hopper level"
                        className="bg-muted"
                        indicatorClassName={
                            fill > 0.25
                                ? 'bg-emerald-500'
                                : fill > 0
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                        }
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={feeder.portions === feeder.capacity}
                        onClick={() =>
                            router.post(
                                autoFeeder.refill.url(tankId),
                                {},
                                visitOptions,
                            )
                        }
                    >
                        <RefreshCw /> Refill
                    </Button>
                </div>
            )}
        </section>
    );
}
