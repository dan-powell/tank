import { cn } from '@/lib/utils';
import type { TankEvent } from '@/types';

const accent: Partial<Record<TankEvent['type'], string>> = {
    birth: 'border-emerald-500',
    death: 'border-red-500',
    plant_died: 'border-red-400',
    warning: 'border-amber-500',
    plant_spread: 'border-lime-500',
};

export function EventLog({ events }: { events: TankEvent[] }) {
    return (
        <section
            aria-labelledby="events-heading"
            className="flex min-h-0 flex-col gap-2"
        >
            <h2 id="events-heading" className="text-sm font-semibold">
                Activity
            </h2>
            {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Nothing has happened yet.
                </p>
            ) : (
                <ol className="min-h-0 space-y-1.5 overflow-y-auto pr-1 text-sm">
                    {events.map((event) => (
                        <li
                            key={event.id}
                            className={cn(
                                'border-l-2 pl-2',
                                accent[event.type] ?? 'border-border',
                            )}
                        >
                            <p>{event.message}</p>
                            {event.created_at && (
                                <time
                                    dateTime={event.created_at}
                                    className="text-xs text-muted-foreground"
                                >
                                    {new Date(
                                        event.created_at,
                                    ).toLocaleString()}
                                </time>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
