import { Head, Link, usePage } from '@inertiajs/react';
import { Fish } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { NewTankDialog } from '@/components/tank/new-tank-dialog';
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
                            <Link
                                key={tank.id}
                                href={show(tank.id)}
                                className="block"
                            >
                                <Card className="transition-colors hover:bg-accent">
                                    <CardHeader>
                                        <CardTitle>{tank.name}</CardTitle>
                                        <CardDescription>
                                            {tank.dimensions_cm.join(' × ')} cm
                                            · {tank.volume_litres} L ·{' '}
                                            {tank.creatures_count} animals ·{' '}
                                            {tank.plants_count} plants
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm text-muted-foreground">
                                        {tank.temperature} °C · ammonia{' '}
                                        {tank.ammonia} ppm · nitrate{' '}
                                        {tank.nitrate} ppm
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
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
