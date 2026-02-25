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

const CreatorPoolPage: React.FC = () => {

    const { id } = useParams<{ id: string }>();
    const [poolInfo, setPoolInfo] = useState({
        creator: '',
        address: '',
        liquidity: 0,
        feesCollected: 0,
        topProvider: '',
    });

    useEffect(() => {
        async function loadPool() {
            if (!id) return;
            try {
                const response = await axios.get(`${apiEndpoint}/creatorPools`);
                const pools = response.data.result.pool;
                const pool = pools.find((p: any) => p.address === id);
                if (pool) {
                    setPoolInfo({
                        creator: pool.creator,
                        address: pool.address,
                        liquidity: Number(pool.liquidity) || 0,
                        feesCollected: Number(pool.feeCollected) || 0,
                        topProvider: pool.topProvider,
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
                <Grid item xs={8}>
                    <Card>
                        <CardContent>
                            <Typography variant='h5'>Creator: {poolInfo.creator}</Typography>
                            <Divider />
                            <Typography>Address: {poolInfo.address}</Typography>
                            <Typography>Liquidity: {poolInfo.liquidity.toLocaleString()}</Typography>
                            <Typography>Fees Collected: {poolInfo.feesCollected.toLocaleString()}</Typography>
                            <Typography>Top Provider: {poolInfo.topProvider}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
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
                <Grid item xs={8}>
                    <CreatorPoolTable />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default CreatorPoolPage;