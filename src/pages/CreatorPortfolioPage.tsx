import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Grid,
    Stack,
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
import {
    fetchAllPoolSummaries,
    findPoolsByCreator,
    formatMicroAmount,
    PoolSummary,
} from '../utils/contractQueries';
import { factoryAddress } from '../components/universal/IndividualPage.const';

// ─── Stat Card ──────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{label}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
        </CardContent>
    </Card>
);

// ─── Not Connected ──────────────────────────────────────────────────────────

const NotConnectedView: React.FC = () => {
    const { connect, connecting } = useWallet();
    return (
        <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <AccountBalanceWalletIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>Connect Your Wallet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Connect your Keplr wallet to view your creator pools, token metrics, and fee revenue.
                </Typography>
                <Box
                    component="button"
                    onClick={connect}
                    disabled={connecting}
                    sx={{
                        px: 4, py: 1.5, fontSize: '1rem', fontWeight: 'bold', border: 'none',
                        borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText',
                        cursor: 'pointer', '&:hover': { bgcolor: 'primary.dark' },
                        '&:disabled': { opacity: 0.6, cursor: 'not-allowed' },
                    }}
                >
                    {connecting ? 'Connecting...' : 'Connect Wallet'}
                </Box>
            </CardContent>
        </Card>
    );
};

// ─── No Pools CTA ───────────────────────────────────────────────────────────

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

// ─── Main Creator Portfolio Page ────────────────────────────────────────────

const CreatorPortfolioPage: React.FC = () => {
    const { address, balance } = useWallet();
    const [loading, setLoading] = useState(false);
    const [createdPools, setCreatedPools] = useState<PoolSummary[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [loadKey, setLoadKey] = useState(0);

    useEffect(() => {
        if (!address || !factoryAddress) return;
        let cancelled = false;

        async function load() {
            setLoading(true);
            try {
                const pools = await fetchAllPoolSummaries(factoryAddress);
                if (cancelled) return;
                const myPools = await findPoolsByCreator(pools, address);
                if (!cancelled) setCreatedPools(myPools);
            } catch (err) { console.error('Error loading creator portfolio:', err); }
            finally { if (!cancelled) setLoading(false); }
        }

        load();
        return () => { cancelled = true; };
    }, [address, loadKey]);

    // Aggregate stats
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
                            {/* Header */}
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

                            {/* Creator summary stats */}
                            <Grid container spacing={2}>
                                <Grid item xs={6} sm={4}><StatCard label="Pools Created" value={createdPools.length} /></Grid>
                                <Grid item xs={6} sm={4}><StatCard label="Total Subscribers" value={totalSubscribers} /></Grid>
                                <Grid item xs={6} sm={4}><StatCard label="Total LP Positions" value={totalLpPositions} /></Grid>
                                <Grid item xs={6} sm={4}><StatCard label="Total TVL" value={formatMicroAmount(totalPoolLiquidity.toString())} /></Grid>
                                <Grid item xs={6} sm={4}><StatCard label="Fees Earned (BLUECHIP)" value={formatMicroAmount(totalFeesEarned0.toString())} /></Grid>
                                <Grid item xs={6} sm={4}><StatCard label="Fees Earned (Token)" value={formatMicroAmount(totalFeesEarned1.toString())} /></Grid>
                            </Grid>

                            {/* Created pools table */}
                            <Card>
                                <CardContent sx={{ pb: 1 }}>
                                    <Typography variant="h6" fontWeight="bold">Your Pools</Typography>
                                </CardContent>
                                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                                    <TableContainer>
                                        <Table stickyHeader size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Pool</TableCell>
                                                    <TableCell>Status</TableCell>
                                                    <TableCell>TVL</TableCell>
                                                    <TableCell>Fees (BLUECHIP)</TableCell>
                                                    <TableCell>Fees (Token)</TableCell>
                                                    <TableCell>Subscribers</TableCell>
                                                    <TableCell>LP Positions</TableCell>
                                                    <TableCell>Token Supply</TableCell>
                                                    <TableCell align="right">Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {createdPools.map((pool) => (
                                                    <TableRow key={pool.poolAddress} hover>
                                                        <TableCell>
                                                            <Link to={`/creatorpool/${pool.poolAddress}`} style={{ textDecoration: 'none' }}>
                                                                <Typography fontWeight="bold" variant="body2" color="primary">{pool.tokenSymbol}</Typography>
                                                                <Typography variant="caption" color="text.secondary">{pool.tokenName}</Typography>
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell><Chip label={pool.thresholdReached ? 'Active' : 'Pre-launch'} color={pool.thresholdReached ? 'success' : 'warning'} size="small" variant="outlined" /></TableCell>
                                                        <TableCell>{formatMicroAmount(pool.totalLiquidity)}</TableCell>
                                                        <TableCell>{formatMicroAmount(pool.totalFeesCollected0)}</TableCell>
                                                        <TableCell>{formatMicroAmount(pool.totalFeesCollected1)}</TableCell>
                                                        <TableCell>{pool.totalCommitters}</TableCell>
                                                        <TableCell>{pool.totalPositions}</TableCell>
                                                        <TableCell>{formatMicroAmount(pool.totalSupply, pool.tokenDecimals)}</TableCell>
                                                        <TableCell align="right"><PoolActionMenu poolAddress={pool.poolAddress} tokenSymbol={pool.tokenSymbol} creatorTokenAddress={pool.creatorTokenAddress} thresholdReached={pool.thresholdReached} /></TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Paper>
                            </Card>

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
