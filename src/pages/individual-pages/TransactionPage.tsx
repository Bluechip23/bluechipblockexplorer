import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import RecentTransactionsTable from '../../components/table-pages/RecentTransactionsTable';
import { rpcEndpoint } from '../../components/universal/IndividualPage.const';

const TransactionPage: React.FC = () => {

    const id = useParams<{ id: string }>();
    const [transaction, setTransaction] = useState<any>(null);
    useEffect(() => {
        const fetchTransaction = async () => {
            try {
                const response = await fetch(`${rpcEndpoint}/txs/${id}`);
                const data = await response.json();
                setTransaction(data);
            } catch (error) {
                console.error("Failed to fetch wallet:", error);
            }
        };
        fetchTransaction();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Transaction Not Found</Typography></Layout>;
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
                            <Typography variant='h5'>Transaction Hash: </Typography>
                            <Divider />
                            <Typography>Status: </Typography>
                            <Typography>Block: </Typography>
                            <Typography>Timestamp: </Typography>
                            <Link to=''><Typography>From: </Typography></Link>
                            <Link to=''><Typography>To: </Typography></Link>
                            <Typography>Value: </Typography>
                            <Typography>Gas Price: </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={8}>
                    <RecentTransactionsTable hash={''} method={''} block={''} sender={''} recipient={''} value={0} fee={0}/>
                </Grid>
            </Grid>
        </Layout>
    )
}
export default TransactionPage;