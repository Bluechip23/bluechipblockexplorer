import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import {
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Collapse,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Grid,
    IconButton,
    Typography,
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Link } from 'react-router-dom';
import CopyableId from '../universal/CopyableId';
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
    { id: 'compare', label: '' },
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

/* ── Pool comparison metric helpers ───────────────────────────────── */

const POOL_COMPARE_METRICS = [
    { key: 'totalLiquidity', label: 'Total Liquidity (TVL)' },
    { key: 'totalFeesCollected', label: 'Total Fees Collected' },
    { key: 'totalCommitters', label: 'Total Committers' },
    { key: 'totalPositions', label: 'LP Positions' },
    { key: 'raised', label: 'Amount Raised' },
    { key: 'tokenPrice', label: 'Token Price' },
    { key: 'marketCap', label: 'Market Cap' },
    { key: 'reserve0', label: 'BLUECHIP Reserve' },
    { key: 'reserve1', label: 'Creator Token Reserve' },
];

function getPoolMetricValue(pool: PoolSummary, metric: string): number {
    switch (metric) {
        case 'totalLiquidity': return parseInt(pool.totalLiquidity || '0');
        case 'totalFeesCollected': return parseInt(pool.totalFeesCollected0 || '0') + parseInt(pool.totalFeesCollected1 || '0');
        case 'totalCommitters': return pool.totalCommitters;
        case 'totalPositions': return pool.totalPositions;
        case 'raised': return parseInt(pool.raised || '0');
        case 'tokenPrice': {
            const r0 = parseInt(pool.reserve0);
            const r1 = parseInt(pool.reserve1);
            return (r0 && r1) ? r0 / r1 : 0;
        }
        case 'marketCap': {
            const r0 = parseInt(pool.reserve0);
            const r1 = parseInt(pool.reserve1);
            const price = (r0 && r1) ? r0 / r1 : 0;
            return price * parseInt(pool.totalSupply || '0');
        }
        case 'reserve0': return parseInt(pool.reserve0 || '0');
        case 'reserve1': return parseInt(pool.reserve1 || '0');
        default: return 0;
    }
}

function getPoolHighlightMap(pools: PoolSummary[], metrics: string[]): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    for (const metric of metrics) {
        const values = pools.map((p) => ({ addr: p.poolAddress, val: getPoolMetricValue(p, metric) }));
        const maxVal = Math.max(...values.map((v) => v.val));
        const allEqual = values.every((v) => v.val === maxVal);
        if (allEqual) {
            result.set(metric, new Set());
        } else {
            result.set(metric, new Set(values.filter((v) => v.val === maxVal).map((v) => v.addr)));
        }
    }
    return result;
}

function formatPoolMetric(pool: PoolSummary, metricKey: string): string {
    const raw = getPoolMetricValue(pool, metricKey);
    switch (metricKey) {
        case 'tokenPrice':
            return raw > 0 ? `${raw.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} BLC` : '-';
        case 'totalCommitters':
        case 'totalPositions':
            return raw.toLocaleString();
        default:
            return formatMicroAmount(Math.floor(raw).toString());
    }
}

/* ── Compare Pools Modal ──────────────────────────────────────────── */

const ComparePoolsModal: React.FC<{
    open: boolean;
    onClose: () => void;
    pools: PoolSummary[];
}> = ({ open, onClose, pools }) => {
    const [focusOpen, setFocusOpen] = React.useState(false);
    const [focusMetrics, setFocusMetrics] = React.useState<Set<string>>(new Set());
    const [deepCompare, setDeepCompare] = React.useState(false);

    const toggleFocusMetric = (key: string) => {
        setFocusMetrics((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const allKeys = POOL_COMPARE_METRICS.map((m) => m.key);
    const highlightMap = getPoolHighlightMap(pools, allKeys);
    const focusHighlightMap = getPoolHighlightMap(pools, Array.from(focusMetrics));

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight="bold">
                    Compare Pools ({pools.length})
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            {/* Further Focus dropdown */}
            <Box sx={{ px: 3, pb: 1 }}>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FilterListIcon />}
                    endIcon={focusOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    onClick={() => setFocusOpen(!focusOpen)}
                >
                    Further Focus{focusMetrics.size > 0 ? ` (${focusMetrics.size})` : ''}
                </Button>
                <Collapse in={focusOpen}>
                    <Box sx={{ mt: 1, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            Select specific metrics to dive deeper into:
                        </Typography>
                        <Grid container spacing={0}>
                            {POOL_COMPARE_METRICS.map((m) => (
                                <Grid item xs={6} sm={4} key={m.key}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                size="small"
                                                checked={focusMetrics.has(m.key)}
                                                onChange={() => toggleFocusMetric(m.key)}
                                            />
                                        }
                                        label={<Typography variant="body2">{m.label}</Typography>}
                                    />
                                </Grid>
                            ))}
                        </Grid>
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<CompareArrowsIcon />}
                                disabled={focusMetrics.size === 0}
                                onClick={() => { setDeepCompare(true); setFocusOpen(false); }}
                            >
                                Compare Selected Metrics
                            </Button>
                        </Box>
                    </Box>
                </Collapse>
            </Box>

            <DialogContent dividers>
                {deepCompare && focusMetrics.size > 0 ? (
                    <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                                Focused Comparison — {focusMetrics.size} metric{focusMetrics.size !== 1 ? 's' : ''}
                            </Typography>
                            <Button size="small" onClick={() => setDeepCompare(false)}>
                                Back to Full Compare
                            </Button>
                        </Box>
                        <Grid container spacing={2}>
                            {pools.map((pool) => (
                                <Grid item xs={12} md={Math.max(4, Math.floor(12 / pools.length))} key={pool.poolAddress}>
                                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
                                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                                            {pool.tokenSymbol} — {pool.tokenName}
                                        </Typography>
                                        {POOL_COMPARE_METRICS.filter((m) => focusMetrics.has(m.key)).map((m) => {
                                            const isHighest = focusHighlightMap.get(m.key)?.has(pool.poolAddress) ?? false;
                                            return (
                                                <Box key={m.key} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                                                    <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                                                    <Typography variant="h6" fontWeight="bold" sx={isHighest ? { color: '#4caf50' } : undefined}>
                                                        {formatPoolMetric(pool, m.key)}
                                                    </Typography>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    </>
                ) : (
                    <Grid container spacing={2}>
                        {pools.map((pool) => (
                            <Grid item xs={12} md={Math.max(4, Math.floor(12 / pools.length))} key={pool.poolAddress}>
                                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            {pool.tokenSymbol}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {pool.tokenName}
                                        </Typography>
                                        <Chip
                                            label={pool.thresholdReached ? 'Active' : 'Pre-threshold'}
                                            color={pool.thresholdReached ? 'success' : 'warning'}
                                            size="small"
                                            variant="outlined"
                                            sx={{ ml: 'auto' }}
                                        />
                                    </Box>
                                    {POOL_COMPARE_METRICS.map((m) => {
                                        const isHighest = highlightMap.get(m.key)?.has(pool.poolAddress) ?? false;
                                        return (
                                            <Box key={m.key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                                                <Typography variant="body2" color="text.secondary">{m.label}</Typography>
                                                <Typography variant="body2" fontWeight="bold" sx={isHighest ? { color: '#4caf50' } : undefined}>
                                                    {formatPoolMetric(pool, m.key)}
                                                </Typography>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </DialogContent>
        </Dialog>
    );
};

/* ── Creator Pool Table ───────────────────────────────────────────── */

const CreatorPoolTable: React.FC = () => {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [rows, setRows] = React.useState<PoolSummary[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [comparedAddresses, setComparedAddresses] = React.useState<Set<string>>(new Set());
    const [showCompare, setShowCompare] = React.useState(false);

    React.useEffect(() => {
        async function loadPools() {
            try {
                if (!factoryAddress) {
                    setError('Factory address not configured. Set REACT_APP_FACTORY_ADDRESS env var.');
                    setLoading(false);
                    return;
                }
                const summaries = await fetchAllPoolSummaries(factoryAddress);
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

    const toggleCompare = (addr: string) => {
        setComparedAddresses((prev) => {
            const next = new Set(prev);
            if (next.has(addr)) next.delete(addr);
            else next.add(addr);
            return next;
        });
    };

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
        <>
            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                {/* Compare bar */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {comparedAddresses.size > 0 && (
                            <Chip
                                label={`${comparedAddresses.size} selected`}
                                size="small"
                                color="primary"
                                variant="outlined"
                            />
                        )}
                    </Box>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<CompareArrowsIcon />}
                        disabled={comparedAddresses.size < 2}
                        onClick={() => setShowCompare(true)}
                    >
                        Compare Pools{comparedAddresses.size > 0 ? ` (${comparedAddresses.size})` : ''}
                    </Button>
                </Box>

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
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                size="small"
                                                checked={comparedAddresses.has(row.poolAddress)}
                                                onChange={() => toggleCompare(row.poolAddress)}
                                            />
                                        </TableCell>
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
                                            <CopyableId value={row.poolAddress}><Link to={`/creatorpool/${row.poolAddress}`}>
                                                {abbreviateAddress(row.poolAddress)}
                                            </Link></CopyableId>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={row.thresholdReached ? 'Active' : 'Pre-threshold'}
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

            <ComparePoolsModal
                open={showCompare}
                onClose={() => setShowCompare(false)}
                pools={rows.filter((r) => comparedAddresses.has(r.poolAddress))}
            />
        </>
    );
};

export default CreatorPoolTable;
