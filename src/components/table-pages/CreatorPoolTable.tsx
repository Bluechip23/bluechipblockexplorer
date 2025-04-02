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
import { apiEndpoint, rpcEndpoint } from '../universal/IndividualPage.const';
import axios from 'axios';

interface Column {
    id: 'Creator' | 'Address' | 'Liquidity' | 'FeesCollected' | 'TopProvider';
    label: string;
    format?: (value: number) => string;
}

const columns: readonly Column[] = [
    { id: 'Creator', label: 'Creator'},
    { id: 'Address', label: 'Address'},
    {
        id: 'Liquidity',
        label: 'Liquidity',
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'FeesCollected',
        label: 'Fees Collected',
        format: (value: number) => value.toLocaleString('en-US'),
    },
    {
        id: 'TopProvider',
        label: 'Top Provider',
        format: (value: number) => value.toFixed(2),
    },
];

interface CreatorPoolTableProps {
    creator: string;
    address: string;
    liquidity: number;
    feesCollected: number;
    topProvider: string;
}


const CreatorPoolTable: React.FC = () => {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [rows, setRows] = React.useState<CreatorPoolTableProps[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        async function loadBlocks() {
            try {
                const response = await axios.get(`${apiEndpoint}/creatorPools`); 
                const pool = response.data.result.pool; 

                const blockRows = pool.map((pool: any) => ({
                    creator: pool.creator,
                    address: pool.address, 
                    liquidity: pool.liquidity, 
                    feesCollected: pool.feeCollected, 
                    topProvider: pool.topProvider, 
                }));

                setRows(blockRows);
            } catch (error) {
                console.error('Error loading blocks:', error);
            } finally {
                setLoading(false);
            }
        }

        loadBlocks();
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
                                         <Link to={`/creatorpool/${row.address}`}>{row.creator}</Link>
                                        </TableCell>
                                        <TableCell  >
                                           <Link to={`/creatorpool/${row.address}`}>{row.address}</Link> 
                                        </TableCell>
                                        <TableCell  >
                                            {row.liquidity}
                                        </TableCell>
                                        <TableCell  >
                                            {row.feesCollected}
                                        </TableCell>
                                        <TableCell >
                                          <Link to={`/walletpage/${row.topProvider}`}>{row.topProvider}</Link>  
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

export default CreatorPoolTable;