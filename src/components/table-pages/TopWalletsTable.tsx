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
import { apiEndpoint, rpcEndpoint } from '../universal/IndividualPage.const';
import { useEffect, useState } from 'react';
import { Typography } from '@mui/material';

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
    balance: string; 
    percentage: number;
    totalTransactions: number;
}

const TopWalletsTable: React.FC = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [rows, setRows] = useState<TopWalletsTableProps[]>([]);

    useEffect(() => {
        const fetchTopWallets = async () => {
            try {
                const response = await axios.get(`${apiEndpoint}/bluehcip/auth/v1beta1/accounts`);
                const accounts = response.data.accounts;
                const balancePromises = accounts.map((account: any) =>
                    axios.get(`${apiEndpoint}/bluechip/bank/v1beta1/balances/${account.address}`)
                );
                const balanceResponses = await Promise.all(balancePromises);

                let walletsData = accounts.map((account: any, index: number) => ({
                    address: account.address,
                    balance: balanceResponses[index].data.balances[0]?.amount || '0',
                    totalTransactions: 0, 
                }));

                walletsData.sort((a: any, b: any) => Number(b.balance) - Number(a.balance));
                const totalBalance = walletsData.reduce((sum: number, wallet: any) => sum + Number(wallet.balance), 0);
                const walletRows = walletsData.slice(0, 100).map((wallet: any) => ({
                    walletAddress: wallet.address,
                    balance: wallet.balance,
                    percentage: (Number(wallet.balance) / totalBalance) * 100,
                    totalTransactions: wallet.totalTransactions,
                }));

                setRows(walletRows);
            } catch (error) {
                <Typography>There has been an error fetching wallet data</Typography>
                console.error('Error fetching wallet data:', error);
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
