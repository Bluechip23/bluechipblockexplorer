import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Grid,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import PageShell from '../components/universal/PageShell';
import { useWallet } from '../context/WalletContext';
import { sanitizeOnChainString, validateBech32Address } from '../utils/security';
import {
    abbreviateAddress,
    fetchPoolSummary,
    formatMicroAmount,
    microToNumber,
    PoolSummary,
    queryPoolCreator,
} from '../utils/contractQueries';
import {
    CreatorLink,
    describeGate,
    formatTierPrice,
    getProfile,
    isProfilesDemoMode,
    LinkUnlockResult,
    pinnedLinks,
    postLinks,
    ProfileWithLinks,
    Tier,
    tiersForLink,
    unlockLinks,
} from '../utils/profilesApi';
import { SUBSCRIPTION_PERIOD_DAYS } from '../utils/subscriptions';
import CommitDialog from '../components/creator-links/CommitDialog';
import ProvideLiquidityDialog from '../components/creator-links/ProvideLiquidityDialog';
import LinkCard from '../components/creator-links/LinkCard';
import ProfileSearchBox from '../components/creator-links/ProfileSearchBox';

// One compact line of pool context under the creator header: raise progress
// while the pool is funding, price + subscriber count once fully committed.
const PoolStatsRow: React.FC<{ pool: PoolSummary }> = ({ pool }) => {
    if (pool.thresholdReached) {
        const price = parseFloat(pool.currentPrice1to0);
        return (
            <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip size="small" color="success" label="Fully committed" />
                {Number.isFinite(price) && price > 0 && (
                    <Typography variant="body2" color="text.secondary">
                        1 {pool.tokenSymbol} ≈ {price.toFixed(6)} OSMO
                    </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                    {pool.totalCommitters} subscribers
                </Typography>
            </Stack>
        );
    }
    const raisedNum = microToNumber(pool.raised);
    const targetNum = microToNumber(pool.target);
    const pct = targetNum > 0 ? Math.min(100, (raisedNum / targetNum) * 100) : 0;
    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                    Raised {formatMicroAmount(pool.raised)} of {formatMicroAmount(pool.target)} OSMO
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {pool.totalCommitters} subscribers
                </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={pct} sx={{ borderRadius: 1, height: 8 }} />
        </Box>
    );
};

const POSTS_PAGE = 20;

// Explains a partial unlock from the caller's standing on the creator's
// pools: no subscription, expired, or a last commit below some tiers.
function unlockShortfall(
    result: LinkUnlockResult,
    stillLocked: CreatorLink[],
    tiers: Tier[],
    profilePool: string | null,
): string {
    if (stillLocked.length === 0) return '';
    const subs = result.subscriptions;
    const main = subs.find((x) => x.pool_address === profilePool) ?? subs[0];
    if (!main || main.status === 'none') {
        return "No subscription found for your wallet — commit to this creator's pool to unlock.";
    }
    if (main.status === 'expired') {
        const when = main.expires_at ? ` on ${new Date(main.expires_at * 1000).toLocaleDateString()}` : '';
        return `Your subscription expired${when} — a commit unlocks ${SUBSCRIPTION_PERIOD_DAYS} days of access; commit again to renew.`;
    }
    // Active, but the last commit is below the tiers of the remaining links.
    const next = stillLocked
        .map((l) => tiersForLink(l, tiers)[0])
        .filter((t): t is Tier => !!t)
        .sort((a, b) => (BigInt(a.price_native) < BigInt(b.price_native) ? -1 : 1))[0];
    const paid = main.last_payment_native ? formatTierPrice(main.last_payment_native) : 'your last commit';
    const count = `${stillLocked.length} link${stillLocked.length === 1 ? ' needs' : 's need'} a higher tier`;
    return next
        ? `Your last commit (${paid}) doesn't cover everything — ${count}. Commit at least ${formatTierPrice(next.price_native)} for ${next.name}.`
        : `Your last commit (${paid}) doesn't cover everything — ${count}.`;
}

/**
 * Public link-in-bio page for a creator: /creator/:idOrName where the param
 * is a profile name, wallet address, or pool address. Gated links unlock
 * after the profiles service confirms the viewer's on-chain subscription
 * (committing_info on the creator's pool).
 */
const CreatorLinksPage: React.FC = () => {
    const { idOrName } = useParams<{ idOrName: string }>();
    const { address, walletName, connect } = useWallet();

    const [loading, setLoading] = useState(true);
    const [profileData, setProfileData] = useState<ProfileWithLinks | null>(null);
    const [poolAddress, setPoolAddress] = useState<string | null>(null);
    const [poolSummary, setPoolSummary] = useState<PoolSummary | null>(null);
    // Set when the param is a pool address with no profile behind it.
    const [bareCreator, setBareCreator] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [unlockedUrls, setUnlockedUrls] = useState<Record<number, string>>({});
    const [unlockBusy, setUnlockBusy] = useState(false);
    const [unlockError, setUnlockError] = useState('');
    const [commitOpen, setCommitOpen] = useState(false);
    // Which pool / tier the subscribe dialog opens on (tiers may sit on any
    // of the creator's pools, not only the profile pool).
    const [commitPool, setCommitPool] = useState<string | null>(null);
    const [commitTierId, setCommitTierId] = useState<number | null>(null);
    const [tierPoolSummaries, setTierPoolSummaries] = useState<Record<string, PoolSummary>>({});
    const [unlockChecked, setUnlockChecked] = useState(false);
    const [liquidityOpen, setLiquidityOpen] = useState(false);
    // Posts are revealed a page at a time; a prolific creator can have hundreds.
    const [postsShown, setPostsShown] = useState(POSTS_PAGE);

    useEffect(() => {
        if (!idOrName) return;
        let cancelled = false;

        async function load() {
            setLoading(true);
            setProfileData(null);
            setPoolAddress(null);
            setPoolSummary(null);
            setBareCreator(null);
            setNotFound(false);
            setUnlockedUrls({});
            setUnlockError('');
            setUnlockChecked(false);
            setTierPoolSummaries({});
            setPostsShown(POSTS_PAGE);
            try {
                let pool: string | null = null;
                const prof = await getProfile(idOrName!);
                if (cancelled) return;
                if (prof) {
                    setProfileData(prof);
                    pool = prof.profile.pool_address;
                } else if (validateBech32Address(idOrName!).ok) {
                    // No profile — maybe the param is a bare pool address.
                    const creator = await queryPoolCreator(idOrName!);
                    if (cancelled) return;
                    if (creator) {
                        setBareCreator(creator);
                        pool = idOrName!;
                    } else {
                        setNotFound(true);
                    }
                } else {
                    setNotFound(true);
                }
                if (pool) {
                    setPoolAddress(pool);
                    const summary = await fetchPoolSummary(pool);
                    if (!cancelled) setPoolSummary(summary);
                }
                // Tiers on the creator's other pools need those pools'
                // symbol and threshold state for the subscribe dialog.
                const otherPools = [...new Set((prof?.tiers ?? []).map((t) => t.pool_address))]
                    .filter((p) => p !== pool);
                const summaries: Record<string, PoolSummary> = {};
                await Promise.all(otherPools.map(async (p) => {
                    const sum = await fetchPoolSummary(p).catch(() => null);
                    if (sum) summaries[p] = sum;
                }));
                if (!cancelled) setTierPoolSummaries(summaries);
            } catch (err) {
                console.error('Error loading creator links page:', err);
                if (!cancelled) setNotFound(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [idOrName]);

    const links = profileData?.links ?? [];
    const pinned = pinnedLinks(links);
    const posts = postLinks(links);
    const lockedLinks = links.filter((l) => l.gated && !unlockedUrls[l.id]);
    const ownerKey = profileData?.profile.wallet_address ?? idOrName ?? '';
    const tiers = profileData?.tiers ?? [];
    const summaryFor = (pool: string): PoolSummary | null =>
        (pool === poolAddress ? poolSummary : tierPoolSummaries[pool] ?? null);
    const symbolFor = (pool: string): string =>
        sanitizeOnChainString(summaryFor(pool)?.tokenSymbol, 16) || abbreviateAddress(pool);

    const openCommit = useCallback((pool: string | null, tierId: number | null = null) => {
        if (!pool) return;
        if (!address) {
            connect();
            return;
        }
        setCommitPool(pool);
        setCommitTierId(tierId);
        setCommitOpen(true);
    }, [address, connect]);

    const mergeUnlocked = useCallback((revealed: CreatorLink[]) => {
        setUnlockedUrls((prev) => {
            const next = { ...prev };
            for (const l of revealed) {
                if (l.url) next[l.id] = l.url;
            }
            return next;
        });
    }, []);

    // Verify the viewer's subscription and reveal gated URLs. The profiles
    // service performs the real committing_info check; demo mode unlocks
    // immediately (no signature possible without an extension).
    const handleVerifySubscription = useCallback(async () => {
        if (!address) {
            await connect();
            return;
        }
        setUnlockBusy(true);
        setUnlockError('');
        try {
            const res = await unlockLinks(address, walletName, ownerKey);
            if (res.ok && res.value) {
                mergeUnlocked(res.value.links);
                const revealed = new Set(res.value.links.map((l) => l.id));
                const stillLocked = links.filter((l) => l.gated && !revealed.has(l.id) && !unlockedUrls[l.id]);
                setUnlockError(unlockShortfall(res.value, stillLocked, tiers, poolAddress));
                setUnlockChecked(true);
            } else if (!res.ok) {
                setUnlockError(res.error);
            }
        } finally {
            setUnlockBusy(false);
        }
    }, [address, walletName, ownerKey, connect, mergeUnlocked, links, unlockedUrls, tiers, poolAddress]);

    // A locked link first runs the subscription check; once that has run,
    // clicking a still-locked link opens the subscribe dialog on the
    // cheapest tier that would unlock it.
    const handleLockedClick = useCallback((link: CreatorLink) => {
        if (!unlockChecked) {
            handleVerifySubscription();
            return;
        }
        const tier = tiersForLink(link, tiers)[0];
        openCommit(tier ? tier.pool_address : poolAddress, tier?.id ?? null);
    }, [unlockChecked, handleVerifySubscription, tiers, openCommit, poolAddress]);

    // Demo mode: gated links unlock automatically for a connected (demo)
    // wallet so the whole feature is browsable without a real subscription.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!profileData || !address) return;
            if (!profileData.links.some((l) => l.gated)) return;
            if (!(await isProfilesDemoMode())) return;
            const res = await unlockLinks(address, walletName, profileData.profile.wallet_address);
            if (!cancelled && res.ok) mergeUnlocked(res.value?.links ?? []);
        })();
        return () => { cancelled = true; };
    }, [profileData, address, walletName, mergeUnlocked]);

    const actionsRow = poolAddress && (
        <Stack direction="row" spacing={1.5} justifyContent="center">
            <Button
                variant="contained"
                startIcon={<VolunteerActivismIcon />}
                onClick={() => openCommit(poolAddress)}
            >
                Commit / Subscribe
            </Button>
            <Button
                variant="outlined"
                startIcon={<AddCircleIcon />}
                onClick={() => (address ? setLiquidityOpen(true) : connect())}
            >
                Provide Liquidity
            </Button>
        </Stack>
    );

    const commitSummary = commitPool ? summaryFor(commitPool) : null;
    // Rendered even without a profile pool: tiers can sit on any of the
    // creator's pools.
    const dialogs = (
        <>
            {commitPool && (
                <CommitDialog
                    open={commitOpen}
                    onClose={() => setCommitOpen(false)}
                    poolAddress={commitPool}
                    tokenSymbol={commitSummary?.tokenSymbol}
                    thresholdReached={commitSummary?.thresholdReached ?? false}
                    tiers={tiers.filter((t) => t.pool_address === commitPool)}
                    initialTierId={commitTierId}
                />
            )}
            {poolAddress && (
                <ProvideLiquidityDialog
                    open={liquidityOpen}
                    onClose={() => setLiquidityOpen(false)}
                    poolAddress={poolAddress}
                    tokenSymbol={poolSummary?.tokenSymbol}
                    creatorTokenAddress={poolSummary?.creatorTokenAddress ?? undefined}
                />
            )}
        </>
    );

    return (
        <PageShell>
            <Grid item xs={12} md={10}>
                <Box sx={{ maxWidth: 680, mx: 'auto' }}>
                    {loading ? (
                        <Box sx={{ textAlign: 'center', py: 6 }}>
                            <CircularProgress />
                            <Typography variant="body2" sx={{ mt: 1 }}>Loading creator page...</Typography>
                        </Box>
                    ) : notFound ? (
                        <Stack spacing={2}>
                            <Card>
                                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography variant="h6" sx={{ mb: 0.5 }}>Creator not found</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        No profile or pool matches "{sanitizeOnChainString(idOrName, 48)}".
                                    </Typography>
                                </CardContent>
                            </Card>
                            <ProfileSearchBox />
                        </Stack>
                    ) : profileData ? (
                        <Stack spacing={2}>
                            {/* Creator header */}
                            <Card>
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h4" fontWeight="bold">
                                        {sanitizeOnChainString(profileData.profile.name, 32)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                                        {abbreviateAddress(profileData.profile.wallet_address)}
                                    </Typography>
                                    {profileData.profile.bio && (
                                        <Typography variant="body1" sx={{ mt: 1.5 }}>
                                            {sanitizeOnChainString(profileData.profile.bio, 280)}
                                        </Typography>
                                    )}
                                    {poolAddress && poolSummary && (
                                        <Chip
                                            size="small"
                                            label={poolSummary.tokenSymbol}
                                            component={RouterLink}
                                            to={`/creatorpool/${poolAddress}`}
                                            clickable
                                            sx={{ mt: 1.5 }}
                                        />
                                    )}
                                    {poolSummary && (
                                        <Box sx={{ mt: 2 }}>
                                            <PoolStatsRow pool={poolSummary} />
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>

                            {actionsRow}

                            {/* Subscription tiers on offer */}
                            {tiers.length > 0 && (
                                <Card>
                                    <CardContent>
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            Subscription tiers
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                            One commit of at least a tier's price unlocks its links for {SUBSCRIPTION_PERIOD_DAYS} days
                                            and covers every cheaper tier.
                                        </Typography>
                                        <Stack spacing={1}>
                                            {tiers.map((t) => (
                                                <Stack
                                                    key={t.id}
                                                    direction="row"
                                                    spacing={1}
                                                    alignItems="center"
                                                    justifyContent="space-between"
                                                    flexWrap="wrap"
                                                    useFlexGap
                                                >
                                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                                        <Typography variant="body2" fontWeight="bold">
                                                            {sanitizeOnChainString(t.name, 40)}
                                                        </Typography>
                                                        <Chip size="small" variant="outlined" label={symbolFor(t.pool_address)} />
                                                    </Stack>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Typography variant="body2" color="text.secondary">
                                                            {formatTierPrice(t.price_native)} / {SUBSCRIPTION_PERIOD_DAYS} days
                                                        </Typography>
                                                        <Button size="small" variant="outlined" onClick={() => openCommit(t.pool_address, t.id)}>
                                                            Subscribe
                                                        </Button>
                                                    </Stack>
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Gated-links hint + verification */}
                            {lockedLinks.length > 0 && (
                                <Alert
                                    severity="info"
                                    icon={<LockOpenIcon fontSize="small" />}
                                    action={
                                        <Stack direction="row" spacing={1}>
                                            {poolAddress && (
                                                <Button size="small" onClick={() => openCommit(poolAddress)}>
                                                    Subscribe
                                                </Button>
                                            )}
                                            <Button size="small" onClick={handleVerifySubscription} disabled={unlockBusy}>
                                                {unlockBusy ? 'Checking...' : address ? 'Already subscribed?' : 'Connect wallet'}
                                            </Button>
                                        </Stack>
                                    }
                                >
                                    Subscribe to unlock {lockedLinks.length} link{lockedLinks.length === 1 ? '' : 's'} —
                                    a commit gives {SUBSCRIPTION_PERIOD_DAYS} days of access
                                    {tiers.length > 0 ? ' at the tier its size covers.' : '.'}
                                </Alert>
                            )}
                            {unlockError && <Alert severity="warning">{unlockError}</Alert>}

                            {/* Pinned links: the creator's bio set, in their order */}
                            {links.length === 0 ? (
                                <Card>
                                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            This creator hasn't added any links yet.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            ) : (
                                <>
                                    {pinned.length > 0 && (
                                        <Stack spacing={1.5}>
                                            {pinned.map((link) => (
                                                <LinkCard
                                                    key={link.id}
                                                    link={link}
                                                    unlockedUrl={unlockedUrls[link.id]}
                                                    onLockedClick={() => handleLockedClick(link)}
                                                    gateLabel={describeGate(link, tiers)}
                                                />
                                            ))}
                                        </Stack>
                                    )}

                                    {/* Posts: newest first, paged */}
                                    {posts.length > 0 && (
                                        <Stack spacing={1.5}>
                                            {pinned.length > 0 && (
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ pt: 1 }}>
                                                    Latest
                                                </Typography>
                                            )}
                                            {posts.slice(0, postsShown).map((link) => (
                                                <LinkCard
                                                    key={link.id}
                                                    link={link}
                                                    unlockedUrl={unlockedUrls[link.id]}
                                                    onLockedClick={() => handleLockedClick(link)}
                                                    gateLabel={describeGate(link, tiers)}
                                                    postedAt={link.created_at}
                                                />
                                            ))}
                                            {posts.length > postsShown && (
                                                <Button size="small" onClick={() => setPostsShown((n) => n + POSTS_PAGE)}>
                                                    Show {Math.min(POSTS_PAGE, posts.length - postsShown)} more of {posts.length - postsShown}
                                                </Button>
                                            )}
                                        </Stack>
                                    )}
                                </>
                            )}
                        </Stack>
                    ) : (
                        /* Pool address with no profile behind it */
                        <Stack spacing={2}>
                            <Card>
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h5" fontWeight="bold">
                                        {poolSummary ? sanitizeOnChainString(poolSummary.tokenName, 64) : 'Creator Pool'}
                                    </Typography>
                                    {bareCreator && (
                                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                                            Creator: {abbreviateAddress(bareCreator)}
                                        </Typography>
                                    )}
                                    {poolAddress && poolSummary && (
                                        <Chip
                                            size="small"
                                            label={poolSummary.tokenSymbol}
                                            component={RouterLink}
                                            to={`/creatorpool/${poolAddress}`}
                                            clickable
                                            sx={{ mt: 1.5 }}
                                        />
                                    )}
                                    {poolSummary && (
                                        <Box sx={{ mt: 2 }}>
                                            <PoolStatsRow pool={poolSummary} />
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>
                            <Alert severity="info">
                                This creator hasn't set up a links page yet — you can still
                                subscribe or provide liquidity below.
                            </Alert>
                            {actionsRow}
                        </Stack>
                    )}
                    {dialogs}
                </Box>
            </Grid>
        </PageShell>
    );
};

export default CreatorLinksPage;
