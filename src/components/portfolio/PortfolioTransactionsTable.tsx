import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
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
import { Link } from 'react-router-dom';
import { abbreviateAddress, formatMicroAmount, PoolSummary } from '../../utils/contractQueries';
import { MyCommitment } from './types';
import { formatNsTimestamp } from '../../utils/datetime';
import CopyableId from '../universal/CopyableId';
import {
    fetchWalletCommits,
    fetchWalletTrades,
    WalletCommit,
    WalletTrade,
} from '../../utils/indexerApi';

interface PortfolioTransactionsTableProps {
    // Connected wallet — drives the per-transaction indexer lookups.
    address: string;
    // Known pools, for mapping a pool address to its token symbol.
    pools: PoolSummary[];
    // On-chain per-pool commit totals: the fallback rows when the
    // indexer is unreachable (the chain stores no per-tx history).
    commitments: MyCommitment[];
    loading: boolean;
}

interface TxRow {
    ts: number;
    height: number;
    txhash: string;
    pool: string;
    kind: 'buy' | 'sell' | 'commit';
    amount: string;      // human-readable primary amount
    received: string;    // human-readable counter amount ('' if unknown)
}

function describeTrade(t: WalletTrade, symbol: string): TxRow {
    const offer = formatMicroAmount(t.offer_amount ?? '0');
    const ret = t.return_amount !== null ? formatMicroAmount(t.return_amount) : '';
    return {
        ts: t.ts, height: t.height, txhash: t.txhash, pool: t.pool,
        kind: t.side,
        amount: t.side === 'buy' ? `${offer} OSMO` : `${offer} ${symbol}`,
        received: ret === '' ? '' : t.side === 'buy' ? `${ret} ${symbol}` : `${ret} OSMO`,
    };
}

function describeCommit(c: WalletCommit, symbol: string): TxRow {
    const usd = c.commit_usd ?? c.amount_usd;
    const bluechip = c.amount_bluechip !== null ? `${formatMicroAmount(c.amount_bluechip)} OSMO` : '';
    return {
        ts: c.ts, height: c.height, txhash: c.txhash, pool: c.pool,
        kind: 'commit',
        amount: usd !== null ? `$${formatMicroAmount(usd)}` : bluechip,
        received: c.tokens_received !== null ? `${formatMicroAmount(c.tokens_received)} ${symbol}` : '',
    };
}

const KIND_CHIP: Record<TxRow['kind'], { label: string; color: 'success' | 'error' | 'info' }> = {
    buy: { label: 'Buy', color: 'success' },
    sell: { label: 'Sell', color: 'error' },
    commit: { label: 'Commit', color: 'info' },
};

const PortfolioTransactionsTable: React.FC<PortfolioTransactionsTableProps> = ({
    address, pools, commitments, loading,
}) => {
    const [rows, setRows] = useState<TxRow[] | null>(null);
    // null = still probing; false = indexer unreachable (chain fallback).
    const [indexerOk, setIndexerOk] = useState<boolean | null>(null);

    const symbolByPool = useMemo(() => {
        const m = new Map<string, string>();
        for (const p of pools) m.set(p.poolAddress, p.tokenSymbol);
        return m;
    }, [pools]);

    useEffect(() => {
        if (!address) return;
        let cancelled = false;
        (async () => {
            const [trades, commits] = await Promise.all([
                fetchWalletTrades(address, 200),
                fetchWalletCommits(address, 200),
            ]);
            if (cancelled) return;
            if (trades === null && commits === null) {
                setIndexerOk(false);
                setRows(null);
                return;
            }
            const sym = (pool: string) => symbolByPool.get(pool) ?? 'Token';
            // A post-threshold commit appears both as a commit and as its
            // AMM buy leg in the trade feed — keep the commit row and drop
            // the duplicate trade (same tx, source 'commit').
            const commitTxs = new Set((commits ?? []).map((c) => c.txhash));
            const merged: TxRow[] = [
                ...(trades ?? [])
                    .filter((t) => !(t.source === 'commit' && commitTxs.has(t.txhash)))
                    .map((t) => describeTrade(t, sym(t.pool))),
                ...(commits ?? []).map((c) => describeCommit(c, sym(c.pool))),
            ];
            merged.sort((a, b) => b.ts - a.ts || b.height - a.height);
            setIndexerOk(true);
            setRows(merged);
        })();
        return () => { cancelled = true; };
    }, [address, symbolByPool]);

    if (loading || (indexerOk === null && rows === null)) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" sx={{ mt: 1 }}>Loading transactions...</Typography>
            </Box>
        );
    }

    // ---- Chain fallback: per-pool commit totals only ----
    if (indexerOk === false) {
        if (commitments.length === 0) {
            return (
                <Card>
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="text.secondary">No transaction history found.</Typography>
                    </CardContent>
                </Card>
            );
        }
        return (
            <Box>
                <Alert severity="info" sx={{ mb: 1 }}>
                    The transaction indexer is unreachable, so this shows your cumulative
                    commit totals per pool from the chain instead of individual transactions.
                </Alert>
                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                    <TableContainer>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Pool</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Total Committed</TableCell>
                                    <TableCell>Last Commit</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {commitments.map((c) => (
                                    <TableRow key={c.pool.poolAddress} hover>
                                        <TableCell>
                                            <Link to={`/creatorpool/${c.pool.poolAddress}`} style={{ textDecoration: 'none' }}>
                                                <Typography variant="body2" color="primary" fontWeight="bold">
                                                    {c.pool.tokenSymbol}
                                                </Typography>
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Chip label="Commitment" color="info" size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell>${formatMicroAmount(c.commit.total_paid_usd)}</TableCell>
                                        <TableCell>{formatNsTimestamp(c.commit.last_committed)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Box>
        );
    }

    // ---- Indexer-backed per-transaction history ----
    if (!rows || rows.length === 0) {
        return (
            <Card>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">
                        No transactions found for this wallet.
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 480 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Pool</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Amount</TableCell>
                            <TableCell>Received</TableCell>
                            <TableCell>Tx</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((tx, i) => {
                            const chip = KIND_CHIP[tx.kind];
                            return (
                                <TableRow key={`${tx.txhash}-${tx.kind}-${i}`} hover>
                                    <TableCell>{new Date(tx.ts * 1000).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Link to={`/creatorpool/${tx.pool}`} style={{ textDecoration: 'none' }}>
                                            <Typography variant="body2" color="primary" fontWeight="bold">
                                                {symbolByPool.get(tx.pool) ?? abbreviateAddress(tx.pool)}
                                            </Typography>
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={chip.label} color={chip.color} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>{tx.amount}</TableCell>
                                    <TableCell>{tx.received || '—'}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                        <CopyableId value={tx.txhash}>{abbreviateAddress(tx.txhash)}</CopyableId>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

export default PortfolioTransactionsTable;
