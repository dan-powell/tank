import { Link, router, usePage } from '@inertiajs/react';
import { Bell, HeartPulse, TriangleAlert } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { useUserNotifications } from '@/hooks/use-user-notifications';
import { cn } from '@/lib/utils';
import notificationRoutes from '@/routes/notifications';
import type { InboxNotification } from '@/types';

type Inbox = {
    unread: number;
    notifications: InboxNotification[];
};

const visitOptions = { preserveScroll: true, only: ['notifications'] };

/**
 * The signed-in user's notification inbox: a bell with the unread count that
 * opens their recent tank alerts. Also listens for new alerts as they arrive.
 */
export function NotificationBell({ className }: { className?: string }) {
    const unread = usePage().props.notifications?.unread ?? 0;
    const [inbox, setInbox] = useState<Inbox | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const load = useCallback(async () => {
        const response = await fetch(notificationRoutes.index.url(), {
            headers: { Accept: 'application/json' },
        });

        if (response.ok) {
            setInbox((await response.json()) as Inbox);
        }
    }, []);

    useUserNotifications(() => {
        if (isOpen) {
            void load();
        }
    });

    const open = (next: boolean) => {
        setIsOpen(next);

        if (next) {
            void load();
        }
    };

    const markAllRead = () =>
        router.post(
            notificationRoutes.readAll.url(),
            {},
            {
                ...visitOptions,
                onSuccess: () => void load(),
            },
        );

    const markRead = (notification: InboxNotification) => {
        if (notification.read_at === null) {
            router.post(
                notificationRoutes.read.url(notification.id),
                {},
                visitOptions,
            );
        }
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={open}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('relative', className)}
                    aria-label={
                        unread > 0
                            ? `Notifications, ${unread} unread`
                            : 'Notifications'
                    }
                >
                    <Bell />
                    {unread > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white tabular-nums">
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80">
                <div className="flex items-center justify-between gap-2 pr-1">
                    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                    {unread > 0 && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs"
                            onClick={markAllRead}
                        >
                            Mark all read
                        </Button>
                    )}
                </div>
                <DropdownMenuSeparator />
                {inbox === null ? (
                    <div className="flex justify-center py-4">
                        <Spinner />
                    </div>
                ) : inbox.notifications.length === 0 ? (
                    <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                        Nothing yet. Alerts about your tanks will show up here.
                    </p>
                ) : (
                    <div className="max-h-96 overflow-y-auto">
                        {inbox.notifications.map((notification) => (
                            <DropdownMenuItem
                                key={notification.id}
                                asChild
                                className="items-start"
                            >
                                <Link
                                    href={notification.data.url}
                                    onClick={() => markRead(notification)}
                                >
                                    {notification.data.type === 'near_death' ? (
                                        <HeartPulse className="mt-0.5 text-red-500" />
                                    ) : (
                                        <TriangleAlert className="mt-0.5 text-amber-500" />
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span
                                            className={cn(
                                                'block text-xs',
                                                notification.read_at === null
                                                    ? 'font-semibold'
                                                    : 'text-muted-foreground',
                                            )}
                                        >
                                            {notification.data.tank_name}
                                            {notification.created_at && (
                                                <>
                                                    {' · '}
                                                    {timeAgo(
                                                        notification.created_at,
                                                    )}
                                                </>
                                            )}
                                        </span>
                                        <span className="block text-sm whitespace-normal">
                                            {notification.data.message}
                                        </span>
                                    </span>
                                </Link>
                            </DropdownMenuItem>
                        ))}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function timeAgo(iso: string): string {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);

    if (minutes < 1) {
        return 'just now';
    }

    if (minutes < 60) {
        return `${minutes} min ago`;
    }

    const hours = Math.round(minutes / 60);

    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}
