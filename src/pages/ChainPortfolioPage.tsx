import React, { useEffect, useState } from 'react';
import {
    Card,
    CardContent,
    Grid,
    Stack,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import PageShell from '../components/universal/PageShell';
import { useWallet } from '../context/WalletContext';
import { TabPanel, NotConnectedView } from '../components/universal/PortfolioShared';
import StatCard from '../components/universal/StatCard';
import PortfolioCommitmentsTable from '../components/portfolio/PortfolioCommitmentsTable';
import PortfolioPositionsTable from '../components/portfolio/PortfolioPositionsTable';
import PortfolioTransactionsTable from '../components/portfolio/PortfolioTransactionsTable';
import PortfolioHoldingsTable from '../components/portfolio/PortfolioHoldingsTable';
import { MyCommitment } from '../components/portfolio/types';
import {
    fetchAllPoolSummaries,
    queryLpPositions,
    queryPoolCommits,
    queryWalletHoldings,
    formatMicroAmount,
    LpPosition,
    PoolSummary,
    WalletHolding,
} from '../utils/contractQueries';
import { safeBigInt } from '../utils/bigintMath';
import { approxUsd, useNativeUsdRate } from '../hooks/useNativeUsdRate';
import { factoryAddress } from '../components/universal/IndividualPage.const';

const ChainPortfolioPage: React.FC = () => {
    const { address, balance } = useWallet();
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [pools, setPools] = useState<PoolSummary[]>([]);
    const [commitments, setCommitments] = useState<MyCommitment[]>([]);
    const [holdings, setHoldings] = useState<WalletHolding[]>([]);
    const [lpPositions, setLpPositions] = useState<LpPosition[]>([]);
    // Display-only OSMO/USD reference for the committed-total card.
    const usdRate = useNativeUsdRate();

    useEffect(() => {
        if (!address || !factoryAddress) return;
        let cancelled = false;

        async function loadPortfolio() {
            setLoading(true);
            try {
                const allPools = await fetchAllPoolSummaries(factoryAddress);
                if (cancelled) return;
                setPools(allPools);

                const myCommitments: MyCommitment[] = [];

                // Process pools in batches of 3 to limit concurrent requests
                const BATCH_SIZE = 3;
                for (let i = 0; i < allPools.length; i += BATCH_SIZE) {
                    if (cancelled) return;
                    const batch = allPools.slice(i, i + BATCH_SIZE);
                    await Promise.all(batch.map(async (pool) => {
                        const commits = await queryPoolCommits(pool.poolAddress);
                        if (commits?.committers) {
                            const myCommit = commits.committers.find((c) => c.wallet === address);
                            if (myCommit) myCommitments.push({ pool, commit: myCommit });
                        }
                    }));
                }

                const [myHoldings, myLpPositions] = await Promise.all([
                    queryWalletHoldings(address, allPools),
                    queryLpPositions(address, allPools),
                ]);
                if (!cancelled) {
                    setCommitments(myCommitments);
                    setHoldings(myHoldings);
                    setLpPositions(myLpPositions);
                }
            } catch (err) { console.error('Error loading portfolio:', err); }
            finally { if (!cancelled) setLoading(false); }
        }

        loadPortfolio();
        return () => { cancelled = true; };
    }, [address]);

    // Gross micro-OSMO committed across pools (the contracts value nothing in USD).
    const totalCommittedNative = commitments.reduce<bigint>((sum, c) => sum + safeBigInt(c.commit.total_paid_native), 0n);
    // Both legs of a balanced pool are worth ~2x the wallet's OSMO-side
    // underlying — a display estimate at current reserves.
    const totalLpValueOsmo = lpPositions.reduce<bigint>((sum, p) => sum + 2n * safeBigInt(p.osmoAmount), 0n);

    return (
        <PageShell>
                <Grid item xs={12} md={10}>
                    {!address ? <NotConnectedView /> : (
                        <Stack spacing={2}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>Chain Portfolio</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{address}</Typography>
                                    {balance && <Typography variant="body2" sx={{ mt: 0.5 }}>Wallet Balance: <strong>{formatMicroAmount(balance.amount)} OSMO</strong></Typography>}
                                </CardContent>
                            </Card>

                            <Grid container spacing={2}>
                                <Grid item xs={6} sm={3}><StatCard label="Tokens Held" value={holdings.length + (balance && safeBigInt(balance.amount) > 0n ? 1 : 0)} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="Pools Committed" value={commitments.length} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="Total Committed (OSMO)" value={formatMicroAmount(totalCommittedNative.toString())} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="Committed (≈ USD)" value={approxUsd(totalCommittedNative, usdRate) || '—'} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="LP Positions" value={lpPositions.length} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="LP Value (OSMO, est.)" value={formatMicroAmount(totalLpValueOsmo.toString())} /></Grid>
                            </Grid>

                            <Card>
                                <CardContent sx={{ pb: 0 }}>
                                    <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                        <Tab label={`My Holdings (${holdings.length + (balance && safeBigInt(balance.amount) > 0n ? 1 : 0)})`} />
                                        <Tab label={`Pools I Committed To (${commitments.length})`} />
                                        <Tab label={`My LP Positions (${lpPositions.length})`} />
                                        <Tab label="My Transactions" />
                                    </Tabs>
                                </CardContent>
                                <CardContent>
                                    <TabPanel value={tab} index={0}><PortfolioHoldingsTable holdings={holdings} nativeBalance={balance?.amount || null} loading={loading} /></TabPanel>
                                    <TabPanel value={tab} index={1}><PortfolioCommitmentsTable commitments={commitments} loading={loading} /></TabPanel>
                                    <TabPanel value={tab} index={2}><PortfolioPositionsTable positions={lpPositions} loading={loading} /></TabPanel>
                                    <TabPanel value={tab} index={3}><PortfolioTransactionsTable address={address} pools={pools} commitments={commitments} loading={loading} /></TabPanel>
                                </CardContent>
                            </Card>
                        </Stack>
                    )}
                </Grid>
        </PageShell>
    );
};

export default ChainPortfolioPage;
