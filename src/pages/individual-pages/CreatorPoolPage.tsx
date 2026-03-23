import React, { useEffect, useState } from 'react';
import { Layout } from '../../ui';
import { Box, Card, CardContent, Chip, CircularProgress, Divider, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import { Link, useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import {
    fetchPoolSummary,
    queryPoolCommits,
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

const CreatorPoolPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [pool, setPool] = useState<PoolSummary | null>(null);
    const [committers, setCommitters] = useState<CommiterInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadPool() {
            if (!id) return;
            setLoading(true);
            try {
                const [summary, commits] = await Promise.all([
                    fetchPoolSummary(id),
                    queryPoolCommits(id),
                ]);
                setPool(summary);
                setCommitters(commits?.commiters || []);
            } catch (error) {
                console.error('Error loading pool:', error);
            } finally {
                setLoading(false);
            }
        }
        loadPool();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}><Typography>Creator Pool Not Found</Typography></Layout>;
    }

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
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Typography variant='h5' sx={{ fontWeight: 'bold' }}>
                                            {pool.tokenName} ({pool.tokenSymbol})
                                        </Typography>
                                        <Chip
                                            label={pool.thresholdReached ? 'Active' : 'Pre-launch'}
                                            color={pool.thresholdReached ? 'success' : 'warning'}
                                            size="small"
                                        />
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

                        {/* Threshold Progress */}
                        {!pool.thresholdReached && (
                            <Grid item xs={12} md={8}>
                                <Card>
                                    <CardContent>
                                        <Typography variant='h6' sx={{ mb: 1 }}>Commit Progress</Typography>
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
                                    <StatCard label="Reserve (Asset 0)" value={formatMicroAmount(pool.reserve0)} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Reserve (Asset 1)" value={formatMicroAmount(pool.reserve1)} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="LP Positions" value={pool.totalPositions} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Fees Collected (0)" value={formatMicroAmount(pool.totalFeesCollected0)} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Fees Collected (1)" value={formatMicroAmount(pool.totalFeesCollected1)} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Total Committers" value={pool.totalCommitters} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Token Supply" value={formatMicroAmount(pool.totalSupply, pool.tokenDecimals)} />
                                </Grid>
                            </Grid>
                        </Grid>

                        {/* Committers Table */}
                        {committers.length > 0 && (
                            <Grid item xs={12} md={8}>
                                <Typography variant="h6" sx={{ mb: 1 }}>Recent Committers</Typography>
                                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                                    <TableContainer sx={{ maxHeight: 440 }}>
                                        <Table stickyHeader size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Wallet</TableCell>
                                                    <TableCell>Total Paid (USD)</TableCell>
                                                    <TableCell>Total Paid (Bluechip)</TableCell>
                                                    <TableCell>Last Payment (USD)</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {committers.map((c) => (
                                                    <TableRow key={c.wallet} hover>
                                                        <TableCell>
                                                            <Link to={`/wallet/${c.wallet}`}>{abbreviateAddress(c.wallet)}</Link>
                                                        </TableCell>
                                                        <TableCell>${formatMicroAmount(c.total_paid_usd)}</TableCell>
                                                        <TableCell>{formatMicroAmount(c.total_paid_bluechip)}</TableCell>
                                                        <TableCell>${formatMicroAmount(c.last_payment_usd)}</TableCell>
                                                    </TableRow>
                                                ))}
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
