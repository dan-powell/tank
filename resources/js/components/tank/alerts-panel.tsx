import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { alerts as alertsRoute } from '@/routes/tanks';
import type { AlertSettings, TankSnapshot } from '@/types';
import { PanelSection } from './panel-section';

const NEAR_DEATH_CHOICES = [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5];

type Props = {
    tankId: number;
    alerts: AlertSettings;
};

/** Save the alert settings, shown straight away. */
function saveAlerts(tankId: number, alerts: AlertSettings): void {
    const { near_death_health, disabled_parameters, mail, browser } = alerts;

    router.put(
        alertsRoute.url(tankId),
        { near_death_health, disabled_parameters, mail, browser },
        {
            preserveScroll: true,
            only: ['tank'],
            optimistic: (props) => ({
                tank: { ...(props.tank as TankSnapshot), alerts },
            }),
            onError: (errors) =>
                toast.error(
                    Object.values(errors)[0] ??
                        'The alerts could not be saved.',
                ),
        },
    );
}

/** Whether the browser can show notifications, asking for permission if need be. */
async function allowBrowserNotifications(): Promise<boolean> {
    if (typeof Notification === 'undefined') {
        toast.error('This browser cannot show notifications.');

        return false;
    }

    const permission =
        Notification.permission === 'default'
            ? await Notification.requestPermission()
            : Notification.permission;

    if (permission !== 'granted') {
        toast.error(
            'Notifications are blocked for this site. Allow them in your browser settings to turn this on.',
        );

        return false;
    }

    return true;
}

/**
 * Which warnings the owner hears about and how, and how close to death an
 * animal gets before the tank pauses to save it.
 */
export function AlertsPanel({ tankId, alerts }: Props) {
    const update = (changes: Partial<AlertSettings>) =>
        saveAlerts(tankId, { ...alerts, ...changes });

    const toggleParameter = (parameter: string, enabled: boolean) =>
        update({
            disabled_parameters: enabled
                ? alerts.disabled_parameters.filter((p) => p !== parameter)
                : [...alerts.disabled_parameters, parameter],
        });

    const toggleBrowser = async (enabled: boolean) => {
        if (enabled && !(await allowBrowserNotifications())) {
            return;
        }

        update({ browser: enabled });
    };

    return (
        <>
            <PanelSection id="near-death-heading" title="Dying animals">
                <p className="text-sm text-muted-foreground">
                    Choose which animals pause the tank from the Inhabitants
                    tab. The tank pauses when one drops below:
                </p>
                <Select
                    value={String(alerts.near_death_health)}
                    onValueChange={(value) =>
                        update({ near_death_health: Number(value) })
                    }
                >
                    <SelectTrigger
                        size="sm"
                        className="w-full"
                        aria-label="Health that pauses the tank"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {NEAR_DEATH_CHOICES.map((health) => (
                            <SelectItem key={health} value={String(health)}>
                                {Math.round(health * 100)}% health
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </PanelSection>

            <PanelSection id="warnings-heading" title="Warnings">
                <p className="text-sm text-muted-foreground">
                    Tell me when these turn harmfully high or low.
                </p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {Object.entries(alerts.parameters).map(
                        ([parameter, label]) => {
                            const id = `alert-${parameter}`;

                            return (
                                <li
                                    key={parameter}
                                    className="flex items-center justify-between gap-2"
                                >
                                    <Label htmlFor={id} className="font-normal">
                                        {label}
                                    </Label>
                                    <Switch
                                        id={id}
                                        checked={
                                            !alerts.disabled_parameters.includes(
                                                parameter,
                                            )
                                        }
                                        onCheckedChange={(checked) =>
                                            toggleParameter(parameter, checked)
                                        }
                                    />
                                </li>
                            );
                        },
                    )}
                </ul>
            </PanelSection>

            <PanelSection id="delivery-heading" title="Notify me">
                <ul className="space-y-2">
                    <li className="flex items-center justify-between gap-2">
                        <Label htmlFor="alert-in-app" className="font-normal">
                            In the app
                        </Label>
                        <Switch id="alert-in-app" checked disabled />
                    </li>
                    <li className="flex items-center justify-between gap-2">
                        <Label htmlFor="alert-browser" className="font-normal">
                            Browser notifications
                        </Label>
                        <Switch
                            id="alert-browser"
                            checked={alerts.browser}
                            onCheckedChange={toggleBrowser}
                        />
                    </li>
                    <li className="flex items-center justify-between gap-2">
                        <Label htmlFor="alert-mail" className="font-normal">
                            Email
                        </Label>
                        <Switch
                            id="alert-mail"
                            checked={alerts.mail}
                            onCheckedChange={(checked) =>
                                update({ mail: checked })
                            }
                        />
                    </li>
                </ul>
            </PanelSection>
        </>
    );
}
