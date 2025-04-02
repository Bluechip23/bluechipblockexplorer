import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import RecentTransactionsTable from '../../components/table-pages/RecentTransactionsTable';
import { apiEndpoint, rpcEndpoint } from '../../components/universal/IndividualPage.const';

const TransactionPage: React.FC = () => {

    const id = useParams<{ id: string }>();
    const [txInfo, setTxInfo] = useState({
        hash: '',
        timestamp: '',
        status: '',
        block: '',
        sender: '',
        recipient: '',
        gasPrice: 0,
        value: 0
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTransaction = async () => {
            try {
                const response = await fetch(`${apiEndpoint}/tx?hash=${id}`);
                const data = await response.json();
                const tx = data.result.tx;
                const txResult = data.result.tx_result;

                setTxInfo({
                    hash: data.result.hash,
                    timestamp: new Date(data.result.time).toLocaleString(), 
                    status: txResult.code === 0 ? 'Success' : 'Failed',
                    block: data.result.height,
                    sender: tx.body.messages[0].from_address, 
                    recipient: tx.body.messages[0].to_address,
                    gasPrice: tx.auth_info.fee.amount[0].amount,
                    value: tx.body.messages[0].amount[0].amount 
                });
            } catch (error) {
                console.error("Failed to fetch transaction:", error);
                setError("Failed to load transaction data");
            }
        };

        if (id) {
            fetchTransaction();
        }
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}><Typography>Transaction ID Not Provided</Typography></Layout>;
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
                            <Typography variant='h5'>Transaction Hash: {txInfo.hash} </Typography>
                            <Divider />
                            <Typography>Status: {txInfo.hash}</Typography>
                            <Typography>Block: {txInfo.block}</Typography>
                            <Typography>Timestamp: {txInfo.timestamp}</Typography>
                            <Link to=''><Typography>From: {txInfo.sender}</Typography></Link>
                            <Link to=''><Typography>To: {txInfo.recipient}</Typography></Link>
                            <Typography>Value: {txInfo.value} </Typography>
                            <Typography>Gas Price: {txInfo.gasPrice}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={8}>
                    <RecentTransactionsTable />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default TransactionPage;