import React, { useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
    Chip,
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
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import TokenPerformanceMetrics from '../TokenPerformanceMetrics';
import FocusMetricCard from './FocusMetricCard';
import { formatMicroAmount, PoolSummary } from '../../utils/contractQueries';
import { getPoolMetricValue, getHighlightMap, POOL_FOCUS_METRICS } from './poolMetrics';

interface ComparePoolsModalProps {
    open: boolean;
    onClose: () => void;
    pools: PoolSummary[];
}

const ComparePoolsModal: React.FC<ComparePoolsModalProps> = ({ open, onClose, pools }) => {
    const [focusOpen, setFocusOpen] = useState(false);
    const [focusMetrics, setFocusMetrics] = useState<Set<string>>(new Set());
    const [deepCompare, setDeepCompare] = useState(false);

    const toggleFocusMetric = (key: string) => {
        setFocusMetrics((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Compute highlight map for the summary metrics shown in the main view
    const allMetricKeys = POOL_FOCUS_METRICS.map((m) => m.key);
    const highlightMap = getHighlightMap(pools, allMetricKeys);

    // For deep compare
    const focusHighlightMap = getHighlightMap(pools, Array.from(focusMetrics));

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
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
                            {POOL_FOCUS_METRICS.map((m) => (
                                <Grid item xs={6} sm={4} md={3} key={m.key}>
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
                    /* ── Deep Compare: focused metric cards ── */
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
                                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 1, pt: 1 }}>
                                            <Typography variant="subtitle1" fontWeight="bold">
                                                {pool.tokenSymbol}
                                            </Typography>
                                            <Chip
                                                label={pool.thresholdReached ? 'Active' : 'Pre-threshold'}
                                                color={pool.thresholdReached ? 'success' : 'warning'}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </Box>
                                        {POOL_FOCUS_METRICS.filter((m) => focusMetrics.has(m.key)).map((m) => (
                                            <FocusMetricCard
                                                key={m.key}
                                                pool={pool}
                                                metricKey={m.key}
                                                metricLabel={m.label}
                                                isHighest={focusHighlightMap.get(m.key)?.has(pool.poolAddress) ?? false}
                                            />
                                        ))}
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    </>
                ) : (
                    /* ── Full Compare: existing side-by-side with green highlights ── */
                    <Grid container spacing={2}>
                        {pools.map((pool) => {
                            // Build a set of metrics where this pool is the highest
                            const greenMetrics = new Set<string>();
                            for (const [metric, winners] of highlightMap) {
                                if (winners.has(pool.poolAddress)) greenMetrics.add(metric);
                            }
                            return (
                                <Grid item xs={12} md={Math.max(4, Math.floor(12 / pools.length))} key={pool.poolAddress}>
                                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 1, pt: 1 }}>
                                            <Typography variant="subtitle1" fontWeight="bold">
                                                {pool.tokenSymbol}
                                            </Typography>
                                            <Chip
                                                label={pool.thresholdReached ? 'Active' : 'Pre-threshold'}
                                                color={pool.thresholdReached ? 'success' : 'warning'}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </Box>
                                        {/* Quick highlight summary before full metrics */}
                                        <Box sx={{ px: 1, pb: 1 }}>
                                            {[
                                                { key: 'totalLiquidity', label: 'TVL' },
                                                { key: 'totalFeesCollected', label: 'Total Fees' },
                                                { key: 'totalCommitters', label: 'Committers' },
                                                { key: 'tokenPrice', label: 'Price' },
                                                { key: 'marketCap', label: 'Market Cap' },
                                            ].map((m) => {
                                                const raw = getPoolMetricValue(pool, m.key);
                                                let display: string;
                                                if (m.key === 'tokenPrice') {
                                                    display = raw > 0 ? `${raw.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} BLC` : '-';
                                                } else if (m.key === 'totalCommitters') {
                                                    display = raw.toLocaleString();
                                                } else {
                                                    display = formatMicroAmount(Math.floor(raw).toString());
                                                }
                                                const isHighest = highlightMap.get(m.key)?.has(pool.poolAddress) ?? false;
                                                return (
                                                    <Box key={m.key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                        <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                                                        <Typography variant="body2" fontWeight="bold" sx={isHighest ? { color: '#4caf50' } : undefined}>
                                                            {display}
                                                        </Typography>
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                        <Divider sx={{ mb: 1 }} />
                                        <TokenPerformanceMetrics pool={pool} />
                                    </Box>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default ComparePoolsModal;
