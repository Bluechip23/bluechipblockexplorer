import React, { useState, useEffect } from 'react';
import { Grid, Paper, Table, TableBody, TableContainer, Typography } from '@mui/material';
import { StargateClient } from '@cosmjs/stargate';
import { Layout } from '../ui';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import DisplayCoinsTableHeader from './DisplayCoinsTableHeader';
import DisplayCoinsRows from './DisplayCoinsRows';


interface TokenData {
    denom: string;
    amount: string;
    price: number;
}

const DisplayCoinsPage: React.FC = () => {
    const [walletBalances, setWalletBalances] = useState<TokenData[]>([]);
    //const { keplrWalletAddress, cosmostationWalletAddress } = useWallet();
   // const walletAddress = keplrWalletAddress || cosmostationWalletAddress;

    /*if (!walletAddress) {
        return (
            <Layout NavBar={<BlockExpTopBar/>} SideBar={<BlockExpSideBar />}>
                <div>Please Connect Your Wallet</div>
            </Layout>
        )
    }

    useEffect(() => {
        const fetchBalancesAndPrices = async () => {
            try {
                const rpcEndpoint = "http://67.218.8.88:26660";
                const client = await StargateClient.connect(rpcEndpoint);
                const balances = await client.getAllBalances(walletAddress);

                const findTokenPrices = await fetch('https://api.example.com/token-prices');
                const tokenPrices = await findTokenPrices.json();

                const priceData: { [denom: string]: number } = {};
                tokenPrices.forEach((token: { denom: string; price: number }) => {
                    priceData[token.denom] = token.price;
                });

                const mutableBalances = balances.map(balance => ({
                    denom: balance.denom,
                    amount: balance.amount,
                    price: priceData[balance.denom] || 0,
                }));

                setWalletBalances(mutableBalances);
            } catch (error) {
                console.error('Error fetching balances or token prices:', error);
            }
        };

        fetchBalancesAndPrices();
    }, [walletAddress]);
*/
    return (
        <Layout NavBar={<BlockExpTopBar/>} SideBar={<BlockExpSideBar />}>
            <Grid container justifyContent="center">
                <Grid item xs={8}>
                    <Typography variant="h6">Balances for </Typography>
                    <Paper sx={{ width: '100%', overflow: 'auto' }}>
                        <TableContainer sx={{ maxHeight: 440 }}>
                            <Table stickyHeader aria-label="sticky table">
                                <DisplayCoinsTableHeader />
                                <TableBody>
                                    {walletBalances.map((coin, index) => (
                                        <DisplayCoinsRows
                                            key={index}
                                            denom={coin.denom}
                                            amountOwned={coin.amount}
                                            price={coin.price}
                                            totalValue={coin.price * Number(coin.amount)}
                                        />
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Layout>
    );
};

export default DisplayCoinsPage;
