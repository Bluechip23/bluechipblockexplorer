import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { Button, Stack, Tooltip, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { apiEndpoint } from '../universal/IndividualPage.const';
import { truncateAddress, decodeMsgType, timeAgo, exportToCsv } from '../../utils/formatters';
import CopyToClipboard from '../universal/CopyToClipboard';
import axios from 'axios';
import { useEffect, useState } from 'react';
import DownloadIcon from '@mui/icons-material/Download';

interface Column {
    id: 'hash' | 'method' | 'block' | 'age' | 'sender' | 'recipient' | 'value' | 'fee';
    label: string;
}

const columns: readonly Column[] = [
    { id: 'hash', label: 'Tx Hash' },
    { id: 'method', label: 'Method' },
    { id: 'block', label: 'Block' },
    { id: 'age', label: 'Age' },
    { id: 'sender', label: 'From' },
    { id: 'recipient', label: 'To' },
    { id: 'value', label: 'Value' },
    { id: 'fee', label: 'Fee' },
];

interface RecentTransactionRow {
    hash: string;
    method: string;
    block: string;
    age: string;
    sender: string;
    recipient: string;
    value: number;
    fee: number;
}

const RecentTransactionsTable: React.FC = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [rows, setRows] = useState<RecentTransactionRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadTx() {
            try {
                const response = await axios.get(`${apiEndpoint}/tx_search`, {
                    params: {
                        query: 'tx.height>0',
                        page: page + 1,
                        per_page: rowsPerPage,
                        order_by: 'desc',
                    },
                });
                const transactions = response.data.result.txs;

                const blockRows = transactions.map((tx: any) => ({
                    hash: tx.txhash || tx.hash || '',
                    method: decodeMsgType(tx.tx?.body?.messages?.[0]?.['@type'] || tx.tx?.body?.messages?.[0]?.type || ''),
                    block: tx.height || '',
                    age: tx.timestamp || tx.time || '',
                    sender: tx.tx?.body?.messages?.[0]?.from_address || tx.tx?.body?.messages?.[0]?.sender || '',
                    recipient: tx.tx?.body?.messages?.[0]?.to_address || tx.tx?.body?.messages?.[0]?.recipient || '',
                    value: tx.tx?.body?.messages?.[0]?.amount?.[0]?.amount || 0,
                    fee: tx.tx?.auth_info?.fee?.amount?.[0]?.amount || 0,
                }));
                setRows(blockRows);
            } catch (error) {
                console.error('Error loading transactions:', error);
            } finally {
                setLoading(false);
            }
        }
        loadTx();
    }, [page, rowsPerPage]);

    const handleExportCsv = () => {
        const headers = ['Hash', 'Method', 'Block', 'From', 'To', 'Value', 'Fee'];
        const csvRows = rows.map(r => [r.hash, r.method, r.block, r.sender, r.recipient, String(r.value), String(r.fee)]);
        exportToCsv('recent_transactions.csv', headers, csvRows);
    };

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 440, padding: '15px' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant='h5'>Recent Transactions</Typography>
                    <Tooltip title="Export to CSV">
                        <Button size="small" startIcon={<DownloadIcon />} onClick={handleExportCsv}>CSV</Button>
                    </Tooltip>
                </Stack>
                <Table stickyHeader aria-label="recent transactions table" size="small">
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell key={column.id} sx={{ fontWeight: 600 }}>
                                    {column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((row) => (
                                <TableRow key={row.hash} hover>
                                    <TableCell>
                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                            <Tooltip title={row.hash}>
                                                <Link to={`/transactionpage/${row.hash}`}>{truncateAddress(row.hash, 8, 6)}</Link>
                                            </Tooltip>
                                            <CopyToClipboard text={row.hash} />
                                        </Stack>
                                    </TableCell>
                                    <TableCell>{row.method}</TableCell>
                                    <TableCell>
                                        <Link to={`/blockpage/${row.block}`}>{row.block}</Link>
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title={row.age}>
                                            <span>{timeAgo(row.age)}</span>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title={row.sender}>
                                            <Link to={`/wallet/${row.sender}`}>{truncateAddress(row.sender)}</Link>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title={row.recipient}>
                                            <Link to={`/wallet/${row.recipient}`}>{truncateAddress(row.recipient)}</Link>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell>{row.value}</TableCell>
                                    <TableCell>{row.fee}</TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                rowsPerPageOptions={[10, 25, 100]}
                component="div"
                count={rows.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
            />
        </Paper>
    );
}

export default RecentTransactionsTable;
