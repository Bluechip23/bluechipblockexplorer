import React, { useEffect, useState } from 'react';
import { Layout } from '../ui';
import {
    Chip,
    Grid,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Typography,
} from '@mui/material';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import BlockExplorerNavBar from '../navigation/BlockExplorerNavBar';
import GeneralStats from '../navigation/GeneralStats';
import { apiEndpoint } from '../components/universal/IndividualPage.const';
import { decodeMessageType, formatAmount, formatDenom } from '../utils/txDecoder';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { TableSkeleton } from '../components/universal/LoadingSkeleton';

interface IBCTransfer {
    hash: string;
    height: string;
    sender: string;
    receiver: string;
    amount: string;
    denom: string;
    sourceChannel: string;
    destChannel: string;
    status: string;
    timestamp: string;
}

const IBCTransfersPage: React.FC = () => {
    const [transfers, setTransfers] = useState<IBCTransfer[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    useEffect(() => {
        const fetchIBCTransfers = async () => {
            try {
                const query = encodeURIComponent("message.action='/ibc.applications.transfer.v1.MsgTransfer'");
                const response = await axios.get(
                    `${apiEndpoint}/cosmos/tx/v1beta1/txs?events=${query}&order_by=ORDER_BY_DESC&pagination.limit=50`
                );
                const txs = response.data.tx_responses || [];
                const parsed = txs.map((tx: any) => {
                    const msg = tx.tx?.body?.messages?.[0] || {};
                    return {
                        hash: tx.txhash,
                        height: tx.height,
                        sender: msg.sender || '',
                        receiver: msg.receiver || '',
                        amount: msg.token?.amount || '0',
                        denom: msg.token?.denom || '',
                        sourceChannel: msg.source_channel || '',
                        destChannel: msg.source_port || '',
                        status: tx.code === 0 ? 'Success' : 'Failed',
                        timestamp: tx.timestamp || '',
                    };
                });
                setTransfers(parsed);
            } catch (error) {
                console.error('Error fetching IBC transfers:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchIBCTransfers();
    }, []);

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent="center" alignItems="center" spacing={2}>
                <Grid item xs={10} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>
                <Grid item xs={10}>
                    <Typography variant="h4" sx={{ mb: 2 }}>
                        IBC Transfers
                    </Typography>
                    {loading ? (
                        <TableSkeleton columns={7} rows={10} />
                    ) : (
                        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                            <TableContainer sx={{ maxHeight: 600, padding: '15px' }}>
                                <Table stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Tx Hash</TableCell>
                                            <TableCell>Block</TableCell>
                                            <TableCell>Sender</TableCell>
                                            <TableCell>Receiver</TableCell>
                                            <TableCell>Amount</TableCell>
                                            <TableCell>Channel</TableCell>
                                            <TableCell>Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {transfers.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} align="center">
                                                    <Typography color="text.secondary">
                                                        No IBC transfers found.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            transfers
                                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                                .map((t) => (
                                                    <TableRow key={t.hash}>
                                                        <TableCell>
                                                            <Link to={`/transactionpage/${t.hash}`}>
                                                                {t.hash.slice(0, 10)}...
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Link to={`/blockpage/${t.height}`}>{t.height}</Link>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Link to={`/wallet/${t.sender}`}>
                                                                {t.sender.slice(0, 12)}...
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell>{t.receiver.slice(0, 12)}...</TableCell>
                                                        <TableCell>
                                                            {formatAmount(t.amount, t.denom)} {formatDenom(t.denom)}
                                                        </TableCell>
                                                        <TableCell>{t.sourceChannel}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={t.status}
                                                                color={t.status === 'Success' ? 'success' : 'error'}
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                rowsPerPageOptions={[10, 25, 100]}
                                component="div"
                                count={transfers.length}
                                rowsPerPage={rowsPerPage}
                                page={page}
                                onPageChange={(_, p) => setPage(p)}
                                onRowsPerPageChange={(e) => {
                                    setRowsPerPage(parseInt(e.target.value, 10));
                                    setPage(0);
                                }}
                            />
                        </Paper>
                    )}
                </Grid>
            </Grid>
        </Layout>
    );
};

export default IBCTransfersPage;
