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
import CreatePoolModal from '../components/actions/CreatePoolModal';
import { TabPanel, NotConnectedView } from '../components/universal/PortfolioShared';
import StatCard from '../components/universal/StatCard';
import PortfolioCommitmentsTable from '../components/portfolio/PortfolioCommitmentsTable';
import PortfolioPositionsTable from '../components/portfolio/PortfolioPositionsTable';
import PortfolioTransactionsTable from '../components/portfolio/PortfolioTransactionsTable';
import PortfolioCreatedPoolsTable from '../components/portfolio/PortfolioCreatedPoolsTable';
import { MyCommitment, MyPosition } from '../components/portfolio/types';
import {
    fetchAllPoolSummaries,
    queryPoolCommits,
    queryPositions,
    findPoolsByCreator,
    formatMicroAmount,
    PoolSummary,
} from '../utils/contractQueries';
import { microToNumber, safeBigInt } from '../utils/bigintMath';
import { factoryAddress } from '../components/universal/IndividualPage.const';

const PortfolioPage: React.FC = () => {
    const { address, balance } = useWallet();
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [commitments, setCommitments] = useState<MyCommitment[]>([]);
    const [positions, setPositions] = useState<MyPosition[]>([]);
    const [createdPools, setCreatedPools] = useState<PoolSummary[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [loadKey, setLoadKey] = useState(0);

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

                await Promise.all(
                    pools.map(async (pool) => {
                        const commits = await queryPoolCommits(pool.poolAddress);
                        if (commits?.commiters) {
                            const myCommit = commits.commiters.find(
                                (c) => c.wallet === address
                            );
                            if (myCommit) {
                                myCommitments.push({ pool, commit: myCommit });
                            }
                        }

                        if (pool.thresholdReached) {
                            const positionsResp = await queryPositions(pool.poolAddress);
                            if (positionsResp?.positions) {
                                positionsResp.positions
                                    .filter((p) => p.owner === address)
                                    .forEach((p) => {
                                        myPositions.push({ pool, position: p });
                                    });
                            }
                        }
                    })
                );

                if (!cancelled) {
                    setCommitments(myCommitments);
                    setPositions(myPositions);
                }

                const myCreatedPools = await findPoolsByCreator(pools, address);
                if (!cancelled) {
                    setCreatedPools(myCreatedPools);
                }
            } catch (err) {
                console.error('Error loading portfolio:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadPortfolio();
        return () => { cancelled = true; };
    }, [address, loadKey]);

    const totalCommittedUsd = commitments.reduce<bigint>(
        (sum, c) => sum + safeBigInt(c.commit.total_paid_usd),
        0n
    );
    const totalCommittedBluechip = commitments.reduce<bigint>(
        (sum, c) => sum + safeBigInt(c.commit.total_paid_bluechip),
        0n
    );
    const totalUnclaimedFees0 = positions.reduce<bigint>(
        (sum, p) => sum + safeBigInt(p.position.unclaimed_fees_0),
        0n
    );
    const totalUnclaimedFees1 = positions.reduce<bigint>(
        (sum, p) => sum + safeBigInt(p.position.unclaimed_fees_1),
        0n
    );
    const totalLiquidity = positions.reduce<bigint>(
        (sum, p) => sum + safeBigInt(p.position.liquidity),
        0n
    );
    const lastFeeCollection = positions.reduce((latest, p) => {
        const ts = p.position.last_fee_collection || 0;
        return ts > latest ? ts : latest;
    }, 0);

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent="center" spacing={2}>
                <Grid item xs={12} md={10} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>

                <Grid item xs={12} md={10}>
                    {!address ? (
                        <NotConnectedView />
                    ) : (
                        <Stack spacing={2}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                                        My Portfolio
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                        {address}
                                    </Typography>
                                    {balance && (
                                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                                            Wallet Balance: <strong>{formatMicroAmount(balance.amount)} bluechip</strong>
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>

                            <Grid container spacing={2}>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Pools Committed" value={commitments.length} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Total Committed (USD)" value={`$${formatMicroAmount(totalCommittedUsd.toString())}`} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Total Committed (bluechip)" value={formatMicroAmount(totalCommittedBluechip.toString())} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="LP Positions" value={positions.length} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Total Liquidity Provided" value={formatMicroAmount(totalLiquidity.toString())} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Unclaimed Fees (bluechip)" value={formatMicroAmount(totalUnclaimedFees0.toString())} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard label="Unclaimed Fees (Token)" value={formatMicroAmount(totalUnclaimedFees1.toString())} />
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <StatCard
                                        label="Last Fee Collection"
                                        value={lastFeeCollection > 0
                                            ? new Date(lastFeeCollection / 1_000_000).toLocaleDateString()
                                            : 'Never'}
                                    />
                                </Grid>
                            </Grid>

                            <Card>
                                <CardContent sx={{ pb: 0 }}>
                                    <Tabs
                                        value={tab}
                                        onChange={(_, v) => setTab(v)}
                                        variant="scrollable"
                                        scrollButtons="auto"
                                        sx={{ borderBottom: 1, borderColor: 'divider' }}
                                    >
                                        <Tab label={`Pools I Committed To (${commitments.length})`} />
                                        <Tab label={`My LP Positions (${positions.length})`} />
                                        <Tab label="My Transactions" />
                                        <Tab label={createdPools.length > 0
                                            ? `My Created Pools (${createdPools.length})`
                                            : 'Creator'
                                        } />
                                    </Tabs>
                                </CardContent>
                                <CardContent>
                                    <TabPanel value={tab} index={0}>
                                        <PortfolioCommitmentsTable commitments={commitments} loading={loading} />
                                    </TabPanel>
                                    <TabPanel value={tab} index={1}>
                                        <PortfolioPositionsTable positions={positions} loading={loading} />
                                    </TabPanel>
                                    <TabPanel value={tab} index={2}>
                                        <PortfolioTransactionsTable
                                            commitments={commitments}
                                            positions={positions}
                                            loading={loading}
                                        />
                                    </TabPanel>
                                    <TabPanel value={tab} index={3}>
                                        <PortfolioCreatedPoolsTable
                                            createdPools={createdPools}
                                            loading={loading}
                                            onCreatePool={() => setShowCreateModal(true)}
                                        />
                                    </TabPanel>
                                </CardContent>
                            </Card>

                            <CreatePoolModal
                                open={showCreateModal}
                                onClose={() => setShowCreateModal(false)}
                                onSuccess={() => setLoadKey((k) => k + 1)}
                            />
                        </Stack>
                    )}
                </Grid>
            </Grid>
        </Layout>
    );
};

export default PortfolioPage;
