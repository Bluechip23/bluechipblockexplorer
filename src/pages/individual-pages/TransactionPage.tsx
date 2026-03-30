import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Chip, Divider, Grid, Stack, Typography } from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import RecentTransactionsTable from '../../components/table-pages/RecentTransactionsTable';
import { apiEndpoint, rpcEndpoint } from '../../components/universal/IndividualPage.const';
import { decodeMessageType, formatAmount, formatDenom } from '../../utils/txDecoder';
import { CardSkeleton } from '../../components/universal/LoadingSkeleton';
import CopyableId from '../../components/universal/CopyableId';

const TransactionPage: React.FC = () => {

    const { id } = useParams<{ id: string }>();
    const [txInfo, setTxInfo] = useState({
        hash: '',
        timestamp: '',
        status: '',
        block: '',
        sender: '',
        recipient: '',
        gasPrice: 0,
        value: 0,
        messageType: '',
        denom: '',
        memo: '',
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTransaction = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${apiEndpoint}/tx?hash=${id}`);
                const data = await response.json();
                const tx = data.result.tx;
                const txResult = data.result.tx_result;
                const msg = tx.body.messages[0];

                setTxInfo({
                    hash: data.result.hash,
                    timestamp: new Date(data.result.time).toLocaleString(),
                    status: txResult.code === 0 ? 'Success' : 'Failed',
                    block: data.result.height,
                    sender: msg.from_address || msg.sender || msg.delegator_address || '',
                    recipient: msg.to_address || msg.receiver || msg.validator_address || '',
                    gasPrice: tx.auth_info.fee.amount[0]?.amount || 0,
                    value: msg.amount?.[0]?.amount || msg.amount?.amount || 0,
                    messageType: msg['@type'] || msg.type || '',
                    denom: msg.amount?.[0]?.denom || msg.amount?.denom || msg.token?.denom || '',
                    memo: tx.body.memo || '',
                });
            } catch (error) {
                console.error("Failed to fetch transaction:", error);
                setError("Failed to load transaction data");
            } finally {
                setLoading(false);
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
                <Grid item xs={12} md={8} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>
                <Grid item xs={12} md={8}>
                    {loading ? (
                        <CardSkeleton />
                    ) : error ? (
                        <Card>
                            <CardContent>
                                <Typography color="error">{error}</Typography>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                    <Typography variant='h5' sx={{ wordBreak: 'break-all' }}>Transaction Hash: <CopyableId value={txInfo.hash}>{txInfo.hash}</CopyableId></Typography>
                                    <Chip
                                        label={txInfo.status}
                                        color={txInfo.status === 'Success' ? 'success' : 'error'}
                                        size="small"
                                    />
                                </Stack>
                                <Divider />
                                <Typography sx={{ mt: 1 }}>Type: <Chip label={decodeMessageType(txInfo.messageType)} size="small" variant="outlined" /></Typography>
                                <Typography>Block: <Link to={`/blockpage/${txInfo.block}`}>{txInfo.block}</Link></Typography>
                                <Typography>Timestamp: {txInfo.timestamp}</Typography>
                                <Typography>From: <CopyableId value={txInfo.sender}><Link to={`/wallet/${txInfo.sender}`}>{txInfo.sender}</Link></CopyableId></Typography>
                                <Typography>To: <CopyableId value={txInfo.recipient}><Link to={`/wallet/${txInfo.recipient}`}>{txInfo.recipient}</Link></CopyableId></Typography>
                                <Typography>Value: {formatAmount(txInfo.value, txInfo.denom)} {formatDenom(txInfo.denom)}</Typography>
                                <Typography>Gas Price: {txInfo.gasPrice}</Typography>
                                {txInfo.memo && <Typography>Memo: {txInfo.memo}</Typography>}
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid item xs={12} md={8}>
                    <RecentTransactionsTable />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default TransactionPage;