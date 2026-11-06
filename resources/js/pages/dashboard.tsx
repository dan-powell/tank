import { Head, Link, router } from '@inertiajs/react';
import { Fish } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { dashboard } from '@/routes';
import { show, store } from '@/routes/tanks';
import type { DashboardTank } from '@/types';

export default function Dashboard({ tanks }: { tanks: DashboardTank[] }) {
    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                {tanks.length === 0 ? (
                    <Card className="max-w-md">
                        <CardHeader>
                            <CardTitle>No tank yet</CardTitle>
                            <CardDescription>
                                Set up a planted, cycled 60 litre tank with a
                                few fish to get started.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => router.post(store.url())}>
                                <Fish /> Set up my tank
                            </Button>
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
                                            {tank.volume_litres} L ·{' '}
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
