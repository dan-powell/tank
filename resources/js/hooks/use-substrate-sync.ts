import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import substrateRoutes from '@/routes/tanks/substrate';

/** How often unsaved gravel changes are sent to the server. */
export const SUBSTRATE_SYNC_INTERVAL_MS = 2_000;

/** Earlier shapes kept for Undo. */
const HISTORY_LIMIT = 20;

type SubstrateSync = {
    /** The gravel to show: unsaved changes if there are any, otherwise the saved shape. */
    substrate: number[];
    /** Reshape the gravel at once; it is saved with the next batch. */
    reshape: (heights: number[]) => void;
    undo: () => void;
    canUndo: boolean;
};

/** The XSRF token Laravel leaves in a cookie, for requests made outside Inertia. */
function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);

    return match === null ? '' : decodeURIComponent(match[1]);
}

/**
 * Keep gravel sculpting local and save it in batches: strokes, presets and
 * Undo reshape the gravel straight away, and the latest shape is sent at most
 * once every {@link SUBSTRATE_SYNC_INTERVAL_MS}, so sculpting stays clear of
 * the tank-actions rate limit. Anything unsaved is sent as the page is left.
 * If the server refuses a batch, the changes made since the last save are
 * dropped along with their Undo steps.
 */
export function useSubstrateSync(
    tankId: number,
    savedSubstrate: number[],
): SubstrateSync {
    const [unsaved, setUnsaved] = useState<number[] | null>(null);
    const [history, setHistory] = useState<number[][]>([]);

    /** The latest unsaved shape, read by the timer and unload handlers. */
    const pending = useRef<number[] | null>(null);
    const historyRef = useRef<number[][]>([]);
    /** The Undo history as of the last save, restored if a batch is refused. */
    const savedHistory = useRef<number[][]>([]);
    const isSending = useRef(false);

    // Another tank starts with nothing unsaved and nothing to undo.
    const [shownTankId, setShownTankId] = useState(tankId);

    if (shownTankId !== tankId) {
        setShownTankId(tankId);
        setUnsaved(null);
        setHistory([]);
    }

    const substrate = unsaved ?? savedSubstrate;

    const show = (heights: number[], nextHistory: number[][]) => {
        pending.current = heights;
        historyRef.current = nextHistory;
        setUnsaved(heights);
        setHistory(nextHistory);
    };

    const reshape = (heights: number[]) => {
        show(heights, [...history.slice(-(HISTORY_LIMIT - 1)), substrate]);
    };

    const undo = () => {
        const previous = history.at(-1);

        if (previous !== undefined) {
            show(previous, history.slice(0, -1));
        }
    };

    const send = useCallback(() => {
        const heights = pending.current;

        if (heights === null || isSending.current) {
            return;
        }

        isSending.current = true;

        router.put(
            substrateRoutes.update.url(tankId),
            { heights },
            {
                async: true,
                preserveScroll: true,
                only: ['tank', 'errors'],
                onSuccess: () => {
                    savedHistory.current = historyRef.current;

                    // Keep showing anything sculpted while this batch was on its way.
                    if (pending.current === heights) {
                        pending.current = null;
                        setUnsaved(null);
                    }
                },
                onError: (errors) => {
                    pending.current = null;
                    historyRef.current = savedHistory.current;
                    setUnsaved(null);
                    setHistory(savedHistory.current);

                    toast.error(
                        errors.heights ?? 'The gravel could not be reshaped.',
                    );
                },
                onFinish: () => {
                    isSending.current = false;
                },
            },
        );
    }, [tankId]);

    useEffect(() => {
        const timer = window.setInterval(send, SUBSTRATE_SYNC_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [send]);

    // Leaving the page (or the tank) sends what is left; `keepalive` lets the
    // request outlive the page.
    useEffect(() => {
        const sendRemaining = () => {
            const heights = pending.current;

            if (heights === null) {
                return;
            }

            pending.current = null;

            void fetch(substrateRoutes.update.url(tankId), {
                method: 'PUT',
                keepalive: true,
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': xsrfToken(),
                },
                body: JSON.stringify({ heights }),
            }).catch(() => {
                // Nothing more can be done once the page has gone.
            });
        };

        historyRef.current = [];
        savedHistory.current = [];
        window.addEventListener('pagehide', sendRemaining);

        return () => {
            window.removeEventListener('pagehide', sendRemaining);
            sendRemaining();
        };
    }, [tankId]);

    return { substrate, reshape, undo, canUndo: history.length > 0 };
}
