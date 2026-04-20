import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Typography, Box, LinearProgress } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { compareMicro, microToNumber, safeBigInt } from '../utils/bigintMath';

interface CommitTrackerProps {
    client: SigningCosmWasmClient | null;
    contractAddress: string;
}

interface Commit {
    total_paid_usd: string;
    total_paid_bluechip: string;
    last_committed: string;
}

interface GraphDataPoint {
    name: string;
    value: number;
    total: number;
    timestamp: string;
}

const CommitTracker: React.FC<CommitTrackerProps> = ({ client, contractAddress }) => {
    const [commits, setCommits] = useState<Commit[]>([]);
    const [totalRaised, setTotalRaised] = useState(0);
    const [totalBluechips, setTotalBluechips] = useState(0);
    const [graphData, setGraphData] = useState<GraphDataPoint[]>([]);
    const THRESHOLD = 25000;

    const fetchCommits = useCallback(async () => {
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
                let bluechipTotal = 0n;
                const data: GraphDataPoint[] = sortedCommits.map((commit: Commit) => {
                    const value = safeBigInt(commit.total_paid_usd);
                    cumulative += value;
                    bluechipTotal += safeBigInt(commit.total_paid_bluechip);
                    // Cosmos SDK timestamps are nanoseconds — divide by 1e6 for ms.
                    const tsNs = safeBigInt(commit.last_committed);
                    const tsMs = tsNs === 0n ? NaN : Number(tsNs / 1_000_000n);
                    return {
                        name: '',
                        value: microToNumber(value, 0),
                        total: microToNumber(cumulative, 0),
                        timestamp: Number.isNaN(tsMs) ? '-' : new Date(tsMs).toLocaleString(),
                    };
                });

                setCommits(sortedCommits);
                setTotalRaised(microToNumber(cumulative, 0));
                setTotalBluechips(microToNumber(bluechipTotal, 0));
                setGraphData(data);
            }
        } catch (err) {
            console.error('Error fetching commits:', err);
        }
    }, [client, contractAddress]);

    useEffect(() => {
        if (client && contractAddress) {
            fetchCommits();
        }
    }, [client, contractAddress, fetchCommits]);

    const displayTotal = totalRaised > 1000000 ? totalRaised / 1000000 : totalRaised;
    const progress = Math.min((displayTotal / THRESHOLD) * 100, 100);

    return (
        <Card sx={{ mb: 2 }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>Subscription Tracker</Typography>
                <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">Raised: ${displayTotal.toLocaleString()}</Typography>
                        <Typography variant="body2">Goal: ${THRESHOLD.toLocaleString()}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5 }} />
                    <Typography variant="caption" color="textSecondary">
                        Bluechips Committed: {totalBluechips.toLocaleString()}
                    </Typography>
                </Box>
                <Box sx={{ height: 300, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={graphData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                            <XAxis dataKey="name" label={{ value: `Users Committed: ${commits.length}`, offset: -10 }} />
                            <YAxis
                                domain={[0, Math.max(THRESHOLD, displayTotal * 1.1)]}
                                label={{ value: 'Subscription Amount', angle: -90, position: 'left', dy: -60, offset: -10 }}
                                tick={{ fontSize: 10 }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#333', border: 'none', color: '#fff' }}
                                labelStyle={{ color: '#aaa' }}
                                formatter={(value: any, name: any) => [`$${value}`, name === 'total' ? 'Cumulative Total' : 'Transaction Value']}
                            />
                            <ReferenceLine y={THRESHOLD} label="Goal" stroke="red" strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} dot={false} activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </Box>
            </CardContent>
        </Card>
    );
};

export default CommitTracker;
