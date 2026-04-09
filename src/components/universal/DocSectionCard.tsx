import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

interface DocSectionCardProps {
    id: string;
    number: string;
    title: string;
    children: React.ReactNode;
}

const DocSectionCard: React.FC<DocSectionCardProps> = ({ id, number, title, children }) => (
    <Card id={id} sx={{ mb: 3 }}>
        <CardContent>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                {number}. {title}
            </Typography>
            {children}
        </CardContent>
    </Card>
);

export default DocSectionCard;
