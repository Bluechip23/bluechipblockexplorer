import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';

import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import { useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import WalletsHoldingsTable from '../../components/individual-pages/WalletHoldingsTable';
import WalletTransactionsTable from '../../components/individual-pages/WalletTransactionsTable';
import { rpcEndpoint } from '../../components/universal/IndividualPage.const';


const Wallet: React.FC = () => {

    const id = useParams<{ id: string }>();
    const [wallet, setWallet] = useState<any>(null);
    useEffect(() => {
        const fetchWallet = async () => {
            try {
                const response = await fetch(`${rpcEndpoint}/wallets/${id}`);
                const data = await response.json();
                setWallet(data);
            } catch (error) {
                console.error("Failed to fetch wallet:", error);
            }
        };
        fetchWallet();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Wallet Not Found</Typography></Layout>;
    }
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent='center' alignItems='center' spacing={5}>
                <Grid item xs={8} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>
                <Grid item xs={4}>
                    <Card>
                        <CardContent>
                            <Typography variant='h4'>Wallet:</Typography>
                            <Divider />
                            <Typography>Balance: </Typography>
                            <Typography>Liquid: </Typography>
                            <Typography>Staked: </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={8}>
                    <WalletsHoldingsTable />
                </Grid>
                <Grid item xs={8}>
                    <WalletTransactionsTable />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default Wallet;