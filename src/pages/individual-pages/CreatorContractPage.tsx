import React, { useEffect, useState } from 'react';
import { Layout } from '../../ui';
import { Card, CardContent, Chip, CircularProgress, Divider, Grid, Stack, Typography, Box } from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import { Link, useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import {
    queryTokenInfo,
    fetchAllPoolSummaries,
    formatMicroAmount,
    abbreviateAddress,
    CW20TokenInfo,
    PoolSummary,
} from '../../utils/contractQueries';
import { factoryAddress } from '../../components/universal/IndividualPage.const';
import CopyableId from '../../components/universal/CopyableId';

const CreatorContract: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [tokenInfo, setTokenInfo] = useState<CW20TokenInfo | null>(null);
    const [pool, setPool] = useState<PoolSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContract = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const ti = await queryTokenInfo(id);
                setTokenInfo(ti);

                if (factoryAddress) {
                    const summaries = await fetchAllPoolSummaries(factoryAddress);
                    const match = summaries.find(s => s.creatorTokenAddress === id);
                    if (match) setPool(match);
                }
            } catch (error) {
                console.error('Error fetching contract:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchContract();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}><Typography>Contract Not Found</Typography></Layout>;
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
                <Grid item xs={12} md={8}>
                    {loading ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <CircularProgress />
                            <Typography variant="body2" sx={{ mt: 1 }}>Loading contract data from chain...</Typography>
                        </Box>
                    ) : !tokenInfo ? (
                        <Typography color="error">Could not load contract data for this address.</Typography>
                    ) : (
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                    <Typography variant='h5'>{tokenInfo.name}</Typography>
                                    {pool && (
                                        <Chip
                                            label={pool.thresholdReached ? 'Active' : 'Pre-launch'}
                                            color={pool.thresholdReached ? 'success' : 'warning'}
                                            size="small"
                                        />
                                    )}
                                </Box>
                                <Divider />
                                <Typography sx={{ mt: 1 }}>Token Name: {tokenInfo.name}</Typography>
                                <Typography>Symbol: {tokenInfo.symbol}</Typography>
                                <Typography>Decimals: {tokenInfo.decimals}</Typography>
                                <Typography>Contract Address: <CopyableId value={id}>{id}</CopyableId></Typography>
                                <Typography>Total Supply: {formatMicroAmount(tokenInfo.total_supply, tokenInfo.decimals)}</Typography>
                                {pool && (
                                    <>
                                        <Divider sx={{ my: 1 }} />
                                        <Typography variant="subtitle2" color="text.secondary">Associated Pool</Typography>
                                        <Typography>
                                            Pool: <CopyableId value={pool.poolAddress}><Link to={`/creatorpool/${pool.poolAddress}`} style={{ color: '#1976d2' }}>{abbreviateAddress(pool.poolAddress)}</Link></CopyableId>
                                        </Typography>
                                        <Typography>Total Liquidity: {formatMicroAmount(pool.totalLiquidity)}</Typography>
                                        <Typography>Fees Collected: {formatMicroAmount(pool.totalFeesCollected0)}</Typography>
                                        <Typography>LP Positions: {pool.totalPositions}</Typography>
                                        <Typography>Committers: {pool.totalCommitters}</Typography>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </Grid>
            </Grid>
        </Layout>
    );
};

export default CreatorContract;
