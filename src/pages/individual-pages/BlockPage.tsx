import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockTransactionsTable from '../../components/individual-pages/BlockTransactionsTable';
import { useParams } from 'react-router-dom';
import GeneralStats from '../../navigation/GeneralStats';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import { rpcEndpoint } from '../../components/universal/IndividualPage.const';

const BlockPage: React.FC = () => {

    const id = useParams<{ id: string }>();
    const [block, setBlock] = useState<any>(null);
    useEffect(() => {
        const fetchBlock = async () => {
            try {
                const response = await fetch(`${rpcEndpoint}/block?height=${id}`);
                const data = await response.json();
                setBlock(data);
            } catch (error) {
                console.error("Failed to fetch block:", error);
            }
        };
        fetchBlock();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Block Not Found</Typography></Layout>;
    }
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container spacing={5} justifyContent='center' alignItems='center'>
                <Grid item xs={8} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>
                <Grid item xs={8} >
                    <Card>
                        <CardContent>
                            <Typography variant='h5'>Block #11111</Typography>
                            <Divider />
                            <Typography>TImestamp: </Typography>
                            <Typography>Block Hash: </Typography>
                            <Typography>Block Reward: </Typography>
                            <Typography>Block Proposer: </Typography>
                            <Typography>Transaction Fee: </Typography>
                            <Typography>Block Height: </Typography>
                            <Typography># of Transactions: </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={8}>
                    <BlockTransactionsTable />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default BlockPage;