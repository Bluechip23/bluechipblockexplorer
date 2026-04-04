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
    { id: 'compare', label: '' },
    { id: 'token', label: 'Token' },
    { id: 'symbol', label: 'Symbol' },
    { id: 'totalSupply', label: 'Total Supply' },
    { id: 'poolLiquidity', label: 'Pool Liquidity' },
    { id: 'status', label: 'Status' },
    { id: 'committers', label: 'Committers' },
];

/* ── Token-focused metric helpers ─────────────────────────────────── */

const TOKEN_FOCUS_METRICS = [
    { key: 'tradeVolume', label: 'Trade Volume (Fees as Proxy)' },
    { key: 'tokenPrice', label: 'Token Price' },
    { key: 'priceChange', label: 'Price Change Potential' },
    { key: 'uniqueHolders', label: 'Unique Holders (Committers)' },
    { key: 'marketCap', label: 'Market Cap' },
];

function getTokenMetricValue(pool: PoolSummary, metric: string): number {
    switch (metric) {
        case 'tradeVolume':
            return parseInt(pool.totalFeesCollected0 || '0') + parseInt(pool.totalFeesCollected1 || '0');
        case 'tokenPrice': {
            const r0 = parseInt(pool.reserve0);
            const r1 = parseInt(pool.reserve1);
            return (r0 && r1) ? r0 / r1 : 0;
        }
        case 'priceChange': {
            // Use reserve ratio as a proxy for price movement potential
            const r0 = parseInt(pool.reserve0);
            const r1 = parseInt(pool.reserve1);
            return (r0 && r1) ? r0 / r1 : 0;
        }
        case 'uniqueHolders':
            return pool.totalCommitters;
        case 'marketCap': {
            const r0 = parseInt(pool.reserve0);
            const r1 = parseInt(pool.reserve1);
            const price = (r0 && r1) ? r0 / r1 : 0;
            return price * parseInt(pool.totalSupply || '0');
        }
        default:
            return 0;
    }
}

function getTokenHighlightMap(pools: PoolSummary[], metrics: string[]): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    for (const metric of metrics) {
        const values = pools.map((p) => ({ addr: p.poolAddress, val: getTokenMetricValue(p, metric) }));
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

function formatTokenMetric(pool: PoolSummary, metricKey: string): string {
    const raw = getTokenMetricValue(pool, metricKey);
    switch (metricKey) {
        case 'tokenPrice':
        case 'priceChange':
            return raw > 0 ? `${raw.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} BLC` : '-';
        case 'uniqueHolders':
            return raw.toLocaleString();
        default:
            return formatMicroAmount(Math.floor(raw).toString());
    }
}

/* ── Compare Tokens Modal ─────────────────────────────────────────── */

const CompareTokensModal: React.FC<{
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

    const allKeys = TOKEN_FOCUS_METRICS.map((m) => m.key);
    const highlightMap = getTokenHighlightMap(pools, allKeys);
    const focusHighlightMap = getTokenHighlightMap(pools, Array.from(focusMetrics));

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight="bold">
                    Compare Tokens ({pools.length})
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
                            {TOKEN_FOCUS_METRICS.map((m) => (
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
                                        {TOKEN_FOCUS_METRICS.filter((m) => focusMetrics.has(m.key)).map((m) => {
                                            const isHighest = focusHighlightMap.get(m.key)?.has(pool.poolAddress) ?? false;
                                            return (
                                                <Box key={m.key} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                                                    <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                                                    <Typography variant="h6" fontWeight="bold" sx={isHighest ? { color: '#4caf50' } : undefined}>
                                                        {formatTokenMetric(pool, m.key)}
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
                                    {TOKEN_FOCUS_METRICS.map((m) => {
                                        const isHighest = highlightMap.get(m.key)?.has(pool.poolAddress) ?? false;
                                        return (
                                            <Box key={m.key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                                                <Typography variant="body2" color="text.secondary">{m.label}</Typography>
                                                <Typography variant="body2" fontWeight="bold" sx={isHighest ? { color: '#4caf50' } : undefined}>
                                                    {formatTokenMetric(pool, m.key)}
                                                </Typography>
                                            </Box>
                                        );
                                    })}
                                    <Divider sx={{ my: 1 }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                        <Typography variant="caption" color="text.secondary">Total Supply</Typography>
                                        <Typography variant="body2">{formatMicroAmount(pool.totalSupply, pool.tokenDecimals)}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                        <Typography variant="caption" color="text.secondary">Pool Liquidity</Typography>
                                        <Typography variant="body2">{formatMicroAmount(pool.totalLiquidity)}</Typography>
                                    </Box>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </DialogContent>
        </Dialog>
    );
};

/* ── Creator Token Table ──────────────────────────────────────────── */

const CreatorTokenTable: React.FC = () => {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [rows, setRows] = React.useState<PoolSummary[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [comparedAddresses, setComparedAddresses] = React.useState<Set<string>>(new Set());
    const [showCompare, setShowCompare] = React.useState(false);

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
                        Compare Tokens{comparedAddresses.size > 0 ? ` (${comparedAddresses.size})` : ''}
                    </Button>
                </Box>

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
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                size="small"
                                                checked={comparedAddresses.has(row.poolAddress)}
                                                onChange={() => toggleCompare(row.poolAddress)}
                                            />
                                        </TableCell>
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
                                                label={row.thresholdReached ? 'Active' : 'Pre-threshold'}
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

            <CompareTokensModal
                open={showCompare}
                onClose={() => setShowCompare(false)}
                pools={rows.filter((r) => comparedAddresses.has(r.poolAddress))}
            />
        </>
    );
};

export default CreatorTokenTable;
