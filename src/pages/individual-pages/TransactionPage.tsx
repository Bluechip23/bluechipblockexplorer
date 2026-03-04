import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Chip, Divider, Grid, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import { apiEndpoint } from '../../components/universal/IndividualPage.const';
import { decodeMsgType, timeAgo, formatTokenAmount, formatDenom } from '../../utils/formatters';
import CopyToClipboard from '../../components/universal/CopyToClipboard';

interface TxEvent {
    type: string;
    attributes: { key: string; value: string }[];
}

interface TxMessage {
    type: string;
    content: Record<string, any>;
}

const TransactionPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [txInfo, setTxInfo] = useState({
        hash: '',
        timestamp: '',
        status: '',
        statusCode: 0,
        block: '',
        sender: '',
        recipient: '',
        gasPrice: 0,
        gasWanted: 0,
        gasUsed: 0,
        value: 0,
        valueDenom: '',
        feeDenom: '',
        memo: '',
    });
    const [events, setEvents] = useState<TxEvent[]>([]);
    const [messages, setMessages] = useState<TxMessage[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTransaction = async () => {
            try {
                const response = await fetch(`${apiEndpoint}/tx?hash=${id}`);
                const data = await response.json();
                const tx = data.result.tx;
                const txResult = data.result.tx_result;

                setTxInfo({
                    hash: data.result.hash || id || '',
                    timestamp: data.result.time || '',
                    status: txResult.code === 0 ? 'Success' : 'Failed',
                    statusCode: txResult.code || 0,
                    block: data.result.height || '',
                    sender: tx.body?.messages?.[0]?.from_address || tx.body?.messages?.[0]?.sender || '',
                    recipient: tx.body?.messages?.[0]?.to_address || tx.body?.messages?.[0]?.recipient || '',
                    gasPrice: tx.auth_info?.fee?.amount?.[0]?.amount || 0,
                    gasWanted: txResult.gas_wanted || 0,
                    gasUsed: txResult.gas_used || 0,
                    value: tx.body?.messages?.[0]?.amount?.[0]?.amount || tx.body?.messages?.[0]?.amount?.amount || 0,
                    valueDenom: tx.body?.messages?.[0]?.amount?.[0]?.denom || tx.body?.messages?.[0]?.amount?.denom || 'ubluechip',
                    feeDenom: tx.auth_info?.fee?.amount?.[0]?.denom || 'ubluechip',
                    memo: tx.body?.memo || '',
                });

                // Parse messages
                const msgs = (tx.body?.messages || []).map((msg: any) => ({
                    type: msg['@type'] || msg.type || 'Unknown',
                    content: msg,
                }));
                setMessages(msgs);

                // Parse events
                const txEvents = (txResult.events || []).map((evt: any) => ({
                    type: evt.type || '',
                    attributes: (evt.attributes || []).map((attr: any) => ({
                        key: attr.key ? tryDecode(attr.key) : '',
                        value: attr.value ? tryDecode(attr.value) : '',
                    })),
                }));
                setEvents(txEvents);
            } catch (err) {
                console.error("Failed to fetch transaction:", err);
                setError("Failed to load transaction data");
            }
        };

        if (id) fetchTransaction();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}><Typography>Transaction ID Not Provided</Typography></Layout>;
    }

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container spacing={2} justifyContent='center' alignItems='center'>
                <Grid item xs={10} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>

                {/* Transaction Overview */}
                <Grid item xs={10}>
                    <Card>
                        <CardContent>
                            <Typography variant='h5' gutterBottom>Transaction Details</Typography>
                            <Divider sx={{ mb: 2 }} />
                            {error && <Typography color="error">{error}</Typography>}
                            <Stack spacing={1.5}>
                                <DetailRow label="Tx Hash" value={
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{txInfo.hash}</Typography>
                                        <CopyToClipboard text={txInfo.hash} />
                                    </Stack>
                                } />
                                <DetailRow label="Status" value={
                                    <Chip
                                        label={txInfo.status}
                                        size="small"
                                        color={txInfo.statusCode === 0 ? 'success' : 'error'}
                                    />
                                } />
                                <DetailRow label="Block" value={
                                    <Link to={`/blockpage/${txInfo.block}`} style={{ color: '#1976d2' }}>{txInfo.block}</Link>
                                } />
                                <DetailRow label="Timestamp" value={
                                    <span>{new Date(txInfo.timestamp).toLocaleString()} ({timeAgo(txInfo.timestamp)})</span>
                                } />
                                <Divider />
                                <DetailRow label="From" value={
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                        <Link to={`/wallet/${txInfo.sender}`} style={{ color: '#1976d2', fontFamily: 'monospace' }}>{txInfo.sender}</Link>
                                        <CopyToClipboard text={txInfo.sender} />
                                    </Stack>
                                } />
                                <DetailRow label="To" value={
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                        <Link to={`/wallet/${txInfo.recipient}`} style={{ color: '#1976d2', fontFamily: 'monospace' }}>{txInfo.recipient}</Link>
                                        <CopyToClipboard text={txInfo.recipient} />
                                    </Stack>
                                } />
                                <Divider />
                                <DetailRow label="Value" value={`${formatTokenAmount(txInfo.value)} ${formatDenom(txInfo.valueDenom)}`} />
                                <DetailRow label="Fee" value={`${formatTokenAmount(txInfo.gasPrice)} ${formatDenom(txInfo.feeDenom)}`} />
                                <DetailRow label="Gas (Used / Wanted)" value={`${Number(txInfo.gasUsed).toLocaleString()} / ${Number(txInfo.gasWanted).toLocaleString()}`} />
                                {txInfo.memo && <DetailRow label="Memo" value={txInfo.memo} />}
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Decoded Messages */}
                {messages.length > 0 && (
                    <Grid item xs={10}>
                        <Card>
                            <CardContent>
                                <Typography variant='h6' gutterBottom>
                                    Messages <Chip label={messages.length} size="small" sx={{ ml: 1 }} />
                                </Typography>
                                {messages.map((msg, i) => (
                                    <Card key={i} variant="outlined" sx={{ mb: 1, p: 1 }}>
                                        <Typography variant="subtitle2" color="primary">
                                            #{i + 1} {decodeMsgType(msg.type)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                            {msg.type}
                                        </Typography>
                                        <Stack sx={{ mt: 1 }} spacing={0.5}>
                                            {Object.entries(msg.content)
                                                .filter(([key]) => key !== '@type' && key !== 'type')
                                                .map(([key, value]) => (
                                                    <Typography key={key} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                        <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                    </Typography>
                                                ))}
                                        </Stack>
                                    </Card>
                                ))}
                            </CardContent>
                        </Card>
                    </Grid>
                )}

                {/* Event Logs */}
                {events.length > 0 && (
                    <Grid item xs={10}>
                        <Card>
                            <CardContent>
                                <Typography variant='h6' gutterBottom>
                                    Event Logs <Chip label={events.length} size="small" sx={{ ml: 1 }} />
                                </Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Event Type</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Attributes</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {events.map((event, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{i}</TableCell>
                                                    <TableCell>
                                                        <Chip label={event.type} size="small" variant="outlined" />
                                                    </TableCell>
                                                    <TableCell>
                                                        {event.attributes.map((attr, j) => (
                                                            <Typography key={j} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                                {attr.key} = {attr.value}
                                                            </Typography>
                                                        ))}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    </Grid>
                )}
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

function tryDecode(str: string): string {
    try {
        return atob(str);
    } catch {
        return str;
    }
}

export default TransactionPage;
