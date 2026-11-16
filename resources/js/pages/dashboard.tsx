import { Head, Link, usePage } from '@inertiajs/react';
import { Fish, Pause, TriangleAlert } from 'lucide-react';
import { NewTankDialog } from '@/components/tank/new-tank-dialog';
import { SpeciesIcon } from '@/components/tank/species-icon';
import { TankActionsMenu } from '@/components/tank/tank-actions-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { backgroundStyle } from '@/lib/tank/background';
import { dashboard } from '@/routes';
import { show } from '@/routes/tanks';
import type { DashboardTank, TankSizeLimits } from '@/types';

type Props = {
    tanks: DashboardTank[];
    sizeLimits: TankSizeLimits;
};

export default function Dashboard({ tanks, sizeLimits }: Props) {
    const { auth } = usePage().props;
    const defaultName = `${auth.user.name.split(' ')[0]}'s ${tanks.length === 0 ? 'Tank' : `Tank ${tanks.length + 1}`}`;

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                {tanks.length > 0 && (
                    <div className="flex justify-end">
                        <NewTankDialog
                            limits={sizeLimits}
                            defaultName={defaultName}
                        />
                    </div>
                )}
                {tanks.length === 0 ? (
                    <Card className="max-w-md">
                        <CardHeader>
                            <CardTitle>No tank yet</CardTitle>
                            <CardDescription>
                                Choose a size and set up a planted, cycled tank
                                with a few fish to get started.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <NewTankDialog
                                limits={sizeLimits}
                                defaultName={defaultName}
                                trigger={
                                    <Button>
                                        <Fish /> Set up my tank
                                    </Button>
                                }
                            />
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                        {tanks.map((tank) => (
                            <TankCard key={tank.id} tank={tank} />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

/** How many species icons a card shows before summing up the rest. */
const SPECIES_SHOWN = 6;

/**
 * One tank: its backdrop, status, main species and readings. The whole card
 * opens the tank; the menu renames or deletes it.
 */
function TankCard({ tank }: { tank: DashboardTank }) {
    const shown = tank.species.slice(0, SPECIES_SHOWN);
    const hidden = tank.species.slice(SPECIES_SHOWN);

    return (
        <Card className="relative pt-0 transition-colors hover:bg-accent">
            <div className="relative">
                <TankPreview tank={tank} />
                <div className="absolute inset-x-2 top-2 z-10 flex items-start gap-1.5">
                    <TankStatus tank={tank} />
                    <TankActionsMenu
                        tank={tank}
                        className="ml-auto size-7 bg-background/85 backdrop-blur-sm"
                    />
                </div>
            </div>
            <CardHeader>
                <CardTitle>
                    <Link
                        href={show(tank.id)}
                        className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    >
                        {tank.name}
                    </Link>
                </CardTitle>
                <CardDescription>
                    {tank.dimensions_cm.join(' × ')} cm · {tank.volume_litres} L
                    · {tank.creatures_count} animals · {tank.plants_count}{' '}
                    plants
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
                {shown.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label="Species">
                        {shown.map((species) => (
                            <li key={species.id} className="relative z-10">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span
                                            tabIndex={0}
                                            aria-label={`${species.name} × ${species.count}`}
                                            className="flex size-8 items-center justify-center bg-muted p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <SpeciesIcon species={species} />
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {species.name} × {species.count}
                                    </TooltipContent>
                                </Tooltip>
                            </li>
                        ))}
                        {hidden.length > 0 && (
                            <li className="relative z-10">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span
                                            tabIndex={0}
                                            className="flex h-8 items-center bg-muted px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            +{hidden.length}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="flex-col items-start">
                                        {hidden.map((species) => (
                                            <span key={species.id}>
                                                {species.name} × {species.count}
                                            </span>
                                        ))}
                                    </TooltipContent>
                                </Tooltip>
                            </li>
                        )}
                    </ul>
                )}
                <p>
                    {tank.temperature} °C · ammonia {tank.ammonia} ppm · nitrate{' '}
                    {tank.nitrate} ppm
                </p>
            </CardContent>
        </Card>
    );
}

/** Badges over the banner for a paused tank and any readings out of balance. */
function TankStatus({ tank }: { tank: DashboardTank }) {
    return (
        <>
            {tank.is_paused && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            tabIndex={0}
                            variant="outline"
                            className="h-7 bg-background/85 backdrop-blur-sm"
                        >
                            <Pause /> Paused
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        {tank.pause_reason === 'near_death'
                            ? 'Paused to save an animal close to death.'
                            : 'You paused this tank.'}
                    </TooltipContent>
                </Tooltip>
            )}
            {tank.warnings.length > 0 && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            tabIndex={0}
                            variant="outline"
                            className="h-7 bg-background/85 text-destructive backdrop-blur-sm"
                        >
                            <TriangleAlert />
                            {tank.warnings.length === 1
                                ? '1 alert'
                                : `${tank.warnings.length} alerts`}
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="flex-col items-start">
                        {tank.warnings.map((warning) => (
                            <span key={warning.parameter}>
                                {warning.label} too {warning.side}
                            </span>
                        ))}
                    </TooltipContent>
                </Tooltip>
            )}
        </>
    );
}

/** Room the glass outline may take up in a card's banner, in pixels. */
const PREVIEW_WIDTH = 160;
const PREVIEW_HEIGHT = 80;

/**
 * The tank as seen from the front: its glass drawn to scale against the
 * backdrop chosen for it.
 */
function TankPreview({ tank }: { tank: DashboardTank }) {
    const [width, height] = tank.dimensions_cm;
    const scale = Math.min(PREVIEW_WIDTH / width, PREVIEW_HEIGHT / height);

    return (
        <div
            aria-hidden
            className="flex h-28 items-end justify-center pb-4"
            style={backgroundStyle(tank.background)}
        >
            <div
                className="flex flex-col justify-end border border-white/50 bg-white/10 shadow-sm"
                style={{ width: width * scale, height: height * scale }}
            >
                <div className="h-[12%] bg-amber-200/50" />
            </div>
        </div>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
