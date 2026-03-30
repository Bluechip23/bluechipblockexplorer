import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockTransactionsTable from '../../components/individual-pages/BlockTransactionsTable';
import { Link, useParams } from 'react-router-dom';
import GeneralStats from '../../navigation/GeneralStats';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import { apiEndpoint, rpcEndpoint } from '../../components/universal/IndividualPage.const';
import axios from 'axios';
import { CardSkeleton, TableSkeleton } from '../../components/universal/LoadingSkeleton';
import CopyableId from '../../components/universal/CopyableId';

const BlockPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [rows, setRows] = useState<[]>([]);
    const [loading, setLoading] = useState(true);
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
            setLoading(true);
            try {
                const response = await axios.get(`${rpcEndpoint}/block?height=${id}`);
                const block = response.data?.result?.block;
                if (!block) {
                    console.error('No block found.');
                    return;
                }
                const transactions = block?.data?.txs || [];
                setBlockInfo({
                    height: block.header.height,
                    timestamp: block.header.time,
                    hash: response.data?.result?.block_id?.hash,
                    reward: 'N/A',
                    proposer: block.header.proposer_address,
                    fee: 'N/A',
                    transactionCount: transactions.length
                });
                if (transactions.length > 0) {
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
                }
            } catch (error) {
                console.error('Error loading transactions:', error);
            } finally {
                setLoading(false);
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
                                <Typography variant='h5'>Block Height: {blockInfo.height}</Typography>
                                <Divider />
                                <Typography>Timestamp: {blockInfo.timestamp}</Typography>
                                <Typography sx={{ wordBreak: 'break-all' }}>Block Hash: <CopyableId value={blockInfo.hash}><a href={`/blockpage/${blockInfo.height}`} style={{ color: '#1976d2' }}>{blockInfo.hash}</a></CopyableId></Typography>
                                <Typography>Block Reward: {blockInfo.reward}</Typography>
                                <Typography sx={{ wordBreak: 'break-all' }}>Block Proposer: <CopyableId value={blockInfo.proposer}><Link to={`/validator/${blockInfo.proposer}`} style={{ color: '#1976d2' }}>{blockInfo.proposer}</Link></CopyableId></Typography>
                                <Typography>Transaction Fee: {blockInfo.fee}</Typography>
                                <Typography># of Transactions: {blockInfo.transactionCount}</Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid item xs={12} md={8}>
                    {loading ? <TableSkeleton /> : <BlockTransactionsTable rows={rows} />}
                </Grid>
            </Grid>
        </Layout>
    )
}
export default BlockPage;