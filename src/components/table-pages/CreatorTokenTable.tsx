import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { Chip, CircularProgress, Typography, Box } from '@mui/material';
import { Link } from 'react-router-dom';
import { factoryAddress } from '../universal/IndividualPage.const';
import {
    fetchAllPoolSummaries,
    formatMicroAmount,
    PoolSummary,
} from '../../utils/contractQueries';

interface Column {
    id: string;
    label: string;
}

const columns: readonly Column[] = [
    { id: 'token', label: 'Token' },
    { id: 'symbol', label: 'Symbol' },
    { id: 'totalSupply', label: 'Total Supply' },
    { id: 'poolLiquidity', label: 'Pool Liquidity' },
    { id: 'status', label: 'Status' },
    { id: 'committers', label: 'Committers' },
];

const CreatorTokenTable: React.FC = () => {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [rows, setRows] = React.useState<PoolSummary[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        async function loadTokens() {
            try {
                if (!factoryAddress) {
                    setError('Factory address not configured. Set REACT_APP_FACTORY_ADDRESS env var.');
                    setLoading(false);
                    return;
                }
                const summaries = await fetchAllPoolSummaries(factoryAddress);
                setRows(summaries);
            } catch (err) {
                console.error('Error loading tokens:', err);
                setError('Failed to load token data from chain.');
            } finally {
                setLoading(false);
            }
        }
        loadTokens();
    }, []);

    if (loading) {
        return (
            <Paper sx={{ width: '100%', p: 4, textAlign: 'center' }}>
                <CircularProgress size={28} />
                <Typography variant="body2" sx={{ mt: 1 }}>Loading tokens from chain...</Typography>
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
                <Typography color="text.secondary">No creator tokens found on chain.</Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 540, padding: '15px' }}>
                <Table stickyHeader aria-label="creator tokens table">
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
                                        <Link to={`/creatortoken/${row.creatorTokenAddress}`}>
                                            {row.tokenName}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Typography fontWeight="bold">{row.tokenSymbol}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        {formatMicroAmount(row.totalSupply, row.tokenDecimals)}
                                    </TableCell>
                                    <TableCell>
                                        {formatMicroAmount(row.totalLiquidity)}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={row.thresholdReached ? 'Active' : 'Pre-launch'}
                                            color={row.thresholdReached ? 'success' : 'warning'}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </TableCell>
                                    <TableCell>{row.totalCommitters}</TableCell>
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

export default CreatorTokenTable;
