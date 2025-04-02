import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { apiEndpoint, rpcEndpoint } from '../universal/IndividualPage.const';
import axios from 'axios';
import { useEffect, useState } from 'react';

interface Column {
    id: 'hash' | 'method' | 'block' | 'sender' | 'recipient' | 'value' | 'fee';
    label: string;
    format?: (value: number) => string;
}

const columns: readonly Column[] = [
    { id: 'hash', label: 'Hash' },
    { id: 'method', label: 'Method' },
    { id: 'block', label: 'Block' },
    { id: 'sender', label: 'Sender' },
    { id: 'recipient', label: 'Recipient' },
    { id: 'value', label: 'Value' },
    { id: 'fee', label: 'Fees' },
];

interface RecentTransactionTableProps {
    hash: string;
    method: string;
    block: string;
    sender: string;
    recipient: string;
    value: number;
    fee: number;
}

const RecentTransactionsTable: React.FC = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [rows, setRows] = useState<RecentTransactionTableProps[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadTx() {
            try {
                const response = await axios.get(`${apiEndpoint}/tx_search`, {
                    params: {
                        query: 'tx.height>0', //all transactions since origin
                        page: page + 1, 
                        per_page: rowsPerPage,
                        order_by: 'desc', 
                    },
                });
                const transactions = response.data.result.txs; 

                const blockRows = transactions.map((tx: any) => ({
                    hash: tx.txhash,
                    method: tx.tx.body.messages[0].type, //not sure if our transactions have multiple versions? but [0] should grab the right thing anyways
                    block: tx.height,
                    sender: tx.tx.body.messages[0].sender,
                    recipient: tx.tx.body.messages[0].recipient,
                    value: tx.tx.body.messages[0].amount[0].amount, 
                    fee: tx.tx.auth_info.fee.amount[0].amount, 
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

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(+event.target.value);
        setPage(0);
    };

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 440, padding: '15px' }}>
                <Typography variant='h5'>Recent Transactions</Typography>
                <Table stickyHeader aria-label="sticky table">
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell key={column.id}>
                                    {column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((row) => (
                                <TableRow key={row.hash}>
                                    <TableCell>
                                        <Link to={`/transactionpage/${row.hash}`}>{row.hash}</Link>
                                    </TableCell>
                                    <TableCell>{row.method}</TableCell>
                                    <TableCell>
                                        <Link to={`/block/${row.block}`}>{row.block}</Link>
                                    </TableCell>
                                    <TableCell>
                                        <Link to={`/wallet/${row.sender}`}>{row.sender}</Link>
                                    </TableCell>
                                    <TableCell>
                                        <Link to={`/wallet/${row.recipient}`}>{row.recipient}</Link>
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
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
            />
        </Paper>
    );
}

export default RecentTransactionsTable;
