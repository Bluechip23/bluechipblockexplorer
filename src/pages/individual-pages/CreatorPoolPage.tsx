import React, { useEffect, useState } from 'react';
import { Layout } from '../../ui';
import {
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import { Link, useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import {
    fetchPoolSummary,
    queryPoolCommits,
    queryPoolCreator,
    queryPoolPair,
    formatMicroAmount,
    abbreviateAddress,
    PoolSummary,
    CommiterInfo,
} from '../../utils/contractQueries';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import LockIcon from '@mui/icons-material/Lock';
import PoolActionMenu from '../../components/actions/PoolActionMenu';
import { useWallet } from '../../context/WalletContext';

// ─── Stat Card ──────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string | number; highlight?: boolean }> = ({ label, value, highlight }) => (
    <Card variant="outlined" sx={{ height: '100%', ...(highlight ? { borderColor: 'primary.main', borderWidth: 2 } : {}) }}>
        <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                {label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: highlight ? 'primary.main' : 'text.primary' }}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
        </CardContent>
    </Card>
);

// ─── Computed metrics helpers ───────────────────────────────────────────────

function computeTokenPrice(reserve0: string, reserve1: string): string {
    const r0 = parseInt(reserve0);
    const r1 = parseInt(reserve1);
    if (!r0 || !r1) return '-';
    const price = r0 / r1;
    return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function computeReserveRatio(reserve0: string, reserve1: string): string {
    const r0 = parseInt(reserve0);
    const r1 = parseInt(reserve1);
    if (!r0 || !r1) return '-';
    const total = r0 + r1;
    const pct0 = ((r0 / total) * 100).toFixed(1);
    const pct1 = ((r1 / total) * 100).toFixed(1);
    return `${pct0}% / ${pct1}%`;
}

function computeAvgCommit(committers: CommiterInfo[]): string {
    if (committers.length === 0) return '$0';
    const total = committers.reduce((sum, c) => sum + parseInt(c.total_paid_usd || '0'), 0);
    return '$' + formatMicroAmount((total / committers.length).toFixed(0));
}

function computeLargestCommit(committers: CommiterInfo[]): string {
    if (committers.length === 0) return '$0';
    const max = Math.max(...committers.map((c) => parseInt(c.total_paid_usd || '0')));
    return '$' + formatMicroAmount(max.toString());
}

function computeCreatorFeeRevenue(committers: CommiterInfo[], feeRate: number): string {
    const totalUsd = committers.reduce((sum, c) => sum + parseInt(c.total_paid_usd || '0'), 0);
    return '$' + formatMicroAmount(Math.floor(totalUsd * feeRate).toString());
}

function computeCommitVelocity(committers: CommiterInfo[]): string {
    if (committers.length < 2) return '-';
    const sorted = [...committers].sort(
        (a, b) => parseInt(a.last_commited) - parseInt(b.last_commited)
    );
    const first = parseInt(sorted[0].last_commited) / 1_000_000;
    const last = parseInt(sorted[sorted.length - 1].last_commited) / 1_000_000;
    const days = (last - first) / (1000 * 60 * 60 * 24);
    if (days <= 0) return '-';
    const totalUsd = committers.reduce((sum, c) => sum + parseInt(c.total_paid_usd || '0'), 0);
    const perDay = totalUsd / days;
    return '$' + formatMicroAmount(Math.floor(perDay).toString()) + '/day';
}

function computeEstimatedTimeToThreshold(
    raised: string,
    target: string,
    committers: CommiterInfo[]
): string {
    if (committers.length < 2) return '-';
    const sorted = [...committers].sort(
        (a, b) => parseInt(a.last_commited) - parseInt(b.last_commited)
    );
    const first = parseInt(sorted[0].last_commited) / 1_000_000;
    const last = parseInt(sorted[sorted.length - 1].last_commited) / 1_000_000;
    const days = (last - first) / (1000 * 60 * 60 * 24);
    if (days <= 0) return '-';
    const totalUsd = committers.reduce((sum, c) => sum + parseInt(c.total_paid_usd || '0'), 0);
    const perDay = totalUsd / days;
    if (perDay <= 0) return '-';
    const remaining = parseInt(target) - parseInt(raised);
    if (remaining <= 0) return 'Reached';
    const daysLeft = remaining / perDay;
    if (daysLeft < 1) return '< 1 day';
    if (daysLeft < 30) return `~${Math.ceil(daysLeft)} days`;
    return `~${Math.ceil(daysLeft / 30)} months`;
}

function getPoolTypeLabel(pair: { pool_type: { xyk?: Record<string, never>; stable?: Record<string, never> } } | null): string {
    if (!pair) return '-';
    if ('xyk' in pair.pool_type) return 'XYK (Constant Product)';
    if ('stable' in pair.pool_type) return 'Stable';
    return 'Unknown';
}

// ─── Main Page ──────────────────────────────────────────────────────────────

const CreatorPoolPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { address } = useWallet();
    const [pool, setPool] = useState<PoolSummary | null>(null);
    const [committers, setCommitters] = useState<CommiterInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreator, setIsCreator] = useState(false);
    const [poolTypeLabel, setPoolTypeLabel] = useState('-');

    useEffect(() => {
        async function loadPool() {
            if (!id) return;
            setLoading(true);
            try {
                const [summary, commits, pair] = await Promise.all([
                    fetchPoolSummary(id),
                    queryPoolCommits(id),
                    queryPoolPair(id),
                ]);
                setPool(summary);
                setCommitters(commits?.commiters || []);
                setPoolTypeLabel(getPoolTypeLabel(pair));

                // Check if connected wallet is the creator
                if (address) {
                    const creator = await queryPoolCreator(id);
                    setIsCreator(creator === address);
                }
            } catch (error) {
                console.error('Error loading pool:', error);
            } finally {
                setLoading(false);
            }
        }
        loadPool();
    }, [id, address]);

    if (!id) {
        return (
            <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
                <Typography>Creator Pool Not Found</Typography>
            </Layout>
        );
    }

    // Derived values
    const tokenPrice = pool ? computeTokenPrice(pool.reserve0, pool.reserve1) : '-';
    const reserveRatio = pool ? computeReserveRatio(pool.reserve0, pool.reserve1) : '-';
    const avgCommit = computeAvgCommit(committers);
    const largestCommit = computeLargestCommit(committers);

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent='center' alignItems='center' spacing={4}>
                <Grid item xs={12} md={8} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>

                {loading ? (
                    <Grid item xs={12} md={8} sx={{ textAlign: 'center', py: 4 }}>
                        <CircularProgress />
                        <Typography variant="body2" sx={{ mt: 1 }}>Loading pool data from chain...</Typography>
                    </Grid>
                ) : !pool ? (
                    <Grid item xs={12} md={8}>
                        <Typography color="error">Could not load pool data for this address.</Typography>
                    </Grid>
                ) : (
                    <>
                        {/* Pool Header */}
                        <Grid item xs={12} md={8}>
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                        <Typography variant='h5' sx={{ fontWeight: 'bold' }}>
                                            {pool.tokenName} ({pool.tokenSymbol})
                                        </Typography>
                                        <Chip
                                            label={pool.thresholdReached ? 'Active' : 'Pre-launch'}
                                            color={pool.thresholdReached ? 'success' : 'warning'}
                                            size="small"
                                        />
                                        <Chip label={poolTypeLabel} size="small" variant="outlined" />
                                        {isCreator && (
                                            <Chip label="You are the Creator" color="primary" size="small" />
                                        )}
                                        <Box sx={{ ml: 'auto' }}>
                                            <PoolActionMenu
                                                poolAddress={pool.poolAddress}
                                                tokenSymbol={pool.tokenSymbol}
                                                creatorTokenAddress={pool.creatorTokenAddress}
                                                thresholdReached={pool.thresholdReached}
                                            />
                                        </Box>
                                    </Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Typography variant="body2" color="text.secondary">
                                        Pool Address: <Link to={`/wallet/${id}`} style={{ color: '#1976d2' }}>{id}</Link>
                                    </Typography>
                                    {pool.creatorTokenAddress && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Token Contract: <Link to={`/creatorcontract/${pool.creatorTokenAddress}`} style={{ color: '#1976d2' }}>{abbreviateAddress(pool.creatorTokenAddress)}</Link>
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Token Price (shown for active pools) */}
                        {pool.thresholdReached && (
                            <Grid item xs={12} md={8}>
                                <Card>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">Token Price</Typography>
                                                <Typography variant="h4" fontWeight="bold">
                                                    {tokenPrice} BLUECHIP
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    per 1 {pool.tokenSymbol}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ textAlign: 'right' }}>
                                                <Typography variant="body2" color="text.secondary">Reserve Ratio</Typography>
                                                <Typography variant="body1" fontWeight="bold">
                                                    {reserveRatio}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    BLUECHIP / {pool.tokenSymbol}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )}

                        {/* Threshold Progress */}
                        {!pool.thresholdReached && (
                            <Grid item xs={12} md={8}>
                                <Card>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Typography variant='h6'>Commit Progress</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {committers.length > 1
                                                    ? `Est. ${computeEstimatedTimeToThreshold(pool.raised, pool.target, committers)} remaining`
                                                    : ''}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Box sx={{ flexGrow: 1 }}>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={Math.min((parseInt(pool.raised) / parseInt(pool.target)) * 100, 100)}
                                                    sx={{
                                                        height: 24,
                                                        borderRadius: 12,
                                                        backgroundColor: '#e0e0e0',
                                                        '& .MuiLinearProgress-bar': {
                                                            borderRadius: 12,
                                                            backgroundColor: '#1976d2',
                                                        },
                                                    }}
                                                />
                                            </Box>
                                            <Typography variant='body2' sx={{ minWidth: 160, textAlign: 'right' }}>
                                                ${formatMicroAmount(pool.raised)} / ${formatMicroAmount(pool.target)}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                            {((parseInt(pool.raised) / parseInt(pool.target)) * 100).toFixed(1)}% funded
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )}

                        {/* Stats Grid */}
                        <Grid item xs={12} md={8}>
                            <Grid container spacing={2}>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Total Liquidity" value={formatMicroAmount(pool.totalLiquidity)} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Reserve (BLUECHIP)" value={formatMicroAmount(pool.reserve0)} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label={`Reserve (${pool.tokenSymbol})`} value={formatMicroAmount(pool.reserve1)} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="LP Positions" value={pool.totalPositions} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Fees Collected (BLUECHIP)" value={formatMicroAmount(pool.totalFeesCollected0)} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label={`Fees Collected (${pool.tokenSymbol})`} value={formatMicroAmount(pool.totalFeesCollected1)} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Total Committers" value={pool.totalCommitters} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Token Supply" value={formatMicroAmount(pool.totalSupply, pool.tokenDecimals)} />
                                </Grid>
                                {/* Commit analytics */}
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Avg Commit Size" value={avgCommit} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Largest Commit" value={largestCommit} />
                                </Grid>
                                {committers.length >= 2 && (
                                    <Grid item xs={6} sm={3}>
                                        <StatCard label="Commit Velocity" value={computeCommitVelocity(committers)} />
                                    </Grid>
                                )}
                                {pool.thresholdReached && tokenPrice !== '-' && (
                                    <Grid item xs={6} sm={3}>
                                        <StatCard label="Token Price" value={`${tokenPrice} BLC`} />
                                    </Grid>
                                )}
                            </Grid>
                        </Grid>

                        {/* Creator-Only Insights Panel */}
                        {isCreator && (
                            <Grid item xs={12} md={8}>
                                <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                            <LockIcon color="primary" fontSize="small" />
                                            <Typography variant="h6" color="primary.main">
                                                Creator Insights
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            Only visible to you as the pool creator.
                                        </Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={6} sm={4}>
                                                <StatCard
                                                    label="Your Fee Revenue (5%)"
                                                    value={computeCreatorFeeRevenue(committers, 0.05)}
                                                    highlight
                                                />
                                            </Grid>
                                            <Grid item xs={6} sm={4}>
                                                <StatCard
                                                    label="Platform Fee (1%)"
                                                    value={computeCreatorFeeRevenue(committers, 0.01)}
                                                />
                                            </Grid>
                                            <Grid item xs={6} sm={4}>
                                                <StatCard
                                                    label="Net to Pool"
                                                    value={computeCreatorFeeRevenue(committers, 0.94)}
                                                />
                                            </Grid>
                                            {!pool.thresholdReached && (
                                                <>
                                                    <Grid item xs={6} sm={4}>
                                                        <StatCard label="Commit Velocity" value={computeCommitVelocity(committers)} highlight />
                                                    </Grid>
                                                    <Grid item xs={6} sm={4}>
                                                        <StatCard
                                                            label="Est. Time to Threshold"
                                                            value={computeEstimatedTimeToThreshold(pool.raised, pool.target, committers)}
                                                            highlight
                                                        />
                                                    </Grid>
                                                    <Grid item xs={6} sm={4}>
                                                        <StatCard label="Unique Committers" value={committers.length} />
                                                    </Grid>
                                                </>
                                            )}
                                            {pool.thresholdReached && (
                                                <>
                                                    <Grid item xs={6} sm={4}>
                                                        <StatCard label="Trading Fees (BLUECHIP)" value={formatMicroAmount(pool.totalFeesCollected0)} highlight />
                                                    </Grid>
                                                    <Grid item xs={6} sm={4}>
                                                        <StatCard label={`Trading Fees (${pool.tokenSymbol})`} value={formatMicroAmount(pool.totalFeesCollected1)} highlight />
                                                    </Grid>
                                                    <Grid item xs={6} sm={4}>
                                                        <StatCard label="Active LP Positions" value={pool.totalPositions} />
                                                    </Grid>
                                                </>
                                            )}
                                        </Grid>

                                        {/* Threshold payout breakdown for pre-launch */}
                                        {!pool.thresholdReached && (
                                            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                                                    When Threshold is Reached
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                    {[
                                                        { label: 'Creator Reward', value: '$325,000' },
                                                        { label: 'Pool Seed Liquidity', value: '$350,000' },
                                                        { label: 'Returned to Committers', value: '$500,000' },
                                                        { label: 'Platform Fee', value: '$25,000' },
                                                    ].map((item) => (
                                                        <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                                                            <Typography variant="body2" fontWeight="bold">{item.value}</Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>
                        )}

                        {/* Committer Leaderboard */}
                        {committers.length > 0 && (
                            <Grid item xs={12} md={8}>
                                <Typography variant="h6" sx={{ mb: 1 }}>Committer Leaderboard</Typography>
                                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                                    <TableContainer sx={{ maxHeight: 440 }}>
                                        <Table stickyHeader size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ width: 50 }}>Rank</TableCell>
                                                    <TableCell>Wallet</TableCell>
                                                    <TableCell>Total Paid (USD)</TableCell>
                                                    <TableCell>Total Paid (Bluechip)</TableCell>
                                                    <TableCell>Last Payment (USD)</TableCell>
                                                    <TableCell>% of Total</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {(() => {
                                                    const sorted = [...committers].sort(
                                                        (a, b) => parseInt(b.total_paid_usd) - parseInt(a.total_paid_usd)
                                                    );
                                                    const grandTotal = sorted.reduce(
                                                        (sum, c) => sum + parseInt(c.total_paid_usd || '0'), 0
                                                    );
                                                    return sorted.map((c, idx) => {
                                                        const pct = grandTotal > 0
                                                            ? ((parseInt(c.total_paid_usd || '0') / grandTotal) * 100).toFixed(1)
                                                            : '0';
                                                        return (
                                                            <TableRow key={c.wallet} hover>
                                                                <TableCell>
                                                                    <Typography
                                                                        variant="body2"
                                                                        fontWeight="bold"
                                                                        color={
                                                                            idx === 0 ? 'warning.main'
                                                                            : idx === 1 ? 'text.secondary'
                                                                            : idx === 2 ? '#cd7f32'
                                                                            : 'text.primary'
                                                                        }
                                                                    >
                                                                        #{idx + 1}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Link to={`/wallet/${c.wallet}`}>{abbreviateAddress(c.wallet)}</Link>
                                                                </TableCell>
                                                                <TableCell>${formatMicroAmount(c.total_paid_usd)}</TableCell>
                                                                <TableCell>{formatMicroAmount(c.total_paid_bluechip)}</TableCell>
                                                                <TableCell>${formatMicroAmount(c.last_payment_usd)}</TableCell>
                                                                <TableCell>{pct}%</TableCell>
                                                            </TableRow>
                                                        );
                                                    });
                                                })()}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Paper>
                            </Grid>
                        )}
                    </>
                )}
            </Grid>
        </Layout>
    );
};

export default CreatorPoolPage;
