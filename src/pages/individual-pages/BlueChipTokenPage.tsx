import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';
import BlueChipTokenTransactionsTable from '../../components/table-pages/BluechipTokenTransactionsTable';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import { useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import { rpcEndpoint } from '../../components/universal/IndividualPage.const';

const CreatorTokenPage: React.FC = () => {

    const id = useParams<{ id: string }>();
    const [bluechip, setBluechip] = useState<any>(null);
    useEffect(() => {
        const fetchBluechip = async () => {
            try {
                const response = await fetch(`${rpcEndpoint}/bluechip/${id}`);
                const data = await response.json();
                setBluechip(data);
            } catch (error) {
                console.error("Failed to fetch data:", error);
            }
        };
        fetchBluechip();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Information Not Found</Typography></Layout>;
    }
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container spacing={2} justifyContent='center' alignItems='center'>
                <Grid item xs={8} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>
                <Grid item xs={8}>
                    <Card>
                        <CardContent>
                            <Typography variant='h5'>The blue chip</Typography>
                            <Divider />
                            <Typography>Price: </Typography>
                            <Typography>Holders: </Typography>
                            <Typography>7 Day Transfers: </Typography>
                            <Typography>Market Cap: </Typography>
                            <Typography>Total Transactions: </Typography>
                            <Typography>7 Day Trade Volume: </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={8}>
                    <BlueChipTokenTransactionsTable />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default CreatorTokenPage;