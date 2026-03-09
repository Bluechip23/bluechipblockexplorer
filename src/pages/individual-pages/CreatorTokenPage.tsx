import React, { useEffect, useState } from 'react'
import { Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';
import TokenTransactionsTable from '../../components/table-pages/TokenTransactionsTable';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import { Layout } from '../../ui';
import { useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import { apiEndpoint } from '../../components/universal/IndividualPage.const';
import axios from 'axios';
import { CardSkeleton } from '../../components/universal/LoadingSkeleton';

const CreatorTokenPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [tokenInfo, setTokenInfo] = useState({
        name: '',
        price: '',
        holders: 0,
        transfers7d: 0,
        marketCap: '',
        totalTransactions: 0,
        volume7d: '',
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchToken = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const response = await axios.get(`${apiEndpoint}/token/${id}`);
                const token = response.data;
                setTokenInfo({
                    name: token.name || token.creator || id,
                    price: token.price || 'N/A',
                    holders: token.holders || 0,
                    transfers7d: token.transfers_7d || 0,
                    marketCap: token.market_cap || 'N/A',
                    totalTransactions: token.total_transactions || 0,
                    volume7d: token.volume_7d || 'N/A',
                });
            } catch (error) {
                console.error('Error fetching token:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchToken();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Token Not Found</Typography></Layout>;
    }
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container spacing={2} justifyContent='center' alignItems='center'>
                <Grid item xs={12} md={8} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>
                <Grid item xs={12} md={8}>
                    {loading ? (
                        <CardSkeleton />
                    ) : (
                        <Card>
                            <CardContent>
                                <Typography variant='h5'>{tokenInfo.name}</Typography>
                                <Divider />
                                <Typography>Price: {tokenInfo.price}</Typography>
                                <Typography>Holders: {tokenInfo.holders}</Typography>
                                <Typography>7 Day Transfers: {tokenInfo.transfers7d}</Typography>
                                <Typography>Market Cap: {tokenInfo.marketCap}</Typography>
                                <Typography>Total Transactions: {tokenInfo.totalTransactions}</Typography>
                                <Typography>7 Day Trade Volume: {tokenInfo.volume7d}</Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid item xs={12} md={8}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Token Transfer History</Typography>
                    <TokenTransactionsTable />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default CreatorTokenPage;