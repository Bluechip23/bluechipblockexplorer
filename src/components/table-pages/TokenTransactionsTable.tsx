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

interface Column {
    id: 'creator' | 'hash' | 'method' | 'block' | 'sender' | 'recipient' | 'value' | 'fee';
    label: string;
    format?: (value: number) => string;
}

const columns: readonly Column[] = [
    { id: 'creator', label: 'Creator', },
    { id: 'hash', label: 'Hash', },
    { id: 'method', label: 'Method', },
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
    creator: string;
    hash: string;
    method: string;
    block: string;
    sender: string;
    recipient: string;
    value: number;
    fee: number;
}

function createData(
    creator: string,
    hash: string,
    method: string,
    block: string,
    sender: string,
    recipient: string,
    value: number,
    fee: number,
): Data {
    return { creator, hash, method, block, sender, recipient, value, fee };
}

const rows = [
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
    createData('India', 'India', 'IN', '', '', '', 1324171354, 3287263),
];

const TokenTransactionsTable: React.FC = () => {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(+event.target.value);
        setPage(0);
    };

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 440, padding:'15px' }}>
                <Typography variant='h5'>Token Transactions</Typography>
                <Table stickyHeader aria-label="sticky table">
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell
                                    key={column.id}
                                >
                                    {column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((row) => {
                                return (
                                    <TableRow>
                                        <TableCell >
                                            <Link to=''>{row.creator}</Link>
                                        </TableCell>
                                        <TableCell >
                                            <Link to={`/transactionpage/${row.hash}`}>{row.hash}</Link>
                                        </TableCell>
                                        <TableCell  >
                                            {row.method}
                                        </TableCell>
                                        <TableCell  >
                                            <Link to=''>{row.block}</Link>
                                        </TableCell>
                                        <TableCell  >
                                            <Link to=''>{row.sender}</Link>
                                        </TableCell>
                                        <TableCell >
                                            <Link to=''>{row.recipient}</Link>
                                        </TableCell>
                                        <TableCell >
                                            {row.value}
                                        </TableCell>
                                        <TableCell >
                                            {row.fee}
                                        </TableCell>
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
}

export default TokenTransactionsTable;