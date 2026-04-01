import React, { useEffect, useState } from 'react';
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
import { denom, apiEndpoint } from '../universal/IndividualPage.const';
import axios from 'axios';

interface Column {
    id: 'bluechip' | 'hash' | 'method' | 'block' | 'sender' | 'recipient' | 'value' | 'fee';
    label: string;
    format?: (value: number) => string;
}

const columns: readonly Column[] = [
    { id: 'bluechip', label: 'blue chip' },
    { id: 'hash', label: 'Hash' },
    { id: 'method', label: 'Method' },
    {
        id: 'block',
        label: 'Block',
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'sender',
        label: 'Sender',
    },
    {
        id: 'recipient',
        label: 'Recipient',
    },
    {
        id: 'value',
        label: 'Value',
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'fee',
        label: 'Fees',
        format: (value: number) => value.toLocaleString('en-US'),
    },
];

interface Data {
    bluechip: string;
    hash: string;
    method: string;
    block: number;
    sender: string;
    recipient: string;
    value: number;
    fee: number;
}

const BlueChipTokenTransactionsTable: React.FC = () => {
    const [rows, setRows] = useState<Data[]>([]); // State for storing rows
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(+event.target.value);
        setPage(0);
    };

    useEffect(() => {
        const MAX_PAGES = 10;
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 2000;

        const fetchTokenTransactions = async () => {
            let allTransactions: Data[] = [];
            let nextKey: string | null = null;
            let pageCount = 0;
            let retries = MAX_RETRIES;

            do {
                try {
                    const url = `${apiEndpoint}/cosmos/tx/v1beta1/txs?events=transfer.amount.contains('${denom}')${nextKey ? `&pagination.key=${nextKey}` : ''}`;
                    const txQuery = await axios.get(url);
                    const transactions = txQuery.data.txs || [];
                    if (transactions.length === 0 && !nextKey) break;

                    const formattedRows: Data[] = transactions.map((tx: any) => ({
                        bluechip: 'YourToken',
                        hash: tx.txhash,
                        method: 'Transfer',
                        block: tx.height.toString(),
                        sender: tx.body.messages[0].from_address,
                        recipient: tx.body.messages[0].to_address,
                        value: Number(tx.body.messages[0].amount[0].amount),
                        fee: Number(tx.auth_info.fee.amount[0]?.amount || 0),
                    }));

                    allTransactions = [...allTransactions, ...formattedRows];
                    nextKey = txQuery.data.pagination?.next_key;
                    pageCount++;
                } catch (error) {
                    if (retries > 0) {
                        retries--;
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    } else {
                        break;
                    }
                }
            } while (nextKey && pageCount < MAX_PAGES);

            setRows(allTransactions);
        };

        fetchTokenTransactions();
    }, []);

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 440, padding: '15px' }}>
                <Typography variant='h5'>Token Transactions</Typography>
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
                            .map((row, index) => {
                                return (
                                    <TableRow key={row.hash || index}>
                                        <TableCell>
                                            {row.bluechip}
                                        </TableCell>
                                        <TableCell>
                                            <Link to={`/transaction/${row.hash}`}>{row.hash}</Link>
                                        </TableCell>
                                        <TableCell>{row.method}</TableCell>
                                        <TableCell>
                                            {row.block}
                                        </TableCell>
                                        <TableCell>
                                            {row.sender}
                                        </TableCell>
                                        <TableCell>
                                            {row.recipient}
                                        </TableCell>
                                        <TableCell>{row.value}</TableCell>
                                        <TableCell>{row.fee}</TableCell>
                                    </TableRow>
                                );
                            })}
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
};

export default BlueChipTokenTransactionsTable;
