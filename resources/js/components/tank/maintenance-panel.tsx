import { router } from '@inertiajs/react';
import {
    Droplets,
    Fish,
    Lightbulb,
    LightbulbOff,
    Sparkles,
    Waves,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { light, scrub, vacuum, waterChange } from '@/routes/tanks';
import type { Species } from '@/types';
import { StockDialog } from './stock-dialog';

type Props = {
    tankId: number;
    lightOn: boolean;
    species: Species[];
    onFeedRandomly: () => void;
};

const visitOptions = { preserveScroll: true, only: ['tank', 'events'] };

export function MaintenancePanel({
    tankId,
    lightOn,
    species,
    onFeedRandomly,
}: Props) {
    const [percent, setPercent] = useState(25);

    return (
        <section aria-labelledby="care-heading" className="space-y-2">
            <h2 id="care-heading" className="text-sm font-semibold">
                Care
            </h2>
            <p className="text-xs text-muted-foreground">
                Tip: click the water surface to drop food where you like.
            </p>
            <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={onFeedRandomly}>
                    <Fish /> Feed
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        router.post(vacuum.url(tankId), {}, visitOptions)
                    }
                >
                    <Waves /> Vacuum gravel
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        router.post(scrub.url(tankId), {}, visitOptions)
                    }
                >
                    <Sparkles /> Scrub glass
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        router.post(light.url(tankId), {}, visitOptions)
                    }
                >
                    {lightOn ? <LightbulbOff /> : <Lightbulb />}{' '}
                    {lightOn ? 'Lamp off' : 'Lamp on'}
                </Button>
                <StockDialog tankId={tankId} species={species} />
            </div>
            <div className="flex items-center gap-2">
                <label
                    htmlFor="water-change"
                    className="text-sm text-muted-foreground"
                >
                    Water change
                </label>
                <select
                    id="water-change"
                    value={percent}
                    onChange={(event) => setPercent(Number(event.target.value))}
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                >
                    {[10, 25, 50, 75].map((option) => (
                        <option key={option} value={option}>
                            {option}%
                        </option>
                    ))}
                </select>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        router.post(
                            waterChange.url(tankId),
                            { percent },
                            visitOptions,
                        )
                    }
                >
                    <Droplets /> Change
                </Button>
            </div>
        </section>
    );
}
