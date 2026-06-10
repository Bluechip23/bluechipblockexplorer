import React, { useEffect, useState } from 'react';
import {
    Card,
    CardContent,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { fetchWalletCommits, WalletCommit } from '../../utils/indexerApi';
import { abbreviateAddress, formatMicroAmount } from '../../utils/contractQueries';

// Per-transaction creator-pool commit history for a wallet, served by
// the indexer (the chain only stores per-wallet cumulative totals).
// Renders nothing when the indexer is unreachable or the wallet has
// never committed, so the wallet page works unchanged without one.
const WalletCommitHistory: React.FC<{ wallet: string }> = ({ wallet }) => {
    const [commits, setCommits] = useState<WalletCommit[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchWalletCommits(wallet, 50).then((rows) => {
            if (!cancelled) setCommits(rows);
        });
        return () => { cancelled = true; };
    }, [wallet]);

    if (!commits || commits.length === 0) return null;

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>Creator Pool Commits</Typography>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Time</TableCell>
                            <TableCell>Pool</TableCell>
                            <TableCell>Phase</TableCell>
                            <TableCell align="right">USD</TableCell>
                            <TableCell align="right">bluechip</TableCell>
                            <TableCell>Tx</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {commits.map((c) => (
                            <TableRow key={`${c.txhash}-${c.ts}`}>
                                <TableCell>{new Date(c.ts * 1000).toLocaleString()}</TableCell>
                                <TableCell>
                                    <Link to={`/creatorpool/${c.pool}`}>{abbreviateAddress(c.pool)}</Link>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        variant="outlined"
                                        label={c.phase}
                                        color={c.phase === 'funding' ? 'warning' : 'success'}
                                    />
                                </TableCell>
                                <TableCell align="right">${formatMicroAmount(c.amount_usd ?? '0')}</TableCell>
                                <TableCell align="right">{formatMicroAmount(c.amount_bluechip ?? '0')}</TableCell>
                                <TableCell>
                                    <Link to={`/transactionpage/${c.txhash}`}>{c.txhash.slice(0, 10)}...</Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

export default WalletCommitHistory;
