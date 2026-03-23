import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { Chip, CircularProgress, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { factoryAddress } from '../universal/IndividualPage.const';
import {
    fetchAllPoolSummaries,
    abbreviateAddress,
    PoolSummary,
} from '../../utils/contractQueries';

interface Column {
    id: string;
    label: string;
}

const columns: readonly Column[] = [
    { id: 'token', label: 'Token Name' },
    { id: 'symbol', label: 'Symbol' },
    { id: 'contractAddress', label: 'Contract Address' },
    { id: 'poolAddress', label: 'Pool Address' },
    { id: 'status', label: 'Status' },
    { id: 'totalSupply', label: 'Total Supply' },
];

const CreatorContractTable: React.FC = () => {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [rows, setRows] = React.useState<PoolSummary[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        async function loadContracts() {
            try {
                if (!factoryAddress) {
                    setError('Factory address not configured. Set REACT_APP_FACTORY_ADDRESS env var.');
                    setLoading(false);
                    return;
                }
                const summaries = await fetchAllPoolSummaries(factoryAddress);
                setRows(summaries);
            } catch (err) {
                console.error('Error loading contracts:', err);
                setError('Failed to load contract data from chain.');
            } finally {
                setLoading(false);
            }
        }
        loadContracts();
    }, []);

    if (loading) {
        return (
            <Paper sx={{ width: '100%', p: 4, textAlign: 'center' }}>
                <CircularProgress size={28} />
                <Typography variant="body2" sx={{ mt: 1 }}>Loading contracts from chain...</Typography>
            </Paper>
        );
    }

    if (error) {
        return (
            <Paper sx={{ width: '100%', p: 3 }}>
                <Typography color="error">{error}</Typography>
            </Paper>
        );
    }

    if (rows.length === 0) {
        return (
            <Paper sx={{ width: '100%', p: 3 }}>
                <Typography color="text.secondary">No creator contracts found on chain.</Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 540, padding: '15px' }}>
                <Table stickyHeader aria-label="creator contracts table">
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell key={column.id}>{column.label}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((row) => (
                                <TableRow key={row.creatorTokenAddress || row.poolAddress} hover>
                                    <TableCell>
                                        <Link to={`/creatorcontract/${row.creatorTokenAddress}`}>
                                            {row.tokenName}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{row.tokenSymbol}</TableCell>
                                    <TableCell>
                                        <Link to={`/creatorcontract/${row.creatorTokenAddress}`}>
                                            {abbreviateAddress(row.creatorTokenAddress || '')}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Link to={`/creatorpool/${row.poolAddress}`}>
                                            {abbreviateAddress(row.poolAddress)}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={row.thresholdReached ? 'Active' : 'Pre-launch'}
                                            color={row.thresholdReached ? 'success' : 'warning'}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {(parseInt(row.totalSupply) / Math.pow(10, row.tokenDecimals)).toLocaleString()}
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
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                    setRowsPerPage(+e.target.value);
                    setPage(0);
                }}
            />
        </Paper>
    );
};

export default CreatorContractTable;
