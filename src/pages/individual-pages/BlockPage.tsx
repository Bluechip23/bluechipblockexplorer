import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockTransactionsTable from '../../components/individual-pages/BlockTransactionsTable';
import { Link, useParams } from 'react-router-dom';
import GeneralStats from '../../navigation/GeneralStats';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import { rpcEndpoint } from '../../components/universal/IndividualPage.const';
import { timeAgo, truncateAddress } from '../../utils/formatters';
import CopyToClipboard from '../../components/universal/CopyToClipboard';
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
                setBlockInfo({
                    height: block.header.height,
                    timestamp: block.header.time,
                    hash: response.data?.result?.block_id?.hash,
                    reward: 'N/A',
                    proposer: block.header.proposer_address,
                    fee: 'N/A',
                    transactionCount: transactions.length
                });

                if (transactions.length === 0) return;

                const transactionsRows = transactions.map((tx: any) => {
                    try {
                        const decodedTx = window.atob(tx);
                        const parsedTx = JSON.parse(decodedTx);
                        return {
                            hash: parsedTx.txhash,
                            method: parsedTx.tx?.body?.messages?.[0]?.type || 'Unknown',
                            sender: parsedTx.tx?.body?.messages?.[0]?.sender || 'Unknown',
                            recipient: parsedTx.tx?.body?.messages?.[0]?.recipient || 'Unknown',
                            value: parsedTx.tx?.body?.messages?.[0]?.amount?.[0]?.amount || '0',
                            fee: parsedTx.tx?.auth_info?.fee?.amount?.[0]?.amount || '0'
                        };
                    } catch {
                        return { hash: '', method: 'Unknown', sender: '', recipient: '', value: '0', fee: '0' };
                    }
                });
                setRows(transactionsRows);
            } catch (error) {
                console.error('Error loading transactions:', error);
            }
        }
        loadBlocks();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}><Typography>Block Not Found</Typography></Layout>;
    }

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container spacing={3} justifyContent='center' alignItems='center'>
                <Grid item xs={10} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>
                <Grid item xs={10}>
                    <Card>
                        <CardContent>
                            <Typography variant='h5' gutterBottom>Block #{blockInfo.height}</Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Stack spacing={1.5}>
                                <DetailRow label="Block Height" value={blockInfo.height} />
                                <DetailRow label="Timestamp" value={
                                    <span>{new Date(blockInfo.timestamp).toLocaleString()} ({timeAgo(blockInfo.timestamp)})</span>
                                } />
                                <DetailRow label="Block Hash" value={
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{blockInfo.hash}</Typography>
                                        <CopyToClipboard text={blockInfo.hash} />
                                    </Stack>
                                } />
                                <DetailRow label="Proposer" value={
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                        <Link to={`/validator/${blockInfo.proposer}`} style={{ color: '#1976d2', fontFamily: 'monospace' }}>
                                            {truncateAddress(blockInfo.proposer, 12, 8)}
                                        </Link>
                                        <CopyToClipboard text={blockInfo.proposer} />
                                    </Stack>
                                } />
                                <DetailRow label="# of Transactions" value={blockInfo.transactionCount} />
                                <DetailRow label="Block Reward" value={blockInfo.reward} />
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={10}>
                    <BlockTransactionsTable rows={rows} />
                </Grid>
            </Grid>
        </Layout>
    )
}

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <Stack direction="row" spacing={2} alignItems="flex-start">
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>{label}:</Typography>
        <Typography variant="body2" component="div">{value}</Typography>
    </Stack>
);

export default BlockPage;
