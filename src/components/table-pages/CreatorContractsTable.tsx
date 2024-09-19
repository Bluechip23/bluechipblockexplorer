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
    id: 'Creator' | 'Address' | 'MonthlyTransactions' | 'TotalTransactions' | 'CreationDate';
    label: string;
    format?: (value: number) => string;
}

const columns: readonly Column[] = [
    { id: 'Creator', label: 'Creator'},
    { id: 'Address', label: 'Address'},
    {
        id: 'MonthlyTransactions',
        label: 'Monthly Transactions',
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'TotalTransactions',
        label: 'Total Transactions',
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'CreationDate',
        label: 'Date Created',
        format: (value: number) => value.toFixed(2),
    },
];

interface CreatorContractTableProps {
    creator: string;
    address: string;
    monthlyTransactions: number;
    totalTransactions: number;
    creationDate: string;
}


const CreatorContractTable: React.FC= () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [rows, setRows] = useState<CreatorContractTableProps[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadCreatorContract() {
            try {
                const response = await axios.get(`${rpcEndpoint}/creatorContract`); 
                const contract = response.data.result.tx; 

                const creatorContractRows = contract.map((contract: any) => ({
                    creator: contract.hash,
                    address: contract.method,
                    monthlyTransactions: contract.height,
                    totalTransactions: contract.sender,
                    creationDate: contract.recipient,
                }));
                setRows(creatorContractRows);
            } catch (error) {
                console.error('Error loading blocks:', error);
            } finally {
                setLoading(false);
            }
        }
        loadCreatorContract();
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
                                         <Link to={`/creatorcontract/${row.address}`}>{row.creator}</Link>
                                        </TableCell>
                                        <TableCell  >
                                           <Link to={`/creatorcontract/${row.address}`}>{row.address}</Link> 
                                        </TableCell>
                                        <TableCell  >
                                            {row.monthlyTransactions}
                                        </TableCell>
                                        <TableCell  >
                                            {row.totalTransactions}
                                        </TableCell>
                                        <TableCell >
                                          <Link to=''>{row.creationDate}</Link>  
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

export default CreatorContractTable;