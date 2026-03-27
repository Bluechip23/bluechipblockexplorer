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
    abbreviateAddress,
    PoolSummary,
} from '../../utils/contractQueries';
import PoolActionMenu from '../actions/PoolActionMenu';

interface Column {
    id: string;
    label: string;
}

const columns: readonly Column[] = [
    { id: 'rank', label: 'Rank' },
    { id: 'token', label: 'Token' },
    { id: 'address', label: 'Pool Address' },
    { id: 'status', label: 'Status' },
    { id: 'liquidity', label: 'Total Liquidity' },
    { id: 'feesCollected', label: 'Fees Collected' },
    { id: 'positions', label: 'LP Positions' },
    { id: 'committers', label: 'Committers' },
    { id: 'actions', label: '' },
];

const CreatorPoolTable: React.FC = () => {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [rows, setRows] = React.useState<PoolSummary[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        async function loadPools() {
            try {
                if (!factoryAddress) {
                    setError('Factory address not configured. Set REACT_APP_FACTORY_ADDRESS env var.');
                    setLoading(false);
                    return;
                }
                const summaries = await fetchAllPoolSummaries(factoryAddress);
                // Sort by total liquidity (TVL) descending
                summaries.sort((a, b) => parseInt(b.totalLiquidity) - parseInt(a.totalLiquidity));
                setRows(summaries);
            } catch (err) {
                console.error('Error loading pools:', err);
                setError('Failed to load pool data from chain.');
            } finally {
                setLoading(false);
            }
        }
        loadPools();
    }, []);

    if (loading) {
        return (
            <Paper sx={{ width: '100%', p: 4, textAlign: 'center' }}>
                <CircularProgress size={28} />
                <Typography variant="body2" sx={{ mt: 1 }}>Loading pools from chain...</Typography>
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
                <Typography color="text.secondary">No creator pools found on chain.</Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 540, padding: '15px' }}>
                <Table stickyHeader aria-label="creator pools table">
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
                            .map((row, idx) => (
                                <TableRow key={row.poolAddress} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight="bold">
                                            #{page * rowsPerPage + idx + 1}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Link to={`/creatorpool/${row.poolAddress}`}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography fontWeight="bold" variant="body2">{row.tokenSymbol}</Typography>
                                                <Typography variant="caption" color="text.secondary">{row.tokenName}</Typography>
                                            </Box>
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
                                    <TableCell>{formatMicroAmount(row.totalLiquidity)}</TableCell>
                                    <TableCell>{formatMicroAmount(row.totalFeesCollected0)}</TableCell>
                                    <TableCell>{row.totalPositions}</TableCell>
                                    <TableCell>{row.totalCommitters}</TableCell>
                                    <TableCell align="right">
                                        <PoolActionMenu
                                            poolAddress={row.poolAddress}
                                            tokenSymbol={row.tokenSymbol}
                                            creatorTokenAddress={row.creatorTokenAddress}
                                            thresholdReached={row.thresholdReached}
                                        />
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

export default CreatorPoolTable;
