import React, { useEffect, useState } from 'react';
import { Layout } from '../ui';
import { Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import BlockExplorerNavBar from '../navigation/BlockExplorerNavBar';
import GeneralStats from '../navigation/GeneralStats';
import { rpcEndpoint, apiEndpoint } from '../components/universal/IndividualPage.const';
import { Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import axios from 'axios';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

const ChartsPage: React.FC = () => {
    const [blockTxData, setBlockTxData] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });
    const [blockTimeData, setBlockTimeData] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });
    const [stakingData, setStakingData] = useState<{ bonded: number; unbonded: number }>({ bonded: 0, unbonded: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchChartData = async () => {
            try {
                // Get latest block height
                const statusRes = await axios.get(`${rpcEndpoint}/status`);
                const latestHeight = Number(statusRes.data.result.sync_info.latest_block_height);

                // Fetch recent blocks for tx count and block time charts
                const blockCount = 20;
                const minHeight = Math.max(1, latestHeight - blockCount + 1);
                const blocksRes = await axios.get(`${rpcEndpoint}/blockchain?minHeight=${minHeight}&maxHeight=${latestHeight}`);
                const blocks = blocksRes.data.result.block_metas || [];

                // Sort by height ascending
                const sorted = [...blocks].sort((a: any, b: any) => Number(a.header.height) - Number(b.header.height));

                const txLabels: string[] = [];
                const txCounts: number[] = [];
                const timeLabels: string[] = [];
                const blockTimes: number[] = [];

                for (let i = 0; i < sorted.length; i++) {
                    const block = sorted[i];
                    txLabels.push(block.header.height);
                    txCounts.push(Number(block.header.num_txs || block.num_txs || 0));

                    if (i > 0) {
                        const prevTime = new Date(sorted[i - 1].header.time).getTime();
                        const currTime = new Date(block.header.time).getTime();
                        const diffSec = (currTime - prevTime) / 1000;
                        timeLabels.push(block.header.height);
                        blockTimes.push(Math.max(0, diffSec));
                    }
                }

                setBlockTxData({ labels: txLabels, data: txCounts });
                setBlockTimeData({ labels: timeLabels, data: blockTimes });

                // Fetch staking pool data
                const poolRes = await axios.get(`${apiEndpoint}/cosmos/staking/v1beta1/pool`);
                const pool = poolRes.data.pool;
                setStakingData({
                    bonded: Number(pool.bonded_tokens || 0),
                    unbonded: Number(pool.not_bonded_tokens || 0),
                });
            } catch (error) {
                console.error('Error fetching chart data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchChartData();
    }, []);

    const txChartData = {
        labels: blockTxData.labels,
        datasets: [{
            label: 'Transactions per Block',
            data: blockTxData.data,
            borderColor: '#1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            fill: true,
            tension: 0.3,
        }],
    };

    const blockTimeChartData = {
        labels: blockTimeData.labels,
        datasets: [{
            label: 'Block Time (seconds)',
            data: blockTimeData.data,
            borderColor: '#4caf50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            fill: true,
            tension: 0.3,
        }],
    };

    const stakingChartData = {
        labels: ['Bonded (Staked)', 'Not Bonded'],
        datasets: [{
            data: [stakingData.bonded, stakingData.unbonded],
            backgroundColor: ['#1976d2', '#e0e0e0'],
            borderWidth: 2,
        }],
    };

    const lineOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' as const },
        },
        scales: {
            y: { beginAtZero: true },
        },
    };

    const doughnutOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'bottom' as const },
        },
    };

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent='center' alignItems='center' spacing={2}>
                <Grid item xs={10} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>
                <Grid item xs={10}>
                    <Typography variant='h4' gutterBottom>Network Charts</Typography>
                    {loading && <Typography>Loading chart data...</Typography>}
                </Grid>

                {/* Transactions per Block */}
                <Grid item xs={10} md={6}>
                    <Card>
                        <CardContent>
                            <Typography variant='h6' gutterBottom>Transactions per Block</Typography>
                            <Line data={txChartData} options={lineOptions} />
                        </CardContent>
                    </Card>
                </Grid>

                {/* Block Time */}
                <Grid item xs={10} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant='h6' gutterBottom>Staking Ratio</Typography>
                            <Doughnut data={stakingChartData} options={doughnutOptions} />
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                                {((stakingData.bonded / (stakingData.bonded + stakingData.unbonded || 1)) * 100).toFixed(1)}% Staked
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Block Time Chart */}
                <Grid item xs={10}>
                    <Card>
                        <CardContent>
                            <Typography variant='h6' gutterBottom>Block Time (seconds)</Typography>
                            <Line data={blockTimeChartData} options={lineOptions} />
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Layout>
    );
};

export default ChartsPage;
