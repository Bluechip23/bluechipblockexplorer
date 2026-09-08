import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Typography, Box, LinearProgress } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { compareMicro, microToNumber, safeBigInt } from '../utils/bigintMath';
import { fetchRecentCommits } from '../utils/indexerApi';
import { approxUsd, useNativeUsdRate } from '../hooks/useNativeUsdRate';
import { NATIVE_SYMBOL } from './types';

interface CommitTrackerProps {
    client: SigningCosmWasmClient | null;
    contractAddress: string;
}

// Per-wallet ledger entry (creator-pool `pool_commits`). Amounts are
// gross micro-OSMO — the contracts value nothing in USD any more.
interface Commit {
    total_paid_native: string;
    last_committed: string;
}

interface GraphDataPoint {
    name: string;
    value: number;
    total: number;
    timestamp: string;
}

const CommitTracker: React.FC<CommitTrackerProps> = ({ client, contractAddress }) => {
    const [uniqueCommitters, setUniqueCommitters] = useState(0);
    // Whole OSMO (gross, before the 6% fee split) — what counts toward
    // the pool's threshold.
    const [totalRaised, setTotalRaised] = useState(0);
    const [graphData, setGraphData] = useState<GraphDataPoint[]>([]);
    // Funding goal in whole OSMO. The real target is the pool's own
    // threshold (factory commit_threshold_limit_native at creation),
    // read from the pool's `is_fully_commited` query; 500,000 is only
    // the display fallback.
    const [goalOsmo, setGoalOsmo] = useState(500000);
    const usdRate = useNativeUsdRate();

    useEffect(() => {
        if (!client || !contractAddress) return;
        let cancelled = false;
        (async () => {
            try {
                const status = await client.queryContractSmart(contractAddress, { is_fully_commited: {} });
                const target = status && typeof status === 'object' && 'in_progress' in status
                    ? microToNumber((status as { in_progress: { target: string } }).in_progress.target)
                    : 0;
                if (!cancelled && target > 0) setGoalOsmo(target);
            } catch {
                // keep the fallback goal
            }
        })();
        return () => { cancelled = true; };
    }, [client, contractAddress]);

    // Preferred path: the indexer's per-transaction commit history gives
    // the true cumulative funding curve. The on-chain ledger only stores
    // per-wallet totals + last commit time, so repeat commits collapse
    // into one point there.
    const loadFromIndexer = useCallback(async (): Promise<boolean> => {
        const rows = await fetchRecentCommits(contractAddress, 1000);
        if (!rows || rows.length === 0) return false;

        // Only funding-phase commits belong on the curve: they report the
        // pool's running gross-OSMO total (raised_after), from which the
        // indexer derives each commit's contribution (commit_native).
        // Post-threshold "active" commits are AMM buys that no longer
        // count toward the threshold and are excluded.
        const funded = rows.filter((c) => c.commit_native !== null || c.raised_after !== null);
        if (funded.length === 0) return false;

        const ordered = [...funded].sort((a, b) => a.ts - b.ts || a.height - b.height);
        let cumulative = 0n;
        const wallets = new Set<string>();
        const data: GraphDataPoint[] = ordered.map((c) => {
            const value = safeBigInt(c.commit_native ?? '0');
            // Prefer the contract's own running total when present — it is
            // exact even if some earlier commits fell outside this page.
            cumulative = c.raised_after !== null
                ? safeBigInt(c.raised_after)
                : cumulative + value;
            wallets.add(c.committer);
            return {
                name: '',
                value: microToNumber(value),
                total: microToNumber(cumulative),
                timestamp: new Date(c.ts * 1000).toLocaleString(),
            };
        });

        setUniqueCommitters(wallets.size);
        setTotalRaised(microToNumber(cumulative));
        setGraphData(data);
        return true;
    }, [contractAddress]);

    // Fallback: cumulative per-wallet snapshots from the contract,
    // ordered by each wallet's LAST commit time. Under-represents repeat
    // commits but works without an indexer.
    const loadFromChain = useCallback(async () => {
        if (!client) return;
        try {
            const response = await client.queryContractSmart(contractAddress, {
                pool_commits: {
                    pool_contract_address: contractAddress,
                    limit: 100
                }
            });

            if (response && response.committers) {
                const sortedCommits: Commit[] = [...response.committers].sort((a: Commit, b: Commit) => {
                    return compareMicro(a.last_committed, b.last_committed);
                });

                let cumulative = 0n;
                const data: GraphDataPoint[] = sortedCommits.map((commit: Commit) => {
                    const value = safeBigInt(commit.total_paid_native);
                    cumulative += value;
                    // Cosmos SDK timestamps are nanoseconds — divide by 1e6 for ms.
                    const tsNs = safeBigInt(commit.last_committed);
                    const tsMs = tsNs === 0n ? NaN : Number(tsNs / 1_000_000n);
                    return {
                        name: '',
                        value: microToNumber(value),
                        total: microToNumber(cumulative),
                        timestamp: Number.isNaN(tsMs) ? '-' : new Date(tsMs).toLocaleString(),
                    };
                });

                setUniqueCommitters(sortedCommits.length);
                setTotalRaised(microToNumber(cumulative));
                setGraphData(data);
            }
        } catch (err) {
            console.error('Error fetching commits:', err);
        }
    }, [client, contractAddress]);

    useEffect(() => {
        if (!contractAddress) return;
        let cancelled = false;
        (async () => {
            const ok = await loadFromIndexer();
            if (!cancelled && !ok) await loadFromChain();
        })();
        return () => { cancelled = true; };
    }, [contractAddress, loadFromIndexer, loadFromChain]);

    const progress = Math.min((totalRaised / goalOsmo) * 100, 100);
    const raisedUsd = approxUsd(Math.round(totalRaised * 1_000_000), usdRate);
    const goalUsd = approxUsd(Math.round(goalOsmo * 1_000_000), usdRate);

    return (
        <Card sx={{ mb: 2 }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>Subscription Tracker</Typography>
                <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">
                            Raised: {totalRaised.toLocaleString()} {NATIVE_SYMBOL}{raisedUsd ? ` (${raisedUsd})` : ''}
                        </Typography>
                        <Typography variant="body2">
                            Goal: {goalOsmo.toLocaleString()} {NATIVE_SYMBOL}{goalUsd ? ` (${goalUsd})` : ''}
                        </Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5 }} />
                    <Typography variant="caption" color="textSecondary">
                        Gross {NATIVE_SYMBOL} committed (before the 6% fee split) — this is what counts toward the threshold.
                        USD figures are a market reference only.
                    </Typography>
                </Box>
                <Box sx={{ height: 300, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={graphData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                            <XAxis dataKey="name" label={{ value: `Users Committed: ${uniqueCommitters}`, offset: -10 }} />
                            <YAxis
                                domain={[0, Math.max(goalOsmo, totalRaised * 1.1)]}
                                label={{ value: `Committed (${NATIVE_SYMBOL})`, angle: -90, position: 'left', dy: -60, offset: -10 }}
                                tick={{ fontSize: 10 }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#333', border: 'none', color: '#fff' }}
                                labelStyle={{ color: '#aaa' }}
                                formatter={(value: any, name: any) => [`${value} ${NATIVE_SYMBOL}`, name === 'total' ? 'Cumulative Total' : 'Transaction Value']}
                            />
                            <ReferenceLine y={goalOsmo} label="Goal" stroke="red" strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} dot={false} activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </Box>
            </CardContent>
        </Card>
    );
};

export default CommitTracker;
