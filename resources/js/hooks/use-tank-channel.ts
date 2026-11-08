import { router } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import { toast } from 'sonner';
import type { TankEventType, TankUpdatedPayload } from '@/types';

/** Events caused by the viewer themselves; no need to toast them back. */
const OWN_ACTIONS: TankEventType[] = [
    'feeding',
    'auto_feeder_changed',
    'water_change',
    'vacuum',
    'algae_scrub',
    'light_toggled',
    'lid',
    'water_level',
    'livestock_added',
    'aquascaping',
];

/**
 * Listen for server-side updates to a tank. Each update triggers a partial
 * reload of the snapshot, and notable happenings are shown as toasts.
 * `onAutoFeed` runs once for every portion the auto-feeder dropped.
 */
export function useTankChannel(tankId: number, onAutoFeed?: () => void): void {
    useEcho<TankUpdatedPayload>(
        `tank.${tankId}`,
        '.tank.updated',
        (payload) => {
            router.reload({ only: ['tank', 'events'] });

            for (const event of payload.events) {
                if (event.type === 'auto_feeding') {
                    onAutoFeed?.();

                    continue;
                }

                if (OWN_ACTIONS.includes(event.type)) {
                    continue;
                }

                if (event.type === 'warning' || event.type === 'death') {
                    toast.warning(event.message);
                } else {
                    toast(event.message);
                }
            }
        },
        [tankId],
    );
}
