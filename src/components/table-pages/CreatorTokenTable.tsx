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
    id: 'creator' | 'price' | 'change' | 'holders' | 'twentyfourH';
    label: string;
    minWidth?: number;
    format?: (value: number) => string;
}

const columns: readonly Column[] = [
    { id: 'creator', label: 'Creator', minWidth: 170 },
    { id: 'price', label: 'Price', minWidth: 100 },
    {
        id: 'change',
        label: '% Change',
        minWidth: 170,
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'holders',
        label: 'Holders',
        minWidth: 170,
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'twentyfourH',
        label: '24h',
        minWidth: 170,
        format: (value: number) => value.toFixed(2),
    },
];

interface Data {
    creator: string;
    price: number;
    change: number;
    holders: number;
    twentyfourH: number;
    tokenAddress: string;

}

function createData(
    creator: string,
    price: number,
    change: number,
    holders: number,
    twentyfourH: number,
    tokenAddress: string
): Data {
    return { creator, price, change, holders, twentyfourH, tokenAddress };
}

const rows = [
    createData('India', 0, 1324171354, 0, 0,'1'),
    createData('China', 0, 1403500365, 0, 0,''),
    createData('Italy', 0, 1403500365, 0, 0,''),
    createData('United States', 0, 1403500365, 0, 0,''),
    createData('Canada', 0, 1403500365, 0, 0,''),
    createData('Australia', 0, 1403500365, 0, 0,''),
    createData('Germany', 0, 1403500365, 0, 0,''),
    createData('Ireland', 0, 1403500365, 0, 0,''),
    createData('Mexico', 0, 1403500365, 0, 0,''),
    createData('Japan', 0, 1403500365, 0, 0,''),
    createData('France', 0, 1403500365, 0, 0,''),
    createData('United Kingdom', 0, 1403500365, 0, 0,''),
    createData('Russia', 0, 1403500365, 0, 0,''),
    createData('Nigeria', 0, 1403500365, 0, 0,''),
    createData('Brazil', 0, 1403500365, 0, 0,''),
];

const CreatorTokenTable: React.FC = () => {
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
                                    style={{ minWidth: column.minWidth }}
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
                                         <Link to={`/creatortoken/${row.tokenAddress}`}>{row.creator}</Link>
                                        </TableCell>
                                        <TableCell  >
                                            {row.price}
                                        </TableCell>
                                        <TableCell  >
                                            {row.change}
                                        </TableCell>
                                        <TableCell  >
                                            {row.holders}
                                        </TableCell>
                                        <TableCell >
                                            {row.twentyfourH}
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

export default CreatorTokenTable;