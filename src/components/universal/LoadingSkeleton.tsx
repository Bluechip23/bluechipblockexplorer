import React from 'react';
import { Card, CardContent, Skeleton, Stack, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';

export const CardSkeleton: React.FC = () => (
    <Card>
        <CardContent>
            <Skeleton variant="text" width="40%" height={40} />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="50%" />
        </CardContent>
    </Card>
);

interface TableSkeletonProps {
    columns?: number;
    rows?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ columns = 6, rows = 5 }) => (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 440, padding: '15px' }}>
            <Skeleton variant="text" width="30%" height={40} sx={{ mb: 1 }} />
            <Table>
                <TableHead>
                    <TableRow>
                        {Array.from({ length: columns }).map((_, i) => (
                            <TableCell key={i}>
                                <Skeleton variant="text" width="80%" />
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {Array.from({ length: rows }).map((_, rowIdx) => (
                        <TableRow key={rowIdx}>
                            {Array.from({ length: columns }).map((_, colIdx) => (
                                <TableCell key={colIdx}>
                                    <Skeleton variant="text" />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    </Paper>
);

export const PageSkeleton: React.FC = () => (
    <Stack spacing={2} sx={{ mt: 2 }}>
        <Skeleton variant="rectangular" height={60} />
        <Skeleton variant="rectangular" height={100} />
        <CardSkeleton />
        <TableSkeleton />
    </Stack>
);
