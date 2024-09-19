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
    id: 'hash' | 'method' | 'block' | 'sender' | 'recipient' | 'value' | 'fee';
    label: string;
    format?: (value: number) => string;
}

const columns: readonly Column[] = [
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

interface WalletTransactionsTableProps {
    hash: string;
    method: string;
    block: string;
    sender: string;
    recipient: string;
    value: number;
    fee: number;
}

function createData(
    hash: string,
    method: string,
    block: string,
    sender: string,
    recipient: string,
    value: number,
    fee: number,
): WalletTransactionsTableProps {
    return { hash, method, block, sender, recipient, value, fee };
}

const rows = [
    createData('India', 'IN', '', '', '', 1324171354, 3287263),
    createData('China', 'CN', '', '', '', 1403500365, 9596961),
    createData('Italy', 'IT', '', '', '', 60483973, 301340),
    createData('United States', 'US', '', '', '', 327167434, 9833520),
    createData('Canada', 'CA', '', '', '', 37602103, 9984670),
    createData('Australia', 'AU', '', '', '', 25475400, 7692024),
    createData('Germany', 'DE', '', '', '', 83019200, 357578),
    createData('Ireland', 'IE', '', '', '', 4857000, 70273),
    createData('Mexico', 'MX', '', '', '', 126577691, 1972550),
    createData('Japan', 'JP', '', '', '', 126317000, 377973),
    createData('France', 'FR', '', '', '', 67022000, 640679),
    createData('United Kingdom', 'GB', '', '', '', 67545757, 242495),
    createData('Russia', 'RU', '', '', '', 146793744, 17098246),
    createData('Nigeria', 'NG', '', '', '', 200962417, 923768),
    createData('Brazil', 'BR', '', '', '', 210147125, 8515767),
];

const WalletTransactionsTable: React.FC<WalletTransactionsTableProps> = (props) => {
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
            <TableContainer sx={{ maxHeight: 440 }}>
                <Typography variant='h5'>Wallets Recent Transactions</Typography>
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
                                            <Link to=''>{row.hash}</Link>
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

export default WalletTransactionsTable;