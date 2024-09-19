import * as React from 'react';
import axios from 'axios';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { Link } from 'react-router-dom';
import { rpcEndpoint } from '../universal/IndividualPage.const';

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

interface TopWalletsTableProps {
    walletAddress: string;
    balance: number;
    percentage: number;
    totalTransactions: number;
}

const TopWalletsTable: React.FC = () => {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [rows, setRows] = React.useState<TopWalletsTableProps[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchTopWallets = async () => {
            try {
                const response = await axios.get(`${rpcEndpoint}/topWallets}`);
                const walletsData = response.data.result;

                const walletRows = walletsData.map((wallet: any) => ({
                    walletAddress: wallet.address,
                    balance: wallet.balance,
                    percentage: wallet.percentage,
                    totalTransactions: wallet.totalTransactions,
                }));
                setRows(walletRows);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching wallet data:', error);
                setLoading(false);
            }
        };

        fetchTopWallets();
    }, []);

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
                            .map((row) => {
                                return (
                                    <TableRow key={row.walletAddress}>
                                        <TableCell>
                                            <Link to={`/wallet/${row.walletAddress}`}>{row.walletAddress}</Link>
                                        </TableCell>
                                        <TableCell>{row.balance}</TableCell>
                                        <TableCell>{row.percentage}</TableCell>
                                        <TableCell>{row.totalTransactions}</TableCell>
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
