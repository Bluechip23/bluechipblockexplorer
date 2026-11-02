import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import RefreshIcon from '@mui/icons-material/Refresh';
import PageShell from '../components/universal/PageShell';
import StatCard from '../components/universal/StatCard';
import { NotConnectedView } from '../components/universal/PortfolioShared';
import FeedLinkCard from '../components/creator-links/FeedLinkCard';
import { useWallet } from '../context/WalletContext';
import { MyCommitment } from '../components/portfolio/types';
import { scanSubscriptions } from '../utils/subscriptions';
import { sanitizeOnChainString } from '../utils/security';
import {
    FeedLink,
    getFeed,
    isProfilesDemoMode,
    ProfileSearchResult,
    SubscriberFeed,
    unlockFeed,
} from '../utils/profilesApi';

// Per-wallet "last visit" marker that decides which links count as new.
const LAST_SEEN_KEY = 'bluechip.feed.lastSeen';

function readLastSeen(address: string): number {
    try {
        const raw = window.localStorage.getItem(`${LAST_SEEN_KEY}.${address}`);
        const n = raw ? parseInt(raw, 10) : 0;
        return Number.isFinite(n) ? n : 0;
    } catch {
        return 0;
    }
}

function writeLastSeen(address: string, unixSeconds: number): void {
    try {
        window.localStorage.setItem(`${LAST_SEEN_KEY}.${address}`, String(unixSeconds));
    } catch {
        // Private-mode storage can throw; "new" markers are best-effort.
    }
}

// Link ids are only unique per creator in the demo store, so unlocked URLs
// are keyed by creator + id.
function linkKey(l: FeedLink): string {
    return `${l.creator.wallet_address}:${l.id}`;
}

type View = 'new' | 'all';

/**
 * /feed — everything new from the creators the connected wallet is
 * subscribed to, in one place. BlueChip hosts links only, so this is the
 * consolidation point for subscribers: instead of visiting every creator's
 * page (or site) they see the newest links across all of them, newest
 * first, with subscriber-only links unlocked by a single signature.
 */
const SubscriptionFeedPage: React.FC = () => {
    const { address, walletName, connect } = useWallet();

    const [loading, setLoading] = useState(false);
    const [commitments, setCommitments] = useState<MyCommitment[]>([]);
    const [feed, setFeed] = useState<SubscriberFeed | null>(null);
    const [serviceDown, setServiceDown] = useState(false);
    const [lastSeen, setLastSeen] = useState(0);
    const [reloadTick, setReloadTick] = useState(0);

    const [view, setView] = useState<View>('all');
    const [creatorFilter, setCreatorFilter] = useState<string>('all');

    const [unlockedUrls, setUnlockedUrls] = useState<Record<string, string>>({});
    const [unlockBusy, setUnlockBusy] = useState(false);
    const [unlockError, setUnlockError] = useState('');
    const [unlockNote, setUnlockNote] = useState('');

    // Subscribed pools (on-chain scan) → feed (profiles service).
    useEffect(() => {
        if (!address) return;
        let cancelled = false;
        async function load() {
            setLoading(true);
            setServiceDown(false);
            setUnlockedUrls({});
            setUnlockError('');
            setUnlockNote('');
            try {
                const scan = await scanSubscriptions(address, () => cancelled);
                if (cancelled) return;
                setCommitments(scan.commitments);
                const pools = scan.commitments.map((c) => c.pool.poolAddress);
                const result = await getFeed(pools);
                if (cancelled) return;
                if (!result) {
                    setServiceDown(true);
                    setFeed({ creators: [], links: [] });
                } else {
                    setFeed(result);
                }
                // Everything created after the previous visit is "new"; this
                // visit becomes the marker for the next one.
                const previous = readLastSeen(address);
                setLastSeen(previous);
                writeLastSeen(address, Math.floor(Date.now() / 1000));
                const hasNew = (result?.links ?? []).some((l) => (l.created_at ?? 0) > previous);
                setView(hasNew ? 'new' : 'all');
                setCreatorFilter('all');
            } catch (err) {
                console.error('Error loading subscription feed:', err);
                if (!cancelled) setServiceDown(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [address, reloadTick]);

    const pools = useMemo(() => commitments.map((c) => c.pool.poolAddress), [commitments]);
    const creatorsByPool = useMemo(() => {
        const m = new Map<string, ProfileSearchResult>();
        for (const c of feed?.creators ?? []) if (c.pool_address) m.set(c.pool_address, c);
        return m;
    }, [feed]);

    const mergeUnlocked = useCallback((revealed: FeedLink[]) => {
        setUnlockedUrls((prev) => {
            const next = { ...prev };
            for (const l of revealed) if (l.url) next[linkKey(l)] = l.url;
            return next;
        });
    }, []);

    // One signature verifies every subscription and reveals every gated
    // link the viewer is entitled to. Demo mode unlocks without signing.
    const handleUnlock = useCallback(async () => {
        if (!address) {
            await connect();
            return;
        }
        if (pools.length === 0) return;
        setUnlockBusy(true);
        setUnlockError('');
        setUnlockNote('');
        try {
            const res = await unlockFeed(address, walletName, pools);
            if (!res.ok) {
                setUnlockError(res.error);
                return;
            }
            mergeUnlocked(res.value?.links ?? []);
            const failed = res.value?.failed_pools.length ?? 0;
            if (failed > 0) {
                setUnlockNote(`Could not verify ${failed} subscription${failed === 1 ? '' : 's'} on-chain — try again in a moment.`);
            }
        } finally {
            setUnlockBusy(false);
        }
    }, [address, walletName, pools, connect, mergeUnlocked]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!address || !feed || pools.length === 0) return;
            if (!feed.links.some((l) => l.gated)) return;
            if (!(await isProfilesDemoMode())) return;
            const res = await unlockFeed(address, walletName, pools);
            if (!cancelled && res.ok) mergeUnlocked(res.value?.links ?? []);
        })();
        return () => { cancelled = true; };
    }, [address, walletName, feed, pools, mergeUnlocked]);

    const allLinks = feed?.links ?? [];
    const isNew = (l: FeedLink) => (l.created_at ?? 0) > lastSeen;
    const newCount = allLinks.filter(isNew).length;
    const lockedCount = allLinks.filter((l) => l.gated && !unlockedUrls[linkKey(l)]).length;
    const visibleLinks = allLinks
        .filter((l) => view === 'all' || isNew(l))
        .filter((l) => creatorFilter === 'all' || l.creator.wallet_address === creatorFilter);

    const creators = feed?.creators ?? [];
    const sortedCreators = [...creators].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <PageShell>
            <Grid item xs={12} md={10}>
                {!address ? (
                    <NotConnectedView description="Connect your wallet to see the newest links from every creator you're subscribed to, all in one place." />
                ) : (
                    <Stack spacing={2}>
                        <Card>
                            <CardContent>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                    <Box>
                                        <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>My Feed</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            The newest links from every creator you're subscribed to —
                                            one place instead of a hundred websites.
                                        </Typography>
                                    </Box>
                                    <Tooltip title="Refresh">
                                        <span>
                                            <Button
                                                size="small"
                                                startIcon={<RefreshIcon />}
                                                onClick={() => setReloadTick((t) => t + 1)}
                                                disabled={loading}
                                            >
                                                Refresh
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </CardContent>
                        </Card>

                        {loading ? (
                            <Box sx={{ textAlign: 'center', py: 6 }}>
                                <CircularProgress />
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                    Finding your subscriptions on-chain and collecting their newest links...
                                </Typography>
                            </Box>
                        ) : commitments.length === 0 ? (
                            <Card>
                                <CardContent sx={{ textAlign: 'center', py: 5 }}>
                                    <Typography variant="h6" sx={{ mb: 1 }}>You aren't subscribed to anyone yet</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                        Commit to a creator's pool and their new links will show up here.
                                    </Typography>
                                    <Button variant="contained" startIcon={<PersonSearchIcon />} component={RouterLink} to="/creators">
                                        Find Creators
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <Grid container spacing={2}>
                                    <Grid item xs={6} sm={3}><StatCard label="Subscriptions" value={commitments.length} /></Grid>
                                    <Grid item xs={6} sm={3}><StatCard label="With Link Pages" value={creators.length} /></Grid>
                                    <Grid item xs={6} sm={3}><StatCard label="Links" value={allLinks.length} /></Grid>
                                    <Grid item xs={6} sm={3}><StatCard label="New Since Last Visit" value={newCount} /></Grid>
                                </Grid>

                                {serviceDown && (
                                    <Alert severity="warning">
                                        The creator-links service is unreachable right now, so links can't be loaded.
                                        Your subscriptions are listed below — try refreshing in a moment.
                                    </Alert>
                                )}

                                {/* Who you're subscribed to: profile name when they have a links page, token symbol otherwise. */}
                                <Card>
                                    <CardContent>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                            Subscribed creators
                                        </Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            {commitments.map((c) => {
                                                const creator = creatorsByPool.get(c.pool.poolAddress);
                                                const label = creator
                                                    ? sanitizeOnChainString(creator.name, 32)
                                                    : sanitizeOnChainString(c.pool.tokenSymbol, 16);
                                                return (
                                                    <Tooltip
                                                        key={c.pool.poolAddress}
                                                        title={creator ? 'Open links page' : 'No links page yet — opens the pool'}
                                                    >
                                                        <Chip
                                                            label={label}
                                                            size="small"
                                                            variant={creator ? 'filled' : 'outlined'}
                                                            clickable
                                                            component={RouterLink}
                                                            to={`/creator/${encodeURIComponent(creator ? creator.name : c.pool.poolAddress)}`}
                                                        />
                                                    </Tooltip>
                                                );
                                            })}
                                        </Stack>
                                    </CardContent>
                                </Card>

                                {/* Filters + one-click unlock */}
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={1.5}
                                    alignItems={{ xs: 'stretch', sm: 'center' }}
                                    justifyContent="space-between"
                                >
                                    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                                        <ToggleButtonGroup
                                            size="small"
                                            exclusive
                                            value={view}
                                            onChange={(_, v: View | null) => { if (v) setView(v); }}
                                        >
                                            <ToggleButton value="new">New ({newCount})</ToggleButton>
                                            <ToggleButton value="all">All ({allLinks.length})</ToggleButton>
                                        </ToggleButtonGroup>
                                        {sortedCreators.length > 1 && (
                                            <FormControl size="small" sx={{ minWidth: 180 }}>
                                                <InputLabel id="feed-creator-filter">Creator</InputLabel>
                                                <Select
                                                    labelId="feed-creator-filter"
                                                    label="Creator"
                                                    value={creatorFilter}
                                                    onChange={(e) => setCreatorFilter(String(e.target.value))}
                                                >
                                                    <MenuItem value="all">All creators</MenuItem>
                                                    {sortedCreators.map((c) => (
                                                        <MenuItem key={c.wallet_address} value={c.wallet_address}>
                                                            {sanitizeOnChainString(c.name, 32)}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        )}
                                    </Stack>
                                    {lockedCount > 0 && (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<LockOpenIcon />}
                                            onClick={handleUnlock}
                                            disabled={unlockBusy}
                                        >
                                            {unlockBusy
                                                ? 'Verifying subscriptions...'
                                                : `Unlock ${lockedCount} subscriber link${lockedCount === 1 ? '' : 's'}`}
                                        </Button>
                                    )}
                                </Stack>
                                {unlockError && <Alert severity="warning">{unlockError}</Alert>}
                                {unlockNote && <Alert severity="info">{unlockNote}</Alert>}

                                {/* The feed */}
                                {allLinks.length === 0 ? (
                                    !serviceDown && (
                                        <Card>
                                            <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    {creators.length === 0
                                                        ? "None of the creators you're subscribed to have set up a links page yet."
                                                        : "Your creators haven't posted any links yet."}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    )
                                ) : visibleLinks.length === 0 ? (
                                    <Card>
                                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                {view === 'new' ? 'Nothing new since your last visit.' : 'No links match this filter.'}
                                            </Typography>
                                            {view === 'new' && (
                                                <Button size="small" sx={{ mt: 1 }} onClick={() => setView('all')}>
                                                    Show all links
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Stack spacing={1.5}>
                                        {visibleLinks.map((link) => (
                                            <FeedLinkCard
                                                key={linkKey(link)}
                                                link={link}
                                                unlockedUrl={unlockedUrls[linkKey(link)]}
                                                isNew={isNew(link)}
                                                onLockedClick={handleUnlock}
                                            />
                                        ))}
                                    </Stack>
                                )}
                            </>
                        )}
                    </Stack>
                )}
            </Grid>
        </PageShell>
    );
};

export default SubscriptionFeedPage;
