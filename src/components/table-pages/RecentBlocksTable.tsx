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
    id: 'block' | 'age' | 'txn' | 'feeRecipient' | 'gasUsed' | 'reward';
    label: string;
    minWidth?: number;
    align?: 'right';
    format?: (value: number) => string;
}

const columns: readonly Column[] = [
    { id: 'block', label: 'Block', },
    { id: 'age', label: 'Age', },
    {
        id: 'txn',
        label: 'Transactions',
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'feeRecipient',
        label: 'Fee Recipient',
    },
    {
        id: 'gasUsed',
        label: 'Gas',
        format: (value: number) => value.toFixed(2),
    },
    {
        id: 'reward',
        label: 'Reward',
        format: (value: number) => value.toFixed(2),
    },
];

interface Data {
    block: string;
    age: string;
    txn: number;
    feeRecipient: string;
    gasUsed: number;
    reward: number;
}

function createData(
    block: string,
    age: string,
    txn: number,
    feeRecipient: string,
    gasUsed: number,
    reward: number,
): Data {
    return { block, age, txn, feeRecipient, gasUsed, reward };
}

const rows = [
    createData('India', 'IN', 1324171354, '', 0, 0),
    createData('China', 'CN', 1403500365, '', 0, 0),
    createData('Italy', 'IT', 60483973, '', 0, 0),
    createData('United States', 'US', 327167434, '', 0, 0),
    createData('Canada', 'CA', 37602103, '', 0, 0),
    createData('Australia', 'AU', 25475400, '', 0, 0),
    createData('Germany', 'DE', 83019200, '', 0, 0),
    createData('Ireland', 'IE', 4857000, '', 0, 0),
    createData('Mexico', 'MX', 126577691, '1972550', 0, 0),
    createData('Japan', 'JP', 126317000, '377973', 0, 0),
    createData('France', 'FR', 67022000, '640679', 0, 0),
    createData('United Kingdom', 'GB', 67545757, '242495', 0, 0),
    createData('Russia', 'RU', 146793744, '17098246', 0, 0),
    createData('Nigeria', 'NG', 200962417, '923768', 0, 0),
    createData('Brazil', 'BR', 210147125, '8515767', 0, 0),
];

const RecentBlocksTable: React.FC = () => {
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
                <Typography variant='h5'>Recent Blocks</Typography>
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
                                            <Link to={`/blockpage/${row.block}`}>{row.block}</Link>
                                        </TableCell>
                                        <TableCell  >
                                            {row.age}
                                        </TableCell>
                                        <TableCell  >
                                            {row.txn}
                                        </TableCell>
                                        <TableCell  >
                                            <Link to=''>{row.feeRecipient}</Link>
                                        </TableCell>
                                        <TableCell  >
                                            {row.gasUsed}
                                        </TableCell>
                                        <TableCell >
                                            {row.reward}
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

export default RecentBlocksTable;