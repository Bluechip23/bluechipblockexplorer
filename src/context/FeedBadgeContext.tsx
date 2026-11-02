import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useWallet } from './WalletContext';
import { getFeed } from '../utils/profilesApi';
import { isSubscriptionActive, scanSubscriptionsCached } from '../utils/subscriptions';

// Per-wallet "last visit" marker that decides which feed links count as
// new. Owned here so the nav badge and the feed page agree on it.
const LAST_SEEN_KEY = 'bluechip.feed.lastSeen';

export function readFeedLastSeen(address: string): number {
    try {
        const raw = window.localStorage.getItem(`${LAST_SEEN_KEY}.${address}`);
        const n = raw ? parseInt(raw, 10) : 0;
        return Number.isFinite(n) ? n : 0;
    } catch {
        return 0;
    }
}

function writeFeedLastSeen(address: string, unixSeconds: number): void {
    try {
        window.localStorage.setItem(`${LAST_SEEN_KEY}.${address}`, String(unixSeconds));
    } catch {
        // Private-mode storage can throw; "new" markers are best-effort.
    }
}

interface FeedBadgeContextType {
    /** Links posted by active subscriptions since the viewer last opened the feed. */
    newCount: number;
    /** Unix seconds of the connected wallet's previous feed visit (0 = never). Stable callback. */
    readLastSeen: () => number;
    /** Called by the feed page once it has rendered: clears the badge and advances the marker. Stable callback. */
    markSeen: () => void;
    /** Recount against the service (after a forced refresh of the feed). */
    refresh: () => void;
}

const FeedBadgeContext = createContext<FeedBadgeContextType>({
    newCount: 0,
    readLastSeen: () => 0,
    markSeen: () => {},
    refresh: () => {},
});

export const useFeedBadge = () => useContext(FeedBadgeContext);

/**
 * Site-wide "you have new links" signal. On wallet connect (and every few
 * minutes after) it finds the wallet's active subscriptions and counts
 * links created after the last feed visit, so the Feed entries in the
 * sidebar and top bar can show a badge without the viewer opening the
 * page. The subscription scan is the cached one, so this never adds more
 * than one scan per cache window on top of what the feed page does.
 */
export const FeedBadgeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const { address } = useWallet();
    const [newCount, setNewCount] = useState(0);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!address) {
            setNewCount(0);
            return;
        }
        let cancelled = false;
        const seen = readFeedLastSeen(address);
        (async () => {
            try {
                const scan = await scanSubscriptionsCached(address);
                if (cancelled) return;
                const pools = scan.commitments
                    .filter((c) => isSubscriptionActive(c.commit))
                    .map((c) => c.pool.poolAddress);
                const feed = await getFeed(pools);
                if (cancelled || !feed) return;
                setNewCount(feed.links.filter((l) => (l.created_at ?? 0) > seen).length);
            } catch (err) {
                console.error('Error counting new feed links:', err);
            }
        })();
        // Re-check periodically while the tab stays open.
        const timer = window.setInterval(() => setTick((t) => t + 1), 5 * 60 * 1000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [address, tick]);

    const readLastSeen = useCallback(() => (address ? readFeedLastSeen(address) : 0), [address]);

    const markSeen = useCallback(() => {
        if (!address) return;
        writeFeedLastSeen(address, Math.floor(Date.now() / 1000));
        setNewCount(0);
    }, [address]);

    const refresh = useCallback(() => setTick((t) => t + 1), []);

    const value = useMemo(
        () => ({ newCount, readLastSeen, markSeen, refresh }),
        [newCount, readLastSeen, markSeen, refresh],
    );
    return <FeedBadgeContext.Provider value={value}>{children}</FeedBadgeContext.Provider>;
};
