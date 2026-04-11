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
import { Layout } from '../ui';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import BlockExplorerNavBar from '../navigation/BlockExplorerNavBar';
import GeneralStats from '../navigation/GeneralStats';
import { useWallet } from '../context/WalletContext';
import { TabPanel, NotConnectedView } from '../components/universal/PortfolioShared';
import StatCard from '../components/universal/StatCard';
import PortfolioCommitmentsTable from '../components/portfolio/PortfolioCommitmentsTable';
import PortfolioPositionsTable from '../components/portfolio/PortfolioPositionsTable';
import PortfolioTransactionsTable from '../components/portfolio/PortfolioTransactionsTable';
import PortfolioHoldingsTable from '../components/portfolio/PortfolioHoldingsTable';
import { MyCommitment, MyPosition } from '../components/portfolio/types';
import {
    fetchAllPoolSummaries,
    queryPoolCommits,
    queryPositions,
    queryWalletHoldings,
    formatMicroAmount,
    WalletHolding,
} from '../utils/contractQueries';
import { factoryAddress } from '../components/universal/IndividualPage.const';

const ChainPortfolioPage: React.FC = () => {
    const { address, balance } = useWallet();
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [commitments, setCommitments] = useState<MyCommitment[]>([]);
    const [positions, setPositions] = useState<MyPosition[]>([]);
    const [holdings, setHoldings] = useState<WalletHolding[]>([]);

    useEffect(() => {
        if (!address || !factoryAddress) return;
        let cancelled = false;

        async function loadPortfolio() {
            setLoading(true);
            try {
                const pools = await fetchAllPoolSummaries(factoryAddress);
                if (cancelled) return;

                const myCommitments: MyCommitment[] = [];
                const myPositions: MyPosition[] = [];

                // Process pools in batches of 3 to limit concurrent requests
                const BATCH_SIZE = 3;
                for (let i = 0; i < pools.length; i += BATCH_SIZE) {
                    if (cancelled) return;
                    const batch = pools.slice(i, i + BATCH_SIZE);
                    await Promise.all(batch.map(async (pool) => {
                        const commits = await queryPoolCommits(pool.poolAddress);
                        if (commits?.commiters) {
                            const myCommit = commits.commiters.find((c) => c.wallet === address);
                            if (myCommit) myCommitments.push({ pool, commit: myCommit });
                        }
                        if (pool.thresholdReached) {
                            const positionsResp = await queryPositions(pool.poolAddress);
                            if (positionsResp?.positions) {
                                positionsResp.positions
                                    .filter((p) => p.owner === address)
                                    .forEach((p) => myPositions.push({ pool, position: p }));
                            }
                        }
                    }));
                }

                const myHoldings = await queryWalletHoldings(address, pools);
                if (!cancelled) { setCommitments(myCommitments); setPositions(myPositions); setHoldings(myHoldings); }
            } catch (err) { console.error('Error loading portfolio:', err); }
            finally { if (!cancelled) setLoading(false); }
        }

        loadPortfolio();
        return () => { cancelled = true; };
    }, [address]);

    const totalCommittedUsd = commitments.reduce((sum, c) => sum + parseInt(c.commit.total_paid_usd || '0'), 0);
    const totalCommittedBluechip = commitments.reduce((sum, c) => sum + parseInt(c.commit.total_paid_bluechip || '0'), 0);
    const totalUnclaimedFees0 = positions.reduce((sum, p) => sum + parseInt(p.position.unclaimed_fees_0 || '0'), 0);
    const totalUnclaimedFees1 = positions.reduce((sum, p) => sum + parseInt(p.position.unclaimed_fees_1 || '0'), 0);
    const totalLiquidity = positions.reduce((sum, p) => sum + parseInt(p.position.liquidity || '0'), 0);
    const lastFeeCollection = positions.reduce((latest, p) => { const ts = p.position.last_fee_collection || 0; return ts > latest ? ts : latest; }, 0);

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent="center" spacing={2}>
                <Grid item xs={12} md={10} sx={{ mt: '10px' }}>
                    <Stack spacing={2}><BlockExplorerNavBar /><GeneralStats /></Stack>
                </Grid>
                <Grid item xs={12} md={10}>
                    {!address ? <NotConnectedView /> : (
                        <Stack spacing={2}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>Chain Portfolio</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{address}</Typography>
                                    {balance && <Typography variant="body2" sx={{ mt: 0.5 }}>Wallet Balance: <strong>{(parseInt(balance.amount) / 1_000_000).toFixed(2)} bluechip</strong></Typography>}
                                </CardContent>
                            </Card>

                            <Grid container spacing={2}>
                                <Grid item xs={6} sm={3}><StatCard label="Tokens Held" value={holdings.length + (balance && parseInt(balance.amount) > 0 ? 1 : 0)} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="Pools Committed" value={commitments.length} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="Total Committed (USD)" value={`$${formatMicroAmount(totalCommittedUsd.toString())}`} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="Total Committed (bluechip)" value={formatMicroAmount(totalCommittedBluechip.toString())} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="LP Positions" value={positions.length} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="Total Liquidity Provided" value={formatMicroAmount(totalLiquidity.toString())} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="Unclaimed Fees (bluechip)" value={formatMicroAmount(totalUnclaimedFees0.toString())} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="Unclaimed Fees (Token)" value={formatMicroAmount(totalUnclaimedFees1.toString())} /></Grid>
                                <Grid item xs={6} sm={3}><StatCard label="Last Fee Collection" value={lastFeeCollection > 0 ? new Date(lastFeeCollection / 1_000_000).toLocaleDateString() : 'Never'} /></Grid>
                            </Grid>

                            <Card>
                                <CardContent sx={{ pb: 0 }}>
                                    <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                        <Tab label={`My Holdings (${holdings.length + (balance && parseInt(balance.amount) > 0 ? 1 : 0)})`} />
                                        <Tab label={`Pools I Committed To (${commitments.length})`} />
                                        <Tab label={`My LP Positions (${positions.length})`} />
                                        <Tab label="My Transactions" />
                                    </Tabs>
                                </CardContent>
                                <CardContent>
                                    <TabPanel value={tab} index={0}><PortfolioHoldingsTable holdings={holdings} nativeBalance={balance?.amount || null} loading={loading} /></TabPanel>
                                    <TabPanel value={tab} index={1}><PortfolioCommitmentsTable commitments={commitments} loading={loading} /></TabPanel>
                                    <TabPanel value={tab} index={2}><PortfolioPositionsTable positions={positions} loading={loading} /></TabPanel>
                                    <TabPanel value={tab} index={3}><PortfolioTransactionsTable commitments={commitments} positions={positions} loading={loading} /></TabPanel>
                                </CardContent>
                            </Card>
                        </Stack>
                    )}
                </Grid>
            </Grid>
        </Layout>
    );
};

export default ChainPortfolioPage;
