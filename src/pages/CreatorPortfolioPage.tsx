import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    Collapse,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Grid,
    IconButton,
    Stack,
    Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { Link } from 'react-router-dom';
import { Layout } from '../ui';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import BlockExplorerNavBar from '../navigation/BlockExplorerNavBar';
import GeneralStats from '../navigation/GeneralStats';
import { useWallet } from '../context/WalletContext';
import PoolActionMenu from '../components/actions/PoolActionMenu';
import CreatePoolModal from '../components/actions/CreatePoolModal';
import TokenPerformanceMetrics from '../components/TokenPerformanceMetrics';
import { StatCard, NotConnectedView } from '../components/universal/PortfolioShared';
import {
    fetchAllPoolSummaries,
    findPoolsByCreator,
    formatMicroAmount,
    PoolSummary,
} from '../utils/contractQueries';
import { factoryAddress } from '../components/universal/IndividualPage.const';

/* ── Comparison value helpers ─────────────────────────────────────── */

/** Extract a numeric value from a pool for a given metric key */
function getPoolMetricValue(pool: PoolSummary, metric: string): number {
    switch (metric) {
        case 'totalLiquidity': return parseInt(pool.totalLiquidity || '0');
        case 'totalFeesCollected': return parseInt(pool.totalFeesCollected0 || '0') + parseInt(pool.totalFeesCollected1 || '0');
        case 'totalCommitters': return pool.totalCommitters;
        case 'totalPositions': return pool.totalPositions;
        case 'raised': return parseInt(pool.raised || '0');
        case 'totalSupply': return parseInt(pool.totalSupply || '0');
        case 'reserve0': return parseInt(pool.reserve0 || '0');
        case 'reserve1': return parseInt(pool.reserve1 || '0');
        case 'tokenPrice': {
            const r0 = parseInt(pool.reserve0);
            const r1 = parseInt(pool.reserve1);
            return (r0 && r1) ? r0 / r1 : 0;
        }
        case 'marketCap': {
            const r0 = parseInt(pool.reserve0);
            const r1 = parseInt(pool.reserve1);
            const price = (r0 && r1) ? r0 / r1 : 0;
            return price * parseInt(pool.totalSupply || '0');
        }
        default: return 0;
    }
}

/** For a list of pools, determine which pool has the highest value for each metric */
function getHighlightMap(pools: PoolSummary[], metrics: string[]): Map<string, Set<string>> {
    // Map<metric, Set<poolAddress>> — pools that have the highest value
    const result = new Map<string, Set<string>>();
    for (const metric of metrics) {
        const values = pools.map((p) => ({ addr: p.poolAddress, val: getPoolMetricValue(p, metric) }));
        const maxVal = Math.max(...values.map((v) => v.val));
        const allEqual = values.every((v) => v.val === maxVal);
        if (allEqual) {
            result.set(metric, new Set()); // all equal → no highlighting
        } else {
            result.set(metric, new Set(values.filter((v) => v.val === maxVal).map((v) => v.addr)));
        }
    }
    return result;
}

const POOL_FOCUS_METRICS = [
    { key: 'totalLiquidity', label: 'Total Liquidity (TVL)' },
    { key: 'totalFeesCollected', label: 'Total Fees Collected' },
    { key: 'totalCommitters', label: 'Total Committers' },
    { key: 'totalPositions', label: 'LP Positions' },
    { key: 'raised', label: 'Amount Raised' },
    { key: 'totalSupply', label: 'Total Supply' },
    { key: 'tokenPrice', label: 'Token Price' },
    { key: 'marketCap', label: 'Market Cap' },
    { key: 'reserve0', label: 'BLUECHIP Reserve' },
    { key: 'reserve1', label: 'Creator Token Reserve' },
];

/* ── Pool Selector Dropdown ────────────────────────────────────────── */

const PoolSelectorDropdown: React.FC<{
    pools: PoolSummary[];
    selectedPool: PoolSummary | null;
    onSelectPool: (pool: PoolSummary) => void;
    comparedPools: Set<string>;
    onToggleCompare: (poolAddress: string) => void;
    onCompare: () => void;
}> = ({ pools, selectedPool, onSelectPool, comparedPools, onToggleCompare, onCompare }) => {
    const [open, setOpen] = useState(false);

    return (
        <Card>
            <CardContent sx={{ pb: '8px !important' }}>
                <Box
                    onClick={() => setOpen(!open)}
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                >
                    <Box>
                        <Typography variant="h6" fontWeight="bold">
                            Your Pools
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {selectedPool
                                ? `Viewing: ${selectedPool.tokenSymbol} — ${selectedPool.tokenName}`
                                : 'Select a pool to view its details'}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {comparedPools.size > 0 && (
                            <Chip
                                label={`${comparedPools.size} selected`}
                                size="small"
                                color="primary"
                                variant="outlined"
                            />
                        )}
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </Box>
                </Box>

                <Collapse in={open}>
                    <Divider sx={{ my: 1 }} />
                    <Stack spacing={0}>
                        {pools.map((pool) => (
                            <Box
                                key={pool.poolAddress}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    py: 0.75,
                                    px: 1,
                                    borderRadius: 1,
                                    bgcolor:
                                        selectedPool?.poolAddress === pool.poolAddress
                                            ? 'action.selected'
                                            : 'transparent',
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                {/* Left: checkbox for compare */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                                    <Checkbox
                                        size="small"
                                        checked={comparedPools.has(pool.poolAddress)}
                                        onChange={() => onToggleCompare(pool.poolAddress)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" fontWeight="bold" noWrap>
                                            {pool.tokenSymbol}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap>
                                            {pool.tokenName}
                                        </Typography>
                                    </Box>
                                    <Chip
                                        label={pool.thresholdReached ? 'Active' : 'Pre-launch'}
                                        color={pool.thresholdReached ? 'success' : 'warning'}
                                        size="small"
                                        variant="outlined"
                                        sx={{ ml: 1 }}
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                        TVL: {formatMicroAmount(pool.totalLiquidity)}
                                    </Typography>
                                </Box>

                                {/* Right: select button + action menu */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                    <Button
                                        size="small"
                                        variant={
                                            selectedPool?.poolAddress === pool.poolAddress
                                                ? 'contained'
                                                : 'outlined'
                                        }
                                        onClick={() => {
                                            onSelectPool(pool);
                                            setOpen(false);
                                        }}
                                    >
                                        {selectedPool?.poolAddress === pool.poolAddress ? 'Viewing' : 'Select'}
                                    </Button>
                                    <PoolActionMenu
                                        poolAddress={pool.poolAddress}
                                        tokenSymbol={pool.tokenSymbol}
                                        creatorTokenAddress={pool.creatorTokenAddress}
                                        thresholdReached={pool.thresholdReached}
                                    />
                                </Box>
                            </Box>
                        ))}
                    </Stack>

                    {/* Compare button */}
                    <Divider sx={{ mt: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                        <Button
                            variant="contained"
                            startIcon={<CompareArrowsIcon />}
                            disabled={comparedPools.size < 2}
                            onClick={() => {
                                onCompare();
                                setOpen(false);
                            }}
                        >
                            Compare {comparedPools.size > 0 ? `(${comparedPools.size})` : ''}
                        </Button>
                    </Box>
                </Collapse>
            </CardContent>
        </Card>
    );
};

/* ── Compare Pools Modal ───────────────────────────────────────────── */

/** Quick metric card for the "Further Focus" deep-compare view */
const FocusMetricCard: React.FC<{
    pool: PoolSummary;
    metricKey: string;
    metricLabel: string;
    isHighest: boolean;
}> = ({ pool, metricKey, metricLabel, isHighest }) => {
    const raw = getPoolMetricValue(pool, metricKey);
    let display: string;
    if (metricKey === 'tokenPrice') {
        display = raw > 0 ? `${raw.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} BLC` : '-';
    } else if (metricKey === 'totalCommitters' || metricKey === 'totalPositions') {
        display = raw.toLocaleString();
    } else {
        display = formatMicroAmount(Math.floor(raw).toString());
    }

    return (
        <Box sx={{ py: 1.5, px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">{metricLabel}</Typography>
            <Typography variant="h6" fontWeight="bold" sx={isHighest ? { color: '#4caf50' } : undefined}>
                {display}
            </Typography>
        </Box>
    );
};

const ComparePoolsModal: React.FC<{
    open: boolean;
    onClose: () => void;
    pools: PoolSummary[];
}> = ({ open, onClose, pools }) => {
    const [focusOpen, setFocusOpen] = useState(false);
    const [focusMetrics, setFocusMetrics] = useState<Set<string>>(new Set());
    const [deepCompare, setDeepCompare] = useState(false);

    const toggleFocusMetric = (key: string) => {
        setFocusMetrics((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Compute highlight map for the summary metrics shown in the main view
    const allMetricKeys = POOL_FOCUS_METRICS.map((m) => m.key);
    const highlightMap = getHighlightMap(pools, allMetricKeys);

    // For deep compare
    const focusHighlightMap = getHighlightMap(pools, Array.from(focusMetrics));

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight="bold">
                    Compare Pools ({pools.length})
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            {/* Further Focus dropdown */}
            <Box sx={{ px: 3, pb: 1 }}>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FilterListIcon />}
                    endIcon={focusOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    onClick={() => setFocusOpen(!focusOpen)}
                >
                    Further Focus{focusMetrics.size > 0 ? ` (${focusMetrics.size})` : ''}
                </Button>
                <Collapse in={focusOpen}>
                    <Box sx={{ mt: 1, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            Select specific metrics to dive deeper into:
                        </Typography>
                        <Grid container spacing={0}>
                            {POOL_FOCUS_METRICS.map((m) => (
                                <Grid item xs={6} sm={4} md={3} key={m.key}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                size="small"
                                                checked={focusMetrics.has(m.key)}
                                                onChange={() => toggleFocusMetric(m.key)}
                                            />
                                        }
                                        label={<Typography variant="body2">{m.label}</Typography>}
                                    />
                                </Grid>
                            ))}
                        </Grid>
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<CompareArrowsIcon />}
                                disabled={focusMetrics.size === 0}
                                onClick={() => { setDeepCompare(true); setFocusOpen(false); }}
                            >
                                Compare Selected Metrics
                            </Button>
                        </Box>
                    </Box>
                </Collapse>
            </Box>

            <DialogContent dividers>
                {deepCompare && focusMetrics.size > 0 ? (
                    /* ── Deep Compare: focused metric cards ── */
                    <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                                Focused Comparison — {focusMetrics.size} metric{focusMetrics.size !== 1 ? 's' : ''}
                            </Typography>
                            <Button size="small" onClick={() => setDeepCompare(false)}>
                                Back to Full Compare
                            </Button>
                        </Box>
                        <Grid container spacing={2}>
                            {pools.map((pool) => (
                                <Grid item xs={12} md={Math.max(4, Math.floor(12 / pools.length))} key={pool.poolAddress}>
                                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 1, pt: 1 }}>
                                            <Typography variant="subtitle1" fontWeight="bold">
                                                {pool.tokenSymbol}
                                            </Typography>
                                            <Chip
                                                label={pool.thresholdReached ? 'Active' : 'Pre-launch'}
                                                color={pool.thresholdReached ? 'success' : 'warning'}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </Box>
                                        {POOL_FOCUS_METRICS.filter((m) => focusMetrics.has(m.key)).map((m) => (
                                            <FocusMetricCard
                                                key={m.key}
                                                pool={pool}
                                                metricKey={m.key}
                                                metricLabel={m.label}
                                                isHighest={focusHighlightMap.get(m.key)?.has(pool.poolAddress) ?? false}
                                            />
                                        ))}
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    </>
                ) : (
                    /* ── Full Compare: existing side-by-side with green highlights ── */
                    <Grid container spacing={2}>
                        {pools.map((pool) => {
                            // Build a set of metrics where this pool is the highest
                            const greenMetrics = new Set<string>();
                            for (const [metric, winners] of highlightMap) {
                                if (winners.has(pool.poolAddress)) greenMetrics.add(metric);
                            }
                            return (
                                <Grid item xs={12} md={Math.max(4, Math.floor(12 / pools.length))} key={pool.poolAddress}>
                                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 1, pt: 1 }}>
                                            <Typography variant="subtitle1" fontWeight="bold">
                                                {pool.tokenSymbol}
                                            </Typography>
                                            <Chip
                                                label={pool.thresholdReached ? 'Active' : 'Pre-launch'}
                                                color={pool.thresholdReached ? 'success' : 'warning'}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </Box>
                                        {/* Quick highlight summary before full metrics */}
                                        <Box sx={{ px: 1, pb: 1 }}>
                                            {[
                                                { key: 'totalLiquidity', label: 'TVL' },
                                                { key: 'totalFeesCollected', label: 'Total Fees' },
                                                { key: 'totalCommitters', label: 'Committers' },
                                                { key: 'tokenPrice', label: 'Price' },
                                                { key: 'marketCap', label: 'Market Cap' },
                                            ].map((m) => {
                                                const raw = getPoolMetricValue(pool, m.key);
                                                let display: string;
                                                if (m.key === 'tokenPrice') {
                                                    display = raw > 0 ? `${raw.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} BLC` : '-';
                                                } else if (m.key === 'totalCommitters') {
                                                    display = raw.toLocaleString();
                                                } else {
                                                    display = formatMicroAmount(Math.floor(raw).toString());
                                                }
                                                const isHighest = highlightMap.get(m.key)?.has(pool.poolAddress) ?? false;
                                                return (
                                                    <Box key={m.key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                        <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                                                        <Typography variant="body2" fontWeight="bold" sx={isHighest ? { color: '#4caf50' } : undefined}>
                                                            {display}
                                                        </Typography>
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                        <Divider sx={{ mb: 1 }} />
                                        <TokenPerformanceMetrics pool={pool} />
                                    </Box>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}
            </DialogContent>
        </Dialog>
    );
};

const NoPoolsView: React.FC<{ onCreatePool: () => void }> = ({ onCreatePool }) => (
    <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <RocketLaunchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                You have not created a pool yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 480, mx: 'auto' }}>
                Launch your own creator token and liquidity pool. Subscribers will commit BLUECHIP
                to fund your pool, and you'll earn fees on every transaction.
            </Typography>
            <Button variant="contained" size="large" onClick={onCreatePool} startIcon={<RocketLaunchIcon />}>
                Create Pool
            </Button>
        </CardContent>
    </Card>
);

const CreatorPortfolioPage: React.FC = () => {
    const { address, balance } = useWallet();
    const [loading, setLoading] = useState(false);
    const [createdPools, setCreatedPools] = useState<PoolSummary[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [loadKey, setLoadKey] = useState(0);
    const [selectedPool, setSelectedPool] = useState<PoolSummary | null>(null);
    const [comparedAddresses, setComparedAddresses] = useState<Set<string>>(new Set());
    const [showCompare, setShowCompare] = useState(false);

    useEffect(() => {
        if (!address || !factoryAddress) return;
        let cancelled = false;

        async function load() {
            setLoading(true);
            try {
                const pools = await fetchAllPoolSummaries(factoryAddress);
                if (cancelled) return;
                const myPools = await findPoolsByCreator(pools, address);
                if (!cancelled) {
                    setCreatedPools(myPools);
                    if (myPools.length > 0 && !selectedPool) setSelectedPool(myPools[0]);
                }
            } catch (err) { console.error('Error loading creator portfolio:', err); }
            finally { if (!cancelled) setLoading(false); }
        }

        load();
        return () => { cancelled = true; };
    }, [address, loadKey]);

    const totalFeesEarned0 = createdPools.reduce((s, p) => s + parseInt(p.totalFeesCollected0 || '0'), 0);
    const totalFeesEarned1 = createdPools.reduce((s, p) => s + parseInt(p.totalFeesCollected1 || '0'), 0);
    const totalPoolLiquidity = createdPools.reduce((s, p) => s + parseInt(p.totalLiquidity || '0'), 0);
    const totalSubscribers = createdPools.reduce((s, p) => s + p.totalCommitters, 0);
    const totalLpPositions = createdPools.reduce((s, p) => s + p.totalPositions, 0);
    const totalTokenSupply = createdPools.reduce((s, p) => s + parseInt(p.totalSupply || '0'), 0);

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent="center" spacing={2}>
                <Grid item xs={12} md={10} sx={{ mt: '10px' }}>
                    <Stack spacing={2}><BlockExplorerNavBar /><GeneralStats /></Stack>
                </Grid>
                <Grid item xs={12} md={10}>
                    {!address ? <NotConnectedView /> : loading ? (
                        <Box sx={{ textAlign: 'center', py: 6 }}>
                            <CircularProgress />
                            <Typography variant="body2" sx={{ mt: 1 }}>Loading your creator pools...</Typography>
                        </Box>
                    ) : createdPools.length === 0 ? (
                        <>
                            <NoPoolsView onCreatePool={() => setShowCreateModal(true)} />
                            <CreatePoolModal
                                open={showCreateModal}
                                onClose={() => setShowCreateModal(false)}
                                onSuccess={() => setLoadKey((k) => k + 1)}
                            />
                        </>
                    ) : (
                        <Stack spacing={2}>
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                        <Box>
                                            <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>Creator Portfolio</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{address}</Typography>
                                        </Box>
                                        <Button variant="outlined" onClick={() => setShowCreateModal(true)} startIcon={<RocketLaunchIcon />}>
                                            Create Another Pool
                                        </Button>
                                    </Box>
                                    {balance && <Typography variant="body2" sx={{ mt: 0.5 }}>Wallet Balance: <strong>{(parseInt(balance.amount) / 1_000_000).toFixed(2)} BLUECHIP</strong></Typography>}
                                </CardContent>
                            </Card>

                            <Grid container spacing={2}>
                                <Grid item xs={6} sm={4}><StatCard label="Pools Created" value={createdPools.length} /></Grid>
                                <Grid item xs={6} sm={4}><StatCard label="Total Subscribers" value={totalSubscribers} /></Grid>
                                <Grid item xs={6} sm={4}><StatCard label="Total LP Positions" value={totalLpPositions} /></Grid>
                                <Grid item xs={6} sm={4}><StatCard label="Total TVL" value={formatMicroAmount(totalPoolLiquidity.toString())} /></Grid>
                                <Grid item xs={6} sm={4}><StatCard label="Fees Earned (BLUECHIP)" value={formatMicroAmount(totalFeesEarned0.toString())} /></Grid>
                                <Grid item xs={6} sm={4}><StatCard label="Fees Earned (Token)" value={formatMicroAmount(totalFeesEarned1.toString())} /></Grid>
                            </Grid>

                            <PoolSelectorDropdown
                                pools={createdPools}
                                selectedPool={selectedPool}
                                onSelectPool={setSelectedPool}
                                comparedPools={comparedAddresses}
                                onToggleCompare={(addr) => {
                                    setComparedAddresses((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(addr)) next.delete(addr);
                                        else next.add(addr);
                                        return next;
                                    });
                                }}
                                onCompare={() => setShowCompare(true)}
                            />

                            {selectedPool && (
                                <Card>
                                    <CardContent sx={{ pb: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="h6" fontWeight="bold">
                                                {selectedPool.tokenSymbol}
                                            </Typography>
                                            <Chip
                                                label={selectedPool.thresholdReached ? 'Active' : 'Pre-launch'}
                                                color={selectedPool.thresholdReached ? 'success' : 'warning'}
                                                size="small"
                                                variant="outlined"
                                            />
                                            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                                                <Link to={`/creatorpool/${selectedPool.poolAddress}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                    View full details →
                                                </Link>
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                    <CardContent sx={{ pt: 0 }}>
                                        <TokenPerformanceMetrics key={selectedPool.poolAddress} pool={selectedPool} />
                                    </CardContent>
                                </Card>
                            )}

                            <ComparePoolsModal
                                open={showCompare}
                                onClose={() => setShowCompare(false)}
                                pools={createdPools.filter((p) => comparedAddresses.has(p.poolAddress))}
                            />

                            <CreatePoolModal
                                open={showCreateModal}
                                onClose={() => setShowCreateModal(false)}
                                onSuccess={() => setLoadKey((k) => k + 1)}
                            />
                        </Stack>
                    )}
                </Grid>
            </Grid>
        </Layout>
    );
};

export default CreatorPortfolioPage;
