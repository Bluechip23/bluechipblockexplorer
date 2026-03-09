import React, { useEffect, useState } from 'react'
import { Layout } from '../../ui';
import { Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';
import BlockExpSideBar from '../../navigation/BlockExpSideBar';
import BlockExpTopBar from '../../navigation/BlockExpTopBar';
import { useParams } from 'react-router-dom';
import BlockExplorerNavBar from '../../navigation/BlockExplorerNavBar';
import GeneralStats from '../../navigation/GeneralStats';
import WalletsHoldingsTable from '../../components/individual-pages/WalletHoldingsTable';
import WalletTransactionsTable from '../../components/individual-pages/WalletTransactionsTable';
import { apiEndpoint, rpcEndpoint } from '../../components/universal/IndividualPage.const';
import axios from 'axios';
import { CardSkeleton, TableSkeleton } from '../../components/universal/LoadingSkeleton';
import { formatAmount } from '../../utils/txDecoder';


const Wallet: React.FC = () => {

    const {id} = useParams<{ id: string }>();
    const [wallet, setWallet] = useState({
        address: '',
        balance: '',
    });
    const [balances, setBalances] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSpecificWallet = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const accountResponse = await axios.get(`${apiEndpoint}/bluechip/auth/v1beta1/accounts/${id}`);
                const accountInfo = accountResponse.data.account;

                const balanceResponse = await axios.get(`${apiEndpoint}/bluechip/bank/v1beta1/balances/${id}`);
                const balancesData = balanceResponse.data.balances;

                const primaryBalance = balancesData[0]?.amount || '0';
                setWallet({
                    address: id,
                    balance: primaryBalance
                });

                setBalances(balancesData || []);

                const transactionsResponse = await axios.get(`${apiEndpoint}/bluechip/transactions/${id}`);
                setTransactions(transactionsResponse.data.transactions || []);

            } catch (error) {
                console.error('Error fetching wallet data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSpecificWallet();
    }, [id]);

    if (!id) {
        return <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />} ><Typography>Wallet Not Found</Typography></Layout>;
    }
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent='center' alignItems='center' spacing={5}>
                <Grid item xs={12} md={8} sx={{ mt: '10px' }}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />
                    </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                    {loading ? (
                        <CardSkeleton />
                    ) : (
                        <Card>
                            <CardContent>
                                <Typography variant='h5' sx={{ wordBreak: 'break-all' }}>Wallet: {wallet.address.toString()}</Typography>
                                <Divider />
                                <Typography>Balance: {formatAmount(wallet.balance, 'ubluechip')} BLUECHIP</Typography>
                            </CardContent>
                        </Card>
                    )}
                </Grid>
                <Grid item xs={12} md={8}>
                    {loading ? <TableSkeleton /> : <WalletsHoldingsTable walletHoldings={balances} />}
                </Grid>
                <Grid item xs={12} md={8}>
                    {loading ? <TableSkeleton /> : <WalletTransactionsTable walletTx={transactions} />}
                </Grid>
            </Grid>
        </Layout>
    )
}
export default Wallet;