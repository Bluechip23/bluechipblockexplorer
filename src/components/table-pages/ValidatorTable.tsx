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
import { useEffect, useState } from 'react';
import axios from 'axios';
import { rpcEndpoint } from '../universal/IndividualPage.const';

interface Column {
    id: 'validator' | 'commision' | 'maxCommision' | 'totalStaked' | 'delegated';
    label: string;
    format?: (value: number) => string;
}

const columns: readonly Column[] = [
    { id: 'validator', label: 'Validator', },
    { id: 'commision', label: 'Commision', },
    {
        id: 'maxCommision',
        label: 'Max Commision',
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'totalStaked',
        label: 'Total Staked',
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'delegated',
        label: 'Delegated',
        format: (value: number) => value.toFixed(2),
    },
];

interface ValidatorRow {
    validator: string;
    commision: number;
    maxCommision: number;
    totalStaked: number;
    delegated: number;
    valId: string;
}

const ValidatorTable: React.FC = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [rows, setRows] = useState<ValidatorRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const topValidator = async () => {
            try {
                const response = await axios.get(`${rpcEndpoint}/validators`);
                const validatorData = response.data.result;

                const validatorRows = validatorData.map((validator: any) => ({
                    validator: validator.address,
                    commision: validator.balance,
                    maxCommision: validator.percentage,
                    totalStaked: validator.totalTransactions,
                    delegated: validator.delegated,
                    valId: validator.valId
                }));
                setRows(validatorRows);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching wallet data:', error);
                setLoading(false);
            }
        };

        topValidator();
    }, []);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(+event.target.value);
        setPage(0);
    };

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 440, padding: '15px' }}>
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
                            .map((row) => (
                                <TableRow key={row.valId}>
                                    <TableCell>
                                        <Link to={`/validator/${row.valId}`}>{row.validator}</Link>
                                    </TableCell>
                                    <TableCell>
                                        {row.commision}
                                    </TableCell>
                                    <TableCell>
                                        {row.maxCommision}
                                    </TableCell>
                                    <TableCell>
                                        {row.totalStaked}
                                    </TableCell>
                                    <TableCell>
                                        {row.delegated}
                                    </TableCell>
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

export default ValidatorTable;
