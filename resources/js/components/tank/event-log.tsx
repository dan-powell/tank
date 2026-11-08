import { ChevronRight } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TankEvent } from '@/types';
import { PanelSection } from './panel-section';

const accent: Partial<Record<TankEvent['type'], string>> = {
    birth: 'border-emerald-500',
    death: 'border-red-500',
    plant_died: 'border-red-400',
    warning: 'border-amber-500',
    plant_spread: 'border-lime-500',
};

type Props = {
    events: TankEvent[];
    /**
     * Show only the newest entries that fit in the space the section is
     * given, rather than growing (and making its container scroll). The
     * section must then be laid out with a bounded height.
     */
    fitToSpace?: boolean;
    /** Opens the full activity list; shown as a link in the heading. */
    onViewAll?: () => void;
};

export function EventLog({ events, fitToSpace = false, onViewAll }: Props) {
    const listRef = useRef<HTMLOListElement>(null);
    const visibleCount = useFittingCount(listRef, fitToSpace, events);

    return (
        <PanelSection
            id="events-heading"
            title="Activity"
            className={cn(fitToSpace && 'flex min-h-0 flex-1 flex-col')}
            action={
                onViewAll && (
                    <Button
                        size="xs"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={onViewAll}
                    >
                        View all <ChevronRight data-icon="inline-end" />
                    </Button>
                )
            }
        >
            {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Nothing has happened yet.
                </p>
            ) : (
                <ol
                    ref={listRef}
                    className={cn(
                        'relative space-y-1.5 text-sm',
                        fitToSpace && 'min-h-24 flex-1 overflow-hidden',
                    )}
                >
                    {events.map((event, index) => (
                        <li
                            key={event.id}
                            className={cn(
                                'border-l-2 pl-2',
                                accent[event.type] ?? 'border-border',
                                // Still laid out, so it can be measured.
                                index >= visibleCount && 'invisible',
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
        </PanelSection>
    );
}

/**
 * How many leading entries of the list fit wholly inside it. Overflowing
 * entries are made invisible rather than removed, so they keep their layout
 * and the count can be re-measured whenever the list resizes.
 */
function useFittingCount(
    listRef: RefObject<HTMLOListElement | null>,
    isEnabled: boolean,
    events: TankEvent[],
): number {
    const [count, setCount] = useState(Number.POSITIVE_INFINITY);

    useLayoutEffect(() => {
        const list = listRef.current;

        if (!isEnabled || list === null) {
            setCount(Number.POSITIVE_INFINITY);

            return;
        }

        const measure = () => {
            const items = Array.from(list.children) as HTMLElement[];
            const fitting = items.findIndex(
                (item) =>
                    item.offsetTop + item.offsetHeight > list.clientHeight,
            );

            setCount(fitting === -1 ? items.length : fitting);
        };

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(list);

        return () => observer.disconnect();
    }, [listRef, isEnabled, events]);

    return count;
}
