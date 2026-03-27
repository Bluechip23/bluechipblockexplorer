import React, { useEffect, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    Stack,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { Link } from 'react-router-dom';
import { Layout } from '../ui';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import BlockExplorerNavBar from '../navigation/BlockExplorerNavBar';
import GeneralStats from '../navigation/GeneralStats';
import { useWallet } from '../context/WalletContext';
import PoolActionMenu from '../components/actions/PoolActionMenu';
import {
    fetchAllPoolSummaries,
    queryPoolCommits,
    queryPositions,
    formatMicroAmount,
    abbreviateAddress,
    PoolSummary,
    CommiterInfo,
    PositionResponse,
} from '../utils/contractQueries';
import { factoryAddress } from '../components/universal/IndividualPage.const';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MyCommitment {
    pool: PoolSummary;
    commit: CommiterInfo;
}

interface MyPosition {
    pool: PoolSummary;
    position: PositionResponse;
}

interface TxRecord {
    pool: PoolSummary;
    type: 'commit' | 'position';
    amount: string;
    timestamp: string;
}

// ─── Tab Panel ──────────────────────────────────────────────────────────────

const TabPanel: React.FC<{ children: React.ReactNode; value: number; index: number }> = ({
    children,
    value,
    index,
}) => (
    <div role="tabpanel" hidden={value !== index}>
        {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
);

// ─── Stat Card ──────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                {label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
        </CardContent>
    </Card>
);

// ─── Not Connected View ─────────────────────────────────────────────────────

const NotConnectedView: React.FC = () => {
    const { connect, connecting } = useWallet();
    return (
        <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <AccountBalanceWalletIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>
                    Connect Your Wallet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Connect your Keplr wallet to view your portfolio, committed pools, positions, and transaction history.
                </Typography>
                <Box
                    component="button"
                    onClick={connect}
                    disabled={connecting}
                    sx={{
                        px: 4,
                        py: 1.5,
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        border: 'none',
                        borderRadius: 2,
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'primary.dark' },
                        '&:disabled': { opacity: 0.6, cursor: 'not-allowed' },
                    }}
                >
                    {connecting ? 'Connecting...' : 'Connect Wallet'}
                </Box>
            </CardContent>
        </Card>
    );
};

// ─── My Pools Tab (pools I committed to) ────────────────────────────────────

const MyPoolsTab: React.FC<{
    commitments: MyCommitment[];
    loading: boolean;
}> = ({ commitments, loading }) => {
    if (loading) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" sx={{ mt: 1 }}>Scanning pools for your commitments...</Typography>
            </Box>
        );
    }

    if (commitments.length === 0) {
        return (
            <Card>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">You haven't committed to any pools yet.</Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Pool</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>My Total (USD)</TableCell>
                            <TableCell>My Total (BLUECHIP)</TableCell>
                            <TableCell>Last Payment</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {commitments.map((c) => (
                            <TableRow key={c.pool.poolAddress} hover>
                                <TableCell>
                                    <Link to={`/creatorpool/${c.pool.poolAddress}`} style={{ textDecoration: 'none' }}>
                                        <Typography fontWeight="bold" variant="body2" color="primary">
                                            {c.pool.tokenSymbol}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {c.pool.tokenName}
                                        </Typography>
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={c.pool.thresholdReached ? 'Active' : 'Pre-launch'}
                                        color={c.pool.thresholdReached ? 'success' : 'warning'}
                                        size="small"
                                        variant="outlined"
                                    />
                                </TableCell>
                                <TableCell>${formatMicroAmount(c.commit.total_paid_usd)}</TableCell>
                                <TableCell>{formatMicroAmount(c.commit.total_paid_bluechip)}</TableCell>
                                <TableCell>${formatMicroAmount(c.commit.last_payment_usd)}</TableCell>
                                <TableCell align="right">
                                    <PoolActionMenu
                                        poolAddress={c.pool.poolAddress}
                                        tokenSymbol={c.pool.tokenSymbol}
                                        creatorTokenAddress={c.pool.creatorTokenAddress}
                                        thresholdReached={c.pool.thresholdReached}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

// ─── My Positions Tab (LP positions) ────────────────────────────────────────

const MyPositionsTab: React.FC<{
    positions: MyPosition[];
    loading: boolean;
}> = ({ positions, loading }) => {
    if (loading) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" sx={{ mt: 1 }}>Scanning pools for your positions...</Typography>
            </Box>
        );
    }

    if (positions.length === 0) {
        return (
            <Card>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">You don't have any LP positions yet.</Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Pool</TableCell>
                            <TableCell>Position ID</TableCell>
                            <TableCell>Liquidity</TableCell>
                            <TableCell>Unclaimed Fees (Asset 0)</TableCell>
                            <TableCell>Unclaimed Fees (Asset 1)</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {positions.map((p) => (
                            <TableRow key={`${p.pool.poolAddress}-${p.position.position_id}`} hover>
                                <TableCell>
                                    <Link to={`/creatorpool/${p.pool.poolAddress}`} style={{ textDecoration: 'none' }}>
                                        <Typography fontWeight="bold" variant="body2" color="primary">
                                            {p.pool.tokenSymbol}
                                        </Typography>
                                    </Link>
                                </TableCell>
                                <TableCell>{p.position.position_id}</TableCell>
                                <TableCell>{formatMicroAmount(p.position.liquidity)}</TableCell>
                                <TableCell>{formatMicroAmount(p.position.unclaimed_fees_0)}</TableCell>
                                <TableCell>{formatMicroAmount(p.position.unclaimed_fees_1)}</TableCell>
                                <TableCell>
                                    {p.position.created_at
                                        ? new Date(p.position.created_at / 1_000_000).toLocaleDateString()
                                        : '-'}
                                </TableCell>
                                <TableCell align="right">
                                    <PoolActionMenu
                                        poolAddress={p.pool.poolAddress}
                                        tokenSymbol={p.pool.tokenSymbol}
                                        creatorTokenAddress={p.pool.creatorTokenAddress}
                                        thresholdReached={p.pool.thresholdReached}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

// ─── My Transactions Tab ────────────────────────────────────────────────────

const MyTransactionsTab: React.FC<{
    commitments: MyCommitment[];
    positions: MyPosition[];
    loading: boolean;
}> = ({ commitments, positions, loading }) => {
    if (loading) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" sx={{ mt: 1 }}>Loading transactions...</Typography>
            </Box>
        );
    }

    // Build a unified transaction list from commits and positions
    const txs: TxRecord[] = [];

    commitments.forEach((c) => {
        txs.push({
            pool: c.pool,
            type: 'commit',
            amount: `$${formatMicroAmount(c.commit.total_paid_usd)}`,
            timestamp: c.commit.last_commited
                ? new Date(parseInt(c.commit.last_commited) / 1_000_000).toLocaleString()
                : '-',
        });
    });

    positions.forEach((p) => {
        txs.push({
            pool: p.pool,
            type: 'position',
            amount: formatMicroAmount(p.position.liquidity),
            timestamp: p.position.created_at
                ? new Date(p.position.created_at / 1_000_000).toLocaleString()
                : '-',
        });
    });

    if (txs.length === 0) {
        return (
            <Card>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">No transaction history found.</Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Pool</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Amount</TableCell>
                            <TableCell>Date</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {txs.map((tx, i) => (
                            <TableRow key={i} hover>
                                <TableCell>
                                    <Link to={`/creatorpool/${tx.pool.poolAddress}`} style={{ textDecoration: 'none' }}>
                                        <Typography variant="body2" color="primary" fontWeight="bold">
                                            {tx.pool.tokenSymbol}
                                        </Typography>
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={tx.type === 'commit' ? 'Commitment' : 'LP Position'}
                                        color={tx.type === 'commit' ? 'info' : 'secondary'}
                                        size="small"
                                        variant="outlined"
                                    />
                                </TableCell>
                                <TableCell>{tx.amount}</TableCell>
                                <TableCell>{tx.timestamp}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

// ─── Main Portfolio Page ────────────────────────────────────────────────────

const PortfolioPage: React.FC = () => {
    const { address, balance } = useWallet();
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [commitments, setCommitments] = useState<MyCommitment[]>([]);
    const [positions, setPositions] = useState<MyPosition[]>([]);
    const [allPools, setAllPools] = useState<PoolSummary[]>([]);

    useEffect(() => {
        if (!address || !factoryAddress) return;

        let cancelled = false;

        async function loadPortfolio() {
            setLoading(true);
            try {
                const pools = await fetchAllPoolSummaries(factoryAddress);
                if (cancelled) return;
                setAllPools(pools);

                const myCommitments: MyCommitment[] = [];
                const myPositions: MyPosition[] = [];

                await Promise.all(
                    pools.map(async (pool) => {
                        // Check commits
                        const commits = await queryPoolCommits(pool.poolAddress);
                        if (commits?.commiters) {
                            const myCommit = commits.commiters.find(
                                (c) => c.wallet === address
                            );
                            if (myCommit) {
                                myCommitments.push({ pool, commit: myCommit });
                            }
                        }

                        // Check positions
                        if (pool.thresholdReached) {
                            const positionsResp = await queryPositions(pool.poolAddress);
                            if (positionsResp?.positions) {
                                positionsResp.positions
                                    .filter((p) => p.owner === address)
                                    .forEach((p) => {
                                        myPositions.push({ pool, position: p });
                                    });
                            }
                        }
                    })
                );

                if (!cancelled) {
                    setCommitments(myCommitments);
                    setPositions(myPositions);
                }
            } catch (err) {
                console.error('Error loading portfolio:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadPortfolio();
        return () => { cancelled = true; };
    }, [address]);

    // Calculate summary stats
    const totalCommittedUsd = commitments.reduce(
        (sum, c) => sum + parseInt(c.commit.total_paid_usd || '0'),
        0
    );
    const totalUnclaimedFees0 = positions.reduce(
        (sum, p) => sum + parseInt(p.position.unclaimed_fees_0 || '0'),
        0
    );
    const totalUnclaimedFees1 = positions.reduce(
        (sum, p) => sum + parseInt(p.position.unclaimed_fees_1 || '0'),
        0
    );
    const totalLiquidity = positions.reduce(
        (sum, p) => sum + parseInt(p.position.liquidity || '0'),
        0
    );

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent="center" spacing={2}>
                <Grid item xs={12} md={10} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>

                <Grid item xs={12} md={10}>
                    {!address ? (
                        <NotConnectedView />
                    ) : (
                        <Stack spacing={2}>
                            {/* Header */}
                            <Card>
                                <CardContent>
                                    <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                                        My Portfolio
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                        {address}
                                    </Typography>
                                    {balance && (
                                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                                            Wallet Balance: <strong>{(parseInt(balance.amount) / 1_000_000).toFixed(2)} BLUECHIP</strong>
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Summary Stats */}
                            <Grid container spacing={2}>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Pools Committed" value={commitments.length} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Total Committed (USD)" value={`$${formatMicroAmount(totalCommittedUsd.toString())}`} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="LP Positions" value={positions.length} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard
                                        label="Unclaimed Fees"
                                        value={`${formatMicroAmount(totalUnclaimedFees0.toString())} / ${formatMicroAmount(totalUnclaimedFees1.toString())}`}
                                    />
                                </Grid>
                            </Grid>

                            {/* Tabs */}
                            <Card>
                                <CardContent sx={{ pb: 0 }}>
                                    <Tabs
                                        value={tab}
                                        onChange={(_, v) => setTab(v)}
                                        variant="scrollable"
                                        scrollButtons="auto"
                                        sx={{ borderBottom: 1, borderColor: 'divider' }}
                                    >
                                        <Tab label={`Pools I Committed To (${commitments.length})`} />
                                        <Tab label={`My LP Positions (${positions.length})`} />
                                        <Tab label="My Transactions" />
                                    </Tabs>
                                </CardContent>
                                <CardContent>
                                    <TabPanel value={tab} index={0}>
                                        <MyPoolsTab commitments={commitments} loading={loading} />
                                    </TabPanel>
                                    <TabPanel value={tab} index={1}>
                                        <MyPositionsTab positions={positions} loading={loading} />
                                    </TabPanel>
                                    <TabPanel value={tab} index={2}>
                                        <MyTransactionsTab
                                            commitments={commitments}
                                            positions={positions}
                                            loading={loading}
                                        />
                                    </TabPanel>
                                </CardContent>
                            </Card>
                        </Stack>
                    )}
                </Grid>
            </Grid>
        </Layout>
    );
};

export default PortfolioPage;
