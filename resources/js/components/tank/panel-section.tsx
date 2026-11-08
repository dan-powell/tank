import { ArrowLeft, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
    /** Used to label the section for assistive technology. */
    id: string;
    title: ReactNode;
    /** Shown at the end of the heading row, e.g. a small button. */
    action?: ReactNode;
    className?: string;
    children: ReactNode;
};

/**
 * One titled section of the tank side panel. Sections are stacked inside a
 * divided container, so each one reads as a discrete block.
 */
export function PanelSection({
    id,
    title,
    action,
    className,
    children,
}: Props) {
    return (
        <section
            aria-labelledby={id}
            className={cn('space-y-3 py-4 first:pt-0 last:pb-0', className)}
        >
            <div className="flex min-h-7 items-center justify-between gap-2">
                <h2
                    id={id}
                    className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                    {title}
                </h2>
                {action}
            </div>
            {children}
        </section>
    );
}

/** Returns from a sub-panel to the tank overview. */
export function PanelBackButton({ onClick }: { onClick: () => void }) {
    return (
        <Button
            size="sm"
            variant="ghost"
            className="-ml-2 self-start"
            onClick={onClick}
            title="Back to the tank (Esc)"
        >
            <ArrowLeft /> Back to tank
        </Button>
    );
}

/**
 * Disables every control inside while the lid is sealed, with a short note
 * saying why. Display-neutral, so it can wrap whole panel sections.
 */
export function SealedGuard({
    isSealed,
    children,
}: {
    isSealed: boolean;
    children: ReactNode;
}) {
    return (
        <fieldset disabled={isSealed} className="contents">
            {isSealed && (
                <p className="flex items-center gap-1.5 pb-3 text-xs text-muted-foreground">
                    <Lock className="size-3.5" /> The lid is sealed. Lift it in
                    Equipment to make changes.
                </p>
            )}
            {children}
        </fieldset>
    );
}
