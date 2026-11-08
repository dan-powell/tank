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
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { light, scrub, vacuum, waterChange } from '@/routes/tanks';

import { PanelSection } from './panel-section';

type Props = {
    tankId: number;
    lightOn: boolean;
    onFeedRandomly: () => void;
};

const visitOptions = { preserveScroll: true, only: ['tank', 'events'] };

/** Hands-on care and cleaning for the tank. */
export function ToolsPanel({ tankId, lightOn, onFeedRandomly }: Props) {
    const [percent, setPercent] = useState(25);

    return (
        <>
            <PanelSection id="care-heading" title="Care">
                <div className="grid grid-cols-2 gap-2 *:w-full *:justify-start">
                    <Button size="sm" onClick={onFeedRandomly}>
                        <Fish /> Feed
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            router.post(light.url(tankId), {}, visitOptions)
                        }
                    >
                        {lightOn ? <LightbulbOff /> : <Lightbulb />}
                        {lightOn ? 'Lamp off' : 'Lamp on'}
                    </Button>
                </div>
            </PanelSection>

            <PanelSection id="maintenance-heading" title="Maintenance">
                <div className="grid grid-cols-2 gap-2 *:w-full *:justify-start">
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
                            router.post(vacuum.url(tankId), {}, visitOptions)
                        }
                    >
                        <Waves /> Vacuum gravel
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    <Label
                        htmlFor="water-change"
                        className="font-normal text-muted-foreground"
                    >
                        Water change
                    </Label>
                    <Select
                        value={String(percent)}
                        onValueChange={(value) => setPercent(Number(value))}
                    >
                        <SelectTrigger
                            id="water-change"
                            size="sm"
                            className="w-20 bg-background"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[10, 25, 50, 75].map((option) => (
                                <SelectItem key={option} value={String(option)}>
                                    {option}%
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
            </PanelSection>
        </>
    );
}
