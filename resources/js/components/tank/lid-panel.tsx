import { router } from '@inertiajs/react';
import { Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lid } from '@/routes/tanks';
import { PanelSection } from './panel-section';

type Props = {
    tankId: number;
    isSealed: boolean;
};

/**
 * The lid. Sealed, the tank is cut off from the room and runs as its own
 * ecosystem: no feeding, cleaning, stocking or aquascaping until it is lifted.
 */
export function LidPanel({ tankId, isSealed }: Props) {
    return (
        <PanelSection
            id="lid-heading"
            title="Lid"
            action={
                <span className="text-xs text-muted-foreground">
                    {isSealed ? 'Sealed' : 'Open'}
                </span>
            }
        >
            <p className="text-sm text-muted-foreground">
                {isSealed
                    ? 'The tank is running on its own: plants and animals share the air and nothing comes in from outside. Lift the lid to tend it.'
                    : 'Seal the tank to make it a closed ecosystem. Its plants must make the oxygen its animals breathe, and nothing can be added or fed until you open it again.'}
            </p>
            <Button
                size="sm"
                variant={isSealed ? 'outline' : 'default'}
                onClick={() =>
                    router.post(
                        lid.url(tankId),
                        {},
                        { preserveScroll: true, only: ['tank', 'events'] },
                    )
                }
            >
                {isSealed ? <LockOpen /> : <Lock />}
                {isSealed ? 'Lift the lid' : 'Seal the tank'}
            </Button>
        </PanelSection>
    );
}
