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
import { useEffect, useState } from 'react';
import axios from 'axios';
import { rpcEndpoint } from '../universal/IndividualPage.const';

interface Column {
    id: 'token' | 'amount' | 'value';
    label: string;
    format?: (value: number) => string;
}

const columns: readonly Column[] = [
    { id: 'token', label: 'Token', },
    { id: 'amount', label: 'Amount', },
    { id: 'value', label: 'Value', },

];

interface WalletHoldingsProps {
    token: string;
    amount: string;
    value: string;
}


const WalletsHoldingsTable: React.FC = () => {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [rows, setRows] = useState<WalletHoldingsProps[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadWallet() {
            try {
                const response = await axios.get(`${rpcEndpoint}/wallet`); 
                const wallet = response.data.result.wallet; 

                const walletRows = wallet.map((wallet: any) => ({
                    token: wallet.token,
                    amount: wallet.amount, 
                    value: wallet.value, 
                }));

                setRows(walletRows);
            } catch (error) {
                console.error('Error loading blocks:', error);
            } finally {
                setLoading(false);
            }
        }
        loadWallet();
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
            <TableContainer sx={{ maxHeight: 440 }}>
                <Typography variant='h5'>Wallets Holdings</Typography>
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
                                            <Link to=''>{row.token}</Link>
                                        </TableCell>
                                        <TableCell  >
                                            {row.amount}
                                        </TableCell>
                                        <TableCell  >
                                            <Link to=''>{row.value}</Link>
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

export default WalletsHoldingsTable;