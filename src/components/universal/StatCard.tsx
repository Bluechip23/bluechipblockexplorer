import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

interface StatCardProps {
    label: string;
    value: string | number;
    highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, highlight }) => (
    <Card variant="outlined" sx={{ height: '100%', ...(highlight ? { borderColor: 'primary.main', borderWidth: 2 } : {}) }}>
        <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                {label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: highlight ? 'primary.main' : 'text.primary' }}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
        </CardContent>
    </Card>
);

export default StatCard;
