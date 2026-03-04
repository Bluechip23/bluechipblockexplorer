import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Chip, Divider, Grid, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import { useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import WalletsHoldingsTable from '../../components/individual-pages/WalletHoldingsTable';
import WalletTransactionsTable from '../../components/individual-pages/WalletTransactionsTable';
import { apiEndpoint } from '../../components/universal/IndividualPage.const';
import { formatTokenAmount, formatDenom } from '../../utils/formatters';
import CopyToClipboard from '../../components/universal/CopyToClipboard';
import axios from 'axios';

interface Delegation {
    validatorAddress: string;
    amount: string;
    denom: string;
}

interface UnbondingEntry {
    validatorAddress: string;
    amount: string;
    completionTime: string;
}

interface Reward {
    validatorAddress: string;
    amount: string;
    denom: string;
}

const Wallet: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [wallet, setWallet] = useState({ address: '', balance: '' });
    const [balances, setBalances] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [unbonding, setUnbonding] = useState<UnbondingEntry[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [totalDelegated, setTotalDelegated] = useState('0');
    const [totalRewards, setTotalRewards] = useState('0');

    useEffect(() => {
        if (!id) return;

        const fetchWalletData = async () => {
            try {
                const [, balanceRes, txRes] = await Promise.all([
                    axios.get(`${apiEndpoint}/bluechip/auth/v1beta1/accounts/${id}`).catch(() => null),
                    axios.get(`${apiEndpoint}/bluechip/bank/v1beta1/balances/${id}`).catch(() => null),
                    axios.get(`${apiEndpoint}/bluechip/transactions/${id}`).catch(() => null),
                ]);

                const balancesData = balanceRes?.data?.balances || [];
                const primaryBalance = balancesData[0]?.amount || '0';
                setWallet({ address: id, balance: primaryBalance });
                setBalances(balancesData);
                setTransactions(txRes?.data?.transactions || []);
            } catch (error) {
                console.error('Error fetching wallet data:', error);
            }
        };

        const fetchStakingData = async () => {
            try {
                const [delRes, unbondRes, rewardsRes] = await Promise.all([
                    axios.get(`${apiEndpoint}/cosmos/staking/v1beta1/delegations/${id}`).catch(() => null),
                    axios.get(`${apiEndpoint}/cosmos/staking/v1beta1/delegators/${id}/unbonding_delegations`).catch(() => null),
                    axios.get(`${apiEndpoint}/cosmos/distribution/v1beta1/delegators/${id}/rewards`).catch(() => null),
                ]);

                // Delegations
                const delegationsList = delRes?.data?.delegation_responses || [];
                const parsedDelegations: Delegation[] = delegationsList.map((d: any) => ({
                    validatorAddress: d.delegation?.validator_address || '',
                    amount: d.balance?.amount || '0',
                    denom: d.balance?.denom || 'ubluechip',
                }));
                setDelegations(parsedDelegations);
                const totalDel = parsedDelegations.reduce((sum: number, d: Delegation) => sum + Number(d.amount), 0);
                setTotalDelegated(String(totalDel));

                // Unbonding
                const unbondingList = unbondRes?.data?.unbonding_responses || [];
                const parsedUnbonding: UnbondingEntry[] = [];
                unbondingList.forEach((u: any) => {
                    (u.entries || []).forEach((entry: any) => {
                        parsedUnbonding.push({
                            validatorAddress: u.validator_address || '',
                            amount: entry.balance || '0',
                            completionTime: entry.completion_time || '',
                        });
                    });
                });
                setUnbonding(parsedUnbonding);

                // Rewards
                const rewardsList = rewardsRes?.data?.rewards || [];
                const parsedRewards: Reward[] = rewardsList.map((r: any) => ({
                    validatorAddress: r.validator_address || '',
                    amount: r.reward?.[0]?.amount || '0',
                    denom: r.reward?.[0]?.denom || 'ubluechip',
                }));
                setRewards(parsedRewards);
                setTotalRewards(rewardsRes?.data?.total?.[0]?.amount || '0');
            } catch (error) {
                console.error('Error fetching staking data:', error);
            }
        };

        fetchWalletData();
        fetchStakingData();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}><Typography>Wallet Not Found</Typography></Layout>;
    }

    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent='center' alignItems='center' spacing={3}>
                <Grid item xs={10} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>

                {/* Account Overview */}
                <Grid item xs={10}>
                    <Card>
                        <CardContent>
                            <Typography variant='h5' gutterBottom>Account Overview</Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Stack spacing={1}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography variant="body2" color="text.secondary">Address:</Typography>
                                    <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>{wallet.address}</Typography>
                                    <CopyToClipboard text={wallet.address} />
                                </Stack>
                                <Stack direction="row" spacing={4}>
                                    <Stack>
                                        <Typography variant="body2" color="text.secondary">Available Balance</Typography>
                                        <Typography variant="h6">{formatTokenAmount(wallet.balance)} BCP</Typography>
                                    </Stack>
                                    <Stack>
                                        <Typography variant="body2" color="text.secondary">Delegated</Typography>
                                        <Typography variant="h6">{formatTokenAmount(totalDelegated)} BCP</Typography>
                                    </Stack>
                                    <Stack>
                                        <Typography variant="body2" color="text.secondary">Unclaimed Rewards</Typography>
                                        <Typography variant="h6">{formatTokenAmount(totalRewards)} BCP</Typography>
                                    </Stack>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Delegations */}
                {delegations.length > 0 && (
                    <Grid item xs={10}>
                        <Card>
                            <CardContent>
                                <Typography variant='h6' gutterBottom>
                                    Delegations <Chip label={delegations.length} size="small" sx={{ ml: 1 }} />
                                </Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 600 }}>Validator</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Reward</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {delegations.map((del, i) => {
                                                const reward = rewards.find(r => r.validatorAddress === del.validatorAddress);
                                                return (
                                                    <TableRow key={i}>
                                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                            {del.validatorAddress}
                                                        </TableCell>
                                                        <TableCell>{formatTokenAmount(del.amount)} {formatDenom(del.denom)}</TableCell>
                                                        <TableCell>{reward ? formatTokenAmount(reward.amount) : '0'} BCP</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    </Grid>
                )}

                {/* Unbonding */}
                {unbonding.length > 0 && (
                    <Grid item xs={10}>
                        <Card>
                            <CardContent>
                                <Typography variant='h6' gutterBottom>
                                    Unbonding <Chip label={unbonding.length} size="small" color="warning" sx={{ ml: 1 }} />
                                </Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 600 }}>Validator</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Completion Time</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {unbonding.map((u, i) => (
                                                <TableRow key={i}>
                                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                        {u.validatorAddress}
                                                    </TableCell>
                                                    <TableCell>{formatTokenAmount(u.amount)} BCP</TableCell>
                                                    <TableCell>{new Date(u.completionTime).toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    </Grid>
                )}

                {/* Holdings */}
                <Grid item xs={10}>
                    <WalletsHoldingsTable walletHoldings={balances} />
                </Grid>

                {/* Transactions */}
                <Grid item xs={10}>
                    <WalletTransactionsTable walletTx={transactions} />
                </Grid>
            </Grid>
        </Layout>
    )
}
export default Wallet;
