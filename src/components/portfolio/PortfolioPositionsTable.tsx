import React from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Typography,
} from '@mui/material';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Link } from 'react-router-dom';
import { formatMicroAmount, LpPosition } from '../../utils/contractQueries';
import { safeBigInt } from '../../utils/bigintMath';

// LP lives on the native Osmosis GAMM pool: a position is the wallet's
// gamm/pool/{id} share balance, valued against the pool's live reserves.
// Add/remove and fee realization happen on app.osmosis.zone.

interface PortfolioPositionsTableProps {
    positions: LpPosition[];
    loading: boolean;
}

function poolSharePct(p: LpPosition): string {
    const shares = safeBigInt(p.shareBalance);
    const total = safeBigInt(p.totalShares);
    if (total === 0n) return '-';
    return (Number((shares * 10_000n) / total) / 100).toFixed(2) + '%';
}

const PortfolioPositionsTable: React.FC<PortfolioPositionsTableProps> = ({ positions, loading }) => {
    if (loading) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" sx={{ mt: 1 }}>Loading LP positions...</Typography>
            </Box>
        );
    }

    if (positions.length === 0) {
        return (
            <Card>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary" sx={{ mb: 1 }}>
                        No LP positions found for this wallet.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Liquidity for graduated pools lives on the native Osmosis pool — provide
                        liquidity at app.osmosis.zone and your gamm shares will appear here.
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Pool</TableCell>
                            <TableCell>Osmosis Pool</TableCell>
                            <TableCell>Pool Share</TableCell>
                            <TableCell>OSMO (est.)</TableCell>
                            <TableCell>Token (est.)</TableCell>
                            <TableCell align="right">Manage</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {positions.map((p) => (
                            <TableRow key={p.shareDenom} hover>
                                <TableCell>
                                    <Link to={`/creatorpool/${p.poolAddress}`} style={{ textDecoration: 'none' }}>
                                        <Typography variant="body2" color="primary" fontWeight="bold">
                                            {p.tokenSymbol}
                                        </Typography>
                                    </Link>
                                </TableCell>
                                <TableCell>#{p.gammPoolId}</TableCell>
                                <TableCell>{poolSharePct(p)}</TableCell>
                                <TableCell>{formatMicroAmount(p.osmoAmount)}</TableCell>
                                <TableCell>{`${formatMicroAmount(p.tokenAmount)} ${p.tokenSymbol}`}</TableCell>
                                <TableCell align="right">
                                    <Button
                                        size="small"
                                        endIcon={<OpenInNewIcon fontSize="inherit" />}
                                        href={`https://app.osmosis.zone/pool/${p.gammPoolId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Osmosis
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, py: 1 }}>
                Underlying amounts are estimated from current pool reserves; swap fees accrue
                inside the pool and are realized when liquidity is removed.
            </Typography>
        </Paper>
    );
};

export default PortfolioPositionsTable;
