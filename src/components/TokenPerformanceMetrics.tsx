import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    MenuItem,
    Select,
    SelectChangeEvent,
    Typography,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupIcon from '@mui/icons-material/Group';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import {
    CommiterInfo,
    formatMicroAmount,
    PoolSummary,
    queryPoolCommits,
} from '../utils/contractQueries';

// ─── Types ──────────────────────────────────────────────────────────────────

type TimePeriod = '1m' | '3m' | '1y';

const PERIOD_LABELS: Record<TimePeriod, string> = {
    '1m': '1 Month',
    '3m': '3 Months',
    '1y': '1 Year',
};

const PERIOD_MS: Record<TimePeriod, number> = {
    '1m': 30 * 86400000,
    '3m': 90 * 86400000,
    '1y': 365 * 86400000,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getActiveSubscribers(committers: CommiterInfo[], period: TimePeriod): number {
    const cutoff = Date.now() - PERIOD_MS[period];
    return committers.filter(
        (c) => parseInt(c.last_commited) / 1_000_000 > cutoff
    ).length;
}

function computeCurrentPrice(pool: PoolSummary): string {
    const r0 = parseInt(pool.reserve0);
    const r1 = parseInt(pool.reserve1);
    if (!r0 || !r1) return '-';
    const price = r0 / r1;
    return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

// ─── Metric Row ─────────────────────────────────────────────────────────────

const MetricRow: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subtext?: string;
    period: TimePeriod;
    onPeriodChange: (p: TimePeriod) => void;
    showDropdown?: boolean;
}> = ({ icon, label, value, subtext, period, onPeriodChange, showDropdown = true }) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 1.5,
            px: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '&:last-child': { borderBottom: 'none' },
        }}
    >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {icon}
            <Box>
                <Typography variant="body2" color="text.secondary">
                    {label}
                </Typography>
                {subtext && (
                    <Typography variant="caption" color="text.disabled">
                        {subtext}
                    </Typography>
                )}
            </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h6" fontWeight="bold">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
            {showDropdown && (
                <Select
                    size="small"
                    value={period}
                    onChange={(e: SelectChangeEvent) => onPeriodChange(e.target.value as TimePeriod)}
                    sx={{ minWidth: 100, fontSize: '0.8rem' }}
                >
                    <MenuItem value="1m">{PERIOD_LABELS['1m']}</MenuItem>
                    <MenuItem value="3m">{PERIOD_LABELS['3m']}</MenuItem>
                    <MenuItem value="1y">{PERIOD_LABELS['1y']}</MenuItem>
                </Select>
            )}
        </Box>
    </Box>
);

// ─── Main Component ─────────────────────────────────────────────────────────

interface TokenPerformanceMetricsProps {
    pool: PoolSummary;
}

const TokenPerformanceMetrics: React.FC<TokenPerformanceMetricsProps> = ({ pool }) => {
    const [period, setPeriod] = useState<TimePeriod>('1m');
    const [committers, setCommitters] = useState<CommiterInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [churnModalOpen, setChurnModalOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                const data = await queryPoolCommits(pool.poolAddress);
                if (!cancelled) setCommitters(data?.commiters || []);
            } catch (err) {
                console.error('Error loading committers for metrics:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [pool.poolAddress]);

    const currentPrice = computeCurrentPrice(pool);
    const activeSubscribers = getActiveSubscribers(committers, period);
    const totalSubscribers = pool.totalCommitters;

    return (
        <>
            <Card variant="outlined">
                <CardContent sx={{ pb: '8px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                            {pool.tokenSymbol} — Performance
                        </Typography>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setChurnModalOpen(true)}
                            startIcon={<SyncAltIcon />}
                        >
                            See Churn
                        </Button>
                    </Box>

                    {loading ? (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                            Loading metrics...
                        </Typography>
                    ) : (
                        <Box>
                            {/* Token Price */}
                            <MetricRow
                                icon={<TrendingUpIcon color="primary" />}
                                label="Token Price"
                                value={pool.thresholdReached ? `${currentPrice} BLC` : 'Pre-launch'}
                                subtext="Price change tracking coming soon"
                                period={period}
                                onPeriodChange={setPeriod}
                                showDropdown={false}
                            />

                            {/* Active Subscribers */}
                            <MetricRow
                                icon={<PersonAddIcon color="success" />}
                                label="Active Subscribers"
                                value={activeSubscribers}
                                subtext="Wallets with commit activity in period"
                                period={period}
                                onPeriodChange={setPeriod}
                            />

                            {/* Total Subscribers */}
                            <MetricRow
                                icon={<GroupIcon color="info" />}
                                label="Total Subscribers"
                                value={totalSubscribers}
                                subtext="All-time unique committers"
                                period={period}
                                onPeriodChange={setPeriod}
                                showDropdown={false}
                            />
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Churn Modal — Coming Soon */}
            <Dialog open={churnModalOpen} onClose={() => setChurnModalOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Subscriber Churn</DialogTitle>
                <DialogContent>
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <SyncAltIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                            Coming Soon
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Churn analysis will compare subscriber wallets across time periods to identify
                            repeat subscribers, new subscribers, and lost subscribers. This requires
                            historical transaction indexing which is currently in development.
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setChurnModalOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default TokenPerformanceMetrics;
