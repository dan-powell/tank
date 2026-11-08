import { Brush, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SUBSTRATE_PRESETS } from '@/lib/tank/substrate-sculpt';
import type { SculptBrush, SculptTool } from '@/lib/tank/substrate-sculpt';
import type { TankGrid } from '@/types';
import { PanelSection } from './panel-section';

type Props = {
    grid: TankGrid;
    /** The brush while sculpt mode is on, otherwise null. */
    brush: SculptBrush | null;
    onBrushChange: (brush: SculptBrush | null) => void;
    onApply: (heights: number[]) => void;
    onUndo: () => void;
    canUndo: boolean;
};

const TOOLS: { value: SculptTool; label: string }[] = [
    { value: 'raise', label: 'Raise' },
    { value: 'lower', label: 'Lower' },
    { value: 'smooth', label: 'Smooth' },
    { value: 'flatten', label: 'Flatten' },
];

/** Brush radii in centimetres. */
const SIZES: { value: number; label: string }[] = [
    { value: 2, label: 'S' },
    { value: 4, label: 'M' },
    { value: 8, label: 'L' },
];

const DEFAULT_BRUSH: SculptBrush = { tool: 'raise', radiusCm: 4 };

/**
 * Shape the gravel: start from a ready-made shape, then refine it with a
 * brush dragged across the substrate. Each stroke saves when released.
 */
export function SubstratePanel({
    grid,
    brush,
    onBrushChange,
    onApply,
    onUndo,
    canUndo,
}: Props) {
    return (
        <PanelSection
            id="substrate-heading"
            title="Gravel"
            action={
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    disabled={!canUndo}
                    onClick={onUndo}
                >
                    <Undo2 /> Undo
                </Button>
            }
        >
            <div className="grid grid-cols-2 gap-2">
                {SUBSTRATE_PRESETS.map((preset) => (
                    <Button
                        key={preset.key}
                        size="sm"
                        variant="outline"
                        className="justify-start"
                        title={preset.description}
                        onClick={() => onApply(preset.build(grid))}
                    >
                        {preset.label}
                    </Button>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
                Gravel raised above the water becomes land; lower the water to
                make room for a beach.
            </p>

            {brush === null ? (
                <Button
                    size="sm"
                    className="w-full"
                    onClick={() => onBrushChange(DEFAULT_BRUSH)}
                >
                    <Brush /> Sculpt by hand
                </Button>
            ) : (
                <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3">
                    <p className="text-xs text-muted-foreground">
                        Drag across the gravel to shape it. Right-drag still
                        turns the view.
                    </p>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                            Tool
                        </Label>
                        <ToggleGroup
                            type="single"
                            size="sm"
                            variant="outline"
                            value={brush.tool}
                            onValueChange={(value) =>
                                value &&
                                onBrushChange({
                                    ...brush,
                                    tool: value as SculptTool,
                                })
                            }
                            className="w-full"
                        >
                            {TOOLS.map((tool) => (
                                <ToggleGroupItem
                                    key={tool.value}
                                    value={tool.value}
                                    className="flex-1"
                                >
                                    {tool.label}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                            Brush size
                        </Label>
                        <ToggleGroup
                            type="single"
                            size="sm"
                            variant="outline"
                            value={String(brush.radiusCm)}
                            onValueChange={(value) =>
                                value &&
                                onBrushChange({
                                    ...brush,
                                    radiusCm: Number(value),
                                })
                            }
                            className="w-full"
                        >
                            {SIZES.map((size) => (
                                <ToggleGroupItem
                                    key={size.value}
                                    value={String(size.value)}
                                    aria-label={`${size.value * 2} cm brush`}
                                    className="flex-1"
                                >
                                    {size.label}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => onBrushChange(null)}
                    >
                        Done
                    </Button>
                </div>
            )}
        </PanelSection>
    );
}
