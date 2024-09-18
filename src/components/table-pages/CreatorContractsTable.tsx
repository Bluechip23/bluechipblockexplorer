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

interface Data {
    Creator: string;
    Address: string;
    MonthlyTransactions: number;
    TotalTransactions: number;
    CreationDate: string;
}

function createData(
    Creator: string,
    Address: string,
    MonthlyTransactions: number,
    TotalTransactions: number,
    CreationDate: string,
): Data {
    return { Creator, Address, MonthlyTransactions, TotalTransactions, CreationDate };
}

const rows = [
    createData('India', '1', 1324171354, 3287263, ''),
    createData('China', 'CN', 1403500365, 9596961, ''),
    createData('Italy', 'IT', 60483973, 301340, ''),
    createData('United States', 'US', 327167434, 9833520, ''),
    createData('Canada', 'CA', 37602103, 9984670, ''),
    createData('Australia', 'AU', 25475400, 7692024, ''),
    createData('Germany', 'DE', 83019200, 357578, ''),
    createData('Ireland', 'IE', 4857000, 70273, ''),
    createData('Mexico', 'MX', 126577691, 1972550, ''),
    createData('Brazil', 'BR', 210147125, 8515767, ''),
];

const CreatorContractTable: React.FC = () => {
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
                                         <Link to={`/creatorcontract/${row.Address}`}>{row.Creator}</Link>
                                        </TableCell>
                                        <TableCell  >
                                           <Link to={`/creatorcontract/${row.Address}`}>{row.Address}</Link> 
                                        </TableCell>
                                        <TableCell  >
                                            {row.MonthlyTransactions}
                                        </TableCell>
                                        <TableCell  >
                                            {row.TotalTransactions}
                                        </TableCell>
                                        <TableCell >
                                          <Link to=''>{row.CreationDate}</Link>  
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