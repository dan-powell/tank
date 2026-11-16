import { router, usePage } from '@inertiajs/react';
import { useEchoNotification } from '@laravel/echo-react';
import { toast } from 'sonner';
import type { TankAlertData } from '@/types';

type BroadcastAlert = TankAlertData & {
    /** Whether the tank's owner asked for browser notifications too. */
    browser: boolean;
};

/**
 * Listen for the signed-in user's notifications as they arrive: toast each
 * one, refresh the unread count, and, when asked for and allowed, show it as
 * a browser notification too. `onReceive` runs after each.
 */
export function useUserNotifications(onReceive?: () => void): void {
    const userId = usePage().props.auth.user.id;

    useEchoNotification<BroadcastAlert>(
        `App.Models.User.${userId}`,
        (notification) => {
            router.reload({ only: ['notifications'] });
            toast.warning(notification.message, {
                description: notification.tank_name,
            });

            if (
                notification.browser &&
                typeof Notification !== 'undefined' &&
                Notification.permission === 'granted'
            ) {
                const shown = new Notification(
                    `${notification.tank_name}: ${notification.title}`,
                    { body: notification.message, tag: notification.id },
                );
                shown.onclick = () => {
                    window.focus();
                    router.visit(notification.url);
                };
            }

            onReceive?.();
        },
        undefined,
        [userId],
    );
}
