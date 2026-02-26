import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Box, Card, CardContent, Divider, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import { Link, useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import CreatorPoolTable from '../../components/table-pages/CreatorPoolTable';
import { apiEndpoint } from '../../components/universal/IndividualPage.const';
import axios from 'axios';

const CREATOR_THRESHOLD = 25000;

interface PoolData {
    creator: string;
    address: string;
    liquidity: number;
    feesCollected: number;
    feesCreated: number;
    topProvider: string;
    transactions30d: number;
    committers: number;
    committers30d: number;
    liquidityPositions: number;
    avgCommitSize: number;
    avgTransactionSize: number;
}

const defaultPoolData: PoolData = {
    creator: '',
    address: '',
    liquidity: 0,
    feesCollected: 0,
    feesCreated: 0,
    topProvider: '',
    transactions30d: 0,
    committers: 0,
    committers30d: 0,
    liquidityPositions: 0,
    avgCommitSize: 0,
    avgTransactionSize: 0,
};

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
    const [poolInfo, setPoolInfo] = useState<PoolData>(defaultPoolData);

    useEffect(() => {
        async function loadPool() {
            if (!id) return;
            try {
                const response = await axios.get(`${apiEndpoint}/creatorPools`);
                const pools = response.data.result.pool;
                const pool = pools.find((p: any) => p.address === id);
                if (pool) {
                    setPoolInfo({
                        creator: pool.creator || '',
                        address: pool.address || '',
                        liquidity: Number(pool.liquidity) || 0,
                        feesCollected: Number(pool.feeCollected) || 0,
                        feesCreated: Number(pool.feesCreated) || 0,
                        topProvider: pool.topProvider || '',
                        transactions30d: Number(pool.transactions30d) || 0,
                        committers: Number(pool.committers) || 0,
                        committers30d: Number(pool.committers30d) || 0,
                        liquidityPositions: Number(pool.liquidityPositions) || 0,
                        avgCommitSize: Number(pool.avgCommitSize) || 0,
                        avgTransactionSize: Number(pool.avgTransactionSize) || 0,
                    });
                }
            } catch (error) {
                console.error('Error loading pool:', error);
            }
        }
        loadPool();
    }, [id]);

    const progress = Math.min(poolInfo.liquidity, CREATOR_THRESHOLD);
    const progressPercent = (progress / CREATOR_THRESHOLD) * 100;

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Creator Pool Not Found</Typography></Layout>;
    }
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent='center' alignItems='center' spacing={4}>
                <Grid item xs={8} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>

                {/* Creator Header */}
                <Grid item xs={8}>
                    <Card>
                        <CardContent>
                            <Typography variant='h5' sx={{ fontWeight: 'bold' }}>
                                Creator: {poolInfo.creator}
                            </Typography>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="body2" color="text.secondary">
                                Address: {poolInfo.address}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Top Provider: <Link to={`/wallet/${poolInfo.topProvider}`} style={{ color: '#1976d2' }}>{poolInfo.topProvider}</Link>
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Creator Progress Tracker */}
                <Grid item xs={8}>
                    <Card>
                        <CardContent>
                            <Typography variant='h6' sx={{ mb: 1 }}>
                                Creator Progress
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ flexGrow: 1 }}>
                                    <LinearProgress
                                        variant="determinate"
                                        value={progressPercent}
                                        sx={{
                                            height: 24,
                                            borderRadius: 12,
                                            backgroundColor: '#e0e0e0',
                                            '& .MuiLinearProgress-bar': {
                                                borderRadius: 12,
                                                backgroundColor: progressPercent >= 100 ? '#4caf50' : '#1976d2',
                                            },
                                        }}
                                    />
                                </Box>
                                <Typography variant='body2' sx={{ minWidth: 120, textAlign: 'right' }}>
                                    {progress.toLocaleString()} / {CREATOR_THRESHOLD.toLocaleString()}
                                </Typography>
                            </Box>
                            {progressPercent >= 100 && (
                                <Typography variant='body2' sx={{ mt: 1, color: '#4caf50', fontWeight: 'bold' }}>
                                    Threshold reached!
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Stats Grid */}
                <Grid item xs={8}>
                    <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                            <StatCard label="Liquidity" value={poolInfo.liquidity} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <StatCard label="Fees Collected" value={poolInfo.feesCollected} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <StatCard label="Fees Created" value={poolInfo.feesCreated} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <StatCard label="Liquidity Positions" value={poolInfo.liquidityPositions} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <StatCard label="Transactions (30d)" value={poolInfo.transactions30d} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <StatCard label="Total Committers" value={poolInfo.committers} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <StatCard label="Committers (30d)" value={poolInfo.committers30d} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <StatCard label="Avg Commit Size" value={poolInfo.avgCommitSize} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <StatCard label="Avg Transaction Size" value={poolInfo.avgTransactionSize} />
                        </Grid>
                    </Grid>
                </Grid>

                {/* Pool Table */}
                <Grid item xs={8}>
                    <CreatorPoolTable />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default CreatorPoolPage;
