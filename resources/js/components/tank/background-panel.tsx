import { router } from '@inertiajs/react';
import { Check, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { backgroundStyle } from '@/lib/tank/background';
import { cn } from '@/lib/utils';
import { background as backgroundRoute } from '@/routes/tanks';
import type { TankBackground } from '@/types';
import { PanelSection } from './panel-section';

type Props = {
    tankId: number;
    background: TankBackground;
    /** Shows a draft behind the tank before it is saved (null = the saved one). */
    onPreview: (background: TankBackground | null) => void;
};

type Style = 'solid' | 'gradient';

const PRESETS: { name: string; background: TankBackground }[] = [
    { name: 'Slate', background: { colour: '#2c3e52', gradient_colour: null } },
    {
        name: 'Ocean',
        background: { colour: '#3a7bb8', gradient_colour: '#0b1a33' },
    },
    {
        name: 'Lagoon',
        background: { colour: '#7fd6d0', gradient_colour: '#1d5d74' },
    },
    {
        name: 'Forest',
        background: { colour: '#5c8a4a', gradient_colour: '#142417' },
    },
    {
        name: 'Sunset',
        background: { colour: '#f2a65a', gradient_colour: '#5a2d5c' },
    },
    { name: 'Black', background: { colour: '#000000', gradient_colour: null } },
    { name: 'White', background: { colour: '#f4f4f2', gradient_colour: null } },
];

/** What a gradient fades to when first switched on: a darker shade of the top. */
const DEFAULT_GRADIENT_END = '#0b1a33';

const sameBackground = (a: TankBackground, b: TankBackground) =>
    a.colour === b.colour && a.gradient_colour === b.gradient_colour;

/**
 * The backdrop behind the glass: a solid colour or a top-to-bottom gradient.
 * Changes show behind the tank straight away and are kept once saved.
 */
export function BackgroundPanel({ tankId, background, onPreview }: Props) {
    const [draft, setDraft] = useState<TankBackground>(background);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const isChanged = !sameBackground(draft, background);
    const style: Style = draft.gradient_colour === null ? 'solid' : 'gradient';

    useEffect(() => {
        onPreview(isChanged ? draft : null);
    }, [draft, isChanged, onPreview]);

    useEffect(() => () => onPreview(null), [onPreview]);

    const changeStyle = (next: Style) =>
        setDraft((current) => ({
            ...current,
            gradient_colour:
                next === 'solid'
                    ? null
                    : (current.gradient_colour ?? DEFAULT_GRADIENT_END),
        }));

    const save = () =>
        router.put(backgroundRoute.url(tankId), draft, {
            preserveScroll: true,
            only: ['tank', 'errors'],
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onError: (errors) =>
                setError(errors.colour ?? errors.gradient_colour),
            onSuccess: () => setError(undefined),
        });

    return (
        <PanelSection
            id="background-heading"
            title="Backdrop"
            action={
                <span
                    aria-hidden
                    className="size-4 rounded-sm border border-sidebar-border"
                    style={backgroundStyle(background)}
                />
            }
        >
            <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => (
                    <button
                        key={preset.name}
                        type="button"
                        title={preset.name}
                        aria-label={preset.name}
                        aria-pressed={sameBackground(draft, preset.background)}
                        onClick={() => setDraft(preset.background)}
                        className={cn(
                            'size-7 rounded-md border border-sidebar-border shadow-xs transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            sameBackground(draft, preset.background) &&
                                'ring-2 ring-primary ring-offset-1 ring-offset-sidebar',
                        )}
                        style={backgroundStyle(preset.background)}
                    />
                ))}
            </div>

            <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={style}
                onValueChange={(value) => value && changeStyle(value as Style)}
            >
                <ToggleGroupItem value="solid" className="px-3">
                    Solid
                </ToggleGroupItem>
                <ToggleGroupItem value="gradient" className="px-3">
                    Gradient
                </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex gap-4">
                <ColourField
                    id="background-colour"
                    label={style === 'gradient' ? 'Top' : 'Colour'}
                    value={draft.colour}
                    onChange={(colour) =>
                        setDraft((current) => ({ ...current, colour }))
                    }
                />
                {draft.gradient_colour !== null && (
                    <ColourField
                        id="background-gradient-colour"
                        label="Bottom"
                        value={draft.gradient_colour}
                        onChange={(gradientColour) =>
                            setDraft((current) => ({
                                ...current,
                                gradient_colour: gradientColour,
                            }))
                        }
                    />
                )}
            </div>
            <InputError message={error} />

            <div className="flex gap-2">
                <Button
                    size="sm"
                    disabled={processing || !isChanged}
                    onClick={save}
                >
                    <Check /> Save backdrop
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={processing || !isChanged}
                    onClick={() => {
                        setDraft(background);
                        setError(undefined);
                    }}
                >
                    <Undo2 /> Revert
                </Button>
            </div>
        </PanelSection>
    );
}

function ColourField({
    id,
    label,
    value,
    onChange,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <input
                id={id}
                type="color"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background p-0.5"
            />
            <Label htmlFor={id} className="font-normal text-muted-foreground">
                {label}
                <span className="ml-1.5 font-mono text-xs uppercase">
                    {value}
                </span>
            </Label>
        </div>
    );
}
