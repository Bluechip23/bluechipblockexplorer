import React from 'react';
import { Box, Typography } from '@mui/material';
import { formatMicroAmount, PoolSummary } from '../../utils/contractQueries';
import { getPoolMetricValue } from './poolMetrics';

interface FocusMetricCardProps {
    pool: PoolSummary;
    metricKey: string;
    metricLabel: string;
    isHighest: boolean;
}

/** Quick metric card for the "Further Focus" deep-compare view */
const FocusMetricCard: React.FC<FocusMetricCardProps> = ({ pool, metricKey, metricLabel, isHighest }) => {
    const raw = getPoolMetricValue(pool, metricKey);
    let display: string;
    if (metricKey === 'tokenPrice') {
        display = raw > 0 ? `${raw.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} BLC` : '-';
    } else if (metricKey === 'totalCommitters' || metricKey === 'totalPositions') {
        display = raw.toLocaleString();
    } else {
        display = formatMicroAmount(Math.floor(raw).toString());
    }

    return (
        <Box sx={{ py: 1.5, px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">{metricLabel}</Typography>
            <Typography variant="h6" fontWeight="bold" sx={isHighest ? { color: '#4caf50' } : undefined}>
                {display}
            </Typography>
        </Box>
    );
};

export default FocusMetricCard;
