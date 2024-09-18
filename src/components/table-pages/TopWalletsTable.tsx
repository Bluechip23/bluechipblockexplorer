import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { Link } from 'react-router-dom';

interface Column {
    id: 'walletAddress' | 'balance' | 'percentage' | 'totalTransactions';
    label: string;
    format?: (value: number) => string;
}

const columns: readonly Column[] = [
    { id: 'walletAddress', label: 'Wallet Address' },
    { id: 'balance', label: 'Balance(BCP)' },
    {
        id: 'percentage',
        label: 'Percentage',
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'totalTransactions',
        label: 'Total Txn',
        format: (value: number) => value.toLocaleString('en-US'),
    },

];

interface Data {
    walletAddress: string;
    balance: number;
    percentage: number;
    totalTransactions: number;

}

function createData(
    walletAddress: string,
    balance: number,
    percentage: number,
    totalTransactions: number,
): Data {
    return { walletAddress, balance, percentage, totalTransactions, };
}

const rows = [
    createData('India', 0, 1324171354, 0,),
    createData('China', 0, 1403500365, 0,),
    createData('Italy', 0, 1403500365, 0,),
    createData('United States', 0, 1403500365, 0,),
    createData('Canada', 0, 1403500365, 0,),
    createData('Australia', 0, 1403500365, 0,),
    createData('Germany', 0, 1403500365, 0,),
    createData('Ireland', 0, 1403500365, 0,),
    createData('Mexico', 0, 1403500365, 0,),
    createData('Japan', 0, 1403500365, 0,),
    createData('France', 0, 1403500365, 0,),
    createData('United Kingdom', 0, 1403500365, 0,),
    createData('Russia', 0, 1403500365, 0,),
    createData('Nigeria', 0, 1403500365, 0,),
    createData('Brazil', 0, 1403500365, 0,),
];

const TopWalletsTable: React.FC = () => {
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
                                            <Link to={`/wallet/${row.walletAddress}`}>{row.walletAddress}</Link>
                                        </TableCell>
                                        <TableCell  >
                                            {row.balance}
                                        </TableCell>
                                        <TableCell  >
                                            {row.percentage}
                                        </TableCell>
                                        <TableCell  >
                                            {row.totalTransactions}
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

export default TopWalletsTable;