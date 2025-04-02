import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockTransactionsTable from '../../components/individual-pages/BlockTransactionsTable';
import { useParams } from 'react-router-dom';
import GeneralStats from '../../navigation/GeneralStats';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import { apiEndpoint, rpcEndpoint } from '../../components/universal/IndividualPage.const';
import axios from 'axios';

const BlockPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [rows, setRows] = useState<[]>([]);
    const [blockInfo, setBlockInfo] = useState({
        height: '',
        timestamp: '',
        hash: '',
        reward: '',
        proposer: '',
        fee: '',
        transactionCount: 0
    });
    useEffect(() => {
        async function loadBlocks() {
            try {
                const response = await axios.get(`${rpcEndpoint}/block?height=${id}`);
                const block = response.data?.result?.block; 
                if (!block) {
                    console.error('No block found.');
                    return;
                }
                const transactions = block?.data?.txs || [];
                if (transactions.length === 0) {
                    console.warn('No transactions in this block.');
                    return;
                }
                setBlockInfo({
                    height: block.header.height,
                    timestamp: block.header.time,
                    hash: response.data?.result?.block_id?.hash,
                    reward: 'N/A', 
                    proposer: block.header.proposer_address,
                    fee: 'N/A',
                    transactionCount: block.data.txs.length
                });
                const transactionsRows = transactions.map((tx: any) => {       
                    const decodedTx = window.atob(tx);
                    const parsedTx = JSON.parse(decodedTx); 
                    return {
                        hash: parsedTx.txhash, 
                        method: parsedTx.tx?.body?.messages[0]?.type || 'Unknown',
                        sender: parsedTx.tx?.body?.messages[0]?.sender || 'Unknown',
                        recipient: parsedTx.tx?.body?.messages[0]?.recipient || 'Unknown',
                        value: parsedTx.tx?.body?.messages[0]?.amount[0]?.amount || '0',
                        fee: parsedTx.tx?.auth_info?.fee?.amount[0]?.amount || '0'
                    };
                });
                setRows(transactionsRows); 
            } catch (error) {
                console.error('Error loading transactions:', error);
            } finally {
            }
        }
        loadBlocks();
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
                            <Typography variant='h5'>Block Height: {blockInfo.height}</Typography>
                            <Divider />
                            <Typography>TImestamp: {blockInfo.timestamp}</Typography>
                            <Typography>Block Hash: {blockInfo.hash}</Typography>
                            <Typography>Block Reward: {blockInfo.reward}</Typography>
                            <Typography>Block Proposer: {blockInfo.proposer}</Typography>
                            <Typography>Transaction Fee: {blockInfo.fee}</Typography>
                            <Typography>Block Height: {blockInfo.height}</Typography>
                            <Typography># of Transactions: {blockInfo.transactionCount}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={8}>
                    <BlockTransactionsTable rows={rows} />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default BlockPage;